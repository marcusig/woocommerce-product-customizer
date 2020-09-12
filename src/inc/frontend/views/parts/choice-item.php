<?php if (!defined('ABSPATH')) exit; ?>
<script type="text/html" id="tmpl-mkl-pc-configurator-choice-item"> 
	<button class="choice-item" type="button"><# if(data.thumbnail) { #><i class="mkl-pc-thumbnail"><span><img src="{{data.thumbnail}}" alt="" /></span></i><# } #> <span class="text"><?php echo apply_filters( 'tmpl-pc-configurator-choice-item-label', '{{data.name}}' ) ?></span></button>
</script>