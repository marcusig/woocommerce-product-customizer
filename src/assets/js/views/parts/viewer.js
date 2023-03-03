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
		
		if ( PC_config.config.use_canvas ) {
			this.c = new PC.fe.views.canvas();
			this.$el.append( this.c.$el );
		}

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
			if ( this.c ) {
				// var c_item = new fabric.Image( layer.el, { left: 0, top: 0 } );
				// choice.set( 'c_item', c_item );
				// this.c.fcanvas.add( c_item );
				this.c.add_image( choice );
			} else {
				this.$layers.append( layer.$el );
			}
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
			if ( this.c ) {
				this.c.add_image( model );
				// var c_item = fabric.Image.fromURL( model.get_image(), function( image ) {
				// 	model.set( 'c_item', image );
				// 	c.fcanvas.add( image );
				// } );
			} else {
				this.$layers.append( layer.$el );
			}
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

PC.fe.views.canvas = Backbone.View.extend({ 
	tagName: 'canvas',
	events: {},
	zindex: 0,
	initialize: function() {
		this.render();
		return this;
	},
	render: function() {
		this.fcanvas = new fabric.Canvas( this.el );
		this.fcanvas.setDimensions( { width: 1500, height: 1500 }, { backstoreOnly: true } )
		this.fcanvas.setDimensions( { width: 'auto', height: 'auto' }, { cssOnly: true } )
	},
	add_image: function( model ) {
		// console.log( 'add image', model, model.get_image() );
		if ( ! model.get_image() ) return false; 
		// console.log( 'add image', model.get_image() );
		fabric.Image.fromURL( model.get_image(), function( image ) {
			//console.log( 'add image loaded', image, this.fcanvas );
			model.set( 'c_item', image );
			// this.fcanvas.add( image );
		if ( ! model.get( 'active' ) ) image.visible = false; 
			this.fcanvas.insertAt( image, this.zindex );
			this.zindex++;
		}.bind( this ) );
	}
});
