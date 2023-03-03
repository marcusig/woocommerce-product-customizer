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
<style>
.mkl_pc_summary {
    position: absolute;
    top: 0;
    bottom: 0;
    overflow: auto;
    width: 320px;
    z-index: 10;
	padding: 20px;
}
.mkl_pc_summary_item_group h5 {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 500;
}
.mkl_pc_summary_item_group.group + .group {
    border-top: 1px solid #CCC;
    margin-top: 10px;
    padding-top: 10px;
}

.mkl_pc_summary_item {
    display: flex;
    justify-content: space-between;
}

</style>
<script type="text/html" id="tmpl-mkl-pc-configurator-summary" data-wg-notranslate>
	<?php do_action( 'mkl_pc_frontend_configurator_summary' ); ?>
</script>

<script type="text/html" id="tmpl-mkl-pc-configurator-summary--item" data-wg-notranslate>
	<span class="summary-item--name">{{{data.name}}}</span>
</script>

<script type="text/html" id="tmpl-mkl-pc-configurator-summary--item-group" data-wg-notranslate>
	<h5>{{{data.name}}}</h5>
</script>
