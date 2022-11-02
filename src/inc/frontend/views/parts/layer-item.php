<?php if (!defined('ABSPATH')) exit; ?>
<script type="text/html" id="tmpl-mkl-pc-configurator-layer-item" data-wg-notranslate>
	<# if ( wp.hooks.applyFilters( 'mkl-pc-configurator-layer-item.with.button', true, data ) ) { #>
		<button class="layer-item" type="button">
	<# } else { #>
		<span class="layer-item">
	<# } #>
			<?php do_action( 'tmpl-mkl-pc-configurator-layer-item-button' ); ?>
	<# if ( wp.hooks.applyFilters( 'mkl-pc-configurator-layer-item.with.button', true, data ) ) { #>
		</button>
	<# } else { #>
		</span>
	<# } #>
</script>