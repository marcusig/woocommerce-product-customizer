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
		wp.hooks.doAction( 'PC.fe.viewer.render.before', this );

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
			// Choice ids are only unique WITHIN a layer, so this.layers (keyed by
			// choice id) silently overwrites views across layers. Keep a correctly
			// keyed index for anything that needs to find a view reliably.
			this.layer_views = {};
			this.pools = {};
			this.order_index = {};

			this.add_loader();
			this.add_layers();
	

		} else {
			console.log('no content to show.');
		}
		
		wp.hooks.doAction( 'PC.fe.viewer.render', this );

		return this.$el; 

	},

	add_loader: function() {
		this.$loader = $( '<div class="images-loading" />' );
		this.$layers.append( this.$loader );
	},

	/**
	 * Whether the viewer should render only the images it shows.
	 *
	 * Off unless the store turns it on: it removes the <img> of every unselected
	 * choice, and a stylesheet or customisation may count on those being in the
	 * page (`img:not(.active)`, sibling combinators, counting children). On for
	 * new stores, off for existing ones.
	 *
	 * Force it either way with:
	 *   wp.hooks.addFilter( 'PC.fe.viewer.active_images_only', 'my-theme', function() { return true; } );
	 *
	 * @return {Boolean}
	 */
	active_images_only: function() {
		return !! wp.hooks.applyFilters( 'PC.fe.viewer.active_images_only', !! PC.fe.config.viewer_active_images_only, this );
	},

	/**
	 * Whether this layer's images are managed as a pool.
	 *
	 * Only layer types that show what is selected. Anything else draws itself and
	 * decides its own visibility - a text overlay renders a canvas per choice -
	 * so those keep an element per choice, as before.
	 *
	 * @param {Backbone.Model} layer
	 * @return {Boolean}
	 */
	layer_is_pooled: function( layer ) {
		var type = layer.get( 'type' ) || 'simple';
		var pooled = -1 !== [ 'simple', 'multiple' ].indexOf( type );
		return !! wp.hooks.applyFilters( 'PC.fe.viewer.layer_is_pooled', pooled, layer, this );
	},

	add_layers: function() {
		var orders = PC.fe.layers.pluck( 'image_order' );
		if ( orders.length && _.max( orders ) ) {
			PC.fe.layers.orderBy = 'image_order';
			PC.fe.layers.sort();
		}

		// Remember where each layer's images belong in the stack. An image can be
		// created long after this first pass - when its choice is selected, or when
		// conditional logic reveals its layer - and by then the collection may have
		// been re-sorted by another view (the layers list orders it by `order`), so
		// position is recorded here rather than looked up later.
		this.order_index = {};
		PC.fe.layers.each( function( layer, index ) {
			this.order_index[ layer.id ] = index;
		}, this );

		PC.fe.layers.each( this.add_choices, this );
	}, 

	/**
	 * Where an element belongs among the viewer's layers: the layer's position in
	 * image order, then the choice's position within the layer, then 0 for the
	 * image itself and 1 for the custom HTML that follows it.
	 *
	 * @param {Backbone.Model} choice
	 * @param {Number} [tail]
	 * @return {Array}
	 */
	sort_key: function( choice, tail ) {
		var layer_id = choice.get( 'layerId' );
		var content = PC.fe.getLayerContent( layer_id );
		var layer_position = ( this.order_index && 'undefined' !== typeof this.order_index[ layer_id ] ) ? this.order_index[ layer_id ] : PC.fe.layers.length;
		return [ layer_position, content ? content.indexOf( choice ) : 0, tail || 0 ];
	},

	compare_sort: function( a, b ) {
		for ( var i = 0; i < Math.max( a.length, b.length ); i++ ) {
			var x = a[ i ] || 0;
			var y = b[ i ] || 0;
			if ( x !== y ) return x < y ? -1 : 1;
		}
		return 0;
	},

	/**
	 * Put an element where it belongs in the stack, rather than at the end.
	 *
	 * The first pass runs in image order, so appending would do - but an image can
	 * be created much later, when its choice is selected or when conditional logic
	 * reveals its layer, and it still has to sit at the right depth.
	 *
	 * @param {jQuery} $el
	 * @param {Array} sort From sort_key().
	 */
	insert_image: function( $el, sort ) {
		$el.data( 'mkl_sort', sort ).attr( 'data-mkl-sorted', '1' );

		var $before = null;
		var that = this;
		this.$layers.children( '[data-mkl-sorted]' ).each( function() {
			var other = $( this ).data( 'mkl_sort' );
			if ( ! other ) return;
			if ( 0 < that.compare_sort( other, sort ) ) {
				$before = $( this );
				return false;
			}
		} );

		if ( $before ) {
			$before.before( $el );
		} else if ( this.$loader && this.$loader.length ) {
			this.$loader.before( $el );
		} else {
			this.$layers.append( $el );
		}
	},

	add_choices: function( model ) {
		var choices = PC.fe.getLayerContent( model.id );
		if ( ! choices ) {
			return;
		}
		if ( model.get( 'not_a_choice') ) {
			var choice = choices.first();
			var layer = new PC.fe.views.viewer_static_layer( { model: choice, parent: this } );
			// Keep the view so capture() can ask it for its drawable, like any other layer.
			if ( choice ) {
				this.layers[ choice.id ] = layer;
				this.layer_views[ this.view_key( choice ) ] = layer;
				this.insert_image( layer.$el, this.sort_key( choice ) );
			} else {
				this.$layers.append( layer.$el );
			}
			if ( choice.get( 'custom_html' ) ) {
				var content;
				try {
					content = $( choice.get( 'custom_html' ) );
				} catch( e ) {
					content = $( '<div class="mkl-custom-html--container" />' );
					content.html( choice.get( 'custom_html' ) )
				}
				this.insert_image( content, this.sort_key( choice, 1 ) );
			}
		} else if ( this.active_images_only() && this.layer_is_pooled( model ) ) {
			this.pools[ model.id ] = new PC.fe.views.viewer_layer_pool( { model: model, parent: this } );
		} else {
			choices.each( this.add_single_choice, this );
		}
	},

	add_single_choice: function( model ) {
		if ( model.has_image() || wp.hooks.applyFilters( 'PC.fe.viewer.item.render.empty.images', false, model ) ) {
			var View = wp.hooks.applyFilters( 'PC.fe.viewer.item.view', PC.fe.views.viewer_layer, model, this );
			var layer = new View( { model: model, parent: this } );
			this.insert_image( layer.$el, this.sort_key( model ) );
		} else {
			layer = false;
		}

		wp.hooks.doAction( 'PC.fe.viewer.item.added', layer, this );
		if ( model.get( 'custom_html' ) ) {
			var html_layer = new PC.fe.views.viewer_layer_html( { model: model, layer: layer, parent: this } );
			this.insert_image( html_layer.$el, this.sort_key( model, 1 ) );
			wp.hooks.doAction( 'PC.fe.viewer.html_item.added', html_layer, this );
		}
		this.layers[ model.id ] = layer;
		this.layer_views[ this.view_key( model ) ] = layer;
	},

	/**
	 * Index key for a choice's layer view. Choice ids repeat across layers, so
	 * the layer id has to be part of the key.
	 */
	view_key: function( choice ) {
		return choice.get( 'layerId' ) + ':' + choice.id;
	},

	/**
	 * Whether a model is hidden by conditional logic.
	 *
	 * Reads `cshow` off the models rather than looking for the `cshow-hidden`
	 * class, so the answer is the same with or without a rendered DOM.
	 */
	is_hidden_by_conditions: function( choice ) {
		if ( PC.conditionalLogic && PC.conditionalLogic.item_is_hidden ) {
			return !! PC.conditionalLogic.item_is_hidden( choice );
		}
		// Conditional logic is not installed: fall back to the plain flags.
		if ( false === choice.get( 'cshow' ) ) return true;
		var layer = PC.fe.layers.get( choice.get( 'layerId' ) );
		return !! ( layer && false === layer.get( 'cshow' ) );
	},

	/**
	 * The choice models that make up the current picture, bottom layer first.
	 *
	 * Mirrors what add_layers()/add_choices() put on screen, but derived purely
	 * from the models: layers in image_order, every ACTIVE choice of each
	 * (multiple-choice layers can have several), minus anything conditional
	 * logic has hidden. Static (`not_a_choice`) layers are always drawn, as
	 * viewer_static_layer does.
	 *
	 * @return {Array} choice models
	 */
	get_capture_models: function() {
		var models = [];
		var that = this;
		var ordered = PC.fe.layers.sortBy( function( layer ) {
			return parseInt( layer.get( 'image_order' ) ) || 0;
		} );

		_.each( ordered, function( layer ) {
			var choices = PC.fe.getLayerContent( layer.id );
			if ( ! choices ) return;
			if ( that.is_hidden_by_conditions_layer( layer ) ) return;

			if ( layer.get( 'not_a_choice' ) ) {
				var first = choices.first();
				if ( first ) models.push( first );
				return;
			}

			choices.each( function( choice ) {
				if ( ! choice.get( 'active' ) ) return;
				if ( choice.get( 'is_group' ) ) return;
				if ( that.is_hidden_by_conditions( choice ) ) return;
				models.push( choice );
			} );
		} );

		/**
		 * Filter the models composited into a captured image.
		 *
		 * @param {Array} models Choice models, bottom layer first.
		 * @param {Backbone.View} viewer
		 */
		return wp.hooks.applyFilters( 'PC.fe.viewer.capture.models', models, this );
	},

	/**
	 * The thing to draw for one choice: whatever the layer view that owns it
	 * offers, so implementations that are not a plain <img> (the text overlay
	 * renders a canvas) come through too.
	 *
	 * Returns:
	 *   HTMLImageElement | HTMLCanvasElement - draw this
	 *   'none'                               - nothing to draw, and that is fine
	 *   null                                 - cannot represent this layer
	 *
	 * @param {Backbone.Model} choice
	 * @return {HTMLElement|string|null}
	 */
	get_capture_source: function( choice ) {
		var view = this.layer_views ? this.layer_views[ this.view_key( choice ) ] : null;

		// A view may describe its own drawable (the contract's extension point).
		if ( view && 'function' === typeof view.get_capture_source ) {
			return view.get_capture_source();
		}

		if ( view && view.el ) {
			if ( 'IMG' === view.el.tagName ) {
				// Only usable once decoded; an empty placeholder means "nothing here".
				if ( ! view.el.getAttribute( 'src' ) || 0 === view.el.getAttribute( 'src' ).indexOf( 'data:image/gif' ) ) return 'none';
				return view.el.complete && view.el.naturalWidth ? view.el : null;
			}
			var canvas = view.el.querySelector ? view.el.querySelector( 'canvas' ) : null;
			if ( canvas ) return canvas;
		}

		// No view (not rendered, or the choice carries no image at all).
		if ( ! choice.has_image() ) return 'none';

		return null;
	},

	is_hidden_by_conditions_layer: function( layer ) {
		if ( false === layer.get( 'cshow' ) ) return true;
		if ( PC.conditionalLogic && PC.conditionalLogic.parent_is_hidden ) {
			return !! PC.conditionalLogic.parent_is_hidden( layer );
		}
		return false;
	},

	/**
	 * Capture the current configuration to a PNG blob (see the viewer contract
	 * in configurator.js).
	 *
	 * WHAT to draw comes from the models (active choices, minus anything
	 * conditional logic hid); HOW to draw each one comes from the layer view that
	 * owns it, so a text overlay's canvas composites alongside plain images. No
	 * CSS class is consulted, so this does not depend on the markup a particular
	 * viewer happens to emit.
	 *
	 * Resolves null - never a partial picture - when a visible layer cannot be
	 * represented or the canvas is tainted by a cross-origin image, so callers
	 * fall back knowingly instead of shipping a wrong image.
	 *
	 * @param {Object} [options] { width, height, maxDimension }
	 * @return {Promise<Blob|null>}
	 */
	capture: function( options ) {
		options = options || {};
		var that = this;
		var models = this.get_capture_models();
		if ( ! models.length ) return Promise.resolve( null );

		var max_dimension = options.maxDimension || wp.hooks.applyFilters( 'PC.fe.pdf.max_dimension', 1200 );

		var sources = [];
		for ( var i = 0; i < models.length; i++ ) {
			var source = that.get_capture_source( models[ i ] );
			if ( null === source ) {
				// A layer we can see but cannot draw: refuse rather than drop it.
				console.log(
					'Product configurator: cannot capture the layer "' +
					( models[ i ].get( 'name' ) || models[ i ].id ) +
					'", falling back to another capture method.'
				);
				return Promise.resolve( null );
			}
			if ( 'none' !== source ) sources.push( source );
		}

		if ( ! sources.length ) return Promise.resolve( null );

		var width = 0, height = 0;
		_.each( sources, function( el ) {
			width = Math.max( width, el.naturalWidth || el.width || 0 );
			height = Math.max( height, el.naturalHeight || el.height || 0 );
		} );
		if ( ! width || ! height ) return Promise.resolve( null );

		if ( options.width && options.height ) {
			width = options.width;
			height = options.height;
		} else if ( width > max_dimension || height > max_dimension ) {
			var ratio = height / width;
			if ( height > width ) {
				height = max_dimension;
				width = height / ratio;
			} else {
				width = max_dimension;
				height = width * ratio;
			}
		}

		var canvas = document.createElement( 'canvas' );
		canvas.width = Math.round( width );
		canvas.height = Math.round( height );
		var ctx = canvas.getContext( '2d' );

		try {
			_.each( sources, function( el ) {
				ctx.drawImage( el, 0, 0, canvas.width, canvas.height );
			} );
		} catch ( err ) {
			console.log( 'Product configurator: could not compose the captured image.', err );
			return Promise.resolve( null );
		}

		/**
		 * Draw on top of the composited layers (watermark, background...).
		 *
		 * @param {CanvasRenderingContext2D} ctx
		 * @param {HTMLCanvasElement} canvas
		 * @param {Backbone.View} viewer
		 */
		wp.hooks.doAction( 'PC.fe.viewer.capture.canvas', ctx, canvas, this );

		return new Promise( function( resolve ) {
			try {
				canvas.toBlob( function( blob ) { resolve( blob || null ); }, 'image/png' );
			} catch ( err ) {
				// Tainted canvas: a layer image is on another domain that does not
				// send Access-Control-Allow-Origin.
				console.log( 'Product configurator: the captured canvas could not be exported (cross-origin image).', err );
				resolve( null );
			}
		} );
	}
});