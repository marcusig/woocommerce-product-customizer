<?php if (!defined('ABSPATH')) exit; ?>
<script type="text/html" id="tmpl-mkl-pc-configurator-choices" data-wg-notranslate>
	<li class="layer-choices-title">
		<span>{{data.name}} <a href="#" class="close"><span><?php _e('Close') ?></span></a></span>
		<# if ( data.description && PC.fe.config.show_layer_description_in_title ) { #><span class="description">{{{data.description}}}</span><# } #>
	</li>
	<li class="choices-list"><ul data-layer-id="{{data._id}}">
		
	</ul></li>
</script>