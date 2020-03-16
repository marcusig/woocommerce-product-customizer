<?php 

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly
}

/**
 * Checks if a product is customizable
 *
 * @param integer $product_id
 * @return boolean
 */
function mkl_pc_is_customizable( $product_id = NULL ) {
	return MKL\PC\Utils::is_customizable( $product_id );
}

/**
 * Get the main plugin instance
 *
 * @return object
 */
function mkl_pc_get_plugin() {
	return MKL\PC\Plugin::instance();
}

/**
 * Get a template field
 *
 * @param array $fields
 * @return string
 */
// function mkl_get_template_fields( $fields = array() ) {
// 	$fields_markup = '';
// 	foreach( $fields as $field ) {

// 		if( is_string( $field ) ) {
// 			$open_tag = apply_filters( 'mkl_pc_field_open_tag', '', $field ) ;
// 			$close_tag = apply_filters( 'mkl_pc_field_close_tag', '', $field ) ;
// 			$fields_markup .= $open_tag . '{{data.' . $field . '}}' . $close_tag;
// 		} elseif( is_array( $field ) ) {
// 			if( isset( $field['name'] ) ) {
// 				$open_tag = apply_filters( 'mkl_pc_field_open_tag', (isset( $field['open_tag'] ) ? $field['open_tag'] : '' ), $field['name'] ) ;
// 				$close_tag = apply_filters( 'mkl_pc_field_close_tag', (isset( $field['close_tag'] ) ? $field['close_tag'] : ' ' ), $field['name'] ) ;
// 				$fields_markup .= $open_tag . '{{data.' . $field['name'] . '}}' . $close_tag;
// 			}
// 		}

// 	}

// 	return $fields_markup;
// }

if( ! function_exists('request_is_frontend_ajax') ) {

	function request_is_frontend_ajax() {
		$script_filename = isset($_SERVER['SCRIPT_FILENAME']) ? $_SERVER['SCRIPT_FILENAME'] : '';

		//Try to figure out if frontend AJAX request... If we are DOING_AJAX; let's look closer
		if( (defined('DOING_AJAX') && DOING_AJAX) ) {
			$ref = '';
			if ( ! empty( $_REQUEST['_wp_http_referer'] ) )
				$ref = wp_unslash( $_REQUEST['_wp_http_referer'] );
			elseif ( ! empty( $_SERVER['HTTP_REFERER'] ) )
				$ref = wp_unslash( $_SERVER['HTTP_REFERER'] );

			//If referer does not contain admin URL and we are using the admin-ajax.php endpoint, this is likely a frontend AJAX request
			if(((strpos($ref, admin_url()) === false) && (basename($script_filename) === 'admin-ajax.php')))
				return true;
		}

		//If no checks triggered, we end up here - not an AJAX request.
		return false;
	}
}

