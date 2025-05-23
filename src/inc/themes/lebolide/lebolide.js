(function($) {
	wp.hooks.addAction( 'PC.fe.start', 'MKL/PC/Themes/lebolide', function( view ) {

		view.$el.addClass( 'lebolide' );
		// Move header (product name and close button) to viewer
		view.toolbar.$( 'header' ).appendTo( view.viewer.$el );
		view.footer.form.$el.insertAfter( view.toolbar.$selection );
		view.footer.$el.appendTo( view.viewer.$el );
		view.footer.$( '.footer__section-right' ).append( view.viewer.$( '.angles-select' ) );

		if ( window.tippy ) {

			var btns = view.$( '.reset-configuration, .save-your-design, .save-your-design--pdf, .share-your-design' );
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

		// view.$main_window.on( 'scroll', function( e ) {
			// console.log( 'scroll', e.target.scrollTop, $( e.target ).offset().top );
			// console.log( $( 'ul[data-layer-id="2"' ).offset().top - $( e.target ).offset().top );
		// } );
	}, 30);

	/* Share your design */
	wp.hooks.addAction( 'PC.fe.syd.share.modal.init', 'MKL/PC/Themes/lebolide', function( view ) {
		if ( PC.utils._isMobile() && PC.fe.modal.$el.outerWidth() <= 720 ) {
			view.$el.appendTo( PC.fe.modal.$main_window );
			view.insertTarget = PC.fe.modal.$main_window;
			const close_btn = $( '<a href="#" title="Close" class="syd-share-close"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false"><path d="m13.06 12 6.47-6.47-1.06-1.06L12 10.94 5.53 4.47 4.47 5.53 10.94 12l-6.47 6.47 1.06 1.06L12 13.06l6.47 6.47 1.06-1.06L13.06 12Z"></path></svg></a>' );
			close_btn.on( 'click', function( e ) {
				e.preventDefault();
				view.close();
			} );
			view.$( '.mkl-pc-modal' ).append( close_btn );
		}
	} );

	/* Save your design */
	wp.hooks.addAction( 'PC.fe.syd.modal.init', 'MKL/PC/Themes/lebolide', function( view ) {
		if ( PC.utils._isMobile() && PC.fe.modal.$el.outerWidth() <= 720 ) {
			view.$el.appendTo( PC.fe.modal.$main_window );
			view.insertTarget = PC.fe.modal.$main_window;
		}
	} );

	wp.hooks.addFilter( 'PC.fe.choices.where', 'MKL/PC/Themes/lebolide', function( where ) {
		return 'in';
	} );

	wp.hooks.addAction( 'PC.fe.layer.render', 'MKL/PC/Themes/lebolide', function( layer ) {
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

	wp.hooks.addAction( 'PC.fe.layer.activate', 'MKL/PC/Themes/lebolide', function( view ) {
		if ( view.popper ) view.popper.update();
	} );

	wp.hooks.addAction( 'PC.fe.layer.deactivate', 'MKL/PC/Themes/lebolide', function( view ) {
		if ( view.popper ) view.popper.update();
	} );

	// Conditional logic: do not show / hide choices list visibility
	wp.hooks.addFilter( 'mkl_pc_conditionals.toggle_choices', 'MKL/PC/Themes/lebolide', function( where ) {
		return false;
	} );
	
	wp.hooks.addFilter( 'mkl-pc-configurator-layer-item.with.button', 'MKL/PC/Themes/lebolide', function( use_button, data ) {
		if ( 'dropdown' == data.display_mode ) return true;
		return false;
	}, 20 );

	wp.hooks.addFilter( 'PC.fe.steps_position', 'MKL/PC/Themes/lebolide', function( position, $nav ) {
		$nav.insertAfter( PC.fe.modal.footer.$( '.price-container' ) );
		return PC.fe.modal.toolbar.$el;
	} );

	// Scroll to newly opened layer, when onening it using conditional logic
	wp.hooks.addAction( 'conditional.selected_layer', 'MKL/PC/Themes/lebolide', function( model ) {
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
	wp.hooks.addAction( 'PC.fe.steps.display_step', 'MKL/PC/Themes/lebolide', function( steps ) {
		// On mobile, the toolbar is scrollable
		var scrollable = PC.fe.modal.$( '.mkl_pc_toolbar' );
		if ( scrollable.length && scrollable[0].scrollHeight != scrollable[0].clientHeight ) {
			scrollable[0].scrollTo( 0, 0 );
			return;
		} 

		// On desktop, the whole container is scrollable
		scrollable = PC.fe.modal.$( '.mkl_pc_container' );
		if ( scrollable.length && scrollable[0].scrollHeight != scrollable[0].clientHeight ) {
			scrollable[0].scrollTo( 0, 0 );
			return;
		} 
		
		// inline configurator
		document.scrollingElement.scrollTop = PC.fe.modal.$( '.mkl_pc_toolbar' ).offset().top;
	} );
	
})( jQuery );