<?php if (!defined('ABSPATH')) exit; ?>
<script type="text/html" id="tmpl-mkl-pc-configurator-choices" data-wg-notranslate>
	<li class="layer-choices-title">
		<span>{{data.name}} <a href="#" class="close choices-close"><span><?php _e( 'Close' ) ?></span></a></span>
		<# if ( data.description && PC.fe.config.show_layer_description_in_title ) { #><span class="description">{{{data.description}}}</span><# } #>
	</li>
	<li class="choices-list"><ul data-layer-id="{{data._id}}">
		
	</ul></li>
	<# if ( data.display_mode && 'full-screen' === data.display_mode ) { #>
		<li class="choices-list--footer">
			<button type="button" class="choices-close"><span><?php _e( 'Confirm selection and continue configuring the product', 'product-configurator-for-woocommerce' ) ?></span></button>
		</li>
	<# } #>
	<?php 
		/**
		 * Action mkl-pc-configurator-choices--after executed at the end of the choices list template
		 */
		do_action( 'mkl-pc-configurator-choices--after' ); 
	?>
</script>