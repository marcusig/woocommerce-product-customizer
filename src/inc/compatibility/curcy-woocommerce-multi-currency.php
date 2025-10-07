<?php

namespace MKL\PC;

if ( ! defined( 'ABSPATH' ) ) return;

class Compat_Curcy {
	public function __construct() {}

	public function should_run() {
		return defined( 'WOOMULTI_CURRENCY_VERSION' ) || defined( 'WOOMULTI_CURRENCY_F_VERSION' );
	}

	public function run() {

		// add_filter( 'mkl_pc_js_config', [ $this, 'config' ] );
		// add_action( 'mkl_pc_scripts_product_page_after', [ $this, 'enqueue_scripts' ] );
		add_filter( 'wmc_get_products_price_ajax_handle_response', [ $this, 'add_currency_data' ] );
		// add_filter( 'yith_ywraq_product_subtotal_html', [ $this, 'apply_extra_price' ], 20, 3 );
	}

	public function add_currency_data( $data ) {
		if ( !function_exists( 'wmc_get_exchange_rate' ) ) return $data;

		// Add exchange rate
		if ( $data['current_currency'] ) {
			$data['rate'] = wmc_get_exchange_rate( $data['current_currency'] );
			$data['format'] = array(
				'money_precision' => wc_get_price_decimals(),
				'money_symbol' => get_woocommerce_currency_symbol( get_woocommerce_currency() ),
				'money_decimal' => esc_attr( wc_get_price_decimal_separator() ),
				'money_thousand' => esc_attr( wc_get_price_thousand_separator() ),
				'money_format' => esc_attr( str_replace( array( '%1$s', '%2$s', '&nbsp;' ), array( '%s', '%v', ' ' ), get_woocommerce_price_format() ) ),
			);
		}
		// Add currenty format
		
		return $data;
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
			'mkl_pc/wcpbc/js', 
			trailingslashit( plugin_dir_url( __FILE__ ) ) . 'assets/js/wcpbc.js', 
			$dependencies, 
			filemtime( trailingslashit( plugin_dir_path ( __FILE__ ) ) . 'assets/js/wcpbc.js' ), 
			true
		);
	}
}
return new Compat_Curcy();
