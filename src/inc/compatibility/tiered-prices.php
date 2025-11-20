<?php
namespace MKL\PC;

if ( ! defined( 'ABSPATH' ) ) return;

/**
 * Compatibility with the plugin WooCommerce Wholesale Prices
 */

class Compat_TierPricingTable {
	public function __construct() {}

	public function should_run() {
		return class_exists( 'TierPricingTable\TierPricingTablePlugin' );
	}

	public function run() {
		// add_filter( 'mkl_pc/get_product_price', [ $this, 'get_product_price' ], 20, 2 );
		// add_filter( 'mkl_pc/set_linked_product_price', [ $this, 'get_product_price_for_context' ], 20, 2 );
		add_filter( 'mkl_pc/store_api_product_data', [ $this, 'store_api_product_data' ], 20, 2 );
		add_filter( 'mkl_pc/store_api_product_data_schema', [ $this, 'store_api_product_data_schema' ], 20, 2 );
		add_filter( 'get_configurator_element_attributes', [ $this, 'configurator_element_attributes' ], 20, 2 );
	}

	/**
	 * Get price tiers
	 * @param WC_Product $product
	 * @return array|bool
	 */
	public function get_price_tiers( $product ) {

		if ( class_exists( '\TierPricingTable\PriceManager' ) ) {
			$pricing_rules = \TierPricingTable\PriceManager::getPricingRule( $product->get_id() );
			$rules = $pricing_rules->getRules();
			if ( $rules && count( $rules ) ) {

				$tier_type = $pricing_rules->getType();

				$tiers = [];
				foreach( $rules as $val => $rule ) {
					$tiers[$val] = [
						'start' => $val,
						'type' => $tier_type,
						'price' => $rule
					];
				}
				krsort( $tiers, SORT_NUMERIC );
				// Only include values. Array is ordered by tier start, decending
				return array_values( $tiers );
			}
		}
		return false;
	}

	/**
	 * Filter the Store API Schema  (Stock management)
	 *
	 * @param  array $schema
	 * @return array
	 */
	public function store_api_product_data_schema( $schema ) {
		$schema['price_tiers'] = [
			'description' => __( 'Price tiers', 'product-configurator-for-woocommerce' ),
			'type' => 'array',
			'readonly' => true,
		];
		return $schema;
	}

	/**
	 * Filter the Store API data (Stock management)
	 *
	 * @param  array $data
	 * @param  WC_Product $product
	 * @return array
	 */
	public function store_api_product_data( $data, $product ) {
		if ( $tiers = $this->get_price_tiers( $product ) ) {
			$data['price_tiers'] = $tiers;
		}
		return $data;
	}

	public function configurator_element_attributes( $attributes, $product ) {
		
		if ( $tiers = $this->get_price_tiers( $product ) ) {
			$attributes['price_tiers'] = json_encode( $tiers );
		}
		return $attributes;
	}
}

return new Compat_TierPricingTable();