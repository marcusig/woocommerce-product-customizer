/**
 * Live preview for the EV theme Customizer settings.
 *
 * Loaded only in the Customizer preview.
 */
( function( api ) {
	api( 'mkl_pc_theme_ev_border_radius', function( value ) {
		value.bind( function( new_value ) {
			var radius = parseInt( new_value, 10 );
			var root = document.querySelector( '.mkl_pc.ev' );

			if ( isNaN( radius ) ) {
				radius = 10;
			}
			if ( radius < 0 ) {
				radius = 0;
			}
			if ( radius > 40 ) {
				radius = 40;
			}
			if ( root ) {
				root.style.setProperty( '--ev-border-radius', radius + 'px' );
			}
		} );
	} );

	api( 'mkl_pc_theme_ev_footer_position', function( value ) {
		value.bind( function( new_value ) {
			var footer = document.querySelector( '.mkl_pc.ev .mkl_pc_footer' );

			if ( footer ) {
				footer.style.position = 'static' === new_value ? 'static' : 'sticky';
			}
		} );
	} );
}( wp.customize ) );
