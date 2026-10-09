/**
 * Live preview for the EV theme Customizer settings.
 *
 * Loaded only in the Customizer preview.
 */
( function( api ) {
	var aspect_ratios = {
		'1/1': '1 / 1',
		'4/3': '4 / 3',
		'3/2': '3 / 2',
		'16/9': '16 / 9'
	};

	/**
	 * Clamp a Customizer number to the range used by its control.
	 *
	 * @param {string|number} value    Submitted value.
	 * @param {number}        fallback Value used when the input is empty.
	 * @param {number}        min      Minimum.
	 * @param {number}        max      Maximum.
	 * @return {number}
	 */
	function clamp_int( value, fallback, min, max ) {
		var number = parseInt( value, 10 );

		if ( isNaN( number ) ) {
			number = fallback;
		}
		if ( number < min ) {
			number = min;
		}
		if ( number > max ) {
			number = max;
		}
		return number;
	}

	/**
	 * Write the viewer inset, and the corner radius only while the view is inset.
	 */
	function apply_viewer_frame() {
		var root = document.querySelector( '.mkl_pc.ev' );
		var inset_setting = api( 'mkl_pc_theme_ev_viewer_inset' );
		var inset_mobile_setting = api( 'mkl_pc_theme_ev_viewer_inset_mobile' );
		var radius_setting = api( 'mkl_pc_theme_ev_viewer_radius' );
		var inset;
		var inset_mobile;
		var radius;

		if ( ! root || ! inset_setting || ! inset_mobile_setting || ! radius_setting ) {
			return;
		}

		inset = clamp_int( inset_setting.get(), 0, 0, 80 );
		inset_mobile = clamp_int( inset_mobile_setting.get(), 0, 0, 80 );
		radius = clamp_int( radius_setting.get(), 10, 0, 40 );
		root.style.setProperty( '--ev-viewer-inset', inset + 'px' );
		root.style.setProperty( '--ev-viewer-inset-mobile', inset_mobile + 'px' );
		root.style.setProperty( '--ev-viewer-radius', ( inset > 0 ? radius : 0 ) + 'px' );
		root.style.setProperty( '--ev-viewer-radius-mobile', ( inset_mobile > 0 ? radius : 0 ) + 'px' );
	}

	api( 'mkl_pc_theme_ev_viewer_inset', function( value ) {
		value.bind( apply_viewer_frame );
	} );

	api( 'mkl_pc_theme_ev_viewer_inset_mobile', function( value ) {
		value.bind( apply_viewer_frame );
	} );

	api( 'mkl_pc_theme_ev_viewer_radius', function( value ) {
		value.bind( apply_viewer_frame );
	} );

	api( 'mkl_pc_theme_ev_viewer_aspect_ratio', function( value ) {
		value.bind( function( new_value ) {
			var root = document.querySelector( '.mkl_pc.ev' );
			var ratio = aspect_ratios[ new_value ] || aspect_ratios[ '4/3' ];

			if ( root ) {
				root.style.setProperty( '--ev-viewer-aspect-ratio', ratio );
			}
		} );
	} );

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
