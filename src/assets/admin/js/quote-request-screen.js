/**
 * Quote request screen (requests kept as posts)
 *
 * - After the configurator dialog saved (configuration-editor-dialog.js), the configuration box is reloaded.
 * - The customer account picker searches the site's users. Picking one fills in the empty details, and
 *   those still holding what the previous pick filled in: never what the merchant typed.
 *
 * Works without WooCommerce. Config in PC_quote_screen: ajax_url, nonce, lang.
 */
( function( $ ) {
	var config = window.PC_quote_screen || {};
	var lang = config.lang || {};

	$( document.body ).on( 'mkl_pc_configuration_saved', function() {
		var box = $( '.mkl-pc-quote-configuration' );
		var dialog = window.PC_configuration_editor_dialog || {};
		box.css( 'opacity', 0.5 );
		$.post( dialog.ajax_url, { action: 'mkl_pc_quote_configuration', security: dialog.nonce, post_id: box.data( 'post' ) } ).done( function( response ) {
			if ( ! response || ! response.success ) return;
			box.html( response.data.html );
			$( '#mkl_pc_quote_price_field' ).attr( 'placeholder', response.data.price );
		} ).always( function() {
			box.css( 'opacity', '' );
		} );
	} );

	$( function() {
		var $picker = $( '.mkl-pc-quote-user' );
		if ( ! $picker.length ) return;
		var $id = $picker.find( 'input[name="mkl_pc_quote_user_id"]' );
		var $current = $picker.find( '.mkl-pc-quote-user__current' );
		var $clear = $picker.find( '.mkl-pc-quote-user__clear' );
		var $search = $picker.find( '.mkl-pc-quote-user__search' );
		var $results = $picker.find( '.mkl-pc-quote-user__results' );
		var $status = $picker.find( '.mkl-pc-quote-user__status' );
		var timer = null;
		var request = null;

		var fill = function( user_id ) {
			$.post( config.ajax_url, { action: 'mkl_pc_quote_customer_details', security: config.nonce, user_id: user_id } ).done( function( response ) {
				if ( ! response || ! response.success ) return;
				$( '.mkl-pc-quote-fields [data-maps-to]' ).each( function() {
					var field = $( this );
					var value = response.data[ field.data( 'maps-to' ) ];
					if ( ! value ) return;
					if ( '' === field.val() || field.val() === field.data( 'filled' ) ) field.val( value ).data( 'filled', value );
				} );
			} );
		};

		var set_user = function( user_id, label ) {
			$id.val( user_id || 0 );
			$current.text( user_id ? label : lang.guest );
			$picker.find( '.mkl-pc-quote-user__profile' ).remove();
			$clear.prop( 'hidden', ! user_id );
			$results.empty();
			$search.val( '' );
			$status.text( user_id ? lang.picked : '' );
			if ( user_id ) fill( user_id );
		};

		var search = function() {
			var term = $.trim( $search.val() );
			if ( request ) request.abort();
			$results.empty();
			if ( term.length < 2 ) {
				$status.text( '' );
				return;
			}
			$status.text( lang.searching );
			request = $.getJSON( config.ajax_url, { action: 'mkl_pc_quote_search_customers', security: config.nonce, term: term } ).done( function( users ) {
				$.each( users || [], function( i, user ) {
					$( '<li />' ).append( $( '<button type="button" class="button-link" />' ).attr( 'data-user', user.id ).text( user.label ) ).appendTo( $results );
				} );
				$status.text( users && users.length ? '' : lang.no_results );
			} );
		};

		$search.on( 'input', function() {
			clearTimeout( timer );
			timer = setTimeout( search, 250 );
		} ).on( 'keydown', function( event ) {
			// Enter would submit the request's form.
			if ( 13 === event.which ) event.preventDefault();
		} );

		$results.on( 'click', 'button', function() {
			set_user( $( this ).data( 'user' ), $( this ).text() );
			$search.trigger( 'focus' );
		} );

		$clear.on( 'click', function() {
			set_user( 0 );
			$search.trigger( 'focus' );
		} );
	} );
} )( jQuery );
