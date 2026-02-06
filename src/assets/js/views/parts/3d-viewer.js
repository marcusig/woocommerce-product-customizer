/*
	PC.fe.views.viewer_3d is registered by the fe-3d-viewer bundle when the product is 3D.
	This filter selects the 3D viewer when settings_3d and a model URL are present.
*/
( function() {
	if ( typeof wp === 'undefined' || ! wp.hooks || ! wp.hooks.addFilter ) return;
	wp.hooks.addFilter( 'PC.fe.viewer.main_view', 'PC.fe.3d', function( defaultView ) {
		var data = PC.fe && PC.fe.currentProductData;
		if ( data && data.settings_3d && PC.fe.views.viewer_3d ) {
			return PC.fe.views.viewer_3d;
		}
		return defaultView;
	} );
} )();
