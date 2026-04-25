<?php
/**
 * Legacy single-blob metas: detection, delete legacy blobs, revert to legacy by removing chunks.
 *
 * @package MKL\PC\Admin\Data_Migration
 */

namespace MKL\PC\Admin\Data_Migration;

use MKL\PC\DB;
use MKL\PC\Global_Configurators\Owner_Resolver;
use MKL\PC\Global_Configurators\Storage_Owner;
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
		$parent_id    = (int) $parent_id;
		$owner_parent = self::resolve_owner( $parent_id, 0 );
		if ( ! $owner_parent ) {
			return false;
		}
		if ( self::layers_blob_is_non_empty( $owner_parent ) ) {
			return true;
		}
		$db          = mkl_pc()->db;
		$content_pid = $db->get_product_id_for_content( $parent_id, (int) $variation_id );
		$owner_c     = self::resolve_owner( $content_pid, (int) $variation_id, 'content' );
		return $owner_c && self::content_blob_is_non_empty( $owner_c );
	}

	/**
	 * @param int $parent_id
	 * @param int $variation_id
	 * @return bool
	 */
	public static function delete_legacy_blobs( $parent_id, $variation_id = 0 ) {
		$parent_id    = (int) $parent_id;
		$owner_parent = self::resolve_owner( $parent_id, 0 );
		if ( ! $owner_parent ) {
			return false;
		}
		$owner_parent_id = $owner_parent->get_id();
		$owner_parent->delete_meta( '_mkl_product_configurator_layers' );
		$owner_parent->save();
		do_action( 'wpml_sync_custom_field', $owner_parent_id, '_mkl_product_configurator_layers' );

		$db              = mkl_pc()->db;
		$content_pid     = $db->get_product_id_for_content( $parent_id, (int) $variation_id );
		$owner_content   = self::resolve_owner( $content_pid, (int) $variation_id, 'content' );
		$owner_content_id = $owner_content ? $owner_content->get_id() : 0;
		if ( $owner_content ) {
			$owner_content->delete_meta( '_mkl_product_configurator_content' );
			$owner_content->save();
			do_action( 'wpml_sync_custom_field', $owner_content_id, '_mkl_product_configurator_content' );
		}

		self::flush_object_caches( $owner_parent_id );
		if ( $owner_content_id && $owner_content_id !== $owner_parent_id ) {
			self::flush_object_caches( $owner_content_id );
		}
		self::invalidate_integrity_cache( $owner_parent_id );
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
		$owner_parent = self::resolve_owner( $parent_id, 0 );
		if ( ! $owner_parent ) {
			return new WP_Error( 'mkl_pc_invalid_product', __( 'Invalid product.', 'product-configurator-for-woocommerce' ) );
		}
		$owner_parent_id = $owner_parent->get_id();

		self::delete_chunk_metas_matching_regexp_on_owner( $owner_parent, '^_mkl_product_configurator_layer_[0-9]+$' );
		$owner_parent->delete_meta( '_mkl_product_configurator_layers_index' );
		$owner_parent->delete_meta( DB::META_STORAGE_FORMAT_VERSION );
		$owner_parent->delete_meta( DB::META_INTEGRITY_CACHE );

		$db              = mkl_pc()->db;
		$content_pid     = (int) $db->get_product_id_for_content( $parent_id, (int) $variation_id );
		$owner_content   = self::resolve_owner( $content_pid, (int) $variation_id, 'content' );
		$owner_content_id = $owner_content ? $owner_content->get_id() : 0;

		if ( $owner_content && $owner_content_id !== $owner_parent_id ) {
			self::delete_chunk_metas_matching_regexp_on_owner( $owner_content, '^_mkl_product_configurator_content_[0-9]+$' );
			$owner_content->save();
		} else {
			self::delete_chunk_metas_matching_regexp_on_owner( $owner_parent, '^_mkl_product_configurator_content_[0-9]+$' );
		}

		$owner_parent->save();
		do_action( 'wpml_sync_custom_field', $owner_parent_id, '_mkl_product_configurator_layers_index' );
		do_action( 'wpml_sync_custom_field', $owner_parent_id, DB::META_STORAGE_FORMAT_VERSION );
		do_action( 'wpml_sync_custom_field', $owner_parent_id, DB::META_INTEGRITY_CACHE );

		self::flush_object_caches( $owner_parent_id );
		if ( $owner_content_id && $owner_content_id !== $owner_parent_id ) {
			self::flush_object_caches( $owner_content_id );
		}
		return true;
	}

	/**
	 * Resolve a {@see Storage_Owner} that can be a product, variation, or global configurator CPT.
	 *
	 * @param int    $post_id
	 * @param int    $variation_id
	 * @param string $component
	 * @return Storage_Owner|null
	 */
	private static function resolve_owner( $post_id, $variation_id = 0, $component = 'layers' ) {
		$post_id = (int) $post_id;
		if ( $post_id <= 0 ) {
			return null;
		}
		$owner_id = class_exists( Owner_Resolver::class )
			? (int) Owner_Resolver::resolve_storage_owner_id( $post_id, (int) $variation_id, (string) $component )
			: $post_id;
		if ( $owner_id <= 0 ) {
			$owner_id = $post_id;
		}
		return Storage_Owner::for_post( $owner_id );
	}

	/**
	 * @param Storage_Owner $owner
	 * @param string        $regexp Full PCRE pattern for meta_key (MySQL REGEXP).
	 * @return void
	 */
	private static function delete_chunk_metas_matching_regexp_on_owner( Storage_Owner $owner, $regexp ) {
		global $wpdb;
		$post_id = (int) $owner->get_id();
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
			$owner->delete_meta( $meta_key );
			do_action( 'wpml_sync_custom_field', $post_id, $meta_key );
		}
	}

	/**
	 * @param Storage_Owner|WC_Product $product
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
	 * @param Storage_Owner|WC_Product $product
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
		$owner = Storage_Owner::for_post( (int) $parent_id );
		if ( ! $owner ) {
			return;
		}
		$owner->update_meta( DB::META_INTEGRITY_CACHE, 0 );
		$owner->save();
		do_action( 'wpml_sync_custom_field', (int) $parent_id, DB::META_INTEGRITY_CACHE );
	}
}
