var PC = PC || {};
PC.views = PC.views || {};

/**
 * The live stack preview on the Image order screen.
 *
 * Draws what the configurator would draw: one choice per layer, composited bottom
 * up in the order the list is showing, for the selected view. Reordering redraws
 * it immediately, which is the whole point - the order of images was previously a
 * number you changed and then went to the shop front to check.
 *
 * ## Why a canvas, and why one small canvas per layer
 *
 * Layer count is what drives this, not any one store's images. Layer images are
 * full-bleed product renders, so every layer contributes to every frame and none
 * of them can be skipped; a DOM stack is then one composited layer and one decoded
 * bitmap per image, and both scale with a layer count that runs into the hundreds.
 *
 * So each source is drawn once into its own small canvas at preview resolution and
 * the source is released immediately. Steady-state memory is the preview size times
 * the layer count (tens of MB), peak is bounded by how many loads run at once
 * rather than by how many layers exist, and a reorder becomes N blits of small
 * canvases - fast enough to redraw on every frame of a drag. A ten-layer product
 * pays nothing for this; a two-hundred-layer one stays usable.
 *
 * ## Plain <img> loads
 *
 * `createImageBitmap` would decode off the main thread, but it needs the bytes via
 * `fetch`, and both it and `fetch` need the image to be same-origin or CORS-enabled.
 * Sources are already downscaled server-side by the time they get here, so the
 * decode it would save is a small one - not worth carrying two loading paths for.
 *
 * The one thing that follows from this: no `crossOrigin` attribute. Setting it
 * turns a load that works today into a failing one on any host that does not send
 * CORS headers - which is what a store still pointing at its old domain after a
 * migration looks like. Those images taint the canvas, which costs nothing here
 * because the pixels are only ever displayed, never read back.
 */
( function( $, _ ) {

	/** Longest edge of the internal canvas. Displayed size is CSS-scaled from this. */
	var PREVIEW_MAX = 448;

	/** Simultaneous image loads, in line with what a browser opens per host anyway. */
	var CONCURRENCY = 6;

	PC.views.image_order_preview = Backbone.View.extend( {
		tagName: 'div',
		className: 'mkl-pc-preview',
		template: wp.template( 'mkl-pc-image-order-preview' ),

		events: {
			'change .mkl-pc-preview__angle-select': 'on_angle_change',
			'click .mkl-pc-preview__retry': 'on_retry',
		},

		initialize: function( options ) {
			this.options = options || {};
			this.parent = options.parent;
			this.col = options.parent.col;
			this.content = PC.app.get_product().get( 'content' );
			this.angles = PC.app.get_admin().angles;

			this.tiles = {};          // layerId -> small canvas
			this.failed = {};         // layerId -> true
			this.queue = [];
			this.in_flight = 0;
			this.generation = 0;      // bumped on angle change, so stale loads are dropped
			this.highlighted = null;
			this.sources = null;      // attachment id -> scaled URL, once resolved
			this.fonts = {};          // family -> load promise, shared across rebuilds

			this.angle_id = this.default_angle_id();

			this.render();
		},

		remove: function() {
			this.generation++;
			this.tiles = {};
			this.queue = [];
			if ( this._raf ) cancelAnimationFrame( this._raf );
			return Backbone.View.prototype.remove.call( this );
		},

		default_angle_id: function() {
			if ( ! this.angles || ! this.angles.length ) return null;
			var active = this.angles.findWhere( { has_thumbnails: true } ) || this.angles.first();
			return active ? active.id : null;
		},

		render: function() {
			this.$el.html( this.template( {
				angles: this.angles ? this.angles.map( function( a ) {
					return { id: a.id, name: a.get( 'name' ) || '' };
				} ) : [],
				angle_id: this.angle_id,
			} ) );
			this.canvas = this.$( '.mkl-pc-preview__canvas' )[ 0 ];
			this.ctx = this.canvas ? this.canvas.getContext( '2d' ) : null;
			this.$status = this.$( '.mkl-pc-preview__status' );
			this.build();
			return this;
		},

		/* ----------------------------------------------------------- the sources */

		/**
		 * The choice whose image stands in for a layer.
		 *
		 * A static layer has exactly one; otherwise the default choice is what a
		 * customer sees before touching anything, so that is what the preview shows.
		 * Falling back to the first choice that has an image at all keeps a layer from
		 * silently vanishing just because its default has no picture for this view.
		 *
		 * @param {Backbone.Model} layer
		 * @return {Backbone.Model|null}
		 */
		choice_for: function( layer ) {
			var layer_content = this.content ? this.content.get( layer.id ) : null;
			var choices = layer_content ? layer_content.get( 'choices' ) : null;
			if ( ! choices || ! choices.length ) return null;

			if ( layer.get( 'not_a_choice' ) ) return choices.first();

			var has_image_here = _.bind( function( choice ) {
				return !! this.image_data( choice );
			}, this );

			var preferred = choices.findWhere( { is_default: true } );
			if ( preferred && has_image_here( preferred ) ) return preferred;

			return choices.find( has_image_here ) || preferred || choices.first();
		},

		/**
		 * The stored image record for a choice in the current view, if there is one.
		 *
		 * @param {Backbone.Model} choice
		 * @return {Object|null} { url, id, dimensions }
		 */
		image_data: function( choice ) {
			if ( ! choice || ! this.angle_id ) return null;
			var images = choice.get( 'images' );
			if ( ! images || ! images.get ) return null;
			var picture = images.get( this.angle_id );
			if ( ! picture ) return null;
			var image = picture.get( 'image' );
			return image && image.url ? image : null;
		},

		/**
		 * Everything the preview needs to draw, one entry per layer that has an image.
		 *
		 * @return {Array}
		 */
		collect: function() {
			var entries = [];
			this.col.each( function( layer ) {
				var choice = this.choice_for( layer );

				// A text overlay carries no picture - it draws type into a zone. Ask for
				// that before looking for an image, or the layer silently leaves a hole
				// in the stack exactly where the engraving belongs.
				if ( this.is_text_layer( layer ) ) {
					var text = this.text_data( layer, choice );
					if ( text ) entries.push( text );
					return;
				}

				var image = this.image_data( choice );
				if ( ! image ) return;
				entries.push( {
					kind: 'image',
					layer_id: layer.id,
					url: image.url,
					attachment_id: parseInt( image.id, 10 ) || 0,
					dimensions: image.dimensions || null,
				} );
			}, this );
			return entries;
		},

		/**
		 * Both spellings are in the wild: the layer type registry says `text_overlay`
		 * while stored layers carry `text-overlay`.
		 *
		 * @param {Backbone.Model} layer
		 * @return {Boolean}
		 */
		is_text_layer: function( layer ) {
			return /text.?overlay/.test( layer.get( 'type' ) || '' );
		},

		/**
		 * What a text overlay would draw in the current view, if anything.
		 *
		 * The zone lives on the *choice*, one entry per view, in the coordinate space
		 * of its own reference image - so a view the text was never positioned for
		 * correctly contributes nothing, which is why this can return null.
		 *
		 * @param {Backbone.Model} layer
		 * @param {Backbone.Model} choice
		 * @return {Object|null}
		 */
		text_data: function( layer, choice ) {
			if ( ! choice || ! this.angle_id ) return null;

			var positions = choice.get( 'text_positions' );
			if ( ! positions ) return null;

			var position = null;
			if ( 'function' === typeof positions.get_item ) {
				position = positions.get_item( this.angle_id );
			}
			// Fall back to a loose match: stored angle ids are not consistently typed,
			// and get_item() compares them strictly.
			if ( ! position ) {
				var wanted = this.angle_id;
				var models = positions.models || positions;
				position = _.find( models, function( item ) {
					var id = item.get ? item.get( 'angle_id' ) : item.angle_id;
					return id == wanted; // eslint-disable-line eqeqeq
				} );
			}
			if ( ! position ) return null;

			var attrs = position.attributes || position;
			var zone = attrs.position;
			var ref = attrs.ref_image;
			if ( ! zone || ! ref || ! ref.width || ! ref.height ) return null;

			var colors = layer.get( 'text_colors' ) || [];
			var fonts = layer.get( 'font_list' ) || [];

			return {
				kind: 'text',
				layer_id: layer.id,
				text: choice.get( 'default_text' ) || attrs.sample_text || layer.get( 'name' ) || '',
				zone: zone,
				ref: ref,
				font_size: parseFloat( attrs.font_size ) || 16,
				align: attrs.text_align || 'center',
				vertical_align: attrs.vertical_align || 'center',
				color: ( colors[ 0 ] && colors[ 0 ].hex ) ? colors[ 0 ].hex : '#333333',
				font: fonts[ 0 ] || null,
			};
		},

		/* -------------------------------------------------------------- building */

		build: function() {
			if ( ! this.ctx ) return;

			var generation = ++this.generation;
			this.tiles = {};
			this.failed = {};
			this.queue = [];
			this.in_flight = 0;

			var entries = this.collect();
			this.total = entries.length;
			this.loaded = 0;

			this.size_canvas( entries );
			this.ctx.clearRect( 0, 0, this.canvas.width, this.canvas.height );

			if ( ! entries.length ) {
				this.set_status( 'empty' );
				return;
			}

			// Nothing is in flight until the sources come back, but the panel should
			// already read as busy rather than as an empty preview.
			this.set_status( 'loading' );

			var by_kind = _.groupBy( entries, 'kind' );
			_.each( by_kind.text || [], function( entry ) {
				this.draw_text_entry( entry, generation );
			}, this );

			this.resolve_sources( by_kind.image || [] ).then( _.bind( function( resolved ) {
				if ( generation !== this.generation ) return;
				this.queue = resolved;
				this.pump( generation );
			}, this ) );
		},

		/**
		 * Ask the server for scaled versions, and carry on regardless if it cannot
		 * help - an unresolvable id just keeps the stored URL.
		 *
		 * @param {Array} entries
		 * @return {Promise}
		 */
		resolve_sources: function( entries ) {
			var ids = _.uniq( _.compact( _.pluck( entries, 'attachment_id' ) ) );
			var lang = PC.lang || {};

			if ( ! ids.length || ! lang.preview_sources_nonce ) {
				return $.Deferred().resolve( entries ).promise();
			}
			if ( this.sources ) {
				return $.Deferred().resolve( this.apply_sources( entries, this.sources ) ).promise();
			}

			var self = this;
			return $.ajax( {
				url: ajaxurl,
				method: 'POST',
				data: { action: 'mkl_pc_preview_sources', ids: ids, security: lang.preview_sources_nonce },
			} ).then( function( response ) {
				var sources = ( response && response.success && response.data ) ? response.data.sources : null;
				self.sources = sources || {};
				return self.apply_sources( entries, self.sources );
			}, function() {
				// The stored URLs still work; they are just bigger than they need to be.
				self.sources = {};
				return entries;
			} );
		},

		apply_sources: function( entries, sources ) {
			return _.map( entries, function( entry ) {
				var scaled = entry.attachment_id ? sources[ String( entry.attachment_id ) ] : null;
				return scaled ? _.extend( {}, entry, { url: scaled } ) : entry;
			} );
		},

		/**
		 * Shape the canvas to the images.
		 *
		 * Fixed internal resolution, CSS-scaled to the panel: the per-layer canvases
		 * are built at this size, so tying it to the panel width would mean rebuilding
		 * every one of them on every resize.
		 *
		 * @param {Array} entries
		 */
		size_canvas: function( entries ) {
			var dims = null;
			_.find( entries, function( entry ) {
				if ( entry.dimensions && entry.dimensions.width && entry.dimensions.height ) {
					dims = entry.dimensions;
					return true;
				}
				return false;
			} );

			// Nothing but text overlays in this view: the reference image they were
			// positioned against describes the same space the layer images would have.
			if ( ! dims ) {
				_.find( entries, function( entry ) {
					if ( entry.ref && entry.ref.width && entry.ref.height ) {
						dims = entry.ref;
						return true;
					}
					return false;
				} );
			}

			var ratio = dims ? ( dims.width / dims.height ) : 1;
			if ( ! isFinite( ratio ) || ratio <= 0 ) ratio = 1;

			this.width = ratio >= 1 ? PREVIEW_MAX : Math.round( PREVIEW_MAX * ratio );
			this.height = ratio >= 1 ? Math.round( PREVIEW_MAX / ratio ) : PREVIEW_MAX;

			this.canvas.width = this.width;
			this.canvas.height = this.height;
			this.$( '.mkl-pc-preview__canvas-wrap' ).css( 'aspect-ratio', this.width + ' / ' + this.height );
		},

		/** Keep CONCURRENCY loads in the air until the queue drains. */
		pump: function( generation ) {
			while ( this.in_flight < CONCURRENCY && this.queue.length ) {
				if ( generation !== this.generation ) return;
				this.load_one( this.queue.shift(), generation );
			}
		},

		load_one: function( entry, generation ) {
			this.in_flight++;
			var self = this;
			var img = new Image();

			var done = function( ok ) {
				if ( generation !== self.generation ) return;
				if ( ok ) {
					self.make_tile( entry, img );
				} else {
					self.failed[ entry.layer_id ] = true;
				}
				// Release the source as soon as its tile exists, so what the preview holds
				// on to is the tile rather than the decoded image behind it.
				img.onload = img.onerror = null;
				img.src = '';

				self.loaded++;
				self.in_flight--;
				self.set_status( self.loaded >= self.total ? 'ready' : 'loading' );
				self.request_redraw();
				self.pump( generation );
			};

			img.onload = function() { done( true ); };
			img.onerror = function() { done( false ); };
			img.src = entry.url;
		},

		/**
		 * Draw a text overlay's placeholder, once its font is available.
		 *
		 * Not the real render - the shop draws this through Pixi with the full layout
		 * engine behind it. What it is for is answering "where does the engraving sit,
		 * and what covers it", which is the question this screen exists to answer.
		 *
		 * @param {Object} entry
		 * @param {Number} generation
		 */
		draw_text_entry: function( entry, generation ) {
			var self = this;
			var finish = function( family ) {
				if ( generation !== self.generation ) return;
				self.make_text_tile( entry, family );
				self.loaded++;
				self.set_status( self.loaded >= self.total ? 'ready' : 'loading' );
				self.request_redraw();
			};

			var loading = this.load_font( entry.font );
			if ( ! loading ) {
				finish( null );
				return;
			}
			loading.then( finish, function() { finish( null ); } );
		},

		/**
		 * Load a layer's own font so the placeholder reads the way the engraving will.
		 *
		 * Returns null when there is nothing to load or the browser cannot do it, and
		 * the caller falls back to a generic face rather than waiting on nothing.
		 *
		 * @param {Object} font
		 * @return {Promise|null}
		 */
		load_font: function( font ) {
			if ( ! font || ! font.file || 'undefined' === typeof window.FontFace || ! document.fonts ) return null;

			var family = 'mklpc-preview-' + ( font.slug || font.id || 'font' );
			if ( this.fonts[ family ] ) return this.fonts[ family ];

			// Stored font URLs can still be http on a site now served over https, which
			// the browser blocks outright. The plugin's own esc_url does the same swap.
			var url = String( font.file );
			if ( 'https:' === window.location.protocol && 0 === url.indexOf( 'http://' ) ) {
				url = 'https://' + url.slice( 7 );
			}

			var face = new window.FontFace( family, 'url(' + url + ')' );
			this.fonts[ family ] = face.load().then( function( loaded ) {
				document.fonts.add( loaded );
				return family;
			} );
			return this.fonts[ family ];
		},

		make_text_tile: function( entry, family ) {
			var tile = document.createElement( 'canvas' );
			tile.width = this.width;
			tile.height = this.height;

			var ctx = tile.getContext( '2d' );
			var sx = this.width / entry.ref.width;
			var sy = this.height / entry.ref.height;
			var zone = entry.zone;
			var w = ( parseFloat( zone.width ) || 0 ) * sx;
			var h = ( parseFloat( zone.height ) || 0 ) * sy;
			var size = Math.max( 5, entry.font_size * sy );

			// The two axes are anchored differently, and only the layout code says so:
			// the Pixi container is given `pivot.x = width / 2` and then placed at
			// `pos.x`, which makes pos.x the zone's horizontal CENTRE - while pivot.y is
			// never set, leaving pos.y as its top edge.
			var cx = ( parseFloat( zone.x ) || 0 ) * sx;
			var top = ( parseFloat( zone.y ) || 0 ) * sy;
			var left = cx - w / 2;

			ctx.save();

			// The container rotates about its pivot, so that is (centre, top) too.
			var rotation = parseFloat( zone.rotation ) || 0;
			if ( rotation ) {
				ctx.translate( cx, top );
				ctx.rotate( rotation * Math.PI / 180 );
				ctx.translate( -cx, -top );
			}

			var stack = family ? '"' + family + '", Georgia, serif' : 'Georgia, serif';
			ctx.font = size + 'px ' + stack;
			ctx.fillStyle = entry.color;
			ctx.textAlign = ( 'left' === entry.align || 'right' === entry.align ) ? entry.align : 'center';

			var tx = cx;
			if ( 'left' === ctx.textAlign ) tx = left;
			if ( 'right' === ctx.textAlign ) tx = left + w;

			var ty = top + h / 2;
			ctx.textBaseline = 'middle';
			if ( 'top' === entry.vertical_align ) {
				ctx.textBaseline = 'top';
				ty = top;
			} else if ( 'bottom' === entry.vertical_align ) {
				ctx.textBaseline = 'bottom';
				ty = top + h;
			}

			// maxWidth keeps a long default from spilling out of its zone, the way the
			// real layout engine would reflow or shrink it.
			ctx.fillText( entry.text, tx, ty, w || undefined );
			ctx.restore();

			this.tiles[ entry.layer_id ] = tile;
		},

		make_tile: function( entry, img ) {
			if ( ! img.naturalWidth || ! img.naturalHeight ) return;
			var tile = document.createElement( 'canvas' );
			tile.width = this.width;
			tile.height = this.height;
			var ctx = tile.getContext( '2d' );
			ctx.drawImage( img, 0, 0, this.width, this.height );
			this.tiles[ entry.layer_id ] = tile;
		},

		/* --------------------------------------------------------------- drawing */

		request_redraw: function() {
			if ( this._raf ) return;
			this._raf = requestAnimationFrame( _.bind( function() {
				this._raf = null;
				this.draw();
			}, this ) );
		},

		/**
		 * Composite the tiles back to front, in the order the list is showing.
		 *
		 * Reads the order off the parent's rows rather than the models, so a drag in
		 * progress previews where the layer would land, not where it still is.
		 */
		draw: function() {
			if ( ! this.ctx ) return;
			this.ctx.clearRect( 0, 0, this.width, this.height );

			var rows = this.parent.rows();
			var highlighted = this.highlighted;

			// Rows run front first; the stack is painted the other way round.
			for ( var i = rows.length - 1; i >= 0; i-- ) {
				var row = rows[ i ];
				if ( ! row || ! row.model ) continue;
				if ( this.parent.is_layer_hidden && this.parent.is_layer_hidden( row.model.id ) ) continue;
				var tile = this.tiles[ row.model.id ];
				if ( ! tile ) continue;
				this.ctx.globalAlpha = ( null === highlighted || row.model.id === highlighted ) ? 1 : 0.15;
				this.ctx.drawImage( tile, 0, 0 );
			}
			this.ctx.globalAlpha = 1;
		},

		/** Called by the screen whenever the stack changes. */
		invalidate: function() {
			this.request_redraw();
		},

		/**
		 * Dim everything but one layer, so hovering a row answers "which one is that?"
		 * without having to move it and look.
		 *
		 * @param {String|Number|null} layer_id
		 */
		highlight: function( layer_id ) {
			var next = ( layer_id === undefined ) ? null : layer_id;
			if ( next === this.highlighted ) return;
			this.highlighted = next;
			this.request_redraw();
		},

		/* --------------------------------------------------------------- controls */

		on_angle_change: function( e ) {
			// Resolve through the collection rather than keeping the select's string:
			// the text overlay's own get_item() is a strict findWhere on angle_id, so a
			// "2" that should be a 2 quietly matches nothing.
			var value = $( e.currentTarget ).val();
			var angle = this.angles ? this.angles.get( value ) : null;
			this.angle_id = angle ? angle.id : value;
			this.build();
		},

		on_retry: function( e ) {
			e.preventDefault();
			this.sources = null;
			this.build();
		},

		set_status: function( state ) {
			if ( ! this.$status ) return;
			var lang = PC.lang || {};
			var failed = _.size( this.failed );
			var text = '';

			if ( 'empty' === state ) {
				text = lang.preview_no_images || 'No layer has an image for this view.';
			} else if ( 'loading' === state ) {
				text = ( lang.preview_loading || 'Drawing %1$d of %2$d layers…' )
					.replace( '%1$d', this.loaded ).replace( '%2$d', this.total );
			} else if ( failed ) {
				text = ( lang.preview_failed || '%d layer image could not be loaded.' ).replace( '%d', failed );
			}

			this.$status.text( text );
			this.$el.toggleClass( 'is-loading', 'loading' === state );
			this.$( '.mkl-pc-preview__spinner' ).toggleClass( 'is-active', 'loading' === state );
			this.$( '.mkl-pc-preview__retry' ).prop( 'hidden', ! failed || 'loading' === state );
		},
	} );

} ( jQuery, PC._us || window._ ) );
