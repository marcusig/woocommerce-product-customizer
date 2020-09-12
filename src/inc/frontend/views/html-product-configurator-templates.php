<?php 

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly
}

/**
 * Main view
 */

function mkl_pc_frontend_configurator__main_view__overlay() {
?>
	<div class="overlay"></div>
<?php
}
add_action( 'mkl_pc_frontend_configurator__main_view', 'mkl_pc_frontend_configurator__main_view__overlay', 20 );

function mkl_pc_frontend_configurator__main_view__main_container() {
?>
	<div class="mkl_pc_container">
		<div class="mkl_pc_bg" style="background-image: url({{data.bg_image}}); "></div>
	</div>
<?php
}
add_action( 'mkl_pc_frontend_configurator__main_view', 'mkl_pc_frontend_configurator__main_view__main_container', 30 );

function mkl_pc_frontend_configurator__main_view__loader() {
	?>
	<div class="loader">
		<div class="header"><?php _e( 'Loading Data', 'product-configurator-for-woocommerce' ); ?> </div>
		<div class="spinner"></div>
	</div>
<?php
}
add_action( 'mkl_pc_frontend_configurator__main_view', 'mkl_pc_frontend_configurator__main_view__loader', 40 );


/**
 * Toolbar
 */

function mkl_pc_frontend_configurator_toolbar__header() {
?>
	<header><h3 class="product-name">{{data.name}}</h3><button class="cancel close-mkl-pc" type="button"><span><?php _e( 'Cancel' ); ?></span></button></header>
<?php
}
add_action( 'mkl_pc_frontend_configurator_toolbar', 'mkl_pc_frontend_configurator_toolbar__header', 20 );

function mkl_pc_frontend_configurator_toolbar__choices_section() {
?>
	<section class="choices">
	</section>
<?php
}
add_action( 'mkl_pc_frontend_configurator_toolbar', 'mkl_pc_frontend_configurator_toolbar__choices_section', 30 );


$root = plugin_dir_path( __FILE__ ) . 'parts/' ;
$parts = apply_filters( 'mkl_pc_frontend_templates_parts', 
	array(
		array( 'path' => $root, 'file' =>'main-view.php' ),
		array( 'path' => $root, 'file' =>'toolbar.php' ),
		array( 'path' => $root, 'file' =>'product-viewer.php' ),
		array( 'path' => $root, 'file' =>'layer-item.php' ),
		array( 'path' => $root, 'file' =>'choices.php' ),
		array( 'path' => $root, 'file' =>'choice-item.php' ),
	)
);

do_action('mkl_pc_frontend_templates_before'); 

foreach( $parts as $part ) {
	if ( file_exists( $part['path'].$part['file'] ) ) {
		include $part['path'].$part['file'];
	} else {
		var_dump('file does not exist:', $part['path'].$part['file']);
	}
}

do_action('mkl_pc_frontend_templates_after');
