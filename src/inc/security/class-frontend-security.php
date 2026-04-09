<?php
namespace MKL\PC;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Facade: rate limits + frontend action tokens + REST mint endpoint.
 */
class Frontend_Security {

	/** @var Rate_Limiter */
	private $rate_limiter;

	/** @var Frontend_Action_Token */
	private $action_token;

	public function __construct() {
		$this->rate_limiter = new Rate_Limiter();
		$this->action_token = new Frontend_Action_Token();
		add_action( 'rest_api_init', [ $this, 'register_rest_routes' ] );
	}

	public function register_rest_routes() {
		register_rest_route(
			'mkl_pc/v1',
			'/frontend-action-token',
			[
				'methods'             => \WP_REST_Server::CREATABLE,
				'callback'            => [ $this, 'rest_mint_token' ],
				'permission_callback' => '__return_true',
				'args'                => [
					'purpose'    => [
						'required'          => true,
						'type'              => 'string',
						'sanitize_callback' => 'sanitize_key',
					],
					'product_id' => [
						'required' => false,
						'type'     => 'integer',
					],
				],
			]
		);
	}

	/**
	 * @param \WP_REST_Request $request Request.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function rest_mint_token( $request ) {
		$limited = $this->rate_limiter->enforce( 'mkl_pc_token_mint' );
		if ( is_wp_error( $limited ) ) {
			return $limited;
		}
		$purpose   = $request->get_param( 'purpose' );
		$product_id = $request->get_param( 'product_id' );
		$meta      = [];
		if ( null !== $product_id && '' !== $product_id ) {
			$meta['product_id'] = (int) $product_id;
		}
		$token = $this->action_token->issue( $purpose, $meta );
		if ( is_wp_error( $token ) ) {
			return $token;
		}
		$ttl = $this->action_token->get_ttl();
		$response = new \WP_REST_Response(
			[
				'token'      => $token,
				'expires_in' => $ttl,
			],
			200
		);
		$response->header( 'Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0' );
		$response->header( 'Pragma', 'no-cache' );
		return $response;
	}

	/**
	 * @param string               $action Action key.
	 * @param array<string, mixed>|null $rule   Optional rule override.
	 * @return true|\WP_Error
	 */
	public function enforce_rate_limit( $action, $rule = null ) {
		return $this->rate_limiter->enforce( $action, $rule );
	}

	/**
	 * @param string               $token   Raw token.
	 * @param string               $purpose Purpose slug.
	 * @param array<string, mixed> $context Optional context (e.g. product_id).
	 * @return true|\WP_Error
	 */
	public function consume_action_token( $token, $purpose, $context = [] ) {
		return $this->action_token->consume( $token, $purpose, $context );
	}

	/**
	 * @return Rate_Limiter
	 */
	public function get_rate_limiter() {
		return $this->rate_limiter;
	}

	/**
	 * @return Frontend_Action_Token
	 */
	public function get_action_token() {
		return $this->action_token;
	}
}
