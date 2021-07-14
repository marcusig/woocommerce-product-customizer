!( function( $ ) {
	'use strict';

	$( function() {
		$( 'img[data-generate_image]' ).each( function( index, el ) {
			var image_attr = $( el ).data( 'generate_image' );
			$( el )
				.removeAttr( 'data-generate_image' )
				.addClass( 'generating-image' );

			$.ajax( {
				url:  mkl_pc_general.ajaxurl, 
				type: 'POST',
				dataType: 'json',
				data: {
					action: 'mkl_pc_generate_config_image',
					data: image_attr,
				},
				context: this,
			} )
			.done(function( response ) {
				var im = new Image();
				$( im ).on( 'load', function() {
					el.src = response.data.url;
					$( el ).removeClass( 'generating-image' );
				} );
				im.src = response.data.url;
			} );
		} );
	} );

} )( jQuery );
