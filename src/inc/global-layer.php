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
	 * Register hooks
	 */
	public static function init() {
		add_action( 'init', [ __CLASS__, 'register_cpt' ] );
		add_action( 'admin_init', [ __CLASS__, 'add_admin_hooks' ] );
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
		
		// Remove edit/quick edit for now (they only want list/delete)
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
			'all_items'             => __( 'All Global Layers', 'product-configurator-for-woocommerce' ),
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
			'show_in_menu'          => true,
			'menu_position'         => 30,
			'menu_icon'             => 'dashicons-networking',
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
				if ( $data['content'] && is_array( $data['content'] ) ) {
					$count = count( $data['content'] );
					echo esc_html( $count );
				} else {
					echo '0';
				}
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
		
		// Remove edit and quick edit
		unset( $actions['edit'] );
		unset( $actions['inline hide-if-no-js'] );
		
		// Keep view and trash/delete
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
	 * Create or update a global layer
	 * @param array $layer   Layer structure
	 * @param array $content Content/choices structure for that layer
	 * @param int|null $global_id Existing post ID to update, or null to create
	 * @return int|WP_Error The post ID on success
	 */
	public static function save( $layer, $content, $global_id = null ) {
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
		update_post_meta( $global_id, '_mkl_pc_layer', $layer );
		update_post_meta( $global_id, '_mkl_pc_content', $content );
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


