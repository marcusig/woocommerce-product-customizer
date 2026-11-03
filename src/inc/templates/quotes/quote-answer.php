<?php
/**
 * The customer's answer to their quote: accept, decline, ask for a change; then the payment link
 *
 * Each form posts to the page it is on. This template can be overridden by copying it to
 * yourtheme/product-configurator/quotes/quote-answer.php.
 *
 * @var \MKL\PC\Quote_Request $request
 * @var string[]              $answers      What the customer can answer now: accept, decline, change.
 * @var array|null            $result       What came of their last answer: code, message, error.
 * @var \WC_Order|null        $order        The order of the accepted quote.
 * @var string                $pay_url      Its payment page, while it waits for payment.
 * @var bool                  $accept_pays  Whether accepting leads to the payment page.
 * @var string                $fields       Hidden fields every form sends (escaped).
 * @var string                $button_class The configurator's button classes.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$action = \MKL\PC\Quote_Customer_Actions::ACTION;
$max = \MKL\PC\Quote_Customer_Actions::MESSAGE_MAX;
$retry = $result && $result['error'] ? $result['code'] : '';
?>
<div class="mkl-pc-quote-answer" id="mkl-pc-quote-answer">
	<div role="status">
		<?php if ( $result ) : ?>
			<p class="mkl-pc-quote-answer__notice <?php echo $result['error'] ? 'is-error' : ''; ?>"><?php echo esc_html( $result['message'] ); ?></p>
		<?php endif; ?>
	</div>

	<?php if ( $pay_url ) : ?>
		<p>
			<?php
			/* translators: %s: order number */
			echo esc_html( sprintf( __( 'Your order #%s waits for payment.', 'product-configurator-for-woocommerce' ), $order->get_order_number() ) );
			?>
		</p>
		<p><a class="<?php echo esc_attr( $button_class ); ?>" href="<?php echo esc_url( $pay_url ); ?>"><?php esc_html_e( 'Pay for your order', 'product-configurator-for-woocommerce' ); ?></a></p>
	<?php elseif ( $order ) : ?>
		<p>
			<?php
			/* translators: 1: order number, 2: order status */
			echo esc_html( sprintf( __( 'Order #%1$s: %2$s.', 'product-configurator-for-woocommerce' ), $order->get_order_number(), wc_get_order_status_name( $order->get_status() ) ) );
			?>
		</p>
	<?php endif; ?>

	<?php if ( in_array( 'accept', $answers, true ) ) : ?>
		<h3><?php esc_html_e( 'Your answer', 'product-configurator-for-woocommerce' ); ?></h3>
		<form method="post" action="" class="mkl-pc-quote-answer__accept">
			<p><?php echo esc_html( $accept_pays ? __( 'Happy with this quote? Accept it to go to the payment page.', 'product-configurator-for-woocommerce' ) : __( 'Happy with this quote? Accept it, and we will be in touch to finalize your order.', 'product-configurator-for-woocommerce' ) ); ?></p>
			<?php echo $fields; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Escaped where built. ?>
			<input type="hidden" name="<?php echo esc_attr( $action ); ?>" value="accept" />
			<button type="submit" class="<?php echo esc_attr( $button_class ); ?>"><?php echo esc_html( $accept_pays ? __( 'Accept and pay', 'product-configurator-for-woocommerce' ) : __( 'Accept the quote', 'product-configurator-for-woocommerce' ) ); ?></button>
		</form>
	<?php endif; ?>

	<?php if ( in_array( 'change', $answers, true ) ) : ?>
		<details class="mkl-pc-quote-answer__more" <?php echo 'message' === $retry ? 'open' : ''; ?>>
			<summary><?php esc_html_e( 'Ask for a change', 'product-configurator-for-woocommerce' ); ?></summary>
			<form method="post" action="">
				<?php echo $fields; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Escaped where built. ?>
				<input type="hidden" name="<?php echo esc_attr( $action ); ?>" value="change" />
				<label for="mkl-pc-quote-change"><?php esc_html_e( 'What would you like to change?', 'product-configurator-for-woocommerce' ); ?></label>
				<textarea id="mkl-pc-quote-change" name="message" rows="4" maxlength="<?php echo esc_attr( $max ); ?>" required <?php echo 'message' === $retry ? 'aria-invalid="true"' : ''; ?>></textarea>
				<button type="submit" class="<?php echo esc_attr( $button_class ); ?>"><?php esc_html_e( 'Send', 'product-configurator-for-woocommerce' ); ?></button>
			</form>
		</details>
	<?php endif; ?>

	<?php if ( in_array( 'decline', $answers, true ) ) : ?>
		<details class="mkl-pc-quote-answer__more">
			<summary><?php esc_html_e( 'Decline the quote', 'product-configurator-for-woocommerce' ); ?></summary>
			<form method="post" action="">
				<?php echo $fields; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Escaped where built. ?>
				<input type="hidden" name="<?php echo esc_attr( $action ); ?>" value="decline" />
				<label for="mkl-pc-quote-decline"><?php esc_html_e( 'Why? (optional)', 'product-configurator-for-woocommerce' ); ?></label>
				<textarea id="mkl-pc-quote-decline" name="message" rows="3" maxlength="<?php echo esc_attr( $max ); ?>"></textarea>
				<button type="submit" class="<?php echo esc_attr( $button_class ); ?>"><?php esc_html_e( 'Decline the quote', 'product-configurator-for-woocommerce' ); ?></button>
			</form>
		</details>
	<?php endif; ?>
</div>
