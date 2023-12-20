/*
	PC.fe.views.form
*/
PC.fe.views.form = Backbone.View.extend({
	initialize: function( options ) {
		this.parent = options.parent || PC.fe;
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
					error.choice.set( 'has_error', error );
				}
				if ( error.layer ) {
					error.layer.set( 'has_error', error );
				}
				messages.push( error.message );
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
			$( e.currentTarget ).addClass( 'adding-to-cart' );
			if ( this.$cart.find( 'button[name=add-to-cart]' ).length ) {
				var btn = this.$cart.find( 'button[name=add-to-cart]' );
				if ( btn.is( '.ajax_add_to_cart' ) ) {
					btn.data( 'pc_configurator_data', data );
				}
				this.$cart.find( 'button[name=add-to-cart]' ).trigger( 'click' );
			} else if ( this.$cart.find( '.single_add_to_cart_button' ).length ) {
				var btn = this.$cart.find( 'button[name=add-to-cart]' );
				if ( btn.is( '.ajax_add_to_cart' ) ) {
					btn.data( 'pc_configurator_data', data );
				}					
				this.$cart.find( '.single_add_to_cart_button' ).trigger( 'click' );
			} else {
				this.$cart.trigger( 'submit' );
			}
		}

		if ( PC.fe.config.close_configurator_on_add_to_cart && ! PC.fe.inline ) PC.fe.modal.close();
	},
	add_to_quote: function( e ) {

		var data = this.validate_configuration();
		
		if ( ! data ) {
			return;
		}

		this.populate_form_input( data, e );

		if ( PC.fe.debug_configurator_data ) {
			console.log( 'debug_configurator_data', data );
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
