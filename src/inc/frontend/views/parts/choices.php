<?php if (!defined('ABSPATH')) exit; ?>
<script type="text/html" id="tmpl-mkl-pc-configurator-choices" data-wg-notranslate>
	<li class="layer-choices-title">
		<span>{{data.name}} <a role="button" href="#" class="close choices-close"><span class="screen-reader-text"><?php esc_html_e( 'Close the choices list', 'product-configurator-for-woocommerce' ) ?></span></a></span>
		<# if ( data.description && PC.fe.config.show_layer_description_in_title ) { #><span class="description">{{{data.description}}}</span><# } #>
	</li>
	<li class="choices-list"><ul data-layer-id="{{data._id}}">
		
	</ul></li>
	<?php 
		/**
		 * Action mkl-pc-configurator-choices--after executed at the end of the choices list template
		 */
		do_action( 'mkl-pc-configurator-choices--after' ); 
	?>
</script>