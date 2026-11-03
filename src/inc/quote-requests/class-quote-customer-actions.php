<?php
namespace MKL\PC;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * The customer answers a request kept as a post, from where they see it
 *
 * - accept the quote, once it was sent: with WooCommerce, the request becomes an order at the quoted
 *   price (or the order already made from it), and the customer goes to its payment page. The order
 *   fixes the price, so nothing is repriced in a cart. Without WooCommerce, the request is marked
 *   accepted and the merchant takes it from there;
 * - decline it, with an optional reason;
 * - ask for a change, until the quote is accepted or declined: the request goes back to "In progress".
 *
 * Only whoever has the request's link (its key) or the account it is linked to answers: a merchant
 * who can open every request does not answer for the customer. Each answer is written in the
 * request's history and emailed to the merchant, with a confirmation to the customer.
 */
class Quote_Customer_Actions {

	/**
	 * The POST field holding the answer, the nonce action's prefix and the rate limit's action.
	 */
	const ACTION = 'mkl_pc_quote_answer';

	/**
	 * Query arg telling the page what came of the answer, after the redirect.
	 */
	const RESULT_VAR = 'quote_answer';

	/**
	 * Longest message, in characters.
	 */
	const MESSAGE_MAX = 2000;

	/**
	 * @var CPT_Store
	 */
	private $store;

	public function __construct( CPT_Store $store ) {
		$this->store = $store;
		add_action( 'template_redirect', [ $this, 'handle' ], 20 );
	}

	/**
	 * The answers a request can get now
	 *
	 * @param Quote_Request $request
	 * @return string[] accept, decline, change.
	 */
	public function get_available( Quote_Request $request ) {
		$answers = [];
		if ( 'mkl_quote_answered' === $request->status && (int) get_post_meta( $request->id, '_mkl_pc_quote_sent', true ) ) {
			$answers = [ 'accept', 'decline' ];
		}
		if ( in_array( $request->status, [ 'mkl_quote_new', 'mkl_quote_progress', 'mkl_quote_answered' ], true ) ) {
			$answers[] = 'change';
		}
		/**
		 * The answers a customer can give a quote request now
		 *
		 * @param string[]      $answers accept, decline, change.
		 * @param Quote_Request $request
		 */
		return array_values( array_intersect( [ 'accept', 'decline', 'change' ], (array) apply_filters( 'mkl_pc/quote_request/customer_answers', $answers, $request ) ) );
	}

	/**
	 * Whether the visitor answers for the customer: with the request's key, or as its account
	 *
	 * @param Quote_Request $request
	 * @param string        $key
	 * @return boolean
	 */
	public function can_answer( Quote_Request $request, $key = '' ) {
		if ( '' !== (string) $key && '' !== $request->access_key && hash_equals( $request->access_key, (string) $key ) ) return true;
		return $request->user_id && get_current_user_id() === $request->user_id;
	}

	/**
	 * Whether accepting makes an order to pay
	 *
	 * @param Quote_Request $request
	 * @return boolean
	 */
	public function accept_creates_order( Quote_Request $request ) {
		/**
		 * Whether accepting a quote creates a WooCommerce order and sends the customer to pay it
		 *
		 * Off, the request is marked accepted and the merchant is told.
		 *
		 * @param boolean       $creates
		 * @param Quote_Request $request
		 */
		return (bool) apply_filters( 'mkl_pc/quote_request/accept_creates_order', mkl_pc( 'quotes' )->woo_order_store->is_available(), $request );
	}

	/**
	 * The order the request was accepted as, if any
	 *
	 * @param Quote_Request $request
	 * @return \WC_Order|null
	 */
	public function get_order( Quote_Request $request ) {
		if ( ! function_exists( 'wc_get_order' ) ) return null;
		$order_id = (int) get_post_meta( $request->id, '_mkl_pc_quote_order_id', true );
		$order = $order_id ? wc_get_order( $order_id ) : null;
		return $order ? $order : null;
	}

	/**
	 * The page to pay the accepted quote, while it waits for payment
	 *
	 * @param Quote_Request $request
	 * @return string
	 */
	public function get_pay_url( Quote_Request $request ) {
		if ( 'mkl_quote_accepted' !== $request->status ) return '';
		$order = $this->get_order( $request );
		return $order && $order->needs_payment() ? $order->get_checkout_payment_url() : '';
	}

	/**
	 * Answer a request
	 *
	 * Who answers is checked by the caller (can_answer()).
	 *
	 * @param Quote_Request $request
	 * @param string        $answer  accept, decline, change.
	 * @param string        $message The reason, or the change asked for (required then).
	 * @return array|\WP_Error answer, order (\WC_Order|null), redirect (the payment page, or '').
	 */
	public function answer( Quote_Request $request, $answer, $message = '' ) {
		if ( ! in_array( $answer, $this->get_available( $request ), true ) ) {
			return new \WP_Error( 'unavailable', __( 'This quote can no longer be answered here.', 'product-configurator-for-woocommerce' ) );
		}
		$message = trim( sanitize_textarea_field( (string) $message ) );
		$message = function_exists( 'mb_substr' ) ? mb_substr( $message, 0, self::MESSAGE_MAX ) : substr( $message, 0, self::MESSAGE_MAX );
		if ( 'change' === $answer && '' === $message ) {
			return new \WP_Error( 'message', __( 'Please tell us what you would like to change.', 'product-configurator-for-woocommerce' ) );
		}

		$order = null;
		switch ( $answer ) {
			case 'accept':
				if ( $this->accept_creates_order( $request ) ) {
					$order = $this->get_order_to_pay( $request );
					if ( is_wp_error( $order ) ) return $order;
				}
				$status = 'mkl_quote_accepted';
				$log = $order
					/* translators: %s: order number */
					? sprintf( __( 'Quote accepted by the customer. Order #%s created, waiting for payment.', 'product-configurator-for-woocommerce' ), $order->get_order_number() )
					: __( 'Quote accepted by the customer.', 'product-configurator-for-woocommerce' );
				break;
			case 'decline':
				$status = 'mkl_quote_declined';
				$log = '' !== $message
					/* translators: %s: what the customer wrote */
					? sprintf( __( 'Quote declined by the customer: %s', 'product-configurator-for-woocommerce' ), $message )
					: __( 'Quote declined by the customer.', 'product-configurator-for-woocommerce' );
				break;
			default:
				$status = 'mkl_quote_progress';
				/* translators: %s: what the customer wrote */
				$log = sprintf( __( 'The customer asked for a change: %s', 'product-configurator-for-woocommerce' ), $message );
		}

		if ( $status !== $request->status ) {
			wp_update_post( [ 'ID' => $request->id, 'post_status' => $status ] );
			$request->status = $status;
		}
		$this->store->log( $request->id, $log );

		$args = [
			'answer'  => $answer,
			'message' => $message,
			'order'   => $order,
		];
		mkl_pc( 'mailer' )->send( 'mkl_pc_quote_request_answer', $request, $args );
		mkl_pc( 'mailer' )->send( 'mkl_pc_quote_request_answer_customer', $request, $args );

		/**
		 * Fires once a customer answered a quote request
		 *
		 * @param Quote_Request  $request
		 * @param string         $answer  accept, decline, change.
		 * @param string         $message
		 * @param \WC_Order|null $order   The order to pay, when accepting made one.
		 */
		do_action( 'mkl_pc/quote_request/customer_answered', $request, $answer, $message, $order );

		return [
			'answer'   => $answer,
			'order'    => $order,
			'redirect' => $order && $order->needs_payment() ? $order->get_checkout_payment_url() : '',
		];
	}

	/**
	 * The order of an accepted quote: made from the request, or the one the merchant already made
	 *
	 * A quote order becomes a pending order, which WooCommerce lets its customer pay.
	 *
	 * @param Quote_Request $request
	 * @return \WC_Order|\WP_Error
	 */
	private function get_order_to_pay( Quote_Request $request ) {
		$order = mkl_pc( 'quotes' )->woo_order_store->create_order_from_request_post( $request->id );
		if ( is_wp_error( $order ) ) {
			return new \WP_Error( 'failed', __( 'Your order could not be created. Please contact us.', 'product-configurator-for-woocommerce' ), [ 'error' => $order ] );
		}
		if ( $order->has_status( Woo_Order_Store::STATUS ) ) {
			$order->update_status( 'pending', __( 'Quote accepted by the customer.', 'product-configurator-for-woocommerce' ) );
		}
		return $order;
	}

	/**
	 * The answer forms, posted to the page they are on
	 *
	 * Answers then redirect: to the payment page, or back with RESULT_VAR.
	 *
	 * @return void
	 */
	public function handle() {
		// phpcs:disable WordPress.Security.NonceVerification.Missing -- Checked below, once the request is known.
		if ( 'POST' !== ( isset( $_SERVER['REQUEST_METHOD'] ) ? $_SERVER['REQUEST_METHOD'] : '' ) || ! isset( $_POST[ self::ACTION ] ) ) return; // phpcs:ignore WordPress.Security.ValidatedSanitizedInput
		$answer = sanitize_key( wp_unslash( $_POST[ self::ACTION ] ) );
		$reference = isset( $_POST['reference'] ) ? sanitize_text_field( wp_unslash( $_POST['reference'] ) ) : '';
		$key = isset( $_POST['key'] ) ? sanitize_text_field( wp_unslash( $_POST['key'] ) ) : '';
		$message = isset( $_POST['message'] ) ? sanitize_textarea_field( wp_unslash( $_POST['message'] ) ) : '';
		// phpcs:enable

		$back = remove_query_arg( self::RESULT_VAR, isset( $_SERVER['REQUEST_URI'] ) ? wp_unslash( $_SERVER['REQUEST_URI'] ) : '' ); // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized -- Redirected through wp_safe_redirect().
		$result = $this->handle_answer( $reference, $key, $answer, $message );
		if ( is_array( $result ) && $result['redirect'] ) {
			$url = $result['redirect'];
		} else {
			$code = is_wp_error( $result ) ? $result->get_error_code() : [ 'accept' => 'accepted', 'decline' => 'declined', 'change' => 'changed' ][ $result['answer'] ];
			$url = add_query_arg( self::RESULT_VAR, $code, $back ) . '#mkl-pc-quote-answer';
		}
		wp_safe_redirect( $url );
		exit;
	}

	/**
	 * Check the visitor and the form, then answer
	 *
	 * @param string $reference
	 * @param string $key
	 * @param string $answer
	 * @param string $message
	 * @return array|\WP_Error See answer().
	 */
	public function handle_answer( $reference, $key, $answer, $message ) {
		$request = $this->store->get_by_reference( $reference );
		if ( ! $request || ! $this->can_answer( $request, $key ) ) {
			return new \WP_Error( 'unavailable', '' );
		}
		if ( ! isset( $_POST['_wpnonce'] ) || ! wp_verify_nonce( sanitize_key( wp_unslash( $_POST['_wpnonce'] ) ), self::ACTION . '_' . $request->id ) ) {
			return new \WP_Error( 'expired', '' );
		}
		// Accepted already (a second click, the back button): the order still waits for its payment.
		if ( 'accept' === $answer && ( $pay_url = $this->get_pay_url( $request ) ) ) {
			return [ 'answer' => $answer, 'order' => $this->get_order( $request ), 'redirect' => $pay_url ];
		}
		$security = mkl_pc( 'frontend_security' );
		if ( $security && is_wp_error( $security->enforce_rate_limit( self::ACTION ) ) ) {
			return new \WP_Error( 'limited', '' );
		}
		return $this->answer( $request, $answer, $message );
	}

	/**
	 * What came of the last answer, from RESULT_VAR
	 *
	 * @return array|null code, message, error (boolean).
	 */
	public function get_result() {
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Only picks one of the messages below.
		$code = isset( $_GET[ self::RESULT_VAR ] ) ? sanitize_key( wp_unslash( $_GET[ self::RESULT_VAR ] ) ) : '';
		$messages = [
			'accepted'    => __( 'Thank you, you accepted the quote. We will be in touch to finalize your order.', 'product-configurator-for-woocommerce' ),
			'declined'    => __( 'You declined the quote. Thank you for letting us know.', 'product-configurator-for-woocommerce' ),
			'changed'     => __( 'Thank you, your message was sent. We will get back to you.', 'product-configurator-for-woocommerce' ),
			'message'     => __( 'Please tell us what you would like to change.', 'product-configurator-for-woocommerce' ),
			'unavailable' => __( 'This quote can no longer be answered here.', 'product-configurator-for-woocommerce' ),
			'expired'     => __( 'The form expired. Please try again.', 'product-configurator-for-woocommerce' ),
			'limited'     => __( 'Too many requests. Please try again later.', 'product-configurator-for-woocommerce' ),
			'failed'      => __( 'Your order could not be created. Please contact us.', 'product-configurator-for-woocommerce' ),
		];
		if ( ! isset( $messages[ $code ] ) ) return null;
		return [
			'code'    => $code,
			'message' => $messages[ $code ],
			'error'   => ! in_array( $code, [ 'accepted', 'declined', 'changed' ], true ),
		];
	}

	/**
	 * The answer forms and the payment link, under a request
	 *
	 * @param Quote_Request       $request
	 * @param string              $key  The request's key, when the visitor came with it.
	 * @param Quote_Customer_View $view
	 * @return string
	 */
	public function render( Quote_Request $request, $key, Quote_Customer_View $view ) {
		if ( ! $this->can_answer( $request, $key ) ) return '';
		$order = 'mkl_quote_accepted' === $request->status ? $this->get_order( $request ) : null;
		return $view->render( 'quotes/quote-answer.php', [
			'request'      => $request,
			'answers'      => $this->get_available( $request ),
			'result'       => $this->get_result(),
			'order'        => $order,
			'pay_url'      => $this->get_pay_url( $request ),
			'accept_pays'  => $this->accept_creates_order( $request ),
			'fields'       => $this->get_hidden_fields( $request, $key ),
			'button_class' => $view->get_button_class(),
		] );
	}

	/**
	 * What every answer form sends besides the answer
	 *
	 * @param Quote_Request $request
	 * @param string        $key
	 * @return string HTML.
	 */
	private function get_hidden_fields( Quote_Request $request, $key ) {
		// Not wp_nonce_field(): its id would repeat in every form.
		$html = '<input type="hidden" name="_wpnonce" value="' . esc_attr( wp_create_nonce( self::ACTION . '_' . $request->id ) ) . '" />';
		$html .='<input type="hidden" name="reference" value="' . esc_attr( $request->reference ) . '" />';
		if ( '' !== (string) $key ) {
			$html .= '<input type="hidden" name="key" value="' . esc_attr( $key ) . '" />';
		}
		return $html;
	}
}
