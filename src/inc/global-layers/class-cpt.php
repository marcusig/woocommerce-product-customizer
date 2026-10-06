<?php
/**
 * Registers the global layer CPT and exposes the admin list table.
 *
 * @package MKL\PC\Global_Layer
 */

namespace MKL\PC\Global_Layer;

defined( 'ABSPATH' ) || exit;

/**
 * Post type and admin-list integration for global layers.
 */
final class Cpt {

	/**
	 * @var bool
	 */
	private static $did_init = false;

	/**
	 * Hook registration.
	 *
	 * @return void
	 */
	public static function init() {
		if ( self::$did_init ) {
			return;
		}
		self::$did_init = true;

		add_action( 'init', array( __CLASS__, 'register' ) );
		add_action( 'admin_init', array( __CLASS__, 'add_admin_hooks' ) );
	}

	/**
	 * Admin list columns, sorting, and row actions.
	 *
	 * @return void
	 */
	public static function add_admin_hooks() {
		if ( ! is_admin() ) {
			return;
		}

		add_filter( 'manage_' . Schema::CPT_SLUG . '_posts_columns', array( __CLASS__, 'filter_columns' ) );
		add_action( 'manage_' . Schema::CPT_SLUG . '_posts_custom_column', array( __CLASS__, 'render_column' ), 10, 2 );
		add_filter( 'manage_edit-' . Schema::CPT_SLUG . '_sortable_columns', array( __CLASS__, 'filter_sortable_columns' ) );
		// Keep Edit (it opens the configurator editor) but drop quick edit, which cannot edit layer data.
		add_filter( 'post_row_actions', array( __CLASS__, 'filter_row_actions' ), 10, 2 );
	}

	/**
	 * Register the mkl_global_layer CPT.
	 *
	 * @return void
	 */
	public static function register() {
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
		register_post_type( Schema::CPT_SLUG, $args );
	}

	/**
	 * Set custom columns for the global layers list.
	 *
	 * @param array<string, string> $columns
	 * @return array<string, string>
	 */
	public static function filter_columns( $columns ) {
		unset( $columns['date'] );

		$columns['layer_type']    = __( 'Layer Type', 'product-configurator-for-woocommerce' );
		$columns['layer_name']    = __( 'Layer Name', 'product-configurator-for-woocommerce' );
		$columns['renders_in']    = __( 'Renders in', 'product-configurator-for-woocommerce' );
		$columns['choices_count'] = __( 'Choices', 'product-configurator-for-woocommerce' );

		return $columns;
	}

	/**
	 * Display custom column content.
	 *
	 * @param string $column
	 * @param int    $post_id
	 * @return void
	 */
	public static function render_column( $column, $post_id ) {
		$data = \MKL\PC\Global_Layers::get( $post_id );

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

			case 'renders_in':
				$capabilities = \MKL\PC\Global_Layers::derive_capabilities( $data['layer'], \MKL\PC\Global_Layers::normalize_choices( $data['content'] ) );
				if ( empty( $capabilities ) ) {
					// Not a fault: an option list with no images and no 3D actions still carries
					// prices, SKUs and form data, and it imports anywhere.
					printf(
						'<span class="mkl-pc-capability-tag mkl-pc-capability-tag--none" title="%s">%s</span>',
						esc_attr__( 'No images and no 3D actions. This layer paints nothing, but its choices still import anywhere.', 'product-configurator-for-woocommerce' ),
						esc_html__( 'Nothing', 'product-configurator-for-woocommerce' )
					);
					break;
				}
				$labels = \MKL\PC\Global_Layers::get_capability_labels();
				foreach ( $capabilities as $capability ) {
					printf(
						'<span class="mkl-pc-capability-tag mkl-pc-capability-tag--%1$s">%2$s</span> ',
						esc_attr( $capability ),
						esc_html( isset( $labels[ $capability ] ) ? $labels[ $capability ] : $capability )
					);
				}
				break;

			case 'choices_count':
				echo esc_html( (string) count( \MKL\PC\Global_Layers::normalize_choices( $data['content'] ) ) );
				break;
		}
	}

	/**
	 * Sortable admin columns.
	 *
	 * @param array<string, string> $columns
	 * @return array<string, string>
	 */
	public static function filter_sortable_columns( $columns ) {
		$columns['layer_type']    = 'layer_type';
		$columns['layer_name']    = 'layer_name';
		$columns['choices_count'] = 'choices_count';
		return $columns;
	}

	/**
	 * Drop quick edit: it only exposes post fields, which say nothing about the layer.
	 *
	 * @param array    $actions
	 * @param \WP_Post $post
	 * @return array
	 */
	public static function filter_row_actions( $actions, $post ) {
		if ( Schema::CPT_SLUG !== $post->post_type ) {
			return $actions;
		}

		unset( $actions['inline hide-if-no-js'] );

		return $actions;
	}
}
