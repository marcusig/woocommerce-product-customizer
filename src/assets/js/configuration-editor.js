/**
 * The configurator opened from an order in the admin, in a frame
 *
 * Add to cart and Request a quote are replaced by Save, which sends the configuration to the order line
 * (or a new line) and tells the order screen, which closes the frame and reloads the order items.
 *
 * Config in PC_configuration_editor: target, is_new, quantity, save_url, nonce, capture_image, button_class, lang.
 */
( function( $ ) {
	var config = window.PC_configuration_editor;
	if ( ! config || ! window.PC || ! PC.fe ) return;
	var lang = config.lang || {};
	var NS = 'mkl/pc/configuration-editor';

	/**
	 * Tell the order screen
	 *
	 * @param {string} event 'saved' or 'cancel'.
	 * @param {Object} [data]
	 */
	var notify = function( event, data ) {
		if ( window.parent === window ) return;
		window.parent.postMessage( $.extend( { source: 'mkl_pc_configuration_editor', event: event, target: config.target }, data || {} ), window.location.origin );
	};

	/**
	 * The footer's actions: Cancel and Save only
	 *
	 * @param {jQuery} $form The footer's form element.
	 */
	var set_actions = function( $form ) {
		if ( ! $form || ! $form.length ) return;
		$form.find( '.configurator-add-to-cart, .mkl-pc-request-quote, .mkl-pc-editor-actions, .mkl-pc-editor-error' ).remove();
		// The classes and the place of the quote request button, which themes style in the footer.
		var classes = ( config.button_class || 'button' ) + ' add-to-quote';
		var $actions = $( '<div class="mkl-pc-editor-actions" />' );
		$( '<button type="button" />' ).addClass( classes + ' mkl-pc-editor-cancel' ).text( lang.cancel ).appendTo( $actions );
		$( '<button type="button" />' ).addClass( classes + ' mkl-pc-editor-save' ).text( lang.save ).appendTo( $actions );
		var $target = $form.find( 'form.cart' ).first();
		if ( ! $target.length ) $target = $form.find( '.pc_configurator_form' );
		( $target.length ? $target : $form ).append( $actions );
		$( '<div class="mkl-pc-editor-error" role="alert" />' ).insertAfter( $actions );

		$form.off( '.mklPcEditor' )
			.on( 'click.mklPcEditor', '.mkl-pc-editor-save', function( event ) {
				event.preventDefault();
				save( $( event.currentTarget ) );
			} )
			.on( 'click.mklPcEditor', '.mkl-pc-editor-cancel', function( event ) {
				event.preventDefault();
				notify( 'cancel' );
			} );
	};

	/**
	 * The 3D view as a data URL, for the line's picture
	 *
	 * @return {Promise<string>}
	 */
	var capture = async function() {
		if ( ! config.capture_image || 'function' !== typeof PC.fe.capture_viewer_image ) return '';
		var size = PC.fe.config.cart_screenshot_size || { width: 800, height: 800 };
		var image = await PC.fe.capture_viewer_image( { view: 'current', width: size.width, height: size.height } );
		if ( ! image || 'string' === typeof image ) return image || '';
		return new Promise( function( resolve ) {
			var reader = new FileReader();
			reader.onloadend = function() { resolve( reader.result || '' ); };
			reader.onerror = function() { resolve( '' ); };
			reader.readAsDataURL( image );
		} );
	};

	var save = async function( $button ) {
		if ( $button.prop( 'disabled' ) ) return;
		var $error = $button.closest( '.mkl-pc-editor-actions' ).next( '.mkl-pc-editor-error' ).empty();
		var check = await PC.fe.validate_configuration( { show_errors: true, context: 'admin' } );
		if ( ! check.valid ) return;

		$button.prop( 'disabled', true ).attr( 'aria-busy', 'true' ).data( 'label', $button.text() ).text( lang.saving );
		try {
			var response = await fetch( config.save_url, {
				method: 'POST',
				credentials: 'same-origin',
				headers: { 'Content-Type': 'application/json', 'X-WP-Nonce': config.nonce },
				body: JSON.stringify( {
					target: config.target,
					configuration: check.data,
					quantity: PC.fe.get_qty ? PC.fe.get_qty() : 1,
					image: await capture()
				} )
			} );
			var result = await response.json();
			if ( ! response.ok ) throw new Error( result && result.message ? result.message : lang.failed );
			notify( 'saved', { item_id: result.item_id } );
		} catch ( e ) {
			$error.text( e && e.message ? e.message : lang.failed );
		}
		$button.prop( 'disabled', false ).removeAttr( 'aria-busy' ).text( $button.data( 'label' ) );
	};

	// After the quote request's own hooks, which add its button on the same ones.
	wp.hooks.addAction( 'PC.fe.render_form', NS, function( form ) {
		set_actions( form.$el );
	}, 20 );

	wp.hooks.addAction( 'PC.fe.start', NS, function( configurator ) {
		var modal = PC.fe.modal || configurator;
		if ( modal && modal.footer && modal.footer.form ) set_actions( modal.footer.form.$el );
		if ( config.quantity && PC.fe.set_qty ) PC.fe.set_qty( config.quantity );
	}, 20 );

	wp.hooks.addAction( 'PC.fe.quote.button_added', NS, function( $button ) {
		$button.remove();
	} );
} )( jQuery );
