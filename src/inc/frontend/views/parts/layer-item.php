<?php if (!defined('ABSPATH')) exit; ?>
<script type="text/html" id="tmpl-mkl-pc-configurator-layer-item" data-wg-notranslate>
	<# 
	var use_button = ! data.hasOwnProperty( 'is_step' ) || ! data.is_step;
	if ( wp.hooks.applyFilters( 'mkl-pc-configurator-layer-item.with.button', use_button, data ) ) { #>
		<button class="layer-item" type="button" id="config-layer-{{data._id}}">
	<# } else { #>
		<span class="layer-item" id="config-layer-{{data._id}}">
	<# } #>
			<?php do_action( 'tmpl-mkl-pc-configurator-layer-item-button' ); ?>
	<# if ( wp.hooks.applyFilters( 'mkl-pc-configurator-layer-item.with.button', use_button, data ) ) { #>
		</button>
	<# } else { #>
		</span>
	<# } #>
</script>
