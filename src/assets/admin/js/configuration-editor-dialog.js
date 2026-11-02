/**
 * Admin screens: configure in the configurator, shown in a frame
 *
 * `.mkl-pc-open-configuration-editor` opens a configurator (its data-url); `.mkl-pc-add-configured-product`
 * asks for the product first, for its data-target. The frame tells this screen when it saved (see
 * assets/js/configuration-editor.js). On the order screen the order items are then reloaded, as WooCommerce
 * does after its own edits; other screens listen to `mkl_pc_configuration_saved` on the body.
 *
 * Config in PC_configuration_editor_dialog: screen, ajax_url, nonce, lang.
 */
( function( $ ) {
	var config = window.PC_configuration_editor_dialog || {};
	var lang = config.lang || {};
	var dialog = null;
	var trigger = null;

	var get_dialog = function() {
		if ( dialog ) return dialog;
		dialog = $(
			'<dialog class="mkl-pc-editor-dialog" aria-labelledby="mkl-pc-editor-dialog-title">' +
				'<div class="mkl-pc-editor-dialog__inner">' +
					'<div class="mkl-pc-editor-dialog__head"><h2 id="mkl-pc-editor-dialog-title"></h2>' +
					'<button type="button" class="button-link mkl-pc-editor-dialog__close"><span class="dashicons dashicons-no-alt" aria-hidden="true"></span><span class="screen-reader-text"></span></button></div>' +
					'<div class="mkl-pc-editor-dialog__body"></div>' +
				'</div>' +
			'</dialog>'
		).appendTo( document.body );
		dialog.find( '.mkl-pc-editor-dialog__close .screen-reader-text' ).text( lang.close );
		dialog.on( 'click', '.mkl-pc-editor-dialog__close', function() {
			close_dialog( true );
		} );
		// Escape: ask first when a configurator is open, it may hold changes.
		dialog.on( 'cancel', function( event ) {
			event.preventDefault();
			close_dialog( true );
		} );
		dialog.on( 'close', function() {
			dialog.find( '.mkl-pc-editor-dialog__body' ).empty();
			if ( trigger ) $( trigger ).trigger( 'focus' );
		} );
		return dialog;
	};

	var close_dialog = function( confirm_first ) {
		if ( ! dialog || ! dialog[0].open ) return;
		if ( confirm_first && dialog.find( 'iframe' ).length && ! window.confirm( lang.unsaved ) ) return;
		dialog[0].close();
	};

	var open_frame = function( url, title ) {
		var $dialog = get_dialog();
		$dialog.removeClass( 'is-picker' );
		$dialog.find( 'h2' ).text( title || '' );
		$dialog.find( '.mkl-pc-editor-dialog__body' ).empty().append( $( '<iframe />' ).attr( { src: url, title: title || '' } ) );
		if ( ! $dialog[0].open ) $dialog[0].showModal();
	};

	/**
	 * Ask for the product of a new line: a search among configurable products
	 *
	 * Not selectWoo: its dropdown cannot place itself over a modal dialog.
	 */
	var open_picker = function( base ) {
		var $dialog = get_dialog();
		$dialog.addClass( 'is-picker' );
		$dialog.find( 'h2' ).text( lang.choose_product );
		var $body = $dialog.find( '.mkl-pc-editor-dialog__body' ).empty();
		var $search = $( '<input type="search" class="widefat mkl-pc-editor-dialog__search" autocomplete="off" />' ).attr( { placeholder: lang.search, 'aria-label': lang.search } ).appendTo( $body );
		var $results = $( '<ul class="mkl-pc-editor-dialog__results" />' ).attr( 'aria-label', lang.choose_product ).appendTo( $body );
		var $status = $( '<p class="mkl-pc-editor-dialog__status" role="status" />' ).appendTo( $body );
		var timer = null;
		var request = null;

		var search = function() {
			var term = $.trim( $search.val() );
			if ( request ) request.abort();
			$results.empty();
			if ( term.length < 2 ) {
				$status.text( '' );
				return;
			}
			$status.text( lang.searching );
			request = $.getJSON( config.ajax_url, { action: 'mkl_pc_search_configurable_products', security: config.nonce, term: term } ).done( function( data ) {
				var found = 0;
				$.each( data || {}, function( id, name ) {
					found++;
					$( '<li />' ).append( $( '<button type="button" class="button-link" />' ).attr( 'data-product', id ).text( name ) ).appendTo( $results );
				} );
				$status.text( found ? '' : lang.no_results );
			} );
		};

		$search.on( 'input', function() {
			clearTimeout( timer );
			timer = setTimeout( search, 250 );
		} );

		$results.on( 'click', 'button', function() {
			var $choice = $( this );
			$results.find( 'button' ).prop( 'disabled', true );
			$.post( config.ajax_url, { action: 'mkl_pc_configuration_editor_url', security: config.nonce, target: base, product_id: $choice.data( 'product' ) } )
				.done( function( response ) {
					if ( response && response.success ) {
						open_frame( response.data.url, response.data.title );
					} else {
						$status.text( response && response.data && response.data.message ? response.data.message : '' );
						$results.find( 'button' ).prop( 'disabled', false );
					}
				} );
		} );

		if ( ! $dialog[0].open ) $dialog[0].showModal();
		$search.trigger( 'focus' );
	};

	/**
	 * Reload the order items, as WooCommerce does after its own edits
	 */
	var reload_items = function() {
		var $box = $( '#woocommerce-order-items' );
		$box.block( { message: null, overlayCSS: { background: '#fff', opacity: 0.6 } } );
		$.post( woocommerce_admin_meta_boxes.ajax_url, {
			order_id: woocommerce_admin_meta_boxes.post_id,
			action: 'woocommerce_load_order_items',
			security: woocommerce_admin_meta_boxes.order_item_nonce
		} ).done( function( response ) {
			$box.find( '.inside' ).empty().append( response );
			$( document.body ).trigger( 'init_tooltips' );
			$box.trigger( 'wc_order_items_reloaded' );
		} ).always( function() {
			$box.unblock();
		} );
	};

	$( document.body ).on( 'click', '.mkl-pc-open-configuration-editor', function( event ) {
		event.preventDefault();
		trigger = event.currentTarget;
		open_frame( $( this ).data( 'url' ), $( this ).data( 'title' ) );
	} );

	$( document.body ).on( 'click', '.mkl-pc-add-configured-product', function( event ) {
		event.preventDefault();
		trigger = event.currentTarget;
		open_picker( $( this ).data( 'target' ) );
	} );

	window.addEventListener( 'message', function( event ) {
		var data = event.data;
		if ( event.origin !== window.location.origin || ! data || 'mkl_pc_configuration_editor' !== data.source ) return;
		if ( 'saved' === data.event ) {
			trigger = null;
			close_dialog( false );
			if ( 'order' === config.screen ) reload_items();
			$( document.body ).trigger( 'mkl_pc_configuration_saved', [ data ] );
		} else if ( 'cancel' === data.event ) {
			close_dialog( false );
		}
	} );
} )( jQuery );
