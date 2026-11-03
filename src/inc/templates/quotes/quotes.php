<?php
/**
 * A customer's quote requests
 *
 * This template can be overridden by copying it to yourtheme/product-configurator/quotes/quotes.php.
 *
 * @var \MKL\PC\Quote_Request[]       $requests
 * @var bool                          $signed_in
 * @var string                        $login_url
 * @var callable                      $url_for     The link to a request: $url_for( $request ).
 * @var string                        $lookup_form "Find my requests", for visitors (HTML).
 * @var \MKL\PC\Quote_Customer_View   $view
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<div class="mkl-pc-quotes">
	<?php if ( ! $signed_in ) : ?>
		<p><?php esc_html_e( 'To see a quote request, open the link in the email we sent you about it.', 'product-configurator-for-woocommerce' ); ?></p>
		<p><a href="<?php echo esc_url( $login_url ); ?>"><?php esc_html_e( 'Have an account? Sign in to see all your requests.', 'product-configurator-for-woocommerce' ); ?></a></p>
		<?php echo $lookup_form; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Escaped in its template. ?>
	<?php elseif ( empty( $requests ) ) : ?>
		<p><?php esc_html_e( 'You have no quote requests yet.', 'product-configurator-for-woocommerce' ); ?></p>
	<?php else : ?>
		<table class="mkl-pc-quotes__table">
			<thead>
				<tr>
					<th scope="col"><?php esc_html_e( 'Request', 'product-configurator-for-woocommerce' ); ?></th>
					<th scope="col"><?php esc_html_e( 'Date', 'product-configurator-for-woocommerce' ); ?></th>
					<th scope="col"><?php esc_html_e( 'Product', 'product-configurator-for-woocommerce' ); ?></th>
					<th scope="col"><?php esc_html_e( 'Status', 'product-configurator-for-woocommerce' ); ?></th>
				</tr>
			</thead>
			<tbody>
				<?php foreach ( $requests as $request ) : ?>
					<tr>
						<td><a href="<?php echo esc_url( $url_for( $request ) ); ?>"><?php echo esc_html( $request->reference ); ?></a></td>
						<td><?php echo esc_html( wp_date( get_option( 'date_format' ), $request->created ) ); ?></td>
						<td><?php echo esc_html( $request->get_product_name() ); ?><?php echo $request->quantity > 1 ? ' &times; ' . esc_html( $request->quantity ) : ''; ?></td>
						<td><span class="mkl-pc-quote__status"><?php echo esc_html( $view->get_status_label( $request ) ); ?></span></td>
					</tr>
				<?php endforeach; ?>
			</tbody>
		</table>
	<?php endif; ?>
</div>
