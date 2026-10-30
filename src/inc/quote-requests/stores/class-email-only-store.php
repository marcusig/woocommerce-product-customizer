<?php
namespace MKL\PC;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Quote requests that only exist as emails
 */
class Email_Only_Store implements Quote_Store {

	public function get_id() {
		return 'email';
	}

	public function get_label() {
		return __( 'Send by email only', 'product-configurator-for-woocommerce' );
	}

	public function is_available() {
		return true;
	}

	public function is_persistent() {
		return false;
	}

	public function get_files_folder() {
		return 'quotes';
	}

	public function save( Quote_Request $request ) {
		return true;
	}
}
