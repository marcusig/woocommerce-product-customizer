var PC = PC || {};
PC.fe = PC.fe || {};
PC.fe.views = PC.fe.views || {};
PC.options = PC.options || {};

!( function( $ ) {
	'use strict'; 
	/*
		PC.fe.views.configurator 
		-> MAIN WINDOW
	*/
	PC.fe.views.configurator = Backbone.View.extend({
		tagName: 'div',
		className: 'mkl_pc',
		template: wp.template( 'mkl-pc-configurator' ), 
		initialize: function( product_id, parent_id ) {
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
				$(PC.fe.inlineTarget).append(this.$el);
			} else if ( PC.fe.config.inline == true && $(PC.fe.config.inlineTarget).length > 0 ) {
				$(PC.fe.config.inlineTarget).append(this.$el);
				PC.fe.inline = true;
			} else {
				$('body').append(this.$el);
				PC.fe.inline = false;
			}
			this.$el.append( this.template( { bg_image: wp.hooks.applyFilters( 'PC.fe.config.bg_image', PC.fe.config.bg_image, this ) } ) ); 
			this.$main_window = this.$el.find( '.mkl_pc_container' ); 

			return this.$el; 
		},
		open: function() {
			this.$el.show(); 
			PC.fe.opened = true;
			$('body').addClass('configurator_is_opened');
			if( PC.fe.inline ) $('body').addClass('configurator_is_inline');
			setTimeout( _.bind( this.$el.addClass, this.$el, 'opened' ), 10 );
			// Set focus on the first layer
			if ( ! PC.fe.inline ) {
				setTimeout( function() {
					this.$el.find('.layers .layer-item').first().focus();
				}.bind(this), 300);
			}
			
			wp.hooks.doAction( 'PC.fe.open', this ); 
		},
		close: function() {
			PC.fe.opened = false; 
			this.$el.removeClass( 'opened' ); 
			$('body').removeClass('configurator_is_opened');

			wp.hooks.doAction( 'PC.fe.close', this ); 

			setTimeout( _.bind( this.$el.hide, this.$el ), 500 );
		},

		start: function( e, arg ) {
			if( this.toolbar ) this.toolbar.remove();
			if( this.viewer ) this.viewer.remove();
			if( this.footer ) this.footer.remove();

			this.viewer = new PC.fe.views.viewer( { parent: this } );
			this.$main_window.append( this.viewer.render() ); 
			if( arg == 'no-content' ) {
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
			this.layers = new PC.fe.views.layers_list({parent: this});
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
		},

		render: function() {
			this.$el.append( this.template( {
				name: PC.fe.currentProductData.product_info.title,
				show_form: PC.fe.is_using_shortcode,
				product_id: PC.fe.active_product,
				show_qty: PC.fe.currentProductData.product_info.show_qty,
				formated_price: this.get_price()
			} ) );
			this.form = new PC.fe.views.form( { el: this.$el.find( '.form' ) } );
			return this.$el; 
		},

		close_configurator: function( event ) {
			this.parent.close(); 
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
			'click .configurator-add-to-cart': 'add_to_cart'
		},

		render: function() {
			return this.$el; 
		},

		add_to_cart: function( e ) { 
			var $cart = $( 'form.cart' );
			var data = PC.fe.save_data.save();

			var errors = wp.hooks.applyFilters( 'PC.fe.validate_configuration', [] );
			if ( errors.length ) {
				// show errors and prevent adding to cart
				console.log( errors );
				alert( errors.join( "\n" ) );
				return;
			}

			$cart.find( 'input[name=pc_configurator_data]' ).val( data );
			if ( $cart.find( '.single_add_to_cart_button' ).length ) {
				$cart.find( '.single_add_to_cart_button' ).trigger( 'click' );
			} else {
				$cart.trigger( 'submit' );
			}
			if ( PC.fe.config.close_configurator_on_add_to_cart && ! PC.fe.inline ) PC.fe.modal.close();
		}
	});

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
			collection.each( this.add_one, this ); 
		},
		add_one: function( model ){
			// if layer is not a choice or has only one choice, we don't add it to the menu
			if ( ! model.attributes.not_a_choice ) {
				var choices = PC.fe.getLayerContent( model.id ); 
				if ( choices.length ) {
					var new_layer = new PC.fe.views.layers_list_item( { model: model, parent: this.$el } ); 
					this.$el.append( new_layer.render() );
					this.items.push( new_layer );
				}
			}

			// add to a new collection to be used to render the viewer

		},
		activate: function( model ) {
			if( model.get( 'active' ) == false ) {
				if( model.collection.findWhere( { 'active': true } ) ) {
					this.$el.addClass('opened');
				} else {
					this.$el.removeClass('opened');
				}
			} else {
				this.$el.addClass('opened');
			}
		},	

	});

	/*
		PC.fe.views.layer 
	*/
	PC.fe.views.layers_list_item = Backbone.View.extend({
		tagName: 'li', 
		template: wp.template( 'mkl-pc-configurator-layer-item' ),
		initialize: function( options ) {
			this.options = options || {};
			this.layer_type = this.model.get('type');
			this.listenTo( this.options.model, 'change active', this.activate );
			wp.hooks.doAction( 'PC.fe.layers_list_item.init', this );
		},

		events: {
			'click > .layer-item': 'show_choices', 
			// 'click a i.close': 'hide_choices', 
		},

		render: function() { 
			this.$el.append( this.template( this.model.attributes ) ); 

			if ( this.model.get( 'class_name' ) ) this.$el.addClass( this.model.get( 'class_name' ) );
			
			wp.hooks.doAction( 'PC.fe.layer.beforeRenderChoices', this );
			// Add the choices
			this.add_choices(); 
			wp.hooks.doAction( 'PC.fe.layer.render', this );
			return this.$el;
		},
		add_choices: function() { 

			if ( ! this.layer_type || 'simple' == this.layer_type ) {
				this.choices = new PC.fe.views.choices({ content: PC.fe.getLayerContent( this.model.id ), model: this.model }); 
			}

			if ( ! this.choices ) {
				console.log( 'Product Configurator: No choice view was rendered.' );
				return;
			}

			var where = wp.hooks.applyFilters( 'PC.fe.choices.where', PC.fe.config.where );
			if( ! where || 'out' == where ) {
				this.options.parent.after( this.choices.$el ); 
			} else if( 'in' == where ) {
				this.$el.append( this.choices.$el ); 
			} else if ( $( where ).length ) {
				this.choices.$el.appendTo( $( where ) )
			}
			wp.hooks.doAction( 'PC.fe.add.choices', this.choices.$el );
		},
		show_choices: function( event ) {
			event.preventDefault(); 
			if( this.model.get( 'active' ) == true) {
				this.model.set('active', false); 

			} else {				
				this.model.collection.each(function(model) {
					model.set('active' , false);
				});

				this.model.set('active', true); 
			}
		},
		activate: function() {
			if( this.model.get('active') ) {
				this.$el.addClass('active'); 
				if ( this.choices ) this.choices.$el.addClass('active');
				wp.hooks.doAction( 'PC.fe.layer.activate', this );
			} else {
				this.$el.removeClass('active');
				if ( this.choices ) this.choices.$el.removeClass('active');
				wp.hooks.doAction( 'PC.fe.layer.deactivate', this );
			}

		}
	});

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
			this.$el.append( this.template( this.model.attributes ) ); 
			if ( this.model.get( 'class_name' ) ) this.$el.addClass( this.model.get( 'class_name' ) );
			this.$list = this.$el.find('.choices-list ul'); 
			this.add_all( this.options.content ); 
			
			if( !this.options.content.findWhere( { 'active': true } ) && this.options.content.findWhere( { available: true } ) ) {
				this.options.content.findWhere( { available: true } ).set( 'active', true );
			}
			return this.$el;
		},
		add_all: function( collection ) { 
			// this.$el.empty();
			collection.each( this.add_one, this );
		},
		add_one: function( model ) {
			var new_choice = new PC.fe.views.choice( { model: model, multiple: false } ); 
			this.$list.append( new_choice.render() ); 
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
		template: wp.template( 'mkl-pc-configurator-choice-item' ),
		initialize: function( options ) {
			this.options = options || {};
			this.listenTo( this.model, 'change:active', this.activate );
			wp.hooks.doAction( 'PC.fe.choice.init', this );
		},
		events: {
			'mousedown .choice-item': 'set_choice',
			'keydown .choice-item': 'set_choice',
			'mouseenter .choice-item': 'preload_image',
		},
		render: function() {
			var data = _.extend({
				thumbnail: this.model.get_image( 'thumbnail' )
			} , this.options.model.attributes );
			this.$el.append( this.template( data ) );
			var $description = this.$el.find( '.description' );
			if ( $description.length && window.tippy ) {
				/**
				 * Customization of the tooltip can be done by using TippyJS options: atomiks.github.io/tippyjs/v6/
				 */
				var tooltip_options = wp.hooks.applyFilters( 'PC.fe.tooltip.options', {
					content: $description.html(),
					allowHTML: true,
					placement: 'top',
					zIndex: 10001
				} );
				tippy( this.$el.find('.choice-item')[0], tooltip_options );
			}
			if ( this.model.get( 'class_name' ) ) this.$el.addClass( this.model.get( 'class_name' ) );
			this.activate();
			/**
			 * Called after rendering the choice item in the list
			 */
			wp.hooks.doAction( 'PC.fe.configurator.choice-item.render', this );

			return this.$el;
		}, 
		set_choice: function( event ) {
			if ( event.type == 'keydown' ) {
				if ( ! ( event.keyCode == 13 || event.keyCode == 32 ) ) {
					return;
				}
			}
			
			// If the element is disabled, exit.
			if ( $( event.currentTarget ).prop( 'disabled' ) ) return;
			// Activate the clicked item
			this.model.collection.selectChoice( this.model.id );
			
			// Maybe close the choice list
			if ( PC.fe.config.close_choices_when_selecting_choice && ( $( 'body' ).is('.is-mobile' ) || PC.utils._isMobile() ) ) {
				var layer = PC.fe.layers.get( this.model.get( 'layerId' ) );
				if ( layer ) layer.set('active', false);
			}
			wp.hooks.doAction( 'PC.fe.choice.set_choice', this.model, this )
		},
		preload_image: function() {
			var src = this.model.get_image( 'thumbnail' );
			var img = new Image();
			img.src = src;
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
				} else {
					PC.fe.angles.first().set( 'active', true );
				}

				this.$layers = this.$el.find( '.mkl_pc_layers' ); 
				this.layers = [];

				this.add_layers();
				// wp.hooks.addAction( 'PC.fe.viewer.layer.render', function( layer ) {
					
				// } );

			} else {
				console.log('no content to show.');
			}

			return this.$el; 

		}, 

		add_layers: function() {
			PC.fe.layers.each( this.add_choices, this );
		}, 

		add_choices: function( model ) {
			var choices = PC.fe.getLayerContent( model.id );
			if ( ! choices ) {
				return;
			}
			if ( model.get( 'not_a_choice') ) {
				var layer = new PC.fe.views.viewer_static_layer( { model: choices.first(), parent: this } );
				this.$layers.append( layer.$el );
			} else {
				choices.each( this.add_single_choice, this );
			}
		},

		add_single_choice: function( model ) {
			var layer = new PC.fe.views.viewer_layer( { model: model, parent: this } ); 
			this.$layers.append( layer.$el );
			this.layers[ model.id ] = layer;
		}
	});

	PC.fe.views.viewer_static_layer = Backbone.View.extend({
		tagName: wp.hooks.applyFilters( 'PC.fe.viewer.item.tag', 'img' ),
		initialize: function( options ) { 
			this.listenTo( PC.fe.angles, 'change active', this.render );

			this.parent = options.parent || PC.fe;
			wp.hooks.doAction( 'PC.fe.choice-img.init', this );

			this.render(); 

			this.$el.on( 'load', function(event) {
				wp.hooks.doAction( 'PC.fe.viewer.layer.preload.complete', this );
				this.parent.imagesLoading --;
				if( this.parent.imagesLoading == 0 ) {
					this.parent.$el.removeClass('is-loading-image');
					wp.hooks.doAction( 'PC.fe.viewer.layers.preload.complete', this );
				}
			}.bind( this ));
			return this; 
		},

		render: function() {
			var img = this.model.get_image();
			// Default to a transparent image
			if (!img) img = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';

			wp.hooks.doAction( 'PC.fe.viewer.static_layer.render', this );

			this.parent.imagesLoading ++;
			this.parent.$el.addClass('is-loading-image');
			this.el.src = img
			this.$el.addClass( 'active static' );
			this.$el.data( 'dimensions', this.model.get_image( 'image', 'dimensions' ) );

			return this.$el; 
		}		
	});

	PC.fe.views.viewer_layer = Backbone.View.extend({ 
		tagName: 'img', 
		events: {
			'load': 'img_loaded'
		},
		initialize: function( options ) { 
			var that = this;
			this.empty_img = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';
			this.parent = options.parent || PC.fe;
			this.is_loaded = false;
			this.listenTo( this.model, 'change active', this.change_layer );
			this.listenTo( PC.fe.angles, 'change active', this.change_angle );
			wp.hooks.doAction( 'PC.fe.choice-img.init', this );
			var is_active = this.model.get( 'active' );

			this.render(); 

			return this; 
		},
 		render: function() {
			 
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
			if (!img) img = this.empty_img;

			wp.hooks.doAction( 'PC.fe.viewer.layer.render', this );

			if ( is_active ) {
				if ( ! this.is_loaded ) {
					this.parent.imagesLoading ++;
					this.parent.$el.addClass('is-loading-image');
					this.el.src = img
				} 
				this.$el.addClass( 'active' );
			} else {
				if ( ! this.is_loaded ) {
					this.el.src = this.empty_img;
				}
				this.$el.removeClass( 'active' );
			}

			this.$el.data( 'dimensions', this.model.get_image( 'image', 'dimensions' ) );

			return this.$el; 
		},
		get_image_url: function( choice_id, image ) {
			image = image || 'image'; 
			var active_angle = PC.fe.angles.findWhere( { active: true } );
			var angle_id = active_angle.id; 

			return this.choices.get( choice_id ).attributes.images.get( angle_id ).attributes[image].url; 
		},
		change_layer: function( model ) {
			this.render();
		},
		change_angle: function( model ) {
			if ( model.get( 'active' ) ) {
				this.is_loaded = false;
				this.render();
			}
		},
		img_loaded: function(e) {

			if (this.empty_img == this.$el.prop('src')) return;

			this.is_loaded = true;

			wp.hooks.doAction( 'PC.fe.viewer.layer.preload.complete', this );

			this.parent.imagesLoading --;
			if( this.parent.imagesLoading == 0 ) {
				this.parent.$el.removeClass('is-loading-image');
				wp.hooks.doAction( 'PC.fe.viewer.layers.preload.complete', this );
			}

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
			this.$el.append( $('<a href="#">').text( this.model.get( 'name' ) ) ); 
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

	PC.fe.save_data = {
		choices: [],
		save: function() {
			this.choices = [];
			PC.fe.layers.each( this.parse_choices, this ); 
			return JSON.stringify( this.choices );
		},

		// get choices for one layer 
		parse_choices: function( model ) {
			var choices = PC.fe.getLayerContent( model.id );
			if ( ! choices ) return;
			var angle_id = PC.fe.angles.first().id; 
			if( ! model.attributes.not_a_choice ) {
				if( choices.length > 1 || 'multiple' == model.get( 'type' ) ) {

					var selected_choices = choices.where( { 'active': true } );

					_.each( selected_choices, function( choice ) {
						var img_id = choice.get_image( 'image', 'id' );
	
						this.choices.push( {
							is_choice: true,
							layer_id: model.id,
							choice_id: choice.id,
							angle_id: angle_id,
							layer_name: model.attributes.name,
							image: img_id,
							name: choice.attributes.name,
						} );
					}, this );

				} else {
					var choice = choices.first();
					var img_id = choice.get_image('image', 'id'); 
					this.choices.push({
						is_choice: false,
						layer_id: model.id, 
						choice_id: choice.id, 
						angle_id: angle_id,
						image: img_id, 
					});
				}
			} else {
				var choice = choices.first();
				var img_id = choice.get_image('image', 'id');
				this.choices.push({
					is_choice: false,
					layer_id: model.id,
					choice_id: choice.id,
					angle_id: angle_id,
					image: img_id,
				});
			}
		},
	};
})(jQuery);
