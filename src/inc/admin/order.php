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
			add_filter( 'woocommerce_order_item_display_meta_value', array( $this, 'format_meta' ), 30, 3 );
			// add_action( 'woocommerce_after_order_itemmeta', array( $this, 'wc_admin_order_item_display_configurator_data' ), 100, 3 );
		}

		/**
		 * Format the data in the order item meta
		 */
		public function format_meta( $display_value, $meta, $order_item ) {

			// if ( ! is_string( $meta->value ) || ( ! strpos( $meta->value, 'order-configuration-details' ) && ! strpos( $meta->value, 'order-configuration' ) ) ) return $display_value;
			$configurator_data = $order_item->get_meta( '_configurator_data' );
			if ( ! $configurator_data ) return $display_value;
			
			if ( ! is_string( $meta->value ) || ! strpos( $meta->value, 'order-configuration' ) ) return $display_value;

			// Automatically override items with 'order-configuration-details'
			if ( is_string( $meta->value ) && apply_filters( 'mkl/order/override_saved_meta', strpos( $meta->value, 'order-configuration-details' ) ) ) {
			
				static $items_count;
				if ( ! $items_count ) {
					$items_count = 1;
				} else {
					$items_count += 1;
				}
				$fe_order = mkl_pc( 'frontend' )->order;
				$product = is_callable( array( $order_item, 'get_product' ) ) ? $order_item->get_product() : false;
				$order_meta_for_configuration = $fe_order->get_configuration_choices_for_display( $configurator_data, $order_item );
				// foreach ( $configurator_data as $layer ) {
				// 	if ( is_object($layer) ) {
				// 		if ( $layer->get_layer( 'hide_in_cart' ) || $layer->get_choice( 'hide_in_cart' ) ) continue;
				// 		if ( $layer->is_choice() ) :
				// 			$choice_meta = apply_filters( 'mkl_pc/order_created/save_layer_meta', $fe_order->set_order_item_meta( $layer, $product ), $layer, $order_item, [], $items_count );
				// 			$order_meta_for_configuration[] = $choice_meta;
				// 		endif;
				// 	} 
				// }

				if ( ! empty( $order_meta_for_configuration ) ) {
					$display_value = $fe_order->get_choices_html( $order_meta_for_configuration );
				}
			}
			
			$display_value = apply_filters( 'mkl/order/admin_meta/display_value', $display_value, $order_item, $configurator_data );
			$view_link = $order_item->get_meta( '_configurator_data_raw' ) ? get_permalink( $order_item->get_product_id() ) : false;
			
			return $display_value . ( $view_link ? '<a class="configuration-link" href="' . esc_url( add_query_arg( array( 'load_config_from_order' => $order_item->get_id(), 'open_configurator'=> 1 ), $view_link ) ) . '" target="_blank">' . mkl_pc( 'settings' )->get_label( 'view_configuration', __( 'View configuration', 'product-configurator-for-woocommerce' ) ) . '</a>' : '' );
		}

		public function wc_admin_order_item_display_configurator_data( $item_id, $item, $_product ) {
			
			if ( isset( $item['item_meta']['configurator_data'] ) ) {

				$data = (array) unserialize( $item['item_meta']['configurator_data'][0] ); 

				if( count( $data ) > 0 ){
					include 'views/html-order-item.php';
				}

			}
			
		}
	}
}