var PC = PC || {};

PC.views = PC.views || {};

(function($, _){

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
			document.addEventListener( 'paste', this.on_paste.bind( this ) );

			// Layers and Angles are common to a simple product, or to variations.
			// this.layers = new PC.layers();
			// this.listenTo( this.products, 'change:', this.update );
		},
		on_paste( event ) {
			
			const text = event.clipboardData?.getData( 'text/plain' );
			try {
				const json = JSON.parse(text);
				if (!json || ! json.type ) return;
				this.trigger( 'pasted-data', json );
			} catch ( error ) {
				console.warn( 'The pasted data is not a valid json object' );
				console.log( text );
				console.log( error );
			}
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

			if( PC.app.admin_data.get('layers') != false ) {
				this.layers = new PC.layers( PC.app.admin_data.get('layers') );
			}
			if( PC.app.admin_data.get('angles') != false ) {
				this.angles = new PC.angles( PC.app.admin_data.get('angles'), { parse: true } );
			}

		},
		remove_relationships: function( collectionName, model ) {

			if( collectionName == 'layers' ) {
				var content = this.current_product.get( 'content' );
				if ( content.get( model.id ) ) {
					content.remove( model.id );
					PC.app.is_modified[ 'content' ] = true;
					if ( PC.app.syncSidebarSaveButtonState ) {
						PC.app.syncSidebarSaveButtonState();
					}
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
				if ( PC.app.syncSidebarSaveButtonState ) {
					PC.app.syncSidebarSaveButtonState();
				}
			}
		},
		get_current_product: function() { return this.current_product; },
		get_current_modal: function() { 
			return this.current_product.editor;
		}, 
	} );

	// PC.views.editor is the main modal window view.
	PC.views.editor = Backbone.View.extend({

		tagName: 'div',
		className: 'pc-modal-container',
		template : wp.media.template( 'mkl-modal' ),
		loading: 0,
		initialize: function( options ) { 

			this.product = options.current_product;
			this.states = new PC.states();
			this.admin = PC.app.get_admin();
			this.loading = 0;

			var menuInlined = PC.states.hasInlinedMenu();

			if ( ! this.admin.structure ) {
				this.loading++;
				PC.app.admin_data.fetch( {
					data: this.product.id != PC.app.id ? { variation_id: this.product.id } : {},
					success: _.bind( this.onAdminDataLoaded, this ),
					error: _.bind( this.onAdminDataLoadError, this )
				} );
			}

			if ( ! this.product.get( 'content' ) ) {
				this.loading++;
				this.contentMissing = true;
			} else {
				this.contentMissing = false;
			}

			this.open();

			this.$el.addClass( 'loading' );

			if ( menuInlined && typeof PC_lang !== 'undefined' && PC_lang.admin_menu ) {
				this.states.reset( PC_lang.admin_menu, { parse: true } );
			} else {
				this.loading++;
				this.states.fetch( {
					url: this.states.url() + '&id=' + this.product.id,
					success: _.bind( this.fetched, this ),
					error: _.bind( this.onMenuLoadError, this )
				} );
			}

			if ( this.loading === 0 ) {
				this.refresh();
				this.$el.removeClass( 'loading' );
				this.clearLoadErrorUI();
			}
			return this;
		},

		onAdminDataLoaded: function( model, res, options ) {
			var configurator_source = PC.app.admin_data.get( 'configurator_source' ) || 'local';
			this.$el.addClass( 'mkl-pc-configurator-is-' + configurator_source );

			this.admin.set_data();

			this.fetched( model, res, options );

			if ( this.contentMissing ) {
				this.contentMissing = false;
				this.product.fetch( {
					success: _.bind( this.fetched, this ),
					error: _.bind( this.onProductContentLoadError, this )
				} );
			}
		},

		onAdminDataLoadError: function( model, res, options ) {
			if ( window.console && console.log ) {
				console.log( 'error fetching configurator init data', model, res, options );
			}
			this.handleLoadError( 'init', res );
		},

		onMenuLoadError: function( collection, res, options ) {
			if ( window.console && console.log ) {
				console.log( 'error fetching configurator menu', collection, res, options );
			}
			this.handleLoadError( 'menu', res );
		},

		onProductContentLoadError: function( model, res, options ) {
			if ( window.console && console.log ) {
				console.log( 'error fetching product content', model, res, options );
			}
			this.handleLoadError( 'content', res );
		},

		handleLoadError: function( step, xhr ) {
			this.loading = 0;
			this.$el.removeClass( 'loading' );
			this.$el.addClass( 'load-error' );
			var msg = ( typeof PC_lang !== 'undefined' && PC_lang.editor_load_failed )
				? PC_lang.editor_load_failed
				: 'Could not load the configurator.';
			var $screen = this.$el.find( '.loading-screen' );
			$screen.find( '.mkl-pc-editor-load--busy' ).attr( 'hidden', true ).hide();
			var $err = $screen.find( '.mkl-pc-editor-load--error' );
			$err.removeAttr( 'hidden' ).show();
			$err.find( '.mkl-pc-editor-load__message' ).text( msg );
			if ( window.wp && wp.a11y && wp.a11y.speak ) {
				wp.a11y.speak( msg );
			}
		},

		clearLoadErrorUI: function() {
			this.$el.removeClass( 'load-error' );
			var $screen = this.$el.find( '.loading-screen' );
			$screen.find( '.mkl-pc-editor-load--error' ).attr( 'hidden', true ).hide();
			$screen.find( '.mkl-pc-editor-load--busy' ).removeAttr( 'hidden' ).show();
		},

		retryLoad: function( e ) {
			if ( e && e.preventDefault ) {
				e.preventDefault();
			}
			this.clearLoadErrorUI();
			this.$el.addClass( 'loading' );

			var menuInlined = PC.states.hasInlinedMenu();
			this.loading = 0;

			if ( ! this.admin.structure ) {
				this.loading++;
				PC.app.admin_data.fetch( {
					data: this.product.id != PC.app.id ? { variation_id: this.product.id } : {},
					success: _.bind( this.onAdminDataLoaded, this ),
					error: _.bind( this.onAdminDataLoadError, this )
				} );
			}

			if ( ! this.product.get( 'content' ) ) {
				this.loading++;
				this.contentMissing = true;
			} else {
				this.contentMissing = false;
			}

			if ( menuInlined && typeof PC_lang !== 'undefined' && PC_lang.admin_menu ) {
				this.states.reset( PC_lang.admin_menu, { parse: true } );
			} else {
				this.loading++;
				this.states.fetch( {
					url: this.states.url() + '&id=' + this.product.id,
					success: _.bind( this.fetched, this ),
					error: _.bind( this.onMenuLoadError, this )
				} );
			}

			if ( this.loading === 0 ) {
				this.refresh();
				this.$el.removeClass( 'loading' );
				this.clearLoadErrorUI();
			}
		},
 		// States are fecthed
		fetched: function( model, response, options ) {
			this.loading--;
			if( this.loading == 0 ) {
				this.refresh(); 
				this.$el.removeClass( 'loading' );
				this.clearLoadErrorUI();
			}
		},

		events: {
			'click .mkl-pc-admin-ui__close': 'close',
			'click .mkl-pc-editor-load__retry': 'retryLoad',
		},

		open: function() {

			var that = this;
			if( this.opened ) return false;

			if( !this.modal ) {
				this.render();
				this.modal = this.$('.pc-modal');
				this.backdrop = this.$('.pc-modal-backdrop');
			
				this.modal_content = this.modal.find('.mkl-pc-admin-ui__main');
				this.statesView = new PC.views.states( { el: this.modal_content, parent:this } );
			}
			
			this.modal.show();
			this.backdrop.show();
			// States: menu elements`
			this.opened = true;

			$('body').addClass('pc-modal-opened');

		},

		close: function() {
			if ( this.$el.hasClass( 'load-error' ) ) {
				var closeMsg = ( typeof PC_lang !== 'undefined' && PC_lang.editor_close_after_load_error )
					? PC_lang.editor_close_after_load_error
					: 'The configurator did not finish loading. Close anyway?';
				if ( ! window.confirm( closeMsg ) ) {
					return false;
				}
			} else if ( PC.app && PC.app.isGlobalLayerFocusActive && PC.app.isGlobalLayerFocusActive() && PC.app.global_layer_session_dirty ) {
				if ( ! PC.app.requestLeaveGlobalLayerFocus() ) {
					return false;
				}
			}
			if ( _.indexOf( _.values( PC.app.is_modified ), true ) != -1 ) {
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




})(jQuery, PC._us || window._ );