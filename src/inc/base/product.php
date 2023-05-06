<?php
namespace MKL\PC;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}


class Product {
	public static function set_layer_item_meta( $layer, $product, $item_key, $context = '' ) {

		$label = $layer->get_layer( 'name' );
		$value = $layer->get_choice( 'name' );
		if ( apply_filters( 'mkl_pc_item_meta/wrap_choice_name', true, $layer ) ) {
			$value = '<span class="mkl_pc-choice-name">' . $value . '</span>';
		}
		if ( $layer->get_choice( 'parent' ) && is_callable( [ $layer, 'get_choice_by_id' ] ) ) {
			$parent = $layer->get_choice_by_id( $layer->get_choice( 'parent' ) );
			if ( $parent && isset( $parent['show_group_label_in_cart'] ) && $parent['show_group_label_in_cart'] && isset( $parent[ 'name' ] ) ) {
				$value = '<span class="pc-group-name">' . $parent[ 'name' ] . '</span> ' . $value;
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