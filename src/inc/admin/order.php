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

if ( ! class_exists('MKL\PC\Admin_Order') ) {
	class Admin_Order {
		public function __construct() {
			$this->_hooks();
		}
		private function _hooks() {
			if ( apply_filters( 'mkl/order/override_saved_meta', false ) ) {
				add_filter( 'woocommerce_order_item_display_meta_value', array( $this, 'format_meta' ), 30, 3 );
			}
			// add_action( 'woocommerce_after_order_itemmeta', array( $this, 'wc_admin_order_item_display_configurator_data' ), 100, 3 );
		}

		/**
		 * Format the data in the order item meta
		 */
		public function format_meta( $display_value, $meta, $order_item ) {
			if ( 'Configuration' == $meta->key ) {
				static $items_count;
				if ( ! $items_count ) {
					$items_count = 1;
				} else {
					$items_count += 1;
				}
				$configurator_data = $order_item->get_meta( '_configurator_data' );
				$fe_order = mkl_pc( 'frontend' )->order;
				$product = is_callable( array( $order_item, 'get_product' ) ) ? $order_item->get_product() : false;
				
				foreach ( $configurator_data as $layer ) {
					if ( is_object($layer) ) {
						if ( $layer->get_layer( 'hide_in_cart' ) ) continue;
						if ( $layer->is_choice() ) :
							$choice_meta = apply_filters( 'mkl_pc/order_created/save_layer_meta', $fe_order->set_order_item_meta( $layer, $product ), $layer, $order_item, [], $items_count );
							$order_meta_for_configuration[] = $choice_meta;
						?>
						<?php
						endif;
					} 
				}

				if ( ! empty( $order_meta_for_configuration ) ) {
					return $fe_order->get_choices_html( $order_meta_for_configuration );
				}
			}
			return $display_value;
		}

		public function wc_admin_order_item_display_configurator_data( $item_id, $item, $_product ) {
			
			if( isset( $item['item_meta']['configurator_data'] ) ) {

				$data = (array) unserialize( $item['item_meta']['configurator_data'][0] ); 

				if( count( $data ) > 0 ){
					include 'views/html-order-item.php';
				}

			}
			
		}
	}
}