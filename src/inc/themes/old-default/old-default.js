(function($) {
	wp.hooks.addAction( 'PC.fe.start', 'MKL/PC/Themes/old-default', function( view ) {
		view.$el.addClass( 'default old-default' );
	} );
})();