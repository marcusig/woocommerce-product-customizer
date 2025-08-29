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

/**
 * Checks if a product is configurable
 *
 * @param integer $product_id
 * @return boolean
 */
function mkl_pc_get_configurator_type( $product_id = NULL ) {
	// MKL_PC_PREFIX.'_configurator_type
	if ( NULL == $product_id ) {

		// if $product_id wasn't given, find the current one
		$product_id = get_the_id();

		if ( NULL == $product_id || false == $product_id ) return false;
	} 

	// if $product_id doesn't match a product, exit
	if ( ! MKL\PC\Utils::is_product( $product_id )  ) return false;

	$fetched_product = wc_get_product( $product_id );
	$type = $fetched_product->get_meta( MKL_PC_PREFIX.'_configurator_type' );
	return $type ?? 'configurator';
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
