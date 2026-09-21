/*
	PC.fe.views.form
*/
PC.fe.views.form = Backbone.View.extend({
	initialize: function( options ) {
		this.parent = options.parent || PC.fe;
		$( document.body ).on( 'added_to_cart', this.on_added_to_cart.bind( this ) );
		this.render();
		return this; 
	},
	events: {
		'click .configurator-add-to-cart': 'add_to_cart',
		'click .add-to-quote': 'add_to_quote'
	},
	render: function() {
		if ( ! PC.fe.config.cart_item_key ) {
			this.$( '.edit-cart-item' ).hide();
		} else if ( PC.fe.config.cart_item_key && this.$( '.edit-cart-item' ).length ) { 
			this.$el.addClass( 'edit-cart-item-is-displayed');
		}

		if ( 'variable' === PC.fe.product_type || 'variation' === PC.fe.product_type ) {
			var atc = $( '[name=variation_id][value=' + PC.fe.active_product + ']' );
			if ( ! atc.length ) atc = $( '[name=add-to-cart][value=' + PC.fe.active_product + ']' );
		} else {
			var atc = $( '[name=add-to-cart][value=' + PC.fe.active_product + ']' );
		}

		var input = this.$( 'input[name=pc_configurator_data]' );

		if ( ! input.length && ! atc.length ) return;

		if ( input.length ) {
			// Get the input
			this.$input = input.first();
			// The cart must be the one containing the input
			this.$cart = this.$input.closest( 'form.cart' );
		} else {
			this.$input = atc.closest( 'form.cart' ).find( 'input[name=pc_configurator_data]' ).first();
			this.$cart = this.$input.closest( 'form.cart' );
		}

		// If the input isn't in the page, check in this view
		// if ( ! this.$input.length || PC.fe.currentProductData.product_info.force_form ) this.$input = this.$( 'input[name=pc_configurator_data]' );

		if ( ! this.$cart.find( '[name=add-to-cart]' ).length ) {
			this.$( '.configurator-add-to-cart' ).remove();
		}
		
		// The YITH button is printed only for a product YITH would quote, and sends its own request, so it
		// does not depend on YITH's markup being on the page. The other quote plugins still do.
		if ( ! this.$cart.find( '.afrfqbt_single_page' ).length ) {
			this.$( '.add-to-quote' ).not( '.yith-raq' ).remove();
		}
		if ( ! this.$cart.find( '.afrfqbt_single_page' ).length ) {
			this.$( '.add-to-quote' ).not( '.yith-raq' ).html( this.$cart.find( '.afrfqbt_single_page' ).html() );
		}
		if ( this.$( '.yith-raq.add-to-quote' ).length && PC_config.config.ywraq_hide_add_to_cart ) {
			this.$( '.configurator-add-to-cart' ).remove();
		}

		if ( this.$( 'input.qty' ).length ) {
			// A view of PC.fe.get_qty(): it reports edits and redraws itself when
			// the quantity changes anywhere else, so it no longer has to be kept
			// in step with the product form's input by copying values across.
			PC.fe.bind_qty_input( this.$( 'input.qty' ) );
			// Set min value
			if ( 'undefined' != typeof PC.fe.currentProductData.product_info.qty_min_value ) {
				this.$( 'input.qty' ).prop( 'min', PC.fe.currentProductData.product_info.qty_min_value );
			}
			// Set max value
			if ( 'undefined' != typeof PC.fe.currentProductData.product_info.qty_max_value ) {
				this.$( 'input.qty' ).prop( 'max', PC.fe.currentProductData.product_info.qty_max_value );
			}
		}

		wp.hooks.doAction( 'PC.fe.render_form', this );
		return this.$el;
	},

	validate_configuration: async function() {
		var data = await PC.fe.save_data.getSaveDataAsync();
		var errors = wp.hooks.applyFilters( 'PC.fe.validate_configuration', PC.fe.errors );
		if ( errors.length ) {
			if ( PC.fe.show_validation_errors ) {
				PC.fe.show_validation_errors( errors );
			}
			return false;
		}
		if ( PC.fe.clear_validation_errors ) {
			PC.fe.clear_validation_errors();
		}
		return data;
	},
	
	populate_form_input: function( data, e ) {

		if ( PC.fe.config.cart_item_key && $( e.currentTarget ).is( '.edit-cart-item' ) ) {
			var $cart_item_field = this.$cart.find( 'input[name=pc_cart_item_key]' );
			if ( $cart_item_field ) $cart_item_field.val( PC.fe.config.cart_item_key );
		}

		$( 'input[name=pc_configurator_data]' ).val( data );
	},

	add_to_cart: async function( e ) {

		var data = await this.validate_configuration();
		
		if ( ! data ) {
			return;
		}

		this.populate_form_input( data, e );

		if ( PC.fe.debug_configurator_data ) {
			console.log( 'debug_configurator_data', data );
		}

		wp.hooks.doAction( 'PC.fe.add_to_cart.before', this );

		if ( PC.fe.debug_configurator_data ) {
			console.log( 'debug_configurator_data after', data );
			return;
		}

		/**
		 * Filter PC.fe.trigger_add_to_cart: Will submit the form only returns true
		 *
		 * @param boolean should_submit
		 * @param object  $cart - The jQuery object
		 */
		if ( wp.hooks.applyFilters( 'PC.fe.trigger_add_to_cart', true, this.$cart ) ) {

			$( e.currentTarget ).addClass( 'adding-to-cart' );

			var btn;
			if ( this.$cart?.find( 'button[name=add-to-cart]' ).length ) {
				btn = this.$cart.find( 'button[name=add-to-cart]' );
			} else if ( this.$cart?.find( '.single_add_to_cart_button' ).length ) {
				btn = this.$cart.find( '.single_add_to_cart_button' );
			}

			if ( PC_config.config.enable_configurator_ajax_add_to_cart ) {

				if ( ! PC.fe.add_to_cart_modal ) PC.fe.add_to_cart_modal = new PC.fe.views.add_to_cart_modal();

				/*
					Prepare data 
				*/
				// if ( this.$cart.find( '[name="add-to-cart"]' ).length ) {
					// var request_body = new FormData( this.$cart[0], this.$cart.find( '[name="add-to-cart"]' )[0] );
				// } else {
				// }
				var request_body = new FormData( this.$cart[0] );

				// Remove 'add-to-cart' to prevent triggering default WC's actions
				request_body.delete( 'add-to-cart' );

				var data = {
					product_id: PC.fe.active_product,
					mkl_pc_ajax: 1
				};
				if ( btn ) {
					$.each( btn.data(), function( key, value ) {
						data[ key ] = value;
					});
		
					// Fetch data attributes in $thisbutton. Give preference to data-attributes because they can be directly modified by javascript
					// while `.data` are jquery specific memory stores.
					$.each( btn[0].dataset, function( key, value ) {
						data[ key ] = value;
					});

				}
				
				$( document.body ).trigger( 'adding_to_cart', [ btn, data ] );

				$.each( data, function( key, value ) {
					if ( ! request_body.has( key ) ) {
						request_body.append( key, value );
					}
				});

				// Cart image: ask the viewer for a picture of the configuration.
				var dataUrl = await this.capture_item_image();
				if ( dataUrl ) request_body.append( 'pc_3d_screenshot', dataUrl );

				/**
				 * Append extra multipart fields (add-ons). Default FormData is unchanged.
				 *
				 * @param {FormData} request_body Body sent to `pc_add_to_cart`.
				 * @param {Backbone.View} form_view This form view instance.
				 */
				wp.hooks.doAction( 'PC.fe.add_to_cart.append_ajax_request_body', request_body, this );

				/* 
					Add to cart request
				*/
				fetch(
					wc_add_to_cart_params.ajax_url + '?action=pc_add_to_cart', {
						method: 'POST',
						body: request_body
					}
				)
				.then( response => response.json() )
				.then( data => {

					if ( data.error ) {
						if ( data.product_url ) {
							window.location = data.product_url;
							return;
						}

						$( document.body ).trigger( 'not_added_to_cart_with_error', [ data ] );
						return;
					}

					// Redirect to cart option
					if ( 'yes' === wp.hooks.applyFilters( 'PC.fe.cart_redirect_after_add', wc_add_to_cart_params.cart_redirect_after_add ) ) {
						$( document.body ).trigger( 'added_to_cart_with_redirection', [ data ] );
						window.location = wp.hooks.applyFilters( 'PC.fe.cart_redirect_url', wc_add_to_cart_params.cart_url );
						return;
					}
					
					$( document.body ).trigger( 'added_to_cart', [ data.fragments, data.cart_hash, btn, data] );
					if ( PC.fe.config.close_configurator_on_add_to_cart && ! PC.fe.inline ) PC.fe.modal.close();
				} )
				.catch( error => {
					console.error( 'Configurator: Error in form submission' );
					console.error( error );
				} )
				.finally( () => {
					/**
					 * Run after ajax add-to-cart settles (success, error, or network failure).
					 *
					 * @param {Backbone.View} form_view This form view instance.
					 */
					wp.hooks.doAction( 'PC.fe.add_to_cart.ajax_request_finally', this );
				} );

				return;
			}

			$( document.body ).one( 'adding_to_cart', this.on_adding_to_cart );

			if ( btn ) {
				if ( btn.is( '.ajax_add_to_cart' ) ) {
					btn.data( 'pc_configurator_data', data );
					// Edit item in the cart
					if ( btn.is( '.edit-cart-item' ) ) {
						btn.data( 'pc_cart_item_key', PC.fe.config.cart_item_key );
					}
				}
				btn.trigger( 'click' );
			} else {
				this.$cart.trigger( 'submit' );
			}
		}

		if ( PC.fe.config.close_configurator_on_add_to_cart && ! PC.fe.inline ) PC.fe.modal.close();
	},

	reset_after_ajax_add_to_cart: function() {
		if ( ! wp.hooks.applyFilters(
			'PC.fe.reset.on.ajax_add_to_cart',
			PC.fe.config.reset_configurator_on_ajax_add_to_cart,
			this
		) ) return;

		if ( PC.fe.modal ) {
			PC.fe.modal.resetConfig();
			PC.fe.save_data.reset_errors();
		}

		$( 'input[name=pc_configurator_data]' ).val( '' );

		var default_qty = PC.fe.currentProductData?.product_info?.qty_min_value || 1;
		PC.fe.set_qty( default_qty );
		wp.hooks.doAction( 'PC.fe.reset_after_ajax_add_to_cart', this );
	},

	/**
	 * Add compatibility with Ajax Add to cart 
	 * @param {*} e       Event
	 * @param {*} $button button object
	 * @param {*} data    The data sent
	 */
	on_adding_to_cart: function( e, $button, data ) {
		PC.fe.modal.$el.addClass( 'adding-to-cart' );
		if ( 'object' == typeof data && ! data.pc_configurator_data ) {
			data.pc_configurator_data = $( 'input[name=pc_configurator_data]' ).val();
		}

		if ( 'string' == typeof data && -1 == data.search( 'pc_configurator_data' ) ) {
			data += '&pc_configurator_data=' + $( 'input[name=pc_configurator_data]' ).val();
		}
	},

	/**
	 * Add compatibility with Ajax Add to cart - Remove adding to cart class
	 * @param {*} e         Event
	 * @param {*} fragments Cart fragments
	 * @param {*} cart_hash Cart hash
	 * @param {*} $button   button object
	 */
	on_added_to_cart: function( e, fragments, cart_hash, $button ) {
		PC.fe.modal.$el.removeClass( 'adding-to-cart' );
		this.reset_after_ajax_add_to_cart();
	},
	
	add_to_quote: async function( e ) {

		var data = await this.validate_configuration();
		
		if ( ! data ) {
			return;
		}

		this.populate_form_input( data, e );

		wp.hooks.doAction( 'PC.fe.add_to_quote.before', this );

		if ( PC.fe.debug_configurator_data ) {
			console.log( 'debug_configurator_data', data );
			return;
		}

		// YITH: our own request, see add_to_yith_quote().
		if ( $( e.currentTarget ).is( '.yith-raq' ) ) {
			return this.add_to_yith_quote( data, $( e.currentTarget ) );
		}

		// The other quote plugins post the product form themselves, so the picture of the configuration
		// has to travel as a form field - there is no request body of ours to append it to.
		var dataUrl = await this.capture_item_image();
		if ( dataUrl ) this.set_quote_screenshot_field( dataUrl );

		// Woocommerce Add To Quote plugin
		if ( $( '.afrfqbt_single_page' ).length ) {
			$( '.afrfqbt_single_page' ).trigger( 'click' );
			if ( PC.fe.config.close_configurator_on_add_to_cart && ! PC.fe.inline ) PC.fe.modal.close();
		}
	},

	/**
	 * Add the configuration to the YITH quote list through pc_add_to_quote.
	 *
	 * Posts the configurator's form like the ajax add to cart does, so variation attributes and
	 * add-on fields come along, but needs nothing of YITH on the page. The configurator stays open
	 * until the answer is back, so a refusal is shown where the shopper can act on it.
	 *
	 * @param {string} data    Configuration JSON.
	 * @param {jQuery} $button The button clicked.
	 */
	add_to_yith_quote: async function( data, $button ) {
		if ( $button.hasClass( 'adding-to-quote' ) ) return;
		$button.addClass( 'adding-to-quote' ).prop( 'disabled', true );

		var request_body = this.$cart && this.$cart.length ? new FormData( this.$cart[0] ) : new FormData();
		// Nothing here is an add to cart.
		request_body.delete( 'add-to-cart' );
		request_body.delete( 'pc_3d_screenshot' );
		request_body.set( 'product_id', PC.fe.active_product );
		request_body.set( 'pc_configurator_data', data );
		if ( 'function' === typeof PC.fe.get_qty ) request_body.set( 'quantity', PC.fe.get_qty() );

		var dataUrl = await this.capture_item_image();
		if ( dataUrl ) request_body.append( 'pc_3d_screenshot', dataUrl );

		/**
		 * Append extra multipart fields to the quote request.
		 *
		 * @param {FormData}      request_body Body sent to `pc_add_to_quote`.
		 * @param {Backbone.View} form_view    This form view instance.
		 */
		wp.hooks.doAction( 'PC.fe.add_to_quote.append_ajax_request_body', request_body, this );

		var response;
		try {
			var raw = await fetch( PC_config.ajaxurl + '?action=pc_add_to_quote', {
				method: 'POST',
				credentials: 'same-origin',
				body: request_body
			} );
			response = await raw.json();
		} catch ( error ) {
			console.error( 'Configurator: Error adding to the quote' );
			console.error( error );
			response = { result: 'error', message: '' };
		}

		$button.removeClass( 'adding-to-quote' ).prop( 'disabled', false );

		if ( ! response || 'error' === response.result || ! response.result ) {
			/**
			 * The configuration could not be added to the quote list.
			 *
			 * @param {Object}        response Server answer: result, message.
			 * @param {Backbone.View} form_view This form view instance.
			 */
			wp.hooks.doAction( 'PC.fe.add_to_quote.failed', response, this );
			$( document.body ).trigger( 'pc_not_added_to_quote', [ response ] );
			this.show_quote_error( response && response.message );
			return;
		}

		/**
		 * The configuration is in the quote list.
		 *
		 * @param {Object}        response Server answer: result (added|updated), message, item_key, list_url, count, redirect.
		 * @param {Backbone.View} form_view This form view instance.
		 */
		wp.hooks.doAction( 'PC.fe.add_to_quote.added', response, this );
		$( document.body ).trigger( 'pc_added_to_quote', [ response ] );

		// YITH's quote list widgets, when the page has them.
		if ( $.fn.ywraq_refresh_widget ) {
			var $widgets = $( '.widget_ywraq_list_quote, .widget_ywraq_mini_list_quote' );
			if ( $widgets.length ) $widgets.ywraq_refresh_widget();
		}

		if ( response.redirect && response.list_url ) {
			window.location.href = response.list_url;
			return;
		}

		if ( ! PC.fe.inline ) PC.fe.modal.close();
		if ( PC_config.config.ywraq_hide_add_to_cart && PC.fe.trigger_el && PC.fe.trigger_el[0] && 'button' === PC.fe.trigger_el[0].type ) {
			$( PC.fe.trigger_el[0] ).remove();
		}
	},

	/**
	 * Show a quote refusal in the configurator, in the add to cart modal.
	 *
	 * @param {string} message HTML message from the server.
	 */
	show_quote_error: function( message ) {
		if ( ! PC.fe.add_to_cart_modal ) PC.fe.add_to_cart_modal = new PC.fe.views.add_to_cart_modal();
		$( document.body ).addClass( 'show-add-to-cart-modal' );
		PC.fe.add_to_cart_modal.show_message( 'not-added', message || PC_config.config.ywraq_error_message || '' );
	},

	/**
	 * The picture that goes with a cart or quote item: a capture of the viewer, for 3D only.
	 *
	 * Goes through PC.fe.capture_viewer_image so any viewer that implements the capture contract
	 * works here, not just the 3D one.
	 *
	 * @return {Promise<string|null>} PNG data URL, or null.
	 */
	capture_item_image: async function() {
		if ( ! PC.fe.config.show_image_in_cart || ! PC.fe.currentProductData || ! PC.fe.currentProductData.product_info || PC.fe.currentProductData.product_info.configurator_type !== '3d' ) {
			return null;
		}
		var size = PC.fe.config.cart_screenshot_size || { width: 800, height: 800 };
		var blob = await PC.fe.capture_viewer_image( { view: 'current', width: size.width, height: size.height } );
		if ( ! blob ) return null;
		return new Promise( function( resolve ) {
			var reader = new FileReader();
			reader.onloadend = function() { resolve( reader.result ); };
			reader.onerror = function() { resolve( null ); };
			reader.readAsDataURL( blob );
		} );
	},
	/**
	 * Carry the viewer's picture in the product form, for quote plugins that serialize it.
	 *
	 * The field is only added once there is something to send, so a form without a
	 * configuration never posts an empty one.
	 *
	 * @param {string} data_url PNG data URL.
	 */
	set_quote_screenshot_field: function( data_url ) {
		if ( ! this.$cart || ! this.$cart.length ) return;
		var $field = this.$cart.find( 'input[name=pc_3d_screenshot]' );
		if ( ! $field.length ) {
			$field = $( '<input type="hidden" name="pc_3d_screenshot">' ).appendTo( this.$cart );
		}
		$field.val( data_url );
	},
	/**
	 * Kept for third-party code that calls it directly. The input itself is
	 * bound through PC.fe.bind_qty_input, and refreshing the displayed price now
	 * happens on PC.fe.qty_changed, so it runs whichever input was edited.
	 */
	qty_change: function( e ) {
		PC.fe.set_qty( $( e.target ).val(), { source: e.target } );
	}
} );
