<?php
namespace MKL\PC;
/**
 * Frontend functions
 *
 *
 * @author   Marc Lacroix
 */


if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly
}


class Frontend_Woocommerce { 

	public $plugin = NULL;
	public $_product = NULL;
	public $ID = NULL;
	public $frontend = NULL;
	public function __construct() {
		// Plugin::instance()->db;	
		$this->_hooks();
		$this->_includes();
		$this->product = new Frontend_Product();
		$this->cart = new Frontend_Cart();
		$this->order = new Frontend_Order();
	}
	private function _includes() {
		include( MKL_PC_INCLUDE_PATH . 'frontend/product.php' );
		include( MKL_PC_INCLUDE_PATH . 'frontend/order.php' );
		include( MKL_PC_INCLUDE_PATH . 'frontend/cart.php' );
	}
	private function _hooks() {
		add_action( 'wp_enqueue_scripts', array( $this, 'load_scripts' ), 50 );
		// add_filter( 'woocommerce_get_price', array( &$this, 'get_price' ), 10, 2 ); 
		// add_filter( 'woocommerce_cart_item_product' , array( &$this, 'change_item_price' ), 10 , 3); 
		// 		
		// variation: include text when prod configurator is opened and no variation is selected

	}

	public function load_scripts() {
		global $post; 

		wp_register_style( 'mlk_pc/css/woocommerce', MKL_PC_ASSETS_URL . 'css/woocommerce.css' , false, MKL_PC_VERSION );
		wp_enqueue_style( 'mlk_pc/css/woocommerce' );

		wp_enqueue_script( 'wp-api' );
		//WP.hooks, until it's included in WP core.
		wp_enqueue_script( 'mkl_pc/js/wp.hooks', MKL_PC_ASSETS_URL . 'js/vendor/wp.event-manager.min.js', array( 'jquery' ), '0.1', true );

		// Exit if the plugin is not configurable
		if( !mkl_pc_is_configurable( $post->ID ) ) return;

		$scripts = array(
			array('backbone/models/choice', 'models/choice.js'),
			array('backbone/models/layer', 'models/layer.js'),
			//COLLECTIONS
			array('backbone/collections/layers', 'collections/layers.js'),
			array('backbone/collections/angles', 'collections/angles.js'),
			array('backbone/collections/choices', 'collections/choices.js'),

		);
		foreach($scripts as $script) {
			list( $key, $file ) = $script;
			if (!defined('SCRIPT_DEBUG') || !SCRIPT_DEBUG) {
				$file = str_replace('.js', '.min.js', $file);
			}
			wp_enqueue_script( 'mkl_pc/js/admin/' . $key, MKL_PC_ASSETS_URL . 'admin/js/'. $file , array( 'jquery', 'backbone', 'accounting', 'mkl_pc/js/wp.hooks' ), MKL_PC_VERSION, true );
		}
		
		// To include potential other scripts BEFORE the main configurator one
		do_action( 'mkl_pc_scripts_product_page_before' );

		// wp_enqueue_script( 'mkl_pc/js/vendor/TouchSwipe', MKL_PC_ASSETS_URL.'js/vendor/jquery.touchSwipe.min.js', array('jquery' ), '1.6.18', true );
		wp_enqueue_script( 'mkl_pc/js/views/configurator', MKL_PC_ASSETS_URL.'js/views/configurator.js', array('jquery', 'backbone', 'wp-util', 'mkl_pc/js/wp.hooks' ), MKL_PC_VERSION, true );
		wp_enqueue_script( 'mkl_pc/js/product_configurator', MKL_PC_ASSETS_URL.'js/product_configurator.js', array('jquery', 'backbone', 'wp-util', 'mkl_pc/js/wp.hooks' ), MKL_PC_VERSION, true );

		$args = array(
			'ajaxurl' => admin_url( 'admin-ajax.php' ),
			'lang' => array(
				'media_title' => __('Select a picture', MKL_PC_DOMAIN ),
				'media_select_button' => __('Choose', MKL_PC_DOMAIN ),
				'layers_new_placeholder' => __('New Layer Name', MKL_PC_DOMAIN),
				'angles_new_placeholder' => __('New Angle Name', MKL_PC_DOMAIN),
				'choice_new_placeholder' => __('New Choice Name', MKL_PC_DOMAIN),
			),
			'config' => apply_filters( 'mkl_pc_js_config', array( 'inline' => false ) ),
		);
		wp_localize_script( 'mkl_pc/js/product_configurator', 'PC_config', apply_filters( 'mkl_pc_frontend_js_config', $args ) );

		// $version = $product
		$date_modified = wc_get_product($post->ID)->get_date_modified();
		wp_enqueue_script( 'mkl_pc/js/fe_data_'.$post->ID, Plugin::instance()->cache->get_config_file($post->ID), array(), ( $date_modified ? $date_modified->getTimestamp() : MKL_PC_VERSION ), true );
		wp_register_style( 'mlk_pc/css', MKL_PC_ASSETS_URL.'css/product_configurator.css', array(), MKL_PC_VERSION );
		wp_enqueue_style( 'mlk_pc/css' );

		// to include potential other scripts AFTER the main configurator one
		do_action( 'mkl_pc_scripts_product_page_after' );

	}

	// public function change_item_price( $data, $cart_item, $key  ) { 
	// 	if( mkl_pc_is_configurable( $data->id ) ) {

	// 		// $data->price = 2;
	// 	}
	// 	// die();
	// 	return $data;

	// }


	// public function get_price( $price, $product ) {
	// 	if( mkl_pc_is_configurable( $product->id ) ) {
	// 		return $price;
	// 	}
	// 	return $price; 
	// }



	// Removes ajax_add_to_cart support for simple + configurable products 
	// in archive view





}


