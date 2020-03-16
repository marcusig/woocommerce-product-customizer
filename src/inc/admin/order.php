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

class Admin_Order {
	public function __construct() {
		$this->_hooks();
	}
	private function _hooks() {
		// add_action( 'woocommerce_after_order_itemmeta', array( $this, 'wc_admin_order_item_display_customizer_data' ), 100, 3 );
	}
	public function wc_admin_order_item_display_customizer_data( $item_id, $item, $_product ) {
		
		if( isset( $item['item_meta']['customizer_data'] ) ) {

			$data = (array) unserialize( $item['item_meta']['customizer_data'][0] ); 

			if( count( $data ) > 0 ){
				include 'views/html-order-item.php';
			}

		}
		
	}
}