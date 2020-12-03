<?php
function mkl_pc_float_theme_scripts() {
	$data = "
	(function($) {
		var scrollStartPost;
		wp.hooks.addAction( 'PC.fe.start', 'MKL/PC/Themes/float', function( view ) {
			// duplicate the form to have a different one on mobile or desktop views
			var clone = view.footer.form.\$el.clone().appendTo( view.toolbar.\$el );
			view.footer.form_2 = new PC.fe.views.form( { el: clone } );

			view.\$el.on( 'click', '.mkl-pc-show-form', function(e) {
				view.\$el.toggleClass( 'mobile-show-form' );
			} );

			view.toolbar.\$el.find('section.choices').on('scroll', function(e) {
				var section = $( this );
				section.toggleClass( 'scrolled', ! ( e.target.scrollHeight - section.outerHeight() == section.scrollTop() ) );
			} );
			setTimeout(
				function() {
					view.toolbar.\$el.find('section.choices').trigger( 'scroll' );
				},
				500
			);
		}, 20 ); 

		wp.hooks.addAction( 'PC.fe.open', 'MKL/PC/Themes/float', function( view ) {
			view.\$el.removeClass( 'mobile-show-form' );
		} );

		wp.hooks.addFilter( 'PC.fe.choices.where', 'MKL/PC/Themes/float', function( where ) {
			return 'in';
		} );
		wp.hooks.addAction( 'PC.fe.layer.activate', 'MKL/PC/Themes/float', function( view ) {
			if ( PC.fe.inline ) {
				view.\$el.find( '.layer_choices' ).show();
				$(document).scrollTop(scrollStartPost);
			} else {
				view.\$el.find( '.layer_choices' ).delay(40).slideDown(200);
			}
				
		} );
		wp.hooks.addAction( 'PC.fe.layer.deactivate', 'MKL/PC/Themes/float', function( view ) {
			if ( PC.fe.inline ) {
				scrollStartPost = $(document).scrollTop();
				view.\$el.find( '.layer_choices' ).hide();
			} else {
				view.\$el.find( '.layer_choices' ).slideUp(200);
			}
		} );
	})( jQuery );
	";
	wp_add_inline_script( 'mkl_pc/js/views/configurator', $data, 'before' );
	wp_enqueue_script( 'jquery-ui-accordion' );
}
add_action( 'mkl_pc_scripts_product_page_after', 'mkl_pc_float_theme_scripts', 20 );

function mkl_pc_float_theme_choice_wrapper_open() {
	echo '<span class="choice-text">';
}
add_action( 'tmpl-pc-configurator-choice-item', 'mkl_pc_float_theme_choice_wrapper_open', 6 );

function mkl_pc_float_theme_choice_wrapper_close() {
	echo '</span>';
}
add_action( 'tmpl-pc-configurator-choice-item', 'mkl_pc_float_theme_choice_wrapper_close', 160 );

function mkl_pc_float_theme_remove_title() {
	remove_action( 'mkl_pc_frontend_configurator_footer_section_left_inner', 'mkl_pc_frontend_configurator_footer_section_left_inner__product_name', 30 );
}
add_action( 'mkl_pc_frontend_templates_before', 'mkl_pc_float_theme_remove_title', 20 );

function mkl_pc_float_theme_add_mobile_form_button() {
	echo '<button class="mkl-pc-show-form">' . mkl_pc( 'frontend' )->product->get_cart_icon() .'<span class="screen-reader-text">' . __( 'Add to cart', 'woocommerce' ) . '</span></button>';
}
add_action( 'mkl_pc_frontend_configurator_footer_form_before', 'mkl_pc_float_theme_add_mobile_form_button', 20 );
