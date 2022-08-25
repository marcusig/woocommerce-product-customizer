<?php
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

function mkl_pc_float_theme_add_mobile_form_button() {
	$span_classes = apply_filters( 'mkl_pc/show_add_to_cart_button/classes', '' );
	$label = mkl_pc( 'frontend' )->product->get_add_to_cart_label();
	echo '<button class="mkl-pc-show-form">' . mkl_pc( 'frontend' )->product->get_cart_icon() .'<span class="' . $span_classes . '">' . $label . '</span></button>';
}
add_action( 'mkl_pc_frontend_configurator_footer_form_before', 'mkl_pc_float_theme_add_mobile_form_button', 20 );

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
