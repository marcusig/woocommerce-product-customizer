(function($) {
	if ( ! wp || ! wp.hooks ) return;
	var scrollStartPost;
	wp.hooks.addAction( 'PC.fe.start', 'MKL/PC/Themes/H', function( view ) {
		// duplicate the form to have a different one on mobile or desktop views
		var clone = view.footer.form.$el.clone().appendTo( view.toolbar.$el );
		view.footer.form_2 = new PC.fe.views.form( { el: clone } );
		
		view.toolbar.$( 'button.cancel.close-mkl-pc' ).appendTo( view.$el );

		view.$( '.mkl-pc-show-form span.screen-reader-text' ).removeClass( 'screen-reader-text' );
		
		view.$el.on( 'click', '.mkl-pc-show-form', function(e) {
			view.$el.toggleClass( 'mobile-show-form' );
		} );

		$( '.pc_configurator_form .configurator-add-to-cart' ).append( $( '.mkl_pc_toolbar .pc-total-price' ) );
		
		if ( view.$( '.pc_configurator_form input.qty' ).length ) {
			view.$( '.pc_configurator_form' ).addClass( 'has-qty' );
		}

		view.$( '.layer-choices-title' ).each( function( ind, item ) {
			$( item ).find( '.close' ).appendTo( $( item ) );
		} );

		view.$( '.layers' ).wrap( '<div class="layers-wrapper"></div>' );
		view.$el.addClass( pc_h_config.color_mode );
		view.$el.addClass( 'h' );

	}, 20 ); 


	wp.hooks.addAction( 'PC.fe.open', 'MKL/PC/Themes/H', function( view ) {
		view.$el.removeClass( 'mobile-show-form' );
		view.$('.choices-list').each(function ( index, element ) {
			// new SimpleBar( element, {
			// 	autoHide: false
			// } );
		});
		setTimeout( resize_layer_choices, 200 );
	} );

	wp.hooks.addFilter( 'PC.fe.choices.where', 'MKL/PC/Themes/H', function( where ) {
		return 'out';
	} );

	wp.hooks.addAction( 'PC.fe.layer.activate', 'MKL/PC/Themes/H', function( view ) {
		if ( view.model.get( 'parent' ) && view.$el.closest( '.layer_choices' ).length ) {
			// var parent = view.$el.closest( '.layer_choices' );
			// $( '.mkl_pc ul[data-layer-id="' + view.model.id + '"]').css( 'padding-bottom', parent.outerHeight() );
			view.$el.siblings( '.active' ).find( 'button' ).first().trigger( 'click' );
			$( '.mkl_pc ul[data-layer-id="' + view.model.get( 'parent' ) + '"]' ).closest( '.layer_choices' ).addClass( 'temp-hide' );
		}

		resize_layer_choices();
			
	} );
	wp.hooks.addAction( 'PC.fe.layer.deactivate', 'MKL/PC/Themes/H', function( view ) {
		// if ( PC.fe.inline ) {
		// 	scrollStartPost = $(document).scrollTop();
		// 	view.$el.find( '.layer_choices' ).hide();
		// } else {
		// 	view.$el.find( '.layer_choices' ).slideUp(200);
		// }
		if ( view.model.get( 'parent' ) ) {
			var container = $( '.mkl_pc ul[data-layer-id="' + view.model.get( 'parent' ) + '"]' ).closest( '.layer_choices' );
			container.removeClass( 'temp-hide' );
		}
	} );

	// Conditional logic: do not show / hide choices list visibility
	wp.hooks.addFilter( 'mkl_pc_conditionals.toggle_choices', 'MKL/PC/Themes/H', function( where ) {
		return false;
	} );

	/**
	 * Move Tippy element in body, instead of parent which is cropped
	*/
	wp.hooks.addFilter( 'PC.fe.tooltip.options', 'MKL/PC/Themes/H', function( options ) {
		options.appendTo = () => document.body;
		return options;
	} );

	var resize_layer_choices = function( resized ) {
		var cow = $( '.mkl_pc.opened .mkl_pc_container' ).outerWidth();
		var choice_el_width = pc_h_config.choice_width || 220;
		var layer_el_width = 190;

		if ( 330 > cow ) {
			choice_el_width = cow;
			layer_el_width = cow;
		}
		$( '.layer_choices' ).css( 'width', cow );
		$( '.choices-list > ul' ).each( function( ind, el ) {
			// $( el ).css( 'width', choice_el_width * $( el ).find( '.choice-item:visible' ).length );
		} );

		$( '.mkl_pc_toolbar' ).css( {
			'--cart-form-width': $( '.mkl_pc_toolbar .form.form-cart' ).outerWidth() + 'px',
			'--choice-item-width': choice_el_width + 'px',
			'--layer-item-width': layer_el_width + 'px',
		} );
		
		if ( resized && $( '.layers' )[0] ) $( '.layers' )[0].scrollTo( 0, 0 );
		// $( '.layers' ).css( 'width', layer_el_width * $( '.layers > li' ).length );

	}

	$( window ).on( 'resize', function() {
		resize_layer_choices( true );
	} );
	

})( jQuery );