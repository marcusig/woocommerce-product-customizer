<?php
/**
 * One quote request, as its customer sees it
 *
 * This template can be overridden by copying it to yourtheme/product-configurator/quotes/quote.php.
 *
 * @var \MKL\PC\Quote_Request       $request
 * @var string                      $status       The status, as the customer reads it.
 * @var int                         $sent         When the quote was sent, 0 before.
 * @var string                      $sent_message What the merchant wrote with the quote.
 * @var float|null                  $price        The quoted price once sent, or the estimate when prices are shown.
 * @var string                      $price_label
 * @var bool                        $show_image
 * @var string                      $back_url     The list it was opened from, or ''.
 * @var string                      $pdf_url      The quote as a PDF, when there is one to download.
 * @var string                      $answer_form  Accept, decline, ask for a change (quotes/quote-answer.php), or ''.
 * @var \MKL\PC\Quote_Customer_View $view
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<div class="mkl-pc-quote">
	<?php if ( $back_url ) : ?>
		<p><a href="<?php echo esc_url( $back_url ); ?>"><?php esc_html_e( '← All your requests', 'product-configurator-for-woocommerce' ); ?></a></p>
	<?php endif; ?>

	<h2 class="mkl-pc-quote__title">
		<?php
		/* translators: %s: quote request reference */
		echo esc_html( sprintf( __( 'Quote request %s', 'product-configurator-for-woocommerce' ), $request->reference ) );
		?>
	</h2>
	<p class="mkl-pc-quote__meta">
		<?php
		/* translators: %s: date */
		echo esc_html( sprintf( __( 'Requested on %s', 'product-configurator-for-woocommerce' ), wp_date( get_option( 'date_format' ), $request->created ) ) );
		?>
		<?php if ( $status ) : ?>
			· <span class="mkl-pc-quote__status"><?php echo esc_html( $status ); ?></span>
		<?php endif; ?>
	</p>

	<?php if ( $sent && '' !== $sent_message ) : ?>
		<div class="mkl-pc-quote__message">
			<?php echo wp_kses_post( wpautop( wptexturize( make_clickable( esc_html( $sent_message ) ) ) ) ); ?>
		</div>
	<?php endif; ?>

	<div class="mkl-pc-quote__summary">
		<?php if ( $show_image && $request->image_url ) : ?>
			<div class="mkl-pc-quote__image"><img src="<?php echo esc_url( $request->image_url ); ?>" alt="" /></div>
		<?php endif; ?>
		<div class="mkl-pc-quote__configuration">
			<p><strong><?php echo esc_html( $request->get_product_name() ); ?></strong> &times; <?php echo esc_html( $request->quantity ); ?></p>
			<?php foreach ( $request->get_summary() as $row ) : ?>
				<div><strong><?php echo wp_kses_post( $row['label'] ); ?></strong><?php echo $row['label'] ? ': ' : ''; ?><?php echo wp_kses_post( $row['value'] ); ?></div>
			<?php endforeach; ?>
			<?php if ( null !== $price && function_exists( 'wc_price' ) ) : ?>
				<p class="mkl-pc-quote__price"><strong><?php echo esc_html( $price_label ); ?>:</strong> <?php echo wp_kses_post( wc_price( $price ) ); ?></p>
			<?php endif; ?>
			<?php if ( $pdf_url ) : ?>
				<p class="mkl-pc-quote__pdf"><a href="<?php echo esc_url( $pdf_url ); ?>"><?php esc_html_e( 'Download the quote (PDF)', 'product-configurator-for-woocommerce' ); ?></a></p>
			<?php endif; ?>
		</div>
	</div>

	<?php echo $answer_form; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Escaped in its template. ?>

	<?php $rows = $request->get_field_rows(); ?>
	<?php if ( $rows ) : ?>
		<h3><?php esc_html_e( 'Your details', 'product-configurator-for-woocommerce' ); ?></h3>
		<table class="mkl-pc-quotes__table">
			<tbody>
				<?php foreach ( $rows as $row ) : ?>
					<tr>
						<th scope="row"><?php echo esc_html( wp_strip_all_tags( $row['label'] ) ); ?></th>
						<td><?php echo wp_kses_post( nl2br( esc_html( $row['value'] ) ) ); ?></td>
					</tr>
				<?php endforeach; ?>
			</tbody>
		</table>
	<?php endif; ?>

	<?php
	/**
	 * After a quote request, on the customer's page
	 *
	 * @param \MKL\PC\Quote_Request $request
	 */
	do_action( 'mkl_pc/quote_request/customer_view/after', $request );
	?>
</div>
