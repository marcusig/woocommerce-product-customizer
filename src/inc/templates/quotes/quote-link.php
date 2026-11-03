<?php
/**
 * A request sent as a guest, opened from its link by a signed-in customer: add it to their account
 *
 * The form posts to the page it is on. This template can be overridden by copying it to
 * yourtheme/product-configurator/quotes/quote-link.php.
 *
 * @var \MKL\PC\Quote_Request $request
 * @var string                $result       What came of the last try: linked, expired, failed, or ''.
 * @var string                $key          The request's key, from its link.
 * @var string                $button_class The configurator's button classes.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$messages = [
	'linked'  => __( 'This request is now in your account.', 'product-configurator-for-woocommerce' ),
	'expired' => __( 'The form expired. Please try again.', 'product-configurator-for-woocommerce' ),
	'failed'  => __( 'This request could not be added to your account. Please try again.', 'product-configurator-for-woocommerce' ),
];
?>
<div class="mkl-pc-quote-answer mkl-pc-quote-link" id="mkl-pc-quote-link">
	<div role="status">
		<?php if ( isset( $messages[ $result ] ) ) : ?>
			<p class="mkl-pc-quote-answer__notice <?php echo 'linked' === $result ? '' : 'is-error'; ?>"><?php echo esc_html( $messages[ $result ] ); ?></p>
		<?php endif; ?>
	</div>
	<?php if ( 'linked' !== $result ) : ?>
		<form method="post" action="">
			<p><?php esc_html_e( 'You sent this request without signing in. Add it to your account to find it with your other requests.', 'product-configurator-for-woocommerce' ); ?></p>
			<input type="hidden" name="_wpnonce" value="<?php echo esc_attr( wp_create_nonce( \MKL\PC\Quote_Customer_View::LINK_ACTION . '_' . $request->id ) ); ?>" />
			<input type="hidden" name="reference" value="<?php echo esc_attr( $request->reference ); ?>" />
			<input type="hidden" name="key" value="<?php echo esc_attr( $key ); ?>" />
			<input type="hidden" name="<?php echo esc_attr( \MKL\PC\Quote_Customer_View::LINK_ACTION ); ?>" value="1" />
			<button type="submit" class="<?php echo esc_attr( $button_class ); ?>"><?php esc_html_e( 'Add to my account', 'product-configurator-for-woocommerce' ); ?></button>
		</form>
	<?php endif; ?>
</div>
