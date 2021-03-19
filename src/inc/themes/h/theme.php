<?php
function mkl_pc_float_theme_scripts() {
	wp_enqueue_script( 'mkl/pc/themes/h', plugin_dir_url( __FILE__ ) . 'h-scripts.js', [ 'flexslider' ], MKL_PC_VERSION, true );
}

add_action( 'mkl_pc_scripts_product_page_before', 'mkl_pc_float_theme_scripts', 20 );

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
	echo '<button class="mkl-pc-show-form">' . mkl_pc( 'frontend' )->product->get_cart_icon() .'<span class="screen-reader-text">' . __( 'Add to cart', 'woocommerce' ) . '</span></button>';
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

function mkl_pc_float_theme_add_customizer_settings( $wp_customize, $mkl_pc_customizer ) {
	$wp_customize->add_setting(
		$mkl_pc_customizer::PREFIX . 'choice_width',
		array(
			'default'    => '',
			'type'       => 'option',
			'capability' => 'edit_theme_options',
		)
	);
		
	$wp_customize->add_control(
		$mkl_pc_customizer::PREFIX . 'choice_width',
		array(
			'label'    => __( 'Choice width', 'product-configurator-for-woocommerce' ),
			'section'  => 'mlk_pc',
			'settings' => $mkl_pc_customizer::PREFIX . 'choice_width',
			'type'     => 'text',
		)
	);
}
add_filter( 'mkl_pc_customizer_settings', 'mkl_pc_float_theme_add_customizer_settings', 20, 2 );