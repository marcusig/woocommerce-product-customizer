<?php
namespace MKL\PC;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}


class Product {
	public static function set_layer_item_meta( $layer, $product, $cart_item_key ) {

		$label = $layer->get_layer( 'name' );
		$value = $layer->get_choice( 'name' );
		
		$meta = array(
			'label' => $label,
			'value' => $value,
		);
		return apply_filters( 'mkl_pc_item_meta', (array) $meta, $layer, $product, $cart_item_key ); 
	}
}