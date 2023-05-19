( function( $ ) {
	wp.hooks.addAction( 'PC.fe.start', 'mkl_pc.compat.yith', function( view ) {
		// Remove prices from cart form
		if ( ywraq_frontend && parseInt( ywraq_frontend.hide_price ) ) {
			view.$( '.pc-total-price, .extra-cost' ).remove();
		}
	} );

	// Remove prices from items
	wp.hooks.addFilter( 'PC.fe.show.extra_price', 'mkl_pc.compat.yith', function( show ) {
		if ( ywraq_frontend && parseInt( ywraq_frontend.hide_price ) ) return false;
		return show;
	} ); 
} )( jQuery );