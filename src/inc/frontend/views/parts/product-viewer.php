<?php if (!defined('ABSPATH')) exit; ?>
<script type="text/html" id="tmpl-mkl-pc-configurator-viewer" data-wg-notranslate>
	<?php do_action( 'mkl_pc_layers_before' ); ?>
	<div class="mkl_pc_layers" role="figure" aria-label="<?php echo esc_attr_x ( 'Product live preview with layered images', 'Accessible label of the configurator viewer', 'product-configurator-for-woocommerce' ); ?>">
		<?php do_action( 'mkl_pc_layers' ); ?>
	</div>
	<?php do_action( 'mkl_pc_layers_after' ); ?>
</script>

<script type="text/html" id="tmpl-mkl-pc-configurator-angles-list">
	<a href="#" class="change-angle--trigger" role="button"><span><?php echo mkl_pc( 'settings' )->get_label( 'angle_switch_label', __( 'Change angle', 'product-configurator-for-woocommerce' ) ) ?></span></a>
	<ul>
		
	</ul>
</script>

<script type="text/html" id="tmpl-mkl-pc-configurator-angle-item" data-wg-notranslate>
	<a href="#" role="button"><# if ( PC.fe.config.angles.show_image && data.image && data.image.url ) { #><span class="angle-image"><img src="{{data.image.url}}" alt=""></span><# } #> <# if ( PC.fe.config.angles.show_name ) { #>{{data.name}}<# } #></a>
</script>

<script type="text/html" id="tmpl-mkl-pc-configurator-empty-viewer" data-wg-notranslate>
	<?php do_action( 'mkl_pc_templates_empty_viewer' ); ?> 
</script>
