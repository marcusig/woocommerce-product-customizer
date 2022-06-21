<?php if (!defined('ABSPATH')) exit; ?>
<script type="text/html" id="tmpl-mkl-pc-configurator-toolbar" data-wg-notranslate>
	<?php do_action( 'mkl_pc_frontend_configurator_toolbar' ); ?>
</script>
<script type="text/html" id="tmpl-mkl-pc-configurator-footer" data-wg-notranslate>
	<?php do_action( 'mkl_pc_frontend_configurator_footer_section_left_before' ); ?>
	<div class="footer__section-left"><?php 
		do_action( 'mkl_pc_frontend_configurator_footer_section_left_inner_before' );
		do_action( 'mkl_pc_frontend_configurator_footer_section_left_inner' );
		do_action( 'mkl_pc_frontend_configurator_footer_section_left_inner_after' );
	?></div>	
	<?php do_action( 'mkl_pc_frontend_configurator_footer_section_right_before' ); ?>
	<div class="footer__section-right">
		<?php do_action( 'mkl_pc_frontend_configurator_footer_form_before' ); ?>
		<div class="form form-cart">
		<?php do_action( 'mkl_pc_frontend_configurator_footer_form' ); ?>
		</div>
		<?php do_action( 'mkl_pc_frontend_configurator_footer_form_after' ); ?>
	</div>
	<?php do_action( 'mkl_pc_frontend_configurator_footer_after' ); ?>
</script>