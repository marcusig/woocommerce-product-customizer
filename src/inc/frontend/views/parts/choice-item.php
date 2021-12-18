<?php if (!defined('ABSPATH')) exit; ?>
<script type="text/html" id="tmpl-mkl-pc-configurator-choice-item" data-wg-notranslate> 
	<button
		type="button"
		<# if ( data.disable_selection ) { #>disabled<# } #>
		<?php do_action( 'tmpl-pc-configurator-choice-item-attributes' ); ?>
	>
		<?php do_action( 'tmpl-pc-configurator-choice-item' ); ?>
	</button>
	<?php do_action( 'tmpl-pc-configurator-choice-item--after' ); ?>
</script>

<script type="text/html" id="tmpl-mkl-pc-configurator-choice-group" data-wg-notranslate>
	<div class="choice-group-label">
	<?php do_action( 'tmpl-pc-configurator-choice-item' ); ?>
	<?php do_action( 'tmpl-pc-configurator-choice-item--after' ); ?>
	</div>
	<ul class="choices-list--children" data-item-id="{{data._id}}"></ul>
</script>