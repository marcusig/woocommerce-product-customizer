<?php

namespace MKL\PC;

if ( ! defined( 'ABSPATH' ) ) return;

class Compat_WCPBC {
	public function __construct() {}

	public function should_run() {
		return function_exists( 'wcpbc' );
	}

	public function run() {

		add_filter( 'mkl_pc_js_config', [ $this, 'config' ] );
		add_action( 'mkl_pc_scripts_product_page_after', [ $this, 'enqueue_scripts' ] );
		// add_filter( 'yith_ywraq_product_subtotal_html', [ $this, 'apply_extra_price' ], 20, 3 );
	}

	public function config( $config ) {
		// $config['ywraq_hide_add_to_cart'] = 'yes' === get_option( 'ywraq_hide_add_to_cart' );
		// $config['ywraq_hide_price']       = 'yes' === get_option( 'ywraq_hide_price' );
		return $config;
	}

	public function apply_extra_price( $raq, $product ) {
		if ( isset( $raq['pc_layers'] ) && isset( $raq['pc_extra_price'] ) ) {
			$product->set_price( floatval( $product->get_price() ) + floatval( $raq['pc_extra_price'] ) );
		}
	}

	public function enqueue_scripts() {
		// List of dependencies
		$dependencies = [
			'jquery',
			'wp-util',
			'wp-hooks',
			'mkl_pc/js/views/configurator'
		];
		wp_enqueue_script( 
			'mkl_pc/yith/js', 
			trailingslashit( plugin_dir_url( __FILE__ ) ) . 'assets/js/wcpbc.js', 
			$dependencies, 
			filemtime( trailingslashit( plugin_dir_path ( __FILE__ ) ) . 'assets/js/wcpbc.js' ), 
			true
		);
	}
}
// wc_price_based_country_set_product_price