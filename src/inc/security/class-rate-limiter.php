<?php
namespace MKL\PC;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Fixed-window rate limiting using transients (object cache when available).
 */
class Rate_Limiter {

	/**
	 * @return string
	 */
	public function get_client_key() {
		$ip = $this->get_client_ip();
		$key = $ip;
		if ( is_user_logged_in() ) {
			$key .= '|u' . get_current_user_id();
		}
		/**
		 * Filters the client key used for rate limiting.
		 *
		 * @param string $key   Default key (IP and optional user id).
		 * @param string $ip    Resolved IP address.
		 */
		return apply_filters( 'mkl_pc_rate_limit_client_key', $key, $ip );
	}

	/**
	 * @return string
	 */
	private function get_client_ip() {
		if ( function_exists( 'WC' ) && WC()->geoip instanceof \WC_Geolocation ) {
			$ip = \WC_Geolocation::get_ip_address();
			if ( $ip ) {
				return $ip;
			}
		}
		if ( ! empty( $_SERVER['REMOTE_ADDR'] ) && is_string( $_SERVER['REMOTE_ADDR'] ) ) {
			return sanitize_text_field( wp_unslash( $_SERVER['REMOTE_ADDR'] ) );
		}
		return '0.0.0.0';
	}

	/**
	 * @param string               $action Action key (e.g. syd_share_send).
	 * @param array<string, mixed>|null $rule  Optional override: max (int), window (int seconds).
	 * @return array{max:int,window:int}
	 */
	public function get_rule( $action, $rule = null ) {
		if ( is_array( $rule ) && isset( $rule['max'], $rule['window'] ) ) {
			return [
				'max'    => (int) $rule['max'],
				'window' => (int) $rule['window'],
			];
		}
		$defaults = $this->default_rules();
		$default  = isset( $defaults[ $action ] ) ? $defaults[ $action ] : [ 'max' => 60, 'window' => HOUR_IN_SECONDS ];
		/**
		 * Filters the rate limit rule for an action.
		 *
		 * @param array{max:int,window:int} $default Default rule.
		 * @param string                    $action  Action key.
		 */
		$filtered = apply_filters( 'mkl_pc_rate_limit_rule', $default, $action );
		return [
			'max'    => isset( $filtered['max'] ) ? (int) $filtered['max'] : 60,
			'window' => isset( $filtered['window'] ) ? (int) $filtered['window'] : HOUR_IN_SECONDS,
		];
	}

	/**
	 * @return array<string, array{max:int,window:int}>
	 */
	private function default_rules() {
		return [
			'mkl_pc_token_mint' => [ 'max' => 30, 'window' => 10 * MINUTE_IN_SECONDS ],
			'syd_share_send'    => [ 'max' => 8, 'window' => HOUR_IN_SECONDS ],
			'syd_pdf'           => [ 'max' => 25, 'window' => HOUR_IN_SECONDS ],
		];
	}

	/**
	 * Increment counter; return WP_Error if over limit.
	 *
	 * @param string               $action Action key.
	 * @param array<string, mixed>|null $rule   Optional rule override.
	 * @return true|\WP_Error
	 */
	public function enforce( $action, $rule = null ) {
		$action = sanitize_key( $action );
		if ( ! $action ) {
			return new \WP_Error( 'mkl_pc_rate_limit_invalid', __( 'Invalid rate limit action.', 'product-configurator-for-woocommerce' ) );
		}
		$r      = $this->get_rule( $action, $rule );
		$window = max( 1, $r['window'] );
		$max    = max( 1, $r['max'] );
		$client = $this->get_client_key();
		$bucket = (int) floor( time() / $window );
		$tkey   = 'mkl_pc_rl_' . md5( $action . '|' . $client . '|' . (string) $bucket );
		$count  = (int) get_transient( $tkey );
		if ( $count >= $max ) {
			return new \WP_Error(
				'mkl_pc_rate_limited',
				__( 'Too many requests. Please try again later.', 'product-configurator-for-woocommerce' ),
				[ 'status' => 429 ]
			);
		}
		set_transient( $tkey, $count + 1, $window + 60 );
		return true;
	}
}
