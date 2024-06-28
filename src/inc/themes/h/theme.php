<?php
function mkl_pc_float_theme_scripts() {
	wp_enqueue_style( 'mkl/pc/themes/h/simplebar', "https://cdn.jsdelivr.net/npm/simplebar@latest/dist/simplebar.css" );
	wp_enqueue_script( 'mkl/pc/themes/h/simplebar', "https://cdn.jsdelivr.net/npm/simplebar@latest/dist/simplebar.min.js" );
	wp_enqueue_script( 'mkl/pc/themes/h', plugin_dir_url( __FILE__ ) . 'h-scripts.js', [ 'flexslider' ], MKL_PC_VERSION, true );
	wp_localize_script( 'mkl/pc/themes/h', 'pc_h_config', [
		'color_mode' => get_option( MKL\PC\Customizer::PREFIX . 'color_mode', 'dark' ),
		'choice_width' => get_option( MKL\PC\Customizer::PREFIX . 'choice_width' ),
	] );	
}

add_action( 'mkl_pc_scripts_product_page_before', 'mkl_pc_float_theme_scripts', 20 );

/**
 * Add theme feature supports (color mode)
 *
 * @param array $features
 * @return array
 */
add_filter( 'mkl_pc/theme_supports', function( $features ) {
	$features['color_mode'] = true;
	return $features;
} );

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
	echo '<button class="mkl-pc-show-form">' . mkl_pc( 'frontend' )->product->get_cart_icon() .'<span class="screen-reader-text">' . apply_filters( 'mkl_pc/add_to_cart_button/default_label', __( 'Add to cart', 'woocommerce' ) ) . '</span></button>';
}
add_action( 'mkl_pc_frontend_configurator_footer_form_before', 'mkl_pc_float_theme_add_mobile_form_button', 20 );

/**
 * Remove unused colors from the customizer
 *
 * @param array $colors
 * @return array
 */
function mkl_pc_float_theme_filter_colors( $colors ) {
	$remove = [ 'active_layer_button_bg_color', 'active_layer_button_text_color' ];
	foreach( $remove as  $r ) {
		if ( isset( $colors[ $r ] ) ) {
			unset( $colors[ $r ] );
		} 
	}

	$cm = get_option( MKL\PC\Customizer::PREFIX . 'color_mode', 'dark' );

	if ( 'dark' == $cm ) {
		$colors['primary'] = array(
			'default' => 'rgb(0, 213, 209)',
			'label' => __( 'Primary color', 'product-configurator-for-woocommerce' )
		);
		$colors['primary_hover'] = array(
			'default' => '#00626d',
			'label' => __( 'Primary hover', 'product-configurator-for-woocommerce' )
		);
		$colors['layers_button_text_color'] = array(
			'default' => '#b0b5c0',
			'label' => __( 'Layers text color', 'product-configurator-for-woocommerce' )
		);
		$colors['layers_button_text_color_hover'] = array(
			'default' => '#f2f3f5',
			'label' => __( 'Layers text color - hover', 'product-configurator-for-woocommerce' )
		);
		$colors['choices_button_text_color'] = array(
			'default' => '#b0b5c0',
			'label' => __( 'Choices text color', 'product-configurator-for-woocommerce' )
		);
		$colors['layers_bg'] = array(
			'default' => '#2e2e32',
			'label' => __( 'Layers section background', 'product-configurator-for-woocommerce' )
		);
		$colors['layer_choices_bg'] = array(
			'default' => '#2e2e32',
			'label' => __( 'Choices section background', 'product-configurator-for-woocommerce' )
		);

		$colors['active_choice_button_bg_color'] = array(
			'default' => '#000',
			'label' => __( 'Active choice background color', 'product-configurator-for-woocommerce' )
		);
		$colors['active_choice_button_text_color'] = array(
			'default' => '#FFF',
			'label' => __( 'Active choice text color', 'product-configurator-for-woocommerce' )
		);

		$colors['add_to_cart_bg_color'] = array(
			'default' => '#FFF',
			'label' => __( 'Add to cart button background color', 'product-configurator-for-woocommerce' )
		);
		$colors['add_to_cart_border_color'] = array(
			'default' => '#FFF',
			'label' => __( 'Add to cart button border color', 'product-configurator-for-woocommerce' )
		);
		$colors['add_to_cart_text_color'] = array(
			'default' => '#000',
			'label' => __( 'Add to cart button text color', 'product-configurator-for-woocommerce' )
		);
		$colors['add_to_cart_bg_color_hover'] = array(
			'default' => '#00626d',
			'label' => __( 'Add to cart button background color - Hover', 'product-configurator-for-woocommerce' )
		);
		$colors['add_to_cart_border_color_hover'] = array(
			'default' => '#00626d',
			'label' => __( 'Add to cart button border color - Hover', 'product-configurator-for-woocommerce' )
		);
		$colors['add_to_cart_text_color_hover'] = array(
			'default' => '#FFF',
			'label' => __( 'Add to cart button text color - Hover', 'product-configurator-for-woocommerce' )
		);

		$colors['light-gray'] = array(
			'default' => '#b5c2bd',
			'label' => __( 'Dimmed label', 'product-configurator-for-woocommerce' )
		);
		$colors['viewer-bg'] = array(
			'default' => '#202125',
			'label' => __( 'Viewer background color', 'product-configurator-for-woocommerce' )
		);
	} else {
		$colors['primary'] = array(
			'default' => 'rgb(0, 213, 209)',
			'label' => __( 'Primary color', 'product-configurator-for-woocommerce' )
		);
		$colors['primary_hover'] = array(
			'default' => '#00626d',
			'label' => __( 'Primary hover', 'product-configurator-for-woocommerce' )
		);
		$colors['layers_button_text_color'] = array(
			'default' => '#000000',
			'label' => __( 'Layers text color', 'product-configurator-for-woocommerce' )
		);
		$colors['layers_button_text_color_hover'] = array(
			'default' => '#b0b5c0',
			'label' => __( 'Layers text color - hover', 'product-configurator-for-woocommerce' )
		);
		$colors['choices_button_text_color'] = array(
			'default' => '#000000',
			'label' => __( 'Choices text color', 'product-configurator-for-woocommerce' )
		);
		$colors['layers_bg'] = array(
			'default' => '#FFF',
			'label' => __( 'Layers section background', 'product-configurator-for-woocommerce' )
		);
		$colors['layer_choices_bg'] = array(
			'default' => '#F8F8F8',
			'label' => __( 'Choices section background', 'product-configurator-for-woocommerce' )
		);

		$colors['active_choice_button_bg_color'] = array(
			'default' => '#FFF',
			'label' => __( 'Active choice background color', 'product-configurator-for-woocommerce' )
		);
		$colors['active_choice_button_text_color'] = array(
			'default' => '#000',
			'label' => __( 'Active choice text color', 'product-configurator-for-woocommerce' )
		);

		$colors['add_to_cart_bg_color'] = array(
			'default' => '#FFF',
			'label' => __( 'Add to cart button background color', 'product-configurator-for-woocommerce' )
		);
		$colors['add_to_cart_border_color'] = array(
			'default' => 'rgb(0, 213, 209)',
			'label' => __( 'Add to cart button border color', 'product-configurator-for-woocommerce' )
		);
		$colors['add_to_cart_text_color'] = array(
			'default' => 'rgb(0, 213, 209)',
			'label' => __( 'Add to cart button text color', 'product-configurator-for-woocommerce' )
		);
		$colors['add_to_cart_bg_color_hover'] = array(
			'default' => '#00626d',
			'label' => __( 'Add to cart button background color - Hover', 'product-configurator-for-woocommerce' )
		);
		$colors['add_to_cart_border_color_hover'] = array(
			'default' => '#00626d',
			'label' => __( 'Add to cart button border color - Hover', 'product-configurator-for-woocommerce' )
		);
		$colors['add_to_cart_text_color_hover'] = array(
			'default' => '#FFF',
			'label' => __( 'Add to cart button text color - Hover', 'product-configurator-for-woocommerce' )
		);

		$colors['light-gray'] = array(
			'default' => '#b5c2bd',
			'label' => __( 'Dimmed label', 'product-configurator-for-woocommerce' )
		);
		$colors['viewer-bg'] = array(
			'default' => '#EDEDED',
			'label' => __( 'Viewer background color', 'product-configurator-for-woocommerce' )
		);

	}
	return $colors;
}

add_filter( 'mkl_pc_theme_color_settings', 'mkl_pc_float_theme_filter_colors' );

function mkl_pc_float_theme_add_customizer_settings( $wp_customize, $mkl_pc_customizer ) {
	$prefix = MKL\PC\Customizer::PREFIX;
	if ( ! class_exists( 'MKL\PC\Custom_Radio_Image_Control' ) ) require_once MKL_PC_INCLUDE_PATH . 'admin/customizer-radio-control.php';

	// Add the first Dark/light mode setting
	$wp_customize->add_setting(
		$prefix . 'color_mode',
		array(
			'default' => 'light',
			'type' => 'option', 
			'capability' =>  'edit_theme_options',
			// 'sanitize_callback' => 'esc_url',
		)
	);

	$wp_customize->add_control(
		new \WP_Customize_Control(
			$wp_customize,
			$prefix . 'color_mode',
			array('label'  => __( 'Color mode', 'product-configurator-for-woocommerce' ),
				'section'  => 'mlk_pc',
				'settings' => $prefix . 'color_mode',
				'type'     => 'radio',
				'choices'  => array(
					'light'  => __( 'Light', 'product-configurator-for-woocommerce' ),
					'dark'   => __( 'Dark', 'product-configurator-for-woocommerce' ),
				)
			)
		)
	);
	
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
add_filter( 'mkl_pc_customizer_settings_before', 'mkl_pc_float_theme_add_customizer_settings', 20, 2 );