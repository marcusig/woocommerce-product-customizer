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

function mkl_pc_frontend_configurator__choice_item_attrs() {
	$attributes = apply_filters( 'mkl_pc_choice_items_attributes', array(
		'class' => 'choice-item',
	));

	$attrs_string = '';
	foreach( $attributes as $name => $value ) {
		if ( $attrs_string ) $attrs_string .= ' ';
		if ( is_string( $name ) ) {
			$attrs_string .= $name . '="' . esc_attr( $value ) . '"';
		}
	}
	echo ' ' . $attrs_string;
}
add_action( 'tmpl-pc-configurator-choice-item-attributes', 'mkl_pc_frontend_configurator__choice_item_attrs' );


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

/*
	LAYER CONTENT
*/

function mkl_pc_frontend_configurator_layer_icon() {
	?>
		<i class="img"><# if(data.image.url) { #><img src="{{data.image.url}}" alt="img_{{data.image.id}}" /><# } #></i>
	<?php
}
add_action( 'tmpl-mkl-pc-configurator-layer-item-button', 'mkl_pc_frontend_configurator_layer_icon', 5 );

function mkl_pc_frontend_configurator_layer_name() {
	?>
		<span class="text layer-name">{{data.name}}</span>
	<?php
}
add_action( 'tmpl-mkl-pc-configurator-layer-item-button', 'mkl_pc_frontend_configurator_layer_name', 10 );

function mkl_pc_frontend_configurator_layer_description() {
	?>
		<# if ( data.description ) { #><span class="description">{{{data.description}}}</span><# } #>
	<?php
}
add_action( 'tmpl-mkl-pc-configurator-layer-item-button', 'mkl_pc_frontend_configurator_layer_description', 20 );

/*
	CHOICE CONTENT
*/

function mkl_pc_frontend_configurator_choice_thumbnail() {
	?>
		<# if(data.thumbnail) { #><i class="mkl-pc-thumbnail"><span><img src="{{data.thumbnail}}" alt="" /></span></i><# } #>
	<?php
}
add_action( 'tmpl-pc-configurator-choice-item', 'mkl_pc_frontend_configurator_choice_thumbnail', 5 );

function mkl_pc_frontend_configurator_choice_name() {
	?>
		<span class="text choice-name"><?php echo apply_filters( 'tmpl-pc-configurator-choice-item-label', '{{data.name}}' ) ?></span>
	<?php
}
add_action( 'tmpl-pc-configurator-choice-item', 'mkl_pc_frontend_configurator_choice_name', 10 );

function mkl_pc_frontend_configurator_choice_description() {
	?>
		<# if ( data.description ) { #><span class="description">{{{data.description}}}</span><# } #>
	<?php
}
add_action( 'tmpl-pc-configurator-choice-item', 'mkl_pc_frontend_configurator_choice_description', 20 );

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
