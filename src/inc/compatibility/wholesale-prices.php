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
		add_filter( 'get_configurator_element_attributes', [ $this, 'configurator_element_attributes' ], 20, 2 );
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

	private function get_wholesale_price_mapping( $product, $user_wholesale_role ) {
		if ( !defined( 'WWPP_POST_META_ENABLE_QUANTITY_DISCOUNT_RULE' ) || !defined( 'WWPP_POST_META_QUANTITY_DISCOUNT_RULE_MAPPING' ) ) return false;

		$enabled = 'no';
		if ( $product->is_type( 'variation' ) ) {
            $enabled = get_post_meta( $product->get_parent_id(), WWPP_POST_META_ENABLE_QUANTITY_DISCOUNT_RULE, true );
        }

        // If the variable qty based discount is enabled we use its mapping else we use the per variation mapping.
        if ( 'yes' === $enabled ) {
            $mapping = get_post_meta( $product->get_parent_id(), WWPP_POST_META_QUANTITY_DISCOUNT_RULE_MAPPING, true );
        } else {
            $enabled = $product->get_meta( WWPP_POST_META_ENABLE_QUANTITY_DISCOUNT_RULE, true );
            $mapping = $product->get_meta( WWPP_POST_META_QUANTITY_DISCOUNT_RULE_MAPPING, true );
        }

		if ( ! is_array( $mapping ) ) {
            $mapping = array();
        }

		if ( 'yes' === $enabled && ! empty( $mapping ) ) {

            $base_currency_mapping = array();
            foreach ( $mapping as $map ) {

                // Skip non base currency mapping.
                if ( array_key_exists( 'currency', $map ) ) {
                    continue;
                }

                // Skip mapping not meant for the current user wholesale role.
                if ( $user_wholesale_role[0] !== $map['wholesale_role'] ) {
                    continue;
                }

				// Only use start qty
                $base_currency_mapping[$map['start_qty']] = [
					'start' => $map['start_qty'],
					'type' => $map['price_type'],
					'price' => $map['wholesale_price'],
				];
            }
			krsort($base_currency_mapping, SORT_NUMERIC);
			return array_values( $base_currency_mapping );
		}
		return $mapping;
		
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
		if ( $tiers = $this->get_price_tiers( $product ) ) {
			$data['price_tiers'] = $tiers;
		}
		return $data;
	}

	/**
	 * Get price tiers
	 * @param WC_Product $product
	 * @return array|bool
	 */
	public function get_price_tiers( $product ) {
		if ( class_exists( '\WWP_Wholesale_Prices' ) && is_callable( '\WWP_Wholesale_Prices::get_product_wholesale_price_on_shop_v3' ) ) {
			$user_role_class = \WWP_Wholesale_Roles::getInstance();
			if ( ! empty( $user_role_class->getUserWholesaleRole() ) ) {
				$tiers = $this->get_wholesale_price_mapping( $product, $user_role_class->getUserWholesaleRole() ); // WWPP_Helper_Functions::get_quantity_discount_mapping_price( $product, $user_role_class->getUserWholesaleRole(), [] );
				if ( ! empty( $tiers ) ) return $tiers;
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
		$schema['wholesale_price'] = [
			'description' => __( 'Wholesale Price', 'product-configurator-for-woocommerce' ),
			'type' => 'number',
			'readonly' => true,
		];
		$schema['price_tiers'] = [
			'description' => __( 'Price tiers', 'product-configurator-for-woocommerce' ),
			'type' => 'array',
			'readonly' => true,
		];
		return $schema;
	}

	public function configurator_element_attributes( $attributes, $product ) {
		
		if ( $tiers = $this->get_price_tiers( $product ) ) {
			$attributes['price_tiers'] = json_encode( $tiers );
		}
		return $attributes;
	}
}

return new Compat_Wholesale_Prices();