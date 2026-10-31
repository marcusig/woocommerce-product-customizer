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
			// With files the request is multipart, and these come as JSON in `request`. The service checks them.
			'args'                => [
				'request'       => [
					'type'    => 'string',
				],
				'product_id'    => [
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
		// The same check as sending: a product that cannot be quoted has no form.
		$ids = $quotes->service->resolve_product( (int) $request->get_param( 'product_id' ) );
		if ( is_wp_error( $ids ) ) return $ids;
		$parent_id = $ids['product_id'];

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
		if ( '' !== trim( (string) $this->get_request_params( $request )['honeypot'] ) ) {
			return new \WP_REST_Response( [ 'message' => $success_message ], 201 );
		}

		$params = $this->get_request_params( $request );
		$quote = mkl_pc( 'quotes' )->service->prepare( array_filter( [
			'product_id'    => $params['product_id'],
			'variation_id'  => $params['variation_id'],
			'quantity'      => $params['quantity'],
			'configuration' => $params['configuration'],
			'fields'        => is_array( $params['fields'] ) ? $params['fields'] : [],
			'image'         => $params['image'],
			'lang'          => $params['lang'],
			'files'         => $request->get_file_params(),
		], function( $value ) {
			return null !== $value;
		} ) );
		if ( is_wp_error( $quote ) ) return $quote;

		// Checked once the data is valid, so a customer fixing a field does not need a new token.
		$token = $security->consume_action_token( (string) $params['token'], Quote_Requests::TOKEN_PURPOSE, [ 'product_id' => $quote->product_id ] );
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

	/**
	 * The submitted values. With files, the request is multipart and its values come as JSON in `request`.
	 *
	 * @param \WP_REST_Request $request
	 * @return array
	 */
	private function get_request_params( $request ) {
		$keys = [ 'product_id', 'variation_id', 'quantity', 'configuration', 'fields', 'image', 'lang', 'token', 'honeypot' ];
		$json = $request->get_param( 'request' );
		$values = is_string( $json ) ? json_decode( $json, true ) : null;
		$params = [];
		foreach ( $keys as $key ) {
			$params[ $key ] = is_array( $values ) ? ( isset( $values[ $key ] ) ? $values[ $key ] : null ) : $request->get_param( $key );
		}
		return $params;
	}
}
