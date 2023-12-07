(function( $, _ ) {
	wp.hooks.addAction( 'PC.fe.start', 'MKL/PC/Themes/wsb', function( view ) {
		// Move the form to the toolbar
		view.footer.form.$el.insertAfter( view.toolbar.$selection );

		view.$el.addClass( 'wsb' );
		if ( PC_config.config.disable_sticky_footer ) view.$el.addClass( 'no-sticky-footer' );
		if ( PC_config.config.no_toggle ) view.$el.addClass( 'no-toggle' );
	});

	wp.hooks.addFilter( 'PC.fe.choices.where', 'MKL/PC/Themes/wsb', function( where ) {
		return 'in';
	} );

	wp.hooks.addFilter( 'PC.fe.steps_position', 'MKL/PC/Themes/wsb', function( position, $nav ) {
		PC.fe.modal.toolbar.$( '.pc_configurator_form' ).before( $nav );
		return PC.fe.modal.toolbar.$el;
	} );

	wp.hooks.addAction( 'PC.fe.layer.activate', 'MKL/PC/Themes/wsb', function( view ) {
		if ( ! wp.hooks.applyFilters( 'pc.themes.wsb.toggle_choices', true, view ) ) return;
		if ( PC_config.config.no_toggle && 'dropdown' != view.model.get( 'display_mode' ) ) return;
		view.$el.find( '.layer_choices' ).first().delay(40).slideDown( { step: function() {
			if ( PC_config.config.auto_scroll && view.el.offsetParent ) view.el.offsetParent.scrollTo( 0, view.el.offsetTop );
		} } );
	} );

	wp.hooks.addAction( 'PC.fe.layer.deactivate', 'MKL/PC/Themes/wsb', function( view ) {
		if ( ! wp.hooks.applyFilters( 'pc.themes.wsb.toggle_choices', true, view ) ) return;
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

})( jQuery, PC._us || window._ );