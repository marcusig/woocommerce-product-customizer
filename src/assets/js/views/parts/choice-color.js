/*
	PC.fe.choice_color
	-> Solid-colour choices: a choice with no image on a view fills its layer's mask with its
	   colour hex code, when the layer has `draw_choice_color` on. One rule for the <img>
	   stack, the canvas viewer and the admin previews. See docs/solid-colour-choices-spec.md.
*/
PC.fe.choice_color = {

	/**
	 * '#rgb' or '#rrggbb' as '#rrggbb' in lower case, else ''. Other CSS colours stay
	 * swatch-only (decision 5 of the spec). Same rule as the admin's
	 * PC.views.choice_color_hint.normalize() and the server's Choice::get_color().
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
	 * What a choice draws as a colour on a view, or null when it draws no colour there:
	 * - its layer has `draw_choice_color` on (simple and multiple layers only);
	 * - it has no image on the view (an image wins, decision 4);
	 * - its colour is a hex code;
	 * - the layer has a mask on the view, with its size: the fill takes the mask's size.
	 *
	 * @param {Backbone.Model} choice
	 * @param {Number|String}  [angle_id] The active view by default.
	 * @return {Object|null} { color, mask: { id, url, dimensions }, width, height }
	 */
	fill: function( choice, angle_id ) {
		if ( ! choice || choice.get( 'is_group' ) ) return null;
		var layer = PC.fe.layers && PC.fe.layers.get( choice.get( 'layerId' ) );
		if ( ! layer || ! layer.get( 'draw_choice_color' ) || layer.get( 'not_a_choice' ) ) return null;
		var type = layer.get( 'type' );
		if ( 'simple' !== type && 'multiple' !== type ) return null;

		angle_id = this.angle_id( angle_id );
		if ( null === angle_id ) return null;

		if ( this.has_image_on( choice, angle_id ) ) return null;

		var color = this.normalize( choice.get( 'color' ) );
		if ( ! color ) return null;

		var mask = PC.fe.layer_masks ? PC.fe.layer_masks.get( layer, angle_id ) : null;
		var width = mask && mask.dimensions ? parseInt( mask.dimensions.width, 10 ) : 0;
		var height = mask && mask.dimensions ? parseInt( mask.dimensions.height, 10 ) : 0;
		if ( ! mask || ! ( width > 0 ) || ! ( height > 0 ) ) return null;

		return { color: color, mask: mask, width: width, height: height };
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

	/**
	 * Whether the choice has an image on that very view. Not get_image(), which reads the
	 * active view when the one asked for is unknown.
	 */
	has_image_on: function( choice, angle_id ) {
		var images = choice.get( 'images' );
		if ( ! images ) return false;
		var picture = images.get ? images.get( angle_id ) : null;
		if ( ! picture && images.find ) {
			picture = images.find( function( model ) {
				var id = model.get ? model.get( 'angleId' ) : model.angleId;
				return String( id ) === String( angle_id );
			} );
		}
		var image = picture ? ( picture.get ? picture.get( 'image' ) : picture.image ) : null;
		return !! ( image && image.url );
	},
};
