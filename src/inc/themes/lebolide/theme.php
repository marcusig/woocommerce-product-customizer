<?php
function mkl_pc_lebolide_theme_scripts() {
	wp_enqueue_script( 'mkl/pc/themes/lebolide', plugin_dir_url( __FILE__ ) . 'lebolide.js', [ 'wp-hooks', 'jquery', 'mkl_pc/js/vendor/tippy' ], filemtime( plugin_dir_path( __FILE__ ) . 'lebolide.js' ), true );
}
add_action( 'mkl_pc_scripts_product_page_after', 'mkl_pc_lebolide_theme_scripts', 20 );

// Wrap the choice Name and description with a span
function mkl_pc_lebolide_theme_choice_wrapper_open() {
	echo '<span class="choice-text">';
}
add_action( 'tmpl-pc-configurator-choice-item', 'mkl_pc_lebolide_theme_choice_wrapper_open', 6 );

function mkl_pc_lebolide_theme_choice_wrapper_close() {
	echo '</span>';
}
add_action( 'tmpl-pc-configurator-choice-item', 'mkl_pc_lebolide_theme_choice_wrapper_close', 160 );
// END: Wrap the choice Name and description with a span

// // Wrap the choice Name and description with a span
// function mkl_pc_lebolide_theme_layer_wrapper_open() {
// 	echo '<span class="layer-text">';
// }
// add_action( 'tmpl-mkl-pc-configurator-layer-item-button', 'mkl_pc_lebolide_theme_layer_wrapper_open', 6 );

// function mkl_pc_lebolide_theme_layer_wrapper_close() {
// 	echo '</span>';
// }
// add_action( 'tmpl-mkl-pc-configurator-layer-item-button', 'mkl_pc_lebolide_theme_layer_wrapper_close', 160 );
// // END: Wrap the choice Name and description with a span

// function mkl_pc_lebolide_theme_remove_title() {
// 	remove_action( 'mkl_pc_frontend_configurator_footer_section_left_inner', 'mkl_pc_frontend_configurator_footer_section_left_inner__product_name', 30 );
// }
// add_action( 'mkl_pc_frontend_templates_before', 'mkl_pc_lebolide_theme_remove_title', 20 );

/**
 * Move the Extra Price after the total
 *
 * @return void
 */
function mkl_pc_lebolide_theme_move_extra_price() {
	
	add_action( 'mkl_pc_frontend_configurator_footer_form', function() {
		echo '<div class="price-container">';
	}, 6 );
	
	$ep = mkl_pc()->get_extension( 'extra-price' );

	if ( $ep ) {
		remove_action( 'mkl_pc_frontend_configurator_footer_form', array( $ep, 'after_add_to_cart_button' ), 9 );
		add_action( 'mkl_pc_frontend_configurator_footer_form', array( $ep, 'after_add_to_cart_button' ), 17 );
		
		remove_action( 'mkl_pc_frontend_configurator_footer_form', array( $ep, 'after_add_to_cart_button' ), 9 );
		add_action( 'mkl_pc_frontend_configurator_footer_form', array( $ep, 'after_add_to_cart_button' ), 17 );

	}

	add_action( 'mkl_pc_frontend_configurator_footer_form', function() {
		echo '</div>';
	}, 18 );

	// $syd = mkl_pc()->get_extension( 'save-your-design' );
	// if ( $syd ) {
	// 	remove_action( 'mkl_pc_frontend_configurator_footer_section_right_before', array( $syd->product, 'add_configurator_button' ), 20 ); 
	// 	add_action( 'mkl_pc_frontend_configurator_footer_form', array( $syd->product, 'add_configurator_button' ), 120 ); 
	// }
}
add_action( 'mkl_pc_frontend_configurator_footer_section_left_before', 'mkl_pc_lebolide_theme_move_extra_price', 40 );

// Move thumbnail
add_action( 'tmpl-pc-configurator-choice-item', 'mkl_pc_lebolide_choice_thumbnail', 1 );

function mkl_pc_lebolide_choice_thumbnail( ) {
	remove_action( 'tmpl-pc-configurator-choice-item', 'mkl_pc_frontend_configurator_choice_thumbnail', 5 );
	add_action( 'tmpl-pc-configurator-choice-item', 'mkl_pc_frontend_configurator_choice_thumbnail', 2 );
}

function mkl_pc_lebolide_theme_filter_colors( $colors ) {
	$remove = [ 'active_layer_button_bg_color', 'active_layer_button_text_color', 'active_choice_button_bg_color', 'active_choice_button_text_color' ];

	foreach( $remove as  $r ) {
		if ( isset( $colors[ $r ] ) ) unset( $colors[ $r ] );
	}

	$colors['border'] = [
		'default' => '#d2d2d7',
		'label' => __( 'Choice border color', 'product-configurator-for-woocommerce' )
	];
	$colors['border_active'] = [
		'default' => '#454545',
		'label' => __( 'Active choice border color', 'product-configurator-for-woocommerce' )
	];
	$colors['main_background'] = [
		'default' => '#DFDFDF',
		'label' => __( 'Viewer background', 'product-configurator-for-woocommerce' )
	];
	$colors['form_background'] = [
		'default' => '#EFEFEF',
		'label' => __( 'Add to cart section background', 'product-configurator-for-woocommerce' )
	];

	return $colors;
}
add_filter( 'mkl_pc_theme_color_settings', 'mkl_pc_lebolide_theme_filter_colors' );

function mkl_pc_lebolide_syd_icon() {
	// Icon bookmark-simple from https://phosphoricons.com/
	return '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="#000000" viewBox="0 0 256 256"><path d="M184,32H72A16,16,0,0,0,56,48V224a8,8,0,0,0,12.24,6.78L128,193.43l59.77,37.35A8,8,0,0,0,200,224V48A16,16,0,0,0,184,32Zm0,177.57-51.77-32.35a8,8,0,0,0-8.48,0L72,209.57V48H184Z"></path></svg>';
}
add_filter( 'PC.syd.svg.icon', 'mkl_pc_lebolide_syd_icon' );

function mkl_pc_lebolide_add_reset_icon() {
	echo file_get_contents( trailingslashit( MKL_PC_INCLUDE_PATH ) . 'themes-common/icons/reset.svg' );
}
add_action( 'mkl_pc/reset_button/before_label', 'mkl_pc_lebolide_add_reset_icon' );

function mkl_pc_lebolide_save_pdf_icon() {
	echo file_get_contents( trailingslashit( MKL_PC_INCLUDE_PATH ) . 'themes-common/icons/download.svg' );
}
add_action( 'PC.syd.pdf_download.svg.icon', 'mkl_pc_lebolide_save_pdf_icon' );
