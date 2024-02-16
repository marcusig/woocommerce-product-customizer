/*
	PC.fe.views.configurator 
	-> MAIN WINDOW
*/
PC.fe.views.configurator = Backbone.View.extend({
	tagName: 'div',
	className: 'mkl_pc',
	template: wp.template( 'mkl-pc-configurator' ), 
	initialize: function( options ) {
		this.options = options;
		var product_id = options.product_id;
		var parent_id = options.parent_id;
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
		'click .close-mkl-pc': 'close',
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

		setTimeout( _.bind( this.$el.addClass, this.$el, 'opened' ), 10 );

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

		setTimeout( _.bind( this.$el.hide, this.$el ), 500 );
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

		// this.summary = new PC.fe.views.summary();
		// this.$main_window.append( this.summary.$el );

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
	resetConfig: function() {
		// Reset the configuration
		PC.fe.contents.content.resetConfig();

		// Maybe load the initial preset
		if ( PC.fe.initial_preset ) {
			PC.fe.setConfig( PC.fe.initial_preset );
		}
		
		// Maybe reset the view
		if ( 1 < PC.fe.angles.length ) {
			PC.fe.angles.each( function( model ) {
				model.set('active' , false); 
			} );
			PC.fe.angles.first().set( 'active', true ); 
		}

		// Trigger an action after reseting
		wp.hooks.doAction( 'PC.fe.reset_configurator' );
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
