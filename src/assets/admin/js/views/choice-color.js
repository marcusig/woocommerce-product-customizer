/*
	PC.views.choice_color_hint
	-> On the choice form, under "Color hex code", when the layer draws choice colours in the
	   viewer (`draw_choice_color`, docs/solid-colour-choices-spec.md):
	   - a warning when the value is not a hex code the viewers can draw (it stays a swatch);
	   - a hint that an image on a view replaces the colour there.
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
