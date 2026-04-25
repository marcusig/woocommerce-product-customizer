<?php
/**
 * Resolves the effective configurator storage owner for a given product / variation context.
 *
 * @package MKL\PC\Global_Configurators
 */

namespace MKL\PC\Global_Configurators;

defined( 'ABSPATH' ) || exit;

/**
 * Central lookup for local vs global configurator ownership.
 *
 * A product is either in `local` mode (storage lives on the product or per-variation) or
 * `global` mode (storage lives on a shared CPT). Variations inherit their parent's source.
 * Variable products can only use `global` mode when the parent is `share_all_config`.
 */
final class Owner_Resolver {

	/**
	 * Return the source mode (`local` / `global`) for a product/variation.
	 * Variations inherit from parent. Invalid or missing meta defaults to `local`.
	 *
	 * @param int $product_id
	 * @return string
	 */
	public static function get_source( $product_id ) {
		$product_id = (int) $product_id;
		if ( $product_id <= 0 ) {
			return Schema::SOURCE_LOCAL;
		}
		$parent_id = self::get_parent_id_for_source( $product_id );
		if ( $parent_id <= 0 ) {
			return Schema::SOURCE_LOCAL;
		}
		$source = get_post_meta( $parent_id, Schema::META_SOURCE, true );
		if ( Schema::SOURCE_GLOBAL !== $source ) {
			return Schema::SOURCE_LOCAL;
		}
		return Schema::SOURCE_GLOBAL;
	}

	/**
	 * Return the linked global configurator post id for a product, or 0 when local / not set.
	 *
	 * @param int $product_id
	 * @return int
	 */
	public static function get_global_id( $product_id ) {
		$product_id = (int) $product_id;
		if ( $product_id <= 0 ) {
			return 0;
		}
		if ( Schema::is_global_configurator_id( $product_id ) ) {
			return $product_id;
		}
		$parent_id = self::get_parent_id_for_source( $product_id );
		if ( $parent_id <= 0 ) {
			return 0;
		}
		if ( Schema::SOURCE_GLOBAL !== get_post_meta( $parent_id, Schema::META_SOURCE, true ) ) {
			return 0;
		}
		$global_id = (int) get_post_meta( $parent_id, Schema::META_GLOBAL_ID, true );
		if ( $global_id <= 0 ) {
			return 0;
		}
		if ( ! Schema::is_global_configurator_id( $global_id ) ) {
			return 0;
		}
		return $global_id;
	}

	/**
	 * Whether the given product is allowed to use a global configurator.
	 *
	 * - Simple products: always allowed.
	 * - Variable products: only when `_mkl_pc__variable_configuration_mode` is `share_all_config`.
	 * - Variations: inherit from parent.
	 * - Global CPT ids: always allowed.
	 *
	 * @param int $product_id
	 * @return bool
	 */
	public static function can_use_global( $product_id ) {
		$product_id = (int) $product_id;
		if ( $product_id <= 0 ) {
			return false;
		}
		if ( Schema::is_global_configurator_id( $product_id ) ) {
			return true;
		}
		$post_type = get_post_type( $product_id );
		if ( 'product_variation' === $post_type ) {
			$parent_id = (int) wp_get_post_parent_id( $product_id );
			return $parent_id > 0 ? self::can_use_global( $parent_id ) : false;
		}
		if ( 'product' !== $post_type ) {
			return false;
		}
		if ( ! function_exists( 'wc_get_product' ) ) {
			return false;
		}
		$product = wc_get_product( $product_id );
		if ( ! $product || ! is_a( $product, 'WC_Product' ) ) {
			return false;
		}
		if ( 'variable' !== $product->get_type() ) {
			return true;
		}
		$mode = $product->get_meta( MKL_PC_PREFIX . '_variable_configuration_mode', true );
		return 'share_all_config' === $mode;
	}

	/**
	 * Owner kind for use by storage/caching code.
	 *
	 * @param int $post_id
	 * @return string One of Schema::OWNER_TYPE_*.
	 */
	public static function owner_type( $post_id ) {
		$post_id = (int) $post_id;
		if ( $post_id <= 0 ) {
			return Schema::OWNER_TYPE_PRODUCT;
		}
		$post_type = get_post_type( $post_id );
		if ( Schema::CPT_SLUG === $post_type ) {
			return Schema::OWNER_TYPE_GLOBAL;
		}
		if ( 'product_variation' === $post_type ) {
			return Schema::OWNER_TYPE_VARIATION;
		}
		return Schema::OWNER_TYPE_PRODUCT;
	}

	/**
	 * Resolve which post id actually stores configurator meta for a given selling context.
	 *
	 * Keeps existing per-product / per-variation logic for local mode, and redirects to the
	 * linked global CPT when the product is in global mode and allowed to use it.
	 *
	 * @param int $product_id   Logical product id (simple, variable parent, or variation).
	 * @param int $variation_id Optional variation id when editing a variation's content.
	 * @param string $component Optional component hint ('layers', 'content', 'angles', ...).
	 * @return int Storage owner post id. Never 0 for valid products.
	 */
	public static function resolve_storage_owner_id( $product_id, $variation_id = 0, $component = '' ) {
		$product_id   = (int) $product_id;
		$variation_id = (int) $variation_id;

		if ( $product_id <= 0 ) {
			return 0;
		}

		if ( Schema::is_global_configurator_id( $product_id ) ) {
			return $product_id;
		}

		$global_id = self::get_global_id( $product_id );
		if ( $global_id > 0 && self::can_use_global( $product_id ) ) {
			return $global_id;
		}

		// Local storage: keep existing variable-mode rules for content vs. layers/angles.
		if ( 'content' === $component ) {
			$parent = function_exists( 'wc_get_product' ) ? wc_get_product( $product_id ) : null;
			if ( $parent && is_a( $parent, 'WC_Product' ) ) {
				$mode = $parent->get_meta( MKL_PC_PREFIX . '_variable_configuration_mode', true );
				if ( ( ! $mode || 'share_layers_config' === $mode ) && $variation_id > 0 ) {
					return $variation_id;
				}
			}
			return $product_id;
		}

		// Layers/angles always on the parent/product id when local.
		$parent_id = self::get_parent_id_for_source( $product_id );
		return $parent_id > 0 ? $parent_id : $product_id;
	}

	/**
	 * Get product ids that currently consume a given global configurator. Cached.
	 *
	 * Naming note: avoids the Stock Management add-on's "linked product" terminology.
	 *
	 * @param int $global_id
	 * @return int[]
	 */
	public static function get_consumer_product_ids( $global_id ) {
		$global_id = (int) $global_id;
		if ( $global_id <= 0 ) {
			return array();
		}
		$cache_key = Schema::CACHE_CONSUMERS_PREFIX . $global_id;
		$cached    = wp_cache_get( $cache_key, Schema::CACHE_GROUP );
		if ( is_array( $cached ) ) {
			return $cached;
		}
		global $wpdb;
		$rows = $wpdb->get_col(
			$wpdb->prepare(
				"SELECT post_id FROM {$wpdb->postmeta} WHERE meta_key = %s AND meta_value = %s",
				Schema::META_GLOBAL_ID,
				(string) $global_id
			)
		);
		$ids = array();
		if ( is_array( $rows ) ) {
			foreach ( $rows as $row_id ) {
				$row_id = (int) $row_id;
				if ( $row_id <= 0 ) {
					continue;
				}
				$source = get_post_meta( $row_id, Schema::META_SOURCE, true );
				if ( Schema::SOURCE_GLOBAL !== $source ) {
					continue;
				}
				$post_type = get_post_type( $row_id );
				if ( 'product' !== $post_type ) {
					continue;
				}
				$ids[] = $row_id;
			}
		}
		$ids = array_values( array_unique( $ids ) );
		wp_cache_set( $cache_key, $ids, Schema::CACHE_GROUP, 3600 );
		return $ids;
	}

	/**
	 * Invalidate the reverse-lookup cache for a global configurator's consumer products.
	 *
	 * @param int $global_id
	 * @return void
	 */
	public static function invalidate_consumers_cache( $global_id ) {
		$global_id = (int) $global_id;
		if ( $global_id <= 0 ) {
			return;
		}
		wp_cache_delete( Schema::CACHE_CONSUMERS_PREFIX . $global_id, Schema::CACHE_GROUP );
	}

	/**
	 * Whether the given post is an admin-editable configurator owner (product or CPT).
	 *
	 * @param int $post_id
	 * @return bool
	 */
	public static function is_configurator_owner( $post_id ) {
		$post_id = (int) $post_id;
		if ( $post_id <= 0 ) {
			return false;
		}
		$post_type = get_post_type( $post_id );
		if ( false === $post_type ) {
			return false;
		}
		if ( Schema::CPT_SLUG === $post_type ) {
			return true;
		}
		return in_array( $post_type, array( 'product', 'product_variation' ), true );
	}

	/**
	 * Return the post id where source meta lives for a given product context (variation -> parent).
	 * Returns the provided id for simple products and CPTs.
	 *
	 * @param int $product_id
	 * @return int
	 */
	private static function get_parent_id_for_source( $product_id ) {
		$product_id = (int) $product_id;
		if ( $product_id <= 0 ) {
			return 0;
		}
		$post_type = get_post_type( $product_id );
		if ( 'product_variation' === $post_type ) {
			return (int) wp_get_post_parent_id( $product_id );
		}
		return $product_id;
	}
}
