<?php

namespace MKL\PC;


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
		$parent = wc_get_product( (int) $parent_id );
		if ( ! $parent || ! is_a( $parent, 'WC_Product' ) ) {
			return;
		}
		$parent->update_meta_data( self::META_INTEGRITY_CACHE, (int) $value );
		$parent->save();
		do_action( 'wpml_sync_custom_field', (int) $parent_id, self::META_INTEGRITY_CACHE );
	}

	/**
	 * @param \WC_Product $product
	 * @return array<int, array<string, mixed>>|array{}
	 */
	private function get_legacy_layers_blob_array( $product ) {
		if ( ! $product || ! is_a( $product, 'WC_Product' ) ) {
			return array();
		}
		$data = $product->get_meta( '_mkl_product_configurator_layers', true );
		if ( '' === $data || false === $data ) {
			return array();
		}
		$data = maybe_unserialize( $data );
		if ( is_string( $data ) ) {
			$data = json_decode( stripslashes( $data ), true );
		}
		return is_array( $data ) ? $data : array();
	}

	/**
	 * @param \WC_Product $product
	 * @return array<int, array<string, mixed>>|array{}
	 */
	private function get_legacy_content_blob_array( $product ) {
		if ( ! $product || ! is_a( $product, 'WC_Product' ) ) {
			return array();
		}
		$data = $product->get_meta( '_mkl_product_configurator_content', true );
		if ( '' === $data || false === $data ) {
			return array();
		}
		$data = maybe_unserialize( $data );
		if ( is_string( $data ) ) {
			$data = json_decode( stripslashes( $data ), true );
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
	 * @param array $legacy_content
	 * @param int   $layer_id
	 * @return bool
	 */
	private function content_row_exists_in_legacy_content_array( $legacy_content, $layer_id ) {
		foreach ( $legacy_content as $row ) {
			if ( is_array( $row ) && isset( $row['layerId'] ) && (int) $row['layerId'] === (int) $layer_id ) {
				return true;
			}
		}
		return false;
	}

	/**
	 * Whether this layer is expected to have a content row (choices UI).
	 *
	 * @param array    $layer_row Layer attributes (from chunk or legacy blob).
	 * @param int|null $layer_id  For filters.
	 * @return bool
	 */
	private function layer_requires_content_row( $layer_row, $layer_id = null ) {
		if ( ! is_array( $layer_row ) ) {
			return true;
		}
		$nac = isset( $layer_row['not_a_choice'] ) ? $layer_row['not_a_choice'] : false;
		if ( true === $nac || 1 === $nac || '1' === $nac || 'true' === $nac ) {
			return false;
		}
		$type = isset( $layer_row['type'] ) ? strtolower( (string) $layer_row['type'] ) : 'simple';
		if ( 'group' === $type ) {
			return false;
		}
		return (bool) apply_filters( 'mkl_pc_layer_requires_content_row', true, $layer_row, $layer_id );
	}

	/**
	 * Layer definition from chunked meta, else from legacy layers array.
	 *
	 * @param \WC_Product $parent
	 * @param int         $layer_id
	 * @param bool        $has_legacy_l
	 * @param array       $legacy_layers
	 * @return array<string, mixed>|null
	 */
	private function get_layer_row_for_integrity( $parent, $layer_id, $has_legacy_l, $legacy_layers ) {
		$raw = $parent->get_meta( '_mkl_product_configurator_layer_' . $layer_id, true );
		$raw = maybe_unserialize( $raw );
		if ( is_string( $raw ) ) {
			$raw = json_decode( stripslashes( $raw ), true );
		}
		if ( is_array( $raw ) && isset( $raw['_id'] ) ) {
			return $raw;
		}
		if ( $has_legacy_l ) {
			foreach ( $legacy_layers as $row ) {
				if ( is_array( $row ) && isset( $row['_id'] ) && (int) $row['_id'] === (int) $layer_id ) {
					return $row;
				}
			}
		}
		return null;
	}

	/**
	 * Quick status labels when integrity cache says OK (avoid re-reading all chunks).
	 *
	 * @param int $parent_id
	 * @param int $variation_id
	 * @return array{layers_status:string,content_status:string}
	 */
	private function classify_storage_statuses_for_cache_hit( $parent_id, $variation_id ) {
		$parent = wc_get_product( $parent_id );
		if ( ! $parent ) {
			return array(
				'layers_status'  => 'empty',
				'content_status' => 'empty',
			);
		}
		$has_legacy_l = $this->legacy_layers_blob_is_non_empty( $parent );
		$layers_chunk = false !== $this->get_layers_chunked( $parent_id, $parent );
		$layers_st    = 'empty';
		if ( $has_legacy_l && ! $layers_chunk ) {
			$layers_st = 'legacy';
		} elseif ( $has_legacy_l && $layers_chunk ) {
			$layers_st = 'mixed';
		} elseif ( $layers_chunk ) {
			$layers_st = 'chunked';
		}

		$content_pid = $this->get_product_id_for_content( $parent_id, $variation_id );
		$content_p   = wc_get_product( $content_pid );
		$content_st  = 'empty';
		if ( $content_p ) {
			$has_legacy_c = $this->legacy_content_blob_is_non_empty( $content_p );
			$content_ch   = false !== $this->get_content_chunked( $content_pid, $content_p );
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
		$product = wc_get_product( $product_id );
		if ( ! $product || ! is_a( $product, 'WC_Product' ) ) {
			return false;
		}
		$index = $product->get_meta( '_mkl_product_configurator_layers_index' );
		$index = maybe_unserialize( $index );
		if ( is_string( $index ) ) {
			$index = json_decode( stripslashes( $index ), true );
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

		$cache_key = "mkl_pc_data_{$that}_{$product_id}";
		$cached = wp_cache_get( $cache_key, 'mkl_pc' );
		if ( false !== $cached ) {
			return $cached;
		}
		if ( ! $this->is_product( $product_id ) ) return false;

		$product = wc_get_product( $product_id );

		if ( ! $product || ! is_a( $product, 'WC_Product' ) ) return false;

		if ( 'layers' === $that ) {
			$data = $this->get_layers_chunked( $product_id, $product );
			if ( false === $data ) {
				$data = $this->get_legacy_meta( $product, '_mkl_product_configurator_layers' );
			}
		} elseif ( 'content' === $that ) {
			$data = $this->get_content_chunked( $product_id, $product );
			if ( false === $data ) {
				$data = $this->get_legacy_meta( $product, '_mkl_product_configurator_content' );
			}
		} else {
			$data = $this->get_legacy_meta( $product, '_mkl_product_configurator_' . $that );
		}

		if ( '' == $data || false == $data ) {
			return false;
		}

		/**
		 * Filters the data fetched using the Get method
		 *
		 * @param $data       - The data filtered
		 * @param $that       - The slug of the meta data fetched - e.g 'content', 'angles', 'layers'...
		 * @param $product_id - The product ID
		 */
		$data = apply_filters( 'mkl_pc/db/get', $data, $that, $product_id );
		wp_cache_set( $cache_key, $data, 'mkl_pc', 3600 );
		return $data;
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
			$data = json_decode( stripslashes( $data ), true );
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
			$index = json_decode( stripslashes( $index ), true );
		}
		if ( ! is_array( $index ) || empty( $index ) ) {
			return false;
		}
		$layers = array();
		foreach ( $index as $layer_id ) {
			$chunk = $product->get_meta( '_mkl_product_configurator_layer_' . $layer_id );
			$chunk = maybe_unserialize( $chunk );
			if ( is_string( $chunk ) ) {
				$chunk = json_decode( stripslashes( $chunk ), true );
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
			$index = json_decode( stripslashes( $index ), true );
		}
		if ( ! is_array( $index ) || empty( $index ) ) {
			return false;
		}
		$content = array();
		foreach ( $index as $layer_id ) {
			$chunk = $product->get_meta( '_mkl_product_configurator_content_' . $layer_id );
			$chunk = maybe_unserialize( $chunk );
			if ( is_string( $chunk ) ) {
				$chunk = json_decode( stripslashes( $chunk ), true );
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
	 * Read layers index array from a product meta (no cache).
	 *
	 * @param \WC_Product $product
	 * @return int[]
	 */
	private function read_layers_index_array( $product ) {
		if ( ! $product || ! is_a( $product, 'WC_Product' ) ) {
			return array();
		}
		$index = $product->get_meta( '_mkl_product_configurator_layers_index', true );
		$index = maybe_unserialize( $index );
		if ( is_string( $index ) ) {
			$index = json_decode( stripslashes( $index ), true );
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
	 * @param \WC_Product $product
	 * @return bool
	 */
	private function legacy_layers_blob_is_non_empty( $product ) {
		if ( ! $product || ! is_a( $product, 'WC_Product' ) ) {
			return false;
		}
		$data = $product->get_meta( '_mkl_product_configurator_layers', true );
		if ( '' === $data || false === $data ) {
			return false;
		}
		$data = maybe_unserialize( $data );
		if ( is_string( $data ) ) {
			$data = json_decode( stripslashes( $data ), true );
		}
		return is_array( $data ) && count( $data ) > 0;
	}

	/**
	 * Whether legacy content blob meta holds a non-empty array.
	 *
	 * @param \WC_Product $product
	 * @return bool
	 */
	private function legacy_content_blob_is_non_empty( $product ) {
		if ( ! $product || ! is_a( $product, 'WC_Product' ) ) {
			return false;
		}
		$data = $product->get_meta( '_mkl_product_configurator_content', true );
		if ( '' === $data || false === $data ) {
			return false;
		}
		$data = maybe_unserialize( $data );
		if ( is_string( $data ) ) {
			$data = json_decode( stripslashes( $data ), true );
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
		);
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
	 * Full integrity check for chunked layers + content storage (parent + content product).
	 *
	 * Uses {@see self::META_INTEGRITY_CACHE}: when 1 and $force_refresh is false, returns a cached OK result with fresh status labels.
	 * When no legacy blobs exist on parent (layers) and content product, integrity is considered OK without requiring every optional content chunk.
	 * When legacy exists, missing chunked rows may be satisfied by matching entries in the legacy arrays.
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
		$parent       = wc_get_product( $parent_id );
		if ( ! $parent || ! is_a( $parent, 'WC_Product' ) ) {
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
		$content_product    = wc_get_product( $content_product_id );
		$legacy_c_array     = ( $content_product && is_a( $content_product, 'WC_Product' ) )
			? $this->get_legacy_content_blob_array( $content_product )
			: array();
		$has_legacy_c       = count( $legacy_c_array ) > 0;

		if ( ! $content_product || ! is_a( $content_product, 'WC_Product' ) ) {
			$issues[] = 'invalid_content_product';
		}

		$parent_index        = $this->read_layers_index_array( $parent );
		$layers_chunked_data = $this->get_layers_chunked( $parent_id, $parent );

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
					$raw = json_decode( stripslashes( $raw ), true );
				}
				$chunk_ok = is_array( $raw ) && isset( $raw['_id'] ) && (int) $raw['_id'] === (int) $layer_id;
				if ( ! $chunk_ok && ! $this->layer_id_exists_in_legacy_layers_array( $legacy_l_array, $layer_id ) ) {
					$layers_ok = false;
					$issues[]  = 'invalid_layer_chunk:' . (int) $layer_id;
				}
			}
			if ( $layers_ok && false !== $layers_chunked_data ) {
				$orphans = $this->find_orphan_chunk_meta_keys( $parent_id, $parent_index, '_mkl_product_configurator_layer_' );
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
			$content_data   = $this->get_content_chunked( $content_product_id, $content_product );
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
							$raw = json_decode( stripslashes( $raw ), true );
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
					foreach ( $content_index as $layer_id ) {
						$raw = $content_product->get_meta( '_mkl_product_configurator_content_' . $layer_id, true );
						$raw = maybe_unserialize( $raw );
						if ( is_string( $raw ) ) {
							$raw = json_decode( stripslashes( $raw ), true );
						}
						$chunk_ok = is_array( $raw ) && isset( $raw['layerId'] ) && (int) $raw['layerId'] === (int) $layer_id;
						if ( $chunk_ok ) {
							continue;
						}
						$layer_row = $this->get_layer_row_for_integrity( $parent, $layer_id, $has_legacy_l, $legacy_l_array );
						if ( ! $this->layer_requires_content_row( $layer_row, $layer_id ) ) {
							continue;
						}
						if ( $this->content_row_exists_in_legacy_content_array( $legacy_c_array, $layer_id ) ) {
							continue;
						}
						$content_ok = false;
						$issues[]   = 'invalid_content_chunk:' . (int) $layer_id;
					}
					if ( $content_ok && false !== $content_data ) {
						$orphans_c = $this->find_orphan_chunk_meta_keys( $content_product_id, $content_index, '_mkl_product_configurator_content_' );
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
		$parent_id    = (int) $parent_id;
		$variation_id = (int) $variation_id;
		$parent       = wc_get_product( $parent_id );
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
		if ( self::STORAGE_FORMAT_CHUNKED_VERIFIED === $current_version && $integrity_cached >= 1 ) {
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

		$content_product_id = $this->get_product_id_for_content( $parent_id, $variation_id );

		$parent->update_meta_data( self::META_STORAGE_FORMAT_VERSION, self::STORAGE_FORMAT_CHUNKED_VERIFIED );
		$parent->save();
		do_action( 'wpml_sync_custom_field', $parent_id, self::META_STORAGE_FORMAT_VERSION );

		$this->invalidate_layers_cache( $parent_id );
		wp_cache_delete( 'mkl_pc_data_layers_' . $parent_id, 'mkl_pc' );
		wp_cache_delete( 'mkl_pc_data_content_' . $parent_id, 'mkl_pc' );
		wp_cache_delete( 'mkl_pc_layers_index_' . $parent_id, 'mkl_pc' );
		if ( $content_product_id && $content_product_id !== $parent_id ) {
			$this->invalidate_layers_cache( $content_product_id );
			wp_cache_delete( 'mkl_pc_data_content_' . $content_product_id, 'mkl_pc' );
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
	 * @return array
	 */
	public function get_pc_storage_state_for_editor( $parent_id, $variation_id = 0, $skip_deep_verify = false ) {
		$parent_id    = (int) $parent_id;
		$variation_id = (int) $variation_id;
		$parent       = wc_get_product( $parent_id );
		$version      = $parent ? (int) $parent->get_meta( self::META_STORAGE_FORMAT_VERSION, true ) : 0;

		if ( $skip_deep_verify && self::STORAGE_FORMAT_CHUNKED_VERIFIED === $version && $parent ) {
			$integrity_cached = (int) $parent->get_meta( self::META_INTEGRITY_CACHE, true );
			if ( $integrity_cached >= 1 ) {
				$statuses = $this->classify_storage_statuses_for_cache_hit( $parent_id, $variation_id );
				return array(
					'layers'                    => $statuses['layers_status'],
					'content'                   => $statuses['content_status'],
					'storage_format_version'    => $version,
					'integrity_ok'              => true,
					'integrity_issues'          => array(),
					'needs_batch_migration'     => false,
					'needs_format_finalize'     => false,
				);
			}
		}

		$verify     = $this->verify_chunked_storage_integrity( $parent_id, $variation_id );
		$empty_both = ( 'empty' === $verify['layers_status'] && 'empty' === $verify['content_status'] );

		$needs_batch = false;
		if ( ! $empty_both ) {
			if ( in_array( $verify['layers_status'], array( 'legacy', 'mixed' ), true )
				|| in_array( $verify['content_status'], array( 'legacy', 'mixed' ), true ) ) {
				$needs_batch = true;
			} elseif ( ! $verify['ok'] ) {
				$needs_batch = true;
			}
		}

		$needs_finalize = ! $empty_both && $verify['ok'] && self::STORAGE_FORMAT_CHUNKED_VERIFIED !== $version;

		return array(
			'layers'                    => $verify['layers_status'],
			'content'                   => $verify['content_status'],
			'storage_format_version'    => $version,
			'integrity_ok'              => (bool) $verify['ok'],
			'integrity_issues'          => $verify['issues'],
			'needs_batch_migration'     => $needs_batch,
			'needs_format_finalize'     => $needs_finalize,
		);
	}

	/**
	 * Whether legacy single-blob layers and/or content metas still exist (alongside chunked metas or alone).
	 *
	 * @param int $parent_id
	 * @param int $variation_id
	 * @return bool
	 */
	public function has_legacy_configurator_blobs( $parent_id, $variation_id = 0 ) {
		$parent_id = (int) $parent_id;
		$parent     = wc_get_product( $parent_id );
		if ( ! $parent || ! is_a( $parent, 'WC_Product' ) ) {
			return false;
		}
		if ( $this->legacy_layers_blob_is_non_empty( $parent ) ) {
			return true;
		}
		$content_pid = $this->get_product_id_for_content( $parent_id, (int) $variation_id );
		$content_p   = wc_get_product( $content_pid );
		return $content_p && $this->legacy_content_blob_is_non_empty( $content_p );
	}

	/**
	 * Remove legacy blob metas only; chunked layer/content metas and index are unchanged.
	 *
	 * @param int $parent_id
	 * @param int $variation_id
	 * @return bool
	 */
	public function delete_legacy_configurator_blobs( $parent_id, $variation_id = 0 ) {
		$parent_id = (int) $parent_id;
		$parent    = wc_get_product( $parent_id );
		if ( ! $parent || ! is_a( $parent, 'WC_Product' ) ) {
			return false;
		}
		$parent->delete_meta_data( '_mkl_product_configurator_layers' );
		$parent->save();
		do_action( 'wpml_sync_custom_field', $parent_id, '_mkl_product_configurator_layers' );

		$content_pid = $this->get_product_id_for_content( $parent_id, (int) $variation_id );
		$content_p   = wc_get_product( $content_pid );
		if ( $content_p && is_a( $content_p, 'WC_Product' ) ) {
			$content_p->delete_meta_data( '_mkl_product_configurator_content' );
			$content_p->save();
			do_action( 'wpml_sync_custom_field', $content_pid, '_mkl_product_configurator_content' );
		}

		wp_cache_delete( 'mkl_pc_data_layers_' . $parent_id, 'mkl_pc' );
		wp_cache_delete( 'mkl_pc_data_content_' . $parent_id, 'mkl_pc' );
		wp_cache_delete( 'mkl_pc_layers_index_' . $parent_id, 'mkl_pc' );
		$this->invalidate_layers_cache( $parent_id );
		if ( $content_pid && $content_pid !== $parent_id ) {
			wp_cache_delete( 'mkl_pc_data_content_' . $content_pid, 'mkl_pc' );
			$this->invalidate_layers_cache( $content_pid );
		}
		$this->set_integrity_cache_value( $parent_id, 0 );
		return true;
	}

	/**
	 * Rebuild legacy blob metas from the current effective layers/content (chunked reads first).
	 *
	 * @param int $parent_id
	 * @param int $variation_id
	 * @return bool
	 */
	public function restore_legacy_configurator_blobs_from_chunks( $parent_id, $variation_id = 0 ) {
		$parent_id = (int) $parent_id;
		$parent    = wc_get_product( $parent_id );
		if ( ! $parent || ! is_a( $parent, 'WC_Product' ) ) {
			return false;
		}

		wp_cache_delete( 'mkl_pc_data_layers_' . $parent_id, 'mkl_pc' );
		wp_cache_delete( 'mkl_pc_data_content_' . $parent_id, 'mkl_pc' );
		wp_cache_delete( 'mkl_pc_layers_index_' . $parent_id, 'mkl_pc' );

		$layers = $this->get( 'layers', $parent_id );
		if ( is_array( $layers ) && count( $layers ) > 0 ) {
			$parent->update_meta_data( '_mkl_product_configurator_layers', $layers );
		} else {
			$parent->delete_meta_data( '_mkl_product_configurator_layers' );
		}
		$parent->save();
		do_action( 'wpml_sync_custom_field', $parent_id, '_mkl_product_configurator_layers' );

		$content_pid = $this->get_product_id_for_content( $parent_id, (int) $variation_id );
		$content_p   = wc_get_product( $content_pid );
		if ( $content_p && is_a( $content_p, 'WC_Product' ) ) {
			wp_cache_delete( 'mkl_pc_data_content_' . $content_pid, 'mkl_pc' );
			wp_cache_delete( 'mkl_pc_data_layers_' . $content_pid, 'mkl_pc' );
			$content = $this->get( 'content', $content_pid );
			if ( is_array( $content ) && count( $content ) > 0 ) {
				$content_p->update_meta_data( '_mkl_product_configurator_content', $content );
			} else {
				$content_p->delete_meta_data( '_mkl_product_configurator_content' );
			}
			$content_p->save();
			do_action( 'wpml_sync_custom_field', $content_pid, '_mkl_product_configurator_content' );
		}

		$this->invalidate_layers_cache( $parent_id );
		if ( $content_pid && $content_pid !== $parent_id ) {
			$this->invalidate_layers_cache( $content_pid );
		}
		$this->set_integrity_cache_value( $parent_id, 0 );
		return true;
	}

	/**
	 * Set Data
	 *
	 * @param integer $id        - The product ID
	 * @param integer $ref_id    - The referring ID
	 * @param string  $component - Which component to save (Layers, angles, content)
	 * @param array   $raw_data  - The data (full array or delta object for layers/content)
	 * @return array
	 */
	public function set( $id, $ref_id, $component, $raw_data, $modified_choices = false ) {
		if ( ! $this->is_product( $id ) ) return false;
		if ( $ref_id !== $id && ! $this->is_product( $ref_id ) ) return false;

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
		} else {
			$data = $raw_data;
		}
		$data = apply_filters( 'mkl_product_configurator/data/set/' . $component, $data, $id );
		$product = wc_get_product( $id );
		$product->update_meta_data( '_mkl_product_configurator_last_updated', time() );
		$product->update_meta_data( '_mkl_product_configurator_' . $component, $data );
		$product->save();
		do_action( 'wpml_sync_custom_field', $id, '_mkl_product_configurator_' . $component );
		do_action( 'wpml_sync_custom_field', $id, '_mkl_product_configurator_last_updated' );
		do_action( 'mkl_pc_saved_product_configuration_' . $component, $id, $data );
		do_action( 'mkl_pc_saved_product_configuration', $id );
		wp_cache_delete( "mkl_pc_data_{$component}_{$id}", 'mkl_pc' );
		return $data;
	}

	/**
	 * Normalize raw data for set (strip active, apply choice filter).
	 *
	 * @param array  $raw_data
	 * @param int    $id
	 * @param string $component
	 * @param mixed  $modified_choices
	 * @return array
	 */
	private function normalize_for_set( $raw_data, $id, $component, $modified_choices ) {
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
		$product = wc_get_product( $id );
		if ( ! $product || ! is_a( $product, 'WC_Product' ) ) {
			return false;
		}

		// Delta: { layers_index: [], layers: { id => layer_data }, deleted: [] }
		if ( is_array( $raw_data ) && isset( $raw_data['layers_index'] ) && isset( $raw_data['layers'] ) ) {
			return $this->set_layers_delta( $id, $product, $raw_data );
		}

		if ( 'empty' === $raw_data ) {
			$data = array();
		} elseif ( is_array( $raw_data ) ) {
			$data = $this->normalize_for_set( $raw_data, $id, 'layers', false );
		} else {
			$data = $raw_data;
		}
		$data = apply_filters( 'mkl_product_configurator/data/set/layers', $data, $id );

		if ( empty( $data ) || ! is_array( $data ) ) {
			$old_index = $product->get_meta( '_mkl_product_configurator_layers_index' );
			$old_index = maybe_unserialize( $old_index );
			if ( is_string( $old_index ) ) {
				$old_index = json_decode( stripslashes( $old_index ), true );
			}
			$product->update_meta_data( '_mkl_product_configurator_layers_index', array() );
			$product->save();
			$this->delete_layer_chunk_metas( $product, array(), is_array( $old_index ) ? $old_index : array() );
			$product->delete_meta_data( '_mkl_product_configurator_layers' );
			$product->update_meta_data( '_mkl_product_configurator_last_updated', time() );
			$product->save();
			$this->invalidate_layers_cache( $id );
			do_action( 'wpml_sync_custom_field', $id, '_mkl_product_configurator_layers_index' );
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
			$old_index = json_decode( stripslashes( $old_index ), true );
		}
		if ( ! is_array( $old_index ) ) {
			$old_index = array();
		}

		$product->update_meta_data( '_mkl_product_configurator_layers_index', $layer_ids );
		$product->update_meta_data( '_mkl_product_configurator_last_updated', time() );
		$product->save();
		do_action( 'wpml_sync_custom_field', $id, '_mkl_product_configurator_layers_index' );
		do_action( 'wpml_sync_custom_field', $id, '_mkl_product_configurator_last_updated' );

		foreach ( $data as $layer ) {
			$layer_id = isset( $layer['_id'] ) ? (int) $layer['_id'] : 0;
			if ( ! $layer_id ) continue;
			$product->update_meta_data( '_mkl_product_configurator_layer_' . $layer_id, $layer );
			$product->save();
			do_action( 'wpml_sync_custom_field', $id, '_mkl_product_configurator_layer_' . $layer_id );
		}

		$this->delete_layer_chunk_metas( $product, $layer_ids, $old_index );
		$product->delete_meta_data( '_mkl_product_configurator_layers' );
		$product->save();

		$this->invalidate_layers_cache( $id );
		do_action( 'mkl_pc_saved_product_configuration_layers', $id, $data );
		do_action( 'mkl_pc_saved_product_configuration', $id );
		return $data;
	}

	/**
	 * Set layers from delta payload.
	 *
	 * @param int         $id
	 * @param \WC_Product $product
	 * @param array       $payload { layers_index: [], layers: { id => data }, deleted: [] }
	 * @return array
	 */
	private function set_layers_delta( $id, $product, $payload ) {
		$layer_ids = isset( $payload['layers_index'] ) && is_array( $payload['layers_index'] ) ? $payload['layers_index'] : array();
		$layers = isset( $payload['layers'] ) && is_array( $payload['layers'] ) ? $payload['layers'] : array();
		$deleted = isset( $payload['deleted'] ) && is_array( $payload['deleted'] ) ? $payload['deleted'] : array();

		$product->update_meta_data( '_mkl_product_configurator_layers_index', $layer_ids );
		$product->update_meta_data( '_mkl_product_configurator_last_updated', time() );
		$product->save();
		do_action( 'wpml_sync_custom_field', $id, '_mkl_product_configurator_layers_index' );
		do_action( 'wpml_sync_custom_field', $id, '_mkl_product_configurator_last_updated' );

		foreach ( $layers as $layer_id => $layer ) {
			$layer_id = (int) $layer_id;
			if ( ! $layer_id ) continue;
			$layer = $this->normalize_for_set( array( $layer ), $id, 'layers', false );
			$layer = isset( $layer[0] ) ? $layer[0] : $layer;
			$layer = apply_filters( 'mkl_product_configurator/data/set/layers', array( $layer ), $id );
			$layer = isset( $layer[0] ) ? $layer[0] : $layer;
			$product->update_meta_data( '_mkl_product_configurator_layer_' . $layer_id, $layer );
			$product->save();
			do_action( 'wpml_sync_custom_field', $id, '_mkl_product_configurator_layer_' . $layer_id );
		}

		foreach ( $deleted as $layer_id ) {
			$layer_id = (int) $layer_id;
			if ( $layer_id ) {
				$product->delete_meta_data( '_mkl_product_configurator_layer_' . $layer_id );
			}
		}
		$product->save();

		$data = $this->get( 'layers', $id );
		$this->invalidate_layers_cache( $id );
		do_action( 'mkl_pc_saved_product_configuration_layers', $id, $data ? $data : array() );
		do_action( 'mkl_pc_saved_product_configuration', $id );
		return $data ? $data : array();
	}

	/**
	 * Delete layer chunk metas for IDs that were in the old index but not in the new list.
	 *
	 * @param \WC_Product $product
	 * @param array       $keep_ids  New layer IDs to keep.
	 * @param array       $old_index Previous layer index (IDs that might have chunk metas).
	 */
	private function delete_layer_chunk_metas( $product, $keep_ids, $old_index = array() ) {
		$keep = array_flip( $keep_ids );
		foreach ( $old_index as $layer_id ) {
			$layer_id = (int) $layer_id;
			if ( $layer_id && ! isset( $keep[ $layer_id ] ) ) {
				$product->delete_meta_data( '_mkl_product_configurator_layer_' . $layer_id );
			}
		}
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
		$product = wc_get_product( $id );
		if ( ! $product || ! is_a( $product, 'WC_Product' ) ) {
			return false;
		}

		// Delta: { content: { layerId => { layerId, choices } } }
		if ( is_array( $raw_data ) && isset( $raw_data['content'] ) && is_array( $raw_data['content'] ) ) {
			return $this->set_content_delta( $id, $product, $raw_data, $modified_choices );
		}

		if ( 'empty' === $raw_data ) {
			$data = array();
		} elseif ( is_array( $raw_data ) ) {
			$data = $this->normalize_for_set( $raw_data, $id, 'content', $modified_choices );
		} else {
			$data = $raw_data;
		}
		$data = apply_filters( 'mkl_product_configurator/data/set/content', $data, $id );

		$layer_ids = array();
		if ( is_array( $data ) ) {
			foreach ( $data as $item ) {
				if ( isset( $item['layerId'] ) ) {
					$layer_ids[] = (int) $item['layerId'];
				}
			}
		}

		$current_index = $product->get_meta( '_mkl_product_configurator_layers_index' );
		$current_index = maybe_unserialize( $current_index );
		if ( is_string( $current_index ) ) {
			$current_index = json_decode( stripslashes( $current_index ), true );
		}
		if ( ! is_array( $current_index ) ) {
			$current_index = array();
		}
		if ( empty( $layer_ids ) && ! empty( $data ) ) {
			$layer_ids = $current_index;
		}

		foreach ( $data as $item ) {
			$layer_id = isset( $item['layerId'] ) ? (int) $item['layerId'] : 0;
			if ( ! $layer_id ) continue;
			$product->update_meta_data( '_mkl_product_configurator_content_' . $layer_id, $item );
			$product->save();
			do_action( 'wpml_sync_custom_field', $id, '_mkl_product_configurator_content_' . $layer_id );
		}

		$this->delete_content_chunk_metas( $product, $layer_ids, $current_index );
		$product->delete_meta_data( '_mkl_product_configurator_content' );
		$product->update_meta_data( '_mkl_product_configurator_last_updated', time() );
		$product->save();
		do_action( 'wpml_sync_custom_field', $id, '_mkl_product_configurator_last_updated' );

		$this->invalidate_layers_cache( $id );
		wp_cache_delete( 'mkl_pc_data_content_' . $id, 'mkl_pc' );
		do_action( 'mkl_pc_saved_product_configuration_content', $id, $data );
		do_action( 'mkl_pc_saved_product_configuration', $id );
		return $data;
	}

	/**
	 * Set content from delta payload.
	 *
	 * @param int         $id
	 * @param \WC_Product $product
	 * @param array       $payload { content: { layerId => { layerId, choices } } }
	 * @param mixed       $modified_choices
	 * @return array
	 */
	private function set_content_delta( $id, $product, $payload, $modified_choices = false ) {
		$content_chunks = isset( $payload['content'] ) && is_array( $payload['content'] ) ? $payload['content'] : array();
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
			$product->update_meta_data( '_mkl_product_configurator_content_' . $layer_id, $item );
			$product->save();
			do_action( 'wpml_sync_custom_field', $id, '_mkl_product_configurator_content_' . $layer_id );
		}
		$product->update_meta_data( '_mkl_product_configurator_last_updated', time() );
		$product->save();
		do_action( 'wpml_sync_custom_field', $id, '_mkl_product_configurator_last_updated' );
		wp_cache_delete( 'mkl_pc_data_content_' . $id, 'mkl_pc' );
		$data = $this->get( 'content', $id );
		$this->invalidate_layers_cache( $id );
		do_action( 'mkl_pc_saved_product_configuration_content', $id, $data ? $data : array() );
		do_action( 'mkl_pc_saved_product_configuration', $id );
		return $data ? $data : array();
	}

	/**
	 * Delete content chunk metas for layer IDs that are in old_index but not in keep_ids.
	 *
	 * @param \WC_Product $product
	 * @param array       $keep_ids  Layer IDs to keep (current content layer IDs).
	 * @param array       $old_index Optional. Previous layers index; if not provided, read from product.
	 */
	private function delete_content_chunk_metas( $product, $keep_ids, $old_index = null ) {
		if ( null === $old_index ) {
			$old_index = $product->get_meta( '_mkl_product_configurator_layers_index' );
			$old_index = maybe_unserialize( $old_index );
			if ( is_string( $old_index ) ) {
				$old_index = json_decode( stripslashes( $old_index ), true );
			}
		}
		if ( ! is_array( $old_index ) ) {
			return;
		}
		$keep = array_flip( $keep_ids );
		foreach ( $old_index as $layer_id ) {
			$layer_id = (int) $layer_id;
			if ( $layer_id && ! isset( $keep[ $layer_id ] ) ) {
				$product->delete_meta_data( '_mkl_product_configurator_content_' . $layer_id );
			}
		}
	}

	private function invalidate_layers_cache( $product_id ) {
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
		$product = wc_get_product( $product_id );
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
		$product = wc_get_product( $product_id );
		if ( ! $product || ! is_a( $product, 'WC_Product' ) ) {
			return false;
		}
		$chunk = $product->get_meta( '_mkl_product_configurator_content_' . $layer_id );
		if ( '' !== $chunk ) {
			$chunk = maybe_unserialize( $chunk );
			if ( is_string( $chunk ) ) {
				$chunk = json_decode( stripslashes( $chunk ), true );
			}
			if ( is_array( $chunk ) ) {
				if ( ! isset( $chunk['layerId'] ) ) {
					$chunk['layerId'] = (int) $layer_id;
				}
				return $chunk;
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
		$product = wc_get_product( $product_id );
		if ( ! $product || ! is_a( $product, 'WC_Product' ) ) {
			return false;
		}
		if ( ! isset( $layer_content['layerId'] ) ) {
			$layer_content['layerId'] = (int) $layer_id;
		}
		$product->update_meta_data( '_mkl_product_configurator_content_' . $layer_id, $layer_content );
		$product->update_meta_data( '_mkl_product_configurator_last_updated', time() );
		$product->save();
		do_action( 'wpml_sync_custom_field', $product_id, '_mkl_product_configurator_content_' . $layer_id );
		do_action( 'wpml_sync_custom_field', $product_id, '_mkl_product_configurator_last_updated' );
		wp_cache_delete( 'mkl_pc_data_content_' . $product_id, 'mkl_pc' );
		do_action( 'mkl_pc_saved_product_configuration_content', $product_id, array( $layer_content ) );
		do_action( 'mkl_pc_saved_product_configuration', $product_id );
		return true;
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
	 * @return array
	 */
	public function get_menu(){
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
				'title' => __( 'Layers of the product ', 'product-configurator-for-woocommerce' ),
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
				'description' => __( 'Define the layers the product is composed of. ', 'product-configurator-for-woocommerce' ),
				'order' => 20,
			),
			array(
				'type' 	=> 'part',
				'menu_id' 	=> 'angles',
				'label' => __( 'Views', 'product-configurator-for-woocommerce' ),
				'title' => __( 'Angles of the product ', 'product-configurator-for-woocommerce' ),
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
				'description' => __( 'Define the view angles, if you want the client to be able to switch between them. ', 'product-configurator-for-woocommerce' ),
				'order' => 30,
			),
			array(
				'type' 	=> 'part',
				'menu_id' 	=> 'content',
				'label' => __( 'Content', 'product-configurator-for-woocommerce' ),
				'title' => __( 'Contents ', 'product-configurator-for-woocommerce' ),
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
				'description' => __( 'Define choices for each layer and assign them pictures', 'product-configurator-for-woocommerce' ),
				'order' => 40,
			),
		);

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
				'menu' => array(
					array(
						'class' => 'pc-main-cancel',
						'text' => __( 'Cancel', 'product-configurator-for-woocommerce' ),
					),
				),
				'description' => __( 'Define the conditions for displaying or not the choices / layers', 'product-configurator-for-woocommerce' ),
				'order' => 101,
			);			
		}

		return apply_filters( 'mkl_product_configurator_admin_menu', $default_menu );
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
	 * Get the basic data structure
	 *
	 * @param integer $id - The product's ID
	 * @return array
	 */
	public function get_init_data( $id, $variation_id_for_storage = 0 ) {

		$product = wc_get_product( $id );
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
		);
		
		if ( 'variable' === $product->get_type()) {
			$init_data['product_info']['mode'] = $product->get_meta( MKL_PC_PREFIX . '_variable_configuration_mode', true );
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
		$init_data['product_info'] = array_merge(
			$init_data['product_info'], 
			array(
				'title'          => apply_filters( 'the_title', $product->get_title(), $id ),
				'product_type'   => $product_type,
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

		return apply_filters( 'mkl_product_configurator_get_front_end_data', $init_data, $product );
	}

	/**
	 * Wether the post is a supported post type
	 *
	 * @param integer $id - The product / post ID
	 * @return boolean
	 */
	public function is_product( $id ) {
		return Utils::is_product( $id );
		// return in_array( get_post_type( $id ), apply_filters( 'mkl_pc_product_post_types', array( 'product', 'product_variation' ) ) );
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
		$product = wc_get_product( $product_id );
		if ( ! $product || ! is_a( $product, 'WC_Product' ) ) {
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
					$chunk = json_decode( stripslashes( $chunk ), true );
				}
			}
			if ( empty( $chunk ) || ! is_array( $chunk ) ) continue;
			if ( isset( $chunk['image'] ) && ! empty( $chunk['image']['url'] ) ) {
				$new_layer_id = $this->_find_image_id( $chunk['image']['url'], isset( $chunk['image']['id'] ) ? $chunk['image']['id'] : 0 );
				if ( $new_layer_id && ( ! isset( $chunk['image']['id'] ) || $new_layer_id != $chunk['image']['id'] ) ) {
					$chunk['image']['id'] = $new_layer_id;
					$chunk['image']['url'] = wp_get_attachment_url( $new_layer_id );
					$product->update_meta_data( '_mkl_product_configurator_layer_' . $layer_id, $chunk );
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
		);
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
		
		// No key is set, we treat as a text field
		if ( ! $the_key ) return sanitize_text_field( $data );
		
		// Default to empty field
		if ( ! in_array( $the_key, array_keys( $supported_fields ) ) ) {
			return sanitize_text_field( $data );
		}

		// Default 
		if ( ! isset( $supported_fields[$the_key][$action] ) ) {
			if ( 'sanitize' === $action) return sanitize_text_field( $data );
			return sanitize_text_field( $data );
		}

		if ( is_callable( $supported_fields[$the_key][$action] ) ) {
			$data = call_user_func( $supported_fields[$the_key][$action], $data );
			return $data;
		}

		if ( 'boolean' == $supported_fields[$the_key][$action] ) {
			return filter_var( $data, FILTER_VALIDATE_BOOLEAN );
		}

		error_log( 'MKL Product Configurator: Sanitazing could not be done for the variable ' . $the_key . ' (The function returned and empty string instead)');
		return '';
	}

	public function get_context() {
		return $this->context;
	}

	public function set_context( $c) {
		return $this->context = $c;
	}
}
