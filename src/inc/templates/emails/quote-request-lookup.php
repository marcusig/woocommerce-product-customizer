<?php
/**
 * The links of a customer's quote requests, asked for on the customer page
 *
 * This template can be overridden by copying it to yourtheme/product-configurator/emails/quote-request-lookup.php.
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

do_action( 'woocommerce_email_header', $email_heading, $email ); ?>

<?php echo wp_kses_post( wpautop( wptexturize( $main_content ) ) ); ?>

<table class="td" cellspacing="0" cellpadding="6" border="1" style="width: 100%; margin-bottom: 24px;">
	<tbody>
		<?php foreach ( $requests as $quote_request ) : ?>
			<?php $url = $quote_request->get_view_url(); ?>
			<tr>
				<td class="td" style="text-align: left;">
					<?php if ( $url ) : ?>
						<a href="<?php echo esc_url( $url ); ?>"><?php echo esc_html( $quote_request->reference ); ?></a>
					<?php else : ?>
						<?php echo esc_html( $quote_request->reference ); ?>
					<?php endif; ?>
				</td>
				<td class="td" style="text-align: left;"><?php echo esc_html( wp_date( get_option( 'date_format' ), $quote_request->created ) ); ?></td>
				<td class="td" style="text-align: left;"><?php echo esc_html( $quote_request->get_product_name() ); ?></td>
			</tr>
		<?php endforeach; ?>
	</tbody>
</table>

<?php
if ( $additional_content ) {
	echo wp_kses_post( wpautop( wptexturize( $additional_content ) ) );
}

do_action( 'woocommerce_email_footer', $email );
