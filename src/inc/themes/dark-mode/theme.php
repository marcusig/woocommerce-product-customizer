<?php
function mkl_pc_dark_theme_scripts() {
	$data = "
	(function($) {
		wp.hooks.addFilter( 'PC.fe.tooltip.options', 'MKL/PC/Themes/dark-mode', function( options ) {
			options.theme = 'invert';
			return options;
		});
	})();
	";
	wp_add_inline_script( 'mkl_pc/js/views/configurator', $data, 'before' );
}
add_action( 'mkl_pc_scripts_product_page_after', 'mkl_pc_dark_theme_scripts', 20 );

add_filter( 'mkl_pc_bg_image', function( $bg ) {
	return '';
}, 30 );