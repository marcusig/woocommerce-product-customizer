(function($) {
	if ( ! wp || ! wp.hooks ) return;
	var scrollStartPost;
	wp.hooks.addAction( 'PC.fe.start', 'MKL/PC/Themes/H', function( view ) {
		// duplicate the form to have a different one on mobile or desktop views
		var clone = view.footer.form.$el.clone().appendTo( view.toolbar.$el );
		view.footer.form_2 = new PC.fe.views.form( { el: clone } );
		
		view.toolbar.$( 'button.cancel.close-mkl-pc' ).appendTo( view.$el ).on( 'click', function( e ) {
			e.preventDefault();
			view.close();
		} );

		view.$el.on( 'click', '.mkl-pc-show-form', function(e) {
			view.$el.toggleClass( 'mobile-show-form' );
		} );

		$( '.pc_configurator_form .configurator-add-to-cart' ).append( $( '.mkl_pc_toolbar .pc-total-price' ) );
		
		if ( view.$( '.pc_configurator_form input.qty' ).length ) {
			view.$( '.pc_configurator_form' ).addClass( 'has-qty' );
		}

		view.$( '.layers' ).wrap( '<div class="layers-wrapper"></div>' );
		view.$el.addClass( pc_h_config.color_mode );
		// view.$el.addClass( 'no-cart-modal' );

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

	// wp.hooks.addFilter( 'PC.fe.choices.where', 'MKL/PC/Themes/H', function( where ) {
	// 	return 'in';
	// } );

	wp.hooks.addAction( 'PC.fe.layer.activate', 'MKL/PC/Themes/H', function( view ) {
		if ( PC.fe.inline ) {
			view.$el.find( '.layer_choices' ).show();
			$(document).scrollTop(scrollStartPost);
		} else {
			view.$el.find( '.layer_choices' ).delay(40).slideDown(200);
		}
		resize_layer_choices();
			
	} );
	wp.hooks.addAction( 'PC.fe.layer.deactivate', 'MKL/PC/Themes/H', function( view ) {
		if ( PC.fe.inline ) {
			scrollStartPost = $(document).scrollTop();
			view.$el.find( '.layer_choices' ).hide();
		} else {
			view.$el.find( '.layer_choices' ).slideUp(200);
		}
	} );

	// Conditional logic: do not show / hide choices list visibility
	wp.hooks.addFilter( 'mkl_pc_conditionals.toggle_choices', 'MKL/PC/Themes/H', function( where ) {
		return false;
	} );

	var resize_layer_choices = function() {
		var cow = $( '.mkl_pc.opened .mkl_pc_container' ).outerWidth();
		var choice_el_width = 220;
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
		if ( $( '.layers' )[0] ) $( '.layers' )[0].scrollTo( 0, 0 );
		// $( '.layers' ).css( 'width', layer_el_width * $( '.layers > li' ).length );

	}

	$( window ).on( 'resize', function() {
		resize_layer_choices();
	} );
	

})( jQuery );