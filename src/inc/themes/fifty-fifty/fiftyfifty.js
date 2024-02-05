(function($) {
	wp.hooks.addAction( 'PC.fe.start', 'MKL/PC/Themes/fiftyfifty', function( view ) {

		view.$el.addClass( 'fiftyfifty' );
		// Move header (product name and close button) to viewer
		view.toolbar.$( 'header' ).appendTo( view.viewer.$el );
		view.footer.form.$el.insertAfter( view.toolbar.$selection );
		view.footer.$el.appendTo( view.viewer.$el );
		view.footer.$( '.footer__section-right' ).append( view.viewer.$( '.angles-select' ) );

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

		view.$main_window.on( 'scroll', function( e ) {
			// console.log( 'scroll', e.target.scrollTop, $( e.target ).offset().top );
			// console.log( $( 'ul[data-layer-id="2"' ).offset().top - $( e.target ).offset().top );
		} );
	}, 30);

	wp.hooks.addAction( 'PC.fe.open', 'MKL/PC/Themes/fiftyfifty', function( view ) {
		// view.$el.removeClass( 'mobile-show-form' );
	}); 

	wp.hooks.addFilter( 'PC.fe.choices.where', 'MKL/PC/Themes/fiftyfifty', function( where ) {
		return 'in';
	} );

	wp.hooks.addAction( 'PC.fe.layer.render', 'MKL/PC/Themes/fiftyfifty', function( layer ) {
		
	} );

	// wp.hooks.addAction( 'PC.fe.layer.activate', 'MKL/PC/Themes/fiftyfifty', function( view ) {
	// 	if ( PC_config.config.no_toggle && 'dropdown' != view.model.get( 'display_mode' ) ) return;
	// 	view.$el.find( '.layer_choices' ).first().delay(40).slideDown( { step: function() {
	// 		if ( PC_config.config.auto_scroll ) view.el.offsetParent.scrollTo( 0, view.el.offsetTop );
	// 	} } );
	// } );

	// wp.hooks.addAction( 'PC.fe.layer.deactivate', 'MKL/PC/Themes/fiftyfifty', function( view ) {
	// 	if ( PC_config.config.no_toggle && 'dropdown' != view.model.get( 'display_mode' ) ) return;
	// 	view.$el.find( '.layer_choices' ).first().slideUp(200);
	// } );

	// Conditional logic: do not show / hide choices list visibility
	wp.hooks.addFilter( 'mkl_pc_conditionals.toggle_choices', 'MKL/PC/Themes/fiftyfifty', function( where ) {
		return false;
	} );
	
	wp.hooks.addFilter( 'mkl-pc-configurator-layer-item.with.button', 'MKL/PC/Themes/fiftyfifty', function( use_button, data ) {
		if ( 'dropdown' == data.display_mode ) return true;
		return false;
	}, 20 );

	wp.hooks.addFilter( 'PC.fe.steps_position', 'MKL/PC/Themes/fiftyfifty', function( position, $nav ) {
		$nav.insertAfter( PC.fe.modal.footer.$( '.price-container' ) );
		return PC.fe.modal.toolbar.$el;
	} );

	// Scroll to newly opened layer, when onening it using conditional logic
	wp.hooks.addAction( 'conditional.selected_layer', 'MKL/PC/Themes/fiftyfifty', function( model ) {
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
	wp.hooks.addAction( 'PC.fe.steps.display_step', 'MKL/PC/Themes/fiftyfifty', function( steps ) {
		var scrollable = PC.fe.modal.$( '.mkl_pc_container' );
		if ( scrollable.length ) scrollable[0].scrollTo( 0, 0 );
	} );
	
})( jQuery );