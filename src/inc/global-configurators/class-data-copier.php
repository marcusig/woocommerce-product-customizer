<?php
/**
 * Safe copy / link / unlink service methods for global configurators.
 *
 * @package MKL\PC\Global_Configurators
 */

namespace MKL\PC\Global_Configurators;

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
	 * @return int|\WP_Error Post id or error.
	 */
	public static function create_global_from_product( $source_product_id, $title = '' ) {
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

		self::copy_all_configurator_meta( $source, $target );

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

		update_post_meta( $product_id, Schema::META_SOURCE, Schema::SOURCE_GLOBAL );
		update_post_meta( $product_id, Schema::META_GLOBAL_ID, $global_id );

		if ( $wipe_product_configurator_data ) {
			self::wipe_configurator_meta( $product );
			$product->save();
		}

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
			self::wipe_configurator_meta( $target );
			$target->save();
			self::copy_all_configurator_meta( $source, $target );
		}

		delete_post_meta( $product_id, Schema::META_GLOBAL_ID );
		update_post_meta( $product_id, Schema::META_SOURCE, Schema::SOURCE_LOCAL );

		if ( $global_id > 0 ) {
			Owner_Resolver::invalidate_consumers_cache( $global_id );
		}

		do_action( 'mkl_pc/global_configurators/unlinked', $product_id, $global_id, $copy_data_to_product );
		return true;
	}

	/**
	 * Copy chunked + single-meta + legacy-blob configurator data from one owner to another.
	 *
	 * @param Storage_Owner $source
	 * @param Storage_Owner $target
	 * @return void
	 */
	public static function copy_all_configurator_meta( $source, $target ) {
		foreach ( self::get_single_meta_keys() as $key ) {
			$value = $source->get_meta( $key, true );
			if ( '' === $value || false === $value || null === $value ) {
				$target->delete_meta( $key );
				continue;
			}
			$target->update_meta( $key, $value );
		}

		foreach ( self::get_legacy_blob_keys() as $key ) {
			$value = $source->get_meta( $key, true );
			if ( '' === $value || false === $value || null === $value ) {
				$target->delete_meta( $key );
				continue;
			}
			$target->update_meta( $key, $value );
		}

		$index = $source->get_meta( self::get_layers_index_key(), true );
		if ( is_array( $index ) && ! empty( $index ) ) {
			$target->update_meta( self::get_layers_index_key(), $index );
			foreach ( self::get_chunked_prefixes() as $prefix ) {
				foreach ( $index as $layer_id ) {
					$layer_id = (int) $layer_id;
					if ( $layer_id <= 0 ) {
						continue;
					}
					$key   = $prefix . $layer_id;
					$value = $source->get_meta( $key, true );
					if ( '' === $value || false === $value || null === $value ) {
						$target->delete_meta( $key );
						continue;
					}
					$target->update_meta( $key, $value );
				}
			}
		} else {
			$target->delete_meta( self::get_layers_index_key() );
		}

		$target->save();
	}

	/**
	 * Remove all configurator meta from an owner. Use when wiping a product that's about to point globally,
	 * or when unlinking and copying back.
	 *
	 * @param Storage_Owner $owner
	 * @return void
	 */
	public static function wipe_configurator_meta( $owner ) {
		foreach ( self::get_single_meta_keys() as $key ) {
			$owner->delete_meta( $key );
		}
		foreach ( self::get_legacy_blob_keys() as $key ) {
			$owner->delete_meta( $key );
		}
		$index = $owner->get_meta( self::get_layers_index_key(), true );
		if ( is_array( $index ) ) {
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
	}
}
