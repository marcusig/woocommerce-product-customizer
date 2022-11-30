<?php
function mkl_pc_lapomme_theme_scripts() {
	wp_enqueue_script( 'mkl/pc/themes/lapomme', plugin_dir_url( __FILE__ ) . 'lapomme.js', [ 'wp-hooks', 'jquery', 'mkl_pc/js/vendor/tippy' ], filemtime( plugin_dir_path( __FILE__ ) . 'lapomme.js' ), true );
}
add_action( 'mkl_pc_scripts_product_page_after', 'mkl_pc_lapomme_theme_scripts', 20 );

// Wrap the choice Name and description with a span
function mkl_pc_lapomme_theme_choice_wrapper_open() {
	echo '<span class="choice-text">';
}
add_action( 'tmpl-pc-configurator-choice-item', 'mkl_pc_lapomme_theme_choice_wrapper_open', 6 );

function mkl_pc_lapomme_theme_choice_wrapper_close() {
	echo '</span>';
}
add_action( 'tmpl-pc-configurator-choice-item', 'mkl_pc_lapomme_theme_choice_wrapper_close', 160 );
// END: Wrap the choice Name and description with a span

// Wrap the choice Name and description with a span
function mkl_pc_lapomme_theme_layer_wrapper_open() {
	echo '<span class="layer-text">';
}
add_action( 'tmpl-mkl-pc-configurator-layer-item-button', 'mkl_pc_lapomme_theme_layer_wrapper_open', 6 );

function mkl_pc_lapomme_theme_layer_wrapper_close() {
	echo '</span>';
}
add_action( 'tmpl-mkl-pc-configurator-layer-item-button', 'mkl_pc_lapomme_theme_layer_wrapper_close', 160 );
// END: Wrap the choice Name and description with a span

function mkl_pc_lapomme_theme_remove_title() {
	remove_action( 'mkl_pc_frontend_configurator_footer_section_left_inner', 'mkl_pc_frontend_configurator_footer_section_left_inner__product_name', 30 );
}
add_action( 'mkl_pc_frontend_templates_before', 'mkl_pc_lapomme_theme_remove_title', 20 );

/**
 * Move the Extra Price after the total
 *
 * @return void
 */
function mkl_pc_lapomme_theme_move_extra_price() {
	$ep = mkl_pc()->get_extension( 'extra-price' );
	if ( $ep ) {
		
		add_action( 'mkl_pc_frontend_configurator_footer_form', function() {
			echo '<div class="price-container">';
		}, 6 );
		
		remove_action( 'mkl_pc_frontend_configurator_footer_form', array( $ep, 'after_add_to_cart_button' ), 9 );
		add_action( 'mkl_pc_frontend_configurator_footer_form', array( $ep, 'after_add_to_cart_button' ), 17 );
		
		remove_action( 'mkl_pc_frontend_configurator_footer_form', array( $ep, 'after_add_to_cart_button' ), 9 );
		add_action( 'mkl_pc_frontend_configurator_footer_form', array( $ep, 'after_add_to_cart_button' ), 17 );

		add_action( 'mkl_pc_frontend_configurator_footer_form', function() {
			echo '</div>';
		}, 18 );
	}

	$syd = mkl_pc()->get_extension( 'save-your-design' );
	if ( $syd ) {
		remove_action( 'mkl_pc_frontend_configurator_footer_section_right_before', array( $syd->product, 'add_configurator_button' ), 20 ); 
		add_action( 'mkl_pc_frontend_configurator_footer_form', array( $syd->product, 'add_configurator_button' ), 120 ); 
	}
}
add_action( 'mkl_pc_frontend_configurator_footer_section_left_before', 'mkl_pc_lapomme_theme_move_extra_price', 40 );

function mkl_pc_lapomme_theme_filter_colors( $colors ) {
	$remove = [ 'active_layer_button_bg_color', 'active_layer_button_text_color', 'active_choice_button_bg_color', 'active_choice_button_text_color' ];
	foreach( $remove as  $r ) {
		if ( isset( $colors[ $r ] ) ) unset( $colors[ $r ] );
	}
	// $colors['toolbar_bg'] = [
	// 	'default' => '#FFF',
	// 	'label' => __( 'Sidebar background', 'product-configurator-for-woocommerce' )
	// ];

	return $colors;
}
add_filter( 'mkl_pc_theme_color_settings', 'mkl_pc_lapomme_theme_filter_colors' );

function mkl_pc_lapomme_syd_icon() {
	return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" xml:space="preserve">
		<path d="m34.9 44.8-9.8-7c-.6-.4-1.5-.4-2.1 0l-9.8 7c-1.2.9-2.9 0-2.9-1.5V4.7c0-1 .8-1.8 1.8-1.8h23.8c1 0 1.8.8 1.8 1.8v38.6c0 1.5-1.6 2.3-2.8 1.5z"/>
	</svg>
	';
}
add_filter( 'PC.syd.svg.icon', 'mkl_pc_lapomme_syd_icon' );