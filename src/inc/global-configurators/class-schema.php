<?php
/**
 * Constants for the global configurator CPT, product link meta keys, and owner types.
 *
 * @package MKL\PC\Global_Configurators
 */

namespace MKL\PC\Global_Configurators;

defined( 'ABSPATH' ) || exit;

/**
 * Static schema definitions shared by CPT registration, the resolver, admin UI, and invalidation.
 */
final class Schema {
	/**
	 * Post type slug for global configurator posts.
	 *
	 * Must be 20 characters or fewer (WordPress enforces this in register_post_type()).
	 * Current value is exactly 20 characters.
	 */
	const CPT_SLUG = 'mkl_pc_global_config';

	/**
	 * Product meta storing whether the product owns its configurator (`local`) or points to a CPT (`global`).
	 * Stored on the parent product (simple or variable). Variations inherit their parent's source.
	 */
	const META_SOURCE = '_mkl_pc_configurator_source';

	/**
	 * Product meta storing the linked global configurator post id when META_SOURCE === 'global'.
	 */
	const META_GLOBAL_ID = '_mkl_pc_global_configurator_id';

	const SOURCE_LOCAL  = 'local';
	const SOURCE_GLOBAL = 'global';

	/**
	 * CPT meta that used to hold an exclusive apply mode (`selected` / `category`).
	 *
	 * The two targeting rules were never exclusive - an explicit per-product link resolves
	 * before the category rule and was never gated by this meta - so the radio it backed only
	 * managed to hide the category field and, worse, wipe the category ids on every switch.
	 * Products and categories are now independent, additive fields and nothing reads this key
	 * except the one-time cleanup in {@see Assignment::maybe_migrate_apply_mode()}.
	 *
	 * @deprecated Kept for that cleanup only. Never write it.
	 */
	const META_APPLY_MODE = '_mkl_pc_apply_mode';

	/**
	 * CPT meta: product_cat term ids this global configurator applies to.
	 *
	 * A non-empty list is what activates the category rule; there is no separate mode flag.
	 */
	const META_APPLY_CATEGORY_IDS = '_mkl_pc_apply_category_ids';

	/**
	 * Legacy values of META_APPLY_MODE.
	 *
	 * @deprecated Used only by the cleanup that removes the meta.
	 */
	const APPLY_MODE_SELECTED  = 'selected';
	const APPLY_MODE_CATEGORY  = 'category';

	const OWNER_TYPE_PRODUCT   = 'product';
	const OWNER_TYPE_VARIATION = 'product_variation';
	const OWNER_TYPE_GLOBAL    = 'mkl_pc_global_config';

	/**
	 * Object cache group reused across the module.
	 */
	const CACHE_GROUP = 'mkl_pc';

	/**
	 * Cache key prefix for the reverse lookup of a global configurator to the products that consume it.
	 *
	 * Intentionally avoids the `linked_product` naming used by the Stock Management add-on (where
	 * "linked product" means a WooCommerce product bound to a configurator choice for inventory/pricing).
	 */
	const CACHE_CONSUMERS_PREFIX = 'mkl_pc_gconf_consumers_';

	/**
	 * Object-cache key for the category-id → global-configurator-id index.
	 */
	const CACHE_CATEGORY_INDEX = 'mkl_pc_gconf_category_index';

	/**
	 * Whether the provided post id points at a global configurator CPT row.
	 *
	 * @param int $post_id
	 * @return bool
	 */
	public static function is_global_configurator_id( $post_id ) {
		$post_id = (int) $post_id;
		if ( $post_id <= 0 ) {
			return false;
		}
		return self::CPT_SLUG === get_post_type( $post_id );
	}
}
