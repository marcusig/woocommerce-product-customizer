<?php
	if (!defined('ABSPATH')) exit;
	
	function mkl_pc_frontend_configurator_summary__header() { ?>
		<header>
			<h3><?php _e( 'Summary', 'product-configurator-for-woocommerce' ); ?></h3>
		</header>
	<?php }
	add_action( 'mkl_pc_frontend_configurator_summary', 'mkl_pc_frontend_configurator_summary__header', 20 );

	function mkl_pc_frontend_configurator_summary__content() { ?>
		<div class="mkl-pc-summary--content">
			<?php do_action( 'mkl_pc_frontend_configurator_summary__content' ); ?>
		</div>
	<?php }
	add_action( 'mkl_pc_frontend_configurator_summary', 'mkl_pc_frontend_configurator_summary__content', 40 );

?>
<script type="text/html" id="tmpl-mkl-pc-configurator-summary" data-wg-notranslate>
	<?php do_action( 'mkl_pc_frontend_configurator_summary' ); ?>
</script>

<script type="text/html" id="tmpl-mkl-pc-configurator-summary--item" data-wg-notranslate>
	<span class="summary-item--name">
		<# if ( data.parent_name ) { #> <span class="summary-item--parent-name">{{{data.parent_name}}},</span> <# } #>
		<span class="summary-item--choice-name">{{{data.name}}}</span>
		<# if ( data.summary_after_name ) { #>{{{data.summary_after_name}}}</span><# } #>
	</span>
</script>

<script type="text/html" id="tmpl-mkl-pc-configurator-summary--item-group" data-wg-notranslate>
	<h5>{{{data.name}}}</h5>
</script>
