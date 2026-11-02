<?php
/**
 * The customer answered a quote, plain text: to the shop, and confirmed to the customer
 *
 * This template can be overridden by copying it to yourtheme/product-configurator/emails/plain/quote-request-answer.php.
 *
 * @var \MKL\PC\Quote_Request $quote_request
 * @var string                $answer           accept, decline, change.
 * @var string                $customer_message What the customer wrote: their reason, or the change they ask for.
 * @var \WC_Order|null        $order            The order to pay, when accepting made one.
 * @var string                $pay_url          Its payment page, while it waits for payment.
 * @var string                $email_heading
 * @var string                $main_content
 * @var string                $additional_content
 * @var bool                  $sent_to_admin
 * @var bool                  $show_prices
 * @var \MKL\PC\Email         $email
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

echo "=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=\n";
echo esc_html( wp_strip_all_tags( $email_heading ) );
echo "\n=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=\n\n";

echo esc_html( wp_strip_all_tags( wptexturize( $main_content ) ) ) . "\n\n";

if ( 'accept' === $answer ) {
	if ( $sent_to_admin && $order ) {
		/* translators: %s: order number */
		echo esc_html( sprintf( __( 'Order #%s was made at the quoted price, and waits for payment.', 'product-configurator-for-woocommerce' ), $order->get_order_number() ) ) . "\n" . esc_url_raw( $order->get_edit_order_url() ) . "\n\n";
	} elseif ( $sent_to_admin ) {
		echo esc_html__( 'Get in touch with the customer to finalize the order.', 'product-configurator-for-woocommerce' ) . "\n\n";
	} elseif ( $pay_url ) {
		/* translators: %s: order number */
		echo esc_html( sprintf( __( 'Your order #%s is ready. If you have not paid for it yet, you can pay here:', 'product-configurator-for-woocommerce' ), $order->get_order_number() ) ) . "\n" . esc_url_raw( $pay_url ) . "\n\n";
	} elseif ( $order ) {
		/* translators: %s: order number */
		echo esc_html( sprintf( __( 'Your order #%s was made.', 'product-configurator-for-woocommerce' ), $order->get_order_number() ) ) . "\n\n";
	} else {
		echo esc_html__( 'We will be in touch to finalize your order.', 'product-configurator-for-woocommerce' ) . "\n\n";
	}
} elseif ( 'decline' === $answer && ! $sent_to_admin ) {
	echo esc_html__( 'You declined this quote. If you change your mind, reply to this email.', 'product-configurator-for-woocommerce' ) . "\n\n";
} elseif ( 'change' === $answer ) {
	echo esc_html( $sent_to_admin ? __( 'The request is back in progress, for you to send a new quote.', 'product-configurator-for-woocommerce' ) : __( 'We will get back to you with a new quote.', 'product-configurator-for-woocommerce' ) ) . "\n\n";
}

if ( '' !== $customer_message ) {
	if ( 'decline' === $answer ) {
		echo esc_html( $sent_to_admin ? __( 'Their reason', 'product-configurator-for-woocommerce' ) : __( 'Your reason', 'product-configurator-for-woocommerce' ) );
	} else {
		echo esc_html( $sent_to_admin ? __( 'Their message', 'product-configurator-for-woocommerce' ) : __( 'Your message', 'product-configurator-for-woocommerce' ) );
	}
	echo ":\n" . esc_html( $customer_message ) . "\n\n";
}

echo "----------------------------------------\n\n";

/* translators: %s: quote reference */
echo esc_html( sprintf( __( 'Quote %s', 'product-configurator-for-woocommerce' ), $quote_request->reference ) ) . "\n\n";
if ( $sent_to_admin && ( $admin_url = $quote_request->get_admin_url() ) ) {
	echo esc_html__( 'Open the request in your dashboard:', 'product-configurator-for-woocommerce' ) . ' ' . esc_url_raw( $admin_url ) . "\n\n";
} elseif ( ! $sent_to_admin && ( $view_url = $quote_request->get_view_url() ) ) {
	echo esc_html__( 'View your quote online:', 'product-configurator-for-woocommerce' ) . ' ' . esc_url_raw( $view_url ) . "\n\n";
}
echo esc_html( $quote_request->get_product_name() ) . ' x ' . esc_html( $quote_request->quantity ) . "\n";
foreach ( $quote_request->get_summary() as $row ) {
	echo esc_html( wp_strip_all_tags( $row['label'] ) ) . ( $row['label'] ? ': ' : '' ) . esc_html( wp_strip_all_tags( $row['value'] ) ) . "\n";
}
if ( $show_prices && null !== $quote_request->get_line_price() ) {
	echo "\n" . esc_html__( 'Price:', 'product-configurator-for-woocommerce' ) . ' ' . esc_html( wp_strip_all_tags( html_entity_decode( wc_price( $quote_request->get_line_price() ) ) ) ) . "\n";
}

echo "\n----------------------------------------\n\n";

if ( $additional_content ) {
	echo esc_html( wp_strip_all_tags( wptexturize( $additional_content ) ) );
	echo "\n\n----------------------------------------\n\n";
}

echo wp_kses_post( apply_filters( 'woocommerce_email_footer_text', get_option( 'woocommerce_email_footer_text' ) ) );
