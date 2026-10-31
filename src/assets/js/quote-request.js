var PC = PC || {};
PC.fe = PC.fe || {};

/**
 * Loaded only when quote requests are enabled, after the configurator's main script:
 * a page can test for PC.fe.quote before offering a quote request.
 */
!( function( $, _ ) {
	'use strict';

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
		return window.PC_quote_request || {};
	};

	var quote_lang = function( key, fallback ) {
		var own = quote_config().lang || {};
		var core = ( 'undefined' !== typeof PC_config && PC_config.lang ) || {};
		return own[ key ] || core[ key ] || fallback;
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
		return !! quote_config().submit_url;
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
					// Labels in the page's language: the REST request may not have known it.
					var labels = quote_config().labels || {};
					_.each( body.fields || [], function( field ) {
						if ( labels[ field.id ] ) field.label = labels[ field.id ];
					} );
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
				errors[ field.id ] = quote_lang( 'field_too_long', '%s is too long' ).replace( '%s', field.label );
			} else if ( 'email' === field.type && ! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test( String( value ).trim() ) ) {
				errors[ field.id ] = quote_lang( 'field_invalid', '%s is not valid' ).replace( '%s', field.label );
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
	 * Values of the fields filled in outside the request form, such as Form builder layers holding contact fields
	 *
	 * @return {Object} Values keyed by field id.
	 */
	PC.fe.quote.get_hosted_values = function() {
		/**
		 * Filter PC.fe.quote.field_values: values of request fields shown outside the request form.
		 *
		 * @param {Object} values Keyed by field id.
		 */
		return wp.hooks.applyFilters( 'PC.fe.quote.field_values', {} ) || {};
	};

	/**
	 * Fields the request form shows: the schema's, minus those shown elsewhere
	 *
	 * @param {Object} schema
	 * @return {Array}
	 */
	PC.fe.quote.get_form_fields = function( schema ) {
		/**
		 * Filter PC.fe.quote.form_fields: the fields shown in the request form.
		 *
		 * @param {Array}  fields
		 * @param {Object} schema
		 */
		return wp.hooks.applyFilters( 'PC.fe.quote.form_fields', ( schema && schema.fields ) || [], schema ) || [];
	};

	/**
	 * Send a quote request for the current configuration
	 *
	 * Rejects with an Error carrying `code`, and `field_errors` / `configuration_errors` when the form or
	 * the configuration need fixing.
	 *
	 * @param {Object}  options
	 * @param {Object}  options.fields         Form values keyed by field id, over the values of fields shown outside the form.
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
			throw PC.fe.quote.error( 'mkl_pc_quote_disabled', quote_lang( 'disabled', 'Quote requests are not available.' ) );
		}

		var check = await PC.fe.validate_configuration( { show_errors: options.show_errors, context: 'quote' } );
		if ( ! check.valid ) {
			throw PC.fe.quote.error( 'mkl_pc_quote_invalid_configuration', quote_lang( 'configuration_invalid', 'Please check your configuration.' ), { configuration_errors: check.errors } );
		}

		var schema = await PC.fe.quote.get_schema();
		var fields = _.extend( {}, PC.fe.quote.get_hosted_values(), options.fields );
		var field_errors = PC.fe.quote.validate_fields( fields, schema );
		if ( ! _.isEmpty( field_errors ) ) {
			throw PC.fe.quote.error( 'mkl_pc_quote_invalid_fields', quote_lang( 'fields_invalid', 'Some fields need your attention.' ), { field_errors: field_errors } );
		}

		var image = schema.capture_image ? await PC.fe.quote.get_image( options.image ) : '';
		var token = await PC.fe.quote.get_token( options.captcha );

		var body = {
			product_id: PC.fe.active_product,
			quantity: options.quantity || ( PC.fe.get_qty ? PC.fe.get_qty() : 1 ),
			configuration: check.data,
			fields: fields,
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

		/**
		 * Filter PC.fe.quote.request_files: files sent with the request.
		 *
		 * @param {Array}  files { name, file } objects. The name is the form field the server reads them from, ending in [] for several.
		 * @param {Object} body
		 */
		var files = wp.hooks.applyFilters( 'PC.fe.quote.request_files', [], body ) || [];
		var headers = rest_headers();
		var payload = JSON.stringify( body );
		if ( files.length ) {
			// Multipart: the request itself travels as JSON in one field.
			delete headers[ 'Content-Type' ];
			payload = new FormData();
			payload.append( 'request', JSON.stringify( body ) );
			_.each( files, function( item ) {
				payload.append( item.name, item.file, item.file.name );
			} );
		}

		var response = await fetch( schema.submit_url || quote_config().submit_url, {
			method: 'POST',
			headers: headers,
			credentials: 'same-origin',
			body: payload
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

	/*
	 * The configurator's own quote request: a button next to, or instead of, Add to cart, and a form
	 * shown in the add to cart modal. Headless pages use PC.fe.quote.request() instead.
	 */

	/**
	 * Where the quote request goes for the active product
	 *
	 * @return {string} 'alongside' or 'replace' (from the settings), 'quote_only' or 'off' (set on the product)
	 */
	PC.fe.quote.get_mode = function() {
		var info = ( PC.fe.currentProductData && PC.fe.currentProductData.product_info ) || {};
		if ( 'off' === info.quote_request || 'quote_only' === info.quote_request ) return info.quote_request;
		return 'replace' === quote_config().placement ? 'replace' : 'alongside';
	};

	/**
	 * Put the button in the configurator's form. Safe to call again.
	 *
	 * @param {jQuery} $form The footer's form element.
	 */
	PC.fe.quote.add_button = function( $form ) {
		if ( ! $form || ! $form.length ) return;
		var mode = PC.fe.quote.get_mode();
		$form.find( '.mkl-pc-request-quote' ).remove();
		$form.closest( '.mkl_pc_footer' ).toggleClass( 'mkl-pc-quote-only', 'quote_only' === mode );
		if ( 'off' === mode || ! document.getElementById( 'tmpl-mkl-pc-quote-request-button' ) ) return;

		if ( 'alongside' !== mode ) {
			$form.find( '.configurator-add-to-cart' ).remove();
		}
		var $button = $( wp.template( 'mkl-pc-quote-request-button' )() );
		var $atc = $form.find( '.configurator-add-to-cart' ).last();
		if ( $atc.length ) {
			$atc.after( $button );
		} else if ( $form.find( '.pc_configurator_form' ).length ) {
			$form.find( '.pc_configurator_form' ).append( $button );
		} else {
			$form.append( $button );
		}

		$form.off( 'click.mklPcQuote' ).on( 'click.mklPcQuote', '.mkl-pc-request-quote', function( event ) {
			event.preventDefault();
			PC.fe.quote.open_form( event.currentTarget );
		} );

		// The form opens without waiting for its fields.
		PC.fe.quote.get_schema().catch( function() {} );

		/**
		 * Action PC.fe.quote.button_added: the quote request button is in the configurator.
		 *
		 * @param {jQuery} $button
		 * @param {string} mode
		 */
		wp.hooks.doAction( 'PC.fe.quote.button_added', $button, mode );
	};

	wp.hooks.addAction( 'PC.fe.render_form', 'mkl/pc/quote-request', function( form ) {
		PC.fe.quote.add_button( form.$el );
	} );

	// The footer is mounted before PC.fe.start, including when its form returned before PC.fe.render_form.
	wp.hooks.addAction( 'PC.fe.start', 'mkl/pc/quote-request', function( configurator ) {
		var modal = PC.fe.modal || configurator;
		if ( modal && modal.footer && modal.footer.form ) {
			PC.fe.quote.add_button( modal.footer.form.$el );
		}
	} );

	/**
	 * Open the request form, or send the request when there is nothing left to ask in it
	 *
	 * The configuration is checked first, so a customer does not fill the form in for nothing.
	 *
	 * @param {Element} [trigger] Gets the focus back when the form closes.
	 * @return {Promise}
	 */
	PC.fe.quote.open_form = async function( trigger ) {
		var check = await PC.fe.validate_configuration( { show_errors: true, context: 'quote' } );
		if ( ! check.valid ) return;
		if ( ! PC.fe.add_to_cart_modal ) PC.fe.add_to_cart_modal = new PC.fe.views.add_to_cart_modal();
		if ( ! PC.fe.quote.form_view ) PC.fe.quote.form_view = new PC.fe.quote.Form_View();
		return PC.fe.quote.form_view.open( PC.fe.add_to_cart_modal, trigger );
	};

	if ( window.Backbone ) {
		/**
		 * The request form, shown in the add to cart modal
		 */
		PC.fe.quote.Form_View = Backbone.View.extend( {
			className: 'mkl-pc-quote-request',
			// Escape and Tab are handled by the add to cart modal, through the configurator's keyboard listener.
			attributes: {
				role: 'dialog',
				'aria-modal': 'true'
			},
			events: {
				'submit form': 'submit',
				'click .mkl-pc-quote-back': 'back_to_form'
			},
			initialize: function() {
				this.values = {};
				this.errors = {};
				this.message = '';
				this.schema = null;
			},

			/**
			 * @param {Backbone.View} modal   The add to cart modal.
			 * @param {Element}       trigger
			 * @return {Promise}
			 */
			open: async function( modal, trigger ) {
				this.modal = modal;
				// Gets the focus back when the modal closes.
				this.trigger_el = trigger || null;
				try {
					this.schema = await PC.fe.quote.get_schema();
				} catch ( error ) {
					this.show( 'mkl-pc-quote-request-error', { message: error.message || quote_lang( 'send_failed', 'Your request could not be sent.' ), can_retry: false } );
					this.focus_action();
					return;
				}
				this.errors = {};
				this.message = '';
				this.form_fields = PC.fe.quote.get_form_fields( this.schema );
				/**
				 * Filter PC.fe.quote.needs_form: whether the request form is shown before sending.
				 * Without fields to show, the request is sent straight away.
				 *
				 * @param {boolean} needs_form
				 * @param {Object}  schema
				 */
				this.needs_form = wp.hooks.applyFilters( 'PC.fe.quote.needs_form', this.form_fields.length > 0, this.schema );
				if ( ! this.needs_form ) {
					this.values = {};
					return this.send( '' );
				}
				this.render();
				this.focus_field();
			},

			/**
			 * Show a template in the modal
			 *
			 * @param {string} template_id
			 * @param {Object} data
			 */
			show: function( template_id, data ) {
				this.modal.open( this.trigger_el );
				this.modal.set_busy( false );
				// Emptied by the modal's own messages, which also drops this view's events.
				this.modal.$el.children().not( this.$el ).remove();
				if ( ! $.contains( this.modal.$el[0], this.el ) ) this.modal.$el.append( this.$el );
				/**
				 * Action PC.fe.quote.form.before_show: the view's content is about to be replaced.
				 * Detach elements added on PC.fe.quote.form.render, or they lose their events.
				 *
				 * @param {Backbone.View} view
				 */
				wp.hooks.doAction( 'PC.fe.quote.form.before_show', this );
				this.$el.html( wp.template( template_id )( data || {} ) );
				this.$el.attr( 'aria-labelledby', this.$( '.mkl-pc-quote-title' ).first().attr( 'id' ) || null );
				this.delegateEvents();
			},

			render: function() {
				this.show( 'mkl-pc-quote-request-form', {
					fields: this.form_fields,
					values: this.values,
					errors: this.errors,
					message: this.message
				} );
				this.$( 'form' ).attr( 'aria-labelledby', 'mkl-pc-quote-form-title' );
				/**
				 * Action PC.fe.quote.form.render: the request form is displayed.
				 * Add-ons add their sections to .mkl-pc-quote-form__fields.
				 *
				 * @param {Backbone.View} view
				 */
				wp.hooks.doAction( 'PC.fe.quote.form.render', this );
				return this;
			},

			/**
			 * The values in the form
			 *
			 * @return {Object}
			 */
			collect: function() {
				var view = this;
				var values = {};
				_.each( this.form_fields || [], function( field ) {
					var $input = view.$( '[name="' + field.id + '"]' );
					if ( 'checkbox' === field.type ) {
						values[ field.id ] = $input.is( ':checked' );
					} else if ( 'radio' === field.type ) {
						values[ field.id ] = $input.filter( ':checked' ).val() || '';
					} else {
						values[ field.id ] = $input.val() || '';
					}
				} );
				return values;
			},

			submit: async function( event ) {
				event.preventDefault();
				this.values = this.collect();
				var errors = PC.fe.quote.validate_fields( this.values, { fields: this.form_fields } );
				/**
				 * Filter PC.fe.quote.form.valid: whether the sections added to the form are filled in.
				 * Add-ons show their own errors.
				 *
				 * @param {boolean}       valid
				 * @param {Backbone.View} view
				 */
				var sections_valid = wp.hooks.applyFilters( 'PC.fe.quote.form.valid', true, this );
				if ( ! _.isEmpty( errors ) || ! sections_valid ) {
					this.show_errors( errors, quote_lang( 'fields_invalid', 'Some fields need your attention.' ) );
					return;
				}
				return this.send( this.$( '[name=website]' ).val() || '' );
			},

			/**
			 * @param {string} honeypot Value of the form's trap field.
			 */
			send: async function( honeypot ) {
				this.show( 'mkl-pc-quote-request-sending' );
				this.modal.set_busy( true );
				// Keeps the focus in the dialog while the form is gone.
				this.$( '.mkl-pc-quote-sending' ).trigger( 'focus' );
				try {
					var result = await PC.fe.quote.request( { fields: this.values, honeypot: honeypot, show_errors: true } );
					this.sent( result );
				} catch ( error ) {
					this.failed( error );
				}
			},

			/**
			 * @param {Object} result
			 */
			sent: function( result ) {
				if ( result.redirect ) {
					window.location.href = result.redirect;
					return;
				}
				this.show( 'mkl-pc-quote-request-sent', { message: result.message || '', reference: result.reference || '' } );
				// Read first, then the message and the button follow.
				this.$( '.mkl-pc-quote-title' ).trigger( 'focus' );
			},

			/**
			 * @param {Error} error From PC.fe.quote.request().
			 */
			failed: function( error ) {
				if ( 'mkl_pc_quote_invalid_fields' === error.code && ! _.isEmpty( error.field_errors ) ) {
					var form_ids = _.pluck( this.form_fields || [], 'id' );
					var own = _.pick( error.field_errors, form_ids );
					var elsewhere = _.omit( error.field_errors, form_ids );
					if ( ! this.needs_form ) this.close();
					if ( ! _.isEmpty( elsewhere ) ) {
						/**
						 * Action PC.fe.quote.field_errors: errors of fields shown outside the request form.
						 *
						 * @param {Object}        errors  Messages keyed by field id.
						 * @param {Backbone.View} view
						 */
						wp.hooks.doAction( 'PC.fe.quote.field_errors', elsewhere, this );
					}
					if ( this.needs_form ) this.show_errors( own, error.message );
					return;
				}
				if ( 'mkl_pc_quote_invalid_configuration' === error.code ) {
					// The configurator shows what to fix.
					this.close();
					return;
				}
				this.show( 'mkl-pc-quote-request-error', {
					message: error.message || quote_lang( 'send_failed', 'Your request could not be sent.' ),
					can_retry: true
				} );
				this.focus_action();
			},

			/**
			 * @param {Object} errors  Messages keyed by field id.
			 * @param {string} message
			 */
			show_errors: function( errors, message ) {
				this.errors = errors;
				this.message = message || '';
				this.render();
				if ( ! _.isEmpty( errors ) ) {
					this.focus_field( _.keys( errors )[0] );
					return;
				}
				// An error in a section added by an add-on.
				var $invalid = this.$( '[aria-invalid="true"], .has-error :input' ).filter( ':visible' ).first();
				if ( $invalid.length ) {
					$invalid.trigger( 'focus' );
				} else {
					this.focus_field();
				}
			},

			back_to_form: function() {
				// Sent without the form: the fields to correct are in the configurator.
				if ( ! this.needs_form ) {
					this.close();
					return;
				}
				this.render();
				this.focus_field();
			},

			/**
			 * @param {string} [field_id] Defaults to the first field.
			 */
			focus_field: function( field_id ) {
				var $field = field_id ? this.$( '[data-field="' + field_id + '"]' ) : this.$( '.mkl-pc-quote-form__fields' );
				$field.find( 'input, textarea, select' ).not( '[tabindex="-1"]' ).filter( ':visible' ).first().trigger( 'focus' );
			},

			/**
			 * Focus the way out of an error: back to the form, or close
			 */
			focus_action: function() {
				var $back = this.$( '.mkl-pc-quote-back' );
				( $back.length ? $back : this.$( 'button' ) ).first().trigger( 'focus' );
			},

			close: function() {
				if ( this.modal ) this.modal.close();
			}
		} );
	}

} )( jQuery, PC._us || window._ );
