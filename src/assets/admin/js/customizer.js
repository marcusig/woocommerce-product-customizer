/**
 * This file adds some LIVE to the Theme Customizer live preview. 
 */
( function( $ ) {

	/**
	 * Update the colors
	 */
	mkl_pc_theme_colors.forEach( function( color ) {
		wp.customize( 'mkl_pc_theme_' + color, function( value ) {
			value.bind( function( newval ) {
				console.log( 'changin', newval, color );
				$( '.mkl_pc' ).css( '--mkl_pc_color-' + color, newval )
			} );
		} );
	} );

	/**
	 * Toggle the Background element
	 */
	wp.customize( 'mkl_pc_theme_use_viewer_bg', function( value ) {
		value.bind( function( newval ) {
			$( '.mkl_pc_bg' ).toggle( newval );
		} );
	} );

	/**
	 * Change the background image of the configurator
	 */
	wp.customize( 'mkl_pc_theme_viewer_bg', function( value ) {
		value.bind( function( newval ) {
			if ( newval ) {
				$( '.mkl_pc_bg' ).css( 'background-image', 'url(' + newval + ')' );
			} else {
				$( '.mkl_pc_bg' ).css( 'background-image', '' );
			}
		} );
	} );
} )( jQuery );
