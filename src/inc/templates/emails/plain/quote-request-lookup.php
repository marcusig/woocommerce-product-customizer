<?php
/**
 * The links of a customer's quote requests, plain text
 *
 * This template can be overridden by copying it to yourtheme/product-configurator/emails/plain/quote-request-lookup.php.
 *
 * @var \MKL\PC\Quote_Request[] $requests
 * @var string                  $email_heading
 * @var string                  $main_content
 * @var string                  $additional_content
 * @var \MKL\PC\Email           $email
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

echo "=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=\n";
echo esc_html( wp_strip_all_tags( $email_heading ) );
echo "\n=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=\n\n";

echo esc_html( wp_strip_all_tags( wptexturize( $main_content ) ) ) . "\n\n";

foreach ( $requests as $quote_request ) {
	echo esc_html( $quote_request->reference . ' - ' . wp_date( get_option( 'date_format' ), $quote_request->created ) . ' - ' . $quote_request->get_product_name() ) . "\n";
	$url = $quote_request->get_view_url();
	if ( $url ) echo esc_url_raw( $url ) . "\n";
	echo "\n";
}

if ( $additional_content ) {
	echo esc_html( wp_strip_all_tags( wptexturize( $additional_content ) ) );
	echo "\n\n----------------------------------------\n\n";
}

echo wp_kses_post( apply_filters( 'woocommerce_email_footer_text', get_option( 'woocommerce_email_footer_text' ) ) );
