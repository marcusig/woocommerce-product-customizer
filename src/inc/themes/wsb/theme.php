<?php
function mkl_pc_wsb_theme_scripts() {
	wp_enqueue_script( 'mkl/pc/themes/wsb', plugin_dir_url( __FILE__ ) . 'wsb.js', [ 'wp-hooks', 'jquery' ], filemtime( plugin_dir_path( __FILE__ ) . 'wsb.js' ), true );
}
add_action( 'mkl_pc_scripts_product_page_after', 'mkl_pc_wsb_theme_scripts', 20 );

function mkl_pc_wsb_theme_choice_wrapper_open() {
	echo '<span class="choice-text">';
}
add_action( 'tmpl-pc-configurator-choice-item', 'mkl_pc_wsb_theme_choice_wrapper_open', 6 );

function mkl_pc_wsb_theme_choice_wrapper_close() {
	echo '</span>';
}
add_action( 'tmpl-pc-configurator-choice-item', 'mkl_pc_wsb_theme_choice_wrapper_close', 160 );

function mkl_pc_wsb_theme_remove_title() {
	remove_action( 'mkl_pc_frontend_configurator_footer_section_left_inner', 'mkl_pc_frontend_configurator_footer_section_left_inner__product_name', 30 );
}
add_action( 'mkl_pc_frontend_templates_before', 'mkl_pc_wsb_theme_remove_title', 20 );

function mkl_pc_wsb_theme_filter_colors( $colors ) {
	$remove = [ 'active_layer_button_bg_color', 'active_layer_button_text_color', 'active_choice_button_bg_color', 'active_choice_button_text_color' ];
	foreach( $remove as  $r ) {
		if ( isset( $colors[ $r ] ) ) unset( $colors[ $r ] );
	}
	$colors['toolbar_bg'] = [
		'default' => '#FFF',
		'label' => __( 'Sidebar background', 'product-configurator-for-woocommerce' )
	];

	return $colors;
}
add_filter( 'mkl_pc_theme_color_settings', 'mkl_pc_wsb_theme_filter_colors' );

/**
 * Wrap product and extra price elements
 */
function mkl_pc_wsb_price_wrapper_before() {
	echo '<div class="pc-total-price--container">';
}
add_action( 'mkl_pc_frontend_configurator_footer_form', 'mkl_pc_wsb_price_wrapper_before', 8 );

function mkl_pc_float_price_wrapper_after() {
	echo '</div>';
}
add_action( 'mkl_pc_frontend_configurator_footer_form', 'mkl_pc_float_price_wrapper_after', 16 );

require_once MKL_PC_INCLUDE_PATH . 'themes-common/customizer-sticky-footer.php';
new MKL_PC_Theme__disable_sticky_footer( 'wsb' );