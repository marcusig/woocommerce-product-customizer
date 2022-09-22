var PC = PC || {};
PC.fe = PC.fe || {};
PC.fe.views = PC.fe.views || {};
PC.options = PC.options || {};

!( function( $ ) {
	'use strict';
	var underscore = _;
	/*
		PC.fe.views.configurator 
		-> MAIN WINDOW
	*/
	PC.fe.views.configurator = Backbone.View.extend({
		tagName: 'div',
		className: 'mkl_pc',
		template: wp.template( 'mkl-pc-configurator' ), 
		initialize: function( product_id, parent_id ) {
			wp.hooks.doAction( 'PC.fe.init.modal', this ); 
			if ( parent_id ) {
				this.options = PC.productData['prod_' + parent_id].product_info; 
			} else {
				this.options = PC.productData['prod_' + product_id].product_info; 
			}

			try {
				this.render();
			} catch (err) {
				console.log ('There was an error when rendering the configurator: ', err);
			}
			return this; 
		},
		events: {
			'content-is-loaded': 'start',
		},
		render: function() {
			if( PC.fe.inline == true && $(PC.fe.inlineTarget).length > 0 ) {
				$(PC.fe.inlineTarget).empty().append(this.$el);
			} else if ( PC.fe.config.inline == true && $(PC.fe.config.inlineTarget).length > 0 ) {
				$(PC.fe.config.inlineTarget).append(this.$el);
				PC.fe.inline = true;
			} else {
				$('body').append(this.$el);
				PC.fe.inline = false;
			}

			if ( PC.fe.config.choice_description_no_tooltip ) {
				this.$el.addClass( 'no-tooltip' );
			}

			this.$el.append( this.template( { bg_image: wp.hooks.applyFilters( 'PC.fe.config.bg_image', PC.fe.config.bg_image, this ) } ) ); 
			this.$main_window = this.$el.find( '.mkl_pc_container' ); 

			return this.$el; 
		},
		open: function() {
			this.$el.show(); 

			setTimeout( underscore.bind( this.$el.addClass, this.$el, 'opened' ), 10 );

			// Set focus on the first layer
			if ( ! PC.fe.inline ) {
				setTimeout( function() {
					this.$el.find('.layers .layer-item').first().trigger( 'focus' );
				}.bind(this), 300);
			}
			
			wp.hooks.doAction( 'PC.fe.open', this ); 
		},
		close: function() {
			PC.fe.opened = false; 
			// Remove classes
			this.$el.removeClass( 'opened' ); 
			$('body').removeClass('configurator_is_opened');

			// Empty the form fields to prevent adding the configuration to the cart by mistake (only if the configurator doesn't automatically close, as that would empty the field)
			if ( ! PC.fe.config.close_configurator_on_add_to_cart ) $( 'input[name=pc_configurator_data]' ).val( '' );

			wp.hooks.doAction( 'PC.fe.close', this ); 

			setTimeout( underscore.bind( this.$el.hide, this.$el ), 500 );
		},

		start: function( e, arg ) {
			if ( this.toolbar ) this.toolbar.remove();
			if ( this.viewer ) this.viewer.remove();
			if ( this.footer ) this.footer.remove();

			this.viewer = new PC.fe.views.viewer( { parent: this } );
			this.$main_window.append( this.viewer.render() ); 
			if ( ! PC.fe.angles.length || ! PC.fe.layers.length || ! PC.fe.contents.content.length ) {
				console.log( e );
				var message = $( '<div class="error configurator-error" />' ).text( 'The product configuration seems incomplete. Please make sure Layers, angles and content are set.' );
				if ( ! PC.fe.config.inline ) {
					$( PC.fe.trigger_el ).after( message );
					this.close();
					PC.fe.active_product = false;
				} else {
					$( PC.fe.trigger_el ).append( message );
				}
				return;
			}

			if ( arg == 'no-content' ) {
				this.toolbar = new PC.fe.views.empty_viewer();
				this.viewer.$el.append( this.toolbar.render() );
			} else {
				this.toolbar = new PC.fe.views.toolbar( { parent: this } );
				this.footer = new PC.fe.views.footer( { parent: this } );

				this.$main_window.append( this.toolbar.render() ); 
				this.$main_window.append( this.footer.render() );
			}

			var images = this.viewer.$el.find( 'img' ),
				imagesLoaded = 0,
				that = this;
			
			/*
			$(PC.fe).trigger( 'start.loadingimages', that ); 
			wp.hooks.doAction( 'PC.fe.start.loadingimages', that ); 
			console.log('start loading images.'); 
			this.viewer.$el.addClass('is-loading-image'); 
			images.each(function(index, el) {
				$(el).on('load', function( e ){
					imagesLoaded++; 
					if( imagesLoaded == images.length ) {
						console.log('remove loading class images');	
						that.viewer.$el.removeClass('is-loading-image');
					}					
				});
			});
			*/
			$( PC.fe ).trigger( 'start', this );
			wp.hooks.doAction( 'PC.fe.start', this ); 
			this.open();
		},

	});

	/*
		PC.fe.views.toolbar 
	*/
	PC.fe.views.toolbar = Backbone.View.extend({
		tagName: 'div', 
		className: 'mkl_pc_toolbar', 
		template: wp.template( 'mkl-pc-configurator-toolbar' ),
		initialize: function( options ) {
			this.parent = options.parent || PC.fe;
			return this; 
		},

		events: {
			'click .close-mkl-pc': 'close_configurator',
			'click .cancel': 'close_configurator',
			// 'click .configurator-add-to-cart': 'add_to_cart'
		},

		render: function() {
			this.$el.append( this.template( { name:this.parent.options.title } ) );
			this.$selection = this.$el.find('.choices'); 
			// this.get_cart(); 
			this.layers = new PC.fe.views.layers_list( { parent: this } );
			return this.$el; 
		}, 

		close_configurator: function( event ) {
			this.parent.close(); 
		}
	});

	/*
		PC.fe.views.footer 
	*/
	PC.fe.views.footer = Backbone.View.extend({
		tagName: 'footer', 
		className: 'mkl_pc_footer', 
		template: wp.template( 'mkl-pc-configurator-footer' ),
		initialize: function( options ) {
			this.parent = options.parent || PC.fe;
			return this; 
		},

		events: {
			'click .close-mkl-pc': 'close_configurator',
			'click .reset-configuration': 'reset_configurator',
		},

		render: function() {
			this.$el.append( this.template( {
				name: PC.fe.currentProductData.product_info.title,
				show_form: parseInt( PC.fe.config.show_form ) || ! $( 'form.cart' ).length || PC.fe.currentProductData.product_info.force_form,
				is_in_stock: parseInt( PC.fe.currentProductData.product_info.is_in_stock ),
				product_id: parseInt( PC.fe.active_product ),
				show_qty: parseInt( PC.fe.currentProductData.product_info.show_qty ),
				formated_price: this.get_price()
			} ) );
			this.form = new PC.fe.views.form( { el: this.$( '.form' ) } );
			return this.$el; 
		},

		close_configurator: function( event ) {
			this.parent.close(); 
		},

		reset_configurator: function( event ) {
			PC.fe.contents.content.resetConfig();
			if ( PC.fe.initial_preset ) {
				PC.fe.setConfig( PC.fe.initial_preset );
			}
			wp.hooks.doAction( 'PC.fe.reset_configurator' );
		},

		get_price: function() {
			if ( ! PC.fe.currentProductData.product_info.price ) return false;
			return PC.utils.formatMoney( parseFloat( PC.fe.currentProductData.product_info.price ) );
		}
	});

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
			
			if ( ! this.$cart.find( '.afrfqbt_single_page' ).length ) {
				this.$( '.add-to-quote' ).remove();
			} else {
				this.$( '.add-to-quote' ).html( this.$cart.find( '.afrfqbt_single_page' ).html() );
			}

			return this.$el; 
		},

		validate_configuration: function() {
			var data = PC.fe.save_data.save();
			var errors = wp.hooks.applyFilters( 'PC.fe.validate_configuration', PC.fe.errors );
			if ( errors.length ) {
				// show errors and prevent adding to cart
				console.log( errors );
				alert( errors.join( "\n" ) );
				return false;
			}
			return data;
		},

		populate_form_input: function( data, e ) {

			if ( PC.fe.config.cart_item_key && $( e.currentTarget ).is( '.edit-cart-item' ) ) {
				var $cart_item_field = this.$cart.find( 'input[name=pc_cart_item_key]' );
				if ( $cart_item_field ) $cart_item_field.val( PC.fe.config.cart_item_key );
			}

			this.$input.val( data );
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

			// Woocommerce Add To Quote plugin
			if ( $( '.afrfqbt_single_page' ).length ) {
				$( '.afrfqbt_single_page' ).trigger( 'click' );
				if ( PC.fe.config.close_configurator_on_add_to_cart && ! PC.fe.inline ) PC.fe.modal.close();
			}
		},
	} );

	/*
		PC.fe.views.layers 
	*/
	PC.fe.views.layers_list = Backbone.View.extend({
		// template: wp.template( 'mkl-pc-configurator-viewer' ),
		tagName: 'ul',
		className: 'layers',
		initialize: function( options ) {
			this.options = options || {}; 
			this.render();
			this.listenTo( PC.fe.layers, 'change active', this.activate );
		},
		events: {
		}, 
		render: function() {
			this.options.parent.$selection.append( this.$el ); 
			this.add_all( PC.fe.layers ); 
			return this.$el;
		}, 
		add_all: function( collection ) { 
			this.$el.empty(); 
			this.items = [];
			collection.orderBy = 'order';
			collection.sort();
			collection.each( this.add_one, this ); 
			wp.hooks.doAction( 'PC.fe.layers_list.layers.added', this );
		},
		add_one: function( model ){
			// if layer is not a choice or has only one choice, we don't add it to the menu
			if ( ! model.attributes.not_a_choice ) {
				var choices = PC.fe.getLayerContent( model.id ); 
				if ( choices.length || 'group' == model.get( 'type' ) ) {
					// if ( 'group' == model.get( 'type' ) )  {
					// 	var new_layer = new PC.fe.views.layerGroup( { model: model, parent: this.$el } ); 
					// } else {						
					// }
					var new_layer = new PC.fe.views.layers_list_item( { model: model, parent: this.$el } ); 

					if ( model.get( 'parent' ) && this.options.parent.$( 'ul[data-layer-id=' + model.get( 'parent' ) + ']' ).length ) {
						this.options.parent.$( 'ul[data-layer-id=' + model.get( 'parent' ) + ']' ).append( new_layer.render() ); 
					} else {
						this.$el.append( new_layer.render() );
					}
					this.items.push( new_layer );
				}
			} else {
				if ( model.get( 'custom_html' ) ) {
					var new_layer = new PC.fe.views.layers_list_item( { model: model, parent: this.$el } );
					this.$el.append( new_layer.render() );
					this.items.push( new_layer );
				}
			}

			// add to a new collection to be used to render the viewer

		},
		activate: function( model ) {
			if ( model.get( 'active' ) == false ) {
				if ( model.collection.findWhere( { 'active': true } ) ) {
					this.$el.addClass( 'opened' );
					wp.hooks.doAction( 'PC.fe.layers_list.open', this, model );
				} else {
					this.$el.removeClass( 'opened' );
					wp.hooks.doAction( 'PC.fe.layers_list.close', this, model );
				}
			} else {
				this.$el.addClass( 'opened' );
				wp.hooks.doAction( 'PC.fe.layers_list.open', this, model );
			}

		},	

	});

	/*
		PC.fe.views.layer 
	*/
	PC.fe.views.layers_list_item = Backbone.View.extend({
		tagName: 'li',
		className: 'layers-list-item',
		template: wp.template( 'mkl-pc-configurator-layer-item' ),
		initialize: function( options ) {
			this.options = options || {};
			this.layer_type = this.model.get('type');
			this.listenTo( this.options.model, 'change:active', this.activate );
			wp.hooks.doAction( 'PC.fe.layers_list_item.init', this );
		},

		events: {
			'click > .layer-item': 'show_choices', 
			// 'click a i.close': 'hide_choices', 
		},

		render: function() {

			if ( this.model.get( 'not_a_choice' ) && this.model.get( 'custom_html' ) ) {
				this.$el.append( $( this.model.get( 'custom_html' ) ) );
				if ( this.model.get( 'class_name' ) ) this.$el.addClass( this.model.get( 'class_name' ) );
				wp.hooks.doAction( 'PC.fe.layer.render', this );
				wp.hooks.doAction( 'PC.fe.html_layer.render', this );
				return this.$el;
			}

			var data = this.model.attributes;
			this.$el.append( this.template( wp.hooks.applyFilters( 'PC.fe.configurator.layer_data', data ) ) ); 

			if ( PC.fe.config.show_active_choice_in_layer ) {
				var selection = new PC.fe.views.layers_list_item_selection( { model: this.options.model } );
				this.$( 'button' ).append( selection.$el );
			}

			if ( PC.fe.config.show_active_choice_image_in_layer ) {
				var selection = new PC.fe.views.layers_list_item_selection_image( { model: this.options.model } );
				this.$( 'button' ).prepend( selection.$el );
			}

			// Add classes
			if ( this.model.get( 'class_name' ) ) this.$el.addClass( this.model.get( 'class_name' ) );
			if ( this.model.get( 'display_mode' ) ) this.$el.addClass( 'display-mode-' + this.model.get( 'display_mode' ) );
			if ( this.model.get( 'hide_in_configurator' ) ) this.$el.addClass( 'hide_in_configurator' );

			// Add ID
			if ( this.model.get( 'html_id' ) ) this.el.id = this.model.get( 'html_id' );

			if ( 'dropdown' == this.model.get( 'display_mode' ) && this.model.get( 'class_name' ) && -1 !== this.model.get( 'class_name' ).search( 'dropdown-move-label-outside' ) ) {
				this.$( '.layer-name' ).prependTo( this.$el );
			}

			wp.hooks.doAction( 'PC.fe.layer.beforeRenderChoices', this );
			// Add the choices
			this.add_choices(); 
			wp.hooks.doAction( 'PC.fe.layer.render', this );
			
			// Add display-mode class to the choices element
			if ( this.choices && this.choices.$el && this.model.get( 'display_mode' ) ) this.choices.$el.addClass( 'display-mode-' + this.model.get( 'display_mode' ) );
			return this.$el;
		},
		add_choices: function() { 

			if ( ! this.layer_type || 'simple' == this.layer_type || 'group' == this.layer_type ) {
				this.choices = new PC.fe.views.choices({ content: PC.fe.getLayerContent( this.model.id ), model: this.model }); 
			}

			if ( ! this.choices ) {
				console.log( 'Product Configurator: No choice view was rendered.' );
				return;
			}

			var where = PC.fe.config.where;
			if ( this.model.get( 'parent' ) ) {
				where = 'in';
			}
			where = wp.hooks.applyFilters( 'PC.fe.choices.where', where, this );
			if( ! where || 'out' == where ) {
				this.options.parent.after( this.choices.$el );
			} else if( 'in' == where ) {
				this.$el.append( this.choices.$el ); 
			} else if ( $( where ).length ) {
				this.choices.$el.appendTo( $( where ) )
			}
			wp.hooks.doAction( 'PC.fe.add.choices', this.choices.$el, this );
		},
		show_choices: function( event ) {
			if ( event ) {
				// Allow clicking on link tags
				if (  event.target.tagName && 'A' == event.target.tagName ) {
					return;
				}
				event.stopPropagation();
				event.preventDefault();
			}

			if ( this.model.get( 'active' ) == true ) {
				wp.hooks.doAction( 'PC.fe.layer.hide', this );
				if ( wp.hooks.applyFilters( 'PC.fe.layer.self_hide', true, this ) ) {
					this.model.set('active', false);
				}
			} else {
				if ( ! this.model.get( 'parent' ) ) {
					this.model.collection.each( function( model ) {
						model.set( 'active' , false );
					});
				}

				this.model.set( 'active', true ); 
				wp.hooks.doAction( 'PC.fe.layer.show', this );
			}
		},
		activate: function() {
			if( this.model.get( 'active' ) ) {
				this.$el.addClass( 'active' ); 
				if ( this.choices ) this.choices.$el.addClass( 'active' );
				wp.hooks.doAction( 'PC.fe.layer.activate', this );
			} else {
				this.$el.removeClass( 'active' );
				if ( this.choices ) this.choices.$el.removeClass( 'active' );
				wp.hooks.doAction( 'PC.fe.layer.deactivate', this );
			}

		}
	} );

	PC.fe.views.layers_list_item_selection = Backbone.View.extend({
		tagName: 'span',
		className: 'selected-choice',
		initialize: function() {
			this.choices = PC.fe.getLayerContent( this.model.id );
			if ( ! this.choices ) return;
			this.listenTo( this.choices, 'change:active', this.render );
			this.render();
		},
		render: function( params ) {
			var choices_names = [];
			var active_choices = this.choices.where( { active: true } );
			// var active_choices = 
			_.each( active_choices, function( item ) {
				choices_names.push( item.get_name() );
			} );
			this.$el.html( choices_names.join( ', ' ) );
		}
	} );

	PC.fe.views.layers_list_item_selection_image = Backbone.View.extend({
		tagName: 'i',
		className: 'selected-choice-image',
		initialize: function() {
			this.choices = PC.fe.getLayerContent( this.model.id );
			if ( ! this.choices ) return;
			this.listenTo( this.choices, 'change:active', this.render );
			this.render();
		},
		render: function( choice_model, activated ) {
			var active_choices = this.choices.where( { active: true } );
			var html_content = '';
			_.each( active_choices, function( item ) {
				var image = item.get_image( 'thumbnail' );
				if ( image ) {
					html_content += '<img src="' + image + '">';
				}
			} );
			this.$el.html( html_content );
		}		
	} );

	/*
		PC.fe.views.choices 
	*/
	PC.fe.views.choices = Backbone.View.extend({ 
		tagName: 'ul', 
		className: 'layer_choices', 
		template: wp.template( 'mkl-pc-configurator-choices' ),
		initialize: function( options ) { 
			this.options = options || {}; 
			return this.render();

		},
		events: {
			'click .layer-choices-title a.close': 'close_choices'
		},
		render: function() {
			this.$el.append( this.template( wp.hooks.applyFilters( 'PC.fe.configurator.layer_data', this.model.attributes ) ) ); 
			this.$el.addClass( this.model.get( 'type' ) );
			if ( this.model.get( 'class_name' ) ) this.$el.addClass( this.model.get( 'class_name' ) );
			if ( this.model.get( 'parent' ) ) this.$el.addClass( 'is-child-layer' );
			this.$list = this.$el.find('.choices-list ul'); 
			this.add_all( this.options.content ); 
			
			if ( this.options.content && ( ! this.model.get( 'default_selection' ) || 'select_first' == this.model.get( 'default_selection' ) ) && !this.options.content.findWhere( { 'active': true } ) && this.options.content.findWhere( { available: true } ) ) {
				var av = this.options.content.findWhere( { available: true } );
				if ( av ) av.set( 'active', true );
			}
			return this.$el;
		},
		add_all: function( collection ) { 
			// this.$el.empty();
			if ( 'group' == this.model.get( 'type' ) ) return;
			collection.each( this.add_one, this );
		},
		add_one: function( model ) {
			if ( model.get( 'is_group' ) )  {
				var new_choice = new PC.fe.views.choiceGroup( { model: model, multiple: false } ); 
			} else {
				var new_choice = new PC.fe.views.choice( { model: model, multiple: false } ); 
			}

			if ( model.get( 'parent' ) && this.$( 'ul[data-item-id=' + model.get( 'parent' ) + ']' ).length ) {
				this.$( 'ul[data-item-id=' + model.get( 'parent' ) + ']' ).append( new_choice.render() ); 
			} else {
				this.$list.append( new_choice.render() ); 
			}

			/**
			 * 
			 */
			wp.hooks.doAction( 'PC.fe.choices.add_one.after', this, new_choice );
		},
		close_choices: function( event ) {
			event.preventDefault(); 
			this.model.set('active', false);
		}
	});

	/*
		PC.fe.views.choice
		View for a single choice in the side-bar
	*/
	PC.fe.views.choice = Backbone.View.extend({
		tagName: 'li',
		className: 'choice',
		template: wp.template( 'mkl-pc-configurator-choice-item' ),
		update_tippy_on_price_update: false,
		initialize: function( options ) {
			this.options = options || {};
			this.listenTo( this.model, 'change:active', this.activate );
			wp.hooks.doAction( 'PC.fe.choice.init', this );
			wp.hooks.addAction( 'PC.fe.extra_price.after.get_tax_rates', 'mkl/pc', this.on_price_update.bind( this ) );
			wp.hooks.addAction( 'PC.fe.extra_price.after.update_price', 'mkl/pc', this.on_price_update.bind( this ) );
		},
		events: {
			'mousedown > .choice-item': 'set_choice',
			'keydown > .choice-item': 'set_choice',
			'mouseenter > .choice-item': 'preload_image',
			'focus > .choice-item': 'preload_image',
		},
		render: function() {
			/**
			 * Called after rendering the choice item in the list
			 */
			wp.hooks.doAction( 'PC.fe.configurator.choice-item.before.render', this );
			
			var data = _.extend({
				thumbnail: this.model.get_image( 'thumbnail' ),
				disable_selection: ! this.model.get( 'available' ) && ! PC.fe.config.enable_selection_when_outofstock
			}, this.options.model.attributes );
			
			this.$el.append( this.template( wp.hooks.applyFilters( 'PC.fe.configurator.choice_data', data ) ) );

			wp.hooks.doAction( 'PC.fe.configurator.choice-item.render.after-template', this );

			if ( this.$( '.out-of-stock' ).length ) {
				this.$el.addClass( 'out-of-stock' );
			}

			if ( 'colors' == this.model.collection.layer.get( 'display_mode' ) && this.$( '.out-of-stock' ).length ) {
				if ( $( '#tmpl-mkl-pc-configurator-color-out-of-stock' ).length ) {
					this.$( '.mkl-pc-thumbnail' ).append( $( '#tmpl-mkl-pc-configurator-color-out-of-stock' ).html() );
				}
			}

			if ( window.tippy ) {
				
				var description = this.get_description();

				/**
				 * Customization of the tooltip can be done by using TippyJS options: atomiks.github.io/tippyjs/v6/
				 */
				var tooltip_options = wp.hooks.applyFilters( 'PC.fe.tooltip.options', {
					content: description,
					allowHTML: true,
					placement: 'top',
					zIndex: 100001
				},
				this );

				if ( tooltip_options.content && tooltip_options.content.length && this.$( '.choice-item' ).length ) {
					tippy( this.el, tooltip_options );
				}
			}

			if ( this.model.get( 'is_group' ) ) this.$el.addClass( 'is-group' );
			if ( this.model.get( 'class_name' ) ) this.$el.addClass( this.model.get( 'class_name' ) );
			this.activate();
			this.$el.data( 'view', this );
			/**
			 * Called after rendering the choice item in the list
			 */
			wp.hooks.doAction( 'PC.fe.configurator.choice-item.render', this );

			return this.$el;
		}, 
		on_price_update: function() {
			if ( ! this.update_tippy_on_price_update || this.model.get( 'is_group' ) ) return;
			var $ci = this.$( '.choice-item' );
			if ( $ci.length && $ci[0] && $ci[0]._tippy ) {
				$ci[0]._tippy.setContent( this.get_description() );
			}
		},
		get_description: function() {
			if ( 'colors' == this.model.collection.layer.get( 'display_mode' ) ) {
				this.update_tippy_on_price_update = true;
				var description = this.$( '.choice-text' ).length ? this.$( '.choice-text' ).html() : this.$( '.choice-name' ).html();
				if ( this.$( '.out-of-stock' ).length ) {
					description += this.$( '.out-of-stock' )[0].outerHTML;
					// console.log('get desc', this.model.collection.layer.get( 'name' ), this.model.get( 'name' ), this.$( '.out-of-stock' ).length, this.$( '.out-of-stock' )[0].outerHTML );
				}
			} else {
				var description = this.$( '.description' ).html();
			}
			// console.log( description );
			return description;
		},
		set_choice: function( event ) {
			if ( this.model.get( 'is_group' ) ) return;

			if ( event.type == 'keydown' ) {
				if ( ! ( event.keyCode == 13 || event.keyCode == 32 ) ) {
					return;
				}
			}
			
			// If the element is disabled, exit.
			if ( $( event.currentTarget ).prop( 'disabled' ) ) return;
			// Activate the clicked item
			this.model.collection.selectChoice( this.model.id );
			var layer = PC.fe.layers.get( this.model.get( 'layerId' ) );
			var close_choices = 
				PC.fe.config.close_choices_when_selecting_choice 
				&& ( $( 'body' ).is('.is-mobile' ) || PC.utils._isMobile() ) 
				|| PC.fe.config.close_choices_when_selecting_choice_desktop
				|| 'dropdown' == layer.get( 'display_mode' );

			// Maybe close the choice list
			if ( wp.hooks.applyFilters( 'PC.fe.close_choices_after_selection', close_choices, this.model ) ) {
				if ( layer ) layer.set('active', false);
			}
			PC.fe.last_clicked = this;
			wp.hooks.doAction( 'PC.fe.choice.set_choice', this.model, this )
		},
		preload_image: function() {
			// console.log('preload image');
			this.model.trigger( 'preload-image' );
			// var src = this.model.get_image();
			// if ( ! src ) return;
			// var img = new Image();
			// img.src = src;
		},
		activate: function() {
			if( this.model.get('active') === true ) {
				this.$el.addClass('active');
				wp.hooks.doAction( 'PC.fe.choice.activate', this );
			} else {
				this.$el.removeClass('active');
				wp.hooks.doAction( 'PC.fe.choice.deactivate', this );
			}
		},
	});

	PC.fe.views.choiceGroup = PC.fe.views.choice.extend({
		template: wp.template( 'mkl-pc-configurator-choice-group' ),
	});

	PC.fe.views.layerGroup = PC.fe.views.layers_list_item.extend({
		template: wp.template( 'mkl-pc-configurator-choice-group' ),
	});

	/*
		PC.fe.views.viewer
		-> Main view containing the product visuals and the background image.
	*/

	PC.fe.views.viewer = Backbone.View.extend({
		tagName: 'div',
		className: 'mkl_pc_viewer',
		template: wp.template( 'mkl-pc-configurator-viewer' ), 
		imagesLoading: 0,
		initialize: function( options ) {
			this.parent = options.parent || PC.fe; 
			this.imagesLoading = 0;
			return this; 
		},

		events: {
			'change_layer': 'change_layer' 
		},

		render: function( ) { 
			this.$el.append( this.template() ); 
			if ( PC.fe.contents ) {
				if ( PC.fe.angles.length > 1 ) {
					this.angles_selector = new PC.fe.views.angles({ parent: this }); 
					this.$el.append( this.angles_selector.render() );
				} else if ( PC.fe.angles.length ) {
					PC.fe.angles.first().set( 'active', true );
				} else {
					console.error( 'Product configurator: there are no angles set. Please complete the product setup.' );
					return;
				}

				this.$layers = this.$el.find( '.mkl_pc_layers' ); 
				this.layers = [];

				this.add_layers();
				this.add_loader();
		

			} else {
				console.log('no content to show.');
			}
			
			wp.hooks.doAction( 'PC.fe.viewer.render', this );

			return this.$el; 

		},

		add_loader: function() {
			this.$layers.append( $( '<div class="images-loading" />' ) );
		},

		add_layers: function() {
			var orders = PC.fe.layers.pluck( 'image_order' );
			if ( orders.length && _.max( orders ) ) {
				PC.fe.layers.orderBy = 'image_order';
				PC.fe.layers.sort();
			}
			PC.fe.layers.each( this.add_choices, this );
		}, 

		add_choices: function( model ) {
			var choices = PC.fe.getLayerContent( model.id );
			if ( ! choices ) {
				return;
			}
			if ( model.get( 'not_a_choice') ) {
				var choice = choices.first();
				var layer = new PC.fe.views.viewer_static_layer( { model: choice, parent: this } );
				this.$layers.append( layer.$el );
				if ( choice.get( 'custom_html' ) ) {
					this.$layers.append( $( choice.get( 'custom_html' ) ) );
				}
			} else {
				choices.each( this.add_single_choice, this );
			}
		},

		add_single_choice: function( model ) {
			if ( model.has_image() || wp.hooks.applyFilters( 'PC.fe.viewer.item.render.empty.images', false, model ) ) {
				var View = wp.hooks.applyFilters( 'PC.fe.viewer.item.view', PC.fe.views.viewer_layer, model, this );
				var layer = new View( { model: model, parent: this } ); 
				this.$layers.append( layer.$el );
			} else {
				layer = false;
			}

			wp.hooks.doAction( 'PC.fe.viewer.item.added', layer, this );
			if ( model.get( 'custom_html' ) ) {
				var html_layer = new PC.fe.views.viewer_layer_html( { model: model, layer: layer, parent: this } );
				this.$layers.append( html_layer.$el );
				wp.hooks.doAction( 'PC.fe.viewer.html_item.added', html_layer, this );
			}
			this.layers[ model.id ] = layer;
		}
	});

	PC.fe.views.viewer_static_layer = Backbone.View.extend({
		tagName: wp.hooks.applyFilters( 'PC.fe.viewer.item.tag', 'img' ),
		events: {
			'load': 'loaded',
			'error': 'loaded',
			'abort': 'loaded',
			'stalled': 'loaded',
		},
		initialize: function( options ) { 
			this.listenTo( PC.fe.angles, 'change active', this.render );

			this.parent = options.parent || PC.fe;
			wp.hooks.doAction( 'PC.fe.choice-img.init', this );

			this.render(); 

			return this; 
		},
		loaded: function(event) {
			this.$el.removeClass( 'loading' );
			wp.hooks.doAction( 'PC.fe.viewer.layer.preload.complete', this );
			this.parent.imagesLoading --;
			if( this.parent.imagesLoading == 0 ) {
				this.parent.$el.removeClass('is-loading-image');
				wp.hooks.doAction( 'PC.fe.viewer.layers.preload.complete', this );
			}
		},
		render: function() {
			var img = this.model.get_image();
			// Default to a transparent image
			if ( ! img ) img = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';

			wp.hooks.doAction( 'PC.fe.viewer.static_layer.render', this );

			var classes = [ 'active', 'static', 'loading' ];
			
			classes.push( this.model.collection.getType() );
			
			var layer_class = PC.fe.layers.get( this.model.get( 'layerId' ) ).get( 'class_name' );
			if ( layer_class ) classes.push( layer_class );
			if ( this.model.get( 'class_name' ) ) classes.push( this.model.get( 'class_name' ) );
			
			/**
			 * Filter the classes applied to the image
			 */
			classes = wp.hooks.applyFilters( 'PC.fe.viewer.static_layer.classes', classes, this );
			this.$el.addClass( classes.join( ' ' ) );
			if ( img ) {
				this.el.src = img;
				this.parent.imagesLoading ++;
				this.parent.$el.addClass('is-loading-image');
			}
			this.$el.data( 'dimensions', this.model.get_image( 'image', 'dimensions' ) );

			return this.$el; 
		}		
	});

	PC.fe.views.viewer_layer = Backbone.View.extend({ 
		tagName: 'img', 
		events: {
			'load': 'img_loaded',
			'error': 'img_loaded',
			'abort': 'img_loaded',
			'stalled': 'img_loaded',
		},
		initialize: function( options ) { 
			var that = this;
			this.empty_img = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';
			this.parent = options.parent || PC.fe;
			this.is_loaded = false;
			this.listenTo( this.model, 'change:active', this.change_layer );
			this.listenTo( this.model, 'preload-image', this.preload_image );
			this.listenTo( PC.fe.layers, 'change:active', this.toggle_current_layer_class );
			this.listenTo( PC.fe.angles, 'change:active', this.change_angle );
			wp.hooks.doAction( 'PC.fe.choice-img.init', this );
			var is_active = this.model.get( 'active' );

			this.render(); 

			return this; 
		},
 		render: function( force ) {
			 
			var is_active = this.model.get( 'active' );
			var img = this.model.get_image();
			var classes = [];
			
			classes.push( this.model.collection.getType() );
			
			var layer_class = PC.fe.layers.get( this.model.get( 'layerId' ) ).get( 'class_name' );
			if ( layer_class ) classes.push( layer_class );
			if ( this.model.get( 'class_name' ) ) classes.push( this.model.get( 'class_name' ) );
			/**
			 * Filter the classes applied to the image
			 */
			classes = wp.hooks.applyFilters( 'PC.fe.viewer.layer.classes', classes, this );
			// Add the classes
			this.$el.addClass( classes.join( ' ' ) );
			// Default to a transparent image
			if ( ! img ) img = this.empty_img;

			wp.hooks.doAction( 'PC.fe.viewer.layer.render', this );

			if ( is_active ) {
				if ( ! this.is_loaded ) {
					this.parent.imagesLoading ++;
					this.parent.$el.addClass('is-loading-image');
					this.$el.addClass( 'loading' );
					this.el.src = img
				} 
				this.$el.addClass( 'active' );
			} else {
				if ( ! this.is_loaded ) {
					this.$el.addClass( 'loading' );
					if ( 'lazy' == PC.fe.config.image_loading_mode && ! force ) {
						this.el.src = this.empty_img;
					} else {
						this.el.src = img;	
					}
				}
				this.$el.removeClass( 'active' );
			}

			this.$el.data( 'dimensions', this.model.get_image( 'image', 'dimensions' ) );

			return this.$el; 
		},
		// get_image_url: function( choice_id, image ) {
		// 	image = image || 'image'; 
		// 	var active_angle = PC.fe.angles.findWhere( { active: true } );
		// 	var angle_id = active_angle.id; 

		// 	return this.choices.get( choice_id ).attributes.images.get( angle_id ).attributes[image].url; 
		// },
		change_layer: function( model ) {
			this.render();
		},
		change_angle: function( model ) {
			if ( model.get( 'active' ) ) {
				this.is_loaded = false;
				this.render();
			}
		},
		img_loaded: function( e ) {
			this.$el.removeClass( 'loading' );
			if (this.empty_img == this.$el.prop('src')) return;
			this.is_loaded = true;

			if ( 'load' == e.type ) wp.hooks.doAction( 'PC.fe.viewer.layer.preload.complete', this );

			this.parent.imagesLoading --;
			if( this.parent.imagesLoading == 0 ) {
				this.parent.$el.removeClass('is-loading-image');
				wp.hooks.doAction( 'PC.fe.viewer.layers.preload.complete', this );
			}

		},
		toggle_current_layer_class: function( layer, new_val ) {
			this.$el.toggleClass( 'current_layer', layer.id == this.model.get( 'layerId' ) );
		},
		preload_image: function( e ) {
			if ( this.model.get( 'active' ) ) return;
			if ( ! this.model.get_image() || this.el.src == this.model.get_image() ) return;
			
			this.render( true );
			// if ( ! src ) return;
			// var img = new Image();
			// img.src = src;
		}
	}); 

	PC.fe.views.viewer_layer_html = Backbone.View.extend({ 
		tagName: 'div',
		className: 'custom-html',
		initialize: function( options ) {
			var that = this;
			this.parent = options.parent || PC.fe;
			this.layer = PC.fe.layers.get( this.model.get( 'layerId' ) )
			this.listenTo( this.model, 'change:active', this.change_layer );
			this.listenTo( this.model, 'change:cshow', this.conditional_display );
			this.listenTo( this.layer, 'change:cshow', this.conditional_display );
			this.listenTo( PC.fe.layers, 'change:active', this.toggle_current_layer_class );
			// this.listenTo( PC.fe.angles, 'change:active', this.change_angle );
			wp.hooks.doAction( 'PC.fe.choice-custom-html.init', this );

			this.render(); 

			return this; 
		},
 		render: function() {
			 
			var is_active = this.model.get( 'active' );
			var classes = [];
			
			classes.push( this.model.collection.getType() );
			
			var layer_class = this.layer.get( 'class_name' );
			if ( layer_class ) classes.push( layer_class );
			if ( this.model.get( 'class_name' ) ) classes.push( this.model.get( 'class_name' ) );
			/**
			 * Filter the classes applied to the image
			 */
			classes = wp.hooks.applyFilters( 'PC.fe.viewer.layer.classes', classes, this );
			// Add the classes
			this.$el.addClass( classes.join( ' ' ) );
			// Default to a transparent image

			wp.hooks.doAction( 'PC.fe.viewer.layer.render', this );

			if ( is_active ) {
				this.$el.addClass( 'active' );
			} else {
				this.$el.removeClass( 'active' );
			}

			this.$el.html( this.model.get( 'custom_html' ) );

			return this.$el; 
		},
		change_layer: function( model ) {
			this.$el.toggleClass( 'active', this.model.get( 'active' ) );
			this.conditional_display();
			// this.render();
		},
		toggle_current_layer_class: function( layer, new_val ) {
			this.$el.toggleClass( 'current_layer', layer.id == this.model.get( 'layerId' ) );
		},
		conditional_display: function() {
			var model_cshow = false !== this.model.get( 'cshow' );
			var layer_cshow = false !== this.layer.get( 'cshow' );
			this.$el.toggle( this.model.get( 'active' ) && model_cshow && layer_cshow );
		}
	});

	PC.fe.views.angles = Backbone.View.extend({ 
		tagName: 'div', 
		className: 'angles-select',
		template: wp.template( 'mkl-pc-configurator-angles-list' ), 
		initialize: function( options ) { 
			// this.parent = options.parent || PC.fe; 
			this.col = PC.fe.angles; 
			return this; 
		},
		events: {
			'click .change-angle--trigger': 'on_selector_click'
		},
		render: function() { 
			this.$el.append( this.template() );
			this.$list = this.$el.find( 'ul' );
			this.add_all(); 
			return this.$el; 
		},
		add_all: function() {
			this.col.each( this.add_one, this ); 
			this.col.first().set( 'active', true ); 
		},
		add_one: function( model ) {
			var new_angle = new PC.fe.views.angle( { model: model } ); 
			this.$list.append( new_angle.$el ); 
		},
		on_selector_click: function(e) {
			e.preventDefault();
		}
	});

	PC.fe.views.angle = Backbone.View.extend({
		tagName: 'li',
		className: 'angle',
		template: wp.template( 'mkl-pc-configurator-angle-item' ), 
		initialize: function( options ) {
			// this.parent = options.parent || PC.fe; 
			this.options = options || {};
			this.render(); 
			this.listenTo( this.model, 'change active', this.activate ); 
			return this;
		},
 
		events: {
			'click a': 'change_angle'
		},
		render: function() {
			if ( this.model.get( 'class_name' ) ) {
				this.$el.addClass( this.model.get( 'class_name' ) );
			}
			this.$el.append( this.template( wp.hooks.applyFilters( 'PC.fe.configurator.angle_data', this.model.attributes ) ) ); 
			return this.$el; 
		},
		change_angle: function( e ) {
			e.preventDefault();
			this.model.collection.each(function(model) {
				model.set('active' , false); 
			});
			this.model.set('active', true); 
		},
		activate: function() {
			if( this.model.get('active') )
				this.$el.addClass('active');
			else
				this.$el.removeClass('active');

			if ( this.model.get( 'class_name' ) ) {
				PC.fe.modal.$el.toggleClass( this.model.get( 'class_name' ), this.model.get( 'active' ) );
			}
		}

	});

	PC.fe.views.empty_viewer = Backbone.View.extend({
		tagName: 'div', 
		className: 'nothing-selected',
		template: wp.template( 'mkl-pc-configurator-empty-viewer' ), 
		initialize: function( options ) { 
			return this; 
		},
 		render: function() { 
			this.$el.append( this.template() );
			return this.$el; 
		},
	});

	PC.fe.errors = [];

	PC.fe.save_data = {
		choices: [],
		save: function() {
			PC.fe.errors = [];
			this.choices = [];
			PC.fe.layers.each( this.parse_choices, this ); 
			this.choices = wp.hooks.applyFilters( 'PC.fe.save_data.choices', this.choices );
			return JSON.stringify( this.choices );
		},

		// get choices for one layer 
		parse_choices: function( model ) {
			var is_required = parseInt( model.get( 'required' ) );
			var default_selection = model.get( 'default_selection' ) || 'select_first';
			var type = model.get( 'type' );
			if ( 'form' == type ) is_required = false;
			if ( PC.fe.config.angles.save_current ) {
				var angle = PC.fe.angles.findWhere( 'active', true );
			} else {
				var angle = PC.fe.angles.findWhere( 'use_in_cart', true );
			}
			if ( ! angle ) {
				angle = PC.fe.angles.first();
			}

			var angle_id = wp.hooks.applyFilters( 'PC.fe.save_data.parse_choices.angle_id', angle.id );

			if ( 'group' == type ) {
				if ( wp.hooks.applyFilters( 'PC.fe.save_data.parse_choices.add_layer_group', true, model ) ) this.choices.push( 
					wp.hooks.applyFilters(
						'PC.fe.save_data.parse_choices.added_group_layer',
						{
							is_choice: false,
							layer_id: model.id,
							choice_id: 0,
							angle_id: angle_id,
							layer_name: model.get( 'name' ),
							image: 0,
							name: '',
						},
						model
					)
				);
			}
			var require_error = false;
			var choices = PC.fe.getLayerContent( model.id );
			if ( ! choices ) return;
			// Check if the layer is hidden:
			if ( false === model.get( 'cshow' ) ) return;
			if ( PC.hasOwnProperty( 'conditionalLogic' ) && PC.conditionalLogic.parent_is_hidden && PC.conditionalLogic.parent_is_hidden( model ) ) return;
			var first_choice = choices.first().id;
			if ( ! model.attributes.not_a_choice ) {
				// Simple with at least 2 items, and multiple choices
				if ( choices.length > 1 || 'multiple' == type ) {

					var selected_choices = choices.where( { 'active': true } );

					if ( is_required && ! selected_choices.length ) {
						require_error = true;
					}

					// Simple layer without a selection (e.g. all items are out of stock)
					if ( ! is_required && ! selected_choices.length && 'simple' == type && 'select_first' == default_selection ) {
						require_error = true;
					}

					_.each( selected_choices, function( choice ) {
						if ( false === choice.get( 'cshow' ) ) return;
						if ( PC.hasOwnProperty( 'conditionalLogic' ) && PC.conditionalLogic.parent_is_hidden && PC.conditionalLogic.parent_is_hidden( choice ) ) return;
						// Check for a required item
						if ( 
							'select_first' == default_selection
							&& is_required 
							&& 'simple' == type
							&& first_choice == choice.id
						) {
							require_error = true;
						}

						// The item is out of stock, so throw an error
						if ( false === choice.get( 'available' ) ) {
							PC.fe.errors.push( PC_config.lang.out_of_stock_error_message.replace( '%s', model.get( 'name' ) + ' > ' + choice.get( 'name' ) ) );
						}

						var img_id = choice.get_image( 'image', 'id' );
						if ( wp.hooks.applyFilters( 'PC.fe.save_data.parse_choices.add_choice', true, choice ) ) this.choices.push( 
							wp.hooks.applyFilters(
								'PC.fe.save_data.parse_choices.added_choice',
								{
									is_choice: true,
									layer_id: model.id,
									choice_id: choice.id,
									angle_id: angle_id,
									layer_name: model.attributes.name,
									image: img_id,
									name: choice.attributes.name,
								},
								choice
							)
						);
					}, this );

				} else {
					// Only one choice
					var choice = choices.first();
					var is_active = choice.get( 'active' );
					if ( is_active || ( 'simple' != model.get( 'type' ) && 'multiple' != model.get( 'type' ) && 'form' != model.get( 'type' ) ) ) {
						if ( false === choice.get( 'cshow' ) ) return;
						var img_id = choice.get_image('image', 'id'); 
						if ( wp.hooks.applyFilters( 'PC.fe.save_data.parse_choices.add_choice', true, choice ) ) this.choices.push(
							wp.hooks.applyFilters(
								'PC.fe.save_data.parse_choices.added_choice',
								{
									is_choice: false,
									layer_id: model.id, 
									choice_id: choice.id, 
									angle_id: angle_id,
									image: img_id,
								},
								choice
							)
						);

						// The item is out of stock, so throw an error
						if ( false === choice.get( 'available' ) ) {
							PC.fe.errors.push( PC_config.lang.out_of_stock_error_message.replace( '%s', model.get( 'name' ) + ' > ' + choice.get( 'name' ) ) );
						}
					} else if ( is_required ) {
						require_error = true;
					}
				}
			} else {
				// Not a choice
				var choice = choices.first();
				var img_id = choice.get_image('image', 'id');
				if ( wp.hooks.applyFilters( 'PC.fe.save_data.parse_choices.add_choice', true, choice ) ) this.choices.push(
					wp.hooks.applyFilters(
						'PC.fe.save_data.parse_choices.added_choice',
						{
							is_choice: false,
							layer_id: model.id,
							choice_id: choice.id,
							angle_id: angle_id,
							image: img_id,
							name: choice.attributes.name,
						}
					)
				);
			}

			if ( require_error ) {	
				PC.fe.errors.push( PC_config.lang.required_error_message.replace( '%s', model.get( 'name' ) ) );
			}

			wp.hooks.doAction( 'PC.fe.save_data.parse_choices.after', model, this );
		}

	};
})(jQuery);
