/**
 * Quote request screen (requests kept as posts)
 *
 * - After the configurator dialog saved (configuration-editor-dialog.js), the configuration box is reloaded.
 * - The customer account picker searches the site's users, in a dropdown (assets/admin/css/search-dropdown.css).
 *   Picking one fills in the empty details, and those still holding what the previous pick filled in: never
 *   what the merchant typed.
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

		var $dropdown = $picker.find( '.mkl-pc-quote-user__dropdown' );

		var open = function() {
			$results.addClass( 'mkl-pc-is-open' );
			$search.attr( 'aria-expanded', 'true' );
		};

		var close = function() {
			if ( request ) request.abort();
			clearTimeout( timer );
			$results.removeClass( 'mkl-pc-is-open' ).empty();
			$search.attr( 'aria-expanded', 'false' );
		};

		var show_status = function( text ) {
			$results.empty().append( $( '<li class="mkl-pc-search-dropdown__status" aria-live="polite" />' ).text( text ) );
			open();
		};

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
			close();
			$search.val( '' );
			$status.empty();
			if ( user_id ) $status.append( $( '<div class="notice notice-warning inline" />' ).append( $( '<p />' ).text( lang.picked ) ) );
			if ( user_id ) fill( user_id );
		};

		var search = function() {
			var term = $.trim( $search.val() );
			if ( request ) request.abort();
			if ( term.length < 2 ) {
				close();
				return;
			}
			show_status( lang.searching );
			request = $.getJSON( config.ajax_url, { action: 'mkl_pc_quote_search_customers', security: config.nonce, term: term } ).done( function( users ) {
				if ( ! users || ! users.length ) {
					show_status( lang.no_results );
					return;
				}
				$results.empty();
				$.each( users, function( i, user ) {
					$( '<li />' ).append( $( '<button type="button" class="button-link" />' ).attr( 'data-user', user.id ).text( user.label ) ).appendTo( $results );
				} );
				open();
			} );
		};

		var focus_result = function( step ) {
			var $buttons = $results.find( 'button' );
			if ( ! $buttons.length ) return;
			var index = $buttons.index( document.activeElement ) + step;
			if ( index < 0 ) {
				$search.trigger( 'focus' );
				return;
			}
			$buttons.eq( Math.min( index, $buttons.length - 1 ) ).trigger( 'focus' );
		};

		$search.on( 'input', function() {
			clearTimeout( timer );
			timer = setTimeout( search, 250 );
		} );

		$dropdown.on( 'keydown', function( event ) {
			switch ( event.key ) {
				case 'Enter':
					// Would submit the request's form; a focused result is clicked by the browser.
					if ( event.target === $search[0] ) event.preventDefault();
					break;
				case 'ArrowDown':
					event.preventDefault();
					focus_result( 1 );
					break;
				case 'ArrowUp':
					event.preventDefault();
					focus_result( -1 );
					break;
				case 'Escape':
					if ( ! $results.hasClass( 'mkl-pc-is-open' ) ) return;
					event.preventDefault();
					close();
					$search.trigger( 'focus' );
					break;
			}
		} );

		// Keeps the focus in the field: Safari does not focus a clicked button, and the focus leaving the
		// dropdown would close it before the click.
		$results.on( 'mousedown', function( event ) {
			event.preventDefault();
		} );

		$results.on( 'click', 'button', function() {
			set_user( $( this ).data( 'user' ), $( this ).text() );
			$search.trigger( 'focus' );
		} );

		$clear.on( 'click', function() {
			set_user( 0 );
			$search.trigger( 'focus' );
		} );

		// Closes when the focus or a click goes elsewhere.
		$dropdown.on( 'focusout', function( event ) {
			if ( ! event.relatedTarget || ! $.contains( $dropdown[0], event.relatedTarget ) ) close();
		} );
		$( document ).on( 'click', function( event ) {
			if ( ! $( event.target ).closest( $dropdown ).length ) close();
		} );
	} );
} )( jQuery );
