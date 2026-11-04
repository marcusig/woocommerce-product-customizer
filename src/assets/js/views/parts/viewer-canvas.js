/*
	PC.fe.views.viewer_canvas
	-> The 2D viewer drawn with Pixi: every layer in one canvas instead of one
	   <img> per layer. See docs/canvas-viewer-spec.md.

	Chosen with the `viewer_2d_renderer` setting (PC.fe.config.viewer_2d_renderer)
	and the `PC.fe.viewer.renderer` filter. Whenever it cannot show a product
	correctly - no WebGL, an add-on drawing a layer as DOM, an image it is not
	allowed to read, a lost context - the <img> stack is used instead.
*/

/**
 * Pick the canvas viewer for 2D products when the renderer says so.
 *
 * Runs after the 3D filter (priority 10), and only replaces the default <img>
 * stack: a 3D product, or any other viewer an add-on chose, is left alone.
 */
wp.hooks.addFilter( 'PC.fe.viewer.main_view', 'PC.fe.canvas', function( View ) {
	var Canvas_View = PC.fe.views.viewer_canvas;
	if ( View !== PC.fe.views.viewer ) return View;
	if ( 'canvas' !== Canvas_View.renderer() ) return View;
	// Already given up on this page view, and already reported.
	if ( Canvas_View.disabled ) return View;

	var unsupported = Canvas_View.unsupported_reason();
	if ( unsupported ) {
		// Missing Pixi or WebGL will not change on this page; a DOM-drawn layer
		// belongs to this product only.
		if ( 'dom_item_view' !== unsupported.reason ) Canvas_View.disabled = unsupported;
		Canvas_View.report_fallback( unsupported.reason, unsupported.detail, null );
		return View;
	}
	return Canvas_View;
}, 20 );

PC.fe.views.viewer_canvas = Backbone.View.extend( {
	tagName: 'div',
	className: 'mkl_pc_viewer mkl_pc_viewer--canvas',
	template: wp.template( 'mkl-pc-configurator-viewer' ),
	imagesLoading: 0,

	initialize: function( options ) {
		this.parent = options.parent || PC.fe;
		this.imagesLoading = 0;
		this.app = null;
		this.stacks = {};
		// The stack on screen, and the one being prepared to replace it.
		this.current_stack = null;
		this.target_stack = null;
		this.angle_wait_timer = null;
		this.textures = {};
		this.html_items = [];
		this.pending_layers = {};
		this.sync_scheduled = false;
		this.render_frame = null;
		this.context_timer = null;
		this.resize_observer = null;
		this.is_loading = false;
		this.is_removed = false;
		this.own_children = [];
		this.ready = Promise.resolve();
		return this;
	},

	render: function() {
		wp.hooks.doAction( 'PC.fe.viewer.render.before', this );

		this.$el.append( this.template() );

		if ( ! PC.fe.contents ) {
			console.log( 'no content to show.' );
			wp.hooks.doAction( 'PC.fe.viewer.render', this );
			return this.$el;
		}

		if ( PC.fe.angles.length > 1 ) {
			this.angles_selector = new PC.fe.views.angles( { parent: this } );
			this.$el.append( this.angles_selector.render() );
		} else if ( PC.fe.angles.length ) {
			PC.fe.angles.first().set( 'active', true );
		} else {
			console.error( 'Product configurator: there are no angles set. Please complete the product setup.' );
			return this.$el;
		}

		this.$layers = this.$el.find( '.mkl_pc_layers' );

		// Themes show their loading indicator with `img.loading ~ .images-loading`;
		// this hidden image carries the `loading` class while the picture loads.
		this.$loading_marker = $( '<img class="mkl_pc_canvas_marker" alt="" aria-hidden="true" />' ).css( { visibility: 'hidden', pointerEvents: 'none' } );
		this.$loader = $( '<div class="images-loading" />' );
		this.$layers.append( this.$loading_marker, this.$loader );

		this.add_html_items();
		this.ready = this.start();

		wp.hooks.doAction( 'PC.fe.viewer.render', this );

		// Anything appended to the root after this (the toolbar of an empty
		// configurator, a loading message) is moved along if the viewer is swapped.
		this.own_children = this.$el.children().toArray();

		return this.$el;
	},

	/**
	 * Create the Pixi application, then draw the active angle.
	 *
	 * @return {Promise}
	 */
	start: async function() {
		var app = new PIXI.Application();
		var container = this.$layers.get( 0 );
		try {
			await app.init( {
				width: Math.max( 1, container.clientWidth ),
				height: Math.max( 1, container.clientHeight ),
				backgroundAlpha: 0,
				antialias: true,
				autoDensity: true,
				autoStart: false,
				resolution: Math.min( window.devicePixelRatio || 1, 2 ),
				preference: 'webgl',
			} );
		} catch ( error ) {
			this.fall_back( 'webgl', error );
			return;
		}

		if ( this.is_removed ) {
			app.destroy( { removeView: true }, { children: true } );
			return;
		}

		this.app = app;
		var canvas = app.canvas;
		canvas.className = 'mkl_pc_canvas';
		canvas.setAttribute( 'aria-hidden', 'true' );
		$( canvas ).css( { position: 'absolute', top: 0, left: 0, display: 'block', pointerEvents: 'none' } );
		this.$layers.prepend( canvas );

		this.on_context_lost = this.on_context_lost.bind( this );
		this.on_context_restored = this.on_context_restored.bind( this );
		canvas.addEventListener( 'webglcontextlost', this.on_context_lost );
		canvas.addEventListener( 'webglcontextrestored', this.on_context_restored );

		if ( window.ResizeObserver ) {
			this.resize_observer = new ResizeObserver( this.on_resize.bind( this ) );
			this.resize_observer.observe( container );
		}

		this.listen_to_models();

		var active = PC.fe.angles.findWhere( { active: true } ) || PC.fe.angles.first();
		if ( active ) this.show_angle( active.id );
		this.on_resize();
	},

	listen_to_models: function() {
		this.listenTo( PC.fe.angles, 'change:active', this.on_angle_change );
		// Any layer's visibility can hide another through a group, so a layer
		// change resyncs every layer, as the image pools do.
		this.listenTo( PC.fe.layers, 'change:cshow', this.schedule_sync_all );
		PC.fe.layers.each( function( layer ) {
			var choices = PC.fe.getLayerContent( layer.id );
			if ( ! choices ) return;
			this.listenTo( choices, 'change:active change:cshow', function() {
				this.schedule_sync( layer.id );
			} );
		}, this );
	},

	/**
	 * Key of a choice in the scene. Choice ids repeat across layers.
	 */
	view_key: function( choice ) {
		return choice.get( 'layerId' ) + ':' + choice.id;
	},

	/**
	 * The image a choice shows at an angle, or '' when it has none there.
	 *
	 * @param {Backbone.Model} choice
	 * @param {Number|String} angle_id
	 * @return {String}
	 */
	image_url: function( choice, angle_id ) {
		return choice.get_image( 'image', 'url', angle_id ) || '';
	},

	/**
	 * The size the images of an angle are authored at, from the stored image
	 * dimensions. Null when none are stored: the first texture decides then.
	 */
	angle_size: function( angle_id ) {
		var size = null;
		_.find( PC.fe.viewer_state.layers_in_image_order(), function( layer ) {
			var choices = PC.fe.getLayerContent( layer.id );
			if ( ! choices ) return false;
			var found = choices.find( function( choice ) {
				var dimensions = choice.get( 'images' ) && choice.get_image( 'image', 'dimensions', angle_id );
				return dimensions && 0 < parseInt( dimensions.width ) && 0 < parseInt( dimensions.height );
			} );
			if ( ! found ) return false;
			var dimensions = found.get_image( 'image', 'dimensions', angle_id );
			size = { width: parseInt( dimensions.width ), height: parseInt( dimensions.height ) };
			return true;
		} );
		return size;
	},

	/*
	 * Stacks: one per angle shown so far.
	 * --------------------------------------------------------------------- */

	ensure_stack: function( angle_id ) {
		if ( this.stacks[ angle_id ] ) return this.stacks[ angle_id ];

		var stack = {
			angle_id: angle_id,
			container: new PIXI.Container(),
			layers: {},
			size: this.angle_size( angle_id ),
			probe: null,
			probe_ready: false,
		};
		stack.container.sortableChildren = true;
		stack.container.visible = false;
		this.app.stage.addChild( stack.container );

		_.each( PC.fe.viewer_state.layers_in_image_order(), function( layer, index ) {
			var node = new PIXI.Container();
			node.sortableChildren = true;
			node.zIndex = index;
			stack.container.addChild( node );
			stack.layers[ layer.id ] = { layer: layer, node: node, shown: {}, held: [], hold_timer: null };
		} );

		if ( stack.size ) this.add_probe( stack );
		this.stacks[ angle_id ] = stack;
		return stack;
	},

	/**
	 * A hidden image of the angle's size, laid out by the theme's own rules for
	 * layer images. Where it lands is where the picture is drawn, so the canvas
	 * matches the <img> stack whatever the theme does with it.
	 */
	add_probe: function( stack ) {
		var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + stack.size.width + '" height="' + stack.size.height + '"/>';
		var probe = document.createElement( 'img' );
		probe.className = 'mkl_pc_canvas_probe';
		probe.alt = '';
		probe.setAttribute( 'aria-hidden', 'true' );
		probe.style.visibility = 'hidden';
		probe.style.pointerEvents = 'none';
		this.$loading_marker.before( probe );
		stack.probe = probe;

		var that = this;
		var ready = function() {
			stack.probe_ready = true;
			if ( that.is_removed ) return;
			that.layout();
			that.request_render();
		};
		probe.onload = ready;
		probe.onerror = ready;
		probe.src = 'data:image/svg+xml,' + encodeURIComponent( svg );
	},

	/**
	 * Place every stack where its probe sits.
	 */
	layout: function() {
		if ( ! this.app ) return;
		var container = this.$layers.get( 0 );
		var box = container.getBoundingClientRect();
		_.each( this.stacks, function( stack ) {
			if ( ! stack.size ) return;
			var rect = stack.probe_ready ? stack.probe.getBoundingClientRect() : null;
			if ( rect && rect.width && rect.height ) {
				stack.container.position.set( rect.left - box.left, rect.top - box.top );
				stack.container.scale.set( rect.width / stack.size.width, rect.height / stack.size.height );
				return;
			}
			// The probe is not laid out (hidden by a stylesheet, or still
			// loading): fit inside the viewer without upscaling, centred.
			var width = container.clientWidth;
			var height = container.clientHeight;
			var scale = Math.min( 1, width / stack.size.width, height / stack.size.height );
			stack.container.scale.set( scale, scale );
			stack.container.position.set( ( width - stack.size.width * scale ) / 2, ( height - stack.size.height * scale ) / 2 );
		} );
	},

	on_resize: function() {
		if ( ! this.app || this.is_removed ) return;
		var container = this.$layers.get( 0 );
		var width = Math.max( 1, container.clientWidth );
		var height = Math.max( 1, container.clientHeight );
		if ( width !== this.app.renderer.width || height !== this.app.renderer.height ) {
			this.app.renderer.resize( width, height );
		}
		this.layout();
		this.request_render();
	},

	/*
	 * What is shown.
	 * --------------------------------------------------------------------- */

	schedule_sync: function( layer_id ) {
		this.pending_layers[ layer_id ] = true;
		this.schedule_flush();
	},

	schedule_sync_all: function() {
		PC.fe.layers.each( function( layer ) {
			this.pending_layers[ layer.id ] = true;
		}, this );
		this.schedule_flush();
	},

	/**
	 * Sync at the end of the turn. A choice change arrives as "old inactive",
	 * then "new active"; acting on the first would empty the layer before the
	 * second says what goes in its place.
	 */
	schedule_flush: function() {
		if ( this.sync_scheduled ) return;
		this.sync_scheduled = true;
		var that = this;
		Promise.resolve().then( function() { that.flush(); } );
	},

	flush: function() {
		this.sync_scheduled = false;
		if ( this.is_removed || ! this.target_stack ) return;
		var layer_ids = _.keys( this.pending_layers );
		this.pending_layers = {};
		_.each( layer_ids, function( layer_id ) {
			var record = this.target_stack.layers[ layer_id ];
			if ( record ) this.sync_layer( this.target_stack, record );
		}, this );
		this.after_change();
	},

	sync_stack: function( stack ) {
		_.each( stack.layers, function( record ) {
			this.sync_layer( stack, record );
		}, this );
	},

	/**
	 * Bring one layer of a stack in line with the models.
	 *
	 * New choices start loading and appear once loaded. Choices that leave stay
	 * on screen, under the new ones, until everything the layer is loading has
	 * settled (or PC.fe.viewer.swap_timeout passes), so a selection change never
	 * shows the background in between.
	 */
	sync_layer: function( stack, record ) {
		var state = PC.fe.viewer_state;
		var wanted = {};
		var choices = PC.fe.getLayerContent( record.layer.id );

		_.each( state.shown_choices( record.layer ), function( choice ) {
			if ( ! state.has_drawable( choice ) ) return;
			var key = this.view_key( choice );
			wanted[ key ] = true;
			if ( record.shown[ key ] ) return;
			var entry = {
				key: key,
				model: choice,
				url: this.image_url( choice, stack.angle_id ),
				index: choices ? choices.indexOf( choice ) : 0,
				sprite: null,
				settled: false,
				removed: false,
			};
			record.shown[ key ] = entry;
			this.load_entry( stack, record, entry );
		}, this );

		_.each( _.keys( record.shown ), function( key ) {
			if ( wanted[ key ] ) return;
			var entry = record.shown[ key ];
			delete record.shown[ key ];
			this.hold_or_drop( record, entry );
		}, this );

		this.release_held( record );
	},

	hold_or_drop: function( record, entry ) {
		/**
		 * Whether an image stays up until the one replacing it has loaded.
		 *
		 * @param {Boolean} hold
		 * @param {Object}  entry  The leaving item; `entry.model` is its choice.
		 * @param {Backbone.View} viewer
		 */
		var keep = wp.hooks.applyFilters( 'PC.fe.viewer.hold_previous_image', true, entry, this );
		if ( ! keep || ! entry.sprite ) return this.drop_entry( entry );
		entry.sprite.zIndex = -1;
		record.held.push( entry );
	},

	/**
	 * Let the held images go once nothing the layer shows is still loading.
	 */
	release_held: function( record ) {
		if ( ! record.held.length ) return;
		var loading = _.find( record.shown, function( entry ) {
			return ! entry.settled;
		} );
		if ( ! loading ) {
			this.drop_held( record );
			return;
		}
		if ( record.hold_timer ) return;
		var that = this;
		// However the loading turns out, these images do leave.
		record.hold_timer = setTimeout( function() {
			that.drop_held( record );
			that.request_render();
		}, wp.hooks.applyFilters( 'PC.fe.viewer.swap_timeout', 5000, this ) );
	},

	drop_held: function( record ) {
		if ( record.hold_timer ) clearTimeout( record.hold_timer );
		record.hold_timer = null;
		_.each( record.held, this.drop_entry, this );
		record.held = [];
	},

	drop_entry: function( entry ) {
		entry.removed = true;
		entry.settled = true;
		if ( entry.sprite ) {
			entry.sprite.destroy();
			entry.sprite = null;
		}
	},

	load_entry: function( stack, record, entry ) {
		if ( ! entry.url ) {
			// Nothing to draw at this angle, and that is fine.
			entry.settled = true;
			return;
		}
		var that = this;
		this.load_texture( entry.url ).then( function( texture ) {
			if ( entry.removed || that.is_removed ) return;
			if ( texture ) {
				if ( ! stack.size ) {
					stack.size = { width: texture.width, height: texture.height };
					that.add_probe( stack );
				}
				var sprite = new PIXI.Sprite( texture );
				sprite.position.set( ( stack.size.width - texture.width ) / 2, ( stack.size.height - texture.height ) / 2 );
				sprite.zIndex = entry.index;
				record.node.addChild( sprite );
				entry.sprite = sprite;
				wp.hooks.doAction( 'PC.fe.viewer.layer.preload.complete', entry, that );
			}
			entry.settled = true;
			that.release_held( record );
			that.after_change();
		} );
	},

	/**
	 * Load a texture once per URL.
	 *
	 * The viewer loads and owns its textures rather than going through
	 * PIXI.Assets: that cache is shared by the whole page, and unloading it on
	 * teardown would race with a viewer mounting again as the modal reopens.
	 * The browser's HTTP cache still makes a second load cheap.
	 *
	 * Resolves null when the image cannot be used. A cross-origin image that
	 * fails is assumed to lack CORS headers: WebGL cannot read it at all, while
	 * the <img> stack can still show it, so the viewer falls back.
	 *
	 * @param {String} url
	 * @return {Promise<PIXI.Texture|null>}
	 */
	load_texture: function( url ) {
		if ( this.textures[ url ] ) return this.textures[ url ].promise;
		var that = this;
		var record = { texture: null, failed: false, promise: null };
		var cross_origin = this.is_cross_origin( url );
		record.promise = new Promise( function( resolve ) {
			var image = new Image();
			// Only for other domains: a same-origin request keeps the mode the
			// <img> stack used, so it is served from the same cache entry.
			if ( cross_origin ) image.crossOrigin = 'anonymous';
			image.onload = function() {
				// decode() moves decoding off the main thread, but it stays pending
				// while the page is not rendered (a background tab). It is only an
				// optimisation: past a second the texture is uploaded anyway, so a
				// capture asked for in the background still resolves.
				var decoded = image.decode ? Promise.race( [
					image.decode().catch( function() {} ),
					new Promise( function( done ) { setTimeout( done, 1000 ); } ),
				] ) : Promise.resolve();
				decoded.then( function() {
					if ( that.is_removed ) return resolve( null );
					record.texture = PIXI.Texture.from( image );
					resolve( record.texture );
				} );
			};
			image.onerror = function( error ) {
				record.failed = true;
				if ( cross_origin ) {
					that.fall_back( 'cors', url );
				} else {
					console.log( 'Product configurator: could not load the image ' + url, error );
				}
				resolve( null );
			};
			image.src = url;
		} );
		this.textures[ url ] = record;
		return record.promise;
	},

	is_cross_origin: function( url ) {
		try {
			return new URL( url, window.location.href ).origin !== window.location.origin;
		} catch ( error ) {
			return false;
		}
	},

	is_stack_settled: function( stack ) {
		return ! _.find( stack.layers, function( record ) {
			return _.find( record.shown, function( entry ) {
				return ! entry.settled;
			} );
		} );
	},

	count_loading: function( stack ) {
		var count = 0;
		_.each( stack.layers, function( record ) {
			_.each( record.shown, function( entry ) {
				if ( ! entry.settled ) count++;
			} );
		} );
		return count;
	},

	/**
	 * After any change: finish an angle switch whose picture is ready, update
	 * the loading state, draw.
	 */
	after_change: function() {
		if ( this.is_removed ) return;
		if ( this.target_stack && this.target_stack !== this.current_stack && this.is_stack_settled( this.target_stack ) ) {
			this.swap_stacks();
		}
		this.update_loading();
		this.request_render();
	},

	update_loading: function() {
		var loading = this.target_stack ? this.count_loading( this.target_stack ) : 0;
		this.imagesLoading = loading;
		var was_loading = this.is_loading;
		this.is_loading = 0 < loading;
		this.$el.toggleClass( 'is-loading-image', this.is_loading );
		this.$loading_marker.toggleClass( 'loading', this.is_loading );
		if ( was_loading && ! this.is_loading ) {
			wp.hooks.doAction( 'PC.fe.viewer.layers.preload.complete', this );
		}
	},

	/*
	 * Angles.
	 * --------------------------------------------------------------------- */

	on_angle_change: function( model ) {
		if ( ! model.get( 'active' ) ) return;
		this.show_angle( model.id );
	},

	/**
	 * Switch to an angle. The current picture stays until the new one has
	 * loaded, so the customer never sees a half-built view.
	 */
	show_angle: function( angle_id ) {
		var stack = this.ensure_stack( angle_id );
		this.target_stack = stack;
		this.sync_stack( stack );

		if ( this.angle_wait_timer ) {
			clearTimeout( this.angle_wait_timer );
			this.angle_wait_timer = null;
		}

		if ( ! this.current_stack ) {
			this.current_stack = stack;
			stack.container.visible = true;
		} else if ( this.current_stack !== stack ) {
			var that = this;
			this.angle_wait_timer = setTimeout( function() {
				that.swap_stacks();
				that.request_render();
			}, wp.hooks.applyFilters( 'PC.fe.viewer.swap_timeout', 5000, this ) );
		}

		this.layout();
		this.after_change();
	},

	swap_stacks: function() {
		if ( this.angle_wait_timer ) {
			clearTimeout( this.angle_wait_timer );
			this.angle_wait_timer = null;
		}
		if ( ! this.target_stack || this.target_stack === this.current_stack ) return;
		if ( this.current_stack ) this.current_stack.container.visible = false;
		this.target_stack.container.visible = true;
		this.current_stack = this.target_stack;
	},

	/*
	 * Custom HTML: always above the images (decision D in the spec).
	 * --------------------------------------------------------------------- */

	add_html_items: function() {
		_.each( PC.fe.viewer_state.layers_in_image_order(), function( layer ) {
			var choices = PC.fe.getLayerContent( layer.id );
			if ( ! choices ) return;

			if ( layer.get( 'not_a_choice' ) ) {
				var choice = choices.first();
				if ( ! choice || ! choice.get( 'custom_html' ) ) return;
				var content;
				try {
					content = $( choice.get( 'custom_html' ) );
				} catch ( error ) {
					content = $( '<div class="mkl-custom-html--container" />' );
					content.html( choice.get( 'custom_html' ) );
				}
				this.$loading_marker.before( content );
				this.html_items.push( { $el: content, remove: function() { content.remove(); } } );
				return;
			}

			choices.each( function( choice ) {
				if ( ! choice.get( 'custom_html' ) ) return;
				var html_view = new PC.fe.views.viewer_layer_html( { model: choice, layer: false, parent: this } );
				this.$loading_marker.before( html_view.$el );
				this.html_items.push( html_view );
				wp.hooks.doAction( 'PC.fe.viewer.html_item.added', html_view, this );
			}, this );
		}, this );
	},

	/*
	 * Drawing.
	 * --------------------------------------------------------------------- */

	/**
	 * Draw on the next frame. The viewer only draws when something changed.
	 */
	request_render: function() {
		if ( this.render_frame || ! this.app || this.is_removed ) return;
		var that = this;
		this.render_frame = requestAnimationFrame( function() {
			that.render_frame = null;
			if ( ! that.app || that.is_removed ) return;
			that.app.render();
		} );
	},

	on_context_lost: function() {
		wp.hooks.doAction( 'PC.fe.viewer.context.lost', this, null );
		var that = this;
		if ( this.context_timer ) clearTimeout( this.context_timer );
		this.context_timer = setTimeout( function() {
			that.context_timer = null;
			that.fall_back( 'context_lost' );
		}, 3000 );
	},

	on_context_restored: function() {
		if ( this.context_timer ) clearTimeout( this.context_timer );
		this.context_timer = null;
		wp.hooks.doAction( 'PC.fe.viewer.context.restored', this, null );
		this.request_render();
	},

	/*
	 * Capture (the viewer contract in configurator.js).
	 * --------------------------------------------------------------------- */

	/**
	 * Render the current configuration to a PNG blob, off screen.
	 *
	 * What to draw comes from the models, as for every viewer. Resolves null -
	 * never a partial picture - when an image of the picture cannot be loaded.
	 *
	 * @param {Object} [options] { width, height, maxDimension }
	 * @return {Promise<Blob|null>}
	 */
	capture: async function( options ) {
		options = options || {};
		await this.ready;
		if ( ! this.app || this.is_removed ) return null;

		var angle = PC.fe.angles.findWhere( { active: true } ) || PC.fe.angles.first();
		if ( ! angle ) return null;
		var state = PC.fe.viewer_state;

		/** This filter is documented in viewer.js (get_capture_models). */
		var models = wp.hooks.applyFilters( 'PC.fe.viewer.capture.models', state.picture(), this );

		var urls = [];
		_.each( models, function( choice ) {
			if ( ! state.has_drawable( choice ) ) return;
			var url = this.image_url( choice, angle.id );
			if ( url ) urls.push( url );
		}, this );
		if ( ! urls.length ) return null;

		var that = this;
		var textures = await Promise.all( _.map( urls, function( url ) {
			return that.load_texture( url );
		} ) );
		if ( this.is_removed || ! this.app ) return null;
		if ( _.contains( textures, null ) ) {
			console.log( 'Product configurator: cannot capture the configuration, an image could not be loaded.' );
			return null;
		}

		var size = this.angle_size( angle.id );
		if ( ! size ) {
			size = { width: 0, height: 0 };
			_.each( textures, function( texture ) {
				size.width = Math.max( size.width, texture.width );
				size.height = Math.max( size.height, texture.height );
			} );
		}
		if ( ! size.width || ! size.height ) return null;

		var width = size.width;
		var height = size.height;
		var max_dimension = options.maxDimension || wp.hooks.applyFilters( 'PC.fe.pdf.max_dimension', 1200 );
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
		width = Math.round( width );
		height = Math.round( height );

		var picture = new PIXI.Container();
		_.each( textures, function( texture ) {
			var sprite = new PIXI.Sprite( texture );
			sprite.position.set( ( size.width - texture.width ) / 2, ( size.height - texture.height ) / 2 );
			picture.addChild( sprite );
		} );
		picture.scale.set( width / size.width, height / size.height );
		var wrapper = new PIXI.Container();
		wrapper.addChild( picture );

		var canvas = document.createElement( 'canvas' );
		canvas.width = width;
		canvas.height = height;
		var context = canvas.getContext( '2d' );
		try {
			var extracted = this.app.renderer.extract.pixels( {
				target: wrapper,
				frame: new PIXI.Rectangle( 0, 0, width, height ),
				resolution: 1,
				clearColor: [ 0, 0, 0, 0 ],
			} );
			context.putImageData( this.unpremultiply( extracted.pixels, extracted.width, extracted.height ), 0, 0 );
		} catch ( error ) {
			console.log( 'Product configurator: could not compose the captured image.', error );
			return null;
		} finally {
			wrapper.destroy( { children: true } );
		}

		/** This action is documented in viewer.js (capture). */
		wp.hooks.doAction( 'PC.fe.viewer.capture.canvas', context, canvas, this );

		return new Promise( function( resolve ) {
			try {
				canvas.toBlob( function( blob ) { resolve( blob || null ); }, 'image/png' );
			} catch ( error ) {
				console.log( 'Product configurator: the captured canvas could not be exported.', error );
				resolve( null );
			}
		} );
	},

	/**
	 * Pixels read back from WebGL as a straight-alpha ImageData.
	 *
	 * Pixi 8.16's extract returns premultiplied colour (a 200 grey at alpha 74
	 * comes back as 58), and does not convert it, so semi-transparent edges came
	 * out darker than on screen and than the <img> stack's capture.
	 *
	 * @param {Uint8ClampedArray} pixels Premultiplied RGBA.
	 * @param {Number} width
	 * @param {Number} height
	 * @return {ImageData}
	 */
	unpremultiply: function( pixels, width, height ) {
		var image = new ImageData( width, height );
		var data = image.data;
		for ( var i = 0; i < pixels.length; i += 4 ) {
			var alpha = pixels[ i + 3 ];
			if ( 0 === alpha ) continue;
			if ( 255 === alpha ) {
				data[ i ] = pixels[ i ];
				data[ i + 1 ] = pixels[ i + 1 ];
				data[ i + 2 ] = pixels[ i + 2 ];
			} else {
				var factor = 255 / alpha;
				data[ i ] = pixels[ i ] * factor;
				data[ i + 1 ] = pixels[ i + 1 ] * factor;
				data[ i + 2 ] = pixels[ i + 2 ] * factor;
			}
			data[ i + 3 ] = alpha;
		}
		return image;
	},

	/*
	 * Falling back and tearing down.
	 * --------------------------------------------------------------------- */

	/**
	 * Replace this viewer with the <img> stack, for the rest of the page view.
	 *
	 * @param {String} reason webgl | cors | context_lost
	 * @param {*}      [detail]
	 */
	fall_back: function( reason, detail ) {
		if ( this.is_removed ) return;
		PC.fe.views.viewer_canvas.disabled = { reason: reason, detail: detail };
		PC.fe.views.viewer_canvas.report_fallback( reason, detail, this );

		var modal = PC.fe.modal;
		if ( ! modal || modal.viewer !== this ) {
			this.remove();
			return;
		}

		var View = wp.hooks.applyFilters( 'PC.fe.viewer.main_view', PC.fe.views.viewer );
		var replacement = new View( { parent: modal } );
		var $rendered = replacement.render();
		var own = this.own_children;
		var $foreign = this.$el.children().filter( function() {
			return -1 === own.indexOf( this );
		} );
		$rendered.append( $foreign );
		this.$el.replaceWith( $rendered );
		modal.viewer = replacement;
		this.remove();
	},

	remove: function() {
		this.is_removed = true;
		if ( this.render_frame ) cancelAnimationFrame( this.render_frame );
		this.render_frame = null;
		if ( this.angle_wait_timer ) clearTimeout( this.angle_wait_timer );
		if ( this.context_timer ) clearTimeout( this.context_timer );
		if ( this.resize_observer ) this.resize_observer.disconnect();
		this.resize_observer = null;
		this.stopListening();

		_.each( this.stacks, function( stack ) {
			_.each( stack.layers, function( record ) {
				if ( record.hold_timer ) clearTimeout( record.hold_timer );
			} );
		} );
		this.stacks = {};
		this.current_stack = null;
		this.target_stack = null;

		_.each( this.html_items, function( item ) {
			item.remove();
		} );
		this.html_items = [];
		if ( this.angles_selector ) this.angles_selector.remove();

		// Textures first, while the renderer can still release their GPU copies;
		// the sprites go with the stage.
		_.each( this.textures, function( record ) {
			if ( record.texture ) record.texture.destroy( true );
		} );
		this.textures = {};

		if ( this.app ) {
			var canvas = this.app.canvas;
			canvas.removeEventListener( 'webglcontextlost', this.on_context_lost );
			canvas.removeEventListener( 'webglcontextrestored', this.on_context_restored );
			this.app.destroy( { removeView: true }, { children: true } );
			this.app = null;
		}

		return Backbone.View.prototype.remove.apply( this, arguments );
	}
}, {

	/**
	 * Set once the canvas viewer had to give up on this page view; every later
	 * mount uses the <img> stack. { reason, detail } or null.
	 */
	disabled: null,

	/**
	 * The 2D renderer requested for this product: 'dom' or 'canvas'.
	 *
	 * @return {String}
	 */
	renderer: function() {
		var renderer = ( PC.fe.config && PC.fe.config.viewer_2d_renderer ) || 'dom';
		/**
		 * Filter the 2D renderer: 'dom' (the <img> stack) or 'canvas'.
		 *
		 * @param {String} renderer
		 * @param {Object} product_data PC.fe.currentProductData
		 */
		renderer = wp.hooks.applyFilters( 'PC.fe.viewer.renderer', renderer, PC.fe.currentProductData );
		return 'canvas' === renderer ? 'canvas' : 'dom';
	},

	/**
	 * Why the canvas viewer cannot show this product, or null when it can.
	 *
	 * @return {Object|null} { reason, detail }
	 */
	unsupported_reason: function() {
		if ( this.disabled ) return this.disabled;
		if ( 'undefined' === typeof PIXI || ! PIXI.Application || ! PIXI.Texture ) {
			return { reason: 'pixi_missing' };
		}
		if ( PIXI.isWebGLSupported && ! PIXI.isWebGLSupported() ) {
			return { reason: 'webgl' };
		}

		// A layer an add-on draws as DOM (its own item view) cannot be put in the
		// scene; the whole product uses the <img> stack instead (decision C).
		if ( ! PC.fe.layers || ! PC.fe.contents ) return null;
		var dom_layer = PC.fe.layers.find( function( layer ) {
			var choices = PC.fe.getLayerContent( layer.id );
			if ( ! choices ) return false;
			return choices.find( function( choice ) {
				return PC.fe.views.viewer_layer !== wp.hooks.applyFilters( 'PC.fe.viewer.item.view', PC.fe.views.viewer_layer, choice, null );
			} );
		} );
		if ( dom_layer ) {
			return { reason: 'dom_item_view', detail: dom_layer.get( 'admin_label' ) || dom_layer.get( 'name' ) || dom_layer.id };
		}
		return null;
	},

	report_fallback: function( reason, detail, viewer ) {
		var messages = {
			pixi_missing: 'Pixi is not loaded',
			webgl: 'WebGL is not available',
			dom_item_view: 'the layer "' + detail + '" is drawn by an add-on that does not support it yet',
			cors: 'the image ' + detail + ' is on another domain without CORS headers',
			context_lost: 'the browser dropped its graphics context',
		};
		console.log( 'Product configurator: using the image viewer instead of the canvas viewer: ' + ( messages[ reason ] || reason ) + '.' );
		if ( 'webgl' === reason ) {
			wp.hooks.doAction( 'PC.fe.viewer.webgl.unavailable', viewer, detail || null );
		}
		/**
		 * The canvas viewer was not used, or gave up.
		 *
		 * @param {String} reason pixi_missing | webgl | dom_item_view | cors | context_lost
		 * @param {*}      detail
		 * @param {Backbone.View|null} viewer The canvas viewer, when it had started.
		 */
		wp.hooks.doAction( 'PC.fe.viewer.canvas.fallback', reason, detail, viewer );
	}
} );
