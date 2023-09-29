<?php
namespace MKL\PC;

if ( ! defined( 'ABSPATH' ) ) return;
/**
 * Add Compatibility with 
 * Price Based on Country for WooCommerce
 */
class Compat_WCPBC {
	public function __construct() {}

	public function should_run() {
		if ( ! function_exists( 'wcpbc' ) ) return false;
		return true;
	}

	public function run() {

		add_filter( 'mkl_pc_js_config', [ $this, 'config' ] );
		add_filter( 'choice_set_linked_product_data', [ $this, 'set_linked_product_data' ] , 20, 3 );
		add_action( 'mkl_pc_scripts_product_page_after', [ $this, 'enqueue_scripts' ] );
	}

	public function config( $config ) {
		// Price Based on Country exchange rate
		if ( function_exists( 'wcpbc_the_zone' ) ) {
			$zone = wcpbc_the_zone();
			if ( is_callable( [ $zone, 'get_exchange_rate' ] ) ) {
				$config['wcpbc_rate'] = $zone->get_exchange_rate();
			}
			if ( is_callable( [ $zone, 'get_id' ] ) ) {
				$config['wcpbc_zone_id'] = $zone->get_id();
			}
			// Premium version only
			if ( is_callable( [ $zone, 'get_round_nearest' ] ) ) {
				$config['wcpbc_round_nearest'] = $zone->get_round_nearest();
			}
		}

		return $config;
	}

	public function set_linked_product_data( $choice, $linked_product, $product_id ) {
		foreach ( WCPBC_Pricing_Zones::get_zones() as $zone ) {
			logdebug( ['zone info', $zone->get_id(), $zone->get_post_price( $linked_product->get_id(), '_price' ), $zone] );
			if ( ! $zone->get_enabled() || $zone->is_exchange_rate_price( $linked_product) ) continue;
			$choice['extra_price_zone_' . $zone->get_id()] = $zone->get_post_price( $linked_product->get_id(), '_price' );
		}
		return $choice;
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
			'mkl_pc/price-based-on-country/js', 
			trailingslashit( plugin_dir_url( __FILE__ ) ) . 'assets/js/price-based-on-country-compat.js', 
			$dependencies, 
			filemtime( trailingslashit( plugin_dir_path ( __FILE__ ) ) . 'assets/js/price-based-on-country-compat.js' ), 
			true
		);
	}
}

return new Compat_WCPBC();