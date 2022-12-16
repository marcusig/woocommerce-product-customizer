<div class="configurator-data">
	<h4><?php _e('Configurator Data:', 'product-configurator-for-woocommerce') ?></h4>
	<ul>
	<?php 
	foreach( $data as $layer ) { 
		
		if( is_object($layer) ){
			if( $layer->is_choice() ) :
			?>
			<li><strong><?php echo $layer->get_layer('name') ?></strong>:
				<?php echo $layer->get_choice( 'name' ) ?>
				<?php do_action( 'mkl_pc_admin_order_item', $layer ); ?>
			</li>
			<?php		
			endif;
		} 
	}
	?>
	</ul>
</div>