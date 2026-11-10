/*
	PC.views.zone_editor
	-> A dialog to draw a zone on a view's image: where an add-on draws something of the customer's
	   (an upload, text). See docs/image-overlay-spec.md (decision I).

	A zone, in the shape text overlay stores its positions:
	{
		ref_image: { url, id, width, height },  // the view's image the zone is drawn on
		position: { x, y, width, height, rotation }
	}
	in the reference image's pixels. (x, y) is the zone's TOP CENTRE, and the zone turns around it
	by `rotation` degrees, as text overlay draws it (text-drawing.js, pivot at width / 2, 0).

	Options:
	- title, angle_name;
	- angle_id: the view. The zone is then drawn over the view's default configuration (every
	  layer's default choice on it, stacked as the Image order screen previews it), the
	  reference image only giving the zone's pixel space. Choosing another image shows that
	  image instead;
	- zone: the zone to edit (copied: nothing changes before Done);
	- mask_url: a mask shown over the image, the layer's or the zone's (where the zone can show).
	  A zone without a position starts on the box around its opaque pixels;
	- decorate( $inner, zone ): draw a preview inside the zone (a sample image, text);
	- save( zone ): called on Done with the edited zone.

	Hooks: action `PC.admin.zone_editor.render` ( editor ) after each drawing of the zone.
*/
var PC = PC || {};
PC.views = PC.views || {};

( function( $, _ ) {
	'use strict';

	var lang = function( key, fallback ) {
		var strings = ( typeof PC_lang !== 'undefined' && PC_lang && PC_lang.zone_editor ) || {};
		return strings[ key ] || fallback;
	};

	var HANDLES = [ 'nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w' ];
	var MIN_SIZE = 4;

	PC.views.zone_editor = PC.views.admin_dialog.extend( {

		events: function() {
			return _.extend( {}, PC.views.admin_dialog.prototype.events, {
				'click .mkl-pc-zone-editor__image': 'pick_image',
				'select-media': 'select_image',
				'input .mkl-pc-zone-editor__field input': 'field_changed',
				'change .mkl-pc-zone-editor__field input': 'field_changed',
				'pointerdown .mkl-pc-zone-editor__zone': 'pointer_down',
				'keydown .mkl-pc-zone-editor__zone': 'key_down',
				'click .mkl-pc-zone-editor__done': 'done',
				'click .mkl-pc-zone-editor__cancel': 'close',
			} );
		},

		initialize: function( options ) {
			this.options = options || {};
			this.background = null;
			// The view's default configuration under the zone, until an image is chosen.
			this.use_background = undefined !== this.options.angle_id && null !== this.options.angle_id && !! PC.views.image_order_preview;
			var zone = this.options.zone || {};
			this.zone = {
				ref_image: zone.ref_image ? _.clone( zone.ref_image ) : null,
				// Numbers, whatever the stored data holds.
				position: zone.position ? PC.views.zone_editor.clamp( _.mapObject( zone.position, function( value ) {
					return parseFloat( value ) || 0;
				} ) ) : null,
			};
			this.scale = 1;
			this._on_move = this.pointer_move.bind( this );
			this._on_up = this.pointer_up.bind( this );
			this._on_resize = _.debounce( this.layout.bind( this ), 100 );
			$( window ).on( 'resize.mklPcZoneEditor_' + this.cid, this._on_resize );
			PC.views.admin_dialog.prototype.initialize.call( this, {
				title: this.options.title || lang( 'title', 'Zone' ),
				extraClass: 'mkl-pc-admin-dialog--zone-editor',
			} );
			this.$stage = this.$( '.mkl-pc-zone-editor__stage' );
			this.$picture = this.$( '.mkl-pc-zone-editor__picture' );
			this.$zone = this.$( '.mkl-pc-zone-editor__zone' );
			this.show_image();
			this.open();
		},

		renderDialogBody: function() {
			var field = function( name, label ) {
				return '<label class="mkl-pc-zone-editor__field"><span>' + _.escape( label ) + '</span>'
					+ '<input type="number" step="1" data-field="' + name + '"></label>';
			};
			var handles = _.map( HANDLES, function( handle ) {
				return '<span class="mkl-pc-zone-editor__handle mkl-pc-zone-editor__handle--' + handle + '" data-handle="' + handle + '"></span>';
			} ).join( '' );
			var toolbar = '<div class="mkl-pc-zone-editor__toolbar">'
				+ ( this.options.angle_name ? '<p class="mkl-pc-zone-editor__view">' + _.escape( this.options.angle_name ) + '</p>' : '' )
				+ '<div class="mkl-pc-zone-editor__fields">'
				+ field( 'x', lang( 'x', 'X (centre)' ) )
				+ field( 'y', lang( 'y', 'Y (top)' ) )
				+ field( 'width', lang( 'width', 'Width' ) )
				+ field( 'height', lang( 'height', 'Height' ) )
				+ field( 'rotation', lang( 'rotation', 'Rotation (°)' ) )
				+ '</div>'
				+ '<p class="description">' + _.escape( lang( 'help', 'Drag the zone to move it, its handles to resize it. Arrow keys move it by one pixel, with Shift by ten.' ) ) + '</p>'
				+ '<div class="mkl-pc-zone-editor__image-picker">'
				+ '<button type="button" class="button mkl-pc-zone-editor__image">' + _.escape( lang( 'choose_image', 'Choose the view\'s image' ) ) + '</button>'
				+ '<p class="mkl-pc-zone-editor__image-name"></p>'
				+ '</div>'
				+ '</div>';
			// The picture takes the room; the settings sit on the right (below on narrow screens).
			return '<div class="mkl-pc-zone-editor">'
				+ '<div class="mkl-pc-zone-editor__viewport">'
				+ '<p class="mkl-pc-zone-editor__empty">' + _.escape( lang( 'no_image', 'Choose the view\'s image to draw the zone on it.' ) ) + '</p>'
				+ '<div class="mkl-pc-zone-editor__stage">'
				+ '<img class="mkl-pc-zone-editor__picture" alt="">'
				+ '<div class="mkl-pc-zone-editor__background"></div>'
				+ ( this.options.mask_url ? '<img class="mkl-pc-zone-editor__mask" alt="" src="' + _.escape( this.options.mask_url ) + '">' : '' )
				+ '<div class="mkl-pc-zone-editor__zone" tabindex="0" role="group" aria-label="' + _.escape( lang( 'zone', 'Zone' ) ) + '">'
				+ '<div class="mkl-pc-zone-editor__inner"></div>' + handles
				+ '</div>'
				+ '</div>'
				+ '</div>'
				+ toolbar
				+ '<div class="mkl-pc-admin-dialog__footer-actions">'
				+ '<button type="button" class="button button-primary mkl-pc-zone-editor__done">' + _.escape( lang( 'done', 'Done' ) ) + '</button>'
				+ '<button type="button" class="button mkl-pc-zone-editor__cancel">' + _.escape( lang( 'cancel', 'Cancel' ) ) + '</button>'
				+ '</div>'
				+ '</div>';
		},

		/*
		 * The view's image.
		 * ------------------------------------------------------------------ */

		pick_image: function( event ) {
			event.preventDefault();
			var options = { el: this.$el };
			if ( this.zone.ref_image && this.zone.ref_image.id ) options.selection = this.zone.ref_image.id;
			PC.media.open( options );
		},

		select_image: function( event, attachment ) {
			event.stopPropagation();
			if ( ! attachment ) return;
			var previous = this.zone.ref_image;
			var ref_image = {
				url: attachment.get( 'url' ),
				id: attachment.id,
				width: parseInt( attachment.get( 'width' ), 10 ) || 0,
				height: parseInt( attachment.get( 'height' ), 10 ) || 0,
			};
			if ( ! ref_image.width || ! ref_image.height ) return;
			// Another size: the zone keeps its place relative to the image.
			if ( this.zone.position && previous && previous.width && previous.height ) {
				this.zone.position = PC.views.zone_editor.rescale( this.zone.position, previous, ref_image );
			}
			this.zone.ref_image = ref_image;
			// An image chosen on purpose: that is what the zone is drawn on.
			this.use_background = false;
			this.show_image();
		},

		show_image: function() {
			var ref_image = this.zone.ref_image;
			var has_image = !! ( ref_image && ref_image.url );
			this.$( '.mkl-pc-admin-dialog' ).toggleClass( 'has-image', has_image );
			this.$( '.mkl-pc-zone-editor__image-name' ).text( has_image ? PC.views.zone_editor.file_name( ref_image.url ) : '' );
			this.show_background( has_image && this.use_background );
			if ( ! has_image ) return;
			var that = this;
			this.$picture.one( 'load', function() {
				that.ensure_position().then( function() {
					that.layout();
				} );
			} ).attr( 'src', ref_image.url );
		},

		/**
		 * The view's default configuration, drawn by the Image order preview over the
		 * reference image's box (the image itself stays, invisible, for the size).
		 */
		show_background: function( on ) {
			this.$( '.mkl-pc-admin-dialog' ).toggleClass( 'has-background', !! on );
			if ( ! on ) {
				if ( this.background ) this.background.remove();
				this.background = null;
				return;
			}
			if ( this.background ) return;
			try {
				this.background = new PC.views.image_order_preview( {
					angle_id: this.options.angle_id,
					max_size: 1200,
				} );
				this.$( '.mkl-pc-zone-editor__background' ).append( this.background.$el );
			} catch ( error ) {
				console.log( 'Product configurator: the view could not be previewed under the zone.', error );
				this.background = null;
				this.$( '.mkl-pc-admin-dialog' ).removeClass( 'has-background' );
			}
		},

		/**
		 * A zone without a position starts on the mask's opaque box, or centred.
		 *
		 * @return {Promise}
		 */
		ensure_position: function() {
			var that = this;
			var ref_image = this.zone.ref_image;
			if ( this.zone.position || ! ref_image ) return Promise.resolve();
			var centred = function() {
				that.zone.position = that.zone.position || PC.views.zone_editor.default_position( ref_image );
			};
			if ( ! this.options.mask_url ) {
				centred();
				return Promise.resolve();
			}
			return PC.views.zone_editor.mask_box( this.options.mask_url, ref_image ).then( function( box ) {
				if ( box ) that.zone.position = box;
				centred();
			}, centred );
		},

		/*
		 * Drawing.
		 * ------------------------------------------------------------------ */

		layout: function() {
			var ref_image = this.zone.ref_image;
			if ( ! ref_image || ! ref_image.width || ! this.$picture.length ) return;
			var shown = this.$picture.width();
			if ( ! shown ) return;
			this.scale = shown / ref_image.width;
			this.draw();
		},

		draw: function() {
			var position = this.zone.position;
			if ( ! position ) return;
			var scale = this.scale;
			this.$zone.css( {
				left: ( position.x - position.width / 2 ) * scale + 'px',
				top: position.y * scale + 'px',
				width: position.width * scale + 'px',
				height: position.height * scale + 'px',
				transform: 'rotate(' + ( parseFloat( position.rotation ) || 0 ) + 'deg)',
			} );
			var focused = document.activeElement;
			this.$( '.mkl-pc-zone-editor__field input' ).each( function() {
				if ( this === focused ) return;
				var value = position[ this.getAttribute( 'data-field' ) ];
				this.value = Math.round( parseFloat( value ) || 0 );
			} );
			var $inner = this.$( '.mkl-pc-zone-editor__inner' );
			if ( this.options.decorate ) {
				try {
					this.options.decorate( $inner, this.zone );
				} catch ( error ) {
					console.log( 'Product configurator: the zone preview could not be drawn.', error );
				}
			}
			wp.hooks.doAction( 'PC.admin.zone_editor.render', this );
		},

		set_position: function( position ) {
			this.zone.position = PC.views.zone_editor.clamp( position );
			this.draw();
		},

		/*
		 * Editing.
		 * ------------------------------------------------------------------ */

		field_changed: function( event ) {
			if ( ! this.zone.position ) return;
			var name = event.currentTarget.getAttribute( 'data-field' );
			var value = parseFloat( event.currentTarget.value );
			if ( isNaN( value ) ) return;
			var position = _.clone( this.zone.position );
			position[ name ] = value;
			this.set_position( position );
		},

		pointer_down: function( event ) {
			var original = event.originalEvent || event;
			if ( ! this.zone.position || ( original.button && 0 !== original.button ) ) return;
			event.preventDefault();
			this.$zone.trigger( 'focus' );
			this.drag = {
				handle: $( original.target ).closest( '.mkl-pc-zone-editor__handle' ).data( 'handle' ) || null,
				start_x: original.clientX,
				start_y: original.clientY,
				start: _.clone( this.zone.position ),
			};
			this.$( '.mkl-pc-admin-dialog' ).addClass( 'is-dragging' );
			window.addEventListener( 'pointermove', this._on_move );
			window.addEventListener( 'pointerup', this._on_up );
			window.addEventListener( 'pointercancel', this._on_up );
		},

		pointer_move: function( event ) {
			if ( ! this.drag ) return;
			var dx = ( event.clientX - this.drag.start_x ) / this.scale;
			var dy = ( event.clientY - this.drag.start_y ) / this.scale;
			var statics = PC.views.zone_editor;
			this.set_position( this.drag.handle
				? statics.resize( this.drag.start, this.drag.handle, dx, dy )
				: statics.move( this.drag.start, dx, dy ) );
		},

		pointer_up: function() {
			this.drag = null;
			this.$( '.mkl-pc-admin-dialog' ).removeClass( 'is-dragging' );
			window.removeEventListener( 'pointermove', this._on_move );
			window.removeEventListener( 'pointerup', this._on_up );
			window.removeEventListener( 'pointercancel', this._on_up );
		},

		key_down: function( event ) {
			var moves = { 37: [ -1, 0 ], 38: [ 0, -1 ], 39: [ 1, 0 ], 40: [ 0, 1 ] };
			var move = moves[ event.keyCode ];
			if ( ! move || ! this.zone.position ) return;
			event.preventDefault();
			var step = event.shiftKey ? 10 : 1;
			this.set_position( PC.views.zone_editor.move( this.zone.position, move[ 0 ] * step, move[ 1 ] * step ) );
		},

		done: function( event ) {
			if ( event ) event.preventDefault();
			if ( this.options.save && this.zone.ref_image && this.zone.position ) {
				this.options.save( {
					ref_image: _.clone( this.zone.ref_image ),
					position: PC.views.zone_editor.rounded( this.zone.position ),
				} );
			}
			this.close();
		},

		close: function( event ) {
			this.pointer_up();
			this.show_background( false );
			$( window ).off( 'resize.mklPcZoneEditor_' + this.cid );
			return PC.views.admin_dialog.prototype.close.call( this, event );
		},
	}, {

		/*
		 * Geometry, in the reference image's pixels. (x, y) is the top centre;
		 * the zone turns around it.
		 * ------------------------------------------------------------------ */

		/**
		 * Centred, half the image's width and height.
		 */
		default_position: function( ref_image ) {
			var width = Math.round( ref_image.width / 2 );
			var height = Math.round( ref_image.height / 2 );
			return { x: Math.round( ref_image.width / 2 ), y: Math.round( ( ref_image.height - height ) / 2 ), width: width, height: height, rotation: 0 };
		},

		move: function( position, dx, dy ) {
			return _.extend( {}, position, { x: position.x + dx, y: position.y + dy } );
		},

		/**
		 * Drag a handle by (dx, dy), given in the image's axes. The opposite edges stay
		 * where they are, in the zone's own (turned) frame.
		 *
		 * @param {Object} position
		 * @param {String} handle n, ne, e, se, s, sw, w or nw
		 * @param {Number} dx
		 * @param {Number} dy
		 * @return {Object}
		 */
		resize: function( position, handle, dx, dy ) {
			var radians = ( parseFloat( position.rotation ) || 0 ) * Math.PI / 180;
			var cos = Math.cos( radians );
			var sin = Math.sin( radians );
			// The drag in the zone's frame.
			var local_x = dx * cos + dy * sin;
			var local_y = -dx * sin + dy * cos;
			// Edges in the zone's frame, the top centre at the origin.
			var left = -position.width / 2;
			var right = position.width / 2;
			var top = 0;
			var bottom = position.height;
			if ( -1 !== handle.indexOf( 'w' ) ) left = Math.min( left + local_x, right - MIN_SIZE );
			if ( -1 !== handle.indexOf( 'e' ) ) right = Math.max( right + local_x, left + MIN_SIZE );
			if ( -1 !== handle.indexOf( 'n' ) ) top = Math.min( top + local_y, bottom - MIN_SIZE );
			if ( -1 !== handle.indexOf( 's' ) ) bottom = Math.max( bottom + local_y, top + MIN_SIZE );
			// The new top centre, back in the image's axes.
			var anchor_x = ( left + right ) / 2;
			var anchor_y = top;
			return _.extend( {}, position, {
				x: position.x + anchor_x * cos - anchor_y * sin,
				y: position.y + anchor_x * sin + anchor_y * cos,
				width: right - left,
				height: bottom - top,
			} );
		},

		/**
		 * Keep the same place relative to an image of another size.
		 */
		rescale: function( position, from, to ) {
			var sx = to.width / from.width;
			var sy = to.height / from.height;
			return _.extend( {}, position, {
				x: position.x * sx,
				y: position.y * sy,
				width: position.width * sx,
				height: position.height * sy,
			} );
		},

		/**
		 * At least MIN_SIZE wide and high; the rotation between -180 and 180.
		 */
		clamp: function( position ) {
			var rotation = ( ( ( parseFloat( position.rotation ) || 0 ) % 360 ) + 360 ) % 360;
			if ( rotation > 180 ) rotation -= 360;
			return _.extend( {}, position, {
				width: Math.max( MIN_SIZE, parseFloat( position.width ) || MIN_SIZE ),
				height: Math.max( MIN_SIZE, parseFloat( position.height ) || MIN_SIZE ),
				rotation: rotation,
			} );
		},

		rounded: function( position ) {
			return {
				x: Math.round( position.x ),
				y: Math.round( position.y ),
				width: Math.round( position.width ),
				height: Math.round( position.height ),
				rotation: Math.round( ( parseFloat( position.rotation ) || 0 ) * 10 ) / 10,
			};
		},

		/**
		 * The box around the opaque pixels of an alpha image, as a zone position, or
		 * null when nothing is opaque.
		 *
		 * @param {Uint8ClampedArray|Array} data RGBA
		 * @param {Number} width
		 * @param {Number} height
		 * @param {Number} [threshold] Alpha above which a pixel counts (0-255).
		 * @return {Object|null}
		 */
		alpha_box: function( data, width, height, threshold ) {
			threshold = undefined === threshold ? 8 : threshold;
			var min_x = width;
			var min_y = height;
			var max_x = -1;
			var max_y = -1;
			for ( var y = 0; y < height; y++ ) {
				for ( var x = 0; x < width; x++ ) {
					if ( data[ ( y * width + x ) * 4 + 3 ] <= threshold ) continue;
					if ( x < min_x ) min_x = x;
					if ( x > max_x ) max_x = x;
					if ( y < min_y ) min_y = y;
					if ( y > max_y ) max_y = y;
				}
			}
			if ( max_x < 0 ) return null;
			var box_width = max_x - min_x + 1;
			return { x: min_x + box_width / 2, y: min_y, width: box_width, height: max_y - min_y + 1, rotation: 0 };
		},

		/**
		 * The zone position around a mask's opaque pixels, in the reference image's
		 * pixels (the mask is centred on the image, as everywhere masks are drawn).
		 *
		 * @return {Promise<Object|null>}
		 */
		mask_box: function( url, ref_image ) {
			return new Promise( function( resolve ) {
				var image = new Image();
				image.crossOrigin = 'anonymous';
				image.onload = function() {
					try {
						var canvas = document.createElement( 'canvas' );
						canvas.width = image.naturalWidth;
						canvas.height = image.naturalHeight;
						var context = canvas.getContext( '2d' );
						context.drawImage( image, 0, 0 );
						var data = context.getImageData( 0, 0, canvas.width, canvas.height ).data;
						var box = PC.views.zone_editor.alpha_box( data, canvas.width, canvas.height );
						if ( box ) {
							box.x += ( ref_image.width - canvas.width ) / 2;
							box.y += ( ref_image.height - canvas.height ) / 2;
						}
						resolve( box );
					} catch ( error ) {
						resolve( null );
					}
				};
				image.onerror = function() {
					resolve( null );
				};
				image.src = url;
			} );
		},

		file_name: function( url ) {
			var name = String( url || '' ).split( /[?#]/ )[ 0 ].split( '/' ).pop();
			try {
				return decodeURIComponent( name );
			} catch ( error ) {
				return name;
			}
		},
	} );
} )( jQuery, PC._us || window._ );
