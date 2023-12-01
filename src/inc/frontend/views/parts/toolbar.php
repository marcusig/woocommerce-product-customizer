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

<script type="text/html" id="tmpl-mkl-pc-configurator-step--previous" data-wg-notranslate>
	<?php
		$classes = mkl_pc( 'settings' )->get_label( 'button_classes', 'primary button btn btn-primary' );
	?>
	<button type="button" class="step-previous <?php echo esc_attr( $classes ); ?>">
		<?php do_action( 'mkl_pc/previous_step/before' ); ?>
		<span><?php _e( 'Previous', 'product-configurator-for-woocommerce' ); ?></span>
		<?php do_action( 'mkl_pc/previous_step/after' ); ?>
	</button>
</script>

<script type="text/html" id="tmpl-mkl-pc-configurator-step--next" data-wg-notranslate>
	<?php
		$classes = mkl_pc( 'settings' )->get_label( 'button_classes', 'primary button btn btn-primary' );
	?>
	<button type="button" class="step-next <?php echo esc_attr( $classes ); ?>">
		<?php do_action( 'mkl_pc/next_step/before' ); ?>
		<span><?php _e( 'Next', 'product-configurator-for-woocommerce' ); ?></span>
		<?php do_action( 'mkl_pc/next_step/after' ); ?>
	</button>
</script>
