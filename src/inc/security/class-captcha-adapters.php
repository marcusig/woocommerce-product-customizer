<?php
namespace MKL\PC;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Captcha_Adapters {

	/**
	 * @return array{turnstile:bool,hcaptcha:bool}
	 */
	public static function detect_supported_providers() {
		return [
			'turnstile' => function_exists( 'cfturnstile_check' ) && function_exists( 'cfturnstile_field_show' ),
			'hcaptcha'  => class_exists( 'HCaptcha\\Helpers\\API' ) && function_exists( 'hcap_shortcode' ),
		];
	}

	/**
	 * @param string           $provider Provider slug.
	 * @param \WP_REST_Request $request  REST request.
	 * @return true|\WP_Error
	 */
	public static function verify( $provider, $request ) {
		$provider = sanitize_key( $provider );

		if ( 'turnstile' === $provider ) {
			$token = (string) $request->get_param( 'cf-turnstile-response' );
			$token = sanitize_text_field( $token );
			if ( '' === $token ) {
				return new \WP_Error( 'mkl_pc_captcha_missing', __( 'Captcha required.', 'product-configurator-for-woocommerce' ), [ 'status' => 403 ] );
			}
			if ( ! function_exists( 'cfturnstile_check' ) ) {
				return new \WP_Error( 'mkl_pc_captcha_unavailable', __( 'Captcha is unavailable.', 'product-configurator-for-woocommerce' ), [ 'status' => 503 ] );
			}
			$result = cfturnstile_check( $token );
			$ok     = is_array( $result ) && ! empty( $result['success'] );
			if ( ! $ok ) {
				return new \WP_Error( 'mkl_pc_captcha_invalid', __( 'Captcha verification failed.', 'product-configurator-for-woocommerce' ), [ 'status' => 403 ] );
			}
			return true;
		}

		if ( 'hcaptcha' === $provider ) {
			$token = (string) $request->get_param( 'h-captcha-response' );
			$token = sanitize_text_field( $token );
			if ( '' === $token ) {
				return new \WP_Error( 'mkl_pc_captcha_missing', __( 'Captcha required.', 'product-configurator-for-woocommerce' ), [ 'status' => 403 ] );
			}

			return self::verify_hcaptcha_token_siteverify( $token );
		}

		return new \WP_Error( 'mkl_pc_captcha_bad_provider', __( 'Invalid captcha provider.', 'product-configurator-for-woocommerce' ), [ 'status' => 400 ] );
	}

	/**
	 * Verify an hCaptcha response token via siteverify.
	 *
	 * Avoids \HCaptcha\Helpers\API::verify_request(), which runs honeypot / submit-time / disposable-email
	 * checks against $_POST — empty for JSON REST requests, yielding "Anti-spam check failed."
	 *
	 * @param string $token Response token from the client.
	 * @return true|\WP_Error
	 */
	private static function verify_hcaptcha_token_siteverify( $token ) {
		if ( ! function_exists( 'hcaptcha' ) ) {
			return new \WP_Error( 'mkl_pc_captcha_unavailable', __( 'Captcha is unavailable.', 'product-configurator-for-woocommerce' ), [ 'status' => 503 ] );
		}

		$settings = hcaptcha()->settings();
		if ( ! $settings ) {
			return new \WP_Error( 'mkl_pc_captcha_unavailable', __( 'Captcha is unavailable.', 'product-configurator-for-woocommerce' ), [ 'status' => 503 ] );
		}

		$secret = $settings->get_secret_key();
		if ( ! $secret ) {
			return new \WP_Error( 'mkl_pc_captcha_unavailable', __( 'Captcha is unavailable.', 'product-configurator-for-woocommerce' ), [ 'status' => 503 ] );
		}

		$params = [
			'secret'   => $secret,
			'response' => $token,
		];

		$ip = function_exists( 'hcap_get_user_ip' ) ? hcap_get_user_ip() : false;
		if ( ! empty( $ip ) ) {
			$params['remoteip'] = $ip;
		}

		$raw_response = wp_remote_post(
			hcaptcha()->get_verify_url(),
			[
				'timeout' => 10,
				'body'    => $params,
			]
		);

		if ( is_wp_error( $raw_response ) ) {
			return new \WP_Error(
				'mkl_pc_captcha_invalid',
				implode( ' ', $raw_response->get_error_messages() ),
				[ 'status' => 502 ]
			);
		}

		$raw_body = wp_remote_retrieve_body( $raw_response );
		if ( '' === $raw_body ) {
			return new \WP_Error( 'mkl_pc_captcha_invalid', __( 'Captcha verification failed.', 'product-configurator-for-woocommerce' ), [ 'status' => 403 ] );
		}

		$body = json_decode( $raw_body, true );
		if ( ! is_array( $body ) ) {
			return new \WP_Error( 'mkl_pc_captcha_invalid', __( 'Captcha verification failed.', 'product-configurator-for-woocommerce' ), [ 'status' => 403 ] );
		}

		if ( isset( $body['success'] ) && true === (bool) $body['success'] ) {
			return true;
		}

		$error_codes = isset( $body['error-codes'] ) ? (array) $body['error-codes'] : [];
		$message     = function_exists( 'hcap_get_error_message' ) ? hcap_get_error_message( $error_codes ) : '';
		if ( '' === $message ) {
			$message = __( 'Captcha verification failed.', 'product-configurator-for-woocommerce' );
		}

		return new \WP_Error( 'mkl_pc_captcha_invalid', $message, [ 'status' => 403 ] );
	}
}

