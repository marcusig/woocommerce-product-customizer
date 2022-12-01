var PC = PC || {};

PC.views = PC.views || {};

(function($){

	// BASE VIEW, MANAGING KEEPING RECORDS OF ALL THE MODALS / PRODUCTS
	/*
	Can only have One Layers collection
	Can only have One Angles collection
	*/
	PC.views.admin = Backbone.View.extend({
		modals: [],
		// products: {},
		structure: false,
		events: {
			// 'removed-structure-element': 'remove_relationships',
		},
		initialize: function() {

			this.products = new PC.products();

			// Layers and Angles are common to a simple product, or to variations.
			// this.layers = new PC.layers();
			// this.listenTo( this.products, 'change:', this.update );
		}, 
		open: function( options ) { 
			if( options.product_id === undefined) {
				throw( { name: 'Error', message: 'product_id parameter is missing to start the configurator.' } );
				return false; 
			}

			// IF we haven't created this product, add it to collection
			if( !this.products.get( options.product_id ) ) { 
				this.products.add( options );
			}

			// Sets the current product we want to edit 
			this.current_product = this.products.get( options.product_id ); 
			// Checks if the product has an editor view already rendered
			if( !this.current_product.editor ) { 
				// if yes, open it
				this.current_product.editor = new PC.views.editor( { current_product: this.current_product } );

			} else {
				this.current_product.editor.open();	
			}
		},

		close: function() {
			this.get_current_modal().close();
		},

		set_data: function() {

			// if( PC.app.admin_data.get('layers') != false ) {
			// this.layers = new PC.layers();
			// }

			// if( PC.app.admin_data.get('angles') != false ) {
			// 	this.angles = new PC.angles( PC.app.admin_data.get('angles') );
			// }

		},
		remove_relationships: function( collectionName, model ) {

			if( collectionName == 'layers' ) {
				var content = this.current_product.get( 'content' );
				if ( content.get( model.id ) ) {
					content.remove( model.id );
					PC.app.is_modified[ 'content' ] = true;
				}
			}

			if ( collectionName == 'angles' ) {
				var content = this.current_product.get( 'content' );
				if (!content) return;
				content.each( function( choices, index ) {
					choices.get( 'choices' ).each( function( choice ) {
						var images = choice.get( 'images' ).where( { angleId: model.id } );
						choice.get( 'images' ).remove( images );
					} );
					
				}, this );
				PC.app.is_modified[ 'content' ] = true;
			}
		},
		get_current_product: function() { return this.current_product; },
		get_current_modal: function() { 
			return this.current_product.editor;
		}, 
	} );

	// PC.views.editor is the main modal window view.
	// There can be one editor per variation
	PC.views.editor = Backbone.View.extend({

		tagName: 'div',
		className: 'pc-modal-container',
		template : wp.media.template( 'mkl-modal' ),
		loading: 0,
		initialize: function( options ){ 

			this.product = options.current_product;
			this.states = new PC.states();
			this.admin = PC.app.get_admin();
			this.content = this.product.get( 'content' );

			if ( ! this.admin.structure ) {
				// this.loading ++;
				/**
				 * CREATE THE Angles COLLECTION
				 * and fetch any existing angles
				 */
				this.admin.angles = new PC.angles();
				this.loading ++;
				this.admin.angles.fetch( { success: this.fetched.bind( this ) } );

				/**
				 * CREATE THE LAYERS COLLECTION
				 * and fetch any existing layers
				 */
				this.admin.layers = new PC.layers();
				this.loading ++;
				this.admin.layers.fetch( { success: function() {
					this.admin.layers.each( function( layer, ind ) {
						this.loading ++;
						/**
						 * For each layer, create a Choice collection, and fetch any belonging choice.
						 */
						var choices_collection = new PC.choices( [], { layer: layer } );
						setTimeout( function() {
							choices_collection.fetch( { success: this.fetched.bind( this ) } );
							this.content.add( { layerId: layer.id, choices: choices_collection } );
						}.bind( this ), 50 * ind );
					}.bind( this ) );

					this.fetched();

				}.bind( this ) } );

				this.loading ++;
				PC.app.admin_data.fetch( {
					success: PC._us.bind(function( model, res, options ) {
						this.fetched( model, res, options );

						if ( this.contentMissing ) {
							this.contentMissing = false;
							this.product.fetch( {
								success: PC._us.bind(this.fetched, this),
								error: function(model, res, options) {
									console.log('error fecthing data');
									console.log( model, res, options );
								}
							});
						}

		
					}, this),
					error: function(model, res, options) {
						console.log('error fecthing data');
						console.log( model, res, options );
					}
				}); 

			}

			// if ( ! this.product.get( 'content' ) ) {
			// 	this.loading ++;
			// 	this.contentMissing = true;
			// }

			this.open();

			this.$el.addClass('loading'); 
			// fetch the states from the server
			this.loading ++;
			this.states.fetch( {
				// when received, executes this.fetched
				url: this.states.url() + '&id=' + this.product.id, 
				success: PC._us.bind(this.fetched, this)

			} );

			wp.hooks.doAction( 'PC.admin.editor.init', this );

			return this;
		},
 		// States are fecthed
		fetched: function( model, response, options ) {
			this.loading --;
			if ( 0 == this.loading ) {
				this.refresh(); 
				this.$el.removeClass('loading');
			}
		},

		events: {
			'click .media-modal-close': 'close',
			// 'click .pc-modal-backdrop': 'close',
		},

		open: function() {

			var that = this;
			if( this.opened ) return false;

			if( !this.modal ) {
				this.render();
				this.modal = this.$('.pc-modal');
				this.backdrop = this.$('.pc-modal-backdrop');
			
				this.modal_content = this.modal.find('.media-frame');
				this.statesView = new PC.views.states( { el: this.modal_content, parent:this } );
			}
			
			this.modal.show();
			this.backdrop.show();
			// States: menu elements`
			this.opened = true;

			$('body').addClass('pc-modal-opened');

		},

		close: function() {
			if( PC._us.indexOf( PC._us.values( PC.app.is_modified ), true ) != -1 ) { 
				if( !confirm( PC.lang.confirm_closing || 'Some values have not been saved. Are you sure you want to close?' ) ) 
					return false;
			}
			this.opened = false;
			this.modal.hide();
			this.backdrop.hide();
			$('body').removeClass('pc-modal-opened');
		},
		refresh: function() {
			
			if ( this.modal ) {
				this.statesView.render();
			}

		},
		render: function() {
			// rendering App modal base		
			$('body').append( this.$el.html( this.template() ) );

		},
		// get_menu: function(){
		// 	$.post(
		// 		ajaxurl, 
		// 		{ action:'pc_get_menu', data: 'menu' },
		// 		function( response ) {
		// 			PC.menu = response;
		// 			// return response;
		// 		}
		// 	);
		// }
	});




})(jQuery);