/*
	PC.fe.layer_masks
	-> Layer masks in the <img> stack: which mask a layer cuts its images with on
	   an angle, loading each mask once, and the CSS that applies it. See
	   docs/layer-masks-spec.md.

	A layer's `masks` is a list shaped like a choice's `images`:
	[ { angleId, image: { id, url, dimensions } } ]. An angle without an entry
	draws the layer unmasked.
*/
PC.fe.layer_masks = {

	/**
	 * Loads by URL: Promise<HTMLImageElement|null>.
	 */
	loads: {},

	/**
	 * The mask image of a layer on an angle.
	 *
	 * @param {Backbone.Model} layer
	 * @param {Number|String}  angle_id
	 * @return {Object|null} { id, url, dimensions }
	 */
	get: function( layer, angle_id ) {
		var masks = layer && layer.get( 'masks' );
		if ( ! _.isArray( masks ) || undefined === angle_id || null === angle_id ) return null;
		var mask = _.find( masks, function( item ) {
			return item && String( item.angleId ) === String( angle_id );
		} );
		return mask && mask.image && mask.image.url ? mask.image : null;
	},

	/**
	 * Load a mask once per page. Resolves the image, or null when it cannot be
	 * used: the layer is then drawn unmasked (decision 6 of the spec), which is
	 * easier to notice and debug than a layer that disappears.
	 *
	 * Loaded in CORS mode, like browsers fetch CSS mask images: a mask on another
	 * domain without CORS headers fails here exactly where the CSS mask would
	 * have hidden the image.
	 *
	 * @param {String} url
	 * @return {Promise<HTMLImageElement|null>}
	 */
	load: function( url ) {
		if ( this.loads[ url ] ) return this.loads[ url ];
		this.loads[ url ] = new Promise( function( resolve ) {
			var image = new Image();
			image.crossOrigin = 'anonymous';
			image.onload = function() {
				resolve( image );
			};
			image.onerror = function() {
				console.log( 'Product configurator: the layer mask ' + url + ' could not be loaded, the layer is drawn unmasked.' );
				resolve( null );
			};
			image.src = url;
		} );
		return this.loads[ url ];
	},

	/**
	 * Set the CSS mask of an element, or clear it with a falsy url.
	 *
	 * `contain` + `center`: the core themes size a layer image's box to the drawn
	 * image, so a mask of the same proportions covers it exactly (also under
	 * `object-fit: contain`). Both spellings: Safari before 15.4 only knows the
	 * prefixed ones.
	 *
	 * @param {HTMLElement} el
	 * @param {String|null} url
	 */
	apply: function( el, url ) {
		var value = url ? 'url("' + String( url ).replace( /"/g, '%22' ) + '")' : '';
		_.each( [ '', '-webkit-' ], function( prefix ) {
			el.style.setProperty( prefix + 'mask-image', value );
			el.style.setProperty( prefix + 'mask-size', url ? 'contain' : '' );
			el.style.setProperty( prefix + 'mask-position', url ? 'center' : '' );
			el.style.setProperty( prefix + 'mask-repeat', url ? 'no-repeat' : '' );
		} );
	},

	/**
	 * Give a layer view's <img> its src, masked for the active angle.
	 *
	 * With a mask, the src is only set once the mask is loaded and applied: until
	 * then the image keeps its loading state, so the stack never shows it uncut
	 * (a fabric covering a whole shirt), and an image pool keeps the previous
	 * image meanwhile. Without one, the src is set at once, as before.
	 *
	 * The view keeps the loaded mask in `mask_image`, for capture(), and the
	 * URL of the mask last asked for in `mask_url` (mask_changed()).
	 *
	 * @param {Backbone.View}  view     viewer_layer or viewer_static_layer.
	 * @param {Backbone.Model} layer
	 * @param {String}         src
	 * @param {Boolean}        keep_src Only bring the mask in line: the image
	 *                                  already shows src (a static layer with
	 *                                  the same file on another view). Setting
	 *                                  it again could wait for a load event that
	 *                                  never comes.
	 */
	set_src: function( view, layer, src, keep_src ) {
		var token = view.mask_token = {};
		var mask = this.mask_for( layer, src );
		view.mask_url = mask ? mask.url : '';

		if ( ! mask ) {
			if ( view.mask_image || view.el.style.getPropertyValue( 'mask-image' ) || view.el.style.getPropertyValue( '-webkit-mask-image' ) ) this.apply( view.el, null );
			view.mask_image = null;
			if ( ! keep_src ) view.el.src = src;
			return;
		}

		var that = this;
		this.load( mask.url ).then( function( image ) {
			// Asked again meanwhile (an angle change), or gone.
			if ( view.mask_token !== token || view.is_removed || view.is_retired ) return;
			that.apply( view.el, image ? mask.url : null );
			view.mask_image = image;
			if ( ! keep_src ) view.el.src = src;
		} );
	},

	/**
	 * The mask an image of a layer is cut with on the active angle, if any.
	 * The transparent placeholder has nothing to cut.
	 *
	 * @return {Object|null} { id, url, dimensions }
	 */
	mask_for: function( layer, src ) {
		if ( ! src || 0 === src.indexOf( 'data:' ) ) return null;
		var angle = PC.fe.angles.findWhere( { active: true } );
		return this.get( layer, angle && angle.id );
	},

	/**
	 * Whether the mask a view should show on the active angle is not the one
	 * it last asked for.
	 *
	 * @param {Backbone.View}  view
	 * @param {Backbone.Model} layer
	 * @return {Boolean}
	 */
	mask_changed: function( view, layer ) {
		var mask = this.mask_for( layer, view.el.getAttribute( 'src' ) );
		return ( mask ? mask.url : '' ) !== ( view.mask_url || '' );
	},

	/**
	 * Draw an image cut by its mask, for capture(): both stretched to the same
	 * rectangle, as the image alone would be.
	 *
	 * @param {CanvasRenderingContext2D} ctx
	 * @param {HTMLImageElement|HTMLCanvasElement} source
	 * @param {HTMLImageElement} mask
	 * @param {Number} width
	 * @param {Number} height
	 */
	draw_masked: function( ctx, source, mask, width, height ) {
		var scratch = document.createElement( 'canvas' );
		scratch.width = width;
		scratch.height = height;
		var scratch_ctx = scratch.getContext( '2d' );
		scratch_ctx.drawImage( source, 0, 0, width, height );
		scratch_ctx.globalCompositeOperation = 'destination-in';
		scratch_ctx.drawImage( mask, 0, 0, width, height );
		ctx.drawImage( scratch, 0, 0 );
	},
};
