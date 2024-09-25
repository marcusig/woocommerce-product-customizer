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
		
		// Get the input
		this.$input = $( 'input[name=pc_configurator_data]' );
		
		// If the input isn't in the page, check in this view
		if ( ! this.$input.length || PC.fe.currentProductData.product_info.force_form ) this.$input = this.$( 'input[name=pc_configurator_data]' );

		// The cart must be the one containing the input
		this.$cart = this.$input.closest( 'form.cart' );

		if ( ! this.$cart.find( '[name=add-to-cart]' ).length ) {
			this.$( '.configurator-add-to-cart' ).remove();
		}
		
		if ( ! this.$cart.find( '.afrfqbt_single_page' ).length && ! $( '.add-request-quote-button' ).length ) {
			this.$( '.add-to-quote' ).remove();
		}
		if ( ! this.$cart.find( '.afrfqbt_single_page' ).length ) {
			this.$( '.add-to-quote' ).html( this.$cart.find( '.afrfqbt_single_page' ).html() );
		}
		if ( $( '.add-request-quote-button' ).length && PC_config.config.ywraq_hide_add_to_cart ) {
			this.$( '.configurator-add-to-cart' ).remove();
		}

		if ( this.$( 'input.qty' ).length ) {
			// Get qty with the Cart's input
			if ( this.$( 'input.qty' ) != this.$cart.find( '.qty' ) ) {
				this.$( 'input.qty' ).val( this.$cart.find( '.qty' ).val() );
			}
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

	validate_configuration: function() {
		var data = PC.fe.save_data.save();
		var errors = wp.hooks.applyFilters( 'PC.fe.validate_configuration', PC.fe.errors );
		if ( errors.length ) {
			// show errors and prevent adding to cart
			console.log( errors );
			var messages = [];
			_.each( errors, function( error ) {
				if ( error.choice ) {
					error.choice.set( 'has_error', error.message );
				}
				if ( error.layer ) {
					error.layer.set( 'has_error', error.message );
				}
				messages.push( PC.utils.strip_html( error.message ) );
			} );
			alert( messages.join( "\n" ) );
			return false;
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

	add_to_cart: function( e ) {

		var data = this.validate_configuration();
		
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
			$( document.body ).one( 'adding_to_cart', this.on_adding_to_cart );
			$( e.currentTarget ).addClass( 'adding-to-cart' );

			var btn;
			if ( this.$cart.find( 'button[name=add-to-cart]' ).length ) {
				btn = this.$cart.find( 'button[name=add-to-cart]' );
			} else if ( this.$cart.find( '.single_add_to_cart_button' ).length ) {
				btn = this.$cart.find( '.single_add_to_cart_button' );
			}

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
	},
	
	add_to_quote: function( e ) {

		var data = this.validate_configuration();
		
		if ( ! data ) {
			return;
		}

		this.populate_form_input( data, e );

		wp.hooks.doAction( 'PC.fe.add_to_quote.before', this );

		if ( PC.fe.debug_configurator_data ) {
			console.log( 'debug_configurator_data', data );
			return;
		}

		// Woocommerce Add To Quote plugin
		if ( $( '.afrfqbt_single_page' ).length ) {
			$( '.afrfqbt_single_page' ).trigger( 'click' );
			if ( PC.fe.config.close_configurator_on_add_to_cart && ! PC.fe.inline ) PC.fe.modal.close();
		}

		if ( $( e.currentTarget ).is( '.yith-raq' ) ) {
			$( '.add-request-quote-button' ).trigger( 'click' );
			if ( ! PC.fe.inline ) PC.fe.modal.close();
			if ( PC_config.config.ywraq_hide_add_to_cart ) {
				if ( 'button' === PC.fe.trigger_el[0].type ) $( PC.fe.trigger_el[0] ).remove();
			}
		}
	},
} );
