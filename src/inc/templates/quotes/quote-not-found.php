<?php
/**
 * A request link that does not open a request: unknown, or its key was changed
 *
 * This template can be overridden by copying it to yourtheme/product-configurator/quotes/quote-not-found.php.
 *
 * @var string $list_url The signed-in customer's requests, or ''.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<div class="mkl-pc-quotes">
	<p><?php esc_html_e( 'This quote request link is not valid any more. Please contact us if you need it.', 'product-configurator-for-woocommerce' ); ?></p>
	<?php if ( $list_url ) : ?>
		<p><a href="<?php echo esc_url( $list_url ); ?>"><?php esc_html_e( 'See all your requests', 'product-configurator-for-woocommerce' ); ?></a></p>
	<?php endif; ?>
</div>
