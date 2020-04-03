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

if ( ! class_exists('MKL\PC\Frontend_Order') ) {
	class Frontend_Order {
		public function __construct() {
			$this->_hooks();
		}
		private function _hooks() {
			add_action( 'woocommerce_checkout_create_order_line_item', array( $this, 'save_data' ), 20, 4 );
		}

		public function save_data( $item, $cart_item_key, $values, $order ) {
			if( isset( $values['configurator_data'] ) ) {
				$configurator_data = $values['configurator_data'];
				
				if( is_array( $configurator_data ) ) {
					// stores each couple layer name + choice as a order_item_meta, for automatic extraction
					foreach( $configurator_data as $layer ) {
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
				
				// stores the whole _configurator_data object
				$item->add_meta_data( '_configurator_data', $configurator_data, false );
			}		
		}

		private function set_order_item_meta( $layer ) {
			$meta = array(
				'label' => $layer->get_layer('name'),
				'value' => $layer->get_choice('name'),
			);
			return apply_filters( 'mkl_pc_order_item_meta', $meta, $layer ); 
		}
	}
}