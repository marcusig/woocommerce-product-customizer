/*
	PC.fe.choice_color
	-> Solid-colour choices: a choice with no image on a view fills its layer's mask with its
	   colour hex code, when the layer has `draw_choice_color` on. One rule for the <img>
	   stack, the canvas viewer and the server. See docs/solid-colour-choices-spec.md.

	The admin keeps a copy of normalize(), fill_for() and svg_url() in
	admin/js/views/choice-color.js (PC.views.choice_color_hint) for its previews: these parts
	are not shipped as files of their own. choice-color.test.js checks both copies agree.
*/
PC.fe.choice_color = {

	/**
	 * '#rgb' or '#rrggbb' as '#rrggbb' in lower case, else ''. Other CSS colours stay
	 * swatch-only (decision 5 of the spec). Same rule as the server's Configuration::
	 * normalize_color().
	 *
	 * @param {*} value
	 * @return {String}
	 */
	normalize: function( value ) {
		var hex = String( null == value ? '' : value ).trim().toLowerCase();
		if ( /^#[0-9a-f]{6}$/.test( hex ) ) return hex;
		if ( /^#[0-9a-f]{3}$/.test( hex ) ) return '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
		return '';
	},

	/**
	 * What a choice draws as a colour on a view, or null when it draws no colour there.
	 *
	 * @param {Backbone.Model} choice
	 * @param {Number|String}  [angle_id] The active view by default.
	 * @return {Object|null} { color, mask: { id, url, dimensions }, width, height }
	 */
	fill: function( choice, angle_id ) {
		if ( ! choice ) return null;
		var layer = PC.fe.layers && PC.fe.layers.get( choice.get( 'layerId' ) );
		angle_id = this.angle_id( angle_id );
		if ( null === angle_id ) return null;
		return this.fill_for( layer, choice, angle_id );
	},

	/**
	 * The rule, given the layer and the view:
	 * - the layer has `draw_choice_color` on (simple and multiple layers only);
	 * - the choice has no image on the view (an image wins, decision 4);
	 * - its colour is a hex code;
	 * - the layer has a mask on the view, with its size: the fill takes the mask's size.
	 *
	 * @param {Backbone.Model} layer
	 * @param {Backbone.Model} choice
	 * @param {Number|String}  angle_id
	 * @return {Object|null} { color, mask: { id, url, dimensions }, width, height }
	 */
	fill_for: function( layer, choice, angle_id ) {
		if ( ! layer || ! choice || choice.get( 'is_group' ) ) return null;
		if ( ! layer.get( 'draw_choice_color' ) || layer.get( 'not_a_choice' ) ) return null;
		var type = layer.get( 'type' );
		if ( 'simple' !== type && 'multiple' !== type ) return null;
		if ( undefined === angle_id || null === angle_id || '' === angle_id ) return null;

		var images = choice.get( 'images' );
		var picture = null;
		if ( images && images.get ) picture = images.get( angle_id );
		if ( ! picture && images && images.find ) {
			picture = images.find( function( model ) {
				var id = model.get ? model.get( 'angleId' ) : model.angleId;
				return String( id ) === String( angle_id );
			} );
		}
		var image = picture ? ( picture.get ? picture.get( 'image' ) : picture.image ) : null;
		if ( image && image.url ) return null;

		var color = this.normalize( choice.get( 'color' ) );
		if ( ! color ) return null;

		var masks = layer.get( 'masks' );
		var entry = null;
		for ( var i = 0; masks && i < masks.length; i++ ) {
			if ( masks[ i ] && String( masks[ i ].angleId ) === String( angle_id ) ) {
				entry = masks[ i ];
				break;
			}
		}
		var mask = entry && entry.image && entry.image.url ? entry.image : null;
		var width = mask && mask.dimensions ? parseInt( mask.dimensions.width, 10 ) : 0;
		var height = mask && mask.dimensions ? parseInt( mask.dimensions.height, 10 ) : 0;
		if ( ! mask || ! ( width > 0 ) || ! ( height > 0 ) ) return null;

		return { color: color, mask: mask, width: width, height: height };
	},

	/**
	 * The fill as an image URL: an SVG of the mask's size holding one rectangle. Vector, so
	 * the browser draws it at the size it is shown and keeps no full-size bitmap (decision 2).
	 * Its width and height make the <img> the mask's size, which themes then fit like any
	 * layer image, so the CSS mask lies over it.
	 *
	 * @param {Object} fill From fill().
	 * @return {String}
	 */
	svg_url: function( fill ) {
		var w = fill.width, h = fill.height;
		return 'data:image/svg+xml,' + encodeURIComponent(
			'<svg xmlns="http://www.w3.org/2000/svg" data-pc-color="' + fill.color + '" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '" shape-rendering="crispEdges">' +
			'<rect width="' + w + '" height="' + h + '" fill="' + fill.color + '"/></svg>'
		);
	},

	/**
	 * Whether a src is a fill from svg_url() (it is cut by the layer's mask, unlike the
	 * transparent placeholder and other data URLs).
	 *
	 * @param {String} src
	 * @return {Boolean}
	 */
	is_fill_url: function( src ) {
		return 'string' === typeof src && 0 === src.indexOf( 'data:image/svg+xml,' + encodeURIComponent( '<svg xmlns="http://www.w3.org/2000/svg" data-pc-color=' ) );
	},

	/**
	 * The fill as a canvas, for capture(): drawn with fillRect rather than from the SVG, so
	 * no browser can count it as tainting the capture.
	 *
	 * @param {Object} fill From fill().
	 * @return {HTMLCanvasElement}
	 */
	fill_canvas: function( fill ) {
		var canvas = document.createElement( 'canvas' );
		canvas.width = fill.width;
		canvas.height = fill.height;
		var ctx = canvas.getContext( '2d' );
		ctx.fillStyle = fill.color;
		ctx.fillRect( 0, 0, fill.width, fill.height );
		return canvas;
	},

	/**
	 * The `image` a choice is saved with: its image id, or `s<rrggbb>` when it draws its
	 * colour on that view. The server merges that token like an image (Configuration::
	 * parse_color_image()), and stored configurations keep it, so past orders keep their colour.
	 *
	 * @param Backbone.Model  choice
	 * @param {Number|String} [angle_id]
	 * @return {Number|String} The image id, the colour token, or '' / undefined for none.
	 */
	saved_image: function( choice, angle_id ) {
		var img_id = choice.get_image( 'image', 'id', angle_id );
		if ( img_id ) return img_id;
		var fill = this.fill( choice, angle_id );
		return fill ? 's' + fill.color.slice( 1 ) : img_id;
	},

	/**
	 * Whether a choice draws a colour on any view.
	 *
	 * @param {Backbone.Model} choice
	 * @return {Boolean}
	 */
	has_fill: function( choice ) {
		if ( ! PC.fe.angles ) return false;
		var self = this;
		return !! PC.fe.angles.find( function( angle ) {
			return !! self.fill( choice, angle.id );
		} );
	},

	/**
	 * The view asked for, else the active one, else the first; null when there are none.
	 */
	angle_id: function( angle_id ) {
		if ( undefined !== angle_id && null !== angle_id && '' !== angle_id ) return angle_id;
		if ( ! PC.fe.angles ) return null;
		var angle = PC.fe.angles.findWhere( { active: true } ) || PC.fe.angles.first();
		return angle ? angle.id : null;
	},
};
