!(function($){

	$( '.mkl-edit-license' ).on( 'click', function( e ){
		e.preventDefault();
		$(this).toggleClass( 'open' );
	})

	var settings = {
		init: function() {
			$( '.mkl-nav-tab-wrapper a' ).on( 'click', function( e ) {
				e.preventDefault();
				$( '.mkl-nav-tab-wrapper a' ).removeClass( 'nav-tab-active' );
				$( '.mkl-settings-content.active' ).removeClass( 'active' );
				$(this).addClass( 'nav-tab-active' );
				$( '.mkl-settings-content[data-content=' + $( this ).data( 'content' ) + ']' ).addClass( 'active' );
			});

			if ( $( '.mkl-nav-tab-wrapper a.nav-tab-active' ).length ) {
				$( '.mkl-nav-tab-wrapper a.nav-tab-active' ).trigger( 'click' );
			} else {
				$( '.mkl-nav-tab-wrapper a' ).first().trigger( 'click' );
			}

			$('.mkl-settings-purge-config-cache').on( 'click', function( e ) {
				var btn = $( this );
				btn.prop( 'disabled', 'disabled' );
				wp.ajax.post({
					action: 'mkl_pc_purge_config_cache',
					security: $( '#_wpnonce' ).val()
				}).done( function( response ) {
					btn.prop( 'disabled', false );
				} );
			} );
		}
	};

	$(document).ready(function() {
		settings.init();
	});

})(jQuery);