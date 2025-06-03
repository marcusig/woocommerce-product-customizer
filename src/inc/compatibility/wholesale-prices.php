<?php
namespace MKL\PC;

if ( ! defined( 'ABSPATH' ) ) return;

/**
 * Compatibility with the plugin WooCommerce Wholesale Prices
 */

class Compat_Wholesale_Prices {
	public function __construct() {}

	public function should_run() {
		return defined( 'WWP_PLUGIN_FILE' );
	}

	public function run() {
		add_filter( 'mkl_pc/get_product_price', [ $this, 'get_product_price' ], 20, 2 );
		add_filter( 'mkl_pc/set_linked_product_price', [ $this, 'get_product_price_for_context' ], 20, 2 );
		add_filter( 'mkl_pc/store_api_product_data', [ $this, 'store_api_product_data' ], 20, 2 );
		add_filter( 'mkl_pc/store_api_product_data_schema', [ $this, 'store_api_product_data_schema' ], 20, 2 );
	}

	public function get_wholesale_price( $product, $which_price = 'all' ) {
		if ( class_exists( '\WWP_Wholesale_Prices' ) && is_callable( '\WWP_Wholesale_Prices::get_product_wholesale_price_on_shop_v3' ) ) {
			$user_role_class = \WWP_Wholesale_Roles::getInstance();
			if ( ! empty( $user_role_class->getUserWholesaleRole() ) ) {
				$price_arr = \WWP_Wholesale_Prices::get_product_wholesale_price_on_shop_v3( $product->get_id(), $user_role_class->getUserWholesaleRole() );
				if ( isset( $price_arr['wholesale_price'] ) && $price_arr['wholesale_price'] ) {
					if ( 'all' == $which_price ) return $price_arr;
					if ( isset( $price_arr[$which_price] ) ) return (float) $price_arr[$which_price];
					return (float) $price_arr['wholesale_price'];
				}
			}
		}
		return false;
	}

	/**
	 * Filters the configurator price
	 *
	 * @param  float $price
	 * @param  WC_Product $product
	 * @return float
	 */
	public function get_product_price( $price, $product ) {
		$wholesale_price = $this->get_wholesale_price( $product, 'wholesale_price' );
		if ( false !== $wholesale_price ) return $wholesale_price;
		return $price;
	}

	/**
	 * Filters the configurator price
	 *
	 * @param  float $price
	 * @param  WC_Product $product
	 * @return float
	 */
	public function get_product_price_for_context( $price, $product ) {
		$wholesale_price = $this->get_wholesale_price( $product );
		if ( false !== $wholesale_price ) {
			if ( wc_prices_include_tax() ) return $wholesale_price['wholesale_price_with_tax'];
			return $wholesale_price['wholesale_price_with_no_tax'];
		}
		return $price;
	}

	/**
	 * Filter the Store API data (Stock management)
	 *
	 * @param  array $data
	 * @param  WC_Product $product
	 * @return array
	 */
	public function store_api_product_data( $data, $product ) {
		$wholesale_price = $this->get_wholesale_price( $product );
		if ( false !== $wholesale_price ) {
			$data['wholesale_price'] = $wholesale_price;
		}
		return $data;
	}

	/**
	 * Filter the Store API Schema  (Stock management)
	 *
	 * @param  array $schema
	 * @return array
	 */
	public function store_api_product_data_schema( $schema ) {
		$schema['wholesale_price'] = [
			'description' => __( 'Wholesale Price', 'product-configurator-for-woocommerce' ),
			'type' => 'number',
			'readonly' => true,
		];
		return $schema;
	}
}

return new Compat_Wholesale_Prices();