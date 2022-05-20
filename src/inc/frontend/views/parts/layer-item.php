<?php if (!defined('ABSPATH')) exit; ?>

<script type="text/html" id="tmpl-mkl-pc-configurator-layer-item" data-wg-notranslate>
	<# if ( wp.hooks.applyFilters( 'mkl-pc-configurator-layer-item.with.button', true, data ) ) { #>
		<button class="layer-item" type="button">
	<# } else { #>
		<span class="layer-item" type="button">
	<# } #>
			<?php do_action( 'tmpl-mkl-pc-configurator-layer-item-button' ); ?>
	<# if ( wp.hooks.applyFilters( 'mkl-pc-configurator-layer-item.with.button', true, data ) ) { #>
		</button>
	<# } else { #>
		</span>
	<# } #>
</script>

<script type="text/html" id="tmpl-mkl-pc-configurator-layer-group" data-wg-notranslate>
	<button class="layer-item" type="button"><div class="layer-group-label">
		<?php do_action( 'tmpl-mkl-pc-configurator-layer-item-button' ); ?>
	</button>
	<ul class="layers-list--children" data-item-id="{{data._id}}"></ul>
</script>

<script type="text/html" id="tmpl-mkl-pc-configurator-layer-item-description-modal" data-wg-notranslate>
	<button type="button" class="close close-description"><?php _e( 'Close', 'product-configurator-for-woocommerce' ); ?></button>
	<div class="mkl-description">
		{{{data.description}}}
	</div>
</script>

<div style="display: none;"><svg style="display: none;" id="mkl-info-icon-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 513 513"><defs><path id="mkl-info-icon" d="M256,0C114.62,0,0,114.62,0,256S114.62,512,256,512,512,397.38,512,256,397.38,0,256,0Zm37.21,415.71a10.05,10.05,0,0,1-10.06,10.05H230.44a10.05,10.05,0,0,1-10.05-10.05V199.88a10.05,10.05,0,0,1,10.05-10h52.71a10.05,10.05,0,0,1,10.06,10Zm-6.56-270.3a42.24,42.24,0,0,1-72.09-29.86A42.22,42.22,0,0,1,286.65,85.7,40.64,40.64,0,0,1,299,115.55,40.68,40.68,0,0,1,286.65,145.41Z" transform="translate(0.5 0.5)"/></defs></svg></div>
