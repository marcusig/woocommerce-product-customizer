<?php

// function mkl_pc_default_theme_scripts() {
// 	wp_enqueue_script( 'mkl/pc/themes/default', plugin_dir_url( __FILE__ ) . 'default.js', [ 'wp-hooks', 'jquery' ], filemtime( plugin_dir_path( __FILE__ ) . 'default.js' ), true );
// }
// add_action( 'mkl_pc_scripts_product_page_after', 'mkl_pc_default_theme_scripts', 20 );

function mkl_pc_default_price_wrapper_before() {
	echo '<div class="pc-total-price--container">';
}
add_action( 'mkl_pc_frontend_configurator_footer_form', 'mkl_pc_default_price_wrapper_before', 8 );

function mkl_pc_default_price_wrapper_after() {
	echo '</div>';
}
add_action( 'mkl_pc_frontend_configurator_footer_form', 'mkl_pc_default_price_wrapper_after', 16 );
