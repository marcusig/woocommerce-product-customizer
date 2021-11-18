<?php
function mkl_pc_dark_theme_scripts() {
	$data = "
	(function($) {
		wp.hooks.addAction( 'PC.fe.start', 'MKL/PC/Themes/dark-mode', function( view ) {
			view.\$el.addClass( 'dark-mode' );
		} );
		wp.hooks.addFilter( 'PC.fe.tooltip.options', 'MKL/PC/Themes/dark-mode', function( options ) {
			options.theme = 'invert';
			return options;
		}, 20);
	})();
	";
	wp_add_inline_script( 'mkl_pc/js/views/configurator', $data, 'before' );
}
add_action( 'mkl_pc_scripts_product_page_after', 'mkl_pc_dark_theme_scripts', 20 );

add_filter( 'mkl_pc_bg_image', function( $bg ) {
	return '';
}, 30 );

/**
 * Filter the customizer's colors
 *
 * @param array $colors
 * @return array
 */
function mkl_pc_dark_theme_filter_colors( $colors ) {
	$colors['dark'] = [
		'default' => '#2e2e32',
		'label' => __( 'Dark gray (Layers background)', 'product-configurator-for-woocommerce' )
	];
	$colors['darkest'] = [
		'default' => '#202125',
		'label' => __( 'Darker gray (Preview background, borders)', 'product-configurator-for-woocommerce' )
	];
	$colors['ll1'] = [
		'default' => '#f2f3f5',
		'label' => __( 'Light gray 1', 'product-configurator-for-woocommerce' )
	];
	$colors['ll2'] = [
		'default' => '#b0b5c0',
		'label' => __( 'Light gray 2', 'product-configurator-for-woocommerce' )
	];
	$colors['ll3'] = [
		'default' => '#6b6f7a',
		'label' => __( 'Medium gray 3', 'product-configurator-for-woocommerce' )
	];
	$colors['ll4'] = [
		'default' => '#565b64',
		'label' => __( 'Medium gray 4', 'product-configurator-for-woocommerce' )
	];

	// Remove the primary color
	if ( isset( $colors['primary'] ) ) unset( $colors['primary'] );

	return $colors;
}
add_filter( 'mkl_pc_theme_color_settings', 'mkl_pc_dark_theme_filter_colors' );
