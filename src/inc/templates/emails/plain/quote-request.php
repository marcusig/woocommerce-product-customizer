<?php
/**
 * Quote request email, plain text (merchant and customer), and the quote sent to the customer
 *
 * This template can be overridden by copying it to yourtheme/product-configurator/emails/plain/quote-request.php.
 *
 * @var \MKL\PC\Quote_Request|null $quote_request
 * @var string                     $email_heading
 * @var string                     $main_content
 * @var string                     $additional_content
 * @var bool                       $sent_to_admin
 * @var bool                       $show_prices
 * @var bool                       $is_quote      The quote sent to the customer.
 * @var string                     $quote_message What the merchant wrote, for the quote.
 * @var \MKL\PC\Email              $email
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

echo "=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=\n";
echo esc_html( wp_strip_all_tags( $email_heading ) );
echo "\n=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=\n\n";

echo esc_html( wp_strip_all_tags( wptexturize( $main_content ) ) );
if ( ! empty( $quote_message ) ) {
	echo "\n\n" . esc_html( $quote_message );
}
echo "\n\n----------------------------------------\n\n";

$is_quote = ! empty( $is_quote );
if ( $quote_request ) {
	/* translators: %s: quote reference */
	echo esc_html( sprintf( $is_quote ? __( 'Quote %s', 'product-configurator-for-woocommerce' ) : __( 'Quote request %s', 'product-configurator-for-woocommerce' ), $quote_request->reference ) ) . "\n\n";
	if ( $sent_to_admin && ( $admin_url = $quote_request->get_admin_url() ) ) {
		echo esc_html__( 'Open the request in your dashboard:', 'product-configurator-for-woocommerce' ) . ' ' . esc_url( $admin_url ) . "\n\n";
	}
	echo esc_html( $quote_request->get_product_name() ) . ' x ' . esc_html( $quote_request->quantity ) . "\n";
	foreach ( $quote_request->get_summary() as $row ) {
		echo esc_html( wp_strip_all_tags( $row['label'] ) ) . ( $row['label'] ? ': ' : '' ) . esc_html( wp_strip_all_tags( $row['value'] ) ) . "\n";
	}
	if ( $is_quote && $show_prices && null !== $quote_request->get_line_price() ) {
		echo "\n" . esc_html__( 'Price:', 'product-configurator-for-woocommerce' ) . ' ' . esc_html( wp_strip_all_tags( html_entity_decode( wc_price( $quote_request->get_line_price() ) ) ) ) . "\n";
	} elseif ( $show_prices && is_array( $quote_request->price ) && function_exists( 'wc_price' ) ) {
		echo "\n" . esc_html__( 'Estimated price:', 'product-configurator-for-woocommerce' ) . ' ' . esc_html( wp_strip_all_tags( html_entity_decode( wc_price( $quote_request->price['line_total'] ) ) ) ) . "\n";
	}

	$rows = $is_quote ? [] : $quote_request->get_field_rows();
	if ( ! empty( $rows ) ) {
		echo "\n" . esc_html__( 'Contact details', 'product-configurator-for-woocommerce' ) . "\n\n";
		foreach ( $rows as $row ) {
			echo esc_html( wp_strip_all_tags( $row['label'] ) ) . ': ' . esc_html( $row['value'] ) . "\n";
		}
	}

	/** This action is documented in templates/emails/quote-request-details.php */
	do_action( 'mkl_pc/email/quote_request/after_details', $quote_request, $sent_to_admin, true, $email );

	echo "\n----------------------------------------\n\n";
}

if ( $additional_content ) {
	echo esc_html( wp_strip_all_tags( wptexturize( $additional_content ) ) );
	echo "\n\n----------------------------------------\n\n";
}

echo wp_kses_post( apply_filters( 'woocommerce_email_footer_text', get_option( 'woocommerce_email_footer_text' ) ) );
