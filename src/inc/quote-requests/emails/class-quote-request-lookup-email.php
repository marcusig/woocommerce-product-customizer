<?php
namespace MKL\PC;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( ! class_exists( 'MKL\PC\Quote_Request_Lookup_Email', false ) ) :

	/**
	 * The links of the quote requests sent with an address, asked for on the customer page
	 *
	 * Sent to that address only: whoever asked, only its owner reads the links.
	 */
	class Quote_Request_Lookup_Email extends Email {

		/**
		 * @var Quote_Request[]
		 */
		protected $requests = [];

		/**
		 * Constructor.
		 */
		public function __construct() {
			$this->id             = 'mkl_pc_quote_request_lookup';
			$this->customer_email = true;
			$this->title          = __( 'Configurator quote request links', 'product-configurator-for-woocommerce' );
			$this->description    = __( 'Sent to a customer who asks for the links of their quote requests on the customer page.', 'product-configurator-for-woocommerce' );
			$this->template_html  = 'emails/quote-request-lookup.php';
			$this->template_plain = 'emails/plain/quote-request-lookup.php';
			parent::__construct();
		}

		public function get_default_subject() {
			return __( 'Your quote requests on {site_title}', 'product-configurator-for-woocommerce' );
		}

		public function get_default_heading() {
			return __( 'Your quote requests', 'product-configurator-for-woocommerce' );
		}

		public function get_default_main_content() {
			return __( 'Here are the quote requests sent with this email address. Each link shows the request.', 'product-configurator-for-woocommerce' );
		}

		public function get_default_additional_content() {
			return __( 'If you did not ask for this email, you can ignore it.', 'product-configurator-for-woocommerce' );
		}

		/**
		 * @param string $email
		 * @param array  $args  requests (Quote_Request[]).
		 * @return boolean
		 */
		public function trigger( $email, $args = [] ) {
			$this->requests = isset( $args['requests'] ) ? array_values( (array) $args['requests'] ) : [];
			if ( ! is_email( $email ) || ! $this->requests ) return false;
			$this->setup_locale();
			$this->object = $email;
			$this->recipient = $email;
			$sent = $this->deliver();
			$this->restore_locale();
			$this->requests = [];
			return $sent;
		}

		protected function get_template_args( $plain_text ) {
			$args = parent::get_template_args( $plain_text );
			$args['requests'] = $this->requests;
			return $args;
		}
	}

endif;
