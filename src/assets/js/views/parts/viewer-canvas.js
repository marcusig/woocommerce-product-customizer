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
		// Loaded textures by URL: see load_texture().
		this.textures = {};
		this.texture_clock = 0;
		this.url_bucket = null;
		this.resolution_timer = null;
		this.background = null;
		// Full-size decodes in flight, and the ones waiting: see decode_slot().
		this.decoding = 0;
		this.decode_queue = [];
		// Entries waiting for a texture, by URL: they pin it (is_pinned()).
		this.waiting = {};
		// Flat copies of left angles, by angle id; the one drawn in place of
		// the current stack, if any; the angle transition running. See the
		// Snapshots section of docs/canvas-viewer-spec.md.
		this.snapshots = {};
		this.cover = null;
		this.transition = null;
		// How the angles not shown are kept (phase 4b): 'live', 'refresh' or
		// 'reload'. See update_mode().
		this.mode = 'refresh';
		this.picture_bytes = 0;
		this.live_blocked = false;
		this.background_dirty = false;
		this.idle_timer = null;
		this.refresh_job = null;
		this.show_clock = 0;
		this.html_items = [];
		// Add-on items drawn in the scene, by choice key (canvas_item()), and
		// the ones that changed since the last frame.
		this.items = {};
		this.dirty_items = [];
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
				// The viewer manages its textures itself (texture_budget()), and
				// frees their images once uploaded (free_source()): Pixi's
				// collector would unload an idle texture from the GPU and upload
				// it again from an image that is gone.
				gcActive: false,
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
			// Hovering or focusing a choice (choice.js).
			this.listenTo( choices, 'preload-image', this.preload );
		}, this );
	},

	/**
	 * Key of a choice in the scene. Choice ids repeat across layers.
	 */
	view_key: function( choice ) {
		return choice.get( 'layerId' ) + ':' + choice.id;
	},

	/**
	 * The add-on item drawing a choice in the scene, or null for a plain image.
	 * Asked once per choice and viewer. See the Add-ons section of
	 * docs/canvas-viewer-spec.md.
	 *
	 * @param {Backbone.Model} choice
	 * @return {Object|null}
	 */
	canvas_item: function( choice ) {
		var key = this.view_key( choice );
		if ( key in this.items ) return this.items[ key ];
		var item = PC.fe.views.viewer_canvas.ask_item( choice, this.item_context( choice ) );
		this.items[ key ] = item;
		return item;
	},

	/**
	 * What an item gets to talk to the viewer.
	 */
	item_context: function( choice ) {
		var that = this;
		var item = null;
		return {
			viewer: this,
			layer: PC.fe.layers.get( choice.get( 'layerId' ) ) || null,
			// The item changed: update() runs on each of its containers before
			// the next frame is drawn.
			request_render: function() {
				item = item || that.items[ that.view_key( choice ) ];
				if ( item ) that.item_changed( item );
			},
		};
	},

	/**
	 * What the viewer passes to an item's create() and update() for a stack.
	 *
	 * resolution: device pixels per pixel of the angle's image, so text is
	 * rasterised as sharp as it is shown.
	 */
	item_options: function( stack ) {
		var renderer = this.app && this.app.renderer;
		var scale = stack.container.scale.x || 1;
		return {
			size: stack.size,
			resolution: scale * ( renderer ? renderer.resolution : 1 ),
			capture: false,
		};
	},

	item_changed: function( item ) {
		if ( this.is_removed ) return;
		if ( -1 === this.dirty_items.indexOf( item ) ) this.dirty_items.push( item );
		this.note_activity();
		// Other angles' snapshots may now be stale: the idle refresh redraws them.
		this.background_dirty = true;
		this.after_change();
	},

	/**
	 * Run update() on the containers of the items that changed.
	 */
	apply_item_updates: function() {
		if ( ! this.dirty_items.length ) return;
		var dirty = this.dirty_items;
		this.dirty_items = [];
		this.each_item_entry( function( entry, stack ) {
			if ( -1 === dirty.indexOf( entry.item ) ) return;
			this.update_item_entry( entry, stack );
		} );
	},

	update_item_entry: function( entry, stack, options ) {
		if ( ! entry.sprite || ! entry.item.update ) return;
		options = options || this.item_options( stack );
		entry.item_resolution = options.resolution;
		entry.item_size = options.size;
		try {
			entry.item.update( entry.sprite, stack.angle_id, options );
		} catch ( error ) {
			console.log( 'Product configurator: an add-on item could not update.', error );
		}
	},

	each_item_entry: function( callback ) {
		_.each( this.stacks, function( stack ) {
			_.each( stack.layers, function( record ) {
				_.each( record.shown, function( entry ) {
					if ( entry.item ) callback.call( this, entry, stack );
				}, this );
			}, this );
		}, this );
	},

	/**
	 * The image a choice shows at an angle, or '' when it has none there.
	 *
	 * The responsive pick is the <img> stack's (viewer_layer.render()), on the
	 * same width, so both viewers request the same files.
	 *
	 * @param {Backbone.Model} choice
	 * @param {Number|String} angle_id
	 * @return {String}
	 */
	image_url: function( choice, angle_id ) {
		var bucket = this.image_bucket();
		if ( 'mobile' === bucket && choice.get_image( 'image', 'url_mobile', angle_id ) ) {
			return choice.get_image( 'image', 'url_mobile', angle_id );
		}
		if ( 'large' === bucket && choice.get_image( 'image', 'url_large', angle_id ) ) {
			return choice.get_image( 'image', 'url_large', angle_id );
		}
		return choice.get_image( 'image', 'url', angle_id ) || '';
	},

	/**
	 * Which image size the breakpoints ask for: mobile, default or large.
	 *
	 * @return {String}
	 */
	image_bucket: function() {
		var config = PC.fe.config || {};
		var width = PC.fe.modal && PC.fe.modal.$el ? PC.fe.modal.$el.outerWidth() : 0;
		if ( width && config.mobile_image_breakpoint && width < config.mobile_image_breakpoint ) return 'mobile';
		if ( width && config.large_image_breakpoint && width >= config.large_image_breakpoint ) return 'large';
		return 'default';
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
		// What angle transitions move and fade; layout() places the container
		// inside it, so the two never fight over the position.
		stack.frame = new PIXI.Container();
		stack.frame.addChild( stack.container );
		this.app.stage.addChild( stack.frame );

		// In the view's own order when it has one: each view keeps its stack, so a view's
		// order is set once, here, and switching views reorders nothing.
		_.each( PC.fe.viewer_state.layers_in_image_order( angle_id ), function( layer, index ) {
			var node = new PIXI.Container();
			node.sortableChildren = true;
			node.zIndex = index;
			stack.container.addChild( node );
			stack.layers[ layer.id ] = { layer: layer, node: node, shown: {}, held: [], hold_timer: null, mask: null, item_masks: {} };
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
		// Items drawn at another resolution than they are now shown at, or
		// before the angle's size was known (the first image tells).
		this.each_item_entry( function( entry, stack ) {
			var options = this.item_options( stack );
			if ( entry.item_resolution !== options.resolution || entry.item_size !== options.size ) this.update_item_entry( entry, stack, options );
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
		this.stop_refresh();
		// A flat copy only lines up with the layout it was taken in.
		if ( this.cover && this.current_stack && this.cover.snapshot.layout !== this.layout_key( this.current_stack ) ) {
			this.uncover();
		}
		this.request_render();

		// Crossing a breakpoint changes which file each choice shows: resync, and
		// the layers swap images the way a selection change does.
		var bucket = this.image_bucket();
		if ( null !== this.url_bucket && bucket !== this.url_bucket ) this.schedule_sync_all();
		this.url_bucket = bucket;

		// A bigger box may need sharper textures. Waits for the resize to settle,
		// so dragging a window edge does not reload anything along the way.
		if ( this.resolution_timer ) clearTimeout( this.resolution_timer );
		var that = this;
		this.resolution_timer = setTimeout( function() {
			that.resolution_timer = null;
			if ( that.is_removed ) return;
			// Below the mobile breakpoint the budget is smaller.
			that.enforce_budget();
			that.prune_snapshots();
			// The budget may have changed: live mode may be tried again.
			that.live_blocked = false;
			that.update_mode();
			if ( that.current_stack ) that.check_resolution( that.current_stack );
			if ( that.target_stack && that.target_stack !== that.current_stack ) that.check_resolution( that.target_stack );
		}, 250 );
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
		this.note_activity();
		// Other angles follow once the shown one is done (update_loading()).
		this.background_dirty = true;
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

		// The layer's mask on this angle first: its images wait for it.
		this.sync_mask( stack, record );

		var to_load = [];
		_.each( state.shown_choices( record.layer ), function( choice ) {
			var item = this.canvas_item( choice );
			if ( ! item && ! state.has_drawable( choice ) ) return;
			var key = this.view_key( choice );
			// An item draws itself: it has no file, and stays as it is.
			var url = item ? null : this.image_url( choice, stack.angle_id );
			wanted[ key ] = true;
			if ( record.shown[ key ] ) {
				if ( record.shown[ key ].url === url ) return;
				// Same choice, another file (a breakpoint was crossed): the old
				// image stays up until the new one has loaded.
				this.hold_or_drop( record, record.shown[ key ] );
				delete record.shown[ key ];
			}
			var entry = {
				key: key,
				model: choice,
				url: url,
				item: item,
				stack: stack,
				record: null,
				index: choices ? choices.indexOf( choice ) : 0,
				sprite: null,
				settled: false,
				removed: false,
			};
			record.shown[ key ] = entry;
			to_load.push( entry );
		}, this );

		// The masks the layer's items ask for, before they load: they wait for them.
		this.sync_item_masks( stack, record );
		_.each( to_load, function( entry ) {
			this.load_entry( stack, record, entry );
		}, this );
		// What an item asks to be cut with can change while nothing else does.
		if ( this.has_masks( record ) || ( record.node && record.node.mask ) ) this.apply_mask( stack, record );

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
		if ( entry.mask_sprite ) {
			PC.fe.views.viewer_canvas.destroy_sprite( entry.mask_sprite );
			entry.mask_sprite = null;
		}
		if ( entry.sprite ) {
			// An item's container goes with what it holds; its textures are the
			// item's (text, a canvas), not the viewer's.
			if ( entry.item ) PC.fe.views.viewer_canvas.destroy_item_container( entry.item, entry.sprite );
			else entry.sprite.destroy();
			entry.sprite = null;
		}
		if ( entry.record ) {
			entry.record.entries = _.without( entry.record.entries, entry );
			entry.record = null;
		}
		// One image fewer: a layer back to one image goes back to the node mask.
		var layer_record = entry.stack && entry.stack.layers && entry.model ? entry.stack.layers[ entry.model.get( 'layerId' ) ] : null;
		if ( layer_record && this.has_masks( layer_record ) ) this.apply_mask( entry.stack, layer_record );
	},

	/*
	 * Layer masks (docs/layer-masks-spec.md).
	 * --------------------------------------------------------------------- */

	/**
	 * Bring a layer's mask in line with the angle: load the layer's mask for
	 * it, or drop the one it has. Loaded as a texture of the viewer under its
	 * own key (mask_key()), redrawn as Pixi reads masks (whiten()), inside the budget like any texture.
	 *
	 * Until it is in (or has failed), the layer counts as loading
	 * (mask_pending()), and its images wait for it (load_entry()), so the
	 * picture never shows the layer uncut. A mask that cannot load leaves the
	 * layer unmasked (decision 6).
	 */
	sync_mask: function( stack, record ) {
		var image = PC.fe.layer_masks ? PC.fe.layer_masks.get( record.layer, stack.angle_id ) : null;
		var url = image ? image.url : '';
		var mask = record.mask;
		if ( mask && mask.url === url && ! mask.abandoned && ! ( mask.texture_record && mask.texture_record.destroyed ) ) return;
		this.drop_mask( record );
		if ( ! url ) {
			this.apply_mask( stack, record );
			return;
		}
		record.mask = this.load_mask( stack, record, url, function( loaded ) {
			return record.mask === loaded;
		} );
	},

	/**
	 * The masks a layer's add-on items ask for, other than the layer's own
	 * (item_mask_url()): loaded and pinned like the layer's, dropped once no
	 * item of the layer, shown or held, asks for them.
	 */
	sync_item_masks: function( stack, record ) {
		record.item_masks = record.item_masks || {};
		var layer_url = record.mask ? record.mask.url : '';
		var wanted = {};
		_.each( _.values( record.shown ).concat( record.held ), function( entry ) {
			if ( ! entry.item ) return;
			var url = this.entry_mask_url( stack, record, entry );
			if ( url && url !== layer_url ) wanted[ url ] = true;
		}, this );
		_.each( _.keys( record.item_masks ), function( url ) {
			if ( ! wanted[ url ] ) this.drop_item_mask( record, url );
		}, this );
		_.each( _.keys( wanted ), function( url ) {
			var mask = record.item_masks[ url ];
			if ( mask && ! mask.abandoned && ! ( mask.texture_record && mask.texture_record.destroyed ) ) return;
			if ( mask ) this.drop_item_mask( record, url );
			record.item_masks[ url ] = this.load_mask( stack, record, url, function( loaded ) {
				return record.item_masks[ url ] === loaded;
			} );
		}, this );
	},

	/**
	 * The mask an entry is cut with: the layer's for an image, the one the
	 * item asks for (statics.item_mask_url()) for an add-on item. '' for none.
	 */
	entry_mask_url: function( stack, record, entry ) {
		if ( ! entry.item ) return record.mask ? record.mask.url : '';
		return PC.fe.views.viewer_canvas.item_mask_url( entry.item, record.layer, stack.angle_id );
	},

	/**
	 * Load a mask for a layer of a stack: a texture of the viewer under its
	 * mask key, redrawn as Pixi reads masks (whiten()), inside the budget, pinned
	 * by the layer while in use (mask_users). Applied once in; one that cannot
	 * load leaves what it cuts uncut (layer masks decision 6).
	 *
	 * @param {Object}   stack
	 * @param {Object}   record  The layer's record.
	 * @param {String}   url
	 * @param {Function} current Whether the returned mask is still the one in use.
	 * @return {Object} The mask: { url, key, texture_record, done, failed, abandoned, promise }
	 */
	load_mask: function( stack, record, url, current ) {
		var that = this;
		var statics = PC.fe.views.viewer_canvas;
		var key = statics.mask_key( url );
		var mask = { url: url, key: key, texture_record: null, done: false, failed: false, abandoned: false, promise: null };
		var shown_or_coming = function() {
			return stack === that.current_stack || stack === that.target_stack;
		};
		var wanted = function() {
			return current( mask ) && ( shown_or_coming() || ( 'live' === that.mode && that.stacks[ stack.angle_id ] === stack ) );
		};
		// Pinned while it loads, like an image waiting for its sprite.
		var waiter = { stack: stack, mask: true };
		( this.waiting[ key ] = this.waiting[ key ] || [] ).push( waiter );
		var settle = function( texture_record ) {
			that.waiting[ key ] = _.without( that.waiting[ key ] || [], waiter );
			if ( ! that.waiting[ key ].length ) delete that.waiting[ key ];
			if ( that.is_removed || ! current( mask ) ) return;
			if ( statics.abandoned === texture_record ) {
				// Its angle was left: loaded again when shown (the layer stays pending).
				mask.abandoned = true;
				return;
			}
			if ( texture_record && texture_record.texture && ! texture_record.destroyed ) {
				mask.texture_record = texture_record;
				( texture_record.mask_users = texture_record.mask_users || [] ).push( { stack: stack, record: record, mask: mask } );
				that.touch( texture_record );
			} else {
				mask.failed = true;
				console.log( 'Product configurator: the mask ' + url + ' could not be loaded, what it cuts is drawn unmasked.' );
			}
			mask.done = true;
			that.apply_mask( stack, record );
			that.after_change();
			that.enforce_budget();
		};
		mask.promise = this.load_texture( key, stack, wanted, function() {
			return ! shown_or_coming();
		} ).then( settle, function( error ) {
			console.log( 'Product configurator: could not prepare the mask ' + url, error );
			settle( null );
		} );
		return mask;
	},

	/**
	 * Whether a layer has a mask, its own or one of its items'.
	 */
	has_masks: function( record ) {
		return !! record.mask || ( !! record.item_masks && Object.keys( record.item_masks ).length > 0 );
	},

	/**
	 * Whether a layer is still waiting for its mask.
	 */
	mask_pending: function( record ) {
		if ( record.mask && ! record.mask.done ) return true;
		var masks = record.item_masks || {};
		return Object.keys( masks ).some( function( url ) {
			return masks[ url ] && ! masks[ url ].done;
		} );
	},

	/**
	 * Resolves once the layer's mask is in, has failed or was given up.
	 *
	 * @return {Promise}
	 */
	mask_ready: function( record ) {
		var masks = record.item_masks || {};
		var promises = [];
		if ( record.mask && record.mask.promise ) promises.push( record.mask.promise );
		Object.keys( masks ).forEach( function( url ) {
			if ( masks[ url ] && masks[ url ].promise ) promises.push( masks[ url ].promise );
		} );
		return promises.length ? Promise.all( promises ) : Promise.resolve();
	},

	/**
	 * Forget a layer's mask: its sprites go, and its texture is no longer
	 * pinned by this layer.
	 */
	drop_mask: function( record ) {
		var mask = record.mask;
		record.mask = null;
		this.unpin_mask( mask );
		this.clear_mask_sprites( record );
	},

	/**
	 * Forget a mask an item of the layer asked for.
	 */
	drop_item_mask: function( record, url ) {
		var mask = record.item_masks[ url ];
		delete record.item_masks[ url ];
		this.unpin_mask( mask );
		this.clear_mask_sprites( record );
	},

	/**
	 * Every mask of a layer, its own and its items'.
	 */
	drop_masks: function( record ) {
		var that = this;
		Object.keys( record.item_masks || {} ).forEach( function( url ) {
			that.drop_item_mask( record, url );
		} );
		this.drop_mask( record );
	},

	unpin_mask: function( mask ) {
		if ( ! mask || ! mask.texture_record || ! mask.texture_record.mask_users ) return;
		mask.texture_record.mask_users = _.reject( mask.texture_record.mask_users, function( user ) {
			return user.mask === mask;
		} );
	},

	/**
	 * Whether a mask is one of the layer's, its own or an item's.
	 */
	holds_mask: function( record, mask ) {
		return !! mask && ( record.mask === mask || ( record.item_masks || {} )[ mask.url ] === mask );
	},

	clear_mask_sprites: function( record ) {
		var destroy = PC.fe.views.viewer_canvas.destroy_sprite;
		if ( record.node ) record.node.mask = null;
		if ( record.mask_sprite ) {
			destroy( record.mask_sprite );
			record.mask_sprite = null;
		}
		var clear = function( entry ) {
			if ( ! entry.mask_sprite ) return;
			if ( entry.sprite ) entry.sprite.mask = null;
			destroy( entry.mask_sprite );
			entry.mask_sprite = null;
		};
		_.each( record.shown, clear );
		_.each( record.held, clear );
	},

	/**
	 * Cut a layer's images with its mask (decision 7: each image on its own),
	 * and its add-on items with the mask each asks for (item_mask_url()).
	 *
	 * A layer drawing one image cut by the layer's mask masks its node, the
	 * cheap way. Anything else masks each sprite: several images (a multiple
	 * choice layer, or an image held during a swap), so overlapping images are
	 * cut the way the <img> stack and the server merge cut them; or an item
	 * asking for another mask than the layer's, or none, which the node mask
	 * would cut anyway. The mask sprites live in the node, placed like an image
	 * of the mask's size; Pixi does not draw a sprite used as a mask.
	 */
	apply_mask: function( stack, record ) {
		if ( ! record || this.is_removed ) return;
		var usable = function( mask ) {
			return mask && mask.texture_record && mask.texture_record.texture && ! mask.texture_record.destroyed ? mask.texture_record : null;
		};
		var layer_url = record.mask ? record.mask.url : '';
		var plan = _.map( _.filter( _.values( record.shown ).concat( record.held ), function( entry ) {
			return !! entry.sprite;
		} ), function( entry ) {
			// An image: the layer's mask.
			if ( ! entry.item ) return { entry: entry, texture_record: usable( record.mask ), layer: true };
			var url = this.entry_mask_url( stack, record, entry );
			var mask = ! url ? null : ( url === layer_url ? record.mask : ( record.item_masks || {} )[ url ] );
			return { entry: entry, texture_record: usable( mask ), layer: !! url && url === layer_url };
		}, this );
		var layer_texture = usable( record.mask );
		if ( ! layer_texture && ! _.find( plan, function( step ) {
			return step.texture_record;
		} ) ) {
			this.clear_mask_sprites( record );
			this.request_render();
			return;
		}

		var statics = PC.fe.views.viewer_canvas;
		var that = this;
		var ensure = function( sprite, texture_record ) {
			if ( sprite && sprite.texture === texture_record.texture && ! sprite.destroyed ) {
				that.place_mask_sprite( sprite, stack, texture_record );
				return sprite;
			}
			if ( sprite ) statics.destroy_sprite( sprite );
			sprite = new PIXI.Sprite( texture_record.texture );
			that.place_mask_sprite( sprite, stack, texture_record );
			record.node.addChild( sprite );
			return sprite;
		};
		var unmask = function( entry ) {
			if ( ! entry.mask_sprite ) return;
			entry.sprite.mask = null;
			statics.destroy_sprite( entry.mask_sprite );
			entry.mask_sprite = null;
		};

		if ( layer_texture && plan.length <= 1 && ( ! plan.length || plan[ 0 ].layer ) ) {
			_.each( plan, function( step ) {
				unmask( step.entry );
			} );
			record.mask_sprite = ensure( record.mask_sprite, layer_texture );
			record.node.mask = record.mask_sprite;
		} else {
			record.node.mask = null;
			if ( record.mask_sprite ) {
				statics.destroy_sprite( record.mask_sprite );
				record.mask_sprite = null;
			}
			_.each( plan, function( step ) {
				if ( ! step.texture_record ) {
					unmask( step.entry );
					return;
				}
				step.entry.mask_sprite = ensure( step.entry.mask_sprite, step.texture_record );
				step.entry.sprite.mask = step.entry.mask_sprite;
			} );
		}
		this.request_render();
	},

	/**
	 * A mask sprite at its natural size, centred in the angle like an image.
	 */
	place_mask_sprite: function( sprite, stack, texture_record ) {
		var natural = texture_record.natural;
		var size = stack.size || natural;
		this.fit_sprite( sprite, texture_record );
		sprite.position.set( ( size.width - natural.width ) / 2, ( size.height - natural.height ) / 2 );
	},

	load_entry: function( stack, record, entry ) {
		if ( entry.item ) return this.load_item_entry( stack, record, entry );
		if ( ! entry.url ) {
			// Nothing to draw at this angle, and that is fine.
			entry.settled = true;
			return;
		}
		var that = this;
		var url = entry.url;
		// From the moment a texture resolves until its sprite exists, nothing
		// else marks it as used, and another load's enforce_budget() would
		// release it. The waiting entry pins it for that window.
		( this.waiting[ url ] = this.waiting[ url ] || [] ).push( entry );
		var shown_or_coming = function() {
			return entry.stack === that.current_stack || entry.stack === that.target_stack;
		};
		var wanted = function() {
			if ( entry.removed ) return false;
			// Another visited angle only while they are kept live (update_mode()).
			return shown_or_coming() || ( 'live' === that.mode && that.stacks[ entry.stack.angle_id ] === entry.stack );
		};
		var background = function() {
			return ! shown_or_coming();
		};
		this.load_texture( url, stack, wanted, background ).then( function( texture_record ) {
			// A masked layer's image is not drawn before its mask is in: the
			// waiting entry keeps the texture pinned meanwhile.
			return that.mask_ready( record ).then( function() {
				return texture_record;
			} );
		} ).then( function( texture_record ) {
			that.waiting[ url ] = _.without( that.waiting[ url ] || [], entry );
			if ( ! that.waiting[ url ].length ) delete that.waiting[ url ];
			if ( entry.removed || that.is_removed ) return;
			if ( PC.fe.views.viewer_canvas.abandoned === texture_record ) {
				// Its angle was left before the image's turn to decode came. The
				// entry goes, so showing that angle again creates and loads it anew.
				if ( record.shown[ entry.key ] === entry ) delete record.shown[ entry.key ];
				entry.removed = true;
				entry.settled = true;
				that.release_held( record );
				that.after_change();
				return;
			}
			if ( texture_record && ( texture_record.destroyed || ! texture_record.texture ) ) {
				// Released anyway (a remount, a context loss): load it again, once.
				entry.retries = ( entry.retries || 0 ) + 1;
				if ( entry.retries <= 1 ) {
					that.load_entry( stack, record, entry );
					return;
				}
				texture_record = null;
			}
			if ( texture_record ) {
				var natural = texture_record.natural;
				if ( ! stack.size ) {
					stack.size = { width: natural.width, height: natural.height };
					that.add_probe( stack );
				}
				var sprite = new PIXI.Sprite( texture_record.texture );
				that.fit_sprite( sprite, texture_record );
				sprite.position.set( ( stack.size.width - natural.width ) / 2, ( stack.size.height - natural.height ) / 2 );
				sprite.zIndex = entry.index;
				record.node.addChild( sprite );
				entry.sprite = sprite;
				entry.record = texture_record;
				texture_record.entries.push( entry );
				that.apply_mask( stack, record );
				that.touch( texture_record );
				wp.hooks.doAction( 'PC.fe.viewer.layer.preload.complete', entry, that );
			}
			entry.settled = true;
			that.release_held( record );
			that.after_change();
			that.enforce_budget();
		} ).catch( function( error ) {
			// A bug must not leave the angle loading for ever: count it as a
			// failed image, like one that could not be downloaded.
			console.log( 'Product configurator: could not draw the image ' + url, error );
			that.waiting[ url ] = _.without( that.waiting[ url ] || [], entry );
			if ( ! that.waiting[ url ].length ) delete that.waiting[ url ];
			if ( entry.removed || that.is_removed ) return;
			entry.settled = true;
			that.release_held( record );
			that.after_change();
		} );
	},

	/**
	 * An add-on item's entry: once the item is ready (its fonts loaded, say),
	 * it creates its container for the angle, placed in the choice's layer
	 * node like an image. Counts as loading until then.
	 */
	load_item_entry: function( stack, record, entry ) {
		var that = this;
		var item = entry.item;
		var ready;
		try {
			ready = item.ready ? item.ready( stack.angle_id ) : null;
		} catch ( error ) {
			ready = null;
		}
		var done = function() {
			if ( entry.removed || that.is_removed || ! that.app ) return;
			var options = that.item_options( stack );
			var container = null;
			try {
				container = item.create( stack.angle_id, options ) || null;
			} catch ( error ) {
				console.log( 'Product configurator: an add-on item could not be drawn.', error );
			}
			if ( container ) {
				container.zIndex = entry.index;
				record.node.addChild( container );
				entry.sprite = container;
				entry.item_resolution = options.resolution;
				entry.item_size = options.size;
				if ( that.has_masks( record ) ) that.apply_mask( stack, record );
			}
			entry.settled = true;
			that.release_held( record );
			that.after_change();
		};
		// Never drawn uncut: the layer's masks first, its own and its items'.
		var masked = function() {
			if ( that.mask_pending( record ) ) {
				that.mask_ready( record ).then( done, done );
			} else {
				done();
			}
		};
		if ( ready && 'function' === typeof ready.then ) {
			// A failed ready() still draws: a fallback font beats an endless loader.
			ready.then( masked, masked );
		} else {
			masked();
		}
	},

	/**
	 * Draw a possibly downscaled texture at its image's natural size, in the
	 * stack's coordinates (the angle's image size).
	 */
	fit_sprite: function( sprite, texture_record ) {
		sprite.scale.set(
			texture_record.natural.width / texture_record.texture.width,
			texture_record.natural.height / texture_record.texture.height
		);
	},

	/*
	 * Textures.
	 * --------------------------------------------------------------------- */

	/**
	 * Load an image once, decoded, at its full size.
	 *
	 * The viewer loads and owns its images rather than going through
	 * PIXI.Assets: that cache is shared by the whole page, and unloading it on
	 * teardown would race with a viewer mounting again as the modal reopens.
	 * The browser's HTTP cache still makes a second load cheap.
	 *
	 * Resolves null when the image cannot be used. A cross-origin image that
	 * fails is assumed to lack CORS headers: WebGL cannot read it at all, while
	 * the <img> stack can still show it, so the viewer falls back.
	 *
	 * @param {String}  url
	 * @param {Boolean} defer_decode Resolve once downloaded, without decoding:
	 *                               the caller decodes in a slot (decode_slot()).
	 * @return {Promise<HTMLImageElement|null>}
	 */
	load_image: function( url, defer_decode ) {
		var that = this;
		var cross_origin = this.is_cross_origin( url );
		return new Promise( function( resolve ) {
			var image = new Image();
			// Only for other domains: a same-origin request keeps the mode the
			// <img> stack used, so it is served from the same cache entry.
			if ( cross_origin ) image.crossOrigin = 'anonymous';
			image.onload = function() {
				if ( defer_decode ) {
					resolve( that.is_removed || ! image.naturalWidth ? null : image );
					return;
				}
				that.decode_image( image ).then( function() {
					resolve( that.is_removed || ! image.naturalWidth ? null : image );
				} );
			};
			image.onerror = function( error ) {
				if ( cross_origin ) {
					that.fall_back( 'cors', url );
				} else {
					console.log( 'Product configurator: could not load the image ' + url, error );
				}
				resolve( null );
			};
			image.src = url;
		} );
	},

	/**
	 * decode() moves decoding off the main thread, but it stays pending while
	 * the page is not rendered (a background tab). It is only an optimisation:
	 * past a second the image is used anyway, so a capture asked for in the
	 * background still resolves.
	 *
	 * @return {Promise}
	 */
	decode_image: function( image ) {
		if ( ! image.decode ) return Promise.resolve();
		return Promise.race( [
			image.decode().catch( function() {} ),
			new Promise( function( done ) { setTimeout( done, 1000 ); } ),
		] );
	},

	/**
	 * How many images may be decoded at full size at once.
	 *
	 * Each one costs width × height × 4 until its texture is built (32 MiB for
	 * 3840×2160), whatever the texture's final size. Started all together, the
	 * first picture of a product with many layers briefly needs all of them at
	 * once, which is what made iOS Safari kill the tab (see the performance
	 * section of docs/canvas-viewer-spec.md). Downloads are not limited.
	 *
	 * @return {Number}
	 */
	decode_limit: function() {
		var limit = PC.fe.views.viewer_canvas.small_screen() ? 3 : 6;
		/**
		 * Filter how many images the canvas viewer decodes at full size at once.
		 *
		 * @param {Number} limit
		 * @param {Backbone.View} viewer
		 */
		limit = parseInt( wp.hooks.applyFilters( 'PC.fe.viewer.canvas.decode_limit', limit, this ), 10 );
		return limit > 0 ? limit : 1;
	},

	/**
	 * Wait for a decode slot, first come first served.
	 *
	 * A waiter whose `wanted` says no when its turn comes is skipped: fast
	 * angle switching only decodes for the angles still shown or coming.
	 *
	 * @param {Function} wanted Optional.
	 * @return {Promise<Function|null>} The function that frees the slot, or
	 *                                  null when the slot was given up.
	 */
	decode_slot: function( wanted, background ) {
		var that = this;
		return new Promise( function( resolve ) {
			var waiter = {
				wanted: function() {
					return that.is_removed || ! wanted || !! wanted();
				},
				background: function() {
					return !! ( background && background() );
				},
				give_up: function() {
					resolve( null );
				},
				grant: function() {
					that.decoding++;
					var freed = false;
					resolve( function() {
						if ( freed ) return;
						freed = true;
						that.decoding--;
						that.next_decode();
					} );
				},
			};
			if ( that.decoding < that.decode_limit() ) waiter.grant();
			else that.decode_queue.push( waiter );
		} );
	},

	/**
	 * Hand a freed slot on: waiters nobody wants any more give up, then the
	 * first one for the picture shown or coming goes, else the first
	 * background one (eager mode, other angles, snapshot refreshes).
	 */
	next_decode: function() {
		this.decode_queue = this.decode_queue.filter( function( waiter ) {
			if ( waiter.wanted() ) return true;
			waiter.give_up();
			return false;
		} );
		if ( ! this.decode_queue.length || this.decoding >= this.decode_limit() ) return;
		var index = this.decode_queue.findIndex( function( waiter ) {
			return ! waiter.background();
		} );
		this.decode_queue.splice( index < 0 ? 0 : index, 1 )[ 0 ].grant();
	},

	/**
	 * Let the browser drop a full-size image once a smaller copy exists. A
	 * texture drawn from the image itself (full size) keeps it.
	 */
	release_image: function( image, built ) {
		if ( ! image ) return;
		var source = built && built.texture && built.texture.source;
		if ( source && source.resource === image ) return;
		image.onload = null;
		image.onerror = null;
		image.removeAttribute( 'src' );
	},

	/**
	 * Download an image and build its texture, decoding in a slot.
	 *
	 * @param {String}   url
	 * @param {Function} scale_for Given the natural { width, height }, the scale
	 *                             to build at; asked once the slot is granted, so
	 *                             a resize while waiting is taken into account.
	 * @param {Function} wanted     Asked when the slot comes; false gives it up.
	 * @param {Function} background True while only background work wants it.
	 * @return {Promise<Object|null>} { built, natural, scale }, null, or
	 *                                PC.fe.views.viewer_canvas.abandoned.
	 */
	fetch_texture: function( url, scale_for, wanted, background ) {
		if ( 'blob' === this.image_decoder() ) return this.fetch_bitmap( url, scale_for, wanted, background );
		return this.fetch_element( url, scale_for, wanted, background );
	},

	/**
	 * How images are decoded: through an <img> element ('element', the
	 * default for now), or fetched and decoded straight into a downscaled
	 * bitmap ('blob'). Read for each load, so a switch applies to the next
	 * one (reload_textures() reloads everything).
	 *
	 * @return {String} element | blob
	 */
	image_decoder: function() {
		/**
		 * Filter how the canvas viewer decodes its images.
		 *
		 * 'element' loads each image in an <img>, decodes it at full size and
		 * downscales a copy; Safari keeps those full-size decodes in its image
		 * cache for a while. 'blob' fetches the file and decodes it with
		 * createImageBitmap( blob ), resized as it decodes, so no <img> holds
		 * it. Falls back to 'element' where fetch or createImageBitmap is
		 * missing, and for an image createImageBitmap cannot decode.
		 *
		 * @param {String} decoder element | blob
		 * @param {Backbone.View} viewer
		 */
		var decoder = wp.hooks.applyFilters( 'PC.fe.viewer.canvas.image_decoder', 'element', this );
		if ( 'blob' !== decoder ) return 'element';
		if ( 'function' !== typeof window.fetch || 'function' !== typeof window.createImageBitmap || ! window.URL || 'function' !== typeof URL.createObjectURL ) return 'element';
		return 'blob';
	},

	/**
	 * fetch_texture() through an <img>: downloaded, then decoded at full size
	 * in a decode slot and downscaled (build_texture()).
	 */
	fetch_element: function( url, scale_for, wanted, background ) {
		var that = this;
		return this.load_image( url, true ).then( function( image ) {
			if ( ! image ) return null;
			return that.decode_slot( wanted, background ).then( function( free ) {
				if ( ! free ) {
					that.release_image( image );
					return PC.fe.views.viewer_canvas.abandoned;
				}
				var finish = function( result ) {
					free();
					that.release_image( image, result && result.built );
					return result;
				};
				if ( that.is_removed ) return finish( null );
				var natural = { width: image.naturalWidth, height: image.naturalHeight };
				var scale = scale_for( natural );
				return that.decode_image( image ).then( function() {
					return that.is_removed ? null : that.build_texture( image, natural, scale, PC.fe.views.viewer_canvas.is_mask_key( url ) );
				} ).then( function( built ) {
					return finish( built ? { built: built, natural: natural, scale: scale } : null );
				}, function( error ) {
					console.log( 'Product configurator: could not prepare the image ' + url, error );
					return finish( null );
				} );
			} );
		} );
	},

	/**
	 * fetch_texture() without an <img>: the file is fetched, its size read
	 * from a header-only load, then decoded in a decode slot straight to the
	 * texture's size (build_bitmap()). An image createImageBitmap() cannot
	 * decode (an SVG in some browsers) goes through fetch_element() instead.
	 */
	fetch_bitmap: function( url, scale_for, wanted, background ) {
		var that = this;
		return this.load_blob( url ).then( function( loaded ) {
			if ( ! loaded ) return null;
			return that.decode_slot( wanted, background ).then( function( free ) {
				if ( ! free ) return PC.fe.views.viewer_canvas.abandoned;
				if ( that.is_removed ) {
					free();
					return null;
				}
				var natural = loaded.natural;
				var scale = scale_for( natural );
				return that.build_bitmap( loaded.blob, natural, scale, PC.fe.views.viewer_canvas.is_mask_key( url ) ).then( function( built ) {
					free();
					if ( built && that.is_removed ) {
						that.destroy_built( built );
						return null;
					}
					return built ? { built: built, natural: natural, scale: scale } : null;
				}, function( error ) {
					free();
					if ( that.is_removed ) return null;
					console.log( 'Product configurator: could not decode the image ' + url + ' from its file, loading it as an image', error );
					return that.fetch_element( url, scale_for, wanted, background );
				} );
			} );
		} );
	},

	/**
	 * Download an image file and read its size.
	 *
	 * The request matches the one an <img> would make (no credentials for
	 * other domains), so it shares the HTTP cache. A cross-origin failure is
	 * taken for missing CORS headers, as in load_image().
	 *
	 * @param {String} url
	 * @return {Promise<Object|null>} { blob, natural }
	 */
	load_blob: function( url ) {
		var that = this;
		var cross_origin = this.is_cross_origin( url );
		return window.fetch( url, {
			mode: cross_origin ? 'cors' : 'same-origin',
			credentials: cross_origin ? 'omit' : 'same-origin',
		} ).then( function( response ) {
			if ( ! response.ok ) throw new Error( 'HTTP ' + response.status );
			return response.blob();
		} ).then( function( blob ) {
			if ( that.is_removed ) return null;
			return that.blob_size( blob ).then( function( natural ) {
				if ( ! natural ) throw new Error( 'not an image' );
				return { blob: blob, natural: natural };
			} );
		} ).catch( function( error ) {
			if ( that.is_removed ) return null;
			if ( cross_origin ) {
				that.fall_back( 'cors', url );
			} else {
				console.log( 'Product configurator: could not load the image ' + url, error );
			}
			return null;
		} );
	},

	/**
	 * An image file's natural size, from an <img> that only loads it: the
	 * size comes from the file's header, and an image never drawn nor
	 * decode()d is not decoded. The element and its object URL go at once.
	 *
	 * @param {Blob} blob
	 * @return {Promise<Object|null>} { width, height }
	 */
	blob_size: function( blob ) {
		return new Promise( function( resolve ) {
			var link = URL.createObjectURL( blob );
			var image = new Image();
			var done = function( size ) {
				image.onload = null;
				image.onerror = null;
				image.removeAttribute( 'src' );
				URL.revokeObjectURL( link );
				resolve( size );
			};
			image.onload = function() {
				done( image.naturalWidth ? { width: image.naturalWidth, height: image.naturalHeight } : null );
			};
			image.onerror = function() {
				done( null );
			};
			image.src = link;
		} );
	},

	/**
	 * A texture decoded from an image file at a scale, resized as it decodes.
	 * A browser that ignores the resize options hands back the full image,
	 * which is then drawn smaller on a 2D canvas and closed.
	 *
	 * @param {Blob}   blob
	 * @param {Object} natural { width, height }
	 * @param {Number} scale
	 * @return {Promise<Object|null>} { texture, bitmap }; rejects when the
	 *                                browser cannot decode the file.
	 */
	build_bitmap: function( blob, natural, scale, whiten ) {
		var that = this;
		var width = Math.max( 1, Math.round( natural.width * scale ) );
		var height = Math.max( 1, Math.round( natural.height * scale ) );
		var options = { premultiplyAlpha: 'premultiply' };
		if ( width < natural.width || height < natural.height ) {
			options.resizeWidth = width;
			options.resizeHeight = height;
			options.resizeQuality = 'high';
		}
		return window.createImageBitmap( blob, options ).then( function( bitmap ) {
			if ( bitmap.width === width && bitmap.height === height ) return that.make_built( bitmap, bitmap, whiten );
			var canvas = that.downscale( bitmap, width, height );
			bitmap.close();
			return canvas ? that.make_built( canvas, null, whiten ) : null;
		} );
	},

	/**
	 * A texture of a resource. A mask's (whiten) is redrawn opaque grey, grey
	 * = its alpha: Pixi's sprite mask reads the mask's red channel times its
	 * alpha (see whiten(); docs/layer-masks-spec.md).
	 */
	make_built: function( resource, bitmap, whiten ) {
		if ( whiten ) {
			var white = PC.fe.views.viewer_canvas.whiten( resource );
			if ( bitmap && bitmap.close ) bitmap.close();
			if ( ! white ) return null;
			resource = white;
			bitmap = null;
		}
		return {
			texture: new PIXI.Texture( { source: new PIXI.ImageSource( { resource: resource } ) } ),
			bitmap: bitmap || null,
		};
	},

	/**
	 * The texture for a URL, sharp enough for the stack it is drawn in.
	 *
	 * One texture per URL, downscaled to what the box shows (see
	 * texture_scale()). When a bigger box needs more pixels, the same record is
	 * upgraded and every sprite using it switches over.
	 *
	 * A load that is still waiting for its decode slot when nobody wants it
	 * any more (every caller's `wanted` says no) gives the slot up and
	 * resolves with PC.fe.views.viewer_canvas.abandoned.
	 *
	 * @param {String}   url
	 * @param {Object}   stack
	 * @param {Function} wanted     Whether this caller still needs the texture;
	 *                              omitted, it always does.
	 * @param {Function} background True while this caller is background work;
	 *                              omitted, it is not.
	 * @return {Promise<Object|null>} The texture record, null, or `abandoned`.
	 */
	load_texture: function( url, stack, wanted, background ) {
		var record = this.textures[ url ];
		var that = this;
		var abandoned = PC.fe.views.viewer_canvas.abandoned;
		wanted = wanted || function() {
			return true;
		};
		background = background || function() {
			return false;
		};
		var claim = { wanted: wanted, background: background };
		if ( record ) {
			if ( record.claims ) record.claims.push( claim );
			return record.promise.then( function( loaded ) {
				if ( that.is_removed ) return null;
				if ( abandoned === loaded ) {
					// Given up for the other callers: this one loads it, if still needed.
					return wanted() ? that.load_texture( url, stack, wanted, background ) : abandoned;
				}
				if ( ! loaded ) return null;
				// Released while this caller waited: load it again.
				if ( record.destroyed ) return that.load_texture( url, stack, wanted, background );
				var needed = that.texture_scale( stack, record.natural );
				if ( needed <= record.scale ) return record;
				return that.upgrade_texture( record, needed );
			} );
		}

		record = {
			url: url,
			texture: null,
			natural: null,
			scale: 0,
			bytes: 0,
			last_used: 0,
			entries: [],
			destroyed: false,
			promise: null,
			upgrading: null,
			// Every caller's `wanted`, until the decode slot is granted.
			claims: [ claim ],
		};
		this.textures[ url ] = record;
		record.promise = this.fetch_texture( url, function( natural ) {
			return that.texture_scale( stack, natural );
		}, function() {
			return !! _.find( record.claims, function( item ) {
				return item.wanted();
			} );
		}, function() {
			// Background only while no caller that still wants it is in the foreground.
			return ! _.find( record.claims, function( item ) {
				return item.wanted() && ! item.background();
			} );
		} ).then( function( result ) {
			record.claims = null;
			if ( abandoned === result ) {
				if ( that.textures[ url ] === record ) delete that.textures[ url ];
				return abandoned;
			}
			if ( ! result || that.is_removed || record.destroyed ) {
				if ( result ) that.destroy_built( result.built );
				if ( that.textures[ url ] === record ) delete that.textures[ url ];
				return null;
			}
			record.natural = result.natural;
			that.set_texture( record, result.built, result.scale );
			that.touch( record );
			return record;
		} );
		return record.promise;
	},

	/**
	 * Replace a record's texture with a sharper one, keeping its sprites.
	 */
	upgrade_texture: function( record, scale ) {
		var that = this;
		if ( record.upgrading && record.upgrading.scale >= scale ) return record.upgrading.promise;
		var promise = this.fetch_texture( record.url, function() {
			return scale;
		} ).then( function( result ) {
			var built = result && result.built;
			if ( ! built || that.is_removed || record.destroyed ) {
				that.destroy_built( built );
				return record.destroyed ? null : record;
			}
			if ( scale <= record.scale ) {
				that.destroy_built( built );
				return record;
			}
			var old = { texture: record.texture, bitmap: record.bitmap };
			that.set_texture( record, built, scale );
			_.each( record.entries, function( entry ) {
				if ( ! entry.sprite ) return;
				entry.sprite.texture = record.texture;
				that.fit_sprite( entry.sprite, record );
			} );
			// A layer mask: its mask sprites move to the new texture.
			_.each( record.mask_users || [], function( user ) {
				that.apply_mask( user.stack, user.record );
			} );
			that.destroy_built( old );
			that.request_render();
			that.enforce_budget();
			return record;
		} );
		record.upgrading = { scale: scale, promise: promise };
		promise.then( function() {
			if ( record.upgrading && record.upgrading.promise === promise ) record.upgrading = null;
		} );
		return promise;
	},

	set_texture: function( record, built, scale ) {
		record.texture = built.texture;
		record.bitmap = built.bitmap;
		record.scale = scale;
		record.bytes = built.texture.width * built.texture.height * 4;
		record.freed = this.free_source( built );
	},

	/**
	 * Upload a texture now and free the image it was built from.
	 *
	 * Until then every texture is held twice: on the GPU, and as the bitmap,
	 * canvas or image Pixi uploads from, which is just as big. That copy only
	 * serves a second upload, and the viewer never needs one: Pixi's collector
	 * is off (start()), an upgrade builds a new texture, and a restored
	 * context loads every image again (reload_textures()).
	 *
	 * @param {Object} built { texture, bitmap }
	 * @return {Boolean} Whether the image was freed.
	 */
	free_source: function( built ) {
		var source = built && built.texture && built.texture.source;
		var resource = source && source.resource;
		var renderer = this.app && this.app.renderer;
		if ( ! resource || ! renderer || ! renderer.texture || 'function' !== typeof renderer.texture.initSource ) return false;
		var gl = renderer.gl;
		// Nothing to upload to: keep it, the restored context reloads anyway.
		if ( gl && gl.isContextLost && gl.isContextLost() ) return false;
		try {
			renderer.texture.initSource( source );
		} catch ( error ) {
			return false;
		}
		if ( 'function' === typeof resource.close ) {
			resource.close();
		} else if ( 'CANVAS' === resource.nodeName ) {
			resource.width = 0;
			resource.height = 0;
		} else if ( 'IMG' === resource.nodeName ) {
			resource.onload = null;
			resource.onerror = null;
			resource.removeAttribute( 'src' );
		}
		return true;
	},

	/**
	 * After a restored context: the GPU kept nothing and the images were
	 * freed, so every texture goes and the angles on screen load again. The
	 * others load when shown, or in the background (start_background()).
	 */
	reload_textures: function() {
		this.stop_background();
		this.stop_refresh();
		_.each( this.stacks, function( stack ) {
			_.each( stack.layers, function( record ) {
				this.drop_held( record );
				_.each( record.shown, this.drop_entry, this );
				record.shown = {};
				this.drop_masks( record );
			}, this );
		}, this );
		_.each( _.values( this.textures ), this.destroy_record, this );
		this.textures = {};
		this.live_blocked = false;
		if ( this.current_stack ) this.sync_stack( this.current_stack );
		if ( this.target_stack && this.target_stack !== this.current_stack ) this.sync_stack( this.target_stack );
		this.after_change();
	},

	/**
	 * A Pixi texture of the image at a scale (1 = its natural size).
	 *
	 * Built outside PIXI.Texture.from(), which caches by resource for the whole
	 * page. A downscaled copy comes from createImageBitmap() where the browser
	 * resizes off the main thread, else from a 2D canvas. Bitmaps are created
	 * premultiplied: WebGL ignores the premultiply-on-upload flag Pixi sets for
	 * them, and Pixi draws premultiplied colour.
	 *
	 * @return {Promise<Object|null>} { texture, bitmap }
	 */
	build_texture: function( image, natural, scale, whiten ) {
		var width = Math.max( 1, Math.round( natural.width * scale ) );
		var height = Math.max( 1, Math.round( natural.height * scale ) );
		var that = this;
		var make = function( resource, bitmap ) {
			return that.make_built( resource, bitmap, whiten );
		};
		if ( width >= natural.width && height >= natural.height ) {
			return Promise.resolve( make( image ) );
		}
		var canvas_copy = function() {
			var canvas = that.downscale( image, width, height );
			return canvas ? make( canvas ) : make( image );
		};
		if ( 'function' !== typeof window.createImageBitmap ) return Promise.resolve( canvas_copy() );
		return window.createImageBitmap( image, {
			resizeWidth: width,
			resizeHeight: height,
			resizeQuality: 'high',
			premultiplyAlpha: 'premultiply',
		} ).then( function( bitmap ) {
			// A browser that ignores the resize options hands back the full image.
			if ( bitmap.width !== width || bitmap.height !== height ) {
				bitmap.close();
				return canvas_copy();
			}
			return make( bitmap, bitmap );
		} ).catch( function() {
			return canvas_copy();
		} );
	},

	/**
	 * The image redrawn at a size on a 2D canvas, the way the <img> stack's
	 * capture draws it.
	 *
	 * @return {HTMLCanvasElement|null}
	 */
	downscale: function( image, width, height ) {
		var canvas = document.createElement( 'canvas' );
		canvas.width = width;
		canvas.height = height;
		var context = canvas.getContext( '2d' );
		if ( ! context ) return null;
		context.drawImage( image, 0, 0, width, height );
		return canvas;
	},

	destroy_built: function( built ) {
		if ( ! built ) return;
		if ( built.texture ) built.texture.destroy( true );
		if ( built.bitmap && built.bitmap.close ) built.bitmap.close();
	},

	/**
	 * How much of an image's resolution to keep: what one image pixel covers on
	 * screen, in device pixels, rounded up to a step of √2 and never above 1.
	 *
	 * The steps keep a resize from reloading anything until the box has grown
	 * by a whole step; a texture holds at most twice the pixels the box shows.
	 *
	 * @param {Object} stack
	 * @param {Object} natural { width, height } of the image
	 * @return {Number}
	 */
	texture_scale: function( stack, natural ) {
		var resolution = this.app ? this.app.renderer.resolution : 1;
		var shown;
		if ( stack && stack.size && stack.container ) {
			shown = stack.container.scale.x;
		} else {
			// Nothing laid out yet: assume it fits the viewer without upscaling.
			var container = this.$layers && this.$layers.get( 0 );
			var width = container ? container.clientWidth : 0;
			var height = container ? container.clientHeight : 0;
			shown = width && height ? Math.min( 1, width / natural.width, height / natural.height ) : 1;
		}
		return PC.fe.views.viewer_canvas.scale_step( shown * resolution );
	},

	/**
	 * Upgrade the textures a stack draws when its box has outgrown them.
	 */
	check_resolution: function( stack ) {
		_.each( stack.layers, function( record ) {
			_.each( record.shown, function( entry ) {
				var texture_record = entry.record;
				if ( ! texture_record || texture_record.destroyed ) return;
				var wanted = this.texture_scale( stack, texture_record.natural );
				if ( wanted > texture_record.scale ) this.upgrade_texture( texture_record, wanted );
			}, this );
		}, this );
	},

	touch: function( record ) {
		record.last_used = ++this.texture_clock;
	},

	/**
	 * The texture memory budget, in bytes (decision F in the spec).
	 *
	 * @return {Number}
	 */
	texture_budget: function() {
		var statics = PC.fe.views.viewer_canvas;
		var budget = ( statics.small_screen() ? 96 : 256 ) * 1024 * 1024;
		// A device that says it has little memory gets less, never more.
		var cap = statics.memory_cap();
		if ( cap ) budget = Math.min( budget, cap * 1024 * 1024 );
		/**
		 * Filter how much GPU memory the canvas viewer's textures may use.
		 *
		 * The picture on screen is always kept, even over budget; textures kept
		 * for other angles and preloads are released least recently used first.
		 *
		 * @param {Number} budget In bytes (width × height × 4 per texture).
		 * @param {Backbone.View} viewer
		 */
		return wp.hooks.applyFilters( 'PC.fe.viewer.canvas.texture_budget', budget, this );
	},

	/**
	 * Whether a texture is drawn by the picture on screen, or by the one
	 * being prepared to replace it (held images included).
	 */
	is_pinned: function( record ) {
		var target = this.target_stack;
		var live = this.live_stacks();
		var wanted = function( entry ) {
			return entry.stack === target || _.contains( live, entry.stack );
		};
		return !! (
			_.find( record.entries, wanted )
			|| _.find( this.waiting[ record.url ], wanted )
			// A layer mask in use (sync_mask()).
			|| _.find( record.mask_users, wanted )
		);
	},

	texture_bytes: function() {
		var bytes = 0;
		_.each( this.textures, function( record ) {
			bytes += record.bytes;
		} );
		return bytes;
	},

	/**
	 * Release textures, least recently used first, until under budget.
	 * Pinned textures are never released.
	 */
	enforce_budget: function() {
		if ( this.is_removed ) return;
		var budget = this.texture_budget();
		var total = this.texture_bytes();
		if ( total <= budget ) return;
		var candidates = _.filter( this.textures, function( record ) {
			return record.texture && ! record.destroyed && ! this.is_pinned( record );
		}, this );
		var evict = PC.fe.views.viewer_canvas.pick_evictions( candidates, total, budget );
		_.each( evict, this.evict_texture, this );
		if ( evict.length ) this.request_render();
	},

	/**
	 * Destroy a texture and the sprites drawing it. Those sprites belong to
	 * angles not on screen; showing that angle again loads the image again.
	 */
	evict_texture: function( record ) {
		// Keeping the other angles live does not fit after all: stop until the
		// budget changes (a resize).
		var off_screen = function( item ) {
			return item.stack !== this.current_stack && item.stack !== this.target_stack;
		};
		if ( 'live' === this.mode && ( _.find( record.entries, off_screen, this ) || _.find( record.mask_users, off_screen, this ) ) ) {
			this.live_blocked = true;
			this.mode = 'refresh';
		}
		// A layer mask: the layers it cut lose their images too, so both load
		// again together when their angle is shown, never the images uncut.
		_.each( ( record.mask_users || [] ).slice(), function( user ) {
			var layer_record = user.record;
			if ( ! this.holds_mask( layer_record, user.mask ) || user.mask.texture_record !== record ) return;
			this.drop_held( layer_record );
			_.each( _.values( layer_record.shown ), this.drop_entry, this );
			layer_record.shown = {};
			this.drop_masks( layer_record );
		}, this );
		record.mask_users = [];
		_.each( record.entries.slice(), function( entry ) {
			var layer_record = entry.stack && entry.stack.layers[ entry.model.get( 'layerId' ) ];
			if ( layer_record ) {
				if ( layer_record.shown[ entry.key ] === entry ) delete layer_record.shown[ entry.key ];
				layer_record.held = _.without( layer_record.held, entry );
			}
			this.drop_entry( entry );
		}, this );
		this.destroy_record( record );
	},

	destroy_record: function( record ) {
		record.destroyed = true;
		record.entries = [];
		this.destroy_built( { texture: record.texture, bitmap: record.bitmap } );
		record.texture = null;
		record.bitmap = null;
		record.bytes = 0;
		if ( this.textures[ record.url ] === record ) delete this.textures[ record.url ];
	},

	/**
	 * Hovering or focusing a choice loads its image for the angle being shown.
	 * It may release unpinned textures to fit; it never touches the picture.
	 */
	preload: function( choice ) {
		var stack = this.target_stack;
		if ( ! stack || this.is_removed || choice.get( 'active' ) ) return;
		this.note_activity();
		var url = this.image_url( choice, stack.angle_id );
		if ( ! url ) return;
		var that = this;
		this.load_texture( url, stack, function() {
			return stack === that.target_stack;
		} ).then( function( record ) {
			if ( record && PC.fe.views.viewer_canvas.abandoned !== record ) that.touch( record );
			that.enforce_budget();
		} );
	},

	/**
	 * Eager mode: once the picture is complete, load every image of the angle
	 * in the background, two at a time, while they fit in the free budget.
	 * Never releases anything to make room, and never holds the loading state.
	 */
	start_background: function() {
		this.stop_background();
		var stack = this.current_stack;
		if ( ! stack || stack !== this.target_stack || this.is_removed || this.cover ) return;
		// Other visited angles first, when they are kept live; they queue
		// before eager loads and below anything the customer asks for.
		this.update_mode();
		if ( 'live' === this.mode ) this.sync_others();
		if ( 'lazy' === ( PC.fe.config && PC.fe.config.image_loading_mode || 'lazy' ) ) return;

		var queue = [];
		var seen = {};
		_.each( PC.fe.viewer_state.layers_in_image_order( stack.angle_id ), function( layer ) {
			var choices = PC.fe.getLayerContent( layer.id );
			if ( ! choices ) return;
			choices.each( function( choice ) {
				if ( ! PC.fe.viewer_state.has_drawable( choice ) ) return;
				var url = this.image_url( choice, stack.angle_id );
				if ( ! url || seen[ url ] || this.textures[ url ] ) return;
				seen[ url ] = true;
				queue.push( { url: url, dimensions: choice.get_image( 'image', 'dimensions', stack.angle_id ) } );
			}, this );
		}, this );
		if ( ! queue.length ) return;

		var that = this;
		var job = { stopped: false };
		this.background = job;
		var next = function() {
			if ( job.stopped || that.is_removed ) return;
			var item = queue.shift();
			if ( ! item ) return;
			if ( that.textures[ item.url ] ) return next();
			var estimate = that.estimate_bytes( stack, item.dimensions );
			if ( that.texture_bytes() + estimate > that.texture_budget() ) {
				job.stopped = true;
				return;
			}
			that.load_texture( item.url, stack, function() {
				return ! job.stopped;
			}, function() {
				return true;
			} ).then( next );
		};
		next();
		next();
	},

	stop_background: function() {
		if ( this.background ) this.background.stopped = true;
		this.background = null;
	},

	/**
	 * What a texture will cost before it is loaded, from the stored dimensions.
	 */
	estimate_bytes: function( stack, dimensions ) {
		var width = dimensions && parseInt( dimensions.width );
		var height = dimensions && parseInt( dimensions.height );
		if ( ! width || ! height ) {
			if ( ! stack.size ) return 0;
			width = stack.size.width;
			height = stack.size.height;
		}
		var scale = this.texture_scale( stack, { width: width, height: height } );
		return Math.round( width * scale ) * Math.round( height * scale ) * 4;
	},

	/**
	 * Texture memory, for measuring (the spec's performance run).
	 *
	 * @return {Object} { count, bytes, pinned_bytes, budget }
	 */
	texture_stats: function() {
		var stats = { count: 0, bytes: 0, pinned_bytes: 0, budget: this.texture_budget(), kept_bytes: 0 };
		_.each( this.textures, function( record ) {
			if ( ! record.texture ) return;
			stats.count++;
			stats.bytes += record.bytes;
			// Images not freed after upload (free_source()): held a second time.
			if ( ! record.freed ) stats.kept_bytes += record.bytes;
			if ( this.is_pinned( record ) ) stats.pinned_bytes += record.bytes;
		}, this );
		// Outside the budget: one per angle at most.
		stats.mode = this.mode;
		stats.decoder = this.image_decoder();
		stats.picture_bytes = this.picture_bytes;
		stats.snapshots = _.size( this.snapshots );
		stats.snapshot_bytes = 0;
		_.each( this.snapshots, function( snapshot ) {
			stats.snapshot_bytes += snapshot.bytes;
		} );
		return stats;
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
			if ( this.mask_pending( record ) ) return true;
			return _.find( record.shown, function( entry ) {
				return ! entry.settled;
			} );
		}, this );
	},

	count_loading: function( stack ) {
		var count = 0;
		_.each( stack.layers, function( record ) {
			if ( this.mask_pending( record ) ) count++;
			_.each( record.shown, function( entry ) {
				if ( ! entry.settled ) count++;
			} );
		}, this );
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
		} else if ( this.cover && this.target_stack === this.current_stack && this.is_stack_settled( this.current_stack ) ) {
			this.reveal();
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
		if ( ! this.is_loading && ( was_loading || this.background_dirty ) ) {
			this.background_dirty = false;
			this.start_background();
			this.schedule_idle();
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
		this.stop_background();
		this.note_activity();
		var stack = this.ensure_stack( angle_id );
		stack.last_shown = ++this.show_clock;
		this.target_stack = stack;
		this.sync_stack( stack );
		// Laid out while hidden; its kept textures may be too small for the box
		// now, and they are the most recently used again.
		this.check_resolution( stack );
		_.each( stack.layers, function( record ) {
			_.each( record.shown, function( entry ) {
				if ( entry.record ) this.touch( entry.record );
			}, this );
		}, this );

		if ( this.angle_wait_timer ) {
			clearTimeout( this.angle_wait_timer );
			this.angle_wait_timer = null;
		}

		if ( ! this.current_stack ) {
			this.current_stack = stack;
			stack.container.visible = true;
		} else if ( this.current_stack !== stack ) {
			this.leave_current( stack );
		}
		// Coming back to the angle a cover stands for: the cover stays until
		// that angle is complete again (after_change() reveals it).

		this.layout();
		this.after_change();
	},

	/**
	 * Leave the stack on screen for another angle.
	 *
	 * The outgoing view becomes a flat copy (a cover), so its layers no
	 * longer need to stay in memory while the incoming angle loads. An
	 * incoming angle with a valid flat copy shows at once; otherwise the
	 * cover stays until it is complete (after_change() swaps), or until
	 * PC.fe.viewer.swap_timeout.
	 *
	 * @param {Object} stack The incoming stack.
	 */
	leave_current: function( stack ) {
		this.finish_transition();
		var current = this.current_stack;
		if ( ! this.cover ) {
			var own = this.take_snapshot( current );
			if ( own ) this.cover = this.make_cover( current, own );
		}

		var incoming = this.valid_snapshot( stack );
		if ( incoming ) {
			var from = this.cover ? this.cover_display( this.cover ) : this.stack_display( current );
			this.cover = this.make_cover( stack, incoming );
			this.current_stack = stack;
			this.run_transition( from, this.cover_display( this.cover ), this.is_forward( current, stack ) );
			this.enforce_budget();
			return;
		}

		var that = this;
		this.angle_wait_timer = setTimeout( function() {
			that.swap_stacks();
			that.request_render();
		}, wp.hooks.applyFilters( 'PC.fe.viewer.swap_timeout', 5000, this ) );
		// Covered, the outgoing angle's textures are no longer pinned.
		this.enforce_budget();
	},

	/**
	 * The current stack is complete: draw it instead of its cover. Same
	 * angle, same pixels, so no transition.
	 */
	reveal: function() {
		if ( ! this.cover ) return;
		// Still moving in: reveal when the transition ends.
		if ( this.transition && this.transition.to.cover === this.cover ) {
			this.transition.then_reveal = true;
			return;
		}
		var cover = this.cover;
		this.cover = null;
		this.current_stack.container.visible = true;
		this.destroy_cover( cover );
		this.request_render();
	},

	/**
	 * Draw the current stack as it is, without its cover (the cover no longer
	 * lines up, or the context was lost).
	 */
	uncover: function() {
		if ( ! this.cover ) return;
		this.finish_transition();
		var cover = this.cover;
		this.cover = null;
		if ( this.current_stack ) this.current_stack.container.visible = true;
		this.destroy_cover( cover );
		this.request_render();
	},

	/**
	 * The stacks drawn live on screen: their textures are pinned.
	 *
	 * @return {Array}
	 */
	live_stacks: function() {
		var live = [];
		if ( this.current_stack && ! this.cover ) live.push( this.current_stack );
		if ( this.transition ) {
			if ( this.transition.from.stack ) live.push( this.transition.from.stack );
			if ( this.transition.to.stack ) live.push( this.transition.to.stack );
		}
		return live;
	},

	/*
	 * Snapshots: flat copies of an angle's picture, at the size it is drawn.
	 * --------------------------------------------------------------------- */

	/**
	 * Where a stack is drawn. A flat copy only lines up with the same one.
	 *
	 * @return {String}
	 */
	layout_key: function( stack ) {
		var renderer = this.app.renderer;
		var container = stack.container;
		return [
			renderer.width,
			renderer.height,
			renderer.resolution,
			Math.round( container.x * 100 ),
			Math.round( container.y * 100 ),
			Math.round( container.scale.x * 1e6 ),
			Math.round( container.scale.y * 1e6 ),
		].join( ',' );
	},

	/**
	 * What a stack would draw now, in order: the files sync_stack() picks.
	 *
	 * @return {String}
	 */
	picture_key: function( stack ) {
		return _.map( this.picture_items( stack ), function( part ) {
			var key = part.url || part.key;
			return part.mask ? key + ' mask:' + part.mask : key;
		} ).join( '\n' );
	},

	/**
	 * What a stack would draw now, in drawing order: layers in image order,
	 * then the choices of a layer by their index (the zIndex of their sprites).
	 *
	 * Each part is { url, mask? } for an image (mask: its layer's mask URL on
	 * that angle), or { item, choice, key, mask? } for an add-on item, whose
	 * key says what it draws (its key(), when it has one) and mask the mask it
	 * is cut with (item_mask_url()).
	 *
	 * @return {Array<Object>}
	 */
	picture_items: function( stack ) {
		return this.parts_of( this.ordered_choices( stack.angle_id ), stack.angle_id );
	},

	/**
	 * The choices drawn now, in drawing order.
	 *
	 * @param {String|Number} angle_id The view: its own order when it has one.
	 * @return {Array<Backbone.Model>}
	 */
	ordered_choices: function( angle_id ) {
		var state = PC.fe.viewer_state;
		var list = [];
		_.each( state.layers_in_image_order( angle_id ), function( layer ) {
			var choices = PC.fe.getLayerContent( layer.id );
			var shown = state.shown_choices( layer );
			if ( choices && shown.length > 1 ) {
				shown = _.sortBy( shown, function( choice ) {
					return choices.indexOf( choice );
				} );
			}
			list = list.concat( shown );
		} );
		return list;
	},

	/**
	 * What to draw for each choice at an angle (see picture_items()).
	 *
	 * @param {Array<Backbone.Model>} choices
	 * @param {String|Number} angle_id
	 * @return {Array<Object>}
	 */
	parts_of: function( choices, angle_id ) {
		var state = PC.fe.viewer_state;
		var parts = [];
		_.each( choices, function( choice ) {
			var item = this.canvas_item( choice );
			if ( item ) {
				var key = 'item:' + this.view_key( choice );
				if ( item.key ) {
					try {
						key += ':' + item.key( angle_id );
					} catch ( error ) {
						// A failing key() counts as no change.
					}
				}
				var item_part = { item: item, choice: choice, key: key };
				var item_mask = PC.fe.views.viewer_canvas.item_mask_url( item, PC.fe.layers.get( choice.get( 'layerId' ) ), angle_id );
				if ( item_mask ) item_part.mask = item_mask;
				parts.push( item_part );
				return;
			}
			if ( ! state.has_drawable( choice ) ) return;
			var url = this.image_url( choice, angle_id );
			if ( ! url ) return;
			var part = { url: url };
			// The layer's mask on that angle, if any (docs/layer-masks-spec.md).
			var mask = PC.fe.layer_masks ? PC.fe.layer_masks.get( PC.fe.layers.get( choice.get( 'layerId' ) ), angle_id ) : null;
			if ( mask ) part.mask = mask.url;
			parts.push( part );
		}, this );
		return parts;
	},

	/**
	 * Every entry loaded and no previous image held.
	 */
	is_stack_complete: function( stack ) {
		return this.is_stack_settled( stack ) && ! _.find( stack.layers, function( record ) {
			return record.held.length;
		} );
	},

	/**
	 * A flat copy of a stack on screen, if its picture is complete. Reuses the
	 * stored one when nothing changed.
	 *
	 * @return {Object|null} { angle_id, layout, picture, texture, bytes }
	 */
	take_snapshot: function( stack ) {
		if ( ! stack || ! this.app || ! stack.size || ! stack.container.visible || ! this.is_stack_complete( stack ) ) return null;
		// What an item's key() says must be what the copy shows.
		this.apply_item_updates();
		var layout = this.layout_key( stack );
		var picture = this.picture_key( stack );
		var existing = this.snapshots[ stack.angle_id ];
		if ( existing && existing.layout === layout && existing.picture === picture ) return existing;

		var renderer = this.app.renderer;
		var texture = PIXI.RenderTexture.create( {
			width: renderer.width / renderer.resolution,
			height: renderer.height / renderer.resolution,
			resolution: renderer.resolution,
		} );
		renderer.render( { container: stack.frame, target: texture, clear: true, clearColor: [ 0, 0, 0, 0 ] } );
		this.drop_snapshot( stack.angle_id );
		var snapshot = {
			angle_id: stack.angle_id,
			layout: layout,
			picture: picture,
			texture: texture,
			bytes: texture.source.pixelWidth * texture.source.pixelHeight * 4,
			dropped: false,
			destroyed: false,
		};
		this.snapshots[ stack.angle_id ] = snapshot;
		stack.had_snapshot = true;
		return snapshot;
	},

	/**
	 * The stored flat copy of a stack, if it still shows what the stack would
	 * draw, where it would draw it. A stale one is dropped, never shown.
	 *
	 * @return {Object|null}
	 */
	valid_snapshot: function( stack ) {
		var snapshot = this.snapshots[ stack.angle_id ];
		if ( ! snapshot ) return null;
		if ( stack.size && snapshot.layout === this.layout_key( stack ) && snapshot.picture === this.picture_key( stack ) ) {
			return snapshot;
		}
		this.drop_snapshot( stack.angle_id );
		return null;
	},

	drop_snapshot: function( angle_id ) {
		var snapshot = this.snapshots[ angle_id ];
		if ( ! snapshot ) return;
		delete this.snapshots[ angle_id ];
		snapshot.dropped = true;
		// A cover still drawing it destroys it when it goes.
		if ( ! this.snapshot_in_use( snapshot ) ) this.destroy_snapshot( snapshot );
	},

	destroy_snapshot: function( snapshot ) {
		if ( snapshot.destroyed ) return;
		snapshot.destroyed = true;
		snapshot.texture.destroy( true );
	},

	/**
	 * After a resize: drop the flat copies that no longer line up.
	 */
	prune_snapshots: function() {
		if ( ! this.app ) return;
		_.each( _.keys( this.snapshots ), function( angle_id ) {
			var stack = this.stacks[ angle_id ];
			if ( ! stack || this.snapshots[ angle_id ].layout !== this.layout_key( stack ) ) this.drop_snapshot( angle_id );
		}, this );
	},

	snapshot_in_use: function( snapshot ) {
		var drawn_by = function( cover ) {
			return cover && cover.frame && cover.snapshot === snapshot;
		};
		var transition = this.transition;
		return !! ( drawn_by( this.cover ) || ( transition && ( drawn_by( transition.from.cover ) || drawn_by( transition.to.cover ) ) ) );
	},

	/**
	 * Draw a flat copy in place of a stack.
	 *
	 * @return {Object} The cover: { angle_id, snapshot, frame }
	 */
	make_cover: function( stack, snapshot ) {
		var frame = new PIXI.Container();
		frame.addChild( new PIXI.Sprite( snapshot.texture ) );
		this.app.stage.addChild( frame );
		stack.container.visible = false;
		this.request_render();
		return { angle_id: stack.angle_id, snapshot: snapshot, frame: frame };
	},

	destroy_cover: function( cover ) {
		if ( ! cover || ! cover.frame ) return;
		// The sprite goes, the texture is the snapshot's.
		cover.frame.destroy( { children: true } );
		cover.frame = null;
		if ( cover.snapshot.dropped && ! this.snapshot_in_use( cover.snapshot ) ) this.destroy_snapshot( cover.snapshot );
	},

	/*
	 * Other angles (phase 4b): kept live where the budget allows, their
	 * snapshots refreshed when idle where it does not.
	 * --------------------------------------------------------------------- */

	/**
	 * What one picture costs: the bytes of the textures the current stack draws.
	 */
	picture_cost: function( stack ) {
		var seen = {};
		var bytes = 0;
		_.each( stack.layers, function( record ) {
			_.each( record.shown, function( entry ) {
				var texture_record = entry.record;
				if ( ! texture_record || ! texture_record.texture || seen[ texture_record.url ] ) return;
				seen[ texture_record.url ] = true;
				bytes += texture_record.bytes;
			} );
			// Its masks: the layer's and its items'.
			_.each( [ record.mask ].concat( _.values( record.item_masks ) ), function( mask ) {
				var mask_record = mask && mask.texture_record;
				if ( ! mask_record || ! mask_record.texture || seen[ mask_record.url ] ) return;
				seen[ mask_record.url ] = true;
				bytes += mask_record.bytes;
			} );
		} );
		return bytes;
	},

	/**
	 * Choose how the visited angles not shown are kept:
	 *
	 * - live: they follow choice changes in the background, while one picture
	 *   times the visited angles fits in 75% of the budget (and until it no
	 *   longer fits in all of it, or an eviction says otherwise);
	 * - refresh: their stale snapshots are rebuilt when idle, while one
	 *   picture fits in the budget;
	 * - reload: neither; coming back after a change reloads the angle.
	 *
	 * The picture's cost is measured whenever the shown one is complete.
	 */
	update_mode: function() {
		var stack = this.current_stack;
		if ( stack && stack === this.target_stack && ! this.cover && this.is_stack_complete( stack ) ) {
			var cost = this.picture_cost( stack );
			if ( cost ) this.picture_bytes = cost;
		}
		var picture = this.picture_bytes;
		if ( ! picture ) return this.mode;
		var budget = this.texture_budget();
		var all = picture * _.size( this.stacks );
		var live;
		if ( this.live_blocked ) live = false;
		else if ( 'live' === this.mode ) live = all <= budget;
		else live = all <= 0.75 * budget;
		var mode = live ? 'live' : ( picture <= budget ? 'refresh' : 'reload' );
		/**
		 * Filter how the canvas viewer keeps the angles not shown.
		 *
		 * @param {String} mode    live, refresh or reload.
		 * @param {Backbone.View} viewer
		 * @param {Object} measure { picture, angles, budget } (bytes, count, bytes)
		 */
		mode = wp.hooks.applyFilters( 'PC.fe.viewer.canvas.views_mode', mode, this, { picture: picture, angles: _.size( this.stacks ), budget: budget } );
		if ( 'live' !== mode && 'reload' !== mode ) mode = 'refresh';
		this.mode = mode;
		return mode;
	},

	/**
	 * Bring the visited angles not shown up to date. Their loads are
	 * background work, wanted only while the mode stays live.
	 */
	sync_others: function() {
		_.each( this.stacks, function( stack ) {
			if ( stack === this.current_stack || stack === this.target_stack ) return;
			this.sync_stack( stack );
		}, this );
	},

	/**
	 * The customer did something: a refresh in progress stops, and the idle
	 * delay starts again.
	 */
	note_activity: function() {
		this.stop_refresh();
		this.schedule_idle();
	},

	schedule_idle: function() {
		if ( this.is_removed ) return;
		if ( this.idle_timer ) clearTimeout( this.idle_timer );
		var that = this;
		/**
		 * Filter how long the configurator must be idle before the canvas
		 * viewer refreshes the snapshots of other angles, in milliseconds.
		 *
		 * @param {Number} delay
		 * @param {Backbone.View} viewer
		 */
		var delay = wp.hooks.applyFilters( 'PC.fe.viewer.canvas.idle_delay', 2000, this );
		this.idle_timer = setTimeout( function() {
			that.idle_timer = null;
			that.on_idle();
		}, delay );
	},

	on_idle: function() {
		if ( this.is_removed || ! this.app || this.refresh_job ) return;
		// Still busy: update_loading() starts the delay again once done.
		if ( this.is_loading || this.cover || this.transition || this.current_stack !== this.target_stack ) return;
		if ( 'refresh' !== this.update_mode() ) return;
		if ( window.navigator && navigator.connection && navigator.connection.saveData ) return;
		var stack = this.next_refresh();
		if ( stack ) this.refresh_snapshot( stack );
	},

	/**
	 * The visited angle to refresh next: one that had a snapshot, whose
	 * snapshot is now stale, not refreshed for this picture yet, most recently
	 * shown first.
	 *
	 * @return {Object|null}
	 */
	next_refresh: function() {
		var best = null;
		_.each( this.stacks, function( stack ) {
			if ( stack === this.current_stack || ! stack.size || ! stack.had_snapshot ) return;
			if ( stack.refreshed_for === this.picture_key( stack ) ) return;
			if ( this.valid_snapshot( stack ) ) return;
			if ( ! best || ( stack.last_shown || 0 ) > ( best.last_shown || 0 ) ) best = stack;
		}, this );
		return best;
	},

	/**
	 * Rebuild a stack's snapshot two images at a time, without loading the
	 * stack: each pair is drawn into the new texture at the stack's layout,
	 * then released. Textures are built as the stack would build them, so the
	 * live picture later replaces the snapshot without a visible change.
	 */
	refresh_snapshot: function( stack ) {
		var that = this;
		var abandoned = PC.fe.views.viewer_canvas.abandoned;
		var renderer = this.app.renderer;
		var layout = this.layout_key( stack );
		var picture = this.picture_key( stack );
		var parts = this.picture_items( stack );
		stack.refreshed_for = picture;

		var texture = PIXI.RenderTexture.create( {
			width: renderer.width / renderer.resolution,
			height: renderer.height / renderer.resolution,
			resolution: renderer.resolution,
		} );
		var job = { stopped: false, stack: stack };
		this.refresh_job = job;
		var drawn = 0;
		var wanted = function() {
			return ! job.stopped && ! that.is_removed && !! that.app;
		};
		var background = function() {
			return true;
		};
		var statics = PC.fe.views.viewer_canvas;
		var release = function( items ) {
			_.each( items, function( item ) {
				if ( item && item.built ) that.destroy_built( item.built );
				if ( item && item.mask && item.mask.built ) that.destroy_built( item.mask.built );
				if ( item && item.container ) statics.destroy_item_container( item.item, item.container );
			} );
		};
		var end = function() {
			if ( that.refresh_job === job ) that.refresh_job = null;
		};
		var give_up = function() {
			end();
			if ( ! texture.destroyed ) texture.destroy( true );
		};
		// A texture the viewer holds is used as it is; others are built for this.
		// An item draws a container of its own for this, destroyed after.
		var get_texture = function( url ) {
			var record = that.textures[ url ];
			if ( record && record.texture && ! record.destroyed ) {
				return Promise.resolve( { texture: record.texture, natural: record.natural } );
			}
			return that.fetch_texture( url, function( natural ) {
				return that.texture_scale( stack, natural );
			}, wanted, background ).then( function( result ) {
				if ( ! result || abandoned === result ) return null;
				return { texture: result.built.texture, natural: result.natural, built: result.built };
			} );
		};
		var get = function( part ) {
			if ( part.item ) {
				var drawn_item = statics.draw_item_once( part.item, stack.angle_id, that.item_options( stack ) );
				if ( ! part.mask ) return drawn_item;
				// Cut like on screen (item_mask_url()).
				return Promise.all( [ drawn_item, get_texture( statics.mask_key( part.mask ) ) ] ).then( function( pair ) {
					pair[ 0 ].mask = pair[ 1 ];
					return pair[ 0 ];
				} );
			}
			// A masked image comes with its mask (under its mask key, see whiten()).
			if ( part.mask ) {
				return Promise.all( [ get_texture( part.url ), get_texture( statics.mask_key( part.mask ) ) ] ).then( function( pair ) {
					if ( pair[ 0 ] ) {
						pair[ 0 ].mask = pair[ 1 ];
					} else if ( pair[ 1 ] && pair[ 1 ].built ) {
						that.destroy_built( pair[ 1 ].built );
					}
					return pair[ 0 ];
				} );
			}
			return get_texture( part.url );
		};
		var draw = function( items ) {
			var container = new PIXI.Container();
			container.position.copyFrom( stack.container.position );
			container.scale.copyFrom( stack.container.scale );
			_.each( items, function( item ) {
				// An add-on item: its own container, or nothing at this angle.
				if ( item && item.item ) {
					if ( ! item.container ) return;
					if ( item.mask && item.mask.texture.destroyed ) {
						stack.refreshed_for = null;
						return;
					}
					container.addChild( item.container );
					if ( item.mask ) {
						var item_mask_sprite = new PIXI.Sprite( item.mask.texture );
						that.place_mask_sprite( item_mask_sprite, stack, item.mask );
						container.addChild( item_mask_sprite );
						item.container.mask = item_mask_sprite;
					}
					return;
				}
				// Released meanwhile (a texture the viewer held): the snapshot
				// would miss it, so this refresh does not count.
				if ( ! item || item.texture.destroyed ) {
					if ( item ) stack.refreshed_for = null;
					return;
				}
				// Its mask released meanwhile: never drawn uncut, and this refresh
				// does not count either.
				if ( item.mask && item.mask.texture.destroyed ) {
					stack.refreshed_for = null;
					return;
				}
				var sprite = new PIXI.Sprite( item.texture );
				that.fit_sprite( sprite, item );
				sprite.position.set( ( stack.size.width - item.natural.width ) / 2, ( stack.size.height - item.natural.height ) / 2 );
				container.addChild( sprite );
				if ( item.mask ) {
					var mask_sprite = new PIXI.Sprite( item.mask.texture );
					that.place_mask_sprite( mask_sprite, stack, item.mask );
					container.addChild( mask_sprite );
					sprite.mask = mask_sprite;
				}
			} );
			renderer.render( { container: container, target: texture, clear: 0 === drawn, clearColor: [ 0, 0, 0, 0 ] } );
			drawn++;
			// The sprites go; the textures and items' containers are released by
			// the caller.
			_.each( items, function( item ) {
				if ( item && item.container ) {
					item.container.mask = null;
					container.removeChild( item.container );
				}
			} );
			container.destroy( { children: true } );
		};
		var finish = function() {
			end();
			if ( ! that.app || that.is_removed || layout !== that.layout_key( stack ) || picture !== that.picture_key( stack ) ) {
				if ( ! texture.destroyed ) texture.destroy( true );
				return;
			}
			that.drop_snapshot( stack.angle_id );
			that.snapshots[ stack.angle_id ] = {
				angle_id: stack.angle_id,
				layout: layout,
				picture: picture,
				texture: texture,
				bytes: texture.source.pixelWidth * texture.source.pixelHeight * 4,
				dropped: false,
				destroyed: false,
			};
			// The next stale angle, if the customer is still idle.
			setTimeout( function() {
				that.on_idle();
			}, 0 );
		};
		var step = function( index ) {
			if ( ! wanted() ) return give_up();
			if ( index >= parts.length ) {
				if ( ! drawn ) draw( [] );
				return finish();
			}
			return Promise.all( _.map( parts.slice( index, index + 2 ), get ) ).then( function( items ) {
				if ( ! wanted() ) {
					release( items );
					return give_up();
				}
				draw( items );
				release( items );
				return step( index + 2 );
			} );
		};
		Promise.resolve( step( 0 ) ).catch( function( error ) {
			console.log( 'Product configurator: could not refresh the snapshot of an angle.', error );
			give_up();
		} );
	},

	stop_refresh: function() {
		if ( this.refresh_job ) this.refresh_job.stopped = true;
		this.refresh_job = null;
	},

	/*
	 * Angle transitions.
	 * --------------------------------------------------------------------- */

	stack_display: function( stack ) {
		return {
			frame: stack.frame,
			stack: stack,
			leave: function() {
				stack.container.visible = false;
			},
		};
	},

	cover_display: function( cover ) {
		var that = this;
		return {
			frame: cover.frame,
			cover: cover,
			leave: function() {
				that.destroy_cover( cover );
			},
		};
	},

	/**
	 * Whether the incoming angle comes after the outgoing one, for the
	 * direction of slides.
	 */
	is_forward: function( from_stack, to_stack ) {
		if ( ! from_stack || ! to_stack ) return true;
		var from = PC.fe.angles.indexOf( PC.fe.angles.get( from_stack.angle_id ) );
		var to = PC.fe.angles.indexOf( PC.fe.angles.get( to_stack.angle_id ) );
		return from < 0 || to < 0 || to > from;
	},

	/**
	 * @return {String} visibility, fade, slide-horizontal or slide-vertical.
	 */
	angle_transition: function() {
		/**
		 * Filter how the canvas viewer changes angle.
		 *
		 * @param {String} transition visibility (default, like the <img> stack), fade,
		 *                            slide-horizontal or slide-vertical.
		 * @param {Backbone.View} viewer
		 */
		var transition = wp.hooks.applyFilters( 'PC.fe.viewer.canvas.angle_transition', 'visibility', this );
		if ( window.matchMedia && window.matchMedia( '(prefers-reduced-motion: reduce)' ).matches ) return 'visibility';
		return _.contains( [ 'fade', 'slide-horizontal', 'slide-vertical' ], transition ) ? transition : 'visibility';
	},

	/**
	 * Move from one display (a stack or a cover) to another. The outgoing one
	 * leaves at the end (hidden, or destroyed for a cover).
	 */
	run_transition: function( from, to, forward ) {
		var that = this;
		// The incoming display on top.
		this.app.stage.addChild( to.frame );
		var type = this.angle_transition();
		if ( 'visibility' === type ) {
			from.leave();
			this.request_render();
			return;
		}

		/**
		 * Filter how long an angle transition takes, in milliseconds.
		 *
		 * @param {Number} duration
		 * @param {Backbone.View} viewer
		 */
		var duration = Math.max( 0, wp.hooks.applyFilters( 'PC.fe.viewer.canvas.angle_transition_duration', 350, this ) );
		var renderer = this.app.renderer;
		var width = renderer.width / renderer.resolution;
		var height = renderer.height / renderer.resolution;
		var direction = forward ? 1 : -1;
		var apply = function( progress ) {
			if ( 'fade' === type ) {
				from.frame.alpha = 1 - progress;
				to.frame.alpha = progress;
			} else if ( 'slide-horizontal' === type ) {
				from.frame.x = -progress * width * direction;
				to.frame.x = ( 1 - progress ) * width * direction;
			} else {
				from.frame.y = -progress * height * direction;
				to.frame.y = ( 1 - progress ) * height * direction;
			}
		};

		var transition = { from: from, to: to, frame: null, safety: null, then_reveal: false };
		transition.end = function() {
			if ( that.transition !== transition ) return;
			that.transition = null;
			cancelAnimationFrame( transition.frame );
			clearTimeout( transition.safety );
			_.each( [ from.frame, to.frame ], function( frame ) {
				if ( ! frame || frame.destroyed ) return;
				frame.alpha = 1;
				frame.position.set( 0, 0 );
			} );
			from.leave();
			if ( transition.then_reveal ) that.reveal();
			// The outgoing angle is no longer drawn live.
			that.enforce_budget();
			that.request_render();
		};
		this.transition = transition;
		apply( 0 );

		var start = null;
		var step = function( now ) {
			if ( that.transition !== transition || that.is_removed ) return;
			if ( null === start ) start = now;
			var t = duration ? Math.min( 1, ( now - start ) / duration ) : 1;
			apply( t < 0.5 ? 2 * t * t : -1 + ( 4 - 2 * t ) * t );
			if ( t < 1 ) {
				that.app.render();
				transition.frame = requestAnimationFrame( step );
			} else {
				transition.end();
			}
		};
		transition.frame = requestAnimationFrame( step );
		// Frames do not run in a background tab: end on time anyway.
		transition.safety = setTimeout( transition.end, duration + 250 );
	},

	finish_transition: function() {
		if ( this.transition ) this.transition.end();
	},

	swap_stacks: function() {
		if ( this.angle_wait_timer ) {
			clearTimeout( this.angle_wait_timer );
			this.angle_wait_timer = null;
		}
		var target = this.target_stack;
		if ( ! target || target === this.current_stack ) return;
		this.finish_transition();
		var from = this.cover ? this.cover_display( this.cover ) : this.stack_display( this.current_stack );
		var forward = this.is_forward( this.current_stack, target );
		this.cover = null;
		this.current_stack = target;
		target.container.visible = true;
		this.run_transition( from, this.stack_display( target ), forward );
		// The outgoing angle's textures are no longer pinned.
		this.enforce_budget();
		if ( ! this.is_loading ) this.start_background();
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
			that.apply_item_updates();
			that.app.render();
		} );
	},

	on_context_lost: function() {
		// A render texture's content does not survive a lost context, and
		// Pixi cannot upload it again: the flat copies go.
		this.finish_transition();
		this.uncover();
		this.stop_refresh();
		_.each( _.keys( this.snapshots ), this.drop_snapshot, this );
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
		this.reload_textures();
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
		var models = wp.hooks.applyFilters( 'PC.fe.viewer.capture.models', state.picture( angle.id ), this );

		var parts = this.parts_of( models, angle.id );
		if ( ! parts.length ) return null;

		var size = this.angle_size( angle.id ) || ( this.stacks[ angle.id ] && this.stacks[ angle.id ].size );
		if ( ! size ) {
			// No stored dimensions and nothing shown yet: the first image decides.
			var first_image = _.find( parts, function( part ) {
				return part.url;
			} );
			if ( ! first_image ) return null;
			var first = await this.load_image( first_image.url );
			if ( ! first ) return null;
			size = { width: first.naturalWidth, height: first.naturalHeight };
		}
		if ( this.is_removed || ! this.app || ! size.width || ! size.height ) return null;

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
		var scale_x = width / size.width;
		var scale_y = height / size.height;

		// Drawn a few images at a time into one render texture, each resized
		// first the way the <img> stack's capture resizes it, so memory stays at
		// a few output-sized images however many layers the picture has. Items
		// draw a container of their own for it, at the output's resolution.
		var renderer = this.app.renderer;
		var target = PIXI.RenderTexture.create( { width: width, height: height, resolution: 1 } );
		var batch_size = this.decode_limit();
		var item_options = { size: size, resolution: Math.max( scale_x, scale_y ), capture: true };
		var statics = PC.fe.views.viewer_canvas;
		var that = this;
		var drawn = 0;
		var failed = false;
		var canvas;
		var context;
		try {
			for ( var start = 0; start < parts.length && ! failed; start += batch_size ) {
				var slice = parts.slice( start, start + batch_size );
				var images = await Promise.all( _.map( slice, function( part ) {
					if ( part.item ) return statics.draw_item_once( part.item, angle.id, item_options );
					return that.load_image( part.url );
				} ) );
				// Layer masks, loaded again like the images; one that cannot load
				// leaves its image unmasked (docs/layer-masks-spec.md).
				var masks = await Promise.all( _.map( slice, function( part ) {
					return part.mask ? that.load_image( part.mask ) : null;
				} ) );
				var release_masks = function() {
					_.each( masks, function( mask ) {
						if ( mask ) that.release_image( mask );
					} );
				};
				if ( this.is_removed || ! this.app ) {
					statics.release_drawn_items( images );
					release_masks();
					return null;
				}
				if ( _.contains( images, null ) ) {
					failed = true;
					statics.release_drawn_items( images );
					release_masks();
					_.each( images, function( image ) {
						if ( image && ! image.item ) this.release_image( image );
					}, this );
					break;
				}
				var batch = new PIXI.Container();
				var made = [];
				// A mask at the output's scale, as opaque grey (whiten()), or null.
				var mask_sprite_for = function( index ) {
					var mask_image = masks[ index ];
					if ( ! mask_image || ! mask_image.naturalWidth ) return null;
					var mask_natural = { width: mask_image.naturalWidth, height: mask_image.naturalHeight };
					var white = statics.whiten( mask_image, Math.max( 1, Math.round( mask_natural.width * scale_x ) ), Math.max( 1, Math.round( mask_natural.height * scale_y ) ) );
					if ( ! white ) return null;
					var mask_texture = new PIXI.Texture( { source: new PIXI.ImageSource( { resource: white } ) } );
					made.push( mask_texture );
					var mask_sprite = new PIXI.Sprite( mask_texture );
					mask_sprite.scale.set( mask_natural.width * scale_x / mask_texture.width, mask_natural.height * scale_y / mask_texture.height );
					mask_sprite.position.set( ( size.width - mask_natural.width ) / 2 * scale_x, ( size.height - mask_natural.height ) / 2 * scale_y );
					batch.addChild( mask_sprite );
					return mask_sprite;
				};
				_.each( images, function( image, index ) {
					if ( image.item ) {
						if ( ! image.container ) return;
						// The item draws in the angle's pixels; the output is scaled.
						var holder = new PIXI.Container();
						holder.scale.set( scale_x, scale_y );
						holder.addChild( image.container );
						batch.addChild( holder );
						// Cut like on screen (item_mask_url()).
						var item_mask = mask_sprite_for( index );
						if ( item_mask ) holder.mask = item_mask;
						return;
					}
					var natural = { width: image.naturalWidth, height: image.naturalHeight };
					var out_width = Math.max( 1, Math.round( natural.width * scale_x ) );
					var out_height = Math.max( 1, Math.round( natural.height * scale_y ) );
					var smaller = out_width < natural.width || out_height < natural.height;
					var resource = smaller ? this.downscale( image, out_width, out_height ) || image : image;
					var texture = new PIXI.Texture( { source: new PIXI.ImageSource( { resource: resource } ) } );
					made.push( texture );
					var sprite = new PIXI.Sprite( texture );
					sprite.scale.set( natural.width * scale_x / texture.width, natural.height * scale_y / texture.height );
					sprite.position.set( ( size.width - natural.width ) / 2 * scale_x, ( size.height - natural.height ) / 2 * scale_y );
					batch.addChild( sprite );

					// Each image its own mask (decision 7).
					var image_mask = mask_sprite_for( index );
					if ( image_mask ) sprite.mask = image_mask;
				}, this );
				renderer.render( { container: batch, target: target, clear: 0 === drawn, clearColor: [ 0, 0, 0, 0 ] } );
				drawn += images.length;
				// Items' containers go the item's way, before the batch goes.
				_.each( images, function( image ) {
					if ( image.item && image.container && image.container.parent ) {
						image.container.parent.mask = null;
						image.container.parent.removeChild( image.container );
					}
				} );
				statics.release_drawn_items( images );
				batch.destroy( { children: true } );
				_.each( made, function( texture ) {
					texture.destroy( true );
				} );
				_.each( images, function( image ) {
					if ( ! image.item ) this.release_image( image );
				}, this );
				release_masks();
			}
			if ( failed ) {
				console.log( 'Product configurator: cannot capture the configuration, an image could not be loaded.' );
				return null;
			}

			canvas = this.target_to_canvas( target );
			context = canvas.getContext( '2d' );
		} catch ( error ) {
			console.log( 'Product configurator: could not compose the captured image.', error );
			return null;
		} finally {
			target.destroy( true );
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
	 * Draw a container off screen into a 2D canvas, with straight alpha.
	 *
	 * For add-ons that need a picture of their own (text overlay sends its
	 * text as a PNG with the cart item) without a WebGL context of their own.
	 * The container is drawn at its own transform; nothing on screen changes.
	 *
	 * @param {PIXI.Container} container
	 * @param {Number} width  Output pixels.
	 * @param {Number} height
	 * @return {HTMLCanvasElement|null}
	 */
	render_to_canvas: function( container, width, height ) {
		if ( ! this.app || this.is_removed || ! width || ! height ) return null;
		var target = PIXI.RenderTexture.create( { width: Math.round( width ), height: Math.round( height ), resolution: 1 } );
		try {
			this.app.renderer.render( { container: container, target: target, clear: true, clearColor: [ 0, 0, 0, 0 ] } );
			return this.target_to_canvas( target );
		} catch ( error ) {
			console.log( 'Product configurator: could not draw an add-on picture.', error );
			return null;
		} finally {
			target.destroy( true );
		}
	},

	/**
	 * A render texture's pixels in a new 2D canvas.
	 *
	 * @param {PIXI.RenderTexture} target
	 * @return {HTMLCanvasElement}
	 */
	target_to_canvas: function( target ) {
		var extracted = this.app.renderer.extract.pixels( { target: target } );
		var canvas = document.createElement( 'canvas' );
		canvas.width = extracted.width;
		canvas.height = extracted.height;
		canvas.getContext( '2d' ).putImageData( this.unpremultiply( extracted.pixels, extracted.width, extracted.height ), 0, 0 );
		return canvas;
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
		if ( this.resolution_timer ) clearTimeout( this.resolution_timer );
		if ( this.transition ) {
			cancelAnimationFrame( this.transition.frame );
			clearTimeout( this.transition.safety );
			this.transition = null;
		}
		this.cover = null;
		if ( this.idle_timer ) clearTimeout( this.idle_timer );
		this.idle_timer = null;
		this.stop_refresh();
		_.each( this.snapshots, function( snapshot ) {
			snapshot.texture.destroy( true );
		} );
		this.snapshots = {};
		this.stop_background();
		// Let the waiting loads run: each sees is_removed and gives up.
		var waiting = this.decode_queue;
		this.decode_queue = [];
		_.each( waiting, function( waiter ) {
			waiter.give_up();
		} );
		if ( this.resize_observer ) this.resize_observer.disconnect();
		this.resize_observer = null;
		this.stopListening();

		_.each( this.stacks, function( stack ) {
			_.each( stack.layers, function( record ) {
				if ( record.hold_timer ) clearTimeout( record.hold_timer );
				// Items clean up their containers while the renderer is there.
				_.each( record.shown, function( entry ) {
					if ( entry.item ) this.drop_entry( entry );
				}, this );
				_.each( record.held, function( entry ) {
					if ( entry.item ) this.drop_entry( entry );
				}, this );
			}, this );
		}, this );
		_.each( _.compact( _.values( this.items ) ), function( item ) {
			try {
				if ( item.destroy ) item.destroy();
			} catch ( error ) {
				console.log( 'Product configurator: an add-on item could not clean up.', error );
			}
		} );
		this.items = {};
		this.dirty_items = [];
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
		_.each( _.values( this.textures ), this.destroy_record, this );
		this.textures = {};
		this.waiting = {};

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
	 * What load_texture() resolves with when its decode was given up because
	 * nobody wanted the image any more.
	 */
	abandoned: { abandoned: true },

	/**
	 * The key a layer mask's texture is loaded under: the file's URL with a
	 * fragment, which no request carries (the HTTP cache is shared with the file
	 * used as an image) but which keeps the mask texture (see whiten()) apart from the
	 * same file's image texture.
	 *
	 * @param {String} url
	 * @return {String}
	 */
	mask_key: function( url ) {
		return url + '#pc-mask';
	},

	destroy_sprite: function( sprite ) {
		if ( ! sprite || sprite.destroyed ) return;
		if ( sprite.parent ) sprite.parent.removeChild( sprite );
		sprite.destroy();
	},

	is_mask_key: function( url ) {
		return /#pc-mask$/.test( String( url || '' ) );
	},

	/**
	 * The mask an add-on item is cut with at an angle, as a URL ('' for none).
	 *
	 * An item without a mask() method, or whose mask() returns undefined, is
	 * cut by its layer's mask, like the layer's images. mask() returning a URL
	 * cuts it with that mask instead; returning '' or null, with none. The mask
	 * follows the layer masks' rules: an alpha PNG the size of the angle's
	 * images, centred like them (docs/layer-masks-spec.md).
	 *
	 * @param {Object}         item
	 * @param {Backbone.Model} layer
	 * @param {Number|String}  angle_id
	 * @return {String}
	 */
	item_mask_url: function( item, layer, angle_id ) {
		var own;
		if ( item && 'function' === typeof item.mask ) {
			try {
				own = item.mask( angle_id );
			} catch ( error ) {
				own = undefined;
			}
		}
		if ( undefined !== own ) return own ? String( own ) : '';
		var image = PC.fe.layer_masks && layer ? PC.fe.layer_masks.get( layer, angle_id ) : null;
		return image && image.url ? image.url : '';
	},

	/**
	 * A mask redrawn the way Pixi's sprite mask reads it: opaque, grey = the
	 * mask's alpha (white where it shows, black where it hides).
	 *
	 * Pixi 8.16's mask filter keeps `mask.a * mask.r` of a premultiplied
	 * texture. A white mask with alpha a gives a * a: soft edges came out
	 * squared (a 50% edge at 25%). Opaque grey gives 1 * a, exactly the alpha
	 * the <img> stack and the server merge use.
	 *
	 * @param {CanvasImageSource} resource
	 * @param {Number} [width]  Defaults to the resource's own size.
	 * @param {Number} [height]
	 * @return {HTMLCanvasElement|null}
	 */
	whiten: function( resource, width, height ) {
		width = width || resource.naturalWidth || resource.width;
		height = height || resource.naturalHeight || resource.height;
		if ( ! width || ! height ) return null;
		var canvas = document.createElement( 'canvas' );
		canvas.width = width;
		canvas.height = height;
		var context = canvas.getContext( '2d' );
		if ( ! context ) return null;
		context.drawImage( resource, 0, 0, width, height );
		// White where the mask is, with its alpha...
		context.globalCompositeOperation = 'source-in';
		context.fillStyle = '#fff';
		context.fillRect( 0, 0, width, height );
		// ...over black: opaque, grey = alpha.
		context.globalCompositeOperation = 'destination-over';
		context.fillStyle = '#000';
		context.fillRect( 0, 0, width, height );
		return canvas;
	},

	/**
	 * Ask add-ons for the item drawing a choice in the scene.
	 *
	 * An item is an object:
	 *   create( angle_id, options ) -> PIXI.Container|null  Required. The choice
	 *       drawn for an angle, in the pixels of the angle's image (the viewer
	 *       scales it with the stack). null: nothing at this angle. Called for
	 *       each angle shown, and again for one-off drawings (capture, the idle
	 *       snapshot refresh) that are destroyed right after.
	 *       options: { size, resolution, capture }: the angle's image size
	 *       ({ width, height }, or null before it is known), device pixels per
	 *       image pixel (for text resolution), whether it is for a capture.
	 *   update( container, angle_id, options )  Optional. Bring a container in
	 *       line with the item after context.request_render(), or when the
	 *       options changed (a resize).
	 *   key( angle_id ) -> String  Optional. What it draws at that angle; when
	 *       it changes, flat copies of other angles are redrawn. Without it,
	 *       those copies keep the old drawing.
	 *   ready( angle_id ) -> Promise  Optional. Resolves once it can draw
	 *       properly (fonts loaded); the picture counts as loading until then.
	 *   destroy_container( container )  Optional. Before the viewer destroys a
	 *       container (with its children).
	 *   destroy()  Optional. The viewer goes.
	 *
	 * @param {Backbone.Model} choice
	 * @param {Object} context { viewer, layer, request_render() }; viewer is
	 *                         null when only asking whether there is an item.
	 * @return {Object|null}
	 */
	ask_item: function( choice, context ) {
		var item = wp.hooks.applyFilters( 'PC.fe.viewer.canvas.item', null, choice, context );
		return item && 'function' === typeof item.create ? item : null;
	},

	/**
	 * A one-off drawing of an item, once it is ready.
	 *
	 * @return {Promise<Object>} { item, container } (container may be null)
	 */
	draw_item_once: function( item, angle_id, options ) {
		var ready;
		try {
			ready = item.ready ? item.ready( angle_id ) : null;
		} catch ( error ) {
			ready = null;
		}
		var draw = function() {
			var container = null;
			try {
				container = item.create( angle_id, options ) || null;
			} catch ( error ) {
				console.log( 'Product configurator: an add-on item could not be drawn.', error );
			}
			return { item: item, container: container };
		};
		return Promise.resolve( ready ).then( draw, draw );
	},

	release_drawn_items: function( drawn ) {
		_.each( drawn, function( entry ) {
			if ( entry && entry.item && entry.container ) {
				PC.fe.views.viewer_canvas.destroy_item_container( entry.item, entry.container );
				entry.container = null;
			}
		} );
	},

	destroy_item_container: function( item, container ) {
		if ( container.destroyed ) return;
		try {
			if ( item.destroy_container ) item.destroy_container( container );
		} catch ( error ) {
			console.log( 'Product configurator: an add-on item could not clean up.', error );
		}
		if ( container.parent ) container.parent.removeChild( container );
		container.destroy( { children: true } );
	},

	/**
	 * Whether the configurator is narrower than the mobile image breakpoint,
	 * where the stack switches to mobile images: smaller budgets apply there.
	 *
	 * @return {Boolean}
	 */
	small_screen: function() {
		var config = PC.fe.config || {};
		var width = PC.fe.modal && PC.fe.modal.$el ? PC.fe.modal.$el.outerWidth() : 0;
		return !! ( width && config.mobile_image_breakpoint && width < config.mobile_image_breakpoint );
	},

	/**
	 * The most texture memory the device's own memory allows, in MiB, or 0 for
	 * no limit. Only Chromium browsers report it (navigator.deviceMemory,
	 * rounded, at most 8), so Safari and Firefox always get 0. It only ever
	 * lowers the budget: the breakpoint rule is what was measured.
	 *
	 * @return {Number}
	 */
	memory_cap: function() {
		var memory = window.navigator && navigator.deviceMemory;
		if ( ! ( memory > 0 ) ) return 0;
		if ( memory <= 2 ) return 64;
		if ( memory <= 4 ) return 128;
		return 0;
	},

	/**
	 * Round a texture scale up to the next step of √2, capped at 1 (full size).
	 *
	 * @param {Number} scale Device pixels per image pixel.
	 * @return {Number}
	 */
	scale_step: function( scale ) {
		if ( ! ( scale > 0 ) || scale >= 1 ) return 1;
		// The epsilon keeps an exact step (0.5) from rounding up to the next one.
		var step = Math.ceil( 2 * Math.log2( scale ) - 1e-9 ) / 2;
		return Math.min( 1, Math.pow( 2, step ) );
	},

	/**
	 * Which textures to release, least recently used first, to get under the
	 * budget. Over budget with nothing left to release is allowed: the picture
	 * on screen always shows.
	 *
	 * @param {Array}  candidates Unpinned records ({ bytes, last_used }).
	 * @param {Number} total      Bytes used now.
	 * @param {Number} budget
	 * @return {Array} The records to release.
	 */
	pick_evictions: function( candidates, total, budget ) {
		var sorted = candidates.slice().sort( function( a, b ) {
			return a.last_used - b.last_used;
		} );
		var evict = [];
		for ( var i = 0; i < sorted.length && total > budget; i++ ) {
			evict.push( sorted[ i ] );
			total -= sorted[ i ].bytes;
		}
		return evict;
	},

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
		// scene, unless the add-on also gives a canvas item for it; otherwise
		// the whole product uses the <img> stack instead (decision C).
		if ( ! PC.fe.layers || ! PC.fe.contents ) return null;
		var that = this;
		var dom_layer = PC.fe.layers.find( function( layer ) {
			var choices = PC.fe.getLayerContent( layer.id );
			if ( ! choices ) return false;
			return choices.find( function( choice ) {
				if ( PC.fe.views.viewer_layer === wp.hooks.applyFilters( 'PC.fe.viewer.item.view', PC.fe.views.viewer_layer, choice, null ) ) return false;
				return ! that.ask_item( choice, { viewer: null, layer: layer, request_render: function() {} } );
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
