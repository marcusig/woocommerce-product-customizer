<?php
/**
 * The customer answered a quote: to the shop, and confirmed to the customer
 *
 * This template can be overridden by copying it to yourtheme/product-configurator/emails/quote-request-answer.php.
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
 * @var bool                  $show_image
 * @var \MKL\PC\Email         $email
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$email_improvements_enabled = class_exists( '\Automattic\WooCommerce\Utilities\FeaturesUtil' ) && \Automattic\WooCommerce\Utilities\FeaturesUtil::feature_is_enabled( 'email_improvements' );

do_action( 'woocommerce_email_header', $email_heading, $email ); ?>

<?php echo $email_improvements_enabled ? '<div class="email-introduction">' : ''; ?>
<?php echo wp_kses_post( wpautop( wptexturize( make_clickable( $main_content ) ) ) ); ?>

<?php if ( 'accept' === $answer ) : ?>
	<?php if ( $sent_to_admin && $order ) : ?>
		<p>
			<?php
			echo wp_kses_post( sprintf(
				/* translators: %s: link to the order */
				__( 'Order %s was made at the quoted price, and waits for payment.', 'product-configurator-for-woocommerce' ),
				'<a href="' . esc_url( $order->get_edit_order_url() ) . '">#' . esc_html( $order->get_order_number() ) . '</a>'
			) );
			?>
		</p>
	<?php elseif ( $sent_to_admin ) : ?>
		<p><?php esc_html_e( 'Get in touch with the customer to finalize the order.', 'product-configurator-for-woocommerce' ); ?></p>
	<?php elseif ( $pay_url ) : ?>
		<p>
			<?php
			/* translators: %s: order number */
			echo esc_html( sprintf( __( 'Your order #%s is ready. If you have not paid for it yet, you can pay here:', 'product-configurator-for-woocommerce' ), $order->get_order_number() ) );
			?>
		</p>
		<p><a href="<?php echo esc_url( $pay_url ); ?>"><?php esc_html_e( 'Pay for your order', 'product-configurator-for-woocommerce' ); ?></a></p>
	<?php elseif ( $order ) : ?>
		<p>
			<?php
			/* translators: %s: order number */
			echo esc_html( sprintf( __( 'Your order #%s was made.', 'product-configurator-for-woocommerce' ), $order->get_order_number() ) );
			?>
		</p>
	<?php else : ?>
		<p><?php esc_html_e( 'We will be in touch to finalize your order.', 'product-configurator-for-woocommerce' ); ?></p>
	<?php endif; ?>
<?php elseif ( 'decline' === $answer && ! $sent_to_admin ) : ?>
	<p><?php esc_html_e( 'You declined this quote. If you change your mind, reply to this email.', 'product-configurator-for-woocommerce' ); ?></p>
<?php elseif ( 'change' === $answer ) : ?>
	<p><?php echo esc_html( $sent_to_admin ? __( 'The request is back in progress, for you to send a new quote.', 'product-configurator-for-woocommerce' ) : __( 'We will get back to you with a new quote.', 'product-configurator-for-woocommerce' ) ); ?></p>
<?php endif; ?>

<?php if ( '' !== $customer_message ) : ?>
	<h2>
		<?php
		if ( 'decline' === $answer ) {
			echo esc_html( $sent_to_admin ? __( 'Their reason', 'product-configurator-for-woocommerce' ) : __( 'Your reason', 'product-configurator-for-woocommerce' ) );
		} else {
			echo esc_html( $sent_to_admin ? __( 'Their message', 'product-configurator-for-woocommerce' ) : __( 'Your message', 'product-configurator-for-woocommerce' ) );
		}
		?>
	</h2>
	<blockquote style="margin: 0 0 24px; padding: 0 0 0 12px; border-left: 3px solid #ddd;"><?php echo wp_kses_post( wpautop( make_clickable( esc_html( $customer_message ) ) ) ); ?></blockquote>
<?php endif; ?>
<?php echo $email_improvements_enabled ? '</div>' : ''; ?>

<?php
echo mkl_pc( 'mailer' )->get_template_html( // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Escaped in the template.
	'emails/quote-request-details.php',
	[
		'quote_request' => $quote_request,
		'sent_to_admin' => $sent_to_admin,
		'show_prices'   => $show_prices,
		'show_image'    => $show_image,
		'is_quote'      => true,
		'email'         => $email,
	]
);

if ( $additional_content ) {
	echo $email_improvements_enabled ? '<table border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation"><tr><td class="email-additional-content">' : '';
	echo wp_kses_post( wpautop( wptexturize( $additional_content ) ) );
	echo $email_improvements_enabled ? '</td></tr></table>' : '';
}

do_action( 'woocommerce_email_footer', $email );
