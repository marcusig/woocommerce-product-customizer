<?php
if (!defined('ABSPATH')) exit; 

$checkout_url = wc_get_checkout_url();

?>

<script type="text/html" id="tmpl-mkl-pc-configurator-add-to-cart--modal" data-wg-notranslate> 
	<?php do_action( 'tmpl-mkl-pc-configurator-add-to-cart--modal' ); ?>
</script>

<script type="text/html" id="tmpl-mkl-pc-atc-adding" data-wg-notranslate> 
	<div class="adding-to-cart--adding">
		<div class="header"><?php _e( 'Adding to the cart', 'product-configurator-for-woocommerce' ); ?> </div>
		<div class="spinner"></div>
	</div>
</script>

<script type="text/html" id="tmpl-mkl-pc-atc-added" data-wg-notranslate> 
	<div class="adding-to-cart--added has-box">
		<div class="header"><svg viewBox="0 0 300 300"><title><?php _e( 'Done!', 'product-configurator-for-woocommerce' ); ?></title><circle cx="150" cy="150" r="116.61"/><polyline points="73.61 150 129.81 206.19 223.76 112.24"/></svg></div>
		<div class="messages">{{{data.messages}}}</div>
		<div class="adding-to-cart--adding-cta">
			<button type="button" class="button continue-shopping"><?php _e( 'Continue shopping', 'product-configurator-for-woocommerce' ); ?></button>
			<span class="or"><?php _e( 'or', 'product-configurator-for-woocommerce' ); ?></span>
			<a href="<?php echo esc_url( $checkout_url ); ?>" class="button view-cart"><?php _e( 'Checkout', 'woocommerce' ); ?></a>
		</div>
		<?php do_action( 'tmpl-mkl-pc-atc-added' ); ?>
	</div>
</script>

<script type="text/html" id="tmpl-mkl-pc-atc-added-redirect" data-wg-notranslate> 
	<div class="adding-to-cart--added-with-redirection has-box">
		<?php do_action( 'tmpl-mkl-pc-atc-redirection-content' ); ?>
	</div>
</script>

<script type="text/html" id="tmpl-mkl-pc-atc-not-added" data-wg-notranslate> 
	<div class="adding-to-cart--not-added has-box">
		<div class="error messages">{{{data.messages}}}</div>
		<div class="adding-to-cart--adding-cta">
			<button class="button continue-shopping"><?php _e( 'Close', 'product-configurator-for-woocommerce' ); ?></button>
		</div>
	</div>
</script>