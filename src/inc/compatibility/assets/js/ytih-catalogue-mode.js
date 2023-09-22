( function( $ ) {
	wp.hooks.addAction( 'PC.fe.start', 'mkl_pc.compat.yith_catalogue', function( view ) {
		
		// Remove cart form
		if ( PC_config.config.yith_catalogue ) {
			view.$( '.form.form-cart' ).remove();
		}
	}, 50 );

	// Remove prices from items
	wp.hooks.addFilter( 'PC.fe.show.extra_price', 'mkl_pc.compat.yith_catalogue', function( show ) {
		if ( PC_config.config.yith_catalogue ) return false;
		return show;
	} ); 
	
	wp.hooks.addFilter( 'PC.fe.trigger_add_to_cart', 'mkl_pc.compat.yith_catalogue', function( atc ) {
		if ( PC_config.config.yith_catalogue ) return false;
		return atc;
	} ); 

} )( jQuery );
