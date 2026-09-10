<?php
namespace MKL\PC;

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly
}

/**
 * Global Layers: CPT registration and CRUD helpers
 *
 * Stores shared layers and their content so multiple products can reference them.
 * Data metas:
 * - _mkl_pc_layer   (array)  Layer structure (name, image, settings...)
 * - _mkl_pc_content (array)  Layer choices/content structure
 */
class Global_Layers {

	/**
	 * Post type slug holding a single reusable layer and its choices.
	 */
	const CPT_SLUG = 'mkl_global_layer';

	/**
	 * Whether the id points at a global layer post.
	 *
	 * @param int $post_id
	 * @return bool
	 */
	public static function is_global_layer_id( $post_id ) {
		$post_id = intval( $post_id );
		if ( $post_id <= 0 ) return false;
		return self::CPT_SLUG === get_post_type( $post_id );
	}

	/**
	 * Register hooks
	 */
	public static function init() {
		add_action( 'init', [ __CLASS__, 'register_cpt' ] );
		add_action( 'admin_init', [ __CLASS__, 'add_admin_hooks' ] );

		// A global layer is read through the products that reference it, so every one of them
		// holds a cached copy of its data - an object cache entry, an editor transient, and a
		// static config file that never expires on its own. None of that is touched by saving
		// the layer post, so without this the layer changes and the storefront keeps serving
		// the old choices until each product happens to be saved again.
		add_action( 'mkl_pc_saved_global_layer', [ __CLASS__, 'on_saved' ], 20, 1 );
		add_action( 'trashed_post', [ __CLASS__, 'on_post_status_changed' ], 20, 1 );
		add_action( 'untrashed_post', [ __CLASS__, 'on_post_status_changed' ], 20, 1 );
		add_action( 'before_delete_post', [ __CLASS__, 'on_before_delete' ], 20, 1 );
	}

	/**
	 * Add admin hooks for customizing the UI
	 */
	public static function add_admin_hooks() {
		if ( ! is_admin() ) return;
		
		// Customize admin columns
		add_filter( 'manage_mkl_global_layer_posts_columns', [ __CLASS__, 'set_custom_columns' ] );
		add_action( 'manage_mkl_global_layer_posts_custom_column', [ __CLASS__, 'custom_column_content' ], 10, 2 );
		
		// Make columns sortable
		add_filter( 'manage_edit-mkl_global_layer_sortable_columns', [ __CLASS__, 'set_sortable_columns' ] );
		
		// Keep Edit (it opens the configurator editor) but drop quick edit, which cannot edit layer data.
		add_filter( 'post_row_actions', [ __CLASS__, 'customize_row_actions' ], 10, 2 );
	}

	/**
	 * Register the mkl_global_layer CPT
	 */
	public static function register_cpt() {
		$labels = array(
			'name'                  => _x( 'Global Layers', 'Post Type General Name', 'product-configurator-for-woocommerce' ),
			'singular_name'         => _x( 'Global Layer', 'Post Type Singular Name', 'product-configurator-for-woocommerce' ),
			'menu_name'             => __( 'Global Layers', 'product-configurator-for-woocommerce' ),
			'name_admin_bar'        => __( 'Global Layer', 'product-configurator-for-woocommerce' ),
			'archives'              => __( 'Global Layer Archives', 'product-configurator-for-woocommerce' ),
			'attributes'            => __( 'Global Layer Attributes', 'product-configurator-for-woocommerce' ),
			'parent_item_colon'     => __( 'Parent Global Layer:', 'product-configurator-for-woocommerce' ),
			'all_items'             => __( 'Global Layers', 'product-configurator-for-woocommerce' ),
			'add_new_item'          => __( 'Add New Global Layer', 'product-configurator-for-woocommerce' ),
			'add_new'               => __( 'Add New', 'product-configurator-for-woocommerce' ),
			'new_item'              => __( 'New Global Layer', 'product-configurator-for-woocommerce' ),
			'edit_item'             => __( 'Edit Global Layer', 'product-configurator-for-woocommerce' ),
			'update_item'           => __( 'Update Global Layer', 'product-configurator-for-woocommerce' ),
			'view_item'             => __( 'View Global Layer', 'product-configurator-for-woocommerce' ),
			'view_items'            => __( 'View Global Layers', 'product-configurator-for-woocommerce' ),
			'search_items'          => __( 'Search Global Layer', 'product-configurator-for-woocommerce' ),
			'not_found'             => __( 'Not found', 'product-configurator-for-woocommerce' ),
			'not_found_in_trash'    => __( 'Not found in Trash', 'product-configurator-for-woocommerce' ),
			'featured_image'        => __( 'Featured Image', 'product-configurator-for-woocommerce' ),
			'set_featured_image'    => __( 'Set featured image', 'product-configurator-for-woocommerce' ),
			'remove_featured_image' => __( 'Remove featured image', 'product-configurator-for-woocommerce' ),
			'use_featured_image'    => __( 'Use as featured image', 'product-configurator-for-woocommerce' ),
			'insert_into_item'      => __( 'Insert into Global Layer', 'product-configurator-for-woocommerce' ),
			'uploaded_to_this_item' => __( 'Uploaded to this Global Layer', 'product-configurator-for-woocommerce' ),
			'items_list'            => __( 'Global Layers list', 'product-configurator-for-woocommerce' ),
			'items_list_navigation' => __( 'Global Layers list navigation', 'product-configurator-for-woocommerce' ),
			'filter_items_list'     => __( 'Filter Global Layers list', 'product-configurator-for-woocommerce' ),
		);
		$args = array(
			'label'                 => __( 'Global Layer', 'product-configurator-for-woocommerce' ),
			'description'           => __( 'Reusable layers that can be shared across multiple products', 'product-configurator-for-woocommerce' ),
			'labels'                => $labels,
			'supports'              => array( 'title' ),
			'hierarchical'          => false,
			'public'                => false,
			'show_ui'               => true,
			'show_in_menu'          => mkl_pc_get_admin_menu_slug(),
			'show_in_admin_bar'     => false,
			'show_in_nav_menus'     => false,
			'can_export'            => true,
			'has_archive'           => false,
			'exclude_from_search'   => true,
			'publicly_queryable'    => false,
			'capability_type'       => 'post',
			'show_in_rest'          => false,
		);
		register_post_type( 'mkl_global_layer', $args );
	}

	/**
	 * Set custom columns for the global layers list
	 */
	public static function set_custom_columns( $columns ) {
		// Remove date column
		unset( $columns['date'] );
		
		// Add custom columns
		$columns['layer_type'] = __( 'Layer Type', 'product-configurator-for-woocommerce' );
		$columns['layer_name'] = __( 'Layer Name', 'product-configurator-for-woocommerce' );
		$columns['choices_count'] = __( 'Choices', 'product-configurator-for-woocommerce' );
		
		return $columns;
	}

	/**
	 * Display custom column content
	 */
	public static function custom_column_content( $column, $post_id ) {
		$data = self::get( $post_id );
		
		switch ( $column ) {
			case 'layer_type':
				if ( $data['layer'] && isset( $data['layer']['type'] ) ) {
					echo esc_html( $data['layer']['type'] );
				} else {
					echo '<span aria-label="' . esc_attr__( 'Unknown', 'product-configurator-for-woocommerce' ) . '">—</span>';
				}
				break;
				
			case 'layer_name':
				if ( $data['layer'] && isset( $data['layer']['name'] ) ) {
					echo esc_html( $data['layer']['name'] );
				} else {
					echo '<span aria-label="' . esc_attr__( 'Unknown', 'product-configurator-for-woocommerce' ) . '">—</span>';
				}
				break;
				
			case 'choices_count':
				echo esc_html( (string) count( self::normalize_choices( $data['content'] ) ) );
				break;
		}
	}

	/**
	 * Set sortable columns
	 */
	public static function set_sortable_columns( $columns ) {
		$columns['layer_type'] = 'layer_type';
		$columns['layer_name'] = 'layer_name';
		$columns['choices_count'] = 'choices_count';
		return $columns;
	}

	/**
	 * Customize row actions (remove edit, keep view/trash)
	 */
	public static function customize_row_actions( $actions, $post ) {
		if ( 'mkl_global_layer' !== $post->post_type ) {
			return $actions;
		}
		
		// Quick edit only exposes post fields, which say nothing about the layer.
		unset( $actions['inline hide-if-no-js'] );

		return $actions;
	}

	/**
	 * Get a global layer by post ID
	 * @return array{layer: array|false, content: array|false}
	 */
	public static function get( $global_id ) {
		$global_id = intval( $global_id );
		if ( $global_id <= 0 ) return [ 'layer' => false, 'content' => false ];
		$layer = get_post_meta( $global_id, '_mkl_pc_layer', true );
		$content = get_post_meta( $global_id, '_mkl_pc_content', true );
		$layer = maybe_unserialize( $layer );
		$content = maybe_unserialize( $content );
		return [ 'layer' => $layer, 'content' => $content ];
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
		if ( ! is_array( $content ) ) return array();
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
		if ( $global_id <= 0 ) return array();

		$stored = maybe_unserialize( get_post_meta( $global_id, '_mkl_pc_angles', true ) );
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
			if ( ! is_array( $choice ) || empty( $choice['images'] ) || ! is_array( $choice['images'] ) ) continue;
			foreach ( $choice['images'] as $image ) {
				if ( ! is_array( $image ) || ! isset( $image['angleId'] ) ) continue;
				$angle_id = intval( $image['angleId'] );
				if ( $angle_id > 0 ) $ids[ $angle_id ] = true;
			}
		}
		if ( empty( $ids ) ) return array();

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
	 * Create or update a global layer
	 * @param array $layer   Layer structure
	 * @param array $content Content/choices structure for that layer
	 * @param int|null $global_id Existing post ID to update, or null to create
	 * @param array|null $angles Views snapshot from the editing product, or null to keep the stored one
	 * @return int|WP_Error The post ID on success
	 */
	public static function save( $layer, $content, $global_id = null, $angles = null ) {
		$postarr = array(
			'post_type' => 'mkl_global_layer',
			'post_status' => 'publish',
			'post_title' => isset( $layer['name'] ) ? sanitize_text_field( $layer['name'] ) : 'Global Layer',
		);
		if ( $global_id ) {
			$postarr['ID'] = intval( $global_id );
			$global_id = wp_update_post( $postarr, true );
		} else {
			$global_id = wp_insert_post( $postarr, true );
		}
		if ( is_wp_error( $global_id ) ) return $global_id;
		$layer   = self::normalize_for_set( $layer, (int) $global_id, 'layers' );
		$content = self::normalize_for_set( $content, (int) $global_id, 'content' );
		update_post_meta( $global_id, '_mkl_pc_layer', $layer );
		update_post_meta( $global_id, '_mkl_pc_content', self::normalize_content_for_storage( $content ) );
		if ( is_array( $angles ) && ! empty( $angles ) ) {
			update_post_meta( $global_id, '_mkl_pc_angles', array_values( $angles ) );
		}
		return $global_id;
	}

	/**
	 * Delete a global layer
	 */
	public static function delete( $global_id ) {
		$global_id = intval( $global_id );
		if ( $global_id <= 0 ) return false;
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
		if ( $global_id <= 0 || ! self::is_global_layer_id( $global_id ) ) return false;
		$choices = self::normalize_for_set( $choices, $global_id, 'content' );
		update_post_meta( $global_id, '_mkl_pc_content', self::normalize_content_for_storage( $choices ) );
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
	 * stamped on at read time - see DB::stamp_choices_layer_id().
	 *
	 * @param mixed $content Raw content, either a bare list of choices or `{ layerId, choices }`.
	 * @return array
	 */
	public static function normalize_content_for_storage( $content ) {
		$choices = self::normalize_choices( $content );
		foreach ( $choices as $index => $choice ) {
			if ( ! is_array( $choice ) ) continue;
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
	 * Post meta on the global layer holding the ids of the owners that reference it.
	 *
	 * Owners are products, variations, or global configurator CPTs - whatever DB::get() resolved
	 * the layer for. The list is a cache-invalidation index, not a source of truth: an entry that
	 * has since stopped using the layer only means one extra cache rebuild.
	 */
	const CONSUMERS_META = '_mkl_pc_global_layer_consumers';

	/**
	 * Owners known to reference this global layer.
	 *
	 * @param int $global_id
	 * @return int[]
	 */
	public static function get_consumer_ids( $global_id ) {
		$global_id = intval( $global_id );
		if ( $global_id <= 0 ) return array();
		$ids = get_post_meta( $global_id, self::CONSUMERS_META, true );
		$ids = maybe_unserialize( $ids );
		if ( ! is_array( $ids ) ) return array();
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
		if ( $global_id <= 0 || $owner_id <= 0 || $global_id === $owner_id ) return;
		$ids = self::get_consumer_ids( $global_id );
		if ( in_array( $owner_id, $ids, true ) ) return;
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
		if ( $global_id <= 0 ) return;

		$consumers = self::get_consumer_ids( $global_id );

		// The index is built from reads, so it collects owners that have since been deleted or
		// stopped using the layer. Invalidating those is harmless but pointless, and this is the
		// one moment - an editor saving a layer - where checking is affordable.
		$live = array();
		foreach ( $consumers as $consumer_id ) {
			if ( get_post_status( (int) $consumer_id ) ) $live[] = (int) $consumer_id;
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

		if ( ! is_array( $consumers ) || empty( $consumers ) ) return;

		$invalidator = '\\MKL\\PC\\Global_Configurators\\Cache_Invalidator';
		foreach ( $consumers as $consumer_id ) {
			$consumer_id = intval( $consumer_id );
			if ( $consumer_id <= 0 ) continue;
			// A global configurator consumer stands in for every product linked to it, so this
			// has to cascade rather than stop at the CPT.
			if ( is_callable( array( $invalidator, 'invalidate_owner_and_consumers' ) ) ) {
				call_user_func( array( $invalidator, 'invalidate_owner_and_consumers' ), $consumer_id );
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
		if ( ! self::is_global_layer_id( $post_id ) ) return;
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
		if ( ! self::is_global_layer_id( $post_id ) ) return;

		if ( function_exists( 'mkl_pc' ) ) {
			$db = mkl_pc( 'db' );
			if ( $db && is_callable( array( $db, 'localize_global_layer' ) ) ) {
				foreach ( self::get_consumer_ids( $post_id ) as $consumer_id ) {
					$db->localize_global_layer( (int) $consumer_id, $post_id );
				}
			}
		}

		self::invalidate_consumers( $post_id );
	}

	/**
	 * List global layers (IDs and basic info)
	 */
	public static function list( $args = array() ) {
		$defaults = array(
			'post_type' => 'mkl_global_layer',
			'post_status' => 'publish',
			'posts_per_page' => -1,
			'fields' => 'ids',
		);
		$q = new \WP_Query( wp_parse_args( $args, $defaults ) );
		return $q->posts;
	}
}

Global_Layers::init();


