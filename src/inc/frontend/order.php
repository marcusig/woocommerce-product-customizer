<?php
namespace MKL\PC;
/**
 *	
 *	
 * @author   Marc Lacroix
 */


if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly
}

class Frontend_Order {
	public function __construct() {
		$this->_hooks();
	}
	private function _hooks() {
		add_action( 'woocommerce_checkout_create_order_line_item', array( $this, 'save_data' ), 20, 4 );
		// add_action( 'woocommerce_new_order_item', array( $this, 'add_order_item_meta' ), 10, 3 ); 
		// add_filter( 'woocommerce_order_items_meta_get_formatted', array( $this, 'format_order_item_metadata') ,10, 2 );
	}

	public function save_data( $item, $cart_item_key, $values, $order ) {
		if( isset( $values['customizer_data'] ) ) {
			$customizer_data = $values['customizer_data'];
			
			if( is_array( $customizer_data ) ) {
				// stores each couple layer name + choice as a order_item_meta, for automatic extraction
				foreach( $customizer_data as $layer ) {
					if( is_object($layer) ) {
						if( $layer->is_choice ) :
							
							$choice_meta = $this->set_order_item_meta( $layer );
							$item->add_meta_data( $choice_meta[ 'label' ], $choice_meta['value'], false );
						?>
						<?php		
						endif;
					} 
				}

			}
			
			// stores the whole _customizer_data object, in case we want to use it for some other stuff
			$item->add_meta_data( '_customizer_data', $customizer_data, false );
		}		
	}

	private function set_order_item_meta( $layer ) {
		$meta = array(
			'label' => $layer->get_layer('name'),
			'value' => $layer->get_choice('name'),
		);
		return apply_filters( 'mkl_pc_order_item_meta', $meta, $layer ); 
	}

	public function format_order_item_metadata( $formatted_meta, $meta_object ){
		// var_dump( $formatted_meta, $meta_object );
		if ( ! empty( $meta_object->meta ) && isset( $meta_object->meta['customizer_data'] ) && isset( $meta_object->meta['customizer_data'][0] ) ) {
			

			$data = unserialize($meta_object->meta['customizer_data'][0]);
			foreach( $data as $layer ) { 
				if( is_object($layer) ){
					if( $layer->is_choice ) :
						$formatted_meta[] = array(
							'key'   => 'customizer_data',
							'label' => $layer->get_layer('name'),
							'value' => apply_filters( 'woocommerce_order_item_display_meta_value', $layer->get_choice('name') ),
						);
					?>
					<?php		
					endif;
				} 
			}

		} 
		return $formatted_meta;
	}


}
