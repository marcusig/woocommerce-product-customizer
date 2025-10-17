<?php 

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly
}

/**
 * Checks if a product is configurable
 *
 * @param integer $product_id
 * @return boolean
 */
function mkl_pc_is_configurable( $product_id = NULL ) {
	return MKL\PC\Utils::is_configurable( $product_id );
}


if( ! function_exists( 'request_is_frontend_ajax' ) ) {

	function request_is_frontend_ajax() {
		$script_filename = isset($_SERVER['SCRIPT_FILENAME']) ? $_SERVER['SCRIPT_FILENAME'] : '';
		// Try to figure out if frontend AJAX request... If we are DOING_AJAX; let's look closer
		if ( ( defined( 'DOING_AJAX' ) && DOING_AJAX ) ) {
			$ref = '';
			if ( ! empty( $_REQUEST['_wp_http_referer'] ) ) {
				$ref = wp_unslash( $_REQUEST['_wp_http_referer'] );
			} elseif ( ! empty( $_SERVER['HTTP_REFERER'] ) ) {
				$ref = wp_unslash( $_SERVER['HTTP_REFERER'] );
			}

			// Include specific POST variables which indicate the request being from the admin, in case the next check fails
			$check_variables = [ '_mkl_pc__is_configurable', 'variation_menu_order' ];
			foreach( $check_variables as $check ) {
				if ( in_array( $check, array_keys( $_POST ) ) ) {
					return false;
				}
			}

			//If referer does not contain admin URL and we are using the admin-ajax.php endpoint, this is likely a frontend AJAX request
			if ( ( ( strpos( $ref, admin_url() ) === false ) && ( basename( $script_filename ) === 'admin-ajax.php' ) ) ) {
				return true;
			}
		}

		//If no checks triggered, we end up here - not an AJAX request.
		return false;
	}
}

if( ! function_exists( 'mkl_get_formatted_configurator_data' ) ) {

	/**
	 * Get the formatted configurator data
	 * 
	 * @param array $data 
	 * @param int $product_id
	 * @param int $variation_id
	 * @return array
	 */
	function mkl_get_formatted_configurator_data( $data, $product_id, $variation_id = 0 ) {

		$product = wc_get_product( intval( $product_id ) );

		if ( is_a( $product, 'WC_Product_Variation' ) ) {
			$variation_id = intval( $product_id );
			$product_id = $product->get_parent_id();
		} elseif ( is_a( $product, 'WC_Product' ) ) {
			$variation_id = intval( $product_id );
			$product_id = intval( $product_id );
		} else {
			wp_die( 'Product not found.', '', 404 );
		}

		add_filter( 'mkl_pc/form_builder/value_arrow', function() {
			return ': ';
		} );


		if ( !is_array( $data ) ) return [];
		$item_weight = 0;
		foreach( $data as $layer_data ) {
			$choice = new \MKL\PC\Choice( $product_id, $variation_id, $layer_data->layer_id, $layer_data->choice_id, $layer_data->angle_id, $layer_data );
			$layers[] = $choice;
			if ( $weight = $choice->get_choice( 'weight' ) ) {
				$item_weight += floatval( $weight );
			}
			do_action_ref_array( 'mkl_pc/wc_cart_add_item_data/adding_choice', array( $choice, &$data ) );
		}

		if ( $item_weight ) {
			$item_data['configuration_weight'] = $item_weight; 
		}

		$item_data['configurator_data'] = $layers;

		// Use the same structure as a cart item, to be able to apply the same filters

		
		if ( function_exists( 'wc_get_formatted_cart_item_data' ) ) {
			$item_data = array_merge(
				$item_data,
				array(
					'key'          => 'formatted_configuration',
					'product_id'   => $product_id,
					'variation_id' => $variation_id,
					'variation'    => false,
					'quantity'     => 1,
					'data'         => $product,
					'data_hash'    => '',
				)
			);
			return wc_get_formatted_cart_item_data( $item_data );
		}


	}
}