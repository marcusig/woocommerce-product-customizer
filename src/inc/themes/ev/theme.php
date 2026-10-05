<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Front-end script for the EV theme.
 */
function mkl_pc_ev_theme_scripts() {
	wp_enqueue_script(
		'mkl/pc/themes/ev',
		plugin_dir_url( __FILE__ ) . 'ev.js',
		array( 'wp-hooks', 'jquery', 'mkl_pc/js/vendor/popper', 'mkl_pc/js/product_configurator' ),
		filemtime( plugin_dir_path( __FILE__ ) . 'ev.js' ),
		true
	);
}
add_action( 'mkl_pc_scripts_product_page_after', 'mkl_pc_ev_theme_scripts', 20 );

/**
 * Group the price output so the order bar can lay it out.
 */
function mkl_pc_ev_price_wrapper_before() {
	echo '<div class="pc-total-price--container">';
}
add_action( 'mkl_pc_frontend_configurator_footer_form', 'mkl_pc_ev_price_wrapper_before', 8 );

/**
 * Close the price group.
 */
function mkl_pc_ev_price_wrapper_after() {
	echo '</div>';
}
add_action( 'mkl_pc_frontend_configurator_footer_form', 'mkl_pc_ev_price_wrapper_after', 16 );

/**
 * Tesla-like defaults for the customizer color controls.
 *
 * @param array $colors Color settings.
 * @return array
 */
function mkl_pc_ev_theme_filter_colors( $colors ) {
	$colors['primary'] = array(
		'default' => '#3e6ae1',
		'label'   => __( 'Accent color', 'product-configurator-for-woocommerce' ),
	);
	$colors['layers_button_text_color'] = array(
		'default' => '#171a20',
		'label'   => __( 'Layers text color', 'product-configurator-for-woocommerce' ),
	);
	$colors['choices_button_text_color'] = array(
		'default' => '#171a20',
		'label'   => __( 'Choices text color', 'product-configurator-for-woocommerce' ),
	);
	$colors['active_choice_button_bg_color'] = array(
		'default' => '#ffffff',
		'label'   => __( 'Active choice background color', 'product-configurator-for-woocommerce' ),
	);
	$colors['active_choice_button_text_color'] = array(
		'default' => '#171a20',
		'label'   => __( 'Active choice text color', 'product-configurator-for-woocommerce' ),
	);
	if ( isset( $colors['active_layer_button_bg_color'] ) ) {
		unset( $colors['active_layer_button_bg_color'] );
	}
	if ( isset( $colors['active_layer_button_text_color'] ) ) {
		unset( $colors['active_layer_button_text_color'] );
	}
	// Empty default keeps the translucent fallback in the stylesheet until a color is chosen.
	$colors['layer_background'] = array(
		'default' => '',
		'label'   => __( 'Layer background color', 'product-configurator-for-woocommerce' ),
	);
	return $colors;
}
add_filter( 'mkl_pc_theme_color_settings', 'mkl_pc_ev_theme_filter_colors' );
