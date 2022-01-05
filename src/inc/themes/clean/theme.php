<?php

if ( ! defined( 'ABSPATH' ) ) die();

function mkl_pc_clean_theme_scripts() {
	// wp_enqueue_style( 'mkl/pc/themes/h/simplebar', "https://cdn.jsdelivr.net/npm/simplebar@latest/dist/simplebar.css" );
	// wp_enqueue_script( 'mkl/pc/themes/h/simplebar', "https://cdn.jsdelivr.net/npm/simplebar@latest/dist/simplebar.min.js" );
	wp_enqueue_script( 'mkl/pc/themes/clean', plugin_dir_url( __FILE__ ) . 'clean.js', MKL_PC_VERSION, true );
	wp_localize_script( 'mkl/pc/themes/clean', 'pc_h_config', [
		'color_mode' => get_option( MKL\PC\Customizer::PREFIX . 'color_mode', 'dark' )
	] );	
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