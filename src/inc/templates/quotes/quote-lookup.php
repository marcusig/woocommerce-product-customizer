<?php
/**
 * "Find my requests": a visitor gets the links of the quote requests sent with their email address
 *
 * This template can be overridden by copying it to yourtheme/product-configurator/quotes/quote-lookup.php.
 *
 * @var array|null $lookup       The last submission: status (sent, invalid, limited, expired), email. Null before.
 * @var string     $button_class The configurator's button classes.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$status = $lookup ? $lookup['status'] : '';
$messages = [
	'sent'    => __( 'If we have quote requests sent with this address, we have emailed you their links.', 'product-configurator-for-woocommerce' ),
	'invalid' => __( 'Please enter a valid email address.', 'product-configurator-for-woocommerce' ),
	'limited' => __( 'Too many requests. Please try again later.', 'product-configurator-for-woocommerce' ),
	'expired' => __( 'The form expired. Please try again.', 'product-configurator-for-woocommerce' ),
];
?>
<form class="mkl-pc-quote-lookup" method="post" action="">
	<h3><?php esc_html_e( 'Find my requests', 'product-configurator-for-woocommerce' ); ?></h3>
	<p><?php esc_html_e( 'Lost the email? Enter the address you sent your request with, and we will email you the links.', 'product-configurator-for-woocommerce' ); ?></p>
	<div role="status">
		<?php if ( isset( $messages[ $status ] ) ) : ?>
			<p class="mkl-pc-quote-lookup__notice <?php echo 'sent' === $status ? '' : 'is-error'; ?>"><?php echo esc_html( $messages[ $status ] ); ?></p>
		<?php endif; ?>
	</div>
	<?php wp_nonce_field( \MKL\PC\Quote_Customer_View::LOOKUP_ACTION, '_wpnonce', false ); ?>
	<input type="hidden" name="<?php echo esc_attr( \MKL\PC\Quote_Customer_View::LOOKUP_ACTION ); ?>" value="1" />
	<p class="mkl-pc-quote-lookup__website" aria-hidden="true" style="position: absolute; left: -9999px;">
		<label for="mkl-pc-quote-lookup-website"><?php esc_html_e( 'Leave this field empty', 'product-configurator-for-woocommerce' ); ?></label>
		<input type="text" id="mkl-pc-quote-lookup-website" name="website" value="" tabindex="-1" autocomplete="off" />
	</p>
	<label for="mkl-pc-quote-lookup-email"><?php esc_html_e( 'Email address', 'product-configurator-for-woocommerce' ); ?></label>
	<div class="mkl-pc-quote-lookup__row">
		<input type="email" id="mkl-pc-quote-lookup-email" name="email" required autocomplete="email" value="<?php echo esc_attr( 'sent' === $status ? '' : ( $lookup ? $lookup['email'] : '' ) ); ?>" <?php echo 'invalid' === $status ? 'aria-invalid="true"' : ''; ?> />
		<button type="submit" class="<?php echo esc_attr( $button_class ); ?>"><?php esc_html_e( 'Email me the links', 'product-configurator-for-woocommerce' ); ?></button>
	</div>
</form>
