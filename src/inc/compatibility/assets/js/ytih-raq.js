( function( $ ) {
	wp.hooks.addAction( 'PC.fe.start', 'mkl_pc.compat.yith', function( view ) {
		// Remove prices
		if ( ywraq_frontend && parseInt( ywraq_frontend.hide_price ) ) {
			view.$( '.pc-total-price, .extra-cost' ).remove();
		}
	} );
	wp.hooks.addFilter( 'PC.fe.show.extra_price', 'mkl_pc.compat.yith', function() {
		return false;
	} ); 
} )( jQuery );