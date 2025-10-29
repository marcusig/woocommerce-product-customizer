/*
	PC.fe.views.viewer_pixi
	-> Alternative main view rendering layers with PIXI instead of <img> tags.
	Does not support custom_html.
*/

PC.fe.views.viewer_pixi_layer = Backbone.View.extend({
	// No DOM placeholder is required; PIXI renders into the canvas.
	tagName: 'div',
	className: 'pixi-layer-placeholder',
	events: {},
	initialize: function( options ) {
		this.parent = options.parent || PC.fe;
		this.viewer = options.viewer; // reference to viewer_pixi instance
		this.layer = PC.fe.layers.get( this.model.get( 'layerId' ) );
		this.is_loaded = false;
		this.sprite = null;
		this.spritesByAngle = {};

		this.listenTo( this.model, 'change:active', this.change_layer );
		this.listenTo( this.model, 'preload-image', this.preload_image );
		this.listenTo( PC.fe.layers, 'change:active', this.toggle_current_layer_class );
		this.listenTo( PC.fe.angles, 'change:active', this.change_angle );

		wp.hooks.doAction( 'PC.fe.choice-img.init', this );

		this.render();
		return this;
	},
	createSprite: function( angleId, img ) {
		if ( ! img ) return null;
		if ( this.spritesByAngle[ angleId ] ) return this.spritesByAngle[ angleId ];
		var texture = PIXI.Texture.from( img );
		var sprite = new PIXI.Sprite( texture );
		sprite.anchor.set( 0 );
		sprite.visible = false;
		sprite.eventMode = 'none';
		var container = this.viewer.getAngleContainer( angleId ) || this.viewer.content;
		container.addChild( sprite );
		this.spritesByAngle[ angleId ] = sprite;
		this.sprite = sprite;
		return sprite;
	},
	render: function( force ) {
		var is_active = this.model.get( 'active' );
		var img = this.model.get_image();
		var angleId = this.viewer.getActiveAngleId();

		var classes = [];
		classes.push( this.model.collection.getType() );
		var layer_class = this.layer.get( 'class_name' );
		if ( layer_class ) classes.push( layer_class );
		if ( this.model.get( 'class_name' ) ) classes.push( this.model.get( 'class_name' ) );
		classes = wp.hooks.applyFilters( 'PC.fe.viewer.layer.classes', classes, this );
		this.$el.addClass( classes.join( ' ' ) );

		wp.hooks.doAction( 'PC.fe.viewer.layer.render', this );

		if ( ! img ) {
			if ( this.sprite ) this.sprite.visible = false;
			wp.hooks.doAction( 'PC.fe.viewer.layer.render.after', this );
			return this.$el;
		}

		var sprite = this.createSprite( angleId, img );
		var textureSrc = sprite && sprite.texture.baseTexture.resource && sprite.texture.baseTexture.resource.src || '';
		var needsTextureSwap = textureSrc !== img && ( force || ! this.is_loaded || is_active );
		if ( needsTextureSwap ) {
			this.viewer.imagesLoading ++;
			this.viewer.$el.addClass('is-loading-image');
			var that = this;
			var newTexture = PIXI.Texture.from( img );
			if ( newTexture.baseTexture.valid ) {
				that.onTextureLoaded( newTexture );
			} else {
				newTexture.baseTexture.once( 'loaded', function() { that.onTextureLoaded( newTexture ); } );
				newTexture.baseTexture.once( 'error', function() { that.onTextureLoaded( newTexture ); } );
			}
		}

		if ( sprite ) sprite.visible = !! is_active;

		// a11y parity (kept on the view container if ever needed)
		if ( ! this.$el.attr( 'data-layer' ) ) {
			this.$el.attr( 'aria-hidden', 'true' );
			this.$el.attr( 'data-layer', this.layer.get( 'admin_label' ) || this.layer.get( 'name' ) );
			this.$el.attr( 'data-choice', this.model.get( 'admin_label' ) || this.model.get( 'name' ) );
			this.$el.attr( 'data-layer_id', this.layer.id );
			this.$el.attr( 'data-choice_id', this.model.id );
		}

		wp.hooks.doAction( 'PC.fe.viewer.layer.render.after', this );
		return this.$el;
	},
	onTextureLoaded: function( texture ) {
		var angleId = this.viewer.getActiveAngleId();
		var sprite = this.spritesByAngle[ angleId ] || this.sprite;
		if ( ! sprite ) return;
		sprite.texture = texture;
		this.is_loaded = true;
		wp.hooks.doAction( 'PC.fe.viewer.layer.preload.complete', this );
		// Capture canonical content size on first successful load
		if ( this.viewer && (! this.viewer.baseContentWidth || ! this.viewer.baseContentHeight) ) {
			if ( texture && texture.valid ) {
				this.viewer.baseContentWidth = texture.width;
				this.viewer.baseContentHeight = texture.height;
				this.viewer.updateCanvasSize();
				this.viewer.updateContentScale();
			}
		}
		this.viewer.imagesLoading --;
		if ( this.viewer.imagesLoading == 0 ) {
			this.viewer.$el.removeClass('is-loading-image');
			wp.hooks.doAction( 'PC.fe.viewer.layers.preload.complete', this );
		}
	},
	change_layer: function() {
		this.render();
	},
	change_angle: function( model ) {
		if ( model.get( 'active' ) ) {
			this.is_loaded = false;
			this.render();
		}
	},
	toggle_current_layer_class: function( layer, new_val ) {
		if ( layer.id !== this.model.get( 'layerId' ) ) return;
		this.$el.toggleClass( 'current_layer', layer.id == this.model.get( 'layerId' ) && new_val );
	},
	preload_image: function() {
		if ( this.model.get( 'active' ) ) return;
		var img = this.model.get_image();
		if ( ! img ) return;
		// Preload via PIXI without making it visible
		PIXI.Texture.from( img );
	}
});

PC.fe.views.viewer_pixi_static_layer = Backbone.View.extend({
	tagName: 'div',
	className: 'pixi-static-layer-placeholder',
	initialize: function( options ) {
		this.parent = options.parent || PC.fe;
		this.viewer = options.viewer;
		this.layer = PC.fe.layers.get( this.model.get( 'layerId' ) );
	this.sprite = null;
	this.spritesByAngle = {};
		this.listenTo( PC.fe.angles, 'change active', this.render );
		wp.hooks.doAction( 'PC.fe.choice-img.init', this );
		this.render();
		return this;
	},
	createSprite: function( angleId, img ) {
		var texture = PIXI.Texture.from( img );
		var sprite = new PIXI.Sprite( texture );
		sprite.anchor.set( 0 );
		sprite.visible = true;
		sprite.eventMode = 'none';
		var container = this.viewer.getAngleContainer( angleId ) || this.viewer.content;
		container.addChild( sprite );
		this.spritesByAngle[ angleId ] = sprite;
		this.sprite = sprite;
	},
	loaded: function() {
		wp.hooks.doAction( 'PC.fe.viewer.layer.preload.complete', this );
		// Capture canonical content size if not yet set
		if ( this.sprite && this.sprite.texture && this.sprite.texture.valid ) {
			if ( ! this.viewer.baseContentWidth || ! this.viewer.baseContentHeight ) {
				this.viewer.baseContentWidth = this.sprite.texture.width;
				this.viewer.baseContentHeight = this.sprite.texture.height;
			}
		}
		this.viewer.imagesLoading --;
		if( this.viewer.imagesLoading == 0 ) {
			this.viewer.$el.removeClass('is-loading-image');
			wp.hooks.doAction( 'PC.fe.viewer.layers.preload.complete', this );
		}
		this.viewer.updateContentScale();
	},
	render: function() {
		var img = this.model.get_image();
		var angleId = this.viewer.getActiveAngleId();

		wp.hooks.doAction( 'PC.fe.viewer.static_layer.render', this );

		var classes = [ 'active', 'static' ];
		classes.push( this.model.collection.getType() );
		var layer_class = this.layer.get( 'class_name' );
		if ( layer_class ) classes.push( layer_class );
		if ( this.model.get( 'class_name' ) ) classes.push( this.model.get( 'class_name' ) );
		classes = wp.hooks.applyFilters( 'PC.fe.viewer.static_layer.classes', classes, this );
		this.$el.addClass( classes.join( ' ' ) );

		this.$el.attr( 'aria-hidden', 'true' );

		if ( img ) {
			this.viewer.imagesLoading ++;
			this.viewer.$el.addClass('is-loading-image');
			var that = this;
			var texture = PIXI.Texture.from( img );
			if ( texture.baseTexture.valid ) {
				that.createSprite( angleId, img );
				that.loaded();
			} else {
				texture.baseTexture.once( 'loaded', function() { that.createSprite( angleId, img ); that.loaded(); } );
				texture.baseTexture.once( 'error', function() { that.createSprite( angleId, img ); that.loaded(); } );
			}
		}
		this.$el.data( 'dimensions', this.model.get_image( 'image', 'dimensions' ) );
		wp.hooks.doAction( 'PC.fe.viewer.layer.render.after', this );
		return this.$el;
	}
});

PC.fe.views.viewer_pixi = Backbone.View.extend({
	tagName: 'div',
	className: 'mkl_pc_viewer mkl_pc_viewer--pixi',
	template: wp.template( 'mkl-pc-configurator-viewer' ),
	imagesLoading: 0,
	initialize: function( options ) {
		this.parent = options.parent || PC.fe;
		this.imagesLoading = 0;
		this.app = null;
		this.stage = null;
		this.content = null;
		this._resizeObserver = null;
		this.baseContentWidth = 0;
		this.baseContentHeight = 0;
		this.angleContainers = {};
		this.activeAngleId = null;
		this.angleTransition = wp.hooks.applyFilters( 'PC.fe.viewer.pixi.angleTransition', 'slide-horizontal', this );
		return this;
	},
	events: {
		'change_layer': 'change_layer'
	},
	render: function() {
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
				return this.$el;
			}

			this.$layers = this.$el.find( '.mkl_pc_layers' );
			this.layers = [];

			// Initialize PIXI application attached to the layers container
			this.initPixi();
			this.add_layers();
			this.add_loader();
		} else {
			console.log('no content to show.');
		}

		wp.hooks.doAction( 'PC.fe.viewer.render', this );
		return this.$el;
	},
	initPixi: function() {
		if ( this.app ) return;
		var container = this.$layers.get(0);
		this.app = new PIXI.Application({
			resizeTo: container,
			backgroundAlpha: 0,
			antialias: true,
			powerPreference: 'high-performance'
		});
		this.stage = this.app.stage;
		this.content = new PIXI.Container();
		this.stage.addChild( this.content );
		container.appendChild( this.app.view );
		// Ensure canvas fills the absolute container
		var view = this.app.view;
		view.style.position = 'absolute';
		view.style.top = '0';
		view.style.left = '0';
		view.style.width = '100%';
		view.style.height = '100%';
		// Observe container size changes to keep renderer in sync
		var that = this;
		this._resizeObserver = new ResizeObserver( function() { that.updateCanvasSize(); } );
		this._resizeObserver.observe( container );
		this.updateCanvasSize();
		this.setupAngleContainers();
		this.listenTo( PC.fe.angles, 'change:active', this.onAngleChange );
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
	setupAngleContainers: function() {
		var that = this;
		this.angleContainers = {};
		var active = null;
		PC.fe.angles.each( function( angle ) {
			var id = angle.id;
			var c = new PIXI.Container();
			c.visible = !! angle.get( 'active' );
			that.content.addChild( c );
			that.angleContainers[ id ] = c;
			if ( angle.get( 'active' ) ) active = id;
		});
		this.activeAngleId = active || ( PC.fe.angles.length ? PC.fe.angles.first().id : null );
	},
	getAngleContainer: function( angleId ) {
		return this.angleContainers[ angleId ] || null;
	},
	getActiveAngleId: function() {
		if ( this.activeAngleId ) return this.activeAngleId;
		var active = PC.fe.angles.findWhere( { active: true } );
		return active ? active.id : ( PC.fe.angles.length ? PC.fe.angles.first().id : null );
	},
	onAngleChange: function( model ) {
		if ( ! model.get( 'active' ) ) return;
		var newId = model.id;
		var oldId = this.activeAngleId;
		if ( newId === oldId ) return;
		this.activeAngleId = newId;
		var from = this.getAngleContainer( oldId );
		var to = this.getAngleContainer( newId );
		this.transitionContainers( from, to );
		// ensure scaling stays correct
		this.updateContentScale();
	},
	transitionContainers: function( from, to ) {
		var transition = this.angleTransition;
		if ( ! from && ! to ) return;
		if ( transition === 'visibility' ) {
			if ( from ) from.visible = false;
			if ( to ) { to.alpha = 1; to.visible = true; to.position.set( 0, 0 ); }
			return;
		}

		var duration = 250;
		var that = this;
		var start = performance.now();
		if ( to ) { to.visible = true; }
		var fromStartAlpha = from ? from.alpha : 1;
		var toStartAlpha = to ? to.alpha : 0;
		var renderer = this.app.renderer;
		var w = renderer.width, h = renderer.height;
		var dirX = 0, dirY = 0;
		switch( transition ) {
			case 'fade':
				if ( to ) to.alpha = 0;
				break;
			case 'slide-vertical':
				dirY = 1; // slide up/down
				if ( to ) { to.y = h; to.alpha = 1; }
				break;
			case 'slide-horizontal':
				dirX = 1; // slide right/left
				if ( to ) { to.x = w; to.alpha = 1; }
				break;
		}
		function step( now ) {
			var t = Math.min( 1, ( now - start ) / duration );
			// ease in-out
			var e = t < 0.5 ? 2*t*t : -1 + (4 - 2*t)*t;
			if ( transition === 'fade' ) {
				if ( from ) from.alpha = fromStartAlpha * ( 1 - e );
				if ( to ) to.alpha = toStartAlpha + ( 1 - toStartAlpha ) * e;
			} else if ( transition === 'slide-vertical' ) {
				if ( from ) from.y = 0 - e * h * dirY;
				if ( to ) to.y = h * ( 1 - e ) * dirY;
			} else if ( transition === 'slide-horizontal' ) {
				if ( from ) from.x = 0 - e * w * dirX;
				if ( to ) to.x = w * ( 1 - e ) * dirX;
			}
			if ( t < 1 ) {
				that.app.ticker.update();
				requestAnimationFrame( step );
			} else {
				if ( from ) { from.visible = false; from.alpha = 1; from.position.set( 0, 0 ); }
				if ( to ) { to.visible = true; to.alpha = 1; to.position.set( 0, 0 ); }
			}
		}
		requestAnimationFrame( step );
	},
	add_choices: function( model ) {
		var choices = PC.fe.getLayerContent( model.id );
		if ( ! choices ) {
			return;
		}
		if ( model.get( 'not_a_choice') ) {
			var choice = choices.first();
			var layer = new PC.fe.views.viewer_pixi_static_layer( { model: choice, parent: this, viewer: this } );
			// Append placeholder for parity
			// this.$layers.append( layer.$el );
		} else {
			choices.each( this.add_single_choice, this );
		}
	},
	add_single_choice: function( model ) {
		if ( model.has_image() || wp.hooks.applyFilters( 'PC.fe.viewer.item.render.empty.images', false, model ) ) {
			var layer = new PC.fe.views.viewer_pixi_layer( { model: model, parent: this, viewer: this } );
			// Append placeholder for parity; PIXI renders to canvas
			// this.$layers.append( layer.$el );
			this.layers[ model.id ] = layer;
		} else {
			this.layers[ model.id ] = false;
		}
		wp.hooks.doAction( 'PC.fe.viewer.item.added', this.layers[ model.id ], this );
	},
	updateCanvasSize: function() {
		if ( ! this.app ) return;
		var container = this.$layers.get(0);
		var w = container.clientWidth || container.offsetWidth || 0;
		var h = container.clientHeight || container.offsetHeight || 0;
		// Fallback: try parent if zero
		if ( (!w || !h) && container.parentElement ) {
			w = container.parentElement.clientWidth || w;
			h = container.parentElement.clientHeight || h;
		}
		if ( w && h ) {
			this.app.renderer.resize( w, h );
			this.updateContentScale();
		}
	},
	getContentBounds: function() {
		// Prefer canonical size if known (all images share dimensions)
		if ( this.baseContentWidth && this.baseContentHeight ) {
			return { width: this.baseContentWidth, height: this.baseContentHeight };
		}
		var maxW = 0, maxH = 0;
		for ( var i = 0; i < this.content.children.length; i++ ) {
			var child = this.content.children[i];
			if ( child.texture && child.texture.valid ) {
				maxW = Math.max( maxW, child.texture.width );
				maxH = Math.max( maxH, child.texture.height );
			}
		}
		return { width: maxW, height: maxH };
	},
	updateContentScale: function() {
		if ( ! this.app || ! this.content ) return;
		var renderer = this.app.renderer;
		var targetW = renderer.width;
		var targetH = renderer.height;
		if ( ! targetW || ! targetH ) return;
		var bounds = this.getContentBounds();
		if ( ! bounds.width || ! bounds.height ) return;
		var scale = Math.min( targetW / bounds.width, targetH / bounds.height );
		this.content.scale.set( scale, scale );
		// center
		var contentW = bounds.width * scale;
		var contentH = bounds.height * scale;
		this.content.x = ( targetW - contentW ) / 2;
		this.content.y = ( targetH - contentH ) / 2;
	}
});


