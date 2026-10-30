<?php
/**
 * Details of a quote request: the configuration, and what the customer filled in
 *
 * This template can be overridden by copying it to yourtheme/product-configurator/emails/quote-request-details.php.
 *
 * @var \MKL\PC\Quote_Request $quote_request
 * @var bool                  $sent_to_admin
 * @var bool                  $show_prices
 * @var bool                  $show_image
 * @var \MKL\PC\Email         $email
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$summary = $quote_request->get_summary();
?>
<h2><?php
	/* translators: %s: quote request reference */
	echo esc_html( sprintf( __( 'Quote request %s', 'product-configurator-for-woocommerce' ), $quote_request->reference ) );
?></h2>

<table class="td" cellspacing="0" cellpadding="6" border="1" style="width: 100%; margin-bottom: 24px;">
	<tbody>
		<tr>
			<?php if ( $show_image && $quote_request->image_url ) : ?>
				<td class="td" style="width: 160px; vertical-align: top;">
					<img src="<?php echo esc_url( $quote_request->image_url ); ?>" alt="" width="150" style="max-width: 150px; height: auto; display: block;" />
				</td>
			<?php endif; ?>
			<td class="td" style="vertical-align: top;">
				<strong><?php echo esc_html( $quote_request->get_product_name() ); ?></strong>
				&times; <?php echo esc_html( $quote_request->quantity ); ?>
				<?php if ( ! empty( $summary ) ) : ?>
					<div class="order-configuration" style="margin-top: 8px;">
						<?php foreach ( $summary as $row ) : ?>
							<div>
								<strong><?php echo wp_kses_post( $row['label'] ); ?></strong><?php echo $row['label'] ? ': ' : ''; ?><?php echo wp_kses_post( $row['value'] ); ?>
							</div>
						<?php endforeach; ?>
					</div>
				<?php endif; ?>
				<?php if ( $show_prices && is_array( $quote_request->price ) && function_exists( 'wc_price' ) ) : ?>
					<p style="margin: 8px 0 0;">
						<?php esc_html_e( 'Estimated price:', 'product-configurator-for-woocommerce' ); ?>
						<?php echo wp_kses_post( wc_price( $quote_request->price['line_total'] ) ); ?>
					</p>
				<?php endif; ?>
			</td>
		</tr>
	</tbody>
</table>

<?php $rows = $quote_request->get_field_rows(); ?>
<?php if ( ! empty( $rows ) ) : ?>
	<h2><?php esc_html_e( 'Contact details', 'product-configurator-for-woocommerce' ); ?></h2>
	<table class="td" cellspacing="0" cellpadding="6" border="1" style="width: 100%; margin-bottom: 24px;">
		<tbody>
			<?php foreach ( $rows as $row ) : ?>
				<tr>
					<th class="td" scope="row" style="text-align: left; width: 35%;"><?php echo esc_html( wp_strip_all_tags( $row['label'] ) ); ?></th>
					<td class="td" style="text-align: left;"><?php echo wp_kses_post( nl2br( make_clickable( esc_html( $row['value'] ) ) ) ); ?></td>
				</tr>
			<?php endforeach; ?>
		</tbody>
	</table>
<?php endif; ?>

<?php
/**
 * After the details of a quote request in an email
 *
 * @param \MKL\PC\Quote_Request $quote_request
 * @param bool                  $sent_to_admin
 * @param bool                  $plain_text
 * @param \MKL\PC\Email         $email
 */
do_action( 'mkl_pc/email/quote_request/after_details', $quote_request, $sent_to_admin, false, $email );
