<?php if (!defined('ABSPATH')) exit; ?>
<script type="text/html" id="tmpl-mkl-pc-configurator-viewer">
	<div class="mkl_pc_layers">
	</div>
</script>

<script type="text/html" id="tmpl-mkl-pc-configurator-angles-list">
	<a href="#" class="change-angle--trigger"><span><?php _e( 'Change angle', 'product-configurator-for-woocommerce' ) ?></span></a>
	<ul>
		
	</ul>
</script>

<script type="text/html" id="tmpl-mkl-pc-configurator-angle-item">
	<a href="#"><# if ( PC.fe.config.angles.show_image && data.image && data.image.url ) { #><span class="angle-image"><img src="{{data.image.url}}" alt=""></span><# } #> <# if ( PC.fe.config.angles.show_name ) { #>{{data.name}}<# } #></a>
</script>

<script type="text/html" id="tmpl-mkl-pc-configurator-empty-viewer">
	<?php do_action( 'mkl_pc_templates_empty_viewer' ); ?> 
</script>
