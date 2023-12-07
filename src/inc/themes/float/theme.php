<?php

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly
}

function mkl_pc_float_theme_scripts() {
	wp_enqueue_script( 'jquery-ui-accordion' );
	wp_enqueue_script( 'mkl/pc/themes/float', plugin_dir_url( __FILE__ ) . 'float.js', [ 'wp-hooks', 'jquery' ], filemtime( plugin_dir_path( __FILE__ ) . 'float.js' ), true );
}
add_action( 'mkl_pc_scripts_product_page_after', 'mkl_pc_float_theme_scripts', 20 );

function mkl_pc_float_theme_choice_wrapper_open() {
	echo '<span class="choice-text">';
}
add_action( 'tmpl-pc-configurator-choice-item', 'mkl_pc_float_theme_choice_wrapper_open', 6 );

function mkl_pc_float_theme_choice_wrapper_close() {
	echo '</span>';
}
add_action( 'tmpl-pc-configurator-choice-item', 'mkl_pc_float_theme_choice_wrapper_close', 160 );

function mkl_pc_float_theme_remove_title() {
	remove_action( 'mkl_pc_frontend_configurator_footer_section_left_inner', 'mkl_pc_frontend_configurator_footer_section_left_inner__product_name', 30 );
}
add_action( 'mkl_pc_frontend_templates_before', 'mkl_pc_float_theme_remove_title', 20 );

/**
 * Wrap product and extra price elements
 */
function mkl_pc_float_price_wrapper_before() {
	echo '<div class="pc-total-price--container">';
}
add_action( 'mkl_pc_frontend_configurator_footer_form', 'mkl_pc_float_price_wrapper_before', 8 );

function mkl_pc_float_price_wrapper_after() {
	echo '</div>';
}
add_action( 'mkl_pc_frontend_configurator_footer_form', 'mkl_pc_float_price_wrapper_after', 16 );

/**
 * Remove unused colors from the customizer
 *
 * @param array $colors
 * @return array
 */
function mkl_pc_float_theme_filter_colors( $colors ) {
	$remove = [ 'active_layer_button_bg_color', 'active_layer_button_text_color', 'active_choice_button_bg_color', 'active_choice_button_text_color' ];
	foreach( $remove as  $r ) {
		if ( isset( $colors[ $r ] ) ) {
			unset( $colors[ $r ] );
		} 
	}
	return $colors;
}
add_filter( 'mkl_pc_theme_color_settings', 'mkl_pc_float_theme_filter_colors' );

require_once MKL_PC_INCLUDE_PATH . 'themes-common/customizer-no-form-modal.php';
new MKL_PC_Theme__no_form_modal( 'float' );

require_once MKL_PC_INCLUDE_PATH . 'themes-common/customizer-sticky-footer.php';
new MKL_PC_Theme__disable_sticky_footer( 'float' );