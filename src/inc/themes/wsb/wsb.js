(function($) {
	wp.hooks.addAction( 'PC.fe.start', 'MKL/PC/Themes/wsb', function( view ) {
		// duplicate the form to have a different one on mobile or desktop views
		var clone = view.footer.form.$el.clone().appendTo( view.toolbar.$el );
		view.footer.form_2 = new PC.fe.views.form( { el: clone } );
		view.$el.addClass( 'wsb' );
		if ( PC_config.config.no_toggle ) view.$el.addClass( 'no-toggle' );
		view.$el.on( 'click', '.mkl-pc-show-form', function(e) {
			view.$el.toggleClass( 'mobile-show-form' );
		});
	});

	wp.hooks.addAction( 'PC.fe.open', 'MKL/PC/Themes/wsb', function( view ) {
		view.$el.removeClass( 'mobile-show-form' );
	}); 

	wp.hooks.addFilter( 'PC.fe.choices.where', 'MKL/PC/Themes/wsb', function( where ) {
		return 'in';
	} );
	wp.hooks.addAction( 'PC.fe.layer.activate', 'MKL/PC/Themes/wsb', function( view ) {
		if ( PC_config.config.no_toggle && 'dropdown' != view.model.get( 'display_mode' ) ) return;
		view.$el.find( '.layer_choices' ).first().slideDown(200);
	} );
	wp.hooks.addAction( 'PC.fe.layer.deactivate', 'MKL/PC/Themes/wsb', function( view ) {
		if ( PC_config.config.no_toggle && 'dropdown' != view.model.get( 'display_mode' ) ) return;
		view.$el.find( '.layer_choices' ).first().slideUp(200);
	} );

	// Conditional logic: do not show / hide choices list visibility
	wp.hooks.addFilter( 'mkl_pc_conditionals.toggle_choices', 'MKL/PC/Themes/wsb', function( where ) {
		return false;
	} );
	
	// Scroll to newly opened layer, when onening it using conditional logic
	wp.hooks.addAction( 'conditional.selected_layer', 'MKL/PC/Themes/float', function( model ) {
		var scrollToView = null;
		_.each( PC.fe.modal.toolbar.layers.items, function( view ) {
			if ( view.model.id == model.id ) {
				scrollToView = view;
			}
		} );

		if ( scrollToView ) {
			setTimeout( function() {
				scrollToView.el.offsetParent.scrollTo( 0, scrollToView.el.offsetTop );
			}, 150 );
		}
	} );

})( jQuery );