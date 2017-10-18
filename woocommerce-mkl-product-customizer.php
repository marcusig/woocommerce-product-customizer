<?php
/**
* Plugin Name: WooCommerce Product customizer
* Plugin URI: http://mklacroix.com
* Description: WooCommerce Product customizer - Allow cutstomers to Customize their products, with 
* Author: Marc Lacroix
* Author URI: http://mklacroix.com
* Version: 1.0.0
*
* Text Domain: woocommerce-mkl-product-customizer
* Domain Path: /languages/
*
* Copyright: © 2015 mklacroix (email : marcus_lacroix@yahoo.fr)
* License: GNU General Public License v3.0
* License URI: http://www.gnu.org/licenses/gpl-3.0.html
*/

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly
}

define( 'MKL_PC_PREFIX', '_mkl_pc_' ); 
define( 'MKL_PC_DOMAIN', 'woocommerce-mkl-product-customizer' ); 
/**
 * Check if WooCommerce is active
 */
define( 'MKL_PC_EXTENDS', 'woocommerce' ); 
define( 'MKL_PC_PLUGIN_PATH', plugin_dir_path( __FILE__ ) );
define( 'MKL_PC_INCLUDE_PATH', plugin_dir_path( __FILE__ ) . 'inc/' );
define( 'MKL_PC_ASSETS_PATH', plugin_dir_path( __FILE__ ) . 'assets/' );
define( 'MKL_PC_ASSETS_URL', plugin_dir_url( __FILE__ ) . 'assets/' );

if ( in_array( 'woocommerce/woocommerce.php', apply_filters( 'active_plugins', get_option( 'active_plugins' ) ) ) ) {
	
	
	add_action( 'plugins_loaded', 'mkl_pc_load_plugin_textdomain' ); 


	// We're using Namespace, so check if php version is correct
	if ( ! version_compare( PHP_VERSION, '5.4', '>=' ) ) {
		add_action( 'admin_notices', 'mkl_pc_fail_php_version' );
		add_action( 'admin_init', 'mkl_pc_deactivate_plugin' );
	} else {
		require( MKL_PC_INCLUDE_PATH . 'plugin.php' );
	}

} else {

	// If woocommerce is not active, show a notice
	add_action( 'admin_notices', 'mkl_pc_fail_loading_woocommerce' );
	// And deactivate the plugin
	add_action( 'admin_init', 'mkl_pc_deactivate_plugin' );

}

function mkl_pc_fail_php_version() {
	$message = esc_html__( 'Woocommerce Product Customizer requires PHP version 5.4+, plugin is currently NOT ACTIVE.', MKL_PC_DOMAIN );
	$html_message = sprintf( '<div class="error">%s</div>', wpautop( $message ) );
	echo wp_kses_post( $html_message );
}

function mkl_pc_fail_loading_woocommerce() {
	?>
	<div class="notice notice-warning is-dismissible">
		<p><?php _e( 'Woocommerce has to be active for WooCommerce Product customizer to work.', MKL_PC_DOMAIN ) ?> </p>
	</div>
	<?php
}

function mkl_pc_load_plugin_textdomain() {
	load_textdomain( MKL_PC_DOMAIN, WP_LANG_DIR . '/wc_mkl_pc/wc_mkl_pc' . '-' . get_locale() . '.mo' ); 
	load_plugin_textdomain( MKL_PC_DOMAIN, false, dirname( plugin_basename( __FILE__ ) ) . '/languages/' ); 	
}

function mkl_pc_deactivate_plugin() {
	deactivate_plugins( plugin_basename( __FILE__ ) );	
}
