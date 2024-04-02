(function($) {
	wp.hooks.addAction( 'PC.fe.start', 'MKL/PC/Themes/lapomme', function( view ) {

		view.$el.addClass( 'lapomme' );
		
		if ( window.tippy ) {

			var btns = view.$( '.reset-configuration, .save-your-design, .save-your-design--pdf' );
			btns.each( function( index, btn ) {
				/**
				 * 
				 * Customization of the tooltip can be done by using TippyJS options: atomiks.github.io/tippyjs/v6/
				 */
				var tooltip_options = {
					content: $( btn ).find( 'span' ).html(),
					allowHTML: true,
					placement: 'top',
					zIndex: 100001
				};
			
				if ( tooltip_options.content && tooltip_options.content.length ) {
					$( btn ).addClass( 'icon-only' );
					tippy( btn, tooltip_options );
				}
			} );

		}

		// Move SYD on small screen
		if ( view.el.clientWidth <= 660 ) {
			var syd = PC.fe.modal.$( '.save-your-design-modal-container' );
			if ( syd.length ) syd.prependTo( view.$( '.footer__section-center' ) );
		}
		
	});

	wp.hooks.addAction( 'PC.fe.open', 'MKL/PC/Themes/lapomme', function( view ) {
		// view.$el.removeClass( 'mobile-show-form' );
	}); 

	wp.hooks.addFilter( 'PC.fe.choices.where', 'MKL/PC/Themes/lapomme', function( where ) {
		return 'in';
	} );

	wp.hooks.addAction( 'PC.fe.layer.render', 'MKL/PC/Themes/lapomme', function( layer ) {
		if ( 'dropdown' == layer.model.get( 'display_mode' ) && window.Popper ) {
			layer.popper = Popper.createPopper( 
				layer.$( '> button.layer-item' )[0], 
				layer.$( '> .layer_choices' )[0], 
				{
					placement: 'bottom',
					modifiers: [
						{
							name: 'eventListeners',
							options: {
							scroll: true,
							resize: true
							},
						},
						{
							name: 'flip',
							options: {
							fallbackPlacements: [ 'top' ]
							}
						}
					]
				}
			);
		}
	} );

	wp.hooks.addAction( 'PC.fe.layer.activate', 'MKL/PC/Themes/lapomme', function( view ) {
		if ( view.popper ) view.popper.update();
	} );

	wp.hooks.addAction( 'PC.fe.layer.deactivate', 'MKL/PC/Themes/lapomme', function( view ) {
		if ( view.popper ) view.popper.update();
	} );

	// Conditional logic: do not show / hide choices list visibility
	wp.hooks.addFilter( 'mkl_pc_conditionals.toggle_choices', 'MKL/PC/Themes/lapomme', function( where ) {
		return false;
	} );
	
	wp.hooks.addFilter( 'mkl-pc-configurator-layer-item.with.button', 'MKL/PC/Themes/lapomme', function( use_button, data ) {
		if ( 'dropdown' == data.display_mode ) return true;
		return false;
	}, 20 );

	wp.hooks.addFilter( 'PC.fe.steps_position', 'MKL/PC/Themes/lapomme', function( position, $nav ) {
		$nav.insertAfter( PC.fe.modal.footer.$( '.price-container' ) );
		return PC.fe.modal.toolbar.$el;
	} );

	// Scroll to newly opened layer, when onening it using conditional logic
	wp.hooks.addAction( 'conditional.selected_layer', 'MKL/PC/Themes/lapomme', function( model ) {
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

	/**
	 * Display step: scroll back to the top
	 */
	wp.hooks.addAction( 'PC.fe.steps.display_step', 'MKL/PC/Themes/lapomme', function( steps ) {
		var scrollable = PC.fe.modal.$( '.mkl_pc_container' );
		if ( scrollable.length && scrollable[0].scrollHeight == scrollable[0].clientHeight ) {
			scrollable[0].scrollTo( 0, 0 );
		} else {
			document.scrollingElement.scrollTop = PC.fe.modal.$( '.mkl_pc_toolbar' ).offset().top;
		}
	} );
	

})( jQuery );