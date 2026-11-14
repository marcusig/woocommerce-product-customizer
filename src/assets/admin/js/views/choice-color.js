/*
	PC.views.choice_color_hint
	-> On the choice form, under "Color hex code", when the layer draws choice colours in the
	   viewer (`draw_choice_color`, docs/solid-colour-choices-spec.md):
	   - a warning when the value is not a hex code the viewers can draw (it stays a swatch);
	   - a hint that an image on a view replaces the colour there.
	-> And, for the admin previews (Image order), copies of the viewers' fill_for() and
	   svg_url() from views/parts/choice-color.js, which is not shipped as a file of its own.
	   choice-color.test.js checks the copies agree.
*/
( function( $ ) {
	PC.views = PC.views || {};

	PC.views.choice_color_hint = {

		/**
		 * '#rgb' or '#rrggbb' as '#rrggbb' in lower case, else ''. The same rule as
		 * PC.fe.choice_color.normalize() and the server's Choice::get_color().
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
		 * What a choice draws as a colour on a view, or null. Same as PC.fe.choice_color.fill_for().
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
		 * The fill as an SVG image URL. Same as PC.fe.choice_color.svg_url().
		 *
		 * @param {Object} fill From fill_for().
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
		 * The messages for a value, given whether its layer draws colours.
		 *
		 * @param {Boolean} draws
		 * @param {*}       value
		 * @return {Object} { warning, hint }
		 */
		messages: function( draws, value ) {
			var lang = window.PC_lang || {};
			if ( ! draws ) return { warning: '', hint: '' };
			var empty = '' === String( null == value ? '' : value ).trim();
			return {
				warning: ! empty && ! this.normalize( value ) ? ( lang.choice_color_not_drawn || 'Only hex codes such as #1e90ff or #19f can be drawn in the viewer.' ) : '',
				hint: lang.choice_color_image_wins || 'On views where this choice has an image, the image is shown instead of the colour.',
			};
		},

		/**
		 * Write the messages into the form's colour setting.
		 *
		 * @param {Backbone.View} view The choice form (PC.views.choiceDetails).
		 */
		update: function( view ) {
			var $setting = view.$( '.setting-id-color' );
			if ( ! $setting.length ) return;
			$setting.find( '.mkl-pc-choice-color__message' ).remove();
			var draws = !! ( view.layer && view.layer.get( 'draw_choice_color' ) );
			var messages = this.messages( draws, view.model.get( 'color' ) );
			if ( messages.hint ) $setting.append( $( '<p class="help mkl-pc-choice-color__message"></p>' ).text( messages.hint ) );
			if ( messages.warning ) $setting.append( $( '<p class="mkl-pc-setting--warning mkl-pc-choice-color__message"></p>' ).text( messages.warning ) );
		},
	};

	wp.hooks.addAction( 'PC.admin.choiceDetails.render', 'mkl/pc/choice_color_hint', function( view ) {
		if ( ! view || ! view.model ) return;
		if ( ! view.choice_color_hint_bound ) {
			view.choice_color_hint_bound = true;
			view.listenTo( view.model, 'change:color', function() {
				PC.views.choice_color_hint.update( view );
			} );
		}
		PC.views.choice_color_hint.update( view );
	} );
} )( jQuery );
