<?php
/**
 * Plain text template for Request a Quote email
 *
 * @package YITH\RequestAQuote
 * @version 1.5.3
 * @since   1.0.0
 * @author  YITH <plugins@yithemes.com>
 *
 * @var $email_heading string
 * @var $raq_data array
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly.
}

echo esc_html( $email_heading . "\n\n" );

/* translators: %s: user name */
echo sprintf( esc_html__( 'You have received a quote request from %s. The request is the following:', 'yith-woocommerce-request-a-quote' ), esc_html( $raq_data['user_name'] ) ) . "\n\n";

echo "****************************************************\n\n";

do_action( 'yith_ywraq_email_before_raq_table', $raq_data );

echo "\n";

if ( ! empty( $raq_data['raq_content'] ) ) :
	foreach ( $raq_data['raq_content'] as $item ) :

		if ( isset( $item['variation_id'] ) ) {
			$product = wc_get_product( $item['variation_id'] );
		} else {
			$product = wc_get_product( $item['product_id'] );
		}
		if ( ! $product ) {
			continue;
		}
		
		do_action( 'ywraq_quote_adjust_price', $item, $product );

		echo esc_html( $product->get_name() ) . ' ' . esc_html( yith_ywraq_get_product_meta( $item, false ) ) . ' | ';
		echo esc_html( $item['quantity'] );
		echo ' ' . esc_html( WC()->cart->get_product_subtotal( $product, $item['quantity'] ) );
		echo "\n";
	endforeach;
endif;

echo "\n****************************************************\n\n";

do_action( 'yith_ywraq_email_after_raq_table', $raq_data );

if ( ! empty( $raq_data['user_message'] ) ) {

	echo esc_html__( 'Customer message', 'yith-woocommerce-request-a-quote' ) . "\n";

	echo esc_html( $raq_data['user_message'] ) . "\n\n";
}

echo esc_html__( 'Customer details', 'yith-woocommerce-request-a-quote' ) . "\n";

echo esc_html__( 'Name:', 'yith-woocommerce-request-a-quote' );
echo esc_html( $raq_data['user_name'] ) . "\n";
echo esc_html__( 'Email:', 'yith-woocommerce-request-a-quote' );
echo esc_html( $raq_data['user_email'] ) . "\n";

echo "\n****************************************************\n\n";

echo esc_html( apply_filters( 'woocommerce_email_footer_text', get_option( 'woocommerce_email_footer_text' ) ) );
