(function($, _) {
	if ( ! wp || ! wp.hooks ) return;
	var scrollStartPost;
	wp.hooks.addAction( 'PC.fe.start', 'MKL/PC/Themes/float', function( view ) {
		// Move the form to the toolbar
		view.footer.form.$el.insertAfter( view.toolbar.$selection );

		// view.footer.form_2 = new PC.fe.views.form( { el: clone } );
		view.$el.addClass( 'float' );

		if ( PC_config.config.disable_sticky_footer ) view.$el.addClass( 'no-sticky-footer' );

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

	wp.hooks.addFilter( 'PC.fe.steps_position', 'MKL/PC/Themes/float', function( position, $nav ) {
		PC.fe.modal.toolbar.$( '.pc_configurator_form' ).before( $nav );
		return PC.fe.modal.toolbar.$el;
	} );

	wp.hooks.addFilter( 'PC.fe.choices.where', 'MKL/PC/Themes/float', function( where, view ) {
		if ( 'full-screen' === view.model.get( 'display_mode' ) ) {
			if ( PC.fe.inline ) return 'body';
			return 'out';
		}
		return 'in';
	} );
	
	wp.hooks.addAction( 'PC.fe.layer.activate', 'MKL/PC/Themes/float', function( view ) {
		if ( ! wp.hooks.applyFilters( 'pc.themes.float.toggle_choices', true, view ) ) return;
		if ( PC.fe.inline ) {
			view.$el.find( '.layer_choices' ).first().show();
			if ( PC_config.config.auto_scroll ) view.el.offsetParent.scrollTo( 0, view.el.offsetTop );
			// if ( scrollStartPost ) $(document).scrollTop(scrollStartPost);
		} else {
			if ( 'dropdown' === view.model.get( 'display_mode' ) ) {
				view.$el.find( '.layer_choices' ).first().delay(40).slideDown( 100 );
			} else {
				view.$el.find( '.layer_choices' ).first().delay(40).slideDown( { duration: 100, step: function() {
					if ( PC_config.config.auto_scroll && view.el.offsetParent ) view.el.offsetParent.scrollTo( 0, view.el.offsetTop );
				} } );
			}
		}
			
	} );
	wp.hooks.addAction( 'PC.fe.layer.deactivate', 'MKL/PC/Themes/float', function( view ) {
		if ( ! wp.hooks.applyFilters( 'pc.themes.float.toggle_choices', true, view ) ) return;
		if ( PC.fe.inline ) {
			scrollStartPost = $(document).scrollTop();
			view.$el.find( '.layer_choices' ).first().hide();
		} else {
			view.$el.find( '.layer_choices' ).first().slideUp(100);
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

	/**
	 * Display step: scroll back to the top
	 */
	wp.hooks.addAction( 'PC.fe.steps.display_step', 'MKL/PC/Themes/float', function( steps ) {
		var scrollable = PC.fe.modal.$( 'section.choices' );
		if ( scrollable.length ) scrollable[0].scrollTo( 0, 0 );
	} );
	

})( jQuery, PC._us || window._ );