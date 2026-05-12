<?php
namespace MKL\PC;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Short-lived one-time tokens for public frontend actions.
 */
class Frontend_Action_Token {

	/**
	 * @return int TTL in seconds.
	 */
	public function get_ttl() {
		$ttl = (int) apply_filters( 'mkl_pc_frontend_action_token_ttl', 10 * MINUTE_IN_SECONDS );
		return max( 60, min( $ttl, HOUR_IN_SECONDS ) );
	}

	/**
	 * Allowed purposes for minting (extend via filter).
	 *
	 * @return string[]
	 */
	public function get_allowed_purposes() {
		$purposes = [ 'syd_share_send' ];
		/**
		 * Filters allowed token purposes (mint + consume).
		 *
		 * @param string[] $purposes List of purpose slugs.
		 */
		return apply_filters( 'mkl_pc_frontend_action_token_purposes', $purposes );
	}

	/**
	 * @param string               $purpose Purpose slug.
	 * @param array<string, mixed> $meta    Optional: product_id (int), user_id (int).
	 * @return string|\WP_Error Raw token string on success.
	 */
	public function issue( $purpose, $meta = [] ) {
		$purpose = sanitize_key( $purpose );
		if ( ! $purpose || ! in_array( $purpose, $this->get_allowed_purposes(), true ) ) {
			return new \WP_Error( 'mkl_pc_token_bad_purpose', __( 'Invalid action.', 'product-configurator-for-woocommerce' ), [ 'status' => 400 ] );
		}
		// Alphanumeric only so the token survives typical request sanitizers (e.g. sanitize_text_field strips several symbols).
		$token = wp_generate_password( 56, false, false );
		$hash  = hash( 'sha256', $token );
		$data  = [
			'purpose'   => $purpose,
			'issued_at' => time(),
		];
		if ( isset( $meta['product_id'] ) ) {
			$data['product_id'] = (int) $meta['product_id'];
		}
		if ( is_user_logged_in() ) {
			$data['user_id'] = get_current_user_id();
		}
		set_transient( 'mkl_pc_fat_' . $hash, $data, $this->get_ttl() );
		return $token;
	}

	/**
	 * Validate and delete token (one-time).
	 *
	 * @param string               $token   Raw token from client.
	 * @param string               $purpose Expected purpose.
	 * @param array<string, mixed> $context Optional: product_id to match stored value.
	 * @return true|\WP_Error
	 */
	public function consume( $token, $purpose, $context = [] ) {
		$purpose = sanitize_key( $purpose );
		if ( ! is_string( $token ) || '' === $token || ! $purpose ) {
			return new \WP_Error( 'mkl_pc_token_missing', __( 'This session has expired. Please try again.', 'product-configurator-for-woocommerce' ), [ 'status' => 403 ] );
		}
		if ( ! in_array( $purpose, $this->get_allowed_purposes(), true ) ) {
			return new \WP_Error( 'mkl_pc_token_bad_purpose', __( 'Invalid action.', 'product-configurator-for-woocommerce' ), [ 'status' => 400 ] );
		}
		$hash = hash( 'sha256', $token );
		$key  = 'mkl_pc_fat_' . $hash;
		$data = get_transient( $key );
		if ( ! is_array( $data ) || empty( $data['purpose'] ) || $data['purpose'] !== $purpose ) {
			return new \WP_Error( 'mkl_pc_token_invalid', __( 'This session has expired. Please try again.', 'product-configurator-for-woocommerce' ), [ 'status' => 403 ] );
		}
		if ( ! empty( $data['product_id'] ) && isset( $context['product_id'] ) ) {
			if ( (int) $data['product_id'] !== (int) $context['product_id'] ) {
				return new \WP_Error( 'mkl_pc_token_mismatch', __( 'This session has expired. Please try again.', 'product-configurator-for-woocommerce' ), [ 'status' => 403 ] );
			}
		}
		if ( ! empty( $data['user_id'] ) && is_user_logged_in() && (int) $data['user_id'] !== (int) get_current_user_id() ) {
			return new \WP_Error( 'mkl_pc_token_mismatch', __( 'This session has expired. Please try again.', 'product-configurator-for-woocommerce' ), [ 'status' => 403 ] );
		}
		delete_transient( $key );

		return true;
	}
}
