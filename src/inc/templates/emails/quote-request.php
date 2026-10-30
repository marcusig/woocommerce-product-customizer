<?php
/**
 * Quote request email (merchant and customer)
 *
 * This template can be overridden by copying it to yourtheme/product-configurator/emails/quote-request.php.
 *
 * @var \MKL\PC\Quote_Request|null $quote_request
 * @var string                     $email_heading
 * @var string                     $main_content
 * @var string                     $additional_content
 * @var bool                       $sent_to_admin
 * @var bool                       $plain_text
 * @var bool                       $show_prices
 * @var bool                       $show_image
 * @var \MKL\PC\Email              $email
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$email_improvements_enabled = class_exists( '\Automattic\WooCommerce\Utilities\FeaturesUtil' ) && \Automattic\WooCommerce\Utilities\FeaturesUtil::feature_is_enabled( 'email_improvements' );

do_action( 'woocommerce_email_header', $email_heading, $email ); ?>

<?php echo $email_improvements_enabled ? '<div class="email-introduction">' : ''; ?>
<?php echo wp_kses_post( wpautop( wptexturize( make_clickable( $main_content ) ) ) ); ?>
<?php echo $email_improvements_enabled ? '</div>' : ''; ?>

<?php
if ( $quote_request ) {
	echo mkl_pc( 'mailer' )->get_template_html( // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Escaped in the template.
		'emails/quote-request-details.php',
		[
			'quote_request' => $quote_request,
			'sent_to_admin' => $sent_to_admin,
			'show_prices'   => $show_prices,
			'show_image'    => $show_image,
			'email'         => $email,
		]
	);
}

if ( $additional_content ) {
	echo $email_improvements_enabled ? '<table border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation"><tr><td class="email-additional-content">' : '';
	echo wp_kses_post( wpautop( wptexturize( $additional_content ) ) );
	echo $email_improvements_enabled ? '</td></tr></table>' : '';
}

do_action( 'woocommerce_email_footer', $email );
