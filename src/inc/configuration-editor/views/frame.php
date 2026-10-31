<?php
/**
 * The bare configurator page: the configurator and nothing else. See Configurator_Frame.
 *
 * wp_head() and wp_footer() stay, because the configurator and its add-ons enqueue their scripts and print
 * their templates there. wp_body_open() does not: it is where themes and plugins put banners.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

// Set up $post and $product the way a product template does; the configurator reads both.
if ( have_posts() ) {
	the_post();
}
?>
<!DOCTYPE html>
<html <?php language_attributes(); ?>>
<head>
	<meta charset="<?php bloginfo( 'charset' ); ?>">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<?php if ( ! current_theme_supports( 'title-tag' ) ) : ?>
		<title><?php echo esc_html( wp_get_document_title() ); ?></title>
	<?php endif; ?>
	<?php wp_head(); ?>
</head>
<body <?php body_class( [ 'mkl-pc-frame', 'mkl-pc-embed' ] ); ?>>
	<?php echo do_shortcode( '[mkl_configurator product_id="' . (int) get_the_ID() . '"]' ); ?>
	<?php wp_footer(); ?>
</body>
</html>
