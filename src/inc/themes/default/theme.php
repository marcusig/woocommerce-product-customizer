<?php

function mkl_pc_default_price_wrapper_before() {
	echo '<div class="pc-total-price--container">';
}
add_action( 'mkl_pc_frontend_configurator_footer_form', 'mkl_pc_default_price_wrapper_before', 8 );

function mkl_pc_default_price_wrapper_after() {
	echo '</div>';
}
add_action( 'mkl_pc_frontend_configurator_footer_form', 'mkl_pc_default_price_wrapper_after', 16 );
