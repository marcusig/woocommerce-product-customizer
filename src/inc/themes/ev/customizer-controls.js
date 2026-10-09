/**
 * Customizer controls for the EV theme.
 *
 * Loaded in the controls pane, not on the shop.
 */
( function( api ) {
	api( 'mkl_pc_theme_ev_viewer_inset', function( inset ) {
		api( 'mkl_pc_theme_ev_viewer_inset_mobile', function( inset_mobile ) {
			api.control( 'mkl_pc_theme_ev_viewer_radius', function( control ) {
				var inset_is_set = function( setting ) {
					var value = parseInt( setting.get(), 10 );
					return ! isNaN( value ) && value > 0;
				};
				var toggle = function() {
					control.active.set( inset_is_set( inset ) || inset_is_set( inset_mobile ) );
				};

				toggle();
				inset.bind( toggle );
				inset_mobile.bind( toggle );
			} );
		} );
	} );
}( wp.customize ) );
