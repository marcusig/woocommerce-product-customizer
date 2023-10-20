<?php 
namespace MKL\PC;


if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly
}

if ( ! class_exists( 'MKL\PC\Utils' ) ) {

	class Utils { 

		/**
		 * Get an item in an array
		 *
		 * @param array  $array        - The array to search
		 * @param string $by           - The field to sort
		 * @param mixed  $search_value - The value to search
		 * @return mixed
		 */
		public static function get_array_item( $array, $by = 'order', $search_value = NULL ) { 
			// if there is several items in the array, we search for the one(s) we need

			if ( ! is_array( $array )  ) return $array;
			
			if ( count($array) > 1 ) {

				// get the first one, ordered by 'order'
				if ( 'order' == $by ) {
					usort( $array, array( 'Utils', 'filter_order' ) ); 
					return $array[0];
				// get the item with such id
				} else {
					$result = Utils::filter_by_value( $array, $by, $search_value );
					if ( $result ) {
						return $result[0];
					} else {
						return false;
					}
				}

			} elseif ( count($array) == 1 ) {
				return $array[0];
			} else {
				return $array;
			}
		}

		/**
		 * Filter by order
		 *
		 * @param array $var1 - The first value to compare
		 * @param array $var2 - The second value to compare
		 * @return integer
		 */
		public static function filter_order( $var1, $var2 ) {
			return ( intval($var1['order']) < intval($var2['order']) ) ? -1 : 1;
		}

		/**
		 * Filter by value
		 *
		 * @param array   $array
		 * @param mixed   $index
		 * @param mixed   $value
		 * @param boolean $preserve_key
		 * @return array
		 */
		public static function filter_by_value ($array, $index, $value, $preserve_key = false){ 
			// maybe use wp_list_filter instead
			$newarray = [];

			if ( is_array($array) && count( $array ) > 0 ) { 

				foreach(array_keys($array) as $key) {
					$temp[$key] = $array[$key][$index];

					if ( $temp[$key] == $value ) {
						if ( $preserve_key ) {
							$newarray[$key] = $array[$key]; 
						} else {
							$newarray[] = $array[$key];
						}
					} 
				} 
			} else {
				return array();
			}

			return $newarray; 
		}

		/**
		 * Check if a product is configurable
		 *
		 * @param integer $product_id
		 * @return boolean
		 */
		public static function is_configurable( $product_id = NULL ) {
			if ( NULL == $product_id ) {
				// if $product_id wasn't given, find the current one
				$product_id = get_the_id();

				if ( NULL == $product_id || false == $product_id ) return false;
			} 
			// if $product_id doesn't match a product, exit
			if ( ! Utils::is_product( $product_id )  ) return false;

			$fetched_product = wc_get_product( $product_id );

			$configurable = $fetched_product->get_meta( MKL_PC_PREFIX.'_is_configurable' );

			// Check if the product type is registered
//			global $product;
			$product_types = apply_filters( 'mkl_pc_woocommerce_product_types', array( 'simple' ) );

			// if ( is_object( $product ) ) {

			// 	if ( ! in_array($product->product_type, $product_types) ) {
			// 		return false;
			// 	}
			// } else {

			if ( ! in_array($fetched_product->get_type(), $product_types) ) {
				return false;
			}

			// }

			return $configurable === 'yes';
		}

		/**
		 * Check if post is a product
		 *
		 * @param integer $post_id
		 * @return boolean
		 */
		public static function is_product( $post_id = NULL ) {
			$supported_post_types = apply_filters( 'mkl_pc_product_post_types', [ 'product_variation', 'product' ] );
			if ( NULL !== $post_id ) {
				$post_type = get_post_type( $post_id );
			} else { //else we look for the current product
				$post_type = get_post_type();
			}
			return in_array( $post_type, $supported_post_types );
		}

		/**
		 * Retreives an attachment id from its URL
		 * credit: https://pippinsplugins.com/retrieve-attachment-id-from-image-url/
		 *
		 * @param string $image_url
		 * @return void
		 */
		public static function get_image_id ( $image_url ) {
			global $wpdb;
			$attachment = $wpdb->get_col($wpdb->prepare("SELECT ID FROM $wpdb->posts WHERE guid='%s';", $image_url )); 
			return $attachment ? $attachment[0] : false;
		}

		/**
		 * Include a template file, and extracts some values
		 *
		 * @param string  $template_file          - The template to include (full path)
		 * @param boolean $return_instead_of_echo - Wether to echo or return
		 * @param array   $extract_these          - Variables to extract - will be available in the template
		 * @return void|string
		 */
		public static function include_template($template_file, $return_instead_of_echo = false, $extract_these = array()) {

			if ($return_instead_of_echo) ob_start();

			do_action('mkl_pc_before_template', $template_file, $return_instead_of_echo, $extract_these);

			if (!file_exists($template_file)) {
				error_log("MKL Product Configurator: template not found: ".$template_file);
				echo __('Error:', 'product-configurator-for-woocommerce').' '.__('template not found', 'product-configurator-for-woocommerce')." (".$template_file.")";
			} else {
				extract($extract_these, EXTR_SKIP);
				include $template_file;
			}

			do_action('mkl_pc_after_template', $template_file, $return_instead_of_echo, $extract_these);

			if ($return_instead_of_echo) return ob_get_clean();
		}

		/**
		 * Sanitize html classes
		 *
		 * @param string|array $classes
		 * @return string
		 */
		public static function sanitize_html_classes( $classes ) {
			if ( is_array( $classes ) ) return implode( ' ', array_filter( array_map( 'MKL\PC\Utils::sanitize_html_classes', $classes ) ) );
			$classes_array = explode( ' ', $classes );
			return implode( ' ', array_filter( array_map( 'sanitize_html_class', $classes_array ) ) );
		}

		/**
		 * Check if all requirements are available for the image compilation
		 *
		 * @return void
		 */
		public static function check_image_requirements() {
			if ( ! function_exists( 'finfo_buffer' ) ) {
				return false;
			}
			return true;
		}
	}
}
