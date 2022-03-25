<?php if (!defined('ABSPATH')) exit; ?>
<script type="text/html" id="tmpl-mkl-pc-configurator-layer-item" data-wg-notranslate>
	<button class="layer-item" type="button">
		<?php do_action( 'tmpl-mkl-pc-configurator-layer-item-button' ); ?>
	</button>
</script>

<script type="text/html" id="tmpl-mkl-pc-configurator-layer-group" data-wg-notranslate>
	<button class="layer-item" type="button"><div class="layer-group-label">
		<?php do_action( 'tmpl-mkl-pc-configurator-layer-item-button' ); ?>
	</button>
	<ul class="layers-list--children" data-item-id="{{data._id}}"></ul>
</script>
