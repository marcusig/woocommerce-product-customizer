(function($) {
	if ( ! wp || ! wp.hooks ) return;
	var scrollStartPost;
	wp.hooks.addAction( 'PC.fe.start', 'MKL/PC/Themes/float', function( view ) {
		// duplicate the form to have a different one on mobile or desktop views
		var clone = view.footer.form.$el.clone().appendTo( view.toolbar.$el );
		view.footer.form_2 = new PC.fe.views.form( { el: clone } );
		view.$el.addClass( 'float' );
		if ( PC_config.config.no_form_modal ) {
			view.$el.addClass( 'no-form-modal' );
		}
		view.$el.on( 'click', '.mkl-pc-show-form', function(e) {
			view.$el.toggleClass( 'mobile-show-form' );
		} );

		// view.$('.layer-item').first().trigger('click');
		view.toolbar.$el.find('section.choices').on('scroll', function(e) {
			var section = $( this );
			section.toggleClass( 'scrolled', ! ( e.target.scrollHeight - section.outerHeight() == section.scrollTop() ) );
		} );
		setTimeout(
			function() {
				view.toolbar.$el.find('section.choices').trigger( 'scroll' );
			},
			500
		);
	}, 20 ); 

	wp.hooks.addAction( 'PC.fe.open', 'MKL/PC/Themes/float', function( view ) {
		view.$el.removeClass( 'mobile-show-form' );
	} );

	wp.hooks.addFilter( 'PC.fe.choices.where', 'MKL/PC/Themes/float', function( where ) {
		return 'in';
	} );
	wp.hooks.addAction( 'PC.fe.layer.activate', 'MKL/PC/Themes/float', function( view ) {
		if ( PC.fe.inline ) {
			view.$el.find( '.layer_choices' ).first().show();
			if ( PC_config.config.auto_scroll ) view.el.offsetParent.scrollTo( 0, view.el.offsetTop );
			// if ( scrollStartPost ) $(document).scrollTop(scrollStartPost);
		} else {
			view.$el.find( '.layer_choices' ).first().delay(40).slideDown( { step: function() {
				if ( PC_config.config.auto_scroll && view.el.offsetParent ) view.el.offsetParent.scrollTo( 0, view.el.offsetTop );
			} } );
		}
			
	} );
	wp.hooks.addAction( 'PC.fe.layer.deactivate', 'MKL/PC/Themes/float', function( view ) {
		if ( PC.fe.inline ) {
			scrollStartPost = $(document).scrollTop();
			view.$el.find( '.layer_choices' ).first().hide();
		} else {
			view.$el.find( '.layer_choices' ).first().slideUp(200);
		}
	} );

	// Conditional logic: do not show / hide choices list visibility
	wp.hooks.addFilter( 'mkl_pc_conditionals.toggle_choices', 'MKL/PC/Themes/float', function( where ) {
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