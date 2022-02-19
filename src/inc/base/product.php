<?php
namespace MKL\PC;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}


class Product {
	public static function set_layer_item_meta( $layer, $product, $cart_item_key ) {

		$label = $layer->get_layer( 'name' );
		$value = $layer->get_choice( 'name' );

		// WPML
		if ( function_exists( 'wpml_get_current_language' ) && function_exists( 'wpml_get_default_language' ) && wpml_get_default_language() !== wpml_get_current_language() ) {
			if ( $label_translation = $layer->get_layer( 'name_' . wpml_get_current_language() ) ) {
				$label = $label_translation;
			}
			if ( $value_translation = $layer->get_choice( 'name_' . wpml_get_current_language() ) ) {
				$value = $value_translation;
			}
		}
		
		$meta = array(
			'label' => $label,
			'value' => $value,
		);
		return apply_filters( 'mkl_pc_item_meta', (array) $meta, $layer, $product, $cart_item_key ); 
	}
}