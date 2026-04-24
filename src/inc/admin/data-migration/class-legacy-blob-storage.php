<?php
/**
 * Legacy single-blob metas: detection, delete legacy blobs, revert to legacy by removing chunks.
 *
 * @package MKL\PC\Admin\Data_Migration
 */

namespace MKL\PC\Admin\Data_Migration;

use MKL\PC\DB;
use WC_Product;
use WP_Error;

defined( 'ABSPATH' ) || exit;

/**
 * Operates on _mkl_product_configurator_layers / _mkl_product_configurator_content only.
 */
final class Legacy_Blob_Storage {

	/**
	 * @param int $parent_id
	 * @param int $variation_id
	 * @return bool
	 */
	public static function has_legacy_blobs( $parent_id, $variation_id = 0 ) {
		$parent_id = (int) $parent_id;
		$parent    = wc_get_product( $parent_id );
		if ( ! $parent || ! is_a( $parent, WC_Product::class ) ) {
			return false;
		}
		if ( self::layers_blob_is_non_empty( $parent ) ) {
			return true;
		}
		$db         = mkl_pc()->db;
		$content_pid = $db->get_product_id_for_content( $parent_id, (int) $variation_id );
		$content_p   = wc_get_product( $content_pid );
		return $content_p && self::content_blob_is_non_empty( $content_p );
	}

	/**
	 * @param int $parent_id
	 * @param int $variation_id
	 * @return bool
	 */
	public static function delete_legacy_blobs( $parent_id, $variation_id = 0 ) {
		$parent_id = (int) $parent_id;
		$parent    = wc_get_product( $parent_id );
		if ( ! $parent || ! is_a( $parent, WC_Product::class ) ) {
			return false;
		}
		$parent->delete_meta_data( '_mkl_product_configurator_layers' );
		$parent->save();
		do_action( 'wpml_sync_custom_field', $parent_id, '_mkl_product_configurator_layers' );

		$db          = mkl_pc()->db;
		$content_pid = $db->get_product_id_for_content( $parent_id, (int) $variation_id );
		$content_p   = wc_get_product( $content_pid );
		if ( $content_p && is_a( $content_p, WC_Product::class ) ) {
			$content_p->delete_meta_data( '_mkl_product_configurator_content' );
			$content_p->save();
			do_action( 'wpml_sync_custom_field', $content_pid, '_mkl_product_configurator_content' );
		}

		self::flush_object_caches( $parent_id );
		if ( $content_pid && $content_pid !== $parent_id ) {
			self::flush_object_caches( $content_pid );
		}
		self::invalidate_integrity_cache( $parent_id );
		return true;
	}

	/**
	 * Remove chunked storage so the editor uses legacy blobs again. Legacy metas must still exist.
	 *
	 * Deletes per-layer / per-content chunk metas, layers index, storage format version, and integrity cache.
	 * Does not delete `_mkl_product_configurator_layers` or `_mkl_product_configurator_content` blobs.
	 *
	 * @param int $parent_id
	 * @param int $variation_id
	 * @return true|WP_Error
	 */
	public static function revert_to_legacy_storage_remove_chunks( $parent_id, $variation_id = 0 ) {
		$parent_id = (int) $parent_id;
		if ( ! self::has_legacy_blobs( $parent_id, $variation_id ) ) {
			return new WP_Error(
				'mkl_pc_no_legacy_blobs',
				__( 'Restoring is only possible when legacy storage data is still present (for example after a failed migration).', 'product-configurator-for-woocommerce' )
			);
		}
		$parent = wc_get_product( $parent_id );
		if ( ! $parent || ! is_a( $parent, WC_Product::class ) ) {
			return new WP_Error( 'mkl_pc_invalid_product', __( 'Invalid product.', 'product-configurator-for-woocommerce' ) );
		}

		self::delete_chunk_metas_matching_regexp_on_product( $parent, '^_mkl_product_configurator_layer_[0-9]+$' );
		$parent->delete_meta_data( '_mkl_product_configurator_layers_index' );
		$parent->delete_meta_data( DB::META_STORAGE_FORMAT_VERSION );
		$parent->delete_meta_data( DB::META_INTEGRITY_CACHE );

		$db          = mkl_pc()->db;
		$content_pid = (int) $db->get_product_id_for_content( $parent_id, (int) $variation_id );

		if ( $content_pid && $content_pid !== $parent_id ) {
			$content_p = wc_get_product( $content_pid );
			if ( $content_p && is_a( $content_p, WC_Product::class ) ) {
				self::delete_chunk_metas_matching_regexp_on_product( $content_p, '^_mkl_product_configurator_content_[0-9]+$' );
				$content_p->save();
			}
		} else {
			self::delete_chunk_metas_matching_regexp_on_product( $parent, '^_mkl_product_configurator_content_[0-9]+$' );
		}

		$parent->save();
		do_action( 'wpml_sync_custom_field', $parent_id, '_mkl_product_configurator_layers_index' );
		do_action( 'wpml_sync_custom_field', $parent_id, DB::META_STORAGE_FORMAT_VERSION );
		do_action( 'wpml_sync_custom_field', $parent_id, DB::META_INTEGRITY_CACHE );

		self::flush_object_caches( $parent_id );
		if ( $content_pid && $content_pid !== $parent_id ) {
			self::flush_object_caches( $content_pid );
		}
		return true;
	}

	/**
	 * @param WC_Product $product
	 * @param string     $regexp Full PCRE pattern for meta_key (MySQL REGEXP).
	 * @return void
	 */
	private static function delete_chunk_metas_matching_regexp_on_product( WC_Product $product, $regexp ) {
		global $wpdb;
		$post_id = (int) $product->get_id();
		if ( $post_id < 1 ) {
			return;
		}
		$keys = $wpdb->get_col(
			$wpdb->prepare(
				"SELECT meta_key FROM {$wpdb->postmeta} WHERE post_id = %d AND meta_key REGEXP %s",
				$post_id,
				$regexp
			)
		);
		if ( ! is_array( $keys ) ) {
			return;
		}
		foreach ( $keys as $meta_key ) {
			$product->delete_meta_data( $meta_key );
			do_action( 'wpml_sync_custom_field', $post_id, $meta_key );
		}
	}

	/**
	 * @param WC_Product $product
	 * @return bool
	 */
	private static function layers_blob_is_non_empty( $product ) {
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
	 * @param WC_Product $product
	 * @return bool
	 */
	private static function content_blob_is_non_empty( $product ) {
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
	 * @param int $product_id
	 * @return void
	 */
	private static function flush_object_caches( $product_id ) {
		$product_id = (int) $product_id;
		wp_cache_delete( 'mkl_pc_data_layers_' . $product_id, 'mkl_pc' );
		wp_cache_delete( 'mkl_pc_data_content_' . $product_id, 'mkl_pc' );
		wp_cache_delete( 'mkl_pc_layers_index_' . $product_id, 'mkl_pc' );
	}

	/**
	 * @param int $parent_id
	 * @return void
	 */
	private static function invalidate_integrity_cache( $parent_id ) {
		$parent = wc_get_product( (int) $parent_id );
		if ( ! $parent || ! is_a( $parent, WC_Product::class ) ) {
			return;
		}
		$parent->update_meta_data( DB::META_INTEGRITY_CACHE, 0 );
		$parent->save();
		do_action( 'wpml_sync_custom_field', (int) $parent_id, DB::META_INTEGRITY_CACHE );
	}
}
