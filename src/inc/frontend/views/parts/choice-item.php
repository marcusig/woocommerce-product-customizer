<?php if (!defined('ABSPATH')) exit; ?>
<script type="text/html" id="tmpl-mkl-pc-configurator-choice-item" data-wg-notranslate> 
	<button
		type="button"
		id="choice_{{data.layerId}}_{{data._id}}"
		<# if ( data.parent ) { #>aria-labelledby="choice_{{data.layerId}}_{{data.parent}}"<# } #>
		<# if ( data.disable_selection ) { #>disabled<# } #>
		<?php do_action( 'tmpl-pc-configurator-choice-item-attributes' ); ?>
	>
		<?php do_action( 'tmpl-pc-configurator-choice-item' ); ?>
	</button>
	<?php do_action( 'tmpl-pc-configurator-choice-item--after' ); ?>
</script>

<script type="text/html" id="tmpl-mkl-pc-configurator-choice-group" data-wg-notranslate>
	<?php do_action( 'tmpl-pc-configurator-choice-group-item--before' ); ?>
	<# 
	
	var choice_setting = 'undefined' == typeof data.choice_groups_toggle ? 'inherit' : data.choice_groups_toggle;
	var use_button = ( PC_config.config.choice_groups_toggle && 'inherit' === data.choice_groups_toggle ) || 'enabled' === data.choice_groups_toggle;
	
	if ( use_button ) { #>
		<button class="choice-group-label" id="choice_{{data.layerId}}_{{data._id}}">
	<# } else { #>	
		<div class="choice-group-label" id="choice_{{data.layerId}}_{{data._id}}">
	<# } #>
			<?php do_action( 'tmpl-pc-configurator-choice-item' ); ?>
			<?php do_action( 'tmpl-pc-configurator-choice-item--after' ); ?>
	<# if ( use_button ) { #>
		</button>
	<# } else { #>	
		</div>
	<# } #>
	<ul class="choices-list--children" data-item-id="{{data._id}}"></ul>
	<?php do_action( 'tmpl-pc-configurator-choice-group-item--after' ); ?>
</script>