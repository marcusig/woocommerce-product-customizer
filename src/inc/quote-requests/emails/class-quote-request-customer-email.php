<?php
namespace MKL\PC;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

require_once __DIR__ . '/class-quote-request-email.php';

if ( ! class_exists( 'MKL\PC\Quote_Request_Customer_Email', false ) ) :

	/**
	 * Confirmation of a quote request, sent to the customer
	 */
	class Quote_Request_Customer_Email extends Quote_Request_Email {

		/**
		 * Constructor.
		 */
		public function __construct() {
			$this->id             = 'mkl_pc_quote_request_customer';
			$this->customer_email = true;
			$this->title          = __( 'Configurator quote request received', 'product-configurator-for-woocommerce' );
			$this->description    = __( 'Sent to the customer to confirm their quote request for a configured product.', 'product-configurator-for-woocommerce' );
			parent::__construct();
		}

		public function get_default_subject() {
			return __( 'We received your quote request {reference}', 'product-configurator-for-woocommerce' );
		}

		public function get_default_heading() {
			return __( 'Thank you for your request', 'product-configurator-for-woocommerce' );
		}

		public function get_default_main_content() {
			return __( "Hi {name},\n\nWe received your quote request for {product} and will get back to you shortly. Here is what you sent us.", 'product-configurator-for-woocommerce' );
		}

		public function get_default_additional_content() {
			return '';
		}
	}

endif;
