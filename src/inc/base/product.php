<?php
namespace MKL\PC;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}


class Product {
	public static function set_layer_item_meta( $layer, $product, $item_key, $context = '' ) {

		$label = $layer->get_layer( 'name' );
		$value = $layer->get_choice( 'name' );

		if ( $layer->get_choice( 'show_group_label_in_cart' ) ) {
			$parent_id = $layer->get_choice( 'parent' );
			if ( $parent_id && is_callable( [ $layer, 'get_choice_by_id' ] ) ) {
				$parent = $layer->get_choice_by_id( $parent_id );
				if ( $parent && isset( $parent[ 'name' ] ) ) {
					$value = '<span class="pc-group-name">' . $parent[ 'name' ] . '</span> ' . $value;
				}
			}		
		}

		$meta = array(
			'label' => $label,
			'value' => $value,
			'layer' => $layer
		);
		return apply_filters( 'mkl_pc_item_meta', (array) $meta, $layer, $product, $item_key, $context ); 
	}
}