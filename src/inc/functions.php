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

/**
 * Checks if a product is configurable
 *
 * @param integer $product_id
 * @return boolean
 */
function mkl_pc_get_configurator_type( $product_id = NULL ) {
	// MKL_PC_PREFIX.'_configurator_type
	if ( NULL == $product_id ) {

		// if $product_id wasn't given, find the current one
		$product_id = get_the_id();

		if ( NULL == $product_id || false == $product_id ) return false;
	} 

	if ( class_exists( '\\MKL\\PC\\Global_Configurators\\Schema' ) && \MKL\PC\Global_Configurators\Schema::is_global_configurator_id( $product_id ) ) {
		$type = get_post_meta( $product_id, MKL_PC_PREFIX . '_configurator_type', true );
		return $type ? $type : 'configurator';
	}

	// if $product_id doesn't match a product, exit
	if ( ! MKL\PC\Utils::is_product( $product_id )  ) return false;

	$fetched_product = wc_get_product( $product_id );
	$type = $fetched_product->get_meta( MKL_PC_PREFIX.'_configurator_type' );
	if ( $type ) {
		return $type;
	}

	if ( class_exists( '\\MKL\\PC\\Global_Configurators\\Owner_Resolver' ) ) {
		$global_id = \MKL\PC\Global_Configurators\Owner_Resolver::get_global_id( (int) $product_id );
		if ( $global_id > 0 ) {
			$type = get_post_meta( $global_id, MKL_PC_PREFIX . '_configurator_type', true );
			if ( $type ) {
				return $type;
			}
		}
	}

	return 'configurator';
}

/**
 * Allowed Three.js material property names for actions_3d material_property.
 *
 * Scalar/boolean props only — colors and textures use dedicated action types.
 *
 * @return string[]
 */
function mkl_pc_get_allowed_3d_material_properties() {
	$properties = array(
		'metalness',
		'roughness',
		'opacity',
		'transparent',
		'emissiveIntensity',
		'envMapIntensity',
		'aoMapIntensity',
		'lightMapIntensity',
		'bumpScale',
		'displacementScale',
		'displacementBias',
		'clearcoat',
		'clearcoatRoughness',
		'transmission',
		'thickness',
		'ior',
		'sheen',
		'sheenRoughness',
		'reflectivity',
		'iridescence',
		'iridescenceIOR',
		'attenuationDistance',
		'specularIntensity',
		'wireframe',
		'flatShading',
		'depthTest',
		'depthWrite',
		'fog',
		'toneMapped',
		'vertexColors',
	);

	/**
	 * Filter the allowlist of material property names usable in actions_3d.
	 *
	 * @param string[] $properties
	 */
	return apply_filters( 'mkl_pc_allowed_3d_material_properties', $properties );
}

/**
 * Sanitize a material_property_name against the allowlist.
 *
 * @param mixed $name
 * @return string Empty string when not allowed.
 */
function mkl_pc_sanitize_3d_material_property_name( $name ) {
	$name = is_string( $name ) ? trim( $name ) : '';
	if ( '' === $name ) {
		return '';
	}
	$allowed = mkl_pc_get_allowed_3d_material_properties();
	return in_array( $name, $allowed, true ) ? $name : '';
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
 * Parent slug for Product Configurator admin pages.
 *
 * Add-ons should attach custom post types (`show_in_menu`) and submenu pages to this slug.
 *
 * @return string
 */
function mkl_pc_get_admin_menu_slug() {
	/**
	 * Filter the parent admin menu slug.
	 *
	 * @param string $slug
	 */
	return apply_filters( 'mkl_pc_admin_menu_slug', 'mkl_pc' );
}

/**
 * Capability required to see the Product Configurator parent menu.
 *
 * @return string
 */
function mkl_pc_get_admin_menu_capability() {
	$capability = function_exists( 'WC' ) ? 'manage_woocommerce' : 'manage_options';

	/**
	 * Filter the parent admin menu capability.
	 *
	 * @param string $capability
	 */
	return apply_filters( 'mkl_pc_admin_menu_capability', $capability );
}

/**
 * Admin URL for the configurator settings page.
 *
 * @param array $query_args Extra query args (e.g. tab).
 * @return string
 */
function mkl_pc_get_settings_page_url( $query_args = array() ) {
	$query_args = array_merge(
		array(
			'page' => 'mkl_pc_settings',
		),
		$query_args
	);
	return add_query_arg( $query_args, admin_url( 'admin.php' ) );
}

/**
 * Whether the current admin request is the configurator settings page.
 *
 * @return bool
 */
function mkl_pc_is_settings_page() {
	if ( ! is_admin() ) {
		return false;
	}
	$page = isset( $_GET['page'] ) ? sanitize_key( wp_unslash( $_GET['page'] ) ) : '';
	return 'mkl_pc_settings' === $page;
}

/**
 * Include an SVG icon
 *
 * @param string $icon - The icon to include. e.g. 'home', '3d/object_data'...
 * @return string
 */
function mkl_pc_include_svg_icon( $icon ) {
	$path = trailingslashit( MKL_PC_ASSETS_PATH ) . '/icons/' . $icon . '.svg';
	if ( file_exists( $path ) ) {
		return file_get_contents( $path );
	}
	return '';
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
