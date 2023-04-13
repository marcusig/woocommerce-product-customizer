<?php
function mkl_pc_old_default_theme_scripts() {
	wp_enqueue_script( 'mkl/pc/themes/old-default', plugin_dir_url( __FILE__ ) . 'old-default.js', [ 'wp-hooks', 'jquery' ], filemtime( plugin_dir_path( __FILE__ ) . 'old-default.js' ), true );
}
add_action( 'mkl_pc_scripts_product_page_after', 'mkl_pc_old_default_theme_scripts', 20 );

add_filter( 'mkl_pc_bg_image', function( $bg ) {
	return '';
}, 30 );
