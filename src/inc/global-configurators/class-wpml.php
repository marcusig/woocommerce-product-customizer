<?php
/**
 * WPML / multilingual handling for the global configurator CPT and its link meta.
 *
 * @package MKL\PC\Global_Configurators
 */

namespace MKL\PC\Global_Configurators;

defined( 'ABSPATH' ) || exit;

/**
 * - When a product is duplicated for translation, Source/Global-ID metas should be duplicated as-is
 *   (same source mode, same CPT id) because the CPT itself is language-agnostic from our side.
 * - When a CPT row is duplicated for translation, do not duplicate the linked-product reverse cache.
 * - Fires wpml_sync_custom_field for the new metas on data-copier / link-change flows.
 */
final class Wpml {

	/** @var bool */
	private static $did_init = false;

	/**
	 * @return void
	 */
	public static function init() {
		if ( self::$did_init ) {
			return;
		}
		self::$did_init = true;

		add_action( 'mkl_pc/global_configurators/linked', array( __CLASS__, 'sync_link_meta' ), 10, 3 );
		add_action( 'mkl_pc/global_configurators/unlinked', array( __CLASS__, 'sync_link_meta' ), 10, 3 );
		add_action( 'mkl_pc/global_configurators/source_changed', array( __CLASS__, 'sync_link_meta' ), 10, 3 );

		add_filter( 'mkl_pc/global_configurators/apply_category_ids', array( __CLASS__, 'expand_category_ids_for_languages' ), 10, 2 );

		add_action( 'wpml_after_copy_custom_field', array( __CLASS__, 'after_copy_custom_field' ), 20, 3 );
		add_filter( 'wpml_elements_type_post_types_register_translatable', array( __CLASS__, 'filter_translatable_post_types' ), 10, 1 );
	}

	/**
	 * Sync the new link metas across languages when a product's linkage changes.
	 *
	 * @param int $product_id
	 * @param int $global_id
	 * @param mixed $extra
	 * @return void
	 */
	public static function sync_link_meta( $product_id, $global_id, $extra = null ) {
		$product_id = (int) $product_id;
		if ( $product_id <= 0 ) {
			return;
		}
		do_action( 'wpml_sync_custom_field', $product_id, Schema::META_SOURCE );
		do_action( 'wpml_sync_custom_field', $product_id, Schema::META_GLOBAL_ID );
	}

	/**
	 * Keep translation copies of link metas consistent (dedupe, mirror global id).
	 *
	 * @param int    $post_id_from
	 * @param int    $post_id_to
	 * @param string $meta_key
	 * @return void
	 */
	public static function after_copy_custom_field( $post_id_from, $post_id_to, $meta_key ) {
		if ( Schema::META_SOURCE !== $meta_key && Schema::META_GLOBAL_ID !== $meta_key ) {
			return;
		}
		$meta = get_post_meta( (int) $post_id_to, $meta_key, false );
		if ( is_array( $meta ) && 1 < count( $meta ) ) {
			$keep = end( $meta );
			delete_post_meta( (int) $post_id_to, $meta_key );
			add_post_meta( (int) $post_id_to, $meta_key, $keep );
		}
		if ( Schema::META_GLOBAL_ID === $meta_key ) {
			$global_id = (int) get_post_meta( (int) $post_id_to, Schema::META_GLOBAL_ID, true );
			if ( $global_id > 0 ) {
				Owner_Resolver::invalidate_consumers_cache( $global_id );
			}
		}
	}

	/**
	 * Don't auto-register the CPT as translatable at the post level (content is shared by design).
	 * Individual translatable strings live on layers/choices/angles via the existing languages pipeline.
	 *
	 * @param array<string, mixed> $config
	 * @return array<string, mixed>
	 */
	public static function filter_translatable_post_types( $config ) {
		if ( is_array( $config ) && isset( $config[ Schema::CPT_SLUG ] ) ) {
			unset( $config[ Schema::CPT_SLUG ] );
		}
		return $config;
	}

	/**
	 * Include translated product_cat term ids so category assignment matches every language.
	 *
	 * @param int[] $category_ids
	 * @param int   $global_id
	 * @return int[]
	 */
	public static function expand_category_ids_for_languages( $category_ids, $global_id ) {
		unset( $global_id );
		if ( ! is_array( $category_ids ) || empty( $category_ids ) ) {
			return $category_ids;
		}
		if ( ! has_filter( 'wpml_object_id' ) ) {
			return $category_ids;
		}
		$languages = apply_filters( 'wpml_active_languages', null, array( 'skip_missing' => 0 ) );
		if ( ! is_array( $languages ) || empty( $languages ) ) {
			return $category_ids;
		}
		$expanded = $category_ids;
		foreach ( $category_ids as $term_id ) {
			$term_id = (int) $term_id;
			if ( $term_id <= 0 ) {
				continue;
			}
			foreach ( array_keys( $languages ) as $language_code ) {
				$translated = apply_filters( 'wpml_object_id', $term_id, 'product_cat', false, $language_code );
				$translated = (int) $translated;
				if ( $translated > 0 ) {
					$expanded[] = $translated;
				}
			}
		}
		return array_values( array_unique( array_map( 'intval', $expanded ) ) );
	}
}
