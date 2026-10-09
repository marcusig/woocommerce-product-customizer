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
		array( 'wp-hooks', 'jquery', 'mkl_pc/js/vendor/popper', 'mkl_pc/js/vendor/tippy', 'mkl_pc/js/product_configurator' ),
		filemtime( plugin_dir_path( __FILE__ ) . 'ev.js' ),
		true
	);

	if ( ! is_customize_preview() ) {
		return;
	}

	wp_enqueue_script(
		'mkl/pc/themes/ev/customizer-preview',
		plugin_dir_url( __FILE__ ) . 'customizer-preview.js',
		array( 'customize-preview' ),
		filemtime( plugin_dir_path( __FILE__ ) . 'customizer-preview.js' ),
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
 * Icon for the reset action, shown with the other viewer actions.
 */
function mkl_pc_ev_reset_icon() {
	echo \MKL\PC\Utils::inline_svg( trailingslashit( MKL_PC_INCLUDE_PATH ) . 'themes-common/icons/reset.svg' ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- SVG sanitized by Utils::inline_svg.
}
add_action( 'mkl_pc/reset_button/before_label', 'mkl_pc_ev_reset_icon' );

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

/**
 * EV controls in the Customizer.
 *
 * @param WP_Customize_Manager $wp_customize Customizer manager.
 * @param \MKL\PC\Customizer   $object       Configurator customizer.
 */
function mkl_pc_ev_customizer_settings( $wp_customize, $object ) {
	$prefix = $object::PREFIX;

	// The viewer has no background image in this theme.
	$wp_customize->remove_control( $prefix . 'use_viewer_bg' );
	$wp_customize->remove_setting( $prefix . 'use_viewer_bg' );
	$wp_customize->remove_control( $prefix . 'viewer_bg' );
	$wp_customize->remove_setting( $prefix . 'viewer_bg' );

	$wp_customize->add_setting(
		$prefix . 'ev_border_radius',
		array(
			'default'           => 10,
			'type'              => 'option',
			'capability'        => 'edit_theme_options',
			'transport'         => 'postMessage',
			'sanitize_callback' => 'mkl_pc_ev_sanitize_border_radius',
		)
	);

	$wp_customize->add_control(
		$prefix . 'ev_border_radius',
		array(
			'label'       => __( 'Border radius', 'product-configurator-for-woocommerce' ),
			'description' => __( 'Corner radius of the layer cards, in pixels.', 'product-configurator-for-woocommerce' ),
			'section'     => 'mlk_pc',
			'settings'    => $prefix . 'ev_border_radius',
			'type'        => 'number',
			'input_attrs' => array(
				'min'  => 0,
				'max'  => 40,
				'step' => 1,
			),
		)
	);

	$wp_customize->add_setting(
		$prefix . 'ev_footer_position',
		array(
			'default'           => 'sticky',
			'type'              => 'option',
			'capability'        => 'edit_theme_options',
			'transport'         => 'postMessage',
			'sanitize_callback' => 'mkl_pc_ev_sanitize_footer_position',
		)
	);

	$wp_customize->add_control(
		$prefix . 'ev_footer_position',
		array(
			'label'    => __( 'Footer', 'product-configurator-for-woocommerce' ),
			'section'  => 'mlk_pc',
			'settings' => $prefix . 'ev_footer_position',
			'type'     => 'select',
			'choices'  => array(
				'sticky' => __( 'Sticky', 'product-configurator-for-woocommerce' ),
				'static' => __( 'Not sticky', 'product-configurator-for-woocommerce' ),
			),
		)
	);
}
add_action( 'mkl_pc_customizer_settings', 'mkl_pc_ev_customizer_settings', 20, 2 );

/**
 * Keep the border radius within the control's range.
 *
 * @param mixed $value Submitted radius.
 * @return int
 */
function mkl_pc_ev_sanitize_border_radius( $value ) {
	$radius = absint( $value );
	if ( $radius > 40 ) {
		$radius = 40;
	}
	return $radius;
}

/**
 * Limit the footer position to the two supported values.
 *
 * @param mixed $value Submitted position.
 * @return string
 */
function mkl_pc_ev_sanitize_footer_position( $value ) {
	return 'static' === $value ? 'static' : 'sticky';
}

/**
 * Print the saved radius and footer position.
 */
function mkl_pc_ev_customizer_css() {
	$radius = mkl_pc_ev_sanitize_border_radius( get_option( 'mkl_pc_theme_ev_border_radius', 10 ) );
	$footer = mkl_pc_ev_sanitize_footer_position( get_option( 'mkl_pc_theme_ev_footer_position', 'sticky' ) );
	$css    = '.mkl_pc.ev { --ev-border-radius: ' . $radius . 'px; }';

	if ( 'static' === $footer ) {
		$css .= ' .mkl_pc.ev .mkl_pc_container .mkl_pc_footer { position: static; }';
	}

	wp_add_inline_style( 'mlk_pc/css', $css );
}
add_action( 'mkl_pc_scripts_product_page_after', 'mkl_pc_ev_customizer_css', 50 );
