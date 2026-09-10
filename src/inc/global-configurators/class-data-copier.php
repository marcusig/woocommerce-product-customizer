<?php
/**
 * Safe copy / link / unlink service methods for global configurators.
 *
 * @package MKL\PC\Global_Configurators
 */

namespace MKL\PC\Global_Configurators;

use MKL\PC\DB;

defined( 'ABSPATH' ) || exit;

/**
 * Dedicated service for moving configurator meta between products and global configurators.
 *
 * Uses explicit key lists rather than broad meta cloning so unrelated WC meta is never copied.
 */
final class Data_Copier {

	/**
	 * Configurator meta keys (non-chunked) that travel with the configurator.
	 * Does NOT include legacy blobs, which are handled separately based on the caller's intent.
	 *
	 * @return string[]
	 */
	public static function get_single_meta_keys() {
		return apply_filters(
			'mkl_pc/global_configurators/copy/single_meta_keys',
			array(
				'_mkl_product_configurator_angles',
				'_mkl_product_configurator_conditions',
				'_mkl_product_configurator_last_updated',
				'_mkl_product_configurator_storage_format_version',
				'_mkl_product_configurator_integrity_cache',
			)
		);
	}

	/**
	 * Legacy-blob meta keys (single-meta format pre-migration).
	 *
	 * @return string[]
	 */
	public static function get_legacy_blob_keys() {
		return array(
			'_mkl_product_configurator_layers',
			'_mkl_product_configurator_content',
		);
	}

	/**
	 * Index meta key for chunked storage.
	 *
	 * @return string
	 */
	public static function get_layers_index_key() {
		return '_mkl_product_configurator_layers_index';
	}

	/**
	 * Chunked per-layer / per-content meta prefixes (suffixed with numeric layer id).
	 *
	 * @return string[]
	 */
	public static function get_chunked_prefixes() {
		return array(
			'_mkl_product_configurator_layer_',
			'_mkl_product_configurator_content_',
		);
	}

	/**
	 * Create a new global configurator CPT from an existing product's configurator.
	 *
	 * @param int    $source_product_id
	 * @param string $title Optional post_title for the new CPT.
	 * @param bool   $copy_data Copy the product's configurator meta onto the new post. Pass false to
	 *                          create the post empty, for callers that upload the data themselves
	 *                          (the editor pushes it in chunks from the browser).
	 * @return int|\WP_Error Post id or error.
	 */
	public static function create_global_from_product( $source_product_id, $title = '', $copy_data = true ) {
		$source_product_id = (int) $source_product_id;
		if ( $source_product_id <= 0 ) {
			return new \WP_Error( 'invalid_source', __( 'Invalid source product.', 'product-configurator-for-woocommerce' ) );
		}
		$source = Storage_Owner::for_post( $source_product_id );
		if ( ! $source ) {
			return new \WP_Error( 'invalid_source', __( 'Invalid source product.', 'product-configurator-for-woocommerce' ) );
		}

		if ( '' === $title ) {
			$post = get_post( $source_product_id );
			$title = $post ? (string) $post->post_title : '';
			if ( '' === $title ) {
				/* translators: %d: product/post ID */
				$title = sprintf( __( 'Configurator #%d', 'product-configurator-for-woocommerce' ), $source_product_id );
			}
		}

		$new_id = wp_insert_post(
			array(
				'post_type'   => Schema::CPT_SLUG,
				'post_status' => 'publish',
				'post_title'  => $title,
			),
			true
		);
		if ( is_wp_error( $new_id ) ) {
			return $new_id;
		}
		$new_id = (int) $new_id;
		if ( $new_id <= 0 ) {
			return new \WP_Error( 'insert_failed', __( 'Could not create global configurator.', 'product-configurator-for-woocommerce' ) );
		}

		$target = Storage_Owner::for_post( $new_id );
		if ( ! $target ) {
			return new \WP_Error( 'insert_failed', __( 'Could not create global configurator.', 'product-configurator-for-woocommerce' ) );
		}

		if ( $copy_data ) {
			$copied = self::copy_all_configurator_meta( $source, $target );
			if ( is_wp_error( $copied ) ) {
				// Nothing useful landed on the new post. Take the empty CPT back out so a retry
				// starts clean.
				wp_delete_post( $new_id, true );
				return $copied;
			}
		}

		$configurator_type = $source->get_meta( MKL_PC_PREFIX . '_configurator_type', true );
		if ( $configurator_type ) {
			$target->update_meta( MKL_PC_PREFIX . '_configurator_type', $configurator_type );
			$target->save();
		}

		do_action( 'mkl_pc/global_configurators/created_from_product', $new_id, $source_product_id );
		return $new_id;
	}

	/**
	 * Link a product to a global configurator. Removes product-owned configurator data from the product.
	 *
	 * @param int  $product_id
	 * @param int  $global_id
	 * @param bool $wipe_product_configurator_data
	 * @return true|\WP_Error
	 */
	public static function link_product_to_global( $product_id, $global_id, $wipe_product_configurator_data = false ) {
		$product_id = (int) $product_id;
		$global_id  = (int) $global_id;
		if ( $product_id <= 0 || $global_id <= 0 ) {
			return new \WP_Error( 'invalid_args', __( 'Invalid arguments.', 'product-configurator-for-woocommerce' ) );
		}
		if ( ! Schema::is_global_configurator_id( $global_id ) ) {
			return new \WP_Error( 'invalid_global', __( 'Target is not a global configurator.', 'product-configurator-for-woocommerce' ) );
		}
		if ( ! Owner_Resolver::can_use_global( $product_id ) ) {
			return new \WP_Error(
				'not_allowed',
				__( 'This product cannot use a global configurator. Variable products must be set to "Variations share the same configuration".', 'product-configurator-for-woocommerce' )
			);
		}

		$product = Storage_Owner::for_post( $product_id );
		if ( ! $product ) {
			return new \WP_Error( 'invalid_product', __( 'Invalid product.', 'product-configurator-for-woocommerce' ) );
		}

		if ( $wipe_product_configurator_data ) {
			// Wipe first: it is the only step that destroys data, so a refusal has to leave the
			// product local and pointing at nothing rather than global with its data still here.
			$wiped = self::wipe_configurator_meta( $product );
			if ( is_wp_error( $wiped ) ) {
				return $wiped;
			}
			$product->save();
		}

		update_post_meta( $product_id, Schema::META_SOURCE, Schema::SOURCE_GLOBAL );
		update_post_meta( $product_id, Schema::META_GLOBAL_ID, $global_id );

		Owner_Resolver::invalidate_consumers_cache( $global_id );

		do_action( 'mkl_pc/global_configurators/linked', $product_id, $global_id, $wipe_product_configurator_data );
		return true;
	}

	/**
	 * Unlink a product from its global configurator. Source returns to local. Optional data copy-back from the CPT.
	 *
	 * @param int  $product_id
	 * @param bool $copy_data_to_product Copy current global configurator meta onto the product.
	 * @return true|\WP_Error
	 */
	public static function unlink_product_from_global( $product_id, $copy_data_to_product = true ) {
		$product_id = (int) $product_id;
		if ( $product_id <= 0 ) {
			return new \WP_Error( 'invalid_args', __( 'Invalid arguments.', 'product-configurator-for-woocommerce' ) );
		}
		$global_id = Owner_Resolver::get_global_id( $product_id );

		if ( $copy_data_to_product && $global_id > 0 ) {
			$source = Storage_Owner::for_post( $global_id );
			$target = Storage_Owner::for_post( $product_id );
			if ( ! $source || ! $target ) {
				return new \WP_Error( 'invalid_state', __( 'Could not resolve source or target post.', 'product-configurator-for-woocommerce' ) );
			}
			// Read the global configurator's index before touching the product: an unreadable
			// index here means the copy back would be empty, and the product is about to be
			// wiped to make room for it.
			if ( null === self::read_index_array( $source ) ) {
				return self::unreadable_index_error();
			}
			$wiped = self::wipe_configurator_meta( $target );
			if ( is_wp_error( $wiped ) ) {
				return $wiped;
			}
			$target->save();
			$copied = self::copy_all_configurator_meta( $source, $target );
			if ( is_wp_error( $copied ) ) {
				return $copied;
			}
		}

		delete_post_meta( $product_id, Schema::META_GLOBAL_ID );
		update_post_meta( $product_id, Schema::META_SOURCE, Schema::SOURCE_LOCAL );
		update_post_meta( $product_id, MKL_PC_PREFIX . '_is_configurable', 'yes' );

		if ( $global_id > 0 ) {
			Owner_Resolver::invalidate_consumers_cache( $global_id );
		}

		do_action( 'mkl_pc/global_configurators/unlinked', $product_id, $global_id, $copy_data_to_product );
		return true;
	}

	/**
	 * Meta keys holding a structured (array) configurator value rather than a scalar.
	 *
	 * These are copied by value - decoded on read, re-encoded by the DB service on write - never
	 * byte-for-byte. How many levels of backslash escaping a JSON string carries in the column
	 * depends on which owner wrote it: a product goes through `WC_Data_Store_WP`, which slashes the
	 * value again before `update_metadata()` unslashes it, while a global configurator CPT goes
	 * straight to `update_post_meta()`. Copying the raw string between the two adds or removes a
	 * level every hop, and after one round trip the JSON no longer parses.
	 *
	 * @param string $key
	 * @return bool
	 */
	private static function is_structured_meta_key( $key ) {
		if ( in_array( $key, self::get_legacy_blob_keys(), true ) ) {
			return true;
		}
		if ( self::get_layers_index_key() === $key ) {
			return true;
		}
		if ( in_array( $key, array( '_mkl_product_configurator_angles', '_mkl_product_configurator_conditions' ), true ) ) {
			return true;
		}
		foreach ( self::get_chunked_prefixes() as $prefix ) {
			if ( 0 === strpos( $key, $prefix ) ) {
				return true;
			}
		}
		return false;
	}

	/**
	 * Decode a stored configurator value to the array the DB service works with.
	 *
	 * Mirrors the read path in `DB`: WordPress hands back an array for a PHP-serialized row and a
	 * string for a JSON one, and the JSON may or may not still be slashed.
	 *
	 * @param mixed $raw
	 * @return array|null Null when a value is stored but could not be decoded.
	 */
	private static function decode_structured_value( $raw ) {
		if ( '' === $raw || null === $raw || false === $raw ) {
			return array();
		}
		$value = maybe_unserialize( $raw );
		if ( is_array( $value ) ) {
			return $value;
		}
		if ( ! is_string( $value ) ) {
			return null;
		}
		$db      = function_exists( 'mkl_pc' ) ? mkl_pc( 'db' ) : null;
		$decoded = ( $db && method_exists( $db, 'decode_stored_json' ) )
			? $db->decode_stored_json( $value )
			: self::decode_json_tolerant( $value );

		return is_array( $decoded ) ? $decoded : null;
	}

	/**
	 * Copy one meta value from source to target.
	 *
	 * Structured values are decoded and re-encoded through the DB service so the target ends up in
	 * whatever escaping its own owner type uses. Scalars (timestamps, version flags) are copied
	 * across as they are.
	 *
	 * @param Storage_Owner $target
	 * @param string        $key
	 * @param mixed         $value Raw source value.
	 * @return bool False when a structured value could not be decoded or re-encoded.
	 */
	private static function copy_meta_value( $target, $key, $value ) {
		if ( ! self::is_structured_meta_key( $key ) ) {
			$target->update_meta( $key, is_string( $value ) ? wp_slash( $value ) : $value );
			return true;
		}

		$decoded = self::decode_structured_value( $value );
		if ( null === $decoded ) {
			return false;
		}
		if ( empty( $decoded ) ) {
			$target->delete_meta( $key );
			return true;
		}

		$db = function_exists( 'mkl_pc' ) ? mkl_pc( 'db' ) : null;
		if ( ! $db || ! method_exists( $db, 'write_structured_meta' ) ) {
			return false;
		}
		return (bool) $db->write_structured_meta( $target, $key, $decoded );
	}

	/**
	 * Read the layers index as an array of ids, whether it is stored as JSON or PHP-serialized.
	 *
	 * A product stores the JSON index slashed - `DB::encode_meta_batch()` pre-slashes it to survive
	 * the `wp_unslash()` in `update_metadata()`, and WooCommerce re-slashes on top of that for a new
	 * meta row, so one level of escapes stays in the column. A global configurator CPT is written
	 * through `update_post_meta()` and keeps none. Both shapes have to decode here, or the caller
	 * reads a configurator with layers as "no layers" - see the null contract below.
	 *
	 * @param Storage_Owner $owner
	 * @return int[]|null Ids, or null when a value is stored but could not be decoded.
	 */
	private static function read_index_array( $owner ) {
		return self::decode_index_value( $owner->get_meta( self::get_layers_index_key(), true ) );
	}

	/**
	 * Decode a stored layers index.
	 *
	 * Distinguishes "there is no index" (empty array) from "there is one and it did not decode"
	 * (null). Callers must never treat the second as an empty configurator: the copy would take
	 * nothing and the wipe that follows it would delete the only remaining copy of the data.
	 *
	 * @param mixed $raw Raw meta value.
	 * @return int[]|null
	 */
	private static function decode_index_value( $raw ) {
		if ( '' === $raw || null === $raw || false === $raw || array() === $raw ) {
			return array();
		}

		$index = maybe_unserialize( $raw );
		if ( is_array( $index ) ) {
			return $index;
		}
		if ( ! is_string( $index ) ) {
			return null;
		}

		// Same tolerant decode the read path uses, so a slashed product index and a clean CPT
		// index both parse.
		$db      = function_exists( 'mkl_pc' ) ? mkl_pc( 'db' ) : null;
		$decoded = ( $db && method_exists( $db, 'decode_stored_json' ) )
			? $db->decode_stored_json( $index )
			: self::decode_json_tolerant( $index );

		return is_array( $decoded ) ? $decoded : null;
	}

	/**
	 * Fallback for {@see self::decode_index_value()} when the DB service is unavailable.
	 *
	 * @param string $data
	 * @return mixed
	 */
	private static function decode_json_tolerant( $data ) {
		$decoded = json_decode( $data, true );
		if ( JSON_ERROR_NONE !== json_last_error() ) {
			$decoded = json_decode( stripslashes( $data ), true );
		}
		return ( JSON_ERROR_NONE === json_last_error() ) ? $decoded : null;
	}

	/**
	 * Error returned when an owner's layers index exists but cannot be read.
	 *
	 * @return \WP_Error
	 */
	private static function unreadable_index_error() {
		return new \WP_Error(
			'unreadable_index',
			__( 'This configurator\'s layer index could not be read, so its layers cannot be copied safely. Nothing was changed.', 'product-configurator-for-woocommerce' )
		);
	}

	/**
	 * Copy chunked + single-meta + legacy-blob configurator data from one owner to another.
	 *
	 * The source index is read before anything is written: a source whose index cannot be read
	 * would copy as an empty configurator, and every caller wipes one side straight afterwards.
	 *
	 * @param Storage_Owner $source
	 * @param Storage_Owner $target
	 * @return true|\WP_Error
	 */
	public static function copy_all_configurator_meta( $source, $target ) {
		$index = self::read_index_array( $source );
		if ( null === $index ) {
			return self::unreadable_index_error();
		}

		$keys = array_merge( self::get_single_meta_keys(), self::get_legacy_blob_keys() );
		if ( ! empty( $index ) ) {
			$keys[] = self::get_layers_index_key();
			foreach ( self::get_chunked_prefixes() as $prefix ) {
				foreach ( $index as $layer_id ) {
					$layer_id = (int) $layer_id;
					if ( $layer_id > 0 ) {
						$keys[] = $prefix . $layer_id;
					}
				}
			}
		}

		foreach ( $keys as $key ) {
			$value = $source->get_meta( $key, true );
			if ( '' === $value || false === $value || null === $value ) {
				$target->delete_meta( $key );
				continue;
			}
			if ( ! self::copy_meta_value( $target, $key, $value ) ) {
				/* translators: %s: meta key */
				return new \WP_Error( 'copy_failed', sprintf( __( 'Could not copy configurator data (%s). Nothing was changed.', 'product-configurator-for-woocommerce' ), $key ) );
			}
		}

		if ( empty( $index ) ) {
			$target->delete_meta( self::get_layers_index_key() );
		}

		// Everything above was written as JSON by the DB service, so the target must not be left
		// looking like an unconverted owner - the lazy conversion pass would try to rewrite rows
		// that are already JSON.
		$target->update_meta( DB::META_STORAGE_ENCODING, DB::STORAGE_ENCODING_JSON );

		$target->save();
		return true;
	}

	/**
	 * Whether an owner still holds configurator data of its own.
	 *
	 * A product linked to a global configurator reads through the link, so its own rows become
	 * invisible rather than gone. This is what tells the editor there is still a local copy to
	 * offer to delete.
	 *
	 * @param Storage_Owner $owner
	 * @return bool
	 */
	public static function has_local_configurator_data( $owner ) {
		if ( ! $owner ) {
			return false;
		}

		$index = self::read_index_array( $owner );
		// An index that exists but will not decode is still data.
		if ( null === $index || ! empty( $index ) ) {
			return true;
		}

		foreach ( self::get_legacy_blob_keys() as $key ) {
			$value = self::decode_structured_value( $owner->get_meta( $key, true ) );
			if ( null === $value || ! empty( $value ) ) {
				return true;
			}
		}

		foreach ( self::get_chunked_prefixes() as $prefix ) {
			if ( ! empty( $owner->get_meta_keys_with_prefix( $prefix ) ) ) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Remove all configurator meta from an owner. Use when wiping a product that's about to point globally,
	 * or when unlinking and copying back.
	 *
	 * @param Storage_Owner $owner
	 * @return true|\WP_Error
	 */
	public static function wipe_configurator_meta( $owner ) {
		// The prefix scan below deletes every chunk whether or not the index names it, so an index
		// we cannot read is not a reason to delete less - it is a reason to not delete at all,
		// because it means the copy that was supposed to precede this wipe took nothing.
		$index = self::read_index_array( $owner );
		if ( null === $index ) {
			return self::unreadable_index_error();
		}

		foreach ( self::get_single_meta_keys() as $key ) {
			$owner->delete_meta( $key );
		}
		foreach ( self::get_legacy_blob_keys() as $key ) {
			$owner->delete_meta( $key );
		}
		if ( ! empty( $index ) ) {
			foreach ( self::get_chunked_prefixes() as $prefix ) {
				foreach ( $index as $layer_id ) {
					$layer_id = (int) $layer_id;
					if ( $layer_id <= 0 ) {
						continue;
					}
					$owner->delete_meta( $prefix . $layer_id );
				}
			}
		}
		foreach ( self::get_chunked_prefixes() as $prefix ) {
			foreach ( $owner->get_meta_keys_with_prefix( $prefix ) as $key ) {
				$owner->delete_meta( $key );
			}
		}
		$owner->delete_meta( self::get_layers_index_key() );
		$owner->delete_meta( DB::META_STORAGE_ENCODING );
		return true;
	}
}
