<?php
namespace MKL\PC;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

require_once __DIR__ . '/class-quote-request-email.php';

if ( ! class_exists( 'MKL\PC\Quote_Request_Admin_Email', false ) ) :

	/**
	 * Quote request, sent to the merchant
	 */
	class Quote_Request_Admin_Email extends Quote_Request_Email {

		/**
		 * Constructor.
		 */
		public function __construct() {
			$this->id             = 'mkl_pc_quote_request_admin';
			$this->customer_email = false;
			$this->title          = __( 'Configurator quote request', 'product-configurator-for-woocommerce' );
			$this->description    = __( 'Sent to the shop when a customer requests a quote for a configured product.', 'product-configurator-for-woocommerce' );
			parent::__construct();
		}

		public function get_default_subject() {
			return __( '[{site_title}]: Quote request {reference} from {name}', 'product-configurator-for-woocommerce' );
		}

		public function get_default_heading() {
			return __( 'New quote request: {reference}', 'product-configurator-for-woocommerce' );
		}

		public function get_default_main_content() {
			return __( '{name} requested a quote for {product}.', 'product-configurator-for-woocommerce' );
		}

		public function get_default_additional_content() {
			return __( 'Reply to this email to answer the customer.', 'product-configurator-for-woocommerce' );
		}
	}

endif;
