(function($) {
	if ( ! wp || ! wp.hooks ) return;
	var scrollStartPost;
	wp.hooks.addAction( 'PC.fe.start', 'MKL/PC/Themes/float', function( view ) {
		// duplicate the form to have a different one on mobile or desktop views
		var clone = view.footer.form.$el.clone().appendTo( view.toolbar.$el );
		view.footer.form_2 = new PC.fe.views.form( { el: clone } );

		view.$el.on( 'click', '.mkl-pc-show-form', function(e) {
			view.$el.toggleClass( 'mobile-show-form' );
		} );

		resize_layer_choices();
		
	}, 20 ); 

	wp.hooks.addAction( 'PC.fe.open', 'MKL/PC/Themes/float', function( view ) {
		view.$el.removeClass( 'mobile-show-form' );
	} );

	// wp.hooks.addFilter( 'PC.fe.choices.where', 'MKL/PC/Themes/float', function( where ) {
	// 	return 'in';
	// } );

	wp.hooks.addAction( 'PC.fe.layer.activate', 'MKL/PC/Themes/float', function( view ) {
		if ( PC.fe.inline ) {
			view.$el.find( '.layer_choices' ).show();
			$(document).scrollTop(scrollStartPost);
		} else {
			view.$el.find( '.layer_choices' ).delay(40).slideDown(200);
		}
			
	} );
	wp.hooks.addAction( 'PC.fe.layer.deactivate', 'MKL/PC/Themes/float', function( view ) {
		if ( PC.fe.inline ) {
			scrollStartPost = $(document).scrollTop();
			view.$el.find( '.layer_choices' ).hide();
		} else {
			view.$el.find( '.layer_choices' ).slideUp(200);
		}
	} );

	// Conditional logic: do not show / hide choices list visibility
	wp.hooks.addFilter( 'mkl_pc_conditionals.toggle_choices', 'MKL/PC/Themes/float', function( where ) {
		return false;
	} );

	var resize_layer_choices = function() {
		$( '.layer_choices' ).css( 'width', $( '.mkl_pc.opened .mkl_pc_container' ).outerWidth() );
	}

	$( window ).on( 'resize', function() {
		resize_layer_choices();
	} );
	

})( jQuery );