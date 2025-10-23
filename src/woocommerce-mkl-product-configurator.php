<?php

/**
* Plugin Name: Product Configurator for WooCommerce
* Plugin URI: http://wc-product-configurator.com
* Description: Allow customers to configure and customize their products using a live preview powered by a system of layers
* Author: Marc Lacroix
* Author URI: http://mklacroix.com
* Version: 1.5.6
* Requires PHP: 7.4
* WC requires at least: 8
* WC tested up to: 10
*
* Text Domain: product-configurator-for-woocommerce
* Domain Path: /languages/
*
* Copyright: © 2015 mklacroix (email : marcus_lacroix@yahoo.fr)
* License: GNU General Public License v3.0
* License URI: http://www.gnu.org/licenses/gpl-3.0.html
*/

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly
}

define( 'MKL_PC_VERSION', '1.5.6' );
define( 'MKL_PC_PREFIX', '_mkl_pc_' );
define( 'MKL_PC_EXTENDS', 'woocommerce' ); 
define( 'MKL_PC_PLUGIN_PATH', plugin_dir_path( __FILE__ ) );
define( 'MKL_PC_INCLUDE_PATH', plugin_dir_path( __FILE__ ) . 'inc/' );
define( 'MKL_PC_ASSETS_PATH', plugin_dir_path( __FILE__ ) . 'assets/' );
define( 'MKL_PC_ASSETS_URL', plugin_dir_url( __FILE__ ) . 'assets/' );
define( 'MKL_PC_PLUGIN_BASE_NAME', plugin_basename( __FILE__ ) );

require_once MKL_PC_INCLUDE_PATH . 'plugin.php';

add_action( 'init', 'mkl_pc_load_plugin_textdomain', 30 );
add_action( 'plugins_loaded', 'mkl_pc_init', 90 );
add_action( 'plugins_loaded', 'mkl_pc_maybe_deactivate_variable_addon', 5 );

/**
 * Initialize the plugin and check if the requirements are met (PHP version and WooCommerce install)
 *
 * @return void
 */
function mkl_pc_init() {
	/**
	 * Check Plugin requirements (Woocommerce, Woocommerce >= 3 , PHP >= 5.4)
	 */
	if ( function_exists( 'WC' ) ) {

		if ( ! version_compare( PHP_VERSION, '5.4', '>=' ) ) {
			add_action( 'admin_notices', 'mkl_pc_fail_php_version' );
		} else {
			mkl_pc()->init();
		}

	} else {
		// If woocommerce is not active, show a notice
		add_action( 'admin_notices', 'mkl_pc_fail_loading_woocommerce' );
	}
}

function mkl_pc_fail_php_version() {
	$message = esc_html__( 'The plugin Product Configurator for WooCommerce requires a PHP version of 5.4+.', 'product-configurator-for-woocommerce' );
	$html_message = sprintf( '<div class="error">%s</div>', wpautop( $message ) );
	echo wp_kses_post( $html_message );
}

function mkl_pc_fail_loading_woocommerce() {
	?>
	<div class="notice notice-warning is-dismissible">
		<p><?php _e( 'WooCommerce has to be active for WooCommerce Product configurator to work.', 'product-configurator-for-woocommerce' ) ?> </p>
	</div>
	<?php
}

function mkl_pc_fail_woocommerce_version() {
	?>
	<div class="notice notice-warning is-dismissible">
		<p><?php _e( 'Your WooCommerce version is too old for WooCommerce Product Configurator to work.', 'product-configurator-for-woocommerce' ); ?><br> <?php _e( 'WooCommerce Version 3+ required.', 'product-configurator-for-woocommerce' ); ?> </p>
	</div>
	<?php
}

function mkl_pc_load_plugin_textdomain() {
	load_textdomain( 'product-configurator-for-woocommerce', WP_LANG_DIR . '/product-configurator-for-woocommerce/product-configurator-for-woocommerce' . '-' . get_locale() . '.mo' );
	load_plugin_textdomain( 'product-configurator-for-woocommerce', false, dirname( plugin_basename( __FILE__ ) ) . '/languages/' );
}

function mkl_pc( $what = false ) {
	$plugin = MKL\PC\Plugin::instance();
	if ( ! $what ) return $plugin;
	if ( property_exists( $plugin, $what ) ) return $plugin->$what;
	return false;
}

add_action( 'before_woocommerce_init', function() {
	if ( class_exists( \Automattic\WooCommerce\Utilities\FeaturesUtil::class ) ) {
		\Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility( 'custom_order_tables', __FILE__, true );
		\Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility( 'product_block_editor', __FILE__, false );
	}
} );


add_filter( 'plugin_row_meta', 'mkl_pc_addon_row_meta_note', 10, 2 );
function mkl_pc_addon_row_meta_note( $links, $plugin_file ) {
	if ( $plugin_file === 'woocommerce-mkl-pc-for-variable-products/woocommerce-mkl-pc-for-variable-products.php' ) {
		$links[] = '<span style="color: #d63638;"><strong>This plugin is no longer needed and can be deleted.</strong></span>';
	}
	return $links;
}

add_action( 'after_plugin_row_woocommerce-mkl-pc-for-variable-products/woocommerce-mkl-pc-for-variable-products.php', 'mkl_pc_addon_plugin_row_notice' );
function mkl_pc_addon_plugin_row_notice() {
	// // Only show on the plugins admin screen
	// if ( ! is_admin() || ! function_exists( 'get_current_screen' ) ) {
	// 	return;
	// }

	// $screen = get_current_screen();
	// if ( ! $screen || $screen->id !== 'plugins' ) {
	// 	return;
	// }

	echo '<tr class="plugin-update-tr" style="transform: translateY(-1px);"><td colspan="4" class="plugin-update colspanchange">
		<div class="update-message notice-warning notice-alt" style="margin: 8px; padding: 8px; border-radius: 6px;">
			<p><strong>Product Configurator for WooCommerce addon - Variable Products</strong> has been replaced by functionality in the main plugin and can be safely deleted.</p>
		</div></td></tr>';
}

/**
 * Maybe Deactivate variable add-on
 *
 * @return void
 */
function mkl_pc_maybe_deactivate_variable_addon() {


	if ( ! defined( 'MKL_PC_VARIABLE_PRODUCTS_PATH' ) ) return;
	$addon_plugin_file = 'woocommerce-mkl-pc-for-variable-products/woocommerce-mkl-pc-for-variable-products.php';

	// Check if it's active
	if ( is_plugin_active( $addon_plugin_file ) ) {
		deactivate_plugins( $addon_plugin_file );

		// Optional: show admin notice
		add_action( 'admin_notices', function() use ( $addon_plugin_file ) {
			echo '<div class="notice notice-warning"><p>The Variable Product add-on has been deactivated because it is now included in the main plugin.</p></div>';
		} );
	}
}