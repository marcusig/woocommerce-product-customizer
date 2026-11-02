<?php
namespace MKL\PC;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

require_once __DIR__ . '/class-quote-request-email.php';

if ( ! class_exists( 'MKL\PC\Quote_Request_Quote_Email', false ) ) :

	/**
	 * The quote, sent to the customer from the request's screen
	 *
	 * Takes a `message` arg: what the merchant wrote for this sending.
	 */
	class Quote_Request_Quote_Email extends Quote_Request_Email {

		/**
		 * @var string
		 */
		protected $quote_message = '';

		/**
		 * Constructor.
		 */
		public function __construct() {
			$this->id             = 'mkl_pc_quote_request_quote';
			$this->customer_email = true;
			$this->title          = __( 'Configurator quote', 'product-configurator-for-woocommerce' );
			$this->description    = __( 'Sent to the customer when you send them a quote from Product Configurator > Quote requests.', 'product-configurator-for-woocommerce' );
			parent::__construct();
		}

		public function get_default_subject() {
			return __( 'Your quote {reference} from {site_title}', 'product-configurator-for-woocommerce' );
		}

		public function get_default_heading() {
			return __( 'Your quote', 'product-configurator-for-woocommerce' );
		}

		public function get_default_main_content() {
			return __( "Hi {name},\n\nHere is our quote for {product}.", 'product-configurator-for-woocommerce' );
		}

		public function get_default_additional_content() {
			return '';
		}

		/**
		 * @param Quote_Request $request
		 * @param array         $args    message.
		 * @return boolean
		 */
		public function trigger( $request, $args = [] ) {
			$this->quote_message = isset( $args['message'] ) ? (string) $args['message'] : '';
			$sent = parent::trigger( $request, $args );
			$this->quote_message = '';
			return $sent;
		}

		/**
		 * The PDF shows the message being sent, not the last one
		 *
		 * @return array
		 */
		protected function get_pdf_args() {
			return [ 'context' => 'email', 'message' => $this->quote_message, 'quote' => true ];
		}

		protected function get_template_args( $plain_text ) {
			$args = parent::get_template_args( $plain_text );
			$args['is_quote'] = true;
			$args['quote_message'] = $this->quote_message;
			// A quote states its price, whatever the request emails show.
			$args['show_prices'] = function_exists( 'wc_price' );
			return $args;
		}
	}

endif;
