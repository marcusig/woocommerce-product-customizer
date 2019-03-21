<script type="text/html" id="tmpl-mkl-pc-customizer-toolbar">

		<header><h3>{{data.name}}</h3><button class="cancel close-mkl-pc" type="button"><span><?php _e( 'Cancel' ); ?></span></button></header>
		<section class="choices">
			
		</section>

</script>
<script type="text/html" id="tmpl-mkl-pc-customizer-footer">
		<?php do_action( 'mkl_pc_frontend_customizer_footer_form_before' ); ?>
		<div class="form">
		<?php do_action( 'mkl_pc_frontend_customizer_footer_form' ); ?>
		</div>
		<?php do_action( 'mkl_pc_frontend_customizer_footer_form_after' ); ?>
</script>