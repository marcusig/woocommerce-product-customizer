<?php
namespace MKL\PC;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

require_once __DIR__ . '/class-quote-request-email.php';

if ( ! class_exists( 'MKL\PC\Quote_Request_Answer_Base_Email', false ) ) :

	/**
	 * The customer answered a quote: accepted, declined, or asked for a change
	 *
	 * Takes `answer` (accept, decline, change), `message` (what they wrote) and `order` (the order to
	 * pay, when accepting made one).
	 */
	abstract class Quote_Request_Answer_Base_Email extends Quote_Request_Email {

		/**
		 * @var array answer, message, order.
		 */
		protected $answer = [];

		/**
		 * Constructor.
		 */
		public function __construct() {
			parent::__construct();
			$this->template_html  = 'emails/quote-request-answer.php';
			$this->template_plain = 'emails/plain/quote-request-answer.php';
			$this->placeholders['{answer}'] = '';
		}

		/**
		 * The answers, as titles
		 *
		 * @return array
		 */
		public static function get_answer_labels() {
			return [
				'accept'  => _x( 'Accepted', 'Customer answer to a quote', 'product-configurator-for-woocommerce' ),
				'decline' => _x( 'Declined', 'Customer answer to a quote', 'product-configurator-for-woocommerce' ),
				'change'  => _x( 'Change requested', 'Customer answer to a quote', 'product-configurator-for-woocommerce' ),
			];
		}

		/**
		 * @param Quote_Request $request
		 * @param array         $args    answer, message, order.
		 * @return boolean
		 */
		public function trigger( $request, $args = [] ) {
			$labels = self::get_answer_labels();
			$this->answer = wp_parse_args( $args, [ 'answer' => '', 'message' => '', 'order' => null ] );
			if ( ! isset( $labels[ $this->answer['answer'] ] ) ) return false;
			$this->placeholders['{answer}'] = $labels[ $this->answer['answer'] ];
			$sent = parent::trigger( $request, $args );
			$this->answer = [];
			return $sent;
		}

		/**
		 * The image was in the request and the quote
		 *
		 * @return array
		 */
		public function get_attachments() {
			return Email::get_attachments();
		}

		protected function get_template_args( $plain_text ) {
			$args = parent::get_template_args( $plain_text );
			$order = $this->answer['order'];
			$args['answer'] = $this->answer['answer'];
			$args['customer_message'] = $this->answer['message'];
			$args['order'] = $order;
			$args['pay_url'] = $order && $order->needs_payment() ? $order->get_checkout_payment_url() : '';
			$args['is_quote'] = true;
			$args['show_prices'] = function_exists( 'wc_price' );
			return $args;
		}
	}

	/**
	 * The customer's answer, sent to the shop
	 */
	class Quote_Request_Answer_Email extends Quote_Request_Answer_Base_Email {

		/**
		 * Constructor.
		 */
		public function __construct() {
			$this->id             = 'mkl_pc_quote_request_answer';
			$this->customer_email = false;
			$this->title          = __( 'Configurator quote answer', 'product-configurator-for-woocommerce' );
			$this->description    = __( 'Sent to the shop when a customer accepts or declines a quote, or asks for a change, from the page of their request.', 'product-configurator-for-woocommerce' );
			parent::__construct();
		}

		public function get_default_subject() {
			return __( '[{site_title}]: Quote {reference}: {answer}', 'product-configurator-for-woocommerce' );
		}

		public function get_default_heading() {
			return __( 'Quote {reference}: {answer}', 'product-configurator-for-woocommerce' );
		}

		public function get_default_main_content() {
			return __( '{name} answered the quote for {product}.', 'product-configurator-for-woocommerce' );
		}

		public function get_default_additional_content() {
			return __( 'Reply to this email to answer the customer.', 'product-configurator-for-woocommerce' );
		}
	}

	/**
	 * The customer's answer, confirmed to them
	 */
	class Quote_Request_Answer_Customer_Email extends Quote_Request_Answer_Base_Email {

		/**
		 * Constructor.
		 */
		public function __construct() {
			$this->id             = 'mkl_pc_quote_request_answer_customer';
			$this->customer_email = true;
			$this->title          = __( 'Configurator quote answer, to the customer', 'product-configurator-for-woocommerce' );
			$this->description    = __( 'Sent to the customer to confirm their answer to a quote: accepted (with the payment link, when an order was made), declined, or a change asked for.', 'product-configurator-for-woocommerce' );
			parent::__construct();
		}

		public function get_default_subject() {
			return __( 'Your answer to quote {reference}', 'product-configurator-for-woocommerce' );
		}

		public function get_default_heading() {
			return __( 'Quote {reference}: {answer}', 'product-configurator-for-woocommerce' );
		}

		public function get_default_main_content() {
			return __( "Hi {name},\n\nThank you, we received your answer.", 'product-configurator-for-woocommerce' );
		}

		public function get_default_additional_content() {
			return '';
		}
	}

endif;
