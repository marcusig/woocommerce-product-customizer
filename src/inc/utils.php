<?php 
namespace MKL\PC;


if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly
}

if ( ! class_exists( 'MKL\PC\Utils' ) ) {

	class Utils { 

		public static function get_array_item( $array, $by = 'order', $search_value = NULL ) { 
			// if there is several items in the array, we search for the one(s) we need

			if ( count($array) > 1 ) {

				// get the first one, ordered by 'order'
				if( 'order' == $by ) {
					usort( $array, array( self, 'filter_order' ) ); 
					return $array[0];

				// get the item with such id
				} else { 
					$result = self::filter_by_value( $array, $by, $search_value ) ;
					if( $result )
						return $result[0];
					else 
						return false;
				}

			} elseif( count($array) == 1 ) {
				return $array[0];
			} else {
				return $array;
			}
		}

		public static function filter_order( $var1, $var2 ) {
			return ( intval($var1['order']) < intval($var2['order']) ) ? -1 : 1;
		}

		public static function filter_array( $key, $val ) {
			
		}
		public static function filter_by_value ($array, $index, $value, $preserve_key = false){ 
			// maybe use wp_list_filter instead
			$newarray = [];

			if( is_array($array) && count( $array ) > 0) { 

				foreach(array_keys($array) as $key){ 
					$temp[$key] = $array[$key][$index]; 

					if ($temp[$key] == $value){ 
						if( $preserve_key )
							$newarray[$key] = $array[$key]; 
						else 
							$newarray[] = $array[$key]; 
					} 
				} 
			} else {
				return array(); 
			}

			return $newarray; 
		}

		// General function to find if a product is customizable
		public static function is_customizable( $product_id = NULL ) {
			if( NULL == $product_id ) {
				// if $product_id wasn't given, find the current one
				$product_id = get_the_id();

				if( NULL == $product_id || false == $product_id ) return false;
			} 
			// if $product_id doesn't match a product, exit
			if( ! self::is_product( $product_id )  ) return false;

			$fetched_product = wc_get_product( $product_id );

			$customizable = $fetched_product->get_meta( MKL_PC_PREFIX.'_is_customizable' );

			// Check if the product type is registered
//			global $product;
			$product_types = apply_filters( 'mkl_pc_woocommerce_product_types', array('simple') );

			// if( is_object( $product ) ) {

			// 	if( ! in_array($product->product_type, $product_types) ) {
			// 		return false;
			// 	}
			// } else {

			if( ! in_array($fetched_product->get_type(), $product_types) ) {
				return false;
			}

			// }

			return ( $customizable == 'yes' ) ? true : false ;
		}

		
		public static function is_product( $product_id = NULL ) {
			if( NULL !== $product_id ) {
				if( 'product' != get_post_type( $product_id ) ) return false;

			} else { //else we look for the current product

				if( 'product' != get_post_type() ) return false;

			}
			return true;
		}
		// retreives an attachment id from its URL
		// credit: https://pippinsplugins.com/retrieve-attachment-id-from-image-url/
		public static function get_image_id ( $image_url ) {
			global $wpdb;
			$attachment = $wpdb->get_col($wpdb->prepare("SELECT ID FROM $wpdb->posts WHERE guid='%s';", $image_url )); 
			return $attachment[0]; 
		}

	}

}
