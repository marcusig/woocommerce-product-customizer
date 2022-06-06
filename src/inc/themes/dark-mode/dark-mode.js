(function($) {
	wp.hooks.addAction( 'PC.fe.start', 'MKL/PC/Themes/dark-mode', function( view ) {
		view.$el.addClass( 'dark-mode' );
	} );
	wp.hooks.addFilter( 'PC.fe.tooltip.options', 'MKL/PC/Themes/dark-mode', function( options ) {
		options.theme = 'invert';
		return options;
	}, 20);
})();