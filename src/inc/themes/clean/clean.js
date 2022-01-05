(function($) {
	if ( ! wp || ! wp.hooks ) return;
	wp.hooks.addAction( 'PC.fe.before_open', 'MKL/PC/Themes/clean', function() {
		PC.fe.config.show_layer_description_in_title = true;
	} );

	wp.hooks.addAction( 'PC.fe.layers_list.open', 'MKL/PC/Themes/clean', function( view, model ) {
		PC.fe.modal.$el.addClass( 'showing-choices' );
	} );

	wp.hooks.addAction( 'PC.fe.layers_list.close', 'MKL/PC/Themes/clean', function( view, model ) {
		PC.fe.modal.$el.removeClass( 'showing-choices' );
	} );

	wp.hooks.addFilter( 'PC.fe.choices.where', 'MKL/PC/Themes/clean', function( where ) {
		return PC.fe.modal.toolbar.el;
	} );

})( jQuery );