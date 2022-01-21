<?php

if ( ! defined( 'ABSPATH' ) ) die();

function mkl_pc_clean_theme_scripts() {
	// wp_enqueue_style( 'mkl/pc/themes/h/simplebar', "https://cdn.jsdelivr.net/npm/simplebar@latest/dist/simplebar.css" );
	// wp_enqueue_script( 'mkl/pc/themes/h/simplebar', "https://cdn.jsdelivr.net/npm/simplebar@latest/dist/simplebar.min.js" );
	wp_enqueue_script( 'mkl/pc/themes/clean', plugin_dir_url( __FILE__ ) . 'clean.js', [ 'wp-hooks', 'jquery' ], MKL_PC_VERSION, true );
	// wp_localize_script( 'mkl/pc/themes/clean', 'pc_h_config', [
	// 	'color_mode' => get_option( MKL\PC\Customizer::PREFIX . 'color_mode', 'dark' )
	// ] );	
}

add_action( 'mkl_pc_scripts_product_page_before', 'mkl_pc_clean_theme_scripts', 20 );

function mkl_pc_clean_override_syd_icon() {
	return file_get_contents( trailingslashit( plugin_dir_path( __FILE__ ) ) . 'images/save.svg' );
}
add_filter( 'PC.syd.svg.icon', 'mkl_pc_clean_override_syd_icon' );

function mkl_pc_clean_add_reset_icon() {
	echo file_get_contents( trailingslashit( plugin_dir_path( __FILE__ ) ) . 'images/reset.svg' );
}
add_action( 'mkl_pc/reset_button/before_label', 'mkl_pc_clean_add_reset_icon' );

/**
 * Filter the customizer's colors
 *
 * @param array $colors
 * @return array
 */
function mkl_pc_clean_theme_filter_colors( $colors ) {
	$colors['primary_hover'] = [
		'default' => '#3c9871',
		'label' => __( 'Accent color hover', 'product-configurator-for-woocommerce' )
	];
	$colors['container-bg'] = [
		'default' => '#F2F2F2',
		'label' => __( 'Main background color', 'product-configurator-for-woocommerce' )
	];
	$colors['viewer-bg'] = [
		'default' => '#FFFFFF',
		'label' => __( 'Viewer background color', 'product-configurator-for-woocommerce' )
	];
	$colors['border-color'] = [
		'default' => '#e5e5e5',
		'label' => __( 'Viewer background color', 'product-configurator-for-woocommerce' )
	];
	if ( isset( $colors['active_choice_button_bg_color'] ) ) $colors['active_choice_button_bg_color']['default'] = '#FFFFFF';

	return $colors;
}
add_filter( 'mkl_pc_theme_color_settings', 'mkl_pc_clean_theme_filter_colors' );