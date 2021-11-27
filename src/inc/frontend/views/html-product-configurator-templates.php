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
		<?php if ( get_option( 'mkl_pc_theme_use_viewer_bg', true ) )  : ?>
			<div class="mkl_pc_bg<# if ( data.bg_image && '<?php echo MKL_PC_ASSETS_URL.'images/default-bg.jpg'; ?>' == data.bg_image ) { #> default-bg<# } #>"<# if ( data.bg_image ) { #> style="background-image: url({{data.bg_image}}); "<# } #>></div>
		<?php endif; ?>
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
 * Footer
*/
/**
 * Display the product's name
 *
 * @return void
 */
function mkl_pc_frontend_configurator_footer_section_left_inner__product_name() {
	echo '<h3 class="product-name">{{{data.name}}}</h3>';
}

add_action( 'mkl_pc_frontend_configurator_footer_section_left_inner', 'mkl_pc_frontend_configurator_footer_section_left_inner__product_name', 30 );

/**
 * Reset button
 *
 * @return void
 */
function mkl_pc_frontend_configurator_footer_add_reset_button() {
	if ( ! ( bool ) mkl_pc( 'settings')->get( 'show_reset_button' ) ) return;
	$classes = apply_filters( 'mkl_pc_reset_button_classes' , [ 'reset-configuration' ] );
	echo '<button type="button" class="' . esc_attr( implode( ' ', $classes ) ) . '">' . __( 'Reset configuration', 'product-configurator-for-woocommerce' ) . '</button>';
}

add_action( 'mkl_pc_frontend_configurator_footer_section_right_before', 'mkl_pc_frontend_configurator_footer_add_reset_button', 30 );

/**
 * Footer Center wrapper
 *
 * @return void
 */
function mkl_pc_frontend_configurator_footer_add_center_wrapper_open() {
	echo '<div class="footer__section-center">';
}
add_action( 'mkl_pc_frontend_configurator_footer_section_right_before', 'mkl_pc_frontend_configurator_footer_add_center_wrapper_open', 5 );

/**
 * Footer Center wrapper END
 *
 * @return void
 */
function mkl_pc_frontend_configurator_footer_add_center_wrapper_close() {
	echo '</div>';
}
add_action( 'mkl_pc_frontend_configurator_footer_section_right_before', 'mkl_pc_frontend_configurator_footer_add_center_wrapper_close', 150 );

/**
 * Toolbar
*/

function mkl_pc_frontend_configurator_toolbar__header() {
?>
	<header><h3 class="product-name">{{{data.name}}}</h3><button class="cancel close-mkl-pc" type="button"><span><?php _e( 'Cancel' ); ?></span></button></header>
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
		<# if ( data.description && PC.fe.config.show_layer_description ) { #><span class="description">{{{data.description}}}</span><# } #>
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
