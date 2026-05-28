<?php 

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly
}

/**
 * Checks if a product is configurable
 *
 * @param integer $product_id
 * @return boolean
 */
function mkl_pc_is_configurable( $product_id = NULL ) {
	return MKL\PC\Utils::is_configurable( $product_id );
}


if( ! function_exists( 'request_is_frontend_ajax' ) ) {

	function request_is_frontend_ajax() {
		$script_filename = isset($_SERVER['SCRIPT_FILENAME']) ? wp_unslash( $_SERVER['SCRIPT_FILENAME'] ) : '';
		// Try to figure out if frontend AJAX request... If we are DOING_AJAX; let's look closer
		if ( ( defined( 'DOING_AJAX' ) && DOING_AJAX ) ) {
			$ref = '';
			if ( ! empty( $_REQUEST['_wp_http_referer'] ) ) {
				$ref = esc_url_raw( wp_unslash( $_REQUEST['_wp_http_referer'] ) );
			} elseif ( ! empty( $_SERVER['HTTP_REFERER'] ) ) {
				$ref = esc_url_raw( wp_unslash( $_SERVER['HTTP_REFERER'] ) );
			}

			// Include specific POST variables which indicate the request being from the admin, in case the next check fails
			$check_variables = [ '_mkl_pc__is_configurable', 'variation_menu_order' ];
			foreach( $check_variables as $check ) {
				if ( in_array( $check, array_keys( $_POST ) ) ) {
					return false;
				}
			}

			//If referer does not contain admin URL and we are using the admin-ajax.php endpoint, this is likely a frontend AJAX request
			if ( ( ( strpos( $ref, admin_url() ) === false ) && ( basename( $script_filename ) === 'admin-ajax.php' ) ) ) {
				return true;
			}
		}

		//If no checks triggered, we end up here - not an AJAX request.
		return false;
	}
}

/**
 * Allow public read access to preset configurations when using the base Configuration class.
 *
 * @param string              $visibility  public|private
 * @param MKL\PC\Configuration $configuration Configuration instance.
 * @return string
 */
function mkl_pc_configuration_preset_visibility( $visibility, $configuration ) {
	if ( ! empty( $configuration->ID ) && 'preset' === get_post_status( $configuration->ID ) ) {
		return 'public';
	}
	return $visibility;
}
add_filter( 'mkl_pc_configuration_visibility', 'mkl_pc_configuration_preset_visibility', 10, 2 );

if ( ! function_exists( 'mkl_pc_get_configuration_price' ) ) {
	/**
	 * Get the configured price for a saved configuration (preset, save-your-own, etc.).
	 *
	 * @param int   $config_id Configuration post ID (mkl_pc_configuration).
	 * @param array $args {
	 *     Optional arguments passed to MKL\PC\Configuration::get_configured_price().
	 *
	 *     @type int   $variation_id Variation ID.
	 *     @type float $quantity     Line quantity. Default 1.
	 * }
	 * @return array|\WP_Error {
	 *     @type float  $base  Product base price before configuration extras.
	 *     @type float  $extra Sum of configuration extra prices.
	 *     @type float  $total Base plus extras.
	 *     @type string $currency  Optional. Current currency code when Extra Price is active.
	 *     @type string $formatted Optional. Formatted total when Extra Price is active.
	 * }
	 */
	function mkl_pc_get_configuration_price( $config_id, $args = array() ) {
		$config_id = absint( $config_id );
		if ( ! $config_id ) {
			return new WP_Error(
				'invalid_configuration',
				__( 'Invalid configuration ID.', 'product-configurator-for-woocommerce' )
			);
		}

		$post = get_post( $config_id );
		if ( ! $post || 'mkl_pc_configuration' !== $post->post_type ) {
			return new WP_Error(
				'invalid_configuration',
				__( 'Configuration not found.', 'product-configurator-for-woocommerce' )
			);
		}

		$config = new MKL\PC\Configuration( $config_id );
		if ( ! $config->get_the_post() ) {
			return new WP_Error(
				'invalid_configuration',
				__( 'Configuration not found.', 'product-configurator-for-woocommerce' )
			);
		}

		return $config->get_configured_price( $args );
	}
}
