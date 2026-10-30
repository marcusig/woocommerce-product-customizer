	/**
	 * Quote requests, without any view.
	 *
	 * The configurator's own form uses this, and so can a headless page:
	 *
	 *     const schema = await PC.fe.quote.get_schema();
	 *     try {
	 *         const result = await PC.fe.quote.request( { fields: { name: 'Ada', email: 'ada@example.com' } } );
	 *     } catch ( error ) {
	 *         // error.code, error.message, error.field_errors, error.configuration_errors
	 *     }
	 */
	PC.fe.quote = PC.fe.quote || {};

	var quote_schemas = {};

	var quote_config = function() {
		return ( PC.fe.config && PC.fe.config.quote_request ) || {};
	};

	var quote_lang = function( key, fallback ) {
		return ( PC_config && PC_config.lang && PC_config.lang[ key ] ) || fallback;
	};

	var rest_headers = function() {
		var headers = { 'Content-Type': 'application/json' };
		if ( typeof PC_config !== 'undefined' && PC_config.rest_nonce ) {
			headers[ 'X-WP-Nonce' ] = PC_config.rest_nonce;
		}
		return headers;
	};

	/**
	 * An error from a quote request
	 *
	 * @param {string} code
	 * @param {string} message
	 * @param {Object} [data] status, field_errors, configuration_errors
	 * @return {Error}
	 */
	PC.fe.quote.error = function( code, message, data ) {
		var error = new Error( message || code );
		error.code = code;
		error.status = ( data && data.status ) || 0;
		error.field_errors = ( data && data.field_errors ) || {};
		error.configuration_errors = ( data && data.configuration_errors ) || [];
		return error;
	};

	/**
	 * Whether quote requests are on
	 *
	 * @return {boolean}
	 */
	PC.fe.quote.is_enabled = function() {
		return !! quote_config().enabled;
	};

	/**
	 * The product the configurator data belongs to (the parent of a variation)
	 *
	 * @return {number}
	 */
	PC.fe.quote.get_product_id = function() {
		if ( 'variable' === PC.fe.product_type && PC.fe.parent_product ) return PC.fe.parent_product;
		return PC.fe.active_product;
	};

	/**
	 * The form for a product: fields, whether to capture the viewer, where to send it
	 *
	 * @param {number} [product_id] Defaults to the active product.
	 * @return {Promise<Object>}
	 */
	PC.fe.quote.get_schema = function( product_id ) {
		product_id = product_id || PC.fe.quote.get_product_id();
		if ( ! quote_schemas[ product_id ] ) {
			var url = quote_config().schema_url;
			quote_schemas[ product_id ] = fetch( url + ( url.indexOf( '?' ) === -1 ? '?' : '&' ) + 'product_id=' + encodeURIComponent( product_id ), {
				headers: rest_headers(),
				credentials: 'same-origin'
			} ).then( function( response ) {
				return response.json().then( function( body ) {
					if ( ! response.ok ) throw PC.fe.quote.error( body.code, body.message, body.data );
					return body;
				} );
			} ).catch( function( error ) {
				delete quote_schemas[ product_id ];
				throw error;
			} );
		}
		return quote_schemas[ product_id ];
	};

	/**
	 * Check form values against the schema, as the server will
	 *
	 * @param {Object} values Keyed by field id.
	 * @param {Object} schema From get_schema().
	 * @return {Object} Messages keyed by field id; empty when valid.
	 */
	PC.fe.quote.validate_fields = function( values, schema ) {
		var errors = {};
		values = values || {};
		( schema.fields || [] ).forEach( function( field ) {
			var value = values[ field.id ];
			var empty = 'checkbox' === field.type ? ! value : ( undefined === value || null === value || '' === String( value ).trim() );
			if ( empty ) {
				if ( field.required ) errors[ field.id ] = quote_lang( 'required_error_message', '%s is required' ).replace( '%s', field.label );
				return;
			}
			if ( field.maxlength && String( value ).length > field.maxlength ) {
				errors[ field.id ] = quote_lang( 'quote_field_too_long', '%s is too long' ).replace( '%s', field.label );
			} else if ( 'email' === field.type && ! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test( String( value ).trim() ) ) {
				errors[ field.id ] = quote_lang( 'quote_field_invalid', '%s is not valid' ).replace( '%s', field.label );
			}
		} );
		/**
		 * Filter PC.fe.quote.validate_fields: add-ons validate their own field types.
		 *
		 * @param {Object} errors
		 * @param {Object} values
		 * @param {Object} schema
		 */
		return wp.hooks.applyFilters( 'PC.fe.quote.validate_fields', errors, values, schema );
	};

	/**
	 * A one-time token for sending a request
	 *
	 * @param {Object} [captcha] Captcha response fields (cf-turnstile-response / h-captcha-response).
	 * @return {Promise<string>}
	 */
	PC.fe.quote.get_token = function( captcha ) {
		var config = quote_config();
		var url = PC_config.frontend_action_token_url;
		var body = _.extend( { purpose: config.token_purpose, product_id: PC.fe.quote.get_product_id() }, captcha || {} );
		return fetch( url, {
			method: 'POST',
			headers: rest_headers(),
			credentials: 'same-origin',
			body: JSON.stringify( body )
		} ).then( function( response ) {
			return response.json().then( function( data ) {
				if ( ! response.ok || ! data.token ) throw PC.fe.quote.error( data.code || 'mkl_pc_quote_token', data.message, data.data );
				return data.token;
			} );
		} );
	};

	/**
	 * Picture of the viewer, as a PNG data URL
	 *
	 * @param {string|Blob|boolean} image 'auto' captures the viewer; a Blob or data URL is used as is.
	 * @return {Promise<string>}
	 */
	PC.fe.quote.get_image = async function( image ) {
		if ( ! image ) return '';
		if ( 'auto' === image ) {
			if ( 'function' !== typeof PC.fe.capture_viewer_image ) return '';
			var size = PC.fe.config.cart_screenshot_size || { width: 800, height: 800 };
			image = await PC.fe.capture_viewer_image( { view: 'current', width: size.width, height: size.height } );
			if ( ! image ) return '';
		}
		if ( 'string' === typeof image ) return image;
		return new Promise( function( resolve ) {
			var reader = new FileReader();
			reader.onloadend = function() { resolve( reader.result || '' ); };
			reader.onerror = function() { resolve( '' ); };
			reader.readAsDataURL( image );
		} );
	};

	/**
	 * Send a quote request for the current configuration
	 *
	 * Rejects with an Error carrying `code`, and `field_errors` / `configuration_errors` when the form or
	 * the configuration need fixing.
	 *
	 * @param {Object}  options
	 * @param {Object}  options.fields         Form values keyed by field id.
	 * @param {number}  [options.quantity]     Defaults to the configurator's quantity.
	 * @param {string|Blob|boolean} [options.image='auto'] Picture of the configuration (3D only).
	 * @param {Object}  [options.captcha]      Captcha response, when one is required.
	 * @param {string}  [options.honeypot]     Value of the form's hidden trap field.
	 * @param {boolean} [options.show_errors]  Show configuration errors in the configurator. Default: unless headless.
	 * @return {Promise<Object>} id, reference, store, message...
	 */
	PC.fe.quote.request = async function( options ) {
		options = _.extend( {
			fields: {},
			quantity: null,
			image: 'auto',
			captcha: null,
			honeypot: '',
			show_errors: ! ( PC.fe.is_headless && PC.fe.is_headless() )
		}, options || {} );

		if ( ! PC.fe.quote.is_enabled() ) {
			throw PC.fe.quote.error( 'mkl_pc_quote_disabled', quote_lang( 'quote_disabled', 'Quote requests are not available.' ) );
		}

		var check = await PC.fe.validate_configuration( { show_errors: options.show_errors, context: 'quote' } );
		if ( ! check.valid ) {
			throw PC.fe.quote.error( 'mkl_pc_quote_invalid_configuration', quote_lang( 'quote_configuration_invalid', 'Please check your configuration.' ), { configuration_errors: check.errors } );
		}

		var schema = await PC.fe.quote.get_schema();
		var field_errors = PC.fe.quote.validate_fields( options.fields, schema );
		if ( ! _.isEmpty( field_errors ) ) {
			throw PC.fe.quote.error( 'mkl_pc_quote_invalid_fields', quote_lang( 'quote_fields_invalid', 'Some fields need your attention.' ), { field_errors: field_errors } );
		}

		var image = schema.capture_image ? await PC.fe.quote.get_image( options.image ) : '';
		var token = await PC.fe.quote.get_token( options.captcha );

		var body = {
			product_id: PC.fe.active_product,
			quantity: options.quantity || ( PC.fe.get_qty ? PC.fe.get_qty() : 1 ),
			configuration: check.data,
			fields: options.fields,
			image: image,
			lang: PC.fe.lang || '',
			token: token,
			honeypot: options.honeypot || ''
		};

		/**
		 * Filter PC.fe.quote.request_body: the data sent to the server.
		 *
		 * @param {Object} body
		 * @param {Object} options
		 */
		body = wp.hooks.applyFilters( 'PC.fe.quote.request_body', body, options );

		var response = await fetch( schema.submit_url || quote_config().submit_url, {
			method: 'POST',
			headers: rest_headers(),
			credentials: 'same-origin',
			body: JSON.stringify( body )
		} );
		var result = await response.json();
		if ( ! response.ok ) {
			throw PC.fe.quote.error( result.code, result.message, result.data );
		}

		/**
		 * Action PC.fe.quote.sent: a quote request was sent.
		 *
		 * @param {Object} result Response: id, reference, message...
		 * @param {Object} body   What was sent.
		 */
		wp.hooks.doAction( 'PC.fe.quote.sent', result, body );
		return result;
	};
