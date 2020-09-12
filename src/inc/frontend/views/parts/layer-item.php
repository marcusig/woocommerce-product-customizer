<?php if (!defined('ABSPATH')) exit; ?>
<script type="text/html" id="tmpl-mkl-pc-configurator-layer-item">
	<button class="layer-item" type="button"><i class="img"><# if(data.image.url) { #><img src="{{data.image.url}}" alt="img_{{data.image.id}}" /><# } #></i> {{data.name}}</button>
</script>
