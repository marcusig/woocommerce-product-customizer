(function($) {
	wp.hooks.addAction( 'PC.fe.start', 'MKL/PC/Themes/lapomme', function( view ) {

		if ( window.tippy ) {
			if ( view.$( '.reset-configuration' ).length ) {
				var reset_btn = view.$( '.reset-configuration' )
				var description = reset_btn.find( 'span' ).html();

				/**
				 * 
					 * Customization of the tooltip can be done by using TippyJS options: atomiks.github.io/tippyjs/v6/
					 */
				 var tooltip_options = {
					content: description,
					allowHTML: true,
					placement: 'top',
					zIndex: 100001
				};
			
				if ( tooltip_options.content && tooltip_options.content.length && reset_btn.length ) {
					tippy( reset_btn[0], tooltip_options );
				}	
			}

			if ( view.$( '.save-your-design' ).length ) {
				var syd_button = view.$( '.save-your-design' )
				var description = syd_button.find( 'span' ).html();

				/**
				 * 
					 * Customization of the tooltip can be done by using TippyJS options: atomiks.github.io/tippyjs/v6/
					 */
				 var tooltip_options = {
					content: description,
					allowHTML: true,
					placement: 'top',
					zIndex: 100001
				};
			
				if ( tooltip_options.content && tooltip_options.content.length && syd_button.length ) {
					tippy( syd_button[0], tooltip_options );
				}	
			}
		}
		
	});

	wp.hooks.addAction( 'PC.fe.open', 'MKL/PC/Themes/lapomme', function( view ) {
		// view.$el.removeClass( 'mobile-show-form' );
	}); 

	wp.hooks.addFilter( 'PC.fe.choices.where', 'MKL/PC/Themes/lapomme', function( where ) {
		return 'in';
	} );

	// wp.hooks.addAction( 'PC.fe.layer.activate', 'MKL/PC/Themes/lapomme', function( view ) {
	// 	if ( PC_config.config.no_toggle && 'dropdown' != view.model.get( 'display_mode' ) ) return;
	// 	view.$el.find( '.layer_choices' ).first().delay(40).slideDown( { step: function() {
	// 		if ( PC_config.config.auto_scroll ) view.el.offsetParent.scrollTo( 0, view.el.offsetTop );
	// 	} } );
	// } );

	// wp.hooks.addAction( 'PC.fe.layer.deactivate', 'MKL/PC/Themes/lapomme', function( view ) {
	// 	if ( PC_config.config.no_toggle && 'dropdown' != view.model.get( 'display_mode' ) ) return;
	// 	view.$el.find( '.layer_choices' ).first().slideUp(200);
	// } );

	// Conditional logic: do not show / hide choices list visibility
	wp.hooks.addFilter( 'mkl_pc_conditionals.toggle_choices', 'MKL/PC/Themes/lapomme', function( where ) {
		return false;
	} );
	
	wp.hooks.addFilter( 'mkl-pc-configurator-layer-item.with.button', 'MKL/PC/Themes/lapomme', function( use_button, data ) {
		if ( 'dropdown' == data.display_mode ) return true;
		return false;
			
	}, 20 );

	// Scroll to newly opened layer, when onening it using conditional logic
	wp.hooks.addAction( 'conditional.selected_layer', 'MKL/PC/Themes/float', function( model ) {
		var scrollToView = null;
		// _.each( PC.fe.modal.toolbar.layers.items, function( view ) {
		// 	if ( view.model.id == model.id ) {
		// 		scrollToView = view;
		// 	}
		// } );

		// if ( scrollToView ) {
		// 	setTimeout( function() {
		// 		scrollToView.el.offsetParent.scrollTo( 0, scrollToView.el.offsetTop );
		// 	}, 150 );
		// }
	} );

})( jQuery );