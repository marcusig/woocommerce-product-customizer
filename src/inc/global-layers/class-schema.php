<?php
/**
 * Constants for the global layer CPT and its stored meta keys.
 *
 * @package MKL\PC\Global_Layer
 */

namespace MKL\PC\Global_Layer;

defined( 'ABSPATH' ) || exit;

/**
 * Static schema shared by CPT registration, CRUD, and the product-side linker.
 *
 * Namespace is singular (`Global_Layer`) because `MKL\PC\Global_Layers` is already the public
 * CRUD class; PHP cannot host a class and a child namespace under the same name without
 * awkward aliases.
 */
final class Schema {
	/**
	 * Post type slug holding a single reusable layer and its choices.
	 */
	const CPT_SLUG = 'mkl_global_layer';

	/**
	 * CPT meta: the layer definition (name, type, settings).
	 */
	const META_LAYER = '_mkl_pc_layer';

	/**
	 * CPT meta: the layer's choices.
	 */
	const META_CONTENT = '_mkl_pc_content';

	/**
	 * CPT meta: views snapshot the layer is edited against.
	 */
	const META_ANGLES = '_mkl_pc_angles';

	/**
	 * CPT meta: the configurator type this layer is authored for.
	 *
	 * Same key products and global configurators use, so `mkl_pc_get_configurator_type()` reads
	 * one meta name whatever kind of post owns the configurator. Absent on layers made global
	 * before this meta existed; `Global_Layers::get_type()` derives a value for those.
	 */
	const META_TYPE = MKL_PC_PREFIX . '_configurator_type';

	/**
	 * CPT meta: ids of products / variations / global configurators known to reference this layer.
	 *
	 * The list is a cache-invalidation index, not a source of truth: an entry that has since
	 * stopped using the layer only means one extra cache rebuild.
	 */
	const META_CONSUMERS = '_mkl_pc_global_layer_consumers';

	/**
	 * Whether the id points at a global layer post.
	 *
	 * @param int $post_id
	 * @return bool
	 */
	public static function is_global_layer_id( $post_id ) {
		$post_id = (int) $post_id;
		if ( $post_id <= 0 ) {
			return false;
		}
		return self::CPT_SLUG === get_post_type( $post_id );
	}
}
