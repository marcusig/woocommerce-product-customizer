<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly.
}
?>
<div class="configurator-data">
	<h4><?php esc_html_e( 'Configurator Data:', 'product-configurator-for-woocommerce' ); ?></h4>
	<ul>
	<?php 
	foreach( $data as $layer ) { 
		
		if( is_object($layer) ){
			if( $layer->is_choice() ) :
			?>
			<li><strong><?php echo esc_html( $layer->get_layer( 'name' ) ); ?></strong>:
				<?php echo \MKL\PC\Utils::kses_basic_inline_html( $layer->get_choice( 'name' ) ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Output is sanitized via wp_kses allowlist. ?>
				<?php do_action( 'mkl_pc_admin_order_item', $layer ); ?>
			</li>
			<?php		
			endif;
		} 
	}
	?>
	</ul>
</div>