<?php
/**
 * Registers the global configurator CPT and exposes admin columns.
 *
 * @package MKL\PC\Global_Configurators
 */

namespace MKL\PC\Global_Configurators;

defined( 'ABSPATH' ) || exit;

/**
 * Post type and admin-list integration for global configurators.
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

		add_action( 'init', array( __CLASS__, 'register' ), 20 );
		add_filter( 'manage_' . Schema::CPT_SLUG . '_posts_columns', array( __CLASS__, 'filter_columns' ) );
		add_action( 'manage_' . Schema::CPT_SLUG . '_posts_custom_column', array( __CLASS__, 'render_column' ), 10, 2 );
		add_filter( 'pre_delete_post', array( __CLASS__, 'maybe_block_deletion_when_in_use' ), 10, 3 );
	}

	/**
	 * Register the CPT.
	 *
	 * @return void
	 */
	public static function register() {
		$labels = array(
			'name'               => __( 'Global configurators', 'product-configurator-for-woocommerce' ),
			'singular_name'      => __( 'Global configurator', 'product-configurator-for-woocommerce' ),
			'menu_name'          => __( 'Global configurators', 'product-configurator-for-woocommerce' ),
			'add_new'            => __( 'Add new', 'product-configurator-for-woocommerce' ),
			'add_new_item'       => __( 'Add new global configurator', 'product-configurator-for-woocommerce' ),
			'edit_item'          => __( 'Edit global configurator', 'product-configurator-for-woocommerce' ),
			'new_item'           => __( 'New global configurator', 'product-configurator-for-woocommerce' ),
			'view_item'          => __( 'View global configurator', 'product-configurator-for-woocommerce' ),
			'search_items'       => __( 'Search global configurators', 'product-configurator-for-woocommerce' ),
			'not_found'          => __( 'No global configurators found.', 'product-configurator-for-woocommerce' ),
			'not_found_in_trash' => __( 'No global configurators found in trash.', 'product-configurator-for-woocommerce' ),
			'all_items'          => __( 'Global configurators', 'product-configurator-for-woocommerce' ),
		);

		register_post_type(
			Schema::CPT_SLUG,
			array(
				'labels'              => $labels,
				'public'              => false,
				'show_ui'             => true,
				'show_in_menu'        => 'edit.php?post_type=product',
				'show_in_admin_bar'   => false,
				'show_in_nav_menus'   => false,
				'hierarchical'        => false,
				'publicly_queryable'  => false,
				'exclude_from_search' => true,
				'supports'            => array( 'title' ),
				'capability_type'     => 'post',
				'map_meta_cap'        => true,
				'has_archive'         => false,
				'show_in_rest'        => false,
				'rewrite'             => false,
			)
		);
	}

	/**
	 * Add a column showing how many products currently link to each global configurator.
	 *
	 * @param array<string, string> $columns
	 * @return array<string, string>
	 */
	public static function filter_columns( $columns ) {
		$new = array();
		foreach ( $columns as $key => $label ) {
			$new[ $key ] = $label;
			if ( 'title' === $key ) {
				$new['mkl_pc_consumer_count'] = __( 'Products using this', 'product-configurator-for-woocommerce' );
			}
		}
		if ( ! isset( $new['mkl_pc_consumer_count'] ) ) {
			$new['mkl_pc_consumer_count'] = __( 'Products using this', 'product-configurator-for-woocommerce' );
		}
		return $new;
	}

	/**
	 * Render the consumer-count column (how many products use this global configurator).
	 *
	 * @param string $column_key
	 * @param int    $post_id
	 * @return void
	 */
	public static function render_column( $column_key, $post_id ) {
		if ( 'mkl_pc_consumer_count' !== $column_key ) {
			return;
		}
		$consumers = Owner_Resolver::get_consumer_product_ids( (int) $post_id );
		$count     = count( $consumers );
		if ( 0 === $count ) {
			echo esc_html_x( '0', 'Zero consumer products column', 'product-configurator-for-woocommerce' );
			return;
		}
		echo esc_html( (string) $count );
	}

	/**
	 * Block deletion (including trash) of a global configurator that is still in use by products.
	 *
	 * @param \WP_Post|false|null $check
	 * @param \WP_Post            $post
	 * @param bool                $force_delete
	 * @return \WP_Post|false|null
	 */
	public static function maybe_block_deletion_when_in_use( $check, $post, $force_delete ) {
		if ( ! $post || ! is_a( $post, 'WP_Post' ) ) {
			return $check;
		}
		if ( Schema::CPT_SLUG !== $post->post_type ) {
			return $check;
		}
		$consumers = Owner_Resolver::get_consumer_product_ids( (int) $post->ID );
		if ( empty( $consumers ) ) {
			return $check;
		}
		if ( ! apply_filters( 'mkl_pc/global_configurators/block_delete_when_in_use', true, $post, $consumers ) ) {
			return $check;
		}
		if ( function_exists( 'wp_die' ) ) {
			wp_die(
				esc_html(
					sprintf(
						/* translators: %d: number of products still using the configurator. */
						_n(
							'Cannot delete this global configurator: %d product still uses it.',
							'Cannot delete this global configurator: %d products still use it.',
							count( $consumers ),
							'product-configurator-for-woocommerce'
						),
						count( $consumers )
					)
				),
				esc_html__( 'Deletion blocked', 'product-configurator-for-woocommerce' ),
				array( 'response' => 409 )
			);
		}
		return false;
	}
}
