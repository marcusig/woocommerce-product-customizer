<?php if (!defined('ABSPATH')) exit; ?>
<script type="text/html" id="tmpl-mkl-pc-configurator-choice-item"> 
	<button
		type="button"
		<# if (!data.available) { #>disabled<# } #>
		<?php do_action( 'tmpl-pc-configurator-choice-item-attributes' ); ?>
	>
		<?php do_action( 'tmpl-pc-configurator-choice-item' ); ?>
	</button>
	<?php do_action( 'tmpl-pc-configurator-choice-item--after' ); ?>
</script>