<?php
namespace MKL\PC;

use MKL\PC\Global_Configurators\Cache_Invalidator;
use MKL\PC\Global_Layer\Linker;
use MKL\PC\Global_Layer\Schema;

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly
}

/**
 * Global Layers: CPT-backed CRUD helpers
 *
 * Stores shared layers and their content so multiple products can reference them.
 * Data metas:
 * - _mkl_pc_layer   (array)  Layer structure (name, image, settings...)
 * - _mkl_pc_content (array)  Layer choices/content structure
 *
 * CPT registration lives in Global_Layer\Cpt. Product-side reference expansion
 * (resolve / strip / reconcile / localize) lives in Global_Layer\Linker.
 */
class Global_Layers {

	/**
	 * Post type slug holding a single reusable layer and its choices.
	 */
	const CPT_SLUG = Schema::CPT_SLUG;

	/**
	 * Post meta on the global layer holding the ids of the owners that reference it.
	 *
	 * Owners are products, variations, or global configurator CPTs - whatever DB::get() resolved
	 * the layer for. The list is a cache-invalidation index, not a source of truth: an entry that
	 * has since stopped using the layer only means one extra cache rebuild.
	 */
	const CONSUMERS_META = Schema::META_CONSUMERS;

	/**
	 * @var bool
	 */
	private static $did_init = false;

	/**
	 * Whether the id points at a global layer post.
	 *
	 * @param int $post_id
	 * @return bool
	 */
	public static function is_global_layer_id( $post_id ) {
		return Schema::is_global_layer_id( $post_id );
	}

	/**
	 * Register lifecycle hooks. CPT registration is handled by Global_Layer\Cpt.
	 *
	 * @return void
	 */
	public static function init() {
		if ( self::$did_init ) {
			return;
		}
		self::$did_init = true;

		// A global layer is read through the products that reference it, so every one of them
		// holds a cached copy of its data - an object cache entry, an editor transient, and a
		// static config file that never expires on its own. None of that is touched by saving
		// the layer post, so without this the layer changes and the storefront keeps serving
		// the old choices until each product happens to be saved again.
		add_action( 'mkl_pc_saved_global_layer', array( __CLASS__, 'on_saved' ), 20, 1 );
		add_action( 'trashed_post', array( __CLASS__, 'on_post_status_changed' ), 20, 1 );
		add_action( 'untrashed_post', array( __CLASS__, 'on_post_status_changed' ), 20, 1 );
		add_action( 'before_delete_post', array( __CLASS__, 'on_before_delete' ), 20, 1 );
	}

	/**
	 * Get a global layer by post ID
	 *
	 * @param int $global_id
	 * @return array{layer: array|false, content: array|false}
	 */
	public static function get( $global_id ) {
		$global_id = intval( $global_id );
		if ( $global_id <= 0 ) {
			return array( 'layer' => false, 'content' => false );
		}
		$layer   = get_post_meta( $global_id, Schema::META_LAYER, true );
		$content = get_post_meta( $global_id, Schema::META_CONTENT, true );
		$layer   = maybe_unserialize( $layer );
		$content = maybe_unserialize( $content );
		return array( 'layer' => $layer, 'content' => $content );
	}

	/**
	 * Normalize the stored content to a list of choices.
	 *
	 * The CPT stores either a bare list of choices or a `{ layerId, choices }` row, depending on
	 * which code path wrote it. Callers that need the choices always want the bare list.
	 *
	 * @param mixed $content Raw `_mkl_pc_content` value.
	 * @return array
	 */
	public static function normalize_choices( $content ) {
		if ( ! is_array( $content ) ) {
			return array();
		}
		if ( isset( $content['choices'] ) && is_array( $content['choices'] ) ) {
			return array_values( $content['choices'] );
		}
		return array_values( $content );
	}

	/**
	 * Views (angles) to edit this layer's images against.
	 *
	 * A global layer has no product of its own, so the views come from a snapshot taken when the
	 * layer was made global or last saved from a product editor. Older layers have no snapshot, so
	 * fall back to the view ids their images already reference, then to a single default view.
	 *
	 * @param int $global_id
	 * @return array<int, array<string, mixed>>
	 */
	public static function get_angles( $global_id ) {
		$global_id = intval( $global_id );
		if ( $global_id <= 0 ) {
			return array();
		}

		$stored = maybe_unserialize( get_post_meta( $global_id, Schema::META_ANGLES, true ) );
		if ( is_array( $stored ) && ! empty( $stored ) ) {
			$angles = array_values( $stored );
		} else {
			$data   = self::get( $global_id );
			$angles = self::derive_angles_from_choices( self::normalize_choices( $data['content'] ) );
		}

		if ( empty( $angles ) ) {
			$angles = array(
				array(
					'_id'   => 1,
					'id'    => 1,
					'name'  => __( 'View 1', 'product-configurator-for-woocommerce' ),
					'order' => 1,
				),
			);
		}

		/**
		 * Filter the views a global layer is edited against.
		 *
		 * @param array $angles
		 * @param int   $global_id
		 */
		return apply_filters( 'mkl_pc_global_layer_angles', $angles, $global_id );
	}

	/**
	 * Rebuild a minimal views list from the view ids the stored images reference.
	 *
	 * @param array $choices
	 * @return array<int, array<string, mixed>>
	 */
	private static function derive_angles_from_choices( $choices ) {
		$ids = array();
		foreach ( $choices as $choice ) {
			if ( ! is_array( $choice ) || empty( $choice['images'] ) || ! is_array( $choice['images'] ) ) {
				continue;
			}
			foreach ( $choice['images'] as $image ) {
				if ( ! is_array( $image ) || ! isset( $image['angleId'] ) ) {
					continue;
				}
				$angle_id = intval( $image['angleId'] );
				if ( $angle_id > 0 ) {
					$ids[ $angle_id ] = true;
				}
			}
		}
		if ( empty( $ids ) ) {
			return array();
		}

		$ids = array_keys( $ids );
		sort( $ids );

		$angles = array();
		foreach ( $ids as $index => $angle_id ) {
			$angles[] = array(
				'_id'   => $angle_id,
				'id'    => $angle_id,
				/* translators: %d: view number */
				'name'  => sprintf( __( 'View %d', 'product-configurator-for-woocommerce' ), $index + 1 ),
				'order' => $index + 1,
			);
		}
		return $angles;
	}

	/**
	 * Attribute names whose presence marks a layer or choice as carrying 3D payload.
	 *
	 * @var string[]
	 */
	private static $threed_attributes = array( 'object_3d_id', 'target_object_id', 'actions_3d' );

	/**
	 * The configurator type this layer is authored for.
	 *
	 * A global layer post is not a product, so `mkl_pc_get_configurator_type()` delegates here.
	 * The stored meta wins: it is stamped from the configurator the layer was made global in, and
	 * it is the only answer available to a layer that is still empty. Layers made global before
	 * that meta existed fall back to what their data already says, which keeps their 3D settings
	 * reachable without a migration pass.
	 *
	 * @param int $global_id
	 * @return string Type key, or '' when the id is not a global layer.
	 */
	public static function get_type( $global_id ) {
		$global_id = intval( $global_id );
		if ( $global_id <= 0 ) {
			return '';
		}

		$type = get_post_meta( $global_id, Schema::META_TYPE, true );
		if ( ! mkl_pc_is_valid_configurator_type( $type ) ) {
			$data = self::get( $global_id );
			$type = self::derive_type_from_data( $data['layer'], self::normalize_choices( $data['content'] ) );
		}

		/**
		 * Filter the configurator type a global layer is edited as.
		 *
		 * @param string $type
		 * @param int    $global_id
		 */
		return apply_filters( 'mkl_pc_global_layer_configurator_type', $type, $global_id );
	}

	/**
	 * Read a layer's type back out of its own data, for layers stored before the type was stamped.
	 *
	 * Presence of 3D payload is the only signal available. Absence is not proof of a 2D layer -
	 * an empty layer made global in a 3D configurator looks identical to a 2D one here - which is
	 * why this is the fallback and the stamped meta is the source of truth.
	 *
	 * @param mixed $layer   Layer definition.
	 * @param array $choices Normalized choice list.
	 * @return string
	 */
	private static function derive_type_from_data( $layer, $choices ) {
		if ( self::has_3d_payload( $layer ) ) {
			return '3d';
		}
		foreach ( $choices as $choice ) {
			if ( self::has_3d_payload( $choice ) ) {
				return '3d';
			}
		}
		return 'configurator';
	}

	/**
	 * Whether a layer or choice array carries a non-empty 3D setting.
	 *
	 * @param mixed $item
	 * @return bool
	 */
	private static function has_3d_payload( $item ) {
		if ( ! is_array( $item ) ) {
			return false;
		}
		foreach ( self::$threed_attributes as $attribute ) {
			if ( ! empty( $item[ $attribute ] ) ) {
				return true;
			}
		}
		return false;
	}

	/**
	 * Create or update a global layer
	 *
	 * @param array       $layer     Layer structure
	 * @param array       $content   Content/choices structure for that layer
	 * @param int|null    $global_id Existing post ID to update, or null to create
	 * @param array|null  $angles    Views snapshot from the editing product, or null to keep the stored one
	 * @param string|null $type      Configurator type of the editing product, or null to keep the stored one
	 * @return int|\WP_Error The post ID on success
	 */
	public static function save( $layer, $content, $global_id = null, $angles = null, $type = null ) {
		$postarr = array(
			'post_type'   => self::CPT_SLUG,
			'post_status' => 'publish',
			'post_title'  => isset( $layer['name'] ) ? sanitize_text_field( $layer['name'] ) : 'Global Layer',
		);
		if ( $global_id ) {
			$postarr['ID'] = intval( $global_id );
			$global_id     = wp_update_post( $postarr, true );
		} else {
			$global_id = wp_insert_post( $postarr, true );
		}
		if ( is_wp_error( $global_id ) ) {
			return $global_id;
		}
		$layer   = self::normalize_for_set( $layer, (int) $global_id, 'layers' );
		$content = self::normalize_for_set( $content, (int) $global_id, 'content' );
		update_post_meta( $global_id, Schema::META_LAYER, $layer );
		update_post_meta( $global_id, Schema::META_CONTENT, self::normalize_content_for_storage( $content ) );
		if ( is_array( $angles ) && ! empty( $angles ) ) {
			update_post_meta( $global_id, Schema::META_ANGLES, array_values( $angles ) );
		}
		if ( mkl_pc_is_valid_configurator_type( $type ) ) {
			update_post_meta( $global_id, Schema::META_TYPE, $type );
		}
		return $global_id;
	}

	/**
	 * Delete a global layer
	 *
	 * @param int $global_id
	 * @return bool
	 */
	public static function delete( $global_id ) {
		$global_id = intval( $global_id );
		if ( $global_id <= 0 ) {
			return false;
		}
		return (bool) wp_delete_post( $global_id, true );
	}

	/**
	 * Update only a global layer's choices, leaving its layer definition alone.
	 *
	 * @param int   $global_id
	 * @param array $choices
	 * @return bool
	 */
	public static function save_content( $global_id, $choices ) {
		$global_id = intval( $global_id );
		if ( $global_id <= 0 || ! self::is_global_layer_id( $global_id ) ) {
			return false;
		}
		$choices = self::normalize_for_set( $choices, $global_id, 'content' );
		update_post_meta( $global_id, Schema::META_CONTENT, self::normalize_content_for_storage( $choices ) );
		do_action( 'mkl_pc_saved_global_layer_content', $global_id, $choices );
		self::on_saved( $global_id );
		return true;
	}

	/**
	 * Canonical storage shape for a global layer's content: a bare list of choices.
	 *
	 * Each choice is stored without its `layerId`. The value it arrives with is the id of the
	 * layer the choice was authored in, which means nothing to the other products the layer is
	 * shared with - they each place it under a layer id of their own, and the frontend resolves
	 * a choice's layer with `PC.fe.layers.get( choice.layerId )`. Keeping the authoring id here
	 * detached every choice from the layer it was being shown in. Consumers get the right value
	 * stamped on at read time - see Linker::stamp_choices_layer_id().
	 *
	 * @param mixed $content Raw content, either a bare list of choices or `{ layerId, choices }`.
	 * @return array
	 */
	public static function normalize_content_for_storage( $content ) {
		$choices = self::normalize_choices( $content );
		foreach ( $choices as $index => $choice ) {
			if ( ! is_array( $choice ) ) {
				continue;
			}
			unset( $choices[ $index ]['layerId'] );
		}
		return array_values( $choices );
	}

	/**
	 * Run the same save-time normalization product data uses (strip `active`, choice filter).
	 *
	 * `DB::normalize_for_set()` expects a list of layers or of content rows. A global layer
	 * is one layer and either a content row or a bare choice list, so this wraps and unwraps.
	 *
	 * @param mixed  $data
	 * @param int    $owner_id
	 * @param string $component `layers` or `content`.
	 * @return mixed
	 */
	private static function normalize_for_set( $data, $owner_id, $component ) {
		$db = mkl_pc( 'db' );
		if ( ! $db || ! is_array( $data ) ) {
			return $data;
		}

		if ( 'layers' === $component ) {
			$normalized = $db->normalize_for_set( array( $data ), $owner_id, 'layers', false );
			return ( isset( $normalized[0] ) && is_array( $normalized[0] ) ) ? $normalized[0] : $data;
		}

		$is_content_row = isset( $data['choices'] ) && is_array( $data['choices'] );
		$row            = $is_content_row ? $data : array( 'choices' => array_values( $data ) );
		$normalized     = $db->normalize_for_set( array( $row ), $owner_id, 'content', false );
		$row            = ( isset( $normalized[0] ) && is_array( $normalized[0] ) ) ? $normalized[0] : $row;

		if ( $is_content_row ) {
			return $row;
		}
		return ( isset( $row['choices'] ) && is_array( $row['choices'] ) ) ? $row['choices'] : $data;
	}

	/**
	 * Owners known to reference this global layer.
	 *
	 * @param int $global_id
	 * @return int[]
	 */
	public static function get_consumer_ids( $global_id ) {
		$global_id = intval( $global_id );
		if ( $global_id <= 0 ) {
			return array();
		}
		$ids = get_post_meta( $global_id, self::CONSUMERS_META, true );
		$ids = maybe_unserialize( $ids );
		if ( ! is_array( $ids ) ) {
			return array();
		}
		return array_values( array_unique( array_filter( array_map( 'intval', $ids ) ) ) );
	}

	/**
	 * Record that an owner reads this global layer, so its caches can be flushed when it changes.
	 *
	 * Called from the read path, which is the only place that reliably sees every reference:
	 * a layer can be linked by "Make global", by importing it, or by copying the meta of a
	 * product that already used it. The write is skipped once the id is on the list, so this
	 * costs one query the first time a given pair is resolved and nothing afterwards.
	 *
	 * @param int $global_id
	 * @param int $owner_id
	 * @return void
	 */
	public static function register_consumer( $global_id, $owner_id ) {
		$global_id = intval( $global_id );
		$owner_id  = intval( $owner_id );
		if ( $global_id <= 0 || $owner_id <= 0 || $global_id === $owner_id ) {
			return;
		}
		$ids = self::get_consumer_ids( $global_id );
		if ( in_array( $owner_id, $ids, true ) ) {
			return;
		}
		$ids[] = $owner_id;
		update_post_meta( $global_id, self::CONSUMERS_META, $ids );
	}

	/**
	 * Flush the caches of everything that reads this global layer.
	 *
	 * @param int $global_id
	 * @return void
	 */
	public static function invalidate_consumers( $global_id ) {
		$global_id = intval( $global_id );
		if ( $global_id <= 0 ) {
			return;
		}

		$consumers = self::get_consumer_ids( $global_id );

		// The index is built from reads, so it collects owners that have since been deleted or
		// stopped using the layer. Invalidating those is harmless but pointless, and this is the
		// one moment - an editor saving a layer - where checking is affordable.
		$live = array();
		foreach ( $consumers as $consumer_id ) {
			if ( get_post_status( (int) $consumer_id ) ) {
				$live[] = (int) $consumer_id;
			}
		}
		if ( count( $live ) !== count( $consumers ) ) {
			update_post_meta( $global_id, self::CONSUMERS_META, $live );
			$consumers = $live;
		}

		/**
		 * Filter the owners whose caches are flushed when a global layer changes.
		 *
		 * @param int[] $consumers Product, variation, or global configurator ids.
		 * @param int   $global_id
		 */
		$consumers = apply_filters( 'mkl_pc_global_layer_consumers', $consumers, $global_id );

		if ( ! is_array( $consumers ) || empty( $consumers ) ) {
			return;
		}

		foreach ( $consumers as $consumer_id ) {
			$consumer_id = intval( $consumer_id );
			if ( $consumer_id <= 0 ) {
				continue;
			}
			// A global configurator consumer stands in for every product linked to it, so this
			// has to cascade rather than stop at the CPT.
			if ( class_exists( Cache_Invalidator::class ) ) {
				Cache_Invalidator::invalidate_owner_and_consumers( $consumer_id );
			}
		}
	}

	/**
	 * Saving the layer invalidates every consumer.
	 *
	 * @param int $global_id
	 * @return void
	 */
	public static function on_saved( $global_id ) {
		self::invalidate_consumers( intval( $global_id ) );
	}

	/**
	 * Trashing or restoring a global layer changes nothing about the stored references, but the
	 * layer post it resolves through can come and go, so the consumers have to be rebuilt.
	 *
	 * @param int $post_id
	 * @return void
	 */
	public static function on_post_status_changed( $post_id ) {
		if ( ! self::is_global_layer_id( $post_id ) ) {
			return;
		}
		self::invalidate_consumers( intval( $post_id ) );
	}

	/**
	 * A global layer about to be deleted for good takes its choices with it, so copy them into
	 * every owner that still references it. Without this the reference stops resolving and the
	 * layer silently loses all of its choices on the storefront.
	 *
	 * @param int $post_id
	 * @return void
	 */
	public static function on_before_delete( $post_id ) {
		$post_id = intval( $post_id );
		if ( ! self::is_global_layer_id( $post_id ) ) {
			return;
		}

		foreach ( self::get_consumer_ids( $post_id ) as $consumer_id ) {
			Linker::localize( (int) $consumer_id, $post_id );
		}

		self::invalidate_consumers( $post_id );
	}

	/**
	 * List global layers (IDs and basic info)
	 *
	 * @param array $args
	 * @return int[]
	 */
	public static function list( $args = array() ) {
		$defaults = array(
			'post_type'      => self::CPT_SLUG,
			'post_status'    => 'publish',
			'posts_per_page' => -1,
			'fields'         => 'ids',
		);
		$q = new \WP_Query( wp_parse_args( $args, $defaults ) );
		return $q->posts;
	}
}
