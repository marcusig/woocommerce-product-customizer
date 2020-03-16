<?php 

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly
}

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
