<?php

namespace MKL\PC;

use MKL\PC\Global_Configurators\Owner_Resolver as Global_Configurator_Owner_Resolver;
use MKL\PC\Global_Configurators\Schema as Global_Configurator_Schema;
use MKL\PC\Global_Configurators\Storage_Owner as Global_Configurator_Storage_Owner;
use MKL\PC\Global_Layer\Linker as Global_Layer_Linker;


/**
 * Data functions
 *
 *
 * @author   Marc Lacroix
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly
}

class DB { 

	/**
	 *
	 * 
	 */
	private $layers = array();
	private $changed_items_count = 0;
	private $context = 'admin';

	/**
	 * Initialize the class
	 */
	public function __construct() {
		// Add tne import section at the end of the menu
		add_filter( 'mkl_product_configurator_admin_menu', [ $this, 'add_import_section' ], 1200 );
		add_action( 'mkl_pc_saved_configurator_data', [ $this, 'invalidate_integrity_cache_on_configuration_save' ], 10, 3 );

	}

	/**
	 * Return a Storage_Owner for a product, variation, or global configurator CPT id.
	 *
	 * Centralizes `wc_get_product()` so that CPT-backed configurators get a meta API that
	 * mirrors WC_Product (get_meta / update_meta_data / delete_meta_data / save).
	 *
	 * @internal Used by Global_Layer\Linker for chunked product-meta I/O.
	 *
	 * @param int $post_id
	 * @return \MKL\PC\Global_Configurators\Storage_Owner|null
	 */
	public function get_owner( $post_id ) {
		if ( ! class_exists( Global_Configurator_Storage_Owner::class ) ) {
			return null;
		}
		return Global_Configurator_Storage_Owner::for_post( (int) $post_id );
	}

	/**
	 * Decode stored JSON without corrupting valid escaped strings.
	 *
	 * Some legacy meta was saved with slashes, but current JSON should be decoded as-is
	 * so values like `Wheel 8\"` keep their required JSON escape.
	 *
	 * @internal Used by Global_Layer\Linker when reading raw layer/content chunks.
	 *
	 * @param string $data
	 * @return mixed
	 */
	public function decode_stored_json( $data ) {
		$decoded_data = json_decode( $data, true );

		if ( JSON_ERROR_NONE !== json_last_error() ) {
			$decoded_data = json_decode( stripslashes( $data ), true );
		}

		return $decoded_data;
	}

	/**
	 * Encode a structured value for meta storage.
	 *
	 * Configurator data is stored as JSON rather than PHP-serialized arrays: serialized strings
	 * embed byte lengths, so any tool that rewrites the database (search-replace, a domain change,
	 * a migration) silently corrupts them, and reading them back runs user data through
	 * `maybe_unserialize()`. JSON has neither problem and stays readable in SQL.
	 *
	 * @param array $value
	 * @return string|null JSON, or null when the value cannot be stored as JSON.
	 */
	private function encode_for_storage( $value ) {
		if ( ! is_array( $value ) ) {
			return null;
		}

		// wp_json_encode() strips invalid UTF-8 rather than failing outright, so legacy latin-1
		// leftovers in a choice name do not make a product unsaveable.
		$json = wp_json_encode( $value, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE );
		if ( ! is_string( $json ) || '' === $json ) {
			return null;
		}

		// Refuse anything that does not read back as an array: the read path would treat it as
		// "no data", which is exactly the state we must never write.
		$decoded = json_decode( $json, true );
		if ( JSON_ERROR_NONE !== json_last_error() || ! is_array( $decoded ) ) {
			return null;
		}

		return $json;
	}

	/**
	 * Encode a whole set of meta writes before any of them is persisted.
	 *
	 * Chunked storage writes an index plus one meta per layer. Encoding up-front means a value that
	 * cannot be stored aborts the save while the stored data is still intact, instead of leaving an
	 * index that points at chunks which were never written.
	 *
	 * @param array<string, array> $values meta_key => structured value.
	 * @return array<string, mixed>|false Values ready for update_meta_data(), or false if any failed.
	 */
	private function encode_meta_batch( $values ) {
		$encoded = array();
		foreach ( $values as $meta_key => $value ) {
			if ( ! is_array( $value ) ) {
				return false;
			}
			if ( empty( $value ) ) {
				// Keep the historical semantics: WC_Data_Store_WP deletes the row for an empty array.
				$encoded[ $meta_key ] = array();
				continue;
			}
			$json = $this->encode_for_storage( $value );
			if ( null === $json ) {
				return false;
			}
			// update_metadata() runs wp_unslash() on the value, which would strip the JSON's own
			// escapes and leave unparseable text in the row. Pre-slash so it survives that.
			$encoded[ $meta_key ] = wp_slash( $json );
		}
		return $encoded;
	}

	/**
	 * Encode and write one structured meta value.
	 *
	 * @internal Used by Global_Layer\Linker when reconciling or localizing references.
	 *
	 * @param \WC_Product|\MKL\PC\Global_Configurators\Storage_Owner $product
	 * @param string $meta_key
	 * @param array  $value
	 * @return bool False when the value could not be encoded; nothing is written in that case.
	 */
	public function write_structured_meta( $product, $meta_key, $value ) {
		$encoded = $this->encode_meta_batch( array( $meta_key => $value ) );
		if ( false === $encoded ) {
			return false;
		}
		$product->update_meta_data( $meta_key, $encoded[ $meta_key ] );
		return true;
	}

	/**
	 * Resolve the effective storage owner id for a selling context, honoring global links.
	 *
	 * @param int    $product_id
	 * @param int    $variation_id
	 * @param string $component
	 * @return int
	 */
	private function resolve_storage_owner_id( $product_id, $variation_id = 0, $component = '' ) {
		if ( class_exists( Global_Configurator_Owner_Resolver::class ) ) {
			return Global_Configurator_Owner_Resolver::resolve_storage_owner_id( (int) $product_id, (int) $variation_id, $component );
		}
		return (int) $product_id;
	}

	/**
	 * After layers/content AJAX saves, force the next integrity pass (parent product).
	 *
	 * @param int    $id
	 * @param int    $ref_id
	 * @param string $component
	 * @return void
	 */
	public function invalidate_integrity_cache_on_configuration_save( $id, $ref_id, $component ) {
		if ( ! in_array( $component, array( 'layers', 'content' ), true ) ) {
			return;
		}
		$parent_id = (int) $ref_id;
		if ( $parent_id > 0 ) {
			$this->set_integrity_cache_value( $parent_id, 0 );
		}
	}

	/**
	 * @param int $parent_id
	 * @param int $value      1 = ok cache, 0 = invalidate / recompute.
	 * @return void
	 */
	private function set_integrity_cache_value( $parent_id, $value ) {
		$parent = $this->get_owner( (int) $parent_id );
		if ( ! $parent ) {
			return;
		}
		$parent->update_meta_data( self::META_INTEGRITY_CACHE, (int) $value );
		$parent->save();
		do_action( 'wpml_sync_custom_field', (int) $parent_id, self::META_INTEGRITY_CACHE );
	}

	/**
	 * @param \WC_Product|\MKL\PC\Global_Configurators\Storage_Owner $product
	 * @return array<int, array<string, mixed>>|array{}
	 */
	private function get_legacy_layers_blob_array( $product ) {
		if ( ! $product ) {
			return array();
		}
		$data = $product->get_meta( '_mkl_product_configurator_layers', true );
		if ( '' === $data || false === $data ) {
			return array();
		}
		$data = maybe_unserialize( $data );
		if ( is_string( $data ) ) {
			$data = $this->decode_stored_json( $data );
		}
		return is_array( $data ) ? $data : array();
	}

	/**
	 * @param \WC_Product|\MKL\PC\Global_Configurators\Storage_Owner $product
	 * @return array<int, array<string, mixed>>|array{}
	 */
	private function get_legacy_content_blob_array( $product ) {
		if ( ! $product ) {
			return array();
		}
		$data = $product->get_meta( '_mkl_product_configurator_content', true );
		if ( '' === $data || false === $data ) {
			return array();
		}
		$data = maybe_unserialize( $data );
		if ( is_string( $data ) ) {
			$data = $this->decode_stored_json( $data );
		}
		return is_array( $data ) ? $data : array();
	}

	/**
	 * @param array $legacy_layers
	 * @param int   $layer_id
	 * @return bool
	 */
	private function layer_id_exists_in_legacy_layers_array( $legacy_layers, $layer_id ) {
		foreach ( $legacy_layers as $row ) {
			if ( is_array( $row ) && isset( $row['_id'] ) && (int) $row['_id'] === (int) $layer_id ) {
				return true;
			}
		}
		return false;
	}

	/**
	 * Quick status labels when integrity cache says OK (avoid re-reading all chunks).
	 *
	 * @param int $parent_id
	 * @param int $variation_id
	 * @return array{layers_status:string,content_status:string}
	 */
	private function classify_storage_statuses_for_cache_hit( $parent_id, $variation_id ) {
		$owner_parent_id = $this->resolve_storage_owner_id( $parent_id, 0, 'layers' );
		$parent          = $this->get_owner( $owner_parent_id );
		if ( ! $parent ) {
			return array(
				'layers_status'  => 'empty',
				'content_status' => 'empty',
			);
		}
		$has_legacy_l = $this->legacy_layers_blob_is_non_empty( $parent );
		$layers_chunk = false !== $this->get_layers_chunked( $owner_parent_id, $parent );
		$layers_st    = 'empty';
		if ( $has_legacy_l && ! $layers_chunk ) {
			$layers_st = 'legacy';
		} elseif ( $has_legacy_l && $layers_chunk ) {
			$layers_st = 'mixed';
		} elseif ( $layers_chunk ) {
			$layers_st = 'chunked';
		}

		$content_pid = $this->get_product_id_for_content( $parent_id, $variation_id );
		$content_owner_pid = $this->resolve_storage_owner_id( $content_pid, $variation_id, 'content' );
		$content_p   = $this->get_owner( $content_owner_pid );
		$content_st  = 'empty';
		if ( $content_p ) {
			$has_legacy_c = $this->legacy_content_blob_is_non_empty( $content_p );
			$content_ch   = false !== $this->get_content_chunked( $content_owner_pid, $content_p );
			if ( $has_legacy_c && ! $content_ch ) {
				$content_st = 'legacy';
			} elseif ( $has_legacy_c && $content_ch ) {
				$content_st = 'mixed';
			} elseif ( $content_ch ) {
				$content_st = 'chunked';
			}
		}
		return array(
			'layers_status'  => $layers_st,
			'content_status' => $content_st,
		);
	}

	/**
	 * Get the content data
	 *
	 * @param integer $post_id
	 * @return array
	 */
	public function get_content( $post_id ) {
		return apply_filters( 'mkl_product_configurator_content_data', array( 'content' => $this->get( 'content', $post_id ) ), $post_id ); 
	}

	/**
	 * Get the angles
	 *
	 * @param integer $post_id
	 * @return array
	 */
	public function get_angles( $post_id ) {
		return array( 'angles' => $this->get( 'angles', $post_id ) ); 
	}

	/**
	 * Get the layers index (ordered layer IDs) for chunked storage.
	 * Returns array of layer IDs, or false if using legacy storage.
	 *
	 * @param int $product_id
	 * @return array|false
	 */
	private function get_layers_index( $product_id ) {
		$cache_key = 'mkl_pc_layers_index_' . $product_id;
		$cached = wp_cache_get( $cache_key, 'mkl_pc' );
		if ( false !== $cached ) {
			return $cached;
		}
		$product = $this->get_owner( $product_id );
		if ( ! $product ) {
			return false;
		}
		$index = $product->get_meta( '_mkl_product_configurator_layers_index' );
		$index = maybe_unserialize( $index );
		if ( is_string( $index ) ) {
			$index = $this->decode_stored_json( $index );
		}
		if ( is_array( $index ) && ! empty( $index ) ) {
			wp_cache_set( $cache_key, $index, 'mkl_pc', 3600 );
			return $index;
		}
		wp_cache_set( $cache_key, false, 'mkl_pc', 3600 );
		return false;
	}

	/**
	 * Getter
	 *
	 * @param string  $that
	 * @param integer $product_id
	 * @return boolean|array
	 */
	public function get( $that, $product_id ) {

		if ( ! is_string( $that ) ) return false;

		// A global layer post has no configurator meta of its own: it stores one layer and its
		// choices, which are projected into the editor's shapes here.
		if ( Global_Layers::is_global_layer_id( $product_id ) ) {
			switch ( $that ) {
				case 'layers':
					$init = Global_Layer_Linker::init_data_for_editor( (int) $product_id );
					return isset( $init['layers'] ) ? $init['layers'] : false;
				case 'content':
					$content = Global_Layer_Linker::content_for_editor( (int) $product_id );
					return empty( $content ) ? false : $content;
				case 'angles':
					return Global_Layers::get_angles( (int) $product_id );
			}
			return false;
		}

		$owner_id = $this->resolve_storage_owner_id( $product_id, 0, $that );
		if ( $owner_id <= 0 ) {
			$owner_id = (int) $product_id;
		}

		$cache_key = "mkl_pc_data_{$that}_{$owner_id}";
		$cached = wp_cache_get( $cache_key, 'mkl_pc' );
		if ( false !== $cached ) {
			return $cached;
		}
		if ( ! $this->is_product( $owner_id ) ) return false;

		$product = $this->get_owner( $owner_id );

		if ( ! $product ) return false;

		if ( 'layers' === $that ) {
			$data = $this->get_layers_chunked( $owner_id, $product );
			if ( false === $data ) {
				$data = $this->get_legacy_meta( $product, '_mkl_product_configurator_layers' );
			}
		} elseif ( 'content' === $that ) {
			$data = $this->get_content_chunked( $owner_id, $product );
			if ( false === $data ) {
				$data = $this->get_legacy_meta( $product, '_mkl_product_configurator_content' );
			}
		} else {
			$data = $this->get_legacy_meta( $product, '_mkl_product_configurator_' . $that );
		}

		if ( '' == $data || false == $data ) {
			return false; 
		} else {
			/**
			 * Filters the data fetched using the Get method
			 * 
			 * @param $data       - The data filtered
			 * @param $that       - The slug of the meta data fetched - e.g 'content', 'angles', 'layers'...
			 * @param $product_id - The product ID
			 */
			$data = apply_filters( 'mkl_pc/db/get', $data, $that, $product_id );

			// Resolve global references for layers and content.
			if ( 'layers' === $that && is_array( $data ) ) {
				$data = Global_Layer_Linker::resolve_layers( $data, $owner_id );
			}
			if ( 'content' === $that && is_array( $data ) ) {
				$data = Global_Layer_Linker::resolve_content( $data, $owner_id );
			}
			wp_cache_set( $cache_key, $data, 'mkl_pc', 3600 );
			return $data;
		}
	}

	/**
	 * Read and decode a single legacy-style meta value.
	 *
	 * @param \WC_Product $product
	 * @param string      $meta_key
	 * @return array|false
	 */
	private function get_legacy_meta( $product, $meta_key ) {
		$data = $product->get_meta( $meta_key );
		$data = maybe_unserialize( $data );
		if ( is_string( $data ) ) {
			$data = $this->decode_stored_json( $data );
		}
		return ( '' !== $data && false !== $data && is_array( $data ) ) ? $data : false;
	}

	/**
	 * Get layers from chunked storage (layer_1, layer_2, ...).
	 *
	 * @param int         $product_id
	 * @param \WC_Product $product
	 * @return array|false
	 */
	private function get_layers_chunked( $product_id, $product ) {
		$index = $product->get_meta( '_mkl_product_configurator_layers_index' );
		$index = maybe_unserialize( $index );
		if ( is_string( $index ) ) {
			$index = $this->decode_stored_json( $index );
		}
		if ( ! is_array( $index ) || empty( $index ) ) {
			return false;
		}
		$layers = array();
		foreach ( $index as $layer_id ) {
			$chunk = $product->get_meta( '_mkl_product_configurator_layer_' . $layer_id );
			$chunk = maybe_unserialize( $chunk );
			if ( is_string( $chunk ) ) {
				$chunk = $this->decode_stored_json( $chunk );
			}
			if ( empty( $chunk ) || ! is_array( $chunk ) ) {
				return false;
			}
			$layers[] = $chunk;
		}
		return $layers;
	}

	/**
	 * Get content from chunked storage (content_1, content_2, ...).
	 *
	 * @param int         $product_id
	 * @param \WC_Product $product
	 * @return array|false
	 */
	private function get_content_chunked( $product_id, $product ) {
		$index = $product->get_meta( '_mkl_product_configurator_layers_index' );
		$index = maybe_unserialize( $index );
		if ( is_string( $index ) ) {
			$index = $this->decode_stored_json( $index );
		}
		if ( ! is_array( $index ) || empty( $index ) ) {
			// The index describes the layer structure, and it is only ever written where that
			// structure lives. A variable product keeps its choices per variation and its layers on
			// the parent, so a variation has content chunks and no index of its own - reading it
			// against its own post found nothing and fell through to a legacy blob that the chunked
			// writer had already deleted.
			$index = $this->read_layers_index_array( $this->get_layers_owner_for( $product_id ) );
			if ( empty( $index ) ) {
				return false;
			}
		}
		$content = array();
		foreach ( $index as $layer_id ) {
			$chunk = $product->get_meta( '_mkl_product_configurator_content_' . $layer_id );
			$chunk = maybe_unserialize( $chunk );
			if ( is_string( $chunk ) ) {
				$chunk = $this->decode_stored_json( $chunk );
			}
			if ( ! is_array( $chunk ) ) {
				$chunk = array( 'layerId' => (int) $layer_id, 'choices' => array() );
			}
			if ( ! isset( $chunk['layerId'] ) ) {
				$chunk['layerId'] = (int) $layer_id;
			}
			$content[] = $chunk;
		}
		return $content;
	}

	public function get_indexed( $type, $key, $product_id ) {
		static $cache = [];

		$cache_key = "{$type}_{$key}_{$product_id}";

		if ( isset( $cache[ $cache_key ] ) ) {
			return $cache[ $cache_key ];
		}

		$data = $this->get( $type, $product_id );

		$indexed = [];

		if ( is_array( $data ) ) {
			foreach ( $data as $item ) {
				if ( isset( $item[ $key ] ) ) {
					$indexed[ $item[ $key ] ] = $item;
				}
			}
		}

		$cache[ $cache_key ] = $indexed;

		return $indexed;
	}

	/**
	 * Post meta: verified chunked storage (index + per-layer metas; legacy blobs removed).
	 */
	const STORAGE_FORMAT_CHUNKED_VERIFIED = 2;

	/**
	 * Post meta key on the parent configurable product.
	 */
	const META_STORAGE_FORMAT_VERSION = '_mkl_product_configurator_storage_format_version';

	/**
	 * Post meta on parent: 1 = last integrity check passed (skip deep verify until invalidated); 0 / missing / negative = recompute.
	 */
	const META_INTEGRITY_CACHE = '_mkl_product_configurator_integrity_cache';

	/**
	 * Post meta on parent: set once the one-time serialized -> JSON sweep has run over this
	 * configurator's chunk metas. Absent means "not swept yet", not "definitely serialized".
	 *
	 * Reads accept both encodings and every write produces JSON, so this is only an accelerator: it
	 * stops finalize from re-scanning the chunks, and marks which products have been converted.
	 * Component metas that live on a variation rather than the parent convert on their next save.
	 */
	const META_STORAGE_ENCODING = '_mkl_product_configurator_storage_encoding';

	/**
	 * Value of {@see self::META_STORAGE_ENCODING} once every chunk is stored as JSON.
	 */
	const STORAGE_ENCODING_JSON = 'json';

	/**
	 * @param \WC_Product|\MKL\PC\Global_Configurators\Storage_Owner|null $product
	 * @return bool
	 */
	private function storage_encoding_is_json( $product ) {
		if ( ! $product ) {
			return false;
		}
		return self::STORAGE_ENCODING_JSON === $product->get_meta( self::META_STORAGE_ENCODING, true );
	}

	/**
	 * Rewrite any PHP-serialized chunk meta as JSON, once per product.
	 *
	 * A serialized row comes back from get_meta() as an array (WP unserializes on read); a JSON row
	 * comes back as a string. That is the same distinction the read path already makes, so it is
	 * enough to tell converted rows from unconverted ones.
	 *
	 * @param \WC_Product|\MKL\PC\Global_Configurators\Storage_Owner      $parent
	 * @param \WC_Product|\MKL\PC\Global_Configurators\Storage_Owner|null $content_product
	 * @param int[] $index Layer ids.
	 * @return bool True when the product is fully JSON afterwards.
	 */
	private function maybe_convert_storage_to_json( $parent, $content_product, $index ) {
		if ( ! $parent || $this->storage_encoding_is_json( $parent ) ) {
			return true;
		}

		$targets = array(
			array( $parent, '_mkl_product_configurator_layers_index' ),
			array( $parent, '_mkl_product_configurator_angles' ),
			array( $parent, '_mkl_product_configurator_conditions' ),
		);
		$content_owner = $content_product ? $content_product : $parent;
		foreach ( $index as $layer_id ) {
			$layer_id = (int) $layer_id;
			if ( ! $layer_id ) {
				continue;
			}
			$targets[] = array( $parent, '_mkl_product_configurator_layer_' . $layer_id );
			$targets[] = array( $content_owner, '_mkl_product_configurator_content_' . $layer_id );
		}

		$dirty_owners = array();
		foreach ( $targets as $target ) {
			list( $owner, $meta_key ) = $target;
			$raw = maybe_unserialize( $owner->get_meta( $meta_key, true ) );
			// Strings are already JSON; anything not a non-empty array has nothing to rewrite.
			if ( ! is_array( $raw ) || empty( $raw ) ) {
				continue;
			}
			if ( ! $this->write_structured_meta( $owner, $meta_key, $raw ) ) {
				// Leave the serialized row in place: it still reads correctly.
				return false;
			}
			$dirty_owners[ spl_object_hash( $owner ) ] = $owner;
			do_action( 'wpml_sync_custom_field', $owner->get_id(), $meta_key );
		}
		foreach ( $dirty_owners as $owner ) {
			$owner->save();
		}

		$parent->update_meta_data( self::META_STORAGE_ENCODING, self::STORAGE_ENCODING_JSON );
		$parent->save();
		do_action( 'wpml_sync_custom_field', $parent->get_id(), self::META_STORAGE_ENCODING );

		return true;
	}

	/**
	 * Read layers index array from a product meta (no cache).
	 *
	 * @internal Used by Global_Layer\Linker when localizing a global layer onto an owner.
	 *
	 * @param \WC_Product|\MKL\PC\Global_Configurators\Storage_Owner $product
	 * @return int[]
	 */
	public function read_layers_index_array( $product ) {
		if ( ! $product ) {
			return array();
		}
		$index = $product->get_meta( '_mkl_product_configurator_layers_index', true );
		$index = maybe_unserialize( $index );
		if ( is_string( $index ) ) {
			$index = $this->decode_stored_json( $index );
		}
		if ( ! is_array( $index ) ) {
			return array();
		}
		$out = array();
		foreach ( $index as $layer_id ) {
			$out[] = (int) $layer_id;
		}
		return $out;
	}

	/**
	 * Whether legacy layers blob meta holds a non-empty array.
	 *
	 * @param \WC_Product|\MKL\PC\Global_Configurators\Storage_Owner $product
	 * @return bool
	 */
	private function legacy_layers_blob_is_non_empty( $product ) {
		if ( ! $product ) {
			return false;
		}
		$data = $product->get_meta( '_mkl_product_configurator_layers', true );
		if ( '' === $data || false === $data ) {
			return false;
		}
		$data = maybe_unserialize( $data );
		if ( is_string( $data ) ) {
			$data = $this->decode_stored_json( $data );
		}
		return is_array( $data ) && count( $data ) > 0;
	}

	/**
	 * Whether legacy content blob meta holds a non-empty array.
	 *
	 * @param \WC_Product|\MKL\PC\Global_Configurators\Storage_Owner $product
	 * @return bool
	 */
	private function legacy_content_blob_is_non_empty( $product ) {
		if ( ! $product ) {
			return false;
		}
		$data = $product->get_meta( '_mkl_product_configurator_content', true );
		if ( '' === $data || false === $data ) {
			return false;
		}
		$data = maybe_unserialize( $data );
		if ( is_string( $data ) ) {
			$data = $this->decode_stored_json( $data );
		}
		return is_array( $data ) && count( $data ) > 0;
	}

	/**
	 * List orphan per-layer meta keys (numeric suffix not in index) for a product.
	 *
	 * @param int   $post_id
	 * @param int[] $index_ids
	 * @param string $prefix e.g. _mkl_product_configurator_layer_
	 * @return string[]
	 */
	private function find_orphan_chunk_meta_keys( $post_id, $index_ids, $prefix ) {
		global $wpdb;
		$post_id = (int) $post_id;
		if ( $post_id < 1 ) {
			return array();
		}
		$allowed = array_flip( array_map( 'intval', $index_ids ) );
		$like    = $wpdb->esc_like( $prefix ) . '%';
		$keys    = $wpdb->get_col(
			$wpdb->prepare(
				"SELECT meta_key FROM {$wpdb->postmeta} WHERE post_id = %d AND meta_key LIKE %s",
				$post_id,
				$like
			)
		); // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- One-off orphan-chunk scan; result is not reused.
		if ( ! is_array( $keys ) ) {
			return array();
		}
		$orphans = array();
		$pattern = '/^' . preg_quote( $prefix, '/' ) . '(\d+)$/';
		foreach ( $keys as $meta_key ) {
			if ( preg_match( $pattern, $meta_key, $m ) ) {
				$lid = (int) $m[1];
				if ( $lid && ! isset( $allowed[ $lid ] ) ) {
					$orphans[] = $meta_key;
				}
			}
		}
		return $orphans;
	}

	/**
	 * Delete per-layer or per-content chunk metas whose numeric suffix is not in $keep_ids.
	 *
	 * Scans actual post meta (not only the previous layers index) so leftover chunks from
	 * layers deleted in an earlier session are removed. Those orphans otherwise fail mixed-storage
	 * integrity and block storage_format_version from being stamped.
	 *
	 * @param \WC_Product|\MKL\PC\Global_Configurators\Storage_Owner $product
	 * @param int[] $keep_ids
	 * @param string $prefix e.g. _mkl_product_configurator_layer_
	 * @return string[] Deleted meta keys.
	 */
	private function delete_orphan_chunk_metas( $product, $keep_ids, $prefix ) {
		if ( ! $product ) {
			return array();
		}
		$orphans = $this->find_orphan_chunk_meta_keys( $product->get_id(), $keep_ids, $prefix );
		if ( empty( $orphans ) ) {
			return array();
		}
		foreach ( $orphans as $meta_key ) {
			$product->delete_meta_data( $meta_key );
		}
		$product->save();
		return $orphans;
	}

	/**
	 * The storage owner holding the layer structure that a given post's content belongs to.
	 *
	 * @internal Used by Global_Layer\Linker when reconciling content against the layer structure.
	 *
	 * @param int $post_id Content owner id (product, variation, or global configurator CPT).
	 * @return \WC_Product|\MKL\PC\Global_Configurators\Storage_Owner|null
	 */
	public function get_layers_owner_for( $post_id ) {
		$layers_owner_id = $this->resolve_storage_owner_id( (int) $post_id, 0, 'layers' );
		if ( $layers_owner_id <= 0 || $layers_owner_id === (int) $post_id ) {
			return null;
		}
		return $this->get_owner( $layers_owner_id );
	}

	/**
	 * Every post that can hold content chunks belonging to one layer structure.
	 *
	 * Layers and content do not always live on the same post: a variable product in
	 * `share_layers_config` mode keeps one layer structure on the parent and a separate set of
	 * choices per variation. Anything that acts on the layer structure as a whole - purging chunks
	 * for layers that no longer exist, reconciling global layer links - has to visit all of them,
	 * or the variations quietly keep data for a structure that has moved on.
	 *
	 * The parent stays in the list even in per-variation mode: it can still hold content chunks
	 * from before the mode was switched.
	 *
	 * @internal Used by Global_Layer\Linker when reconciling every content owner of a structure.
	 *
	 * @param int $layers_owner_id Post holding the layer structure.
	 * @return int[]
	 */
	public function get_content_owner_ids( $layers_owner_id ) {
		$layers_owner_id = (int) $layers_owner_id;
		if ( $layers_owner_id <= 0 ) {
			return array();
		}

		// A global configurator CPT owns both halves itself.
		if ( class_exists( Global_Configurator_Schema::class ) && Global_Configurator_Schema::is_global_configurator_id( $layers_owner_id ) ) {
			return array( $layers_owner_id );
		}

		$product = function_exists( 'wc_get_product' ) ? wc_get_product( $layers_owner_id ) : null;
		if ( ! $product || ! is_a( $product, 'WC_Product' ) || 'variable' !== $product->get_type() ) {
			return array( $layers_owner_id );
		}

		$mode = $product->get_meta( MKL_PC_PREFIX . '_variable_configuration_mode', true );
		if ( $mode && 'share_layers_config' !== $mode ) {
			// share_all_config: one set of choices, on the parent.
			return array( $layers_owner_id );
		}

		$ids = array( $layers_owner_id );
		foreach ( $product->get_children() as $child_id ) {
			$child_id = (int) $child_id;
			if ( $child_id > 0 ) $ids[] = $child_id;
		}

		/**
		 * Filter the posts that hold content chunks for a layer structure.
		 *
		 * @param int[] $ids
		 * @param int   $layers_owner_id
		 */
		return apply_filters( 'mkl_pc_content_owner_ids', array_values( array_unique( $ids ) ), $layers_owner_id );
	}

	/**
	 * Drop chunks for layers that no longer exist, across every post holding part of the structure.
	 *
	 * Only orphans go: a chunk whose layer id is still in the index is left exactly as it is, on
	 * every variation. Variations legitimately hold different choices for the same layer - the same
	 * configuration is often imported into several of them as a starting point - so the index says
	 * which layers exist, never which variation is allowed to have content for one.
	 *
	 * @param \WC_Product|\MKL\PC\Global_Configurators\Storage_Owner $layers_product Layer structure owner.
	 * @param int $owner_id  Layer structure owner id.
	 * @param array $keep_ids Current layers index.
	 * @return void
	 */
	private function purge_orphan_chunks_for_structure( $layers_product, $owner_id, $keep_ids ) {
		$this->delete_orphan_chunk_metas( $layers_product, $keep_ids, '_mkl_product_configurator_layer_' );

		foreach ( $this->get_content_owner_ids( $owner_id ) as $content_owner_id ) {
			$content_product = ( (int) $content_owner_id === (int) $owner_id ) ? $layers_product : $this->get_owner( $content_owner_id );
			if ( ! $content_product ) continue;
			$removed = $this->delete_orphan_chunk_metas( $content_product, $keep_ids, '_mkl_product_configurator_content_' );
			if ( ! empty( $removed ) ) {
				$this->invalidate_layers_cache( (int) $content_owner_id );
			}
		}
	}

	/**
	 * Full integrity check for chunked layers + content storage (parent + content product).
	 *
	 * Uses {@see self::META_INTEGRITY_CACHE}: when 1 and $force_refresh is false, returns a cached OK result with fresh status labels.
	 * When no legacy blobs exist on parent (layers) and content product, integrity is considered OK without requiring every optional content chunk.
	 * When legacy exists, the test is conservation: every legacy content row that carried choices must have a matching chunk. Layers with no
	 * legacy content row (unfinished setup, summaries, static elements) are not treated as missing data, whatever their type.
	 *
	 * @param int  $parent_id      Product ID where layer structure + layer chunks live (variable parent or simple).
	 * @param int  $variation_id   Variation ID when editing a variation (0 otherwise).
	 * @param bool $force_refresh  Bypass positive integrity cache (e.g. after finalize).
	 * @return array{
	 *   ok: bool,
	 *   layers_ok: bool,
	 *   content_ok: bool,
	 *   layers_status: string,
	 *   content_status: string,
	 *   issues: string[]
	 * }
	 */
	public function verify_chunked_storage_integrity( $parent_id, $variation_id = 0, $force_refresh = false ) {
		$parent_id    = (int) $parent_id;
		$variation_id = (int) $variation_id;
		$issues       = array();
		$owner_parent_id = $this->resolve_storage_owner_id( $parent_id, 0, 'layers' );
		$parent          = $this->get_owner( $owner_parent_id );
		if ( ! $parent ) {
			return array(
				'ok'             => false,
				'layers_ok'      => false,
				'content_ok'     => false,
				'layers_status'  => 'empty',
				'content_status' => 'empty',
				'issues'         => array( 'invalid_parent_product' ),
			);
		}

		$integrity_cache = (int) $parent->get_meta( self::META_INTEGRITY_CACHE, true );
		if ( ! $force_refresh && $integrity_cache >= 1 ) {
			$statuses = $this->classify_storage_statuses_for_cache_hit( $parent_id, $variation_id );
			$cached   = array(
				'ok'             => true,
				'layers_ok'      => true,
				'content_ok'     => true,
				'layers_status'  => $statuses['layers_status'],
				'content_status' => $statuses['content_status'],
				'issues'         => array(),
			);
			return apply_filters( 'mkl_pc_verify_chunked_storage_integrity', $cached, $parent_id, $variation_id, $force_refresh );
		}

		$legacy_l_array = $this->get_legacy_layers_blob_array( $parent );
		$has_legacy_l   = count( $legacy_l_array ) > 0;

		$content_product_id = $this->get_product_id_for_content( $parent_id, $variation_id );
		$content_owner_id   = $this->resolve_storage_owner_id( $content_product_id, $variation_id, 'content' );
		$content_product    = $this->get_owner( $content_owner_id );
		$legacy_c_array     = $content_product
			? $this->get_legacy_content_blob_array( $content_product )
			: array();
		$has_legacy_c       = count( $legacy_c_array ) > 0;

		if ( ! $content_product ) {
			$issues[] = 'invalid_content_product';
		}

		$parent_index        = $this->read_layers_index_array( $parent );
		$layers_chunked_data = $this->get_layers_chunked( $owner_parent_id, $parent );

		$layers_ok     = true;
		$layers_status = 'empty';
		if ( ! $has_legacy_l ) {
			$layers_ok = true;
			if ( false !== $layers_chunked_data ) {
				$layers_status = 'chunked';
			} elseif ( ! empty( $parent_index ) ) {
				$layers_status = 'chunked';
			} else {
				$layers_status = 'empty';
			}
		} elseif ( empty( $parent_index ) && false === $layers_chunked_data ) {
			$layers_status = 'legacy';
			$layers_ok     = false;
			$issues[]      = 'legacy_layers_blob_present';
		} else {
			$layers_status = ( false !== $layers_chunked_data && ! empty( $parent_index ) ) ? 'mixed' : 'legacy';
			foreach ( $parent_index as $layer_id ) {
				$raw = $parent->get_meta( '_mkl_product_configurator_layer_' . $layer_id, true );
				$raw = maybe_unserialize( $raw );
				if ( is_string( $raw ) ) {
					$raw = $this->decode_stored_json( $raw );
				}
				$chunk_ok = is_array( $raw ) && isset( $raw['_id'] ) && (int) $raw['_id'] === (int) $layer_id;
				if ( ! $chunk_ok && ! $this->layer_id_exists_in_legacy_layers_array( $legacy_l_array, $layer_id ) ) {
					$layers_ok = false;
					$issues[]  = 'invalid_layer_chunk:' . (int) $layer_id;
				}
			}
			if ( $layers_ok && false !== $layers_chunked_data ) {
				$orphans = $this->find_orphan_chunk_meta_keys( $owner_parent_id, $parent_index, '_mkl_product_configurator_layer_' );
				if ( count( $orphans ) > 0 ) {
					$layers_ok = false;
					$issues[]  = 'orphan_layer_chunk_metas:' . implode( ',', array_slice( $orphans, 0, 20 ) );
				}
			}
		}

		$content_ok     = true;
		$content_status = 'empty';
		if ( ! $content_product ) {
			$content_ok = false;
			$issues[]   = 'missing_content_product';
		} else {
			$content_index  = $this->read_layers_index_array( $content_product );
			$content_data   = $this->get_content_chunked( $content_owner_id, $content_product );
			$index_mismatch = false;
			if ( $content_product_id !== $parent_id ) {
				$parent_sorted  = $parent_index;
				$content_sorted = $content_index;
				sort( $parent_sorted );
				sort( $content_sorted );
				if ( $parent_sorted !== $content_sorted && ( count( $parent_sorted ) || count( $content_sorted ) ) ) {
					$index_mismatch   = true;
					$content_ok       = false;
					$issues[]         = 'content_layers_index_mismatch_parent';
					$content_status   = 'mixed';
				}
			}

			if ( ! $index_mismatch ) {
				if ( ! $has_legacy_c ) {
					$content_ok = true;
					if ( false !== $content_data ) {
						$content_status = 'chunked';
					} elseif ( ! empty( $content_index ) ) {
						$content_status = 'chunked';
					} else {
						$content_status = 'empty';
					}
					foreach ( $content_index as $layer_id ) {
						$raw = $content_product->get_meta( '_mkl_product_configurator_content_' . $layer_id, true );
						$raw = maybe_unserialize( $raw );
						if ( is_string( $raw ) ) {
							$raw = $this->decode_stored_json( $raw );
						}
						if ( is_array( $raw ) ) {
							if ( ! isset( $raw['layerId'] ) || (int) $raw['layerId'] !== (int) $layer_id ) {
								$content_ok = false;
								$issues[]   = 'content_layerId_mismatch:' . (int) $layer_id;
							}
						}
					}
				} elseif ( false === $content_data && empty( $content_index ) ) {
					$content_status = 'legacy';
					$content_ok     = false;
					$issues[]       = 'legacy_content_blob_present';
				} else {
					$content_status = ( false !== $content_data && ! empty( $content_index ) ) ? 'mixed' : 'legacy';
					// Conservation, not validation: the only thing a migration can get wrong is losing a
					// content row that existed in the legacy blob. Whether a layer *ought* to have content
					// is not derivable from its type -- `not_a_choice` layers keep their static image in a
					// one-choice row, and a layer retyped to `group` keeps the choices it already had -- so
					// the layer definition is not consulted at all here.
					//
					// A layer with no legacy content row is not missing data: it is an unfinished layer, a
					// summary, or a static element. The frontend skips it, and get_content_chunked() already
					// reads it back as an empty { layerId, choices: [] } row.
					$indexed_layer_ids = array_map( 'intval', $content_index );
					foreach ( $legacy_c_array as $legacy_row ) {
						if ( ! is_array( $legacy_row ) || ! isset( $legacy_row['layerId'] ) ) {
							continue;
						}
						$layer_id = (int) $legacy_row['layerId'];
						if ( empty( $legacy_row['choices'] ) ) {
							continue; // Nothing to lose.
						}
						if ( ! in_array( $layer_id, $indexed_layer_ids, true ) ) {
							continue; // Layer deleted since; its content is legitimately gone.
						}
						$raw = $content_product->get_meta( '_mkl_product_configurator_content_' . $layer_id, true );
						$raw = maybe_unserialize( $raw );
						if ( is_string( $raw ) ) {
							$raw = $this->decode_stored_json( $raw );
						}
						if ( is_array( $raw ) && isset( $raw['layerId'] ) && (int) $raw['layerId'] === $layer_id ) {
							continue;
						}
						$content_ok = false;
						$issues[]   = 'invalid_content_chunk:' . $layer_id;
					}
					if ( $content_ok && false !== $content_data ) {
						$orphans_c = $this->find_orphan_chunk_meta_keys( $content_owner_id, $content_index, '_mkl_product_configurator_content_' );
						if ( count( $orphans_c ) > 0 ) {
							$content_ok = false;
							$issues[]   = 'orphan_content_chunk_metas:' . implode( ',', array_slice( $orphans_c, 0, 20 ) );
						}
					}
				}
			}
		}

		$empty_both = ( 'empty' === $layers_status && 'empty' === $content_status );
		$ok         = ( $layers_ok && $content_ok ) || $empty_both;

		$result = array(
			'ok'             => $ok,
			'layers_ok'      => $layers_ok,
			'content_ok'     => $content_ok,
			'layers_status'  => $layers_status,
			'content_status' => $content_status,
			'issues'         => $issues,
		);

		$this->set_integrity_cache_value( $parent_id, $ok ? 1 : 0 );

		return apply_filters( 'mkl_pc_verify_chunked_storage_integrity', $result, $parent_id, $variation_id, $force_refresh );
	}

	/**
	 * If integrity passes, set storage format version on parent and clear caches. Legacy blobs are not removed here.
	 *
	 * @param int $parent_id
	 * @param int $variation_id
	 * @return array Snapshot for admin (includes verify result + version).
	 */
	public function maybe_finalize_chunked_storage( $parent_id, $variation_id = 0 ) {
		$parent_id       = (int) $parent_id;
		$variation_id    = (int) $variation_id;
		$owner_parent_id = $this->resolve_storage_owner_id( $parent_id, 0, 'layers' );
		$parent          = $this->get_owner( $owner_parent_id );
		if ( ! $parent ) {
			return array(
				'ok'                     => false,
				'layers_ok'              => false,
				'content_ok'             => false,
				'layers_status'          => 'empty',
				'content_status'         => 'empty',
				'issues'                 => array( 'missing_parent_product' ),
				'storage_format_version' => 0,
				'snapshot'               => $this->get_pc_storage_state_for_editor( $parent_id, $variation_id, false ),
			);
		}

		$current_version  = (int) $parent->get_meta( self::META_STORAGE_FORMAT_VERSION, true );
		$integrity_cached = (int) $parent->get_meta( self::META_INTEGRITY_CACHE, true );

		$content_product_id = $this->get_product_id_for_content( $parent_id, $variation_id );
		$content_owner_id   = $this->resolve_storage_owner_id( $content_product_id, $variation_id, 'content' );
		$content_product    = ( $content_owner_id && $content_owner_id !== $owner_parent_id )
			? $this->get_owner( $content_owner_id )
			: $parent;
		$parent_index = $this->read_layers_index_array( $parent );
		// Finalize is the one-time "tidy this product" pass, so it sweeps the whole structure
		// rather than just the variation on screen - that is where orphans from past deletions sit.
		$this->purge_orphan_chunks_for_structure( $parent, $owner_parent_id, $parent_index );

		// One-time rewrite of PHP-serialized chunks into JSON. Runs before the cached early return so
		// products that were already verified under the old encoding still get converted.
		$this->maybe_convert_storage_to_json( $parent, $content_product, $parent_index );

		if ( self::STORAGE_FORMAT_CHUNKED_VERIFIED === $current_version && $integrity_cached >= 1 && $this->storage_encoding_is_json( $parent ) ) {
			$verify = array(
				'ok'             => true,
				'layers_ok'      => true,
				'content_ok'     => true,
				'issues'         => array(),
				'storage_format_version' => $current_version,
				'snapshot'       => $this->get_pc_storage_state_for_editor( $parent_id, $variation_id, true ),
			);
			$statuses = $this->classify_storage_statuses_for_cache_hit( $parent_id, $variation_id );
			$verify['layers_status']  = $statuses['layers_status'];
			$verify['content_status'] = $statuses['content_status'];
			return $verify;
		}

		$verify = $this->verify_chunked_storage_integrity( $parent_id, $variation_id, true );

		if ( ! $verify['ok'] ) {
			if ( self::STORAGE_FORMAT_CHUNKED_VERIFIED === $current_version ) {
				$parent->delete_meta_data( self::META_STORAGE_FORMAT_VERSION );
				$parent->save();
			}
			$verify['storage_format_version'] = (int) $parent->get_meta( self::META_STORAGE_FORMAT_VERSION, true );
			$verify['snapshot']               = $this->get_pc_storage_state_for_editor( $parent_id, $variation_id, false );
			return $verify;
		}

		$parent->update_meta_data( self::META_STORAGE_FORMAT_VERSION, self::STORAGE_FORMAT_CHUNKED_VERIFIED );
		$parent->save();
		do_action( 'wpml_sync_custom_field', $owner_parent_id, self::META_STORAGE_FORMAT_VERSION );

		$this->invalidate_layers_cache( $owner_parent_id );
		wp_cache_delete( 'mkl_pc_data_layers_' . $owner_parent_id, 'mkl_pc' );
		wp_cache_delete( 'mkl_pc_data_content_' . $owner_parent_id, 'mkl_pc' );
		wp_cache_delete( 'mkl_pc_layers_index_' . $owner_parent_id, 'mkl_pc' );
		if ( $content_owner_id && $content_owner_id !== $owner_parent_id ) {
			$this->invalidate_layers_cache( $content_owner_id );
			wp_cache_delete( 'mkl_pc_data_content_' . $content_owner_id, 'mkl_pc' );
		}

		$verify['storage_format_version'] = self::STORAGE_FORMAT_CHUNKED_VERIFIED;
		$verify['snapshot']               = $this->get_pc_storage_state_for_editor( $parent_id, $variation_id, true );

		do_action( 'mkl_pc_chunked_storage_finalized', $parent_id, $variation_id, $verify );

		return $verify;
	}

	/**
	 * Build pc_storage payload for admin init / AJAX (layers + content classification + integrity + version).
	 *
	 * @param int  $parent_id
	 * @param int  $variation_id
	 * @param bool $skip_deep_verify If true, trust STORAGE_FORMAT_CHUNKED_VERIFIED + positive integrity cache (no full verify pass).
	 * @return array{layers:string,content:string,storage_format_version:int,integrity_ok:bool,integrity_issues:array,needs_batch_migration:bool,needs_format_finalize:bool,needs_migration_banner:bool}
	 */
	public function get_pc_storage_state_for_editor( $parent_id, $variation_id = 0, $skip_deep_verify = false ) {
		$parent_id       = (int) $parent_id;
		$variation_id    = (int) $variation_id;
		$owner_parent_id = $this->resolve_storage_owner_id( $parent_id, 0, 'layers' );
		$parent          = $this->get_owner( $owner_parent_id );
		$version         = $parent ? (int) $parent->get_meta( self::META_STORAGE_FORMAT_VERSION, true ) : 0;

		if ( $skip_deep_verify && self::STORAGE_FORMAT_CHUNKED_VERIFIED === $version && $parent && $this->storage_encoding_is_json( $parent ) ) {
			$integrity_cached = (int) $parent->get_meta( self::META_INTEGRITY_CACHE, true );
			if ( $integrity_cached >= 1 ) {
				$statuses = $this->classify_storage_statuses_for_cache_hit( $parent_id, $variation_id );
				return array(
					'layers'                    => $statuses['layers_status'],
					'content'                   => $statuses['content_status'],
					'storage_format_version'    => $version,
					'storage_encoding'          => self::STORAGE_ENCODING_JSON,
					'integrity_ok'              => true,
					'integrity_issues'          => array(),
					'needs_batch_migration'     => false,
					'needs_format_finalize'     => false,
					'needs_migration_banner'    => false,
				);
			}
		}

		$verify     = $this->verify_chunked_storage_integrity( $parent_id, $variation_id );
		$empty_both = ( 'empty' === $verify['layers_status'] && 'empty' === $verify['content_status'] );

		$needs_batch = false;
		if ( ! $empty_both ) {
			// Verified chunked storage may still report "mixed" while optional legacy blob metas exist
			// (editors delete those from the home tab). That is not an unfinished migration — avoid
			// forcing batch save + migration overlay on every save (see Admin\Data_Migration\Plugin notices).
			$verified_chunked_ok = ( self::STORAGE_FORMAT_CHUNKED_VERIFIED === $version && $verify['ok'] );
			if ( $verified_chunked_ok ) {
				$needs_batch = false;
			} elseif ( in_array( $verify['layers_status'], array( 'legacy', 'mixed' ), true )
				|| in_array( $verify['content_status'], array( 'legacy', 'mixed' ), true ) ) {
				$needs_batch = true;
			} elseif ( ! $verify['ok'] ) {
				$needs_batch = true;
			}
		}

		// Also finalize when the chunks still need converting to JSON: that pass runs inside
		// maybe_finalize_chunked_storage(), and this is what makes the editor ask for it.
		$needs_finalize = ! $empty_both && $verify['ok']
			&& ( self::STORAGE_FORMAT_CHUNKED_VERIFIED !== $version || ! $this->storage_encoding_is_json( $parent ) );

		// needs_format_finalize: version stamp / silent finalize after save (JS). Native chunked-only configs
		// may need this while never having been "migrated" from legacy — do not show a migration warning for that.
		$has_legacy_or_mixed = in_array( $verify['layers_status'], array( 'legacy', 'mixed' ), true )
			|| in_array( $verify['content_status'], array( 'legacy', 'mixed' ), true );
		$needs_migration_banner = $needs_batch || ( $needs_finalize && $has_legacy_or_mixed );

		return array(
			'layers'                    => $verify['layers_status'],
			'content'                   => $verify['content_status'],
			'storage_format_version'    => $version,
			'storage_encoding'          => $this->storage_encoding_is_json( $parent ) ? self::STORAGE_ENCODING_JSON : 'serialized',
			'integrity_ok'              => (bool) $verify['ok'],
			'integrity_issues'          => $verify['issues'],
			'needs_batch_migration'     => $needs_batch,
			'needs_format_finalize'     => $needs_finalize,
			'needs_migration_banner'    => $needs_migration_banner,
		);
	}

	/**
	 * Set Data
	 *
	 * @param integer $id        - The product ID
	 * @param integer $ref_id    - The referring ID
	 * @param string  $component - Which component to save (Layers, angles, content)
	 * @param array   $raw_data  - The data (full array or delta object for layers/content), or the 'empty' sentinel
	 * @return array|false False when the write is refused (unknown product, or data that cannot be trusted).
	 */
	public function set( $id, $ref_id, $component, $raw_data, $modified_choices = false ) {
		if ( ! $this->is_product( $id ) ) return false;
		if ( $ref_id !== $id && ! $this->is_product( $ref_id ) ) return false;

		// Only an array, or the explicit 'empty' sentinel, may reach the writers below. Anything else
		// (typically a payload that failed to decode) is read as "no data" by the chunked writers and
		// would purge the stored chunks. Refuse the write instead.
		if ( 'empty' !== $raw_data && ! is_array( $raw_data ) ) {
			return false;
		}

		do_action( 'mkl_pc_before_save_product_configuration_' . $component, $id, $raw_data );
		do_action( 'mkl_pc_before_save_product_configuration', $id, $raw_data );

		if ( 'layers' === $component ) {
			return $this->set_layers( $id, $ref_id, $raw_data );
		}
		if ( 'content' === $component ) {
			return $this->set_content( $id, $ref_id, $raw_data, $modified_choices );
		}

		// Angles, conditions, etc.: legacy single-meta write
		if ( 'empty' === $raw_data ) {
			$data = array();
		} elseif ( is_array( $raw_data ) ) {
			$data = $this->normalize_for_set( $raw_data, $id, $component, $modified_choices );

			// When saving, avoid persisting full data for global refs
			if ( 'layers' === $component && is_array( $data ) ) {
				$data = Global_Layer_Linker::strip_layers_to_references( $data );
			} elseif ( 'content' === $component && is_array( $data ) ) {
				$data = Global_Layer_Linker::strip_content_to_references( $data );
			}
		} else {
			$data = $raw_data;
		}
		$data     = apply_filters( 'mkl_product_configurator/data/set/' . $component, $data, $id );
		$owner_id = $this->resolve_storage_owner_id( $id, 0, $component );
		if ( $owner_id <= 0 ) {
			$owner_id = (int) $id;
		}
		$product = $this->get_owner( $owner_id );
		if ( ! $product ) {
			return false;
		}
		if ( ! $this->write_structured_meta( $product, '_mkl_product_configurator_' . $component, $data ) ) {
			return false;
		}
		$product->update_meta_data( '_mkl_product_configurator_last_updated', time() );
		$product->save();
		do_action( 'wpml_sync_custom_field', $owner_id, '_mkl_product_configurator_' . $component );
		do_action( 'wpml_sync_custom_field', $owner_id, '_mkl_product_configurator_last_updated' );
		do_action( 'mkl_pc_saved_product_configuration_' . $component, $id, $data );
		do_action( 'mkl_pc_saved_product_configuration', $id );
		wp_cache_delete( "mkl_pc_data_{$component}_{$owner_id}", 'mkl_pc' );
		if ( $owner_id !== (int) $id ) {
			wp_cache_delete( "mkl_pc_data_{$component}_{$id}", 'mkl_pc' );
		}
		return $data;
	}

	/**
	 * Normalize raw data for set (strip active, apply choice filter).
	 *
	 * Expects a list of layers, or of content rows `{ layerId, choices }`. A single
	 * layer or a bare choice list should be wrapped in an array first, then unwrapped.
	 *
	 * @param array  $raw_data
	 * @param int    $id
	 * @param string $component
	 * @param mixed  $modified_choices
	 * @return array
	 */
	public function normalize_for_set( $raw_data, $id, $component, $modified_choices ) {
		foreach ( $raw_data as $key => $value ) {
			if ( isset( $value['active'] ) ) {
				$raw_data[ $key ]['active'] = false;
			} elseif ( isset( $value['choices'] ) ) {
				foreach ( $value['choices'] as $choice_index => $choice ) {
					if ( isset( $choice['active'] ) ) {
						$raw_data[ $key ]['choices'][ $choice_index ]['active'] = false;
						$raw_data[ $key ]['choices'][ $choice_index ] = apply_filters( 'mkl_product_configurator/data/set/choice', $raw_data[ $key ]['choices'][ $choice_index ], $id, $raw_data, $modified_choices );
					}
				}
			}
		}
		return $raw_data;
	}

	/**
	 * Set layers (chunked storage): one meta + save per layer.
	 *
	 * @param int   $id
	 * @param int   $ref_id
	 * @param mixed $raw_data Full array of layers, delta object, or 'empty'
	 * @return array|false
	 */
	private function set_layers( $id, $ref_id, $raw_data ) {
		$owner_id = $this->resolve_storage_owner_id( $id, 0, 'layers' );
		if ( $owner_id <= 0 ) {
			$owner_id = (int) $id;
		}
		$product = $this->get_owner( $owner_id );
		if ( ! $product ) {
			return false;
		}

		// Delta: { layers_index: [], layers: { id => layer_data }, deleted: [] }
		if ( is_array( $raw_data ) && isset( $raw_data['layers_index'] ) && isset( $raw_data['layers'] ) ) {
			return $this->set_layers_delta( $id, $product, $raw_data, $owner_id );
		}

		if ( 'empty' === $raw_data ) {
			$data = array();
		} elseif ( is_array( $raw_data ) ) {
			$data = $this->normalize_for_set( $raw_data, $id, 'layers', false );
		} else {
			return false;
		}
		$data = apply_filters( 'mkl_product_configurator/data/set/layers', $data, $id );

		// A filter that returned something unusable must not be read as "delete everything".
		if ( ! is_array( $data ) ) {
			return false;
		}

		// Reached only for a deliberate empty save ('empty' sentinel or a genuinely empty array).
		if ( empty( $data ) ) {
			$old_index = $product->get_meta( '_mkl_product_configurator_layers_index' );
			$old_index = maybe_unserialize( $old_index );
			if ( is_string( $old_index ) ) {
				$old_index = $this->decode_stored_json( $old_index );
			}
			$product->update_meta_data( '_mkl_product_configurator_layers_index', array() );
			$product->save();
			$this->delete_layer_chunk_metas( $product, array(), is_array( $old_index ) ? $old_index : array() );
			$product->delete_meta_data( '_mkl_product_configurator_layers' );
			$product->update_meta_data( '_mkl_product_configurator_last_updated', time() );
			$product->save();
			$this->invalidate_layers_cache( $owner_id );
			if ( $owner_id !== (int) $id ) {
				$this->invalidate_layers_cache( $id );
			}
			do_action( 'wpml_sync_custom_field', $owner_id, '_mkl_product_configurator_layers_index' );
			do_action( 'mkl_pc_saved_product_configuration_layers', $id, array() );
			do_action( 'mkl_pc_saved_product_configuration', $id );
			return array();
		}

		$layer_ids = array();
		foreach ( $data as $layer ) {
			if ( isset( $layer['_id'] ) ) {
				$layer_ids[] = (int) $layer['_id'];
			}
		}

		$old_index = $product->get_meta( '_mkl_product_configurator_layers_index' );
		$old_index = maybe_unserialize( $old_index );
		if ( is_string( $old_index ) ) {
			$old_index = $this->decode_stored_json( $old_index );
		}
		if ( ! is_array( $old_index ) ) {
			$old_index = array();
		}

		$meta_writes = array( '_mkl_product_configurator_layers_index' => $layer_ids );
		foreach ( $data as $layer ) {
			$layer_id = isset( $layer['_id'] ) ? (int) $layer['_id'] : 0;
			if ( ! $layer_id ) {
				continue;
			}
			$stripped = Global_Layer_Linker::strip_layers_to_references( array( $layer ) );
			$meta_writes[ '_mkl_product_configurator_layer_' . $layer_id ] = isset( $stripped[0] ) ? $stripped[0] : $layer;
		}
		$encoded = $this->encode_meta_batch( $meta_writes );
		if ( false === $encoded ) {
			return false;
		}
		$encoded_index = $encoded['_mkl_product_configurator_layers_index'];
		unset( $encoded['_mkl_product_configurator_layers_index'] );

		$product->update_meta_data( '_mkl_product_configurator_layers_index', $encoded_index );
		$product->update_meta_data( '_mkl_product_configurator_last_updated', time() );
		$product->save();
		do_action( 'wpml_sync_custom_field', $owner_id, '_mkl_product_configurator_layers_index' );
		do_action( 'wpml_sync_custom_field', $owner_id, '_mkl_product_configurator_last_updated' );

		foreach ( $encoded as $meta_key => $meta_value ) {
			$product->update_meta_data( $meta_key, $meta_value );
			$product->save();
			do_action( 'wpml_sync_custom_field', $owner_id, $meta_key );
		}

		$this->delete_layer_chunk_metas( $product, $layer_ids, $old_index );
		$product->delete_meta_data( '_mkl_product_configurator_layers' );
		$product->save();

		$this->purge_orphan_chunks_for_structure( $product, $owner_id, $layer_ids );
		Global_Layer_Linker::reconcile_after_layers_write( $product, $owner_id, $layer_ids );

		$this->invalidate_layers_cache( $owner_id );
		if ( $owner_id !== (int) $id ) {
			$this->invalidate_layers_cache( $id );
		}
		do_action( 'mkl_pc_saved_product_configuration_layers', $id, $data );
		do_action( 'mkl_pc_saved_product_configuration', $id );
		return $data;
	}

	/**
	 * Set layers from delta payload.
	 *
	 * @param int         $id       Logical product id (source of change).
	 * @param \WC_Product|\MKL\PC\Global_Configurators\Storage_Owner $product Storage owner (may be CPT when linked globally).
	 * @param array       $payload  { layers_index: [], layers: { id => data }, deleted: [] }
	 * @param int|null    $owner_id Storage owner id (defaults to $id when not provided).
	 * @return array|false False when the payload carries no layer index (malformed / truncated request).
	 */
	private function set_layers_delta( $id, $product, $payload, $owner_id = null ) {
		if ( null === $owner_id ) {
			$owner_id = (int) $id;
		}
		$layer_ids = isset( $payload['layers_index'] ) && is_array( $payload['layers_index'] ) ? $payload['layers_index'] : array();
		$layers = isset( $payload['layers'] ) && is_array( $payload['layers'] ) ? $payload['layers'] : array();
		$deleted = isset( $payload['deleted'] ) && is_array( $payload['deleted'] ) ? $payload['deleted'] : array();

		// A delta always carries the full layer index; an empty one means the payload lost it (a
		// truncated or malformed request). Writing it would blank the index and purge every chunk.
		// A configurator the user really emptied is saved through the 'empty' sentinel instead.
		if ( empty( $layer_ids ) ) {
			return false;
		}

		$meta_writes = array( '_mkl_product_configurator_layers_index' => $layer_ids );
		foreach ( $layers as $layer_id => $layer ) {
			$layer_id = (int) $layer_id;
			if ( ! $layer_id ) continue;
			$layer = $this->normalize_for_set( array( $layer ), $id, 'layers', false );
			$layer = isset( $layer[0] ) ? $layer[0] : $layer;
			$layer = apply_filters( 'mkl_product_configurator/data/set/layers', array( $layer ), $id );
			$layer = isset( $layer[0] ) ? $layer[0] : $layer;
			$stripped = Global_Layer_Linker::strip_layers_to_references( array( $layer ) );
			$meta_writes[ '_mkl_product_configurator_layer_' . $layer_id ] = isset( $stripped[0] ) ? $stripped[0] : $layer;
		}
		$encoded = $this->encode_meta_batch( $meta_writes );
		if ( false === $encoded ) {
			return false;
		}
		$encoded_index = $encoded['_mkl_product_configurator_layers_index'];
		unset( $encoded['_mkl_product_configurator_layers_index'] );

		$product->update_meta_data( '_mkl_product_configurator_layers_index', $encoded_index );
		$product->update_meta_data( '_mkl_product_configurator_last_updated', time() );
		$product->save();
		do_action( 'wpml_sync_custom_field', $owner_id, '_mkl_product_configurator_layers_index' );
		do_action( 'wpml_sync_custom_field', $owner_id, '_mkl_product_configurator_last_updated' );

		foreach ( $encoded as $meta_key => $meta_value ) {
			$product->update_meta_data( $meta_key, $meta_value );
			$product->save();
			do_action( 'wpml_sync_custom_field', $owner_id, $meta_key );
		}

		foreach ( $deleted as $layer_id ) {
			$layer_id = (int) $layer_id;
			if ( $layer_id ) {
				$product->delete_meta_data( '_mkl_product_configurator_layer_' . $layer_id );
				$product->delete_meta_data( '_mkl_product_configurator_content_' . $layer_id );
			}
		}
		$product->save();
		$this->purge_orphan_chunks_for_structure( $product, $owner_id, $layer_ids );

		Global_Layer_Linker::reconcile_after_layers_write( $product, $owner_id, $layer_ids );

		$data = $this->get( 'layers', $id );
		$this->invalidate_layers_cache( $owner_id );
		if ( $owner_id !== (int) $id ) {
			$this->invalidate_layers_cache( $id );
		}
		do_action( 'mkl_pc_saved_product_configuration_layers', $id, $data ? $data : array() );
		do_action( 'mkl_pc_saved_product_configuration', $id );
		return $data ? $data : array();
	}

	/**
	 * Delete layer chunk metas whose IDs are not in the keep list.
	 *
	 * @param \WC_Product|\MKL\PC\Global_Configurators\Storage_Owner $product
	 * @param array       $keep_ids  New layer IDs to keep.
	 * @param array       $old_index Unused; kept for call-site compatibility.
	 */
	private function delete_layer_chunk_metas( $product, $keep_ids, $old_index = array() ) {
		unset( $old_index );
		$this->delete_orphan_chunk_metas( $product, $keep_ids, '_mkl_product_configurator_layer_' );
	}

	/**
	 * Set content (chunked storage): one meta + save per layer.
	 *
	 * @param int   $id
	 * @param int   $ref_id
	 * @param mixed $raw_data Full array of content items, delta object, or 'empty'
	 * @param mixed $modified_choices
	 * @return array|false
	 */
	private function set_content( $id, $ref_id, $raw_data, $modified_choices = false ) {
		$owner_id = $this->resolve_storage_owner_id( $id, 0, 'content' );
		if ( $owner_id <= 0 ) {
			$owner_id = (int) $id;
		}
		$product = $this->get_owner( $owner_id );
		if ( ! $product ) {
			return false;
		}

		// Delta: { content: { layerId => { layerId, choices } } }
		if ( is_array( $raw_data ) && isset( $raw_data['content'] ) && is_array( $raw_data['content'] ) ) {
			return $this->set_content_delta( $id, $product, $raw_data, $modified_choices, $owner_id );
		}

		if ( 'empty' === $raw_data ) {
			$data = array();
		} elseif ( is_array( $raw_data ) ) {
			$data = $this->normalize_for_set( $raw_data, $id, 'content', $modified_choices );
		} else {
			return false;
		}
		$data = apply_filters( 'mkl_product_configurator/data/set/content', $data, $id );

		// A filter that returned something unusable must not be read as "delete everything".
		if ( ! is_array( $data ) ) {
			return false;
		}

		$layer_ids = array();
		foreach ( $data as $item ) {
			if ( isset( $item['layerId'] ) ) {
				$layer_ids[] = (int) $item['layerId'];
			}
		}

		$current_index = $product->get_meta( '_mkl_product_configurator_layers_index' );
		$current_index = maybe_unserialize( $current_index );
		if ( is_string( $current_index ) ) {
			$current_index = $this->decode_stored_json( $current_index );
		}
		if ( ! is_array( $current_index ) ) {
			$current_index = array();
		}
		if ( empty( $layer_ids ) && ! empty( $data ) ) {
			$layer_ids = $current_index;
		}

		$meta_writes = array();
		foreach ( $data as $item ) {
			$layer_id = isset( $item['layerId'] ) ? (int) $item['layerId'] : 0;
			if ( ! $layer_id ) {
				continue;
			}
			$stripped = Global_Layer_Linker::strip_content_to_references( array( $item ) );
			$meta_writes[ '_mkl_product_configurator_content_' . $layer_id ] = isset( $stripped[0] ) ? $stripped[0] : $item;
		}
		$encoded = $this->encode_meta_batch( $meta_writes );
		if ( false === $encoded ) {
			return false;
		}

		foreach ( $encoded as $meta_key => $meta_value ) {
			$product->update_meta_data( $meta_key, $meta_value );
			$product->save();
			do_action( 'wpml_sync_custom_field', $owner_id, $meta_key );
		}

		$this->delete_content_chunk_metas( $product, $layer_ids, $current_index );
		$product->delete_meta_data( '_mkl_product_configurator_content' );
		$product->update_meta_data( '_mkl_product_configurator_last_updated', time() );
		$product->save();

		Global_Layer_Linker::reconcile_after_content_write( $id, $product, $owner_id, $layer_ids );
		do_action( 'wpml_sync_custom_field', $owner_id, '_mkl_product_configurator_last_updated' );

		$this->invalidate_layers_cache( $owner_id );
		wp_cache_delete( 'mkl_pc_data_content_' . $owner_id, 'mkl_pc' );
		if ( $owner_id !== (int) $id ) {
			$this->invalidate_layers_cache( $id );
			wp_cache_delete( 'mkl_pc_data_content_' . $id, 'mkl_pc' );
		}
		do_action( 'mkl_pc_saved_product_configuration_content', $id, $data );
		do_action( 'mkl_pc_saved_product_configuration', $id );
		return $data;
	}

	/**
	 * Set content from delta payload.
	 *
	 * @param int         $id       Logical product id (source of change).
	 * @param \WC_Product|\MKL\PC\Global_Configurators\Storage_Owner $product Storage owner (may be CPT when linked globally).
	 * @param array       $payload  { content: { layerId => { layerId, choices } } }
	 * @param mixed       $modified_choices
	 * @param int|null    $owner_id Storage owner id (defaults to $id).
	 * @return array
	 */
	private function set_content_delta( $id, $product, $payload, $modified_choices = false, $owner_id = null ) {
		if ( null === $owner_id ) {
			$owner_id = (int) $id;
		}
		$content_chunks = isset( $payload['content'] ) && is_array( $payload['content'] ) ? $payload['content'] : array();
		$meta_writes = array();
		foreach ( $content_chunks as $layer_id => $item ) {
			$layer_id = (int) $layer_id;
			if ( ! $layer_id ) continue;
			$normalized = $this->normalize_for_set( array( $item ), $id, 'content', $modified_choices );
			$item = isset( $normalized[0] ) ? $normalized[0] : $item;
			$item = apply_filters( 'mkl_product_configurator/data/set/content', array( $item ), $id );
			$item = is_array( $item ) && isset( $item[0] ) ? $item[0] : $item;
			if ( ! isset( $item['layerId'] ) ) {
				$item['layerId'] = $layer_id;
			}
			$stripped = Global_Layer_Linker::strip_content_to_references( array( $item ) );
			$meta_writes[ '_mkl_product_configurator_content_' . $layer_id ] = isset( $stripped[0] ) ? $stripped[0] : $item;
		}
		$encoded = $this->encode_meta_batch( $meta_writes );
		if ( false === $encoded ) {
			return false;
		}

		foreach ( $encoded as $meta_key => $meta_value ) {
			$product->update_meta_data( $meta_key, $meta_value );
			$product->save();
			do_action( 'wpml_sync_custom_field', $owner_id, $meta_key );
		}
		$layers_index = $this->read_layers_index_array( $product );
		if ( empty( $layers_index ) ) {
			// Per-variation content: the index lives with the layer structure, on the parent.
			$layers_index = $this->read_layers_index_array( $this->get_layers_owner_for( $owner_id ) );
		}
		if ( ! empty( $layers_index ) ) {
			$this->delete_orphan_chunk_metas( $product, $layers_index, '_mkl_product_configurator_content_' );
		}
		$product->update_meta_data( '_mkl_product_configurator_last_updated', time() );
		$product->save();

		Global_Layer_Linker::reconcile_after_content_write( $id, $product, $owner_id, array_keys( $content_chunks ) );
		do_action( 'wpml_sync_custom_field', $owner_id, '_mkl_product_configurator_last_updated' );
		wp_cache_delete( 'mkl_pc_data_content_' . $owner_id, 'mkl_pc' );
		if ( $owner_id !== (int) $id ) {
			wp_cache_delete( 'mkl_pc_data_content_' . $id, 'mkl_pc' );
		}
		$data = $this->get( 'content', $id );
		$this->invalidate_layers_cache( $owner_id );
		if ( $owner_id !== (int) $id ) {
			$this->invalidate_layers_cache( $id );
		}
		do_action( 'mkl_pc_saved_product_configuration_content', $id, $data ? $data : array() );
		do_action( 'mkl_pc_saved_product_configuration', $id );
		return $data ? $data : array();
	}

	/**
	 * Delete content chunk metas whose layer IDs are not in the keep list.
	 *
	 * @param \WC_Product|\MKL\PC\Global_Configurators\Storage_Owner $product
	 * @param array       $keep_ids  Layer IDs to keep (current content layer IDs).
	 * @param array       $old_index Unused; kept for call-site compatibility.
	 */
	private function delete_content_chunk_metas( $product, $keep_ids, $old_index = null ) {
		unset( $old_index );
		$this->delete_orphan_chunk_metas( $product, $keep_ids, '_mkl_product_configurator_content_' );
	}

	/**
	 * Drop object-cache entries for layers/content/index on one owner.
	 *
	 * @internal Used by Global_Layer\Linker after writing product chunks.
	 *
	 * @param int $product_id
	 * @return void
	 */
	public function invalidate_layers_cache( $product_id ) {
		wp_cache_delete( 'mkl_pc_data_layers_' . $product_id, 'mkl_pc' );
		wp_cache_delete( 'mkl_pc_data_content_' . $product_id, 'mkl_pc' );
		wp_cache_delete( 'mkl_pc_layers_index_' . $product_id, 'mkl_pc' );
	}

	/**
	 * Get the product ID for storing the content
	 *
	 * @param int $product_id
	 * @param int $variation_id
	 * @return int
	 */
	public function get_product_id_for_content( $product_id, $variation_id ) {
		$product = $this->get_owner( $product_id );
		if ( ! $product ) return 0;
		$mode = $product->get_meta( MKL_PC_PREFIX . '_variable_configuration_mode', true );
		if ( ( ! $mode || 'share_layers_config' == $mode ) && $variation_id ) {
			return $variation_id;
		}
		return $product_id;
	}

	/**
	 * Get content for a single layer (chunked or legacy).
	 *
	 * @param int $product_id
	 * @param int $layer_id
	 * @return array|false { layerId, choices } or false
	 */
	public function get_content_layer( $product_id, $layer_id ) {
		$owner_id = $this->resolve_storage_owner_id( $product_id, 0, 'content' );
		if ( $owner_id <= 0 ) {
			$owner_id = (int) $product_id;
		}
		$product = $this->get_owner( $owner_id );
		if ( ! $product ) {
			return false;
		}
		$chunk = $product->get_meta( '_mkl_product_configurator_content_' . $layer_id );
		if ( '' !== $chunk ) {
			$chunk = maybe_unserialize( $chunk );
			if ( is_string( $chunk ) ) {
				$chunk = $this->decode_stored_json( $chunk );
			}
			if ( is_array( $chunk ) ) {
				if ( ! isset( $chunk['layerId'] ) ) {
					$chunk['layerId'] = (int) $layer_id;
				}
				// A global layer stores a bare `{ layerId, global_id }` reference here, so
				// without this every caller sees a layer with no choices at all.
				$resolved = Global_Layer_Linker::resolve_content( array( $chunk ), $owner_id );
				return isset( $resolved[0] ) ? $resolved[0] : $chunk;
			}
		}
		$content = $this->get( 'content', $product_id );
		if ( ! is_array( $content ) ) {
			return false;
		}
		foreach ( $content as $item ) {
			if ( isset( $item['layerId'] ) && (int) $item['layerId'] === (int) $layer_id ) {
				return $item;
			}
		}
		return false;
	}

	/**
	 * Set content for a single layer (one chunk write).
	 *
	 * @param int   $product_id
	 * @param int   $layer_id
	 * @param array $layer_content { layerId, choices }
	 * @return bool
	 */
	public function set_content_layer( $product_id, $layer_id, $layer_content ) {
		$owner_id = $this->resolve_storage_owner_id( $product_id, 0, 'content' );
		if ( $owner_id <= 0 ) {
			$owner_id = (int) $product_id;
		}
		$product = $this->get_owner( $owner_id );
		if ( ! $product ) {
			return false;
		}
		if ( ! isset( $layer_content['layerId'] ) ) {
			$layer_content['layerId'] = (int) $layer_id;
		}

		// The stored chunk is a reference to a global layer: the choices live on the layer post,
		// so write them there and leave the reference alone. Writing them into the product meta
		// instead would break the link, and returning early would silently drop the change -
		// which is what used to happen to stock updates on a global layer's choices.
		$global_id = Global_Layer_Linker::get_content_layer_global_id( $product, $layer_id );
		if ( $global_id > 0 ) {
			$choices = isset( $layer_content['choices'] ) && is_array( $layer_content['choices'] ) ? $layer_content['choices'] : array();
			if ( ! Global_Layers::save_content( $global_id, $choices ) ) {
				return false;
			}
			do_action( 'mkl_pc_saved_product_configuration_content', $product_id, array( $layer_content ) );
			do_action( 'mkl_pc_saved_product_configuration', $product_id );
			return true;
		}

		if ( ! $this->write_structured_meta( $product, '_mkl_product_configurator_content_' . $layer_id, $layer_content ) ) {
			return false;
		}
		$product->update_meta_data( '_mkl_product_configurator_last_updated', time() );
		$product->save();
		do_action( 'wpml_sync_custom_field', $owner_id, '_mkl_product_configurator_content_' . $layer_id );
		do_action( 'wpml_sync_custom_field', $owner_id, '_mkl_product_configurator_last_updated' );
		wp_cache_delete( 'mkl_pc_data_content_' . $owner_id, 'mkl_pc' );
		if ( $owner_id !== (int) $product_id ) {
			wp_cache_delete( 'mkl_pc_data_content_' . $product_id, 'mkl_pc' );
		}
		do_action( 'mkl_pc_saved_product_configuration_content', $product_id, array( $layer_content ) );
		do_action( 'mkl_pc_saved_product_configuration', $product_id );
		return true;
	}

	/**
	 * Turn an owner's references to a global layer back into its own copy of the data.
	 *
	 * Used when the global layer is about to disappear: the reference would stop resolving and
	 * the layer would lose every choice it has.
	 *
	 * @param int $owner_id  Product, variation, or global configurator id holding the reference.
	 * @param int $global_id Global layer being localized.
	 * @return bool True when something was written.
	 */
	public function localize_global_layer( $owner_id, $global_id ) {
		return Global_Layer_Linker::localize( $owner_id, $global_id );
	}

	/**
	 * Update a choice
	 *
	 * @param int   $product_id
	 * @param int   $variation_id
	 * @param int   $layer_id
	 * @param int   $choice_id
	 * @param array $data
	 * @return boolean
	 */
	public function update_choice( $product_id, $variation_id, $layer_id, $choice_id, $data = array() ) {

		if ( empty( $data ) ) return false;

		$product_id = $this->get_product_id_for_content( $product_id, $variation_id );

		if ( ! $product_id ) return false;

		$layer_content = $this->get_content_layer( $product_id, $layer_id );

		if ( empty( $layer_content ) || ! isset( $layer_content['choices'] ) || ! is_array( $layer_content['choices'] ) ) {
			return false;
		}

		foreach ( $layer_content['choices'] as $choice_index => $choice ) {
			if ( (int) $choice_id !== (int) ( isset( $choice['_id'] ) ? $choice['_id'] : 0 ) ) {
				continue;
			}
			$layer_content['choices'][ $choice_index ] = wp_parse_args( $data, $choice );
			$this->set_content_layer( $product_id, $layer_id, $layer_content );
			return true;
		}
		return false;
	}

	/**
	 * Get the menu
	 *
	 * @param integer $id
	 * @return array
	 */
	public function get_menu( $id = null ) {
		if ( ! $id ) {
			global $post;
			if ( $post && isset( $post->ID ) ) {
				$id = (int) $post->ID;
			}
		}

		$default_menu = array(
			array(
				'type' 	=> 'part',
				'menu_id' 	=> 'home',
				'label' => __( 'Home', 'product-configurator-for-woocommerce' ),
				'title' => __( 'Welcome to the Product Configurator ', 'product-configurator-for-woocommerce' ),
				// 'menu' => array(
				// 	array(
				// 		'class' => 'pc-main-cancel',
				// 		'text' => __( 'Cancel' , 'product-configurator-for-woocommerce' ),
				// 	),
				// 	array(
				// 		'class' => 'button-primary pc-main-save-all',
				// 		'text' => __( 'Save' , 'product-configurator-for-woocommerce' ),
				// 	),

				// ),
				'description' => '',
				'order' => 10,
			),
			array(
				'type' 	=> 'part',
				'menu_id' 	=> 'layers',
				'label' => __( 'Layers', 'product-configurator-for-woocommerce' ),
				'title' => __( 'Layers', 'product-configurator-for-woocommerce' ),
				'menu' => array(
					array(
						'class' => 'button-primary pc-main-save-all',
						'text' => __( 'Save' , 'product-configurator-for-woocommerce' ),
					),

				),
				'description' => __( 'Define the layers the product is composed of. ', 'product-configurator-for-woocommerce' ),
				'order' => 20,
			),
			array(
				'type' 	=> 'part',
				'menu_id' 	=> 'angles',
				'label' => __( 'Views', 'product-configurator-for-woocommerce' ),
				'title' => __( 'Views', 'product-configurator-for-woocommerce' ),
				'menu' => array(
					array(
						'class' => 'button-primary pc-main-save-all',
						'text' => __( 'Save' , 'product-configurator-for-woocommerce' ),
					),

				),
				'description' => __( 'Define the view angles, if you want the client to be able to switch between them. ', 'product-configurator-for-woocommerce' ),
				'order' => 30,
			),
			array(
				'type' 	=> 'part',
				'menu_id' 	=> 'content',
				'label' => __( 'Content', 'product-configurator-for-woocommerce' ),
				'title' => __( 'Content', 'product-configurator-for-woocommerce' ),
				'menu' => array(
					array(
						'class' => 'button-primary pc-main-save-all',
						'text' => __( 'Save' , 'product-configurator-for-woocommerce' ),
					),

				),
				'description' => __( 'Define choices for each layer and assign them pictures', 'product-configurator-for-woocommerce' ),
				'order' => 40,
			),
		);


		if ( ! $id || '3d' !== mkl_pc_get_configurator_type( $id ) ) {
			$default_menu[] = array(
				'type' 	=> 'part',
				'menu_id' 	=> 'image_order',
				'label' => __( 'Image order', 'product-configurator-for-woocommerce' ),
				'title' => __( 'Image order', 'product-configurator-for-woocommerce' ),
				'menu' => array(
					array(
						'class' => 'button-primary pc-main-save-all',
						'text' => __( 'Save' , 'product-configurator-for-woocommerce' ),
					),
				),
				'description' => __( 'The order the layers\' images are stacked in, which is separate from the order they appear in the menu. The layer at the top of the list is drawn over the ones below it.', 'product-configurator-for-woocommerce' ),
				'order' => 45,
			);
		}

		if ( ! class_exists( 'MKL_PC_Conditional_Logic_Admin' ) && ! get_user_meta( get_current_user_id(), 'mkl_pc_hide_addon__conditional_placeholder', true )  ) {
			$default_menu[] = array(
				'type' 	=> 'separator',
				'order' => 100,
			);
	
			$default_menu[] = array(
				'type' 	=> 'part',
				'menu_id' 	=> 'conditional_placeholder',
				'label' => __( 'Conditional settings', 'product-configurator-for-woocommerce' ),
				'title' => __( 'Conditional settings ', 'product-configurator-for-woocommerce' ),
				'menu' => array(),
				'description' => __( 'Define the conditions for displaying or not the choices / layers', 'product-configurator-for-woocommerce' ),
				'order' => 101,
			);			
		}
		
		if ( $id && '3d' === mkl_pc_get_configurator_type( $id ) ) {
			$default_menu[] = array(
				'type' 	=> 'part',
				'menu_id' 	=> 'objects3d',
				'label' => __( '3D Objects', 'product-configurator-for-woocommerce' ),
				'title' => __( '3D Objects', 'product-configurator-for-woocommerce' ),
				'menu' => array(
					array(
						'class' => 'pc-main-cancel',
						'text' => __( 'Cancel' , 'product-configurator-for-woocommerce' ),
					),
					array(
						'class' => 'button-primary pc-main-save-all',
						'text' => __( 'Save' , 'product-configurator-for-woocommerce' ),
					),
				),
				'description' => __( 'Manage 3D models and assets used by this product', 'product-configurator-for-woocommerce' ),
				'order' => 45,
			);
			$default_menu[] = array(
				'type' 	=> 'part',
				'menu_id' 	=> 'settings_3d',
				'label' => __( '3D settings', 'product-configurator-for-woocommerce' ),
				'title' => __( '3D settings', 'product-configurator-for-woocommerce' ),
				'menu' => array(
					array(
						'class' => 'pc-main-cancel',
						'text' => __( 'Cancel' , 'product-configurator-for-woocommerce' ),
					),
					array(
						'class' => 'button-primary pc-main-save-all',
						'text' => __( 'Save settings' , 'product-configurator-for-woocommerce' ),
					),
				),
				'description' => __( 'Manage the main 3D settings for this product', 'product-configurator-for-woocommerce' ),
				'order' => 50,
			);
		}

		$menu = apply_filters( 'mkl_product_configurator_admin_menu', $default_menu );

		if ( Global_Layers::is_global_layer_id( $id ) ) {
			$menu = Global_Layer_Linker::filter_menu( $menu );
		}

		return $menu;
	}

	/**
	 * Add tne import section to the menu
	 */
	public function add_import_section( $menu ) {
		return array_merge(
			$menu, 
			array(
				array(
					'type' 	=> 'separator',
					'order' => 1190,
				),
				array(
					'type' 	=> 'part',
					'menu_id' 	=> 'import',
					'label' => __( 'Import / Export' , 'product-configurator-for-woocommerce' ),
					'title' => __( 'Import / Export the product\'s data ', 'product-configurator-for-woocommerce' ),
					'bt_save_text' => __( 'Export' , 'product-configurator-for-woocommerce' ),
					'description' => '',
					'order' => 1200,
					// __( 'Description for I/E of the product ', 'product-configurator-for-woocommerce' ),
				),
			)
		);
	}

	/**
	 * Default 3D settings structure (Environment, Background, Ground, Renderer, Lighting).
	 *
	 * @return array
	 */
	/**
	 * Default 3D object names that are automatically hidden in the viewer.
	 * Filterable so themes/plugins can add or remove names.
	 *
	 * @return array List of object names to hide.
	 */
	public static function get_default_hidden_object_names() {
		$defaults = array( 'product_bounding_box', 'material_placeholders' );
		return apply_filters( 'mkl_pc_3d_default_hidden_object_names', $defaults );
	}

	public static function get_default_settings_3d() {
		return array(
			'hidden_object_names' => '',
			'poster'          => array(
				'attachment_id' => null,
				'url'           => '',
			),
			'environment'     => array(
				'mode'                   => 'preset',
				'preset'                 => 'outdoor',
				'object_id'              => '',
				'intensity'              => 1,
				'rotation'               => 0,
				'blur'                   => 0,
				'orbit_min_polar_angle'  => 0,
				'orbit_max_polar_angle'  => 90,
				'orbit_min_azimuth_angle' => -180,
				'orbit_max_azimuth_angle' => 180,
				'orbit_min_distance'     => null,
				'orbit_max_distance'     => null,
				'orbit_zoom_limits_enabled' => true,
			),
			'background'      => array(
				'mode'         => 'transparent',
				'color'        => '#ffffff',
			),
			'ground'          => array(
				'enabled'        => true,
				'size'           => 10,
				'shadow_opacity' => 0.5,
				'shadow_blur'    => 5,
				'shadow_general' => 1,
				'shadow_contact' => 1,
				'shadow_offset'  => 0,
				// none | fake | realtime. Replaces the old pair of independent
				// checkboxes, which could both be on and stack two shadows.
				'shadow_mode'    => 'fake',
				// Whether real-time shadows get a plane to land on. Off by default:
				// a product that needs one is the exception, and an unexpected
				// surface under the model is more surprising than a missing one.
				'shadow_catcher' => false,
				// A dedicated caster at intensity zero, and where it casts from.
				'shadow_light'     => true,
				'shadow_elevation' => 55,
				'shadow_azimuth'   => 135,
			),
			'enable_shadows'  => false,
			'extend_under_toolbar' => false,
			'renderer'        => array(
				'tone_mapping'       => 'aces',
				'exposure'           => 1,
				'output_color_space' => 'srgb',
				'alpha'              => false,
			),
			'lighting'        => array(),
			// Effects are contributed by add-ons, which merge their own defaults in.
			'postprocessing'  => array(),
		);
	}

	/**
	 * Get the basic data structure
	 *
	 * @param integer $id - The product's ID
	 * @return array
	 */
	public function get_init_data( $id, $variation_id_for_storage = 0 ) {

		if ( Global_Configurator_Schema::is_global_configurator_id( $id ) ) {
			return $this->get_init_data_for_global_configurator( (int) $id );
		}

		if ( Global_Layers::is_global_layer_id( $id ) ) {
			return Global_Layer_Linker::init_data_for_editor( (int) $id );
		}

		$product = wc_get_product( $id );
		if ( ! $product ) {
			return array();
		}
		if ( 'variation' === $product->get_type() ) {
			$parent_id = $product->get_parent_id();
		} else {
			$parent_id = $id;
		}

		$init_data = array(
			// 'menu' => $this->get_menu(),
			'layers' => $this->get('layers', $parent_id),
			'angles' => $this->get('angles', $parent_id),
			'nonces'      => array(
				'update' => false,
				'delete' => false,
			),
			'product_info' => array(),
			'pc_storage'   => $this->get_pc_storage_state_for_editor( $parent_id, (int) $variation_id_for_storage ),
			'configurator_source' => Global_Configurator_Owner_Resolver::get_source( $parent_id ),
			'global_configurator' => $this->get_global_configurator_info( $parent_id ),
		);
		
		if ( '3d' === mkl_pc_get_configurator_type( $parent_id ) ) {
			$stored = $this->get( 'settings_3d', $parent_id );
			$defaults = self::get_default_settings_3d();
			$init_data['settings_3d'] = is_array( $stored ) ? array_replace_recursive( $defaults, $stored ) : $defaults;
			$stored_objects = $this->get( 'objects3d', $parent_id );
			$init_data['objects3d'] = is_array( $stored_objects ) ? $stored_objects : array();
		}

		if ( 'variable' === $product->get_type()) {
			$init_data['product_info']['mode'] = $product->get_meta( MKL_PC_PREFIX . '_variable_configuration_mode', true );
			if ( Global_Configurator_Owner_Resolver::get_global_id( $parent_id ) > 0 ) {
				$init_data['product_info']['mode'] = 'share_all_config';
			}
			$init_data['product_info']['variations'] = array(); 
			$variations = $product->get_available_variations();
			foreach( $variations as $variation ) {
				$init_data['product_info']['variations'][ $variation['variation_id'] ] = array (
					'is_configurable' => $variation['is_configurable'],
					'price' => $variation['display_price'],
					// 'price_excl_tax' =>
					'regular_price' => $variation['display_regular_price'],
					'is_on_sale' => $variation['display_price'] < $variation['display_regular_price'],
				);
			}
		}

		return apply_filters( 'mkl_product_configurator_init_data', $init_data, $product );
	}

	/**
	 * Build editor init data when a global configurator CPT is being edited directly.
	 *
	 * @param int $cpt_id
	 * @return array
	 */
	private function get_init_data_for_global_configurator( $cpt_id ) {
		$post = get_post( $cpt_id );
		if ( ! $post || Global_Configurator_Schema::CPT_SLUG !== $post->post_type ) {
			return array();
		}
		$consumers           = Global_Configurator_Owner_Resolver::get_consumer_product_ids( $cpt_id );
		$global_config_block = array(
			'id'                => (int) $cpt_id,
			'title'             => get_the_title( $cpt_id ),
			'is_editing_global' => true,
			'edit_url'          => '',
			'consumer_ids'      => $consumers,
			'consumer_count'    => count( $consumers ),
		);
		$init_data = array(
			'layers'              => $this->get( 'layers', $cpt_id ),
			'angles'              => $this->get( 'angles', $cpt_id ),
			'nonces'              => array(
				'update' => false,
				'delete' => false,
			),
			'product_info'        => array(
				'title'        => get_the_title( $cpt_id ),
				'product_type' => Global_Configurator_Schema::OWNER_TYPE_GLOBAL,
			),
			'pc_storage'          => $this->get_pc_storage_state_for_editor( $cpt_id, 0 ),
			'configurator_source' => Global_Configurator_Schema::SOURCE_GLOBAL,
			'global_configurator' => $global_config_block,
		);
		return apply_filters( 'mkl_product_configurator_init_data', $init_data, $post );
	}

	/**
	 * Return a summary of the global configurator a product is linked to (when in global mode).
	 *
	 * @param int $product_id
	 * @return array|null
	 */
	private function get_global_configurator_info( $product_id ) {
		$source = Global_Configurator_Owner_Resolver::get_source( $product_id );
		if ( Global_Configurator_Schema::SOURCE_GLOBAL !== $source ) {
			return null;
		}
		$cpt_id = Global_Configurator_Owner_Resolver::get_global_id( $product_id );
		if ( $cpt_id <= 0 ) {
			return array(
				'id'                => 0,
				'title'             => '',
				'is_editing_global' => false,
				'edit_url'          => '',
				'consumer_ids'      => array(),
				'consumer_count'    => 0,
			);
		}
		$consumers = Global_Configurator_Owner_Resolver::get_consumer_product_ids( $cpt_id );
		$edit_url = get_edit_post_link( $cpt_id, 'raw' );
		return array(
			'id'                => (int) $cpt_id,
			'title'             => get_the_title( $cpt_id ),
			'is_editing_global' => false,
			'edit_url'          => is_string( $edit_url ) ? $edit_url : '',
			'consumer_ids'      => $consumers,
			'consumer_count'    => count( $consumers ),
		);
	}

	/**
	 * Get the Front end Data
	 *
	 * @param integer $id - The product's ID
	 * @return array
	 */
	public function get_front_end_data( $id ) {
		// global $product;
		// if ( $product ) {
		// 	$g_product = $product;
		// } else {
		// 	$g_product = false;
		// }
		$this->set_context( 'frontend' );
		if ( is_callable( [ mkl_pc( 'frontend' ), 'setup_themes' ] ) ) mkl_pc( 'frontend' )->setup_themes();
		$init_data = $this->get_init_data( $id );
		$product = wc_get_product( $id );
		
		if ( ! $product ) return [];

		$product_type = apply_filters( 'mkl_product_configurator_get_front_end_data/product_type', $product->get_type(), $product );
		// get the products 'title' attribute
		$parent_id_for_type = ( 'variation' === $product_type ) ? $product->get_parent_id() : $id;
		$init_data['product_info'] = array_merge(
			$init_data['product_info'], 
			array(
				'title'               => apply_filters( 'the_title', $product->get_title(), $id ),
				'product_type'        => $product_type,
				'configurator_type'   => mkl_pc_get_configurator_type( $parent_id_for_type ),
				'show_qty'       => ! $product->is_sold_individually(),
				'is_in_stock'    => $product->is_in_stock() || $product->backorders_allowed(), 
				'is_purchasable' => $product->is_purchasable(), 
				'weight'         => $product->get_weight(),
				'price_suffix'   => $product->get_price_suffix(),
				'weight_unit'    => get_option( 'woocommerce_weight_unit' ),
				'qty_min_value'  => apply_filters( 'woocommerce_quantity_input_min', 1, $product ),
				'qty_max_value'  => apply_filters( 'woocommerce_quantity_input_max', $product->backorders_allowed() ? '' : $product->get_stock_quantity(), $product ),
			) 
		);

		// Allows to load the Contents on the init data to avoid having to use AJAX. 
		if( 'simple' == $product_type ) {
			// the configurator content
			$init_data['content'] = $this->get( 'content', $id );
			$init_data['product_info']['price'] = (float) $product->get_price();
			$init_data['product_info']['price_excl_tax'] = (float) wc_get_price_excluding_tax( $product ); 
		}

		if ( isset( $init_data['settings_3d'] ) ) {
			$init_data['default_hidden_object_names'] = self::get_default_hidden_object_names();
			if ( ! mkl_pc( 'themes' )->current_theme_supports( 'extend_under_toolbar' ) ) {
				$init_data['settings_3d']['extend_under_toolbar'] = false;
			}
		}

		return apply_filters( 'mkl_product_configurator_get_front_end_data', $init_data, $product );
	}

	/**
	 * Wether the post is a supported configurator owner (product, variation, or global configurator CPT).
	 *
	 * @param integer $id - The product / post ID
	 * @return boolean
	 */
	public function is_product( $id ) {
		return Utils::is_configurator_owner( $id );
	}

	/**
	 * Get the accepted fields
	 *
	 * @return array
	 */
	public function get_fields() {
		return apply_filters( 'mkl_pc_db_fields', 
			[
				'layerId' => [ 
					'sanitize' => 'intval',
					'escape' => 'intval',
				],
				'choiceId' => [ 
					'sanitize' => 'intval',
					'escape' => 'intval',
				],
				'_id' => [ 
					'sanitize' => 'intval',
					'escape' => 'intval',
				],
				'id' => [ 
					'sanitize' => 'intval',
					'escape' => 'intval',
				],
				'layer_id' => [ 
					'sanitize' => 'intval',
					'escape' => 'intval',
				],
				'angle_id' => [ 
					'sanitize' => 'intval',
					'escape' => 'intval',
				],
				'choice_id' => [ 
					'sanitize' => 'intval',
					'escape' => 'intval',
				],
				'ID' => [ 
					'sanitize' => 'intval',
					'escape' => 'intval',
				],
				'height' => [ 
					'sanitize' => 'intval',
					'escape' => 'intval',
				],
				'width' => [ 
					'sanitize' => 'intval',
					'escape' => 'intval',
				],
				'rect_width' => [
					'sanitize' => 'floatval',
					'escape' => 'floatval',
				],
				'rect_height' => [
					'sanitize' => 'floatval',
					'escape' => 'floatval',
				],
				'rotation' => [ 
					'sanitize' => 'intval',
					'escape' => 'intval',
				],
				'leading' => [
					'sanitize' => 'intval',
					'escape' => 'intval',
				],
				'weight' => [ 
					'sanitize' => 'floatval',
					'escape' => 'floatval',
				],
				'angleId' => [ 
					'sanitize' => 'intval',
					'escape' => 'intval',
				],
				'order' => [ 
					'sanitize' => 'intval',
					'escape' => 'intval',
				],
				'image_order' => [ 
					'sanitize' => 'intval',
					'escape' => 'intval',
				],
				'extra_price' => [ 
					'sanitize' => 'floatval',
					'escape' => 'floatval',
				],
				'price' => [ 
					'sanitize' => 'floatval',
					'escape' => 'floatval',
				],
				'price_excl_tax' => [ 
					'sanitize' => 'floatval',
					'escape' => 'floatval',
				],
				'name' => [ 
					'sanitize' => [ $this, 'sanitize_description' ],
					'escape' => [ $this, 'escape_description' ],
				],
				'admin_label' => [ 
					'sanitize' => [ $this, 'sanitize_description' ],
					'escape' => [ $this, 'escape_description' ],
				],
				'angle_name' => [ 
					'sanitize' => 'sanitize_text_field',
					'escape' => 'esc_html',
				],
				'description' => [ 
					'sanitize' => 'wp_filter_post_kses',
					'escape' => [ $this, 'escape_description' ],
				],
				'custom_html' => [ 
					'sanitize' => [ $this, 'sanitize_custom_html_description' ],
					'escape' => [ $this, 'escape_custom_html_description' ],
				],
				'url' => [ 
					'sanitize' => 'esc_url_raw',
					'escape' => [ $this, 'esc_url' ],
				],
				'class_name' => [ 
					'sanitize' => [ 'MKL\PC\Utils', 'sanitize_html_classes' ],
					'escape' => 'esc_attr',
				],
				'active' => [ 
					'sanitize' => 'boolean',
					'escape' => 'boolean',
				],
				'is_default' => [ 
					'sanitize' => 'boolean',
					'escape' => 'boolean',
				],
				'is_group' => [ 
					'sanitize' => 'boolean',
					'escape' => 'boolean',
				],
				'show_group_label_in_cart' => [
					'sanitize' => 'boolean',
					'escape' => 'boolean',
				],
				'hide_in_cart' => [ 
					'sanitize' => 'boolean',
					'escape' => 'boolean',
				],
				'hide_in_configurator' => [ 
					'sanitize' => 'boolean',
					'escape' => 'boolean',
				],
				'use_in_cart' => [ 
					'sanitize' => 'boolean',
					'escape' => 'boolean',
				],
				'has_thumbnails' => [ 
					'sanitize' => 'boolean',
					'escape' => 'boolean',
				],
				'update' => [ 
					'sanitize' => 'sanitize_key',
					'escape' => 'esc_attr',
				],
				'delete' => [ 
					'sanitize' => 'sanitize_key',
					'escape' => 'esc_attr',
				],
				'image' => [ 
					'sanitize' => [ $this, 'sanitize_image' ],
					'escape' => [ $this, 'esc_image' ],
				],
				'camera_target_object_id' => [
					'sanitize' => 'sanitize_text_field',
					'escape' => 'esc_attr',
				],
				'camera_target_model' => [
					'sanitize' => 'sanitize_text_field',
					'escape' => 'esc_attr',
				],
				'camera_focus_object_ids' => [
					'sanitize' => [ __CLASS__, 'sanitize_camera_focus_object_ids' ],
					'escape' => [ __CLASS__, 'escape_camera_focus_object_ids' ],
				],
				'bg_image' => [
					'sanitize' => [ $this, 'sanitize_image' ],
					'escape' => [ $this, 'esc_image' ],
				],
				'product_type' => [ 
					'sanitize' => 'sanitize_key',
					'escape' => 'esc_html',
				],
				'parent' => [ 
					'sanitize' => 'intval',
					'escape' => 'intval',
				],
				'x' => [ 
					'sanitize' => 'floatval',
					'escape' => 'floatval',
				],
				'y' => [ 
					'sanitize' => 'floatval',
					'escape' => 'floatval',
				],
				'z' => [ 
					'sanitize' => 'floatval',
					'escape' => 'floatval',
				],
				// settings_3d: top-level and environment
				'hidden_object_names' => [
					'sanitize' => [ __CLASS__, 'sanitize_hidden_object_names_textarea' ],
					'escape'   => 'esc_textarea',
				],
				'filename' => [
					'sanitize' => 'sanitize_text_field',
					'escape' => 'esc_html',
				],
				'object_type' => [
					'sanitize' => 'sanitize_text_field',
					'escape' => 'esc_attr',
				],
				'loading_strategy' => [
					'sanitize' => 'sanitize_key',
					'escape' => 'esc_attr',
				],
				'object_3d_id' => [
					'sanitize' => [ $this, 'sanitize_nullable_int' ],
					'escape' => [ $this, 'sanitize_nullable_int' ],
				],
				'target_object_id' => [
					'sanitize' => 'sanitize_text_field',
					'escape' => 'esc_attr',
				],
				'attachment_id' => [
					'sanitize' => [ $this, 'sanitize_nullable_int' ],
					'escape' => [ $this, 'sanitize_nullable_int' ],
				],
				'mode' => [
					'sanitize' => 'sanitize_key',
					'escape' => 'esc_attr',
				],
				'preset' => [
					'sanitize' => 'sanitize_key',
					'escape' => 'esc_attr',
				],
				'custom_hdr_url' => [
					'sanitize' => 'esc_url_raw',
					'escape' => [ $this, 'esc_url' ],
				],
				'intensity' => [
					'sanitize' => 'floatval',
					'escape' => 'floatval',
				],
				'blur' => [
					'sanitize' => 'floatval',
					'escape' => 'floatval',
				],
				'orbit_min_polar_angle' => [
					'sanitize' => 'floatval',
					'escape' => 'floatval',
				],
				'orbit_max_polar_angle' => [
					'sanitize' => 'floatval',
					'escape' => 'floatval',
				],
				'orbit_min_azimuth_angle' => [
					'sanitize' => 'floatval',
					'escape' => 'floatval',
				],
				'orbit_max_azimuth_angle' => [
					'sanitize' => 'floatval',
					'escape' => 'floatval',
				],
				'orbit_min_distance' => [
					'sanitize' => [ $this, 'sanitize_nullable_float' ],
					'escape' => [ $this, 'sanitize_nullable_float' ],
				],
				'orbit_max_distance' => [
					'sanitize' => [ $this, 'sanitize_nullable_float' ],
					'escape' => [ $this, 'sanitize_nullable_float' ],
				],
				'orbit_zoom_limits_enabled' => [
					'sanitize' => 'boolean',
					'escape' => 'boolean',
				],
				// settings_3d: background, ground, renderer
				'color' => [
					'sanitize' => 'sanitize_text_field',
					'escape' => 'esc_attr',
				],
				'enabled' => [
					'sanitize' => 'boolean',
					'escape' => 'boolean',
				],
				'size' => [
					'sanitize' => 'floatval',
					'escape' => 'floatval',
				],
				'shadow_opacity' => [
					'sanitize' => 'floatval',
					'escape' => 'floatval',
				],
				'shadow_blur' => [
					'sanitize' => 'floatval',
					'escape' => 'floatval',
				],
				'shadow_general' => [
					'sanitize' => 'floatval',
					'escape' => 'floatval',
				],
				'shadow_contact' => [
					'sanitize' => 'floatval',
					'escape' => 'floatval',
				],
				'shadow_offset' => [
					'sanitize' => 'floatval',
					'escape' => 'floatval',
				],
				'shadow_mode' => [
					'sanitize' => 'sanitize_key',
					'escape' => 'esc_attr',
				],
				'shadow_catcher' => [
					'sanitize' => 'boolean',
					'escape' => 'boolean',
				],
				'shadow_light' => [
					'sanitize' => 'boolean',
					'escape' => 'boolean',
				],
				'shadow_elevation' => [
					'sanitize' => 'floatval',
					'escape' => 'floatval',
				],
				'shadow_azimuth' => [
					'sanitize' => 'floatval',
					'escape' => 'floatval',
				],
				'enable_shadows' => [
					'sanitize' => 'boolean',
					'escape' => 'boolean',
				],
				'extend_under_toolbar' => [
					'sanitize' => 'boolean',
					'escape' => 'boolean',
				],
				'tone_mapping' => [
					'sanitize' => 'sanitize_key',
					'escape' => 'esc_attr',
				],
				'exposure' => [
					'sanitize' => 'floatval',
					'escape' => 'floatval',
				],
				'output_color_space' => [
					'sanitize' => 'sanitize_key',
					'escape' => 'esc_attr',
				],
				'alpha' => [
					'sanitize' => 'boolean',
					'escape' => 'boolean',
				],
				// settings_3d: postprocessing
				'ssr' => [
					'sanitize' => 'boolean',
					'escape' => 'boolean',
				],
				'ssao' => [
					'sanitize' => 'boolean',
					'escape' => 'boolean',
				],
				'bloom' => [
					'sanitize' => 'boolean',
					'escape' => 'boolean',
				],
				'type' => [
					'sanitize' => 'sanitize_text_field',
					'escape' => 'esc_attr',
				],
				'cast_shadow' => [
					'sanitize' => 'boolean',
					'escape' => 'boolean',
				],
				'cast_shadows' => [
					'sanitize' => 'boolean',
					'escape' => 'boolean',
				],
				'animation_target_model' => [
					'sanitize' => 'sanitize_text_field',
					'escape' => 'esc_attr',
				],
				'animation_clips' => [
					'sanitize' => [ __CLASS__, 'sanitize_animation_clips' ],
					'escape' => [ __CLASS__, 'escape_animation_clips' ],
				],
				'animation_triggers_enter' => [
					'sanitize' => [ __CLASS__, 'sanitize_animation_triggers' ],
					'escape' => [ __CLASS__, 'escape_animation_triggers' ],
				],
				'animation_triggers_leave' => [
					'sanitize' => [ __CLASS__, 'sanitize_animation_triggers' ],
					'escape' => [ __CLASS__, 'escape_animation_triggers' ],
				],
				'animation_object_id' => [
					'sanitize' => [ $this, 'sanitize_nullable_int' ],
					'escape' => [ $this, 'sanitize_nullable_int' ],
				],
				'clip_name' => [
					'sanitize' => 'sanitize_text_field',
					'escape' => 'esc_attr',
				],
				'loop_mode' => [
					'sanitize' => 'sanitize_key',
					'escape' => 'esc_attr',
				],
				'repetitions' => [
					'sanitize' => 'floatval',
					'escape' => 'floatval',
				],
				'clamp_when_finished' => [
					'sanitize' => 'boolean',
					'escape' => 'boolean',
				],
				'speed' => [
					'sanitize' => 'floatval',
					'escape' => 'floatval',
				],
				'fade_in_ms' => [
					'sanitize' => 'floatval',
					'escape' => 'floatval',
				],
				'fade_out_ms' => [
					'sanitize' => 'floatval',
					'escape' => 'floatval',
				],
				'command' => [
					'sanitize' => 'sanitize_key',
					'escape' => 'esc_attr',
				],
				// actions_3d: material registry actions
				'material_name' => [
					'sanitize' => 'sanitize_text_field',
					'escape' => 'esc_attr',
				],
				'material_texture_material_name' => [
					'sanitize' => 'sanitize_text_field',
					'escape' => 'esc_attr',
				],
				'material_registry_color' => [
					'sanitize' => 'sanitize_text_field',
					'escape' => 'esc_attr',
				],
				'material_property_name' => [
					'sanitize' => 'mkl_pc_sanitize_3d_material_property_name',
					'escape' => 'esc_attr',
				],
				'material_property_value' => [
					'sanitize' => 'sanitize_text_field',
					'escape' => 'esc_attr',
				],
			],
			$this
		);
	}
	
	/**
	 * Sanitize the data
	 *
	 * @param mixed  $data - The data to sanitize
	 * @param string $key
	 * @return mixed
	 */
	public function sanitize( $data, $the_key = '' ) {
		return $this->_sanitize_or_escape( 'sanitize', $data, $the_key );
	}

	/**
	 * Escape the data
	 *
	 * @param mixed  $data - The data to escape
	 * @param string $key
	 * @return mixed
	 */
	public function escape( $data, $the_key = '' ) {
		return $this->_sanitize_or_escape( 'escape', $data, $the_key );
	}

	public function esc_url( $url ) {
		if ( is_ssl() ) $url = str_ireplace( 'http://', 'https://', $url );
		$url = esc_url( $url );
		return $url;
	}

	public function sanitize_image( $image ) {
		// Image IDs
		if ( is_int( $image ) ) return intval( $image );
		// Temporary image names
		if ( is_string( $image ) && ! strpos( $image, '.' ) ) return sanitize_key( $image );
		// Other images (assumed to be urls)
		return esc_url_raw( $image );
	}

	/**
	 * Sanitize value as int or null (for optional IDs / limits).
	 *
	 * @param mixed $data
	 * @return int|null
	 */
	/**
	 * Sanitize the hidden object names textarea (one name per line).
	 *
	 * @param mixed $data Raw value (string or array).
	 * @return string Newline-separated list of sanitized names.
	 */
	public static function sanitize_hidden_object_names_textarea( $data ) {
		if ( ! is_string( $data ) && ! is_array( $data ) ) {
			return '';
		}
		if ( is_array( $data ) ) {
			$data = implode( "\n", $data );
		}
		$lines = preg_split( '/[\r\n]+/', $data, -1, PREG_SPLIT_NO_EMPTY );
		$lines = array_map( 'sanitize_text_field', $lines );
		$lines = array_filter( $lines );
		return implode( "\n", $lines );
	}

	/**
	 * Sanitize camera_focus_object_ids (array of object id strings per angle).
	 *
	 * @param mixed $data Array of strings or single value.
	 * @return array Sanitized array of strings.
	 */
	public static function sanitize_camera_focus_object_ids( $data ) {
		if ( ! is_array( $data ) ) {
			$data = $data === null || $data === '' ? [] : (array) $data;
		}
		$out = array_map( 'sanitize_text_field', $data );
		return array_values( array_filter( $out ) );
	}

	/**
	 * Escape camera_focus_object_ids for output (e.g. HTML attributes).
	 *
	 * @param mixed $data Array of strings.
	 * @return array Escaped array of strings.
	 */
	public static function escape_camera_focus_object_ids( $data ) {
		if ( ! is_array( $data ) ) {
			return [];
		}
		return array_map( 'esc_attr', $data );
	}

	/**
	 * Sanitize animation clip configuration array.
	 *
	 * @param mixed $data
	 * @return array
	 */
	public static function sanitize_animation_clips( $data ) {
		if ( ! is_array( $data ) ) return [];
		$out = [];
		foreach ( $data as $item ) {
			if ( ! is_array( $item ) ) continue;
			$clip_name = isset( $item['clip_name'] ) ? sanitize_text_field( $item['clip_name'] ) : '';
			if ( '' === $clip_name ) continue;
			$out[] = [
				'clip_name' => $clip_name,
				'loop_mode' => isset( $item['loop_mode'] ) ? sanitize_key( $item['loop_mode'] ) : 'once',
				'repetitions' => isset( $item['repetitions'] ) ? floatval( $item['repetitions'] ) : 1,
				'clamp_when_finished' => ! empty( $item['clamp_when_finished'] ),
				'speed' => isset( $item['speed'] ) ? floatval( $item['speed'] ) : 1,
				'fade_in_ms' => isset( $item['fade_in_ms'] ) ? floatval( $item['fade_in_ms'] ) : 0,
				'fade_out_ms' => isset( $item['fade_out_ms'] ) ? floatval( $item['fade_out_ms'] ) : 0,
			];
		}
		return $out;
	}

	/**
	 * Escape animation clip configuration array.
	 *
	 * @param mixed $data
	 * @return array
	 */
	public static function escape_animation_clips( $data ) {
		if ( ! is_array( $data ) ) return [];
		return array_map(
			function( $item ) {
				if ( ! is_array( $item ) ) return [];
				return [
					'clip_name' => isset( $item['clip_name'] ) ? esc_attr( $item['clip_name'] ) : '',
					'loop_mode' => isset( $item['loop_mode'] ) ? esc_attr( $item['loop_mode'] ) : 'once',
					'repetitions' => isset( $item['repetitions'] ) ? floatval( $item['repetitions'] ) : 1,
					'clamp_when_finished' => ! empty( $item['clamp_when_finished'] ),
					'speed' => isset( $item['speed'] ) ? floatval( $item['speed'] ) : 1,
					'fade_in_ms' => isset( $item['fade_in_ms'] ) ? floatval( $item['fade_in_ms'] ) : 0,
					'fade_out_ms' => isset( $item['fade_out_ms'] ) ? floatval( $item['fade_out_ms'] ) : 0,
				];
			},
			$data
		);
	}

	/**
	 * Sanitize angle animation trigger array.
	 *
	 * @param mixed $data
	 * @return array
	 */
	public static function sanitize_animation_triggers( $data ) {
		if ( ! is_array( $data ) ) return [];
		$out = [];
		foreach ( $data as $item ) {
			if ( ! is_array( $item ) ) continue;
			$animation_object_id = isset( $item['animation_object_id'] ) ? intval( $item['animation_object_id'] ) : 0;
			if ( $animation_object_id <= 0 ) continue;
			$out[] = [
				'animation_object_id' => $animation_object_id,
				'command' => isset( $item['command'] ) ? sanitize_key( $item['command'] ) : 'play',
				'speed' => isset( $item['speed'] ) ? floatval( $item['speed'] ) : 1,
				'fade_in_ms' => isset( $item['fade_in_ms'] ) ? floatval( $item['fade_in_ms'] ) : 0,
				'fade_out_ms' => isset( $item['fade_out_ms'] ) ? floatval( $item['fade_out_ms'] ) : 0,
			];
		}
		return $out;
	}

	/**
	 * Escape angle animation trigger array.
	 *
	 * @param mixed $data
	 * @return array
	 */
	public static function escape_animation_triggers( $data ) {
		if ( ! is_array( $data ) ) return [];
		return array_map(
			function( $item ) {
				if ( ! is_array( $item ) ) return [];
				return [
					'animation_object_id' => isset( $item['animation_object_id'] ) ? intval( $item['animation_object_id'] ) : 0,
					'command' => isset( $item['command'] ) ? esc_attr( $item['command'] ) : 'play',
					'speed' => isset( $item['speed'] ) ? floatval( $item['speed'] ) : 1,
					'fade_in_ms' => isset( $item['fade_in_ms'] ) ? floatval( $item['fade_in_ms'] ) : 0,
					'fade_out_ms' => isset( $item['fade_out_ms'] ) ? floatval( $item['fade_out_ms'] ) : 0,
				];
			},
			$data
		);
	}

	public function sanitize_nullable_int( $data ) {
		if ( $data === null || $data === '' || $data === false ) {
			return null;
		}
		return intval( $data );
	}

	/**
	 * Sanitize value as float or null (for optional numeric limits).
	 *
	 * @param mixed $data
	 * @return float|null
	 */
	public function sanitize_nullable_float( $data ) {
		if ( $data === null || $data === '' || $data === false ) {
			return null;
		}
		return floatval( $data );
	}

	public function esc_image( $image ) {
		if ( is_int( $image ) ) return intval( $image );
		return $this->esc_url( $image );
	}

	public function escape_description( $description ) {
		return wp_kses_post( stripslashes( $description ) );
	}
	
	public function sanitize_description( $description ) {
		return wp_kses( stripslashes( $description ), 'post' );
	}

	public function sanitize_custom_html_description( $html ) {
		$tags = wp_kses_allowed_html( 'post' );
		if ( ! isset( $tags[ 'svg' ] ) ) {
			$tags['svg'] = array(
				'xmlns' => array(),
				'fill' => array(),
				'viewbox' => array(),
				'role' => array(),
				'aria-hidden' => array(),
				'focusable' => array(),
				'width' => array(),
				'height' => array(),
				'class' => array(),
				'id' => array(),
			);
			$tags['path'] = array(
				'd' => array(),
				'fill' => array(),
				'stroke' => array(),
				'stroke-width' => array(),
				'text' => array(),
				'class' => array(),
				'transform' => array(),
				'data-layer_id' => array(),
				'id' => array(),
			);
			$tags['line'] = array(
				'x1' => array(),
				'y1' => array(),
				'x2' => array(),
				'y2' => array(),
				'class' => array(),
				'fill' => array(),
				'stroke' => array(),
				'stroke-width' => array(),
				'transform' => array(),
				'data-layer_id' => array(),
				'id' => array(),
			);			
			$tags['rect'] = array(
				'x' => array(),
				'y' => array(),
				'width' => array(),
				'height' => array(),
				'class' => array(),
				'fill' => array(),
				'stroke' => array(),
				'stroke-width' => array(),
				'transform' => array(),
				'data-layer_id' => array(),
				'id' => array(),
			);

			$tags['circle'] = array(
				'cx' => array(),
				'cy' => array(),
				'r' => array(),
				'class' => array(),
				'fill' => array(),
				'stroke' => array(),
				'stroke-width' => array(),
				'transform' => array(),
				'data-layer_id' => array(),
				'id' => array(),
			);
			$tags['ellipse'] = array(
				'cx' => array(),
				'cy' => array(),
				'rx' => array(),
				'ry' => array(),
				'class' => array(),
				'fill' => array(),
				'stroke' => array(),
				'stroke-width' => array(),
				'transform' => array(),
				'data-layer_id' => array(),
				'id' => array(),
			);
			$tags['text'] = array(
				'transform' => array(),
				'style' => array('fill', 'font-size'),
				'class' => array(),
				'id' => array(),
			);
			$tags['defs'] = array();
			$tags['style'] = array();
		}

		/**
		 * Filters the allowed tags in the custom html fields.
		 * @default - tags allowed in Post content + svg
		 */
		$allowed_tags = apply_filters( 'mkl_pc/custom_html/allowed_tags', $tags );
		$r = wp_kses( $html, $allowed_tags );
		return $r;
	}

	public function escape_custom_html_description( $html ) {
		return $this->sanitize_custom_html_description( stripslashes( $html ) );
	}

	/**
	 * Scan and fix images (per-layer chunks for content and layers).
	 */
	public function scan_product_images( $product_id ) {
		$product = $this->get_owner( $product_id );
		if ( ! $product ) {
			return $this->changed_items_count;
		}

		$index = $this->get_layers_index( $product_id );
		if ( false === $index || ! is_array( $index ) ) {
			$layers = $this->get( 'layers', $product_id );
			$index = is_array( $layers ) ? array_filter( array_map( function ( $l ) {
				return isset( $l['_id'] ) ? (int) $l['_id'] : null;
			}, $layers ) ) : array();
		}

		// Update content per layer chunk
		foreach ( $index as $layer_id ) {
			$layer_id = (int) $layer_id;
			if ( ! $layer_id ) continue;
			$item = $this->get_content_layer( $product_id, $layer_id );
			if ( empty( $item ) || ! is_array( $item['choices'] ) ) continue;
			$changed = false;
			foreach ( $item['choices'] as $choice_key => $choice ) {
				if ( ! isset( $choice['images'] ) || ! is_array( $choice['images'] ) ) continue;
				foreach ( $choice['images'] as $ik => $image ) {
					if ( isset( $image['image'] ) && ! empty( $image['image']['url'] ) ) {
						$new_image_id = $this->_find_image_id( $image['image']['url'], isset( $image['image']['id'] ) ? $image['image']['id'] : 0 );
						$new_url = wp_get_attachment_url( $new_image_id );
						if ( $new_image_id && ( ! isset( $image['image']['id'] ) || $new_image_id != $image['image']['id'] ) || $new_url != $image['image']['url'] ) {
							$item['choices'][ $choice_key ]['images'][ $ik ]['image']['id'] = $new_image_id;
							$item['choices'][ $choice_key ]['images'][ $ik ]['image']['url'] = $new_url;
							$changed = true;
						}
					}
					if ( isset( $image['thumbnail'] ) && ! empty( $image['thumbnail']['url'] ) ) {
						$new_thumbnail_id = $this->_find_image_id( $image['thumbnail']['url'], isset( $image['thumbnail']['id'] ) ? $image['thumbnail']['id'] : 0 );
						if ( $new_thumbnail_id && ( ! isset( $image['thumbnail']['id'] ) || $new_thumbnail_id != $image['thumbnail']['id'] ) ) {
							$item['choices'][ $choice_key ]['images'][ $ik ]['thumbnail']['id'] = $new_thumbnail_id;
							$item['choices'][ $choice_key ]['images'][ $ik ]['thumbnail']['url'] = wp_get_attachment_url( $new_thumbnail_id );
							$changed = true;
						}
					}
				}
			}
			if ( $changed ) {
				$this->set_content_layer( $product_id, $layer_id, $item );
			}
		}

		// Update angles (single meta)
		$angles = $this->get( 'angles', $product_id );
		if ( is_array( $angles ) ) {
			foreach ( $angles as $key => $angle ) {
				if ( isset( $angle['image'] ) && ! empty( $angle['image']['url'] ) ) {
					$new_angle_id = $this->_find_image_id( $angle['image']['url'], isset( $angle['image']['id'] ) ? $angle['image']['id'] : 0 );
					if ( $new_angle_id && ( ! isset( $angle['image']['id'] ) || $new_angle_id != $angle['image']['id'] ) ) {
						$angles[ $key ]['image']['id'] = $new_angle_id;
						$angles[ $key ]['image']['url'] = wp_get_attachment_url( $new_angle_id );
					}
				}
			}
			$this->set( $product_id, $product_id, 'angles', $angles );
		}

		// Update layers per chunk
		foreach ( $index as $layer_id ) {
			$layer_id = (int) $layer_id;
			if ( ! $layer_id ) continue;
			$chunk = $product->get_meta( '_mkl_product_configurator_layer_' . $layer_id );
			if ( '' === $chunk ) {
				$layers = $this->get( 'layers', $product_id );
				if ( is_array( $layers ) ) {
					foreach ( $layers as $layer ) {
						if ( isset( $layer['_id'] ) && (int) $layer['_id'] === $layer_id ) {
							$chunk = $layer;
							break;
						}
					}
				}
			} else {
				$chunk = maybe_unserialize( $chunk );
				if ( is_string( $chunk ) ) {
					$chunk = $this->decode_stored_json( $chunk );
				}
			}
			if ( empty( $chunk ) || ! is_array( $chunk ) ) continue;
			if ( isset( $chunk['image'] ) && ! empty( $chunk['image']['url'] ) ) {
				$new_layer_id = $this->_find_image_id( $chunk['image']['url'], isset( $chunk['image']['id'] ) ? $chunk['image']['id'] : 0 );
				if ( $new_layer_id && ( ! isset( $chunk['image']['id'] ) || $new_layer_id != $chunk['image']['id'] ) ) {
					$chunk['image']['id'] = $new_layer_id;
					$chunk['image']['url'] = wp_get_attachment_url( $new_layer_id );
					if ( ! $this->write_structured_meta( $product, '_mkl_product_configurator_layer_' . $layer_id, $chunk ) ) {
						continue;
					}
					$product->save();
					do_action( 'wpml_sync_custom_field', $product_id, '_mkl_product_configurator_layer_' . $layer_id );
				}
			}
		}

		return $this->changed_items_count;
	}

	/**
	 * Find a matching ID for a specific URL
	 *
	 * @param string  $url
	 * @param integer $original_id
	 * @return integer
	 */
	private function _find_image_id( $url, $original_id, $exact_match = false ) {
		// Check if original ID matches
		if ( wp_get_attachment_url( $original_id ) == $url ) return $original_id;

		// Search for the URL
		if ( $exact_match ) {
			// Search for an item with the exact url (e.g. 2021/10/image.png)
			$matching_image = attachment_url_to_postid( $url );
		} else {
			// Search for an item with the exact name only (e.g. /image.png)
			$matching_image = $this->_attachment_filename_to_postid( $url );
		}
		if ( $matching_image ) {
			$this->changed_items_count++;
			return $matching_image;
		}
		return $original_id;
	}

	/**
	 * Similar to attachment_url_to_postid, but using the file name only, ignoring the folder structure.
	 * Useful after migrating a configuration later in time
	 */
	private function _attachment_filename_to_postid( $url ) {
		global $wpdb;

		$image_path = pathinfo( $url );
	
		// Force the protocols to match if needed.
		if ( ! isset( $image_path['basename'] ) ) return false;
		
		$results = $wpdb->get_results( 
			$wpdb->prepare(
				"SELECT post_id, meta_value FROM $wpdb->postmeta WHERE meta_key = '_wp_attached_file' AND meta_value LIKE %s",
				'%/'.$image_path['basename']
			)
		); // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Fallback lookup by filename after a site migration; WP has no API for this.
		$post_id = null;
	
		if ( $results ) {
			// Use the first available result, but prefer a case-sensitive match, if exists.
			$post_id = reset( $results )->post_id;

			if ( count( $results ) > 1 ) {
				// Look for exact match
				$exact_id = attachment_url_to_postid( $url );
				if ( $exact_id ) $post_id = $exact_id;
			}
		}

		return $post_id ? $post_id : false;
	}

	/**
	 * Sanitize the data
	 *
	 * @param mixed  $action - The action to do
	 * @param mixed  $data   - The data to sanitize
	 * @param string $key
	 * @return mixed
	 */
	private function _sanitize_or_escape( $action, $data, $the_key = '' ) {
		$data_type = gettype( $data );
		if ( 'array' === $data_type ) {
			foreach ( $data as $key => $value ) {
				$data[$key] = $this->_sanitize_or_escape( $action, $value, $key );
			}
			return $data;
		}

		if ( 'object' === $data_type ) {
			foreach ( (array) $data as $key => $value ) {
				$data->{$key} = $this->_sanitize_or_escape( $action, $value, $key );
			}
			return $data;
		}

		
		$supported_fields = $this->get_fields();

		// No key is set, we treat as a text field.
		if ( ! $the_key ) {
			return $this->default_sanitize_or_escape( $action, $data );
		}

		// Unknown field keys still go through the text default so add-on data is not left raw.
		if ( ! in_array( $the_key, array_keys( $supported_fields ), true ) ) {
			return $this->default_sanitize_or_escape( $action, $data );
		}

		// Field exists but has no callback for this action.
		if ( ! isset( $supported_fields[ $the_key ][ $action ] ) ) {
			return $this->default_sanitize_or_escape( $action, $data );
		}

		if ( is_callable( $supported_fields[ $the_key ][ $action ] ) ) {
			$data = call_user_func( $supported_fields[ $the_key ][ $action ], $data );
			return $data;
		}

		if ( 'boolean' == $supported_fields[ $the_key ][ $action ] ) {
			return filter_var( $data, FILTER_VALIDATE_BOOLEAN );
		}

		if ( function_exists( 'wc_get_logger' ) ) {
			wc_get_logger()->warning(
				sprintf(
					'MKL Product Configurator: sanitization could not be done for the variable %s (empty string returned instead).',
					$the_key
				),
				array( 'source' => 'mkl-pc' )
			);
		}
		return '';
	}

	/**
	 * Default sanitization / escaping when a field has no dedicated callback.
	 *
	 * @param string $action 'sanitize' or 'escape'.
	 * @param mixed  $data   Scalar value.
	 * @return string
	 */
	private function default_sanitize_or_escape( $action, $data ) {
		if ( 'escape' === $action ) {
			return esc_html( $data );
		}
		return sanitize_text_field( $data );
	}

	public function get_context() {
		return $this->context;
	}

	public function set_context( $c) {
		return $this->context = $c;
	}
}
