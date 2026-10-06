<?php
/**
 * Configurator editor menu (layers, content, views, import).
 *
 * @package MKL\PC
 */

namespace MKL\PC;

use MKL\PC\Global_Layer\Linker as Global_Layer_Linker;

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly
}

/**
 * Admin editor menu for a product, global configurator, or standalone global layer.
 */
class Editor_Menu {

	/**
	 * @var bool
	 */
	private static $did_init = false;

	/**
	 * Register the import section at the end of the menu.
	 *
	 * @return void
	 */
	public static function init() {
		if ( self::$did_init ) {
			return;
		}
		self::$did_init = true;
		add_filter( 'mkl_product_configurator_admin_menu', array( __CLASS__, 'add_import_section' ), 1200 );
	}

	/**
	 * Get the menu
	 *
	 * @param integer $id
	 * @return array
	 */
	public static function get( $id = null ) {
		if ( ! $id ) {
			global $post;
			if ( $post && isset( $post->ID ) ) {
				$id = (int) $post->ID;
			}
		}

		$default_menu = array(
			array(
				'type' 	=> 'part',
				'menu_id' 	=> 'home',
				'label' => __( 'Home', 'product-configurator-for-woocommerce' ),
				'title' => __( 'Welcome to the Product Configurator ', 'product-configurator-for-woocommerce' ),
				// 'menu' => array(
				// 	array(
				// 		'class' => 'pc-main-cancel',
				// 		'text' => __( 'Cancel' , 'product-configurator-for-woocommerce' ),
				// 	),
				// 	array(
				// 		'class' => 'button-primary pc-main-save-all',
				// 		'text' => __( 'Save' , 'product-configurator-for-woocommerce' ),
				// 	),

				// ),
				'description' => '',
				'order' => 10,
			),
			array(
				'type' 	=> 'part',
				'menu_id' 	=> 'layers',
				'label' => __( 'Layers', 'product-configurator-for-woocommerce' ),
				'title' => __( 'Layers', 'product-configurator-for-woocommerce' ),
				'menu' => array(
					array(
						'class' => 'button-primary pc-main-save-all',
						'text' => __( 'Save' , 'product-configurator-for-woocommerce' ),
					),

				),
				'description' => __( 'Define the layers the product is composed of. ', 'product-configurator-for-woocommerce' ),
				'order' => 20,
			),
			array(
				'type' 	=> 'part',
				'menu_id' 	=> 'angles',
				'label' => __( 'Views', 'product-configurator-for-woocommerce' ),
				'title' => __( 'Views', 'product-configurator-for-woocommerce' ),
				'menu' => array(
					array(
						'class' => 'button-primary pc-main-save-all',
						'text' => __( 'Save' , 'product-configurator-for-woocommerce' ),
					),

				),
				'description' => __( 'Define the view angles, if you want the client to be able to switch between them. ', 'product-configurator-for-woocommerce' ),
				'order' => 30,
			),
			array(
				'type' 	=> 'part',
				'menu_id' 	=> 'content',
				'label' => __( 'Content', 'product-configurator-for-woocommerce' ),
				'title' => __( 'Content', 'product-configurator-for-woocommerce' ),
				'menu' => array(
					array(
						'class' => 'button-primary pc-main-save-all',
						'text' => __( 'Save' , 'product-configurator-for-woocommerce' ),
					),

				),
				'description' => __( 'Define choices for each layer and assign them pictures', 'product-configurator-for-woocommerce' ),
				'order' => 40,
			),
		);


		if ( ! $id || '3d' !== mkl_pc_get_configurator_type( $id ) ) {
			$default_menu[] = array(
				'type' 	=> 'part',
				'menu_id' 	=> 'image_order',
				'label' => __( 'Image order', 'product-configurator-for-woocommerce' ),
				'title' => __( 'Image order', 'product-configurator-for-woocommerce' ),
				'menu' => array(
					array(
						'class' => 'button-primary pc-main-save-all',
						'text' => __( 'Save' , 'product-configurator-for-woocommerce' ),
					),
				),
				'description' => __( 'The order the layers\' images are stacked in, which is separate from the order they appear in the menu. The layer at the top of the list is drawn over the ones below it.', 'product-configurator-for-woocommerce' ),
				'order' => 45,
			);
		}

		if ( ! class_exists( 'MKL_PC_Conditional_Logic_Admin' ) && ! get_user_meta( get_current_user_id(), 'mkl_pc_hide_addon__conditional_placeholder', true )  ) {
			$default_menu[] = array(
				'type' 	=> 'separator',
				'order' => 100,
			);
	
			$default_menu[] = array(
				'type' 	=> 'part',
				'menu_id' 	=> 'conditional_placeholder',
				'label' => __( 'Conditional settings', 'product-configurator-for-woocommerce' ),
				'title' => __( 'Conditional settings ', 'product-configurator-for-woocommerce' ),
				'menu' => array(),
				'description' => __( 'Define the conditions for displaying or not the choices / layers', 'product-configurator-for-woocommerce' ),
				'order' => 101,
			);			
		}
		
		if ( $id && '3d' === mkl_pc_get_configurator_type( $id ) ) {
			$default_menu[] = array(
				'type' 	=> 'part',
				'menu_id' 	=> 'objects3d',
				'label' => __( '3D Objects', 'product-configurator-for-woocommerce' ),
				'title' => __( '3D Objects', 'product-configurator-for-woocommerce' ),
				'menu' => array(
					array(
						'class' => 'pc-main-cancel',
						'text' => __( 'Cancel' , 'product-configurator-for-woocommerce' ),
					),
					array(
						'class' => 'button-primary pc-main-save-all',
						'text' => __( 'Save' , 'product-configurator-for-woocommerce' ),
					),
				),
				'description' => __( 'Manage 3D models and assets used by this product', 'product-configurator-for-woocommerce' ),
				'order' => 45,
			);
			$default_menu[] = array(
				'type' 	=> 'part',
				'menu_id' 	=> 'settings_3d',
				'label' => __( '3D settings', 'product-configurator-for-woocommerce' ),
				'title' => __( '3D settings', 'product-configurator-for-woocommerce' ),
				'menu' => array(
					array(
						'class' => 'pc-main-cancel',
						'text' => __( 'Cancel' , 'product-configurator-for-woocommerce' ),
					),
					array(
						'class' => 'button-primary pc-main-save-all',
						'text' => __( 'Save settings' , 'product-configurator-for-woocommerce' ),
					),
				),
				'description' => __( 'Manage the main 3D settings for this product', 'product-configurator-for-woocommerce' ),
				'order' => 50,
			);
		}

		$menu = apply_filters( 'mkl_product_configurator_admin_menu', $default_menu );

		if ( Global_Layers::is_global_layer_id( $id ) ) {
			$menu = Global_Layer_Linker::filter_menu( $menu );
		}

		return $menu;
	}

	/**
	 * Add tne import section to the menu
	 */
	public static function add_import_section( $menu ) {
		return array_merge(
			$menu, 
			array(
				array(
					'type' 	=> 'separator',
					'order' => 1190,
				),
				array(
					'type' 	=> 'part',
					'menu_id' 	=> 'import',
					'label' => __( 'Import / Export' , 'product-configurator-for-woocommerce' ),
					'title' => __( 'Import / Export the product\'s data ', 'product-configurator-for-woocommerce' ),
					'bt_save_text' => __( 'Export' , 'product-configurator-for-woocommerce' ),
					'description' => '',
					'order' => 1200,
					// __( 'Description for I/E of the product ', 'product-configurator-for-woocommerce' ),
				),
			)
		);
	}

}

Editor_Menu::init();
