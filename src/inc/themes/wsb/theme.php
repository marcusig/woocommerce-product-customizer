<?php
function mkl_pc_wsb_theme_scripts() {
	$data = "
	(function($) {
		wp.hooks.addAction( 'PC.fe.start', 'MKL/PC/Themes/wsb', function( view ) {
			// duplicate the form to have a different one on mobile or desktop views
			var clone = view.footer.form.\$el.clone().appendTo( view.toolbar.\$el );
			view.footer.form_2 = new PC.fe.views.form( { el: clone } );
			view.\$el.addClass( 'wsb' );
			if ( PC_config.config.no_toggle ) view.\$el.addClass( 'no-toggle' );
			view.\$el.on( 'click', '.mkl-pc-show-form', function(e) {
				view.\$el.toggleClass( 'mobile-show-form' );
			});
		});

		wp.hooks.addAction( 'PC.fe.open', 'MKL/PC/Themes/wsb', function( view ) {
			view.\$el.removeClass( 'mobile-show-form' );
		}); 

		wp.hooks.addFilter( 'PC.fe.choices.where', 'MKL/PC/Themes/wsb', function( where ) {
			return 'in';
		} );
		wp.hooks.addAction( 'PC.fe.layer.activate', 'MKL/PC/Themes/wsb', function( view ) {
			if ( PC_config.config.no_toggle && 'dropdown' != view.model.get( 'display_mode' ) ) return;
			view.\$el.find( '.layer_choices' ).slideDown(200);
		} );
		wp.hooks.addAction( 'PC.fe.layer.deactivate', 'MKL/PC/Themes/wsb', function( view ) {
			if ( PC_config.config.no_toggle && 'dropdown' != view.model.get( 'display_mode' ) ) return;
			view.\$el.find( '.layer_choices' ).slideUp(200);
		} );

		// Conditional logic: do not show / hide choices list visibility
		wp.hooks.addFilter( 'mkl_pc_conditionals.toggle_choices', 'MKL/PC/Themes/wsb', function( where ) {
			return false;
		} );

	})( jQuery );
	";
	wp_add_inline_script( 'mkl_pc/js/views/configurator', $data, 'before' );
}
add_action( 'mkl_pc_scripts_product_page_after', 'mkl_pc_wsb_theme_scripts', 20 );

function mkl_pc_wsb_theme_choice_wrapper_open() {
	echo '<span class="choice-text">';
}
add_action( 'tmpl-pc-configurator-choice-item', 'mkl_pc_wsb_theme_choice_wrapper_open', 6 );

function mkl_pc_wsb_theme_add_mobile_form_button() {
	$span_classes = apply_filters( 'mkl_pc/show_add_to_cart_button/classes', '' );
	echo '<button class="mkl-pc-show-form">' . mkl_pc( 'frontend' )->product->get_cart_icon() .'<span class="' . $span_classes . '">' . apply_filters( 'mkl_pc/add_to_cart_button/default_label', __( 'Add to cart', 'woocommerce' ) ) . '</span></button>';
}
add_action( 'mkl_pc_frontend_configurator_footer_form_before', 'mkl_pc_wsb_theme_add_mobile_form_button', 20 );

function mkl_pc_wsb_theme_choice_wrapper_close() {
	echo '</span>';
}
add_action( 'tmpl-pc-configurator-choice-item', 'mkl_pc_wsb_theme_choice_wrapper_close', 160 );

function mkl_pc_wsb_theme_remove_title() {
	remove_action( 'mkl_pc_frontend_configurator_footer_section_left_inner', 'mkl_pc_frontend_configurator_footer_section_left_inner__product_name', 30 );
}
add_action( 'mkl_pc_frontend_templates_before', 'mkl_pc_wsb_theme_remove_title', 20 );

function mkl_pc_wsb_theme_filter_colors( $colors ) {
	$remove = [ 'active_layer_button_bg_color', 'active_layer_button_text_color', 'active_choice_button_bg_color', 'active_choice_button_text_color' ];
	foreach( $remove as  $r ) {
		if ( isset( $colors[ $r ] ) ) unset( $colors[ $r ] );
	}
	$colors['toolbar_bg'] = [
		'default' => '#FFF',
		'label' => __( 'Sidebar background', 'product-configurator-for-woocommerce' )
	];

	return $colors;
}
add_filter( 'mkl_pc_theme_color_settings', 'mkl_pc_wsb_theme_filter_colors' );
