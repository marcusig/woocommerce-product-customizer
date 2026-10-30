<?php
namespace MKL\PC;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * REST API for quote requests
 *
 * GET  mkl_pc/v1/quote-requests/schema?product_id=  The form for a product, and how to send it.
 * POST mkl_pc/v1/quote-requests                      Send a request.
 *
 * Sending needs a one-time token from mkl_pc/v1/frontend-action-token (purpose `quote_request_send`),
 * which is where a captcha is checked when one is required. Errors are WP_Errors whose data holds
 * the HTTP status and, for form errors, `field_errors` (field id => message).
 */
class Quote_REST {

	const NAMESPACE = 'mkl_pc/v1';

	public function __construct() {
		add_action( 'rest_api_init', [ $this, 'register_routes' ] );
	}

	public function register_routes() {
		register_rest_route( self::NAMESPACE, '/quote-requests/schema', [
			'methods'             => \WP_REST_Server::READABLE,
			'callback'            => [ $this, 'get_schema' ],
			'permission_callback' => '__return_true',
			'args'                => [
				'product_id' => [
					'required' => true,
					'type'     => 'integer',
				],
			],
		] );

		register_rest_route( self::NAMESPACE, '/quote-requests', [
			'methods'             => \WP_REST_Server::CREATABLE,
			'callback'            => [ $this, 'create' ],
			'permission_callback' => '__return_true',
			'args'                => [
				'product_id'    => [
					'required' => true,
					'type'     => 'integer',
				],
				'variation_id'  => [
					'type'    => 'integer',
					'default' => 0,
				],
				'quantity'      => [
					'type'    => 'integer',
					'default' => 1,
					'minimum' => 1,
				],
				'configuration' => [
					'required' => true,
					'type'     => [ 'string', 'array' ],
				],
				'fields'        => [
					'type'    => 'object',
					'default' => [],
				],
				'image'         => [
					'type'    => 'string',
					'default' => '',
				],
				'lang'          => [
					'type'    => 'string',
					'default' => '',
				],
				'token'         => [
					'type'    => 'string',
					'default' => '',
				],
				'honeypot'      => [
					'type'    => 'string',
					'default' => '',
				],
			],
		] );
	}

	/**
	 * The form for a product
	 *
	 * @param \WP_REST_Request $request
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function get_schema( $request ) {
		$quotes = mkl_pc( 'quotes' );
		if ( ! $quotes->is_enabled() ) {
			return new \WP_Error( 'mkl_pc_quote_disabled', __( 'Quote requests are not available.', 'product-configurator-for-woocommerce' ), [ 'status' => 403 ] );
		}
		$product_id = (int) $request->get_param( 'product_id' );
		$parent_id  = $product_id;
		if ( function_exists( 'wc_get_product' ) && ( $product = wc_get_product( $product_id ) ) && $product->is_type( 'variation' ) ) {
			$parent_id = $product->get_parent_id();
		}
		if ( ! mkl_pc_is_configurable( $parent_id ) || ( 'publish' !== get_post_status( $parent_id ) && ! current_user_can( 'edit_post', $parent_id ) ) ) {
			return new \WP_Error( 'mkl_pc_quote_invalid_product', __( 'This product cannot be quoted.', 'product-configurator-for-woocommerce' ), [ 'status' => 404 ] );
		}

		$context = [
			'product_id'      => $parent_id,
			'configurator_id' => $parent_id,
		];
		$schema = [
			'product_id'    => $parent_id,
			'fields'        => $quotes->fields->get_public_schema( $context ),
			'capture_image' => '3d' === mkl_pc_get_configurator_type( $parent_id ) && 'none' !== $quotes->get_image_mode(),
			'submit_url'    => esc_url_raw( rest_url( self::NAMESPACE . '/quote-requests' ) ),
			'token'         => [
				'url'     => esc_url_raw( rest_url( self::NAMESPACE . '/frontend-action-token' ) ),
				'purpose' => Quote_Requests::TOKEN_PURPOSE,
			],
		];

		/**
		 * Filter the quote request schema sent to the browser and to headless clients
		 *
		 * @param array $schema
		 * @param int   $product_id
		 */
		return rest_ensure_response( apply_filters( 'mkl_pc/quote_request/schema', $schema, $parent_id ) );
	}

	/**
	 * Send a request
	 *
	 * @param \WP_REST_Request $request
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function create( $request ) {
		$security = mkl_pc( 'frontend_security' );
		$rate = $security->enforce_rate_limit( Quote_Requests::TOKEN_PURPOSE );
		if ( is_wp_error( $rate ) ) return $rate;

		$success_message = __( 'Your request was sent. We will get back to you shortly.', 'product-configurator-for-woocommerce' );

		// Bots fill every field they find. Look like it worked, and send nothing.
		if ( '' !== trim( (string) $request->get_param( 'honeypot' ) ) ) {
			return new \WP_REST_Response( [ 'message' => $success_message ], 201 );
		}

		$fields = $request->get_param( 'fields' );
		$quote = mkl_pc( 'quotes' )->service->prepare( [
			'product_id'    => $request->get_param( 'product_id' ),
			'variation_id'  => $request->get_param( 'variation_id' ),
			'quantity'      => $request->get_param( 'quantity' ),
			'configuration' => $request->get_param( 'configuration' ),
			'fields'        => is_array( $fields ) ? $fields : [],
			'image'         => $request->get_param( 'image' ),
			'lang'          => $request->get_param( 'lang' ),
		] );
		if ( is_wp_error( $quote ) ) return $quote;

		// Checked once the data is valid, so a customer fixing a field does not need a new token.
		$token = $security->consume_action_token( (string) $request->get_param( 'token' ), Quote_Requests::TOKEN_PURPOSE, [ 'product_id' => $quote->product_id ] );
		if ( is_wp_error( $token ) ) return $token;

		$quote = mkl_pc( 'quotes' )->service->submit( $quote );
		if ( is_wp_error( $quote ) ) return $quote;

		$response = array_merge( $quote->to_array(), [ 'message' => $success_message ] );

		/**
		 * Filter the response to a sent quote request (e.g. to add a redirect URL)
		 *
		 * @param array         $response
		 * @param Quote_Request $quote
		 */
		return new \WP_REST_Response( apply_filters( 'mkl_pc/quote_request/response', $response, $quote ), 201 );
	}
}
