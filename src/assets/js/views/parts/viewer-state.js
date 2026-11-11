/*
	PC.fe.viewer_state
	-> What the 2D picture shows, decided from the models alone.

	One rule for every viewer: the <img> stack's image pools, capture(), and the
	canvas viewer. It reads choice `active` and `cshow` (through conditional
	logic when it is installed), never the markup a particular viewer emits.
*/

PC.fe.viewer_state = {

	/**
	 * Whether a layer is hidden by conditional logic, itself or through a group
	 * ancestor.
	 *
	 * @param {Backbone.Model} layer
	 * @return {Boolean}
	 */
	is_layer_hidden: function( layer ) {
		if ( false === layer.get( 'cshow' ) ) return true;
		if ( PC.conditionalLogic && PC.conditionalLogic.parent_is_hidden ) {
			return !! PC.conditionalLogic.parent_is_hidden( layer );
		}
		return false;
	},

	/**
	 * Whether a choice is hidden by conditional logic.
	 *
	 * @param {Backbone.Model} choice
	 * @return {Boolean}
	 */
	is_choice_hidden: function( choice ) {
		if ( PC.conditionalLogic && PC.conditionalLogic.item_is_hidden ) {
			return !! PC.conditionalLogic.item_is_hidden( choice );
		}
		// Conditional logic is not installed: fall back to the plain flags.
		if ( false === choice.get( 'cshow' ) ) return true;
		var layer = PC.fe.layers.get( choice.get( 'layerId' ) );
		return !! ( layer && false === layer.get( 'cshow' ) );
	},

	/**
	 * The choices of one layer that are part of the picture: every active one
	 * (multiple-choice layers can have several), minus groups and anything
	 * conditional logic hides. A static (`not_a_choice`) layer always shows its
	 * one choice, unless the layer itself is hidden.
	 *
	 * Whether a choice has anything to draw is not decided here: callers that
	 * need it ask has_drawable().
	 *
	 * @param {Backbone.Model} layer
	 * @return {Array} choice models, in layer order
	 */
	shown_choices: function( layer ) {
		var choices = PC.fe.getLayerContent( layer.id );
		if ( ! choices ) return [];
		if ( this.is_layer_hidden( layer ) ) return [];

		var shown;
		if ( layer.get( 'not_a_choice' ) ) {
			var first = choices.first();
			shown = first ? [ first ] : [];
		} else {
			var that = this;
			shown = choices.filter( function( choice ) {
				if ( ! choice.get( 'active' ) ) return false;
				if ( choice.get( 'is_group' ) ) return false;
				return ! that.is_choice_hidden( choice );
			} );
		}

		/**
		 * Filter PC.fe.viewer.shown_choices: the choices of a layer drawn in the picture.
		 *
		 * For choices that draw without being selected, such as Form builder's upload fields
		 * shown in the preview (docs/image-overlay-spec.md). Added choices are drawn by
		 * their canvas item; conditional logic still hides them.
		 *
		 * @param {Array}               shown   choice models
		 * @param {Backbone.Model}      layer
		 * @param {Backbone.Collection} choices the layer's choices
		 */
		var filtered = wp.hooks.applyFilters( 'PC.fe.viewer.shown_choices', shown, layer, choices );
		if ( filtered === shown || ! filtered || ! filtered.length ) return filtered || [];
		var hide = this;
		return filtered.filter( function( choice, index ) {
			// Once each, and never what conditional logic hides.
			return filtered.indexOf( choice ) === index && ( -1 !== shown.indexOf( choice ) || ! hide.is_choice_hidden( choice ) );
		} );
	},

	/**
	 * Whether a choice gives a viewer something to draw: an image, or a layer
	 * type that renders itself (the text overlay draws a canvas with no image).
	 *
	 * @param {Backbone.Model} choice
	 * @return {Boolean}
	 */
	has_drawable: function( choice ) {
		return choice.has_image() || !! wp.hooks.applyFilters( 'PC.fe.viewer.item.render.empty.images', false, choice );
	},

	/**
	 * Where a layer sits in a view's picture, bottom first: the view's own order when it has
	 * one (`image_order_by_angle`, a sparse map of angle id to order, set by the Image order
	 * screen; canvas viewer only), else the configurator's `image_order`.
	 *
	 * @param {Backbone.Model} layer
	 * @param {String|Number}  [angle_id]
	 * @return {Number}
	 */
	image_order: function( layer, angle_id ) {
		var own = PC.fe.viewer_state.view_image_order( layer, angle_id );
		if ( null !== own ) return own;
		return parseInt( layer.get( 'image_order' ) ) || 0;
	},

	/**
	 * Views have their own orders only in the canvas viewer: it keeps one stack per view.
	 * The <img> stack keeps the configurator's order (decision, Marc 2026-11-10).
	 */
	has_view_orders: function() {
		var Canvas = PC.fe.views && PC.fe.views.viewer_canvas;
		return !! ( Canvas && Canvas.renderer && 'canvas' === Canvas.renderer() && ! Canvas.disabled );
	},

	/**
	 * The view's own order for a layer, or null.
	 */
	view_image_order: function( layer, angle_id ) {
		if ( undefined === angle_id || null === angle_id ) return null;
		if ( ! PC.fe.viewer_state.has_view_orders() ) return null;
		var map = layer.get( 'image_order_by_angle' );
		if ( ! map || 'object' !== typeof map || ! Object.prototype.hasOwnProperty.call( map, angle_id ) ) return null;
		var value = parseFloat( map[ angle_id ] );
		return isNaN( value ) ? null : value;
	},

	/**
	 * The layers, bottom of the picture first.
	 *
	 * @param {String|Number} [angle_id] The view: its own order when it has one.
	 * @return {Array} layer models
	 */
	layers_in_image_order: function( angle_id ) {
		var state = PC.fe.viewer_state;
		return PC.fe.layers.sortBy( function( layer ) {
			return state.image_order( layer, angle_id );
		} );
	},

	/**
	 * Every choice in the current picture, bottom layer first.
	 *
	 * @param {String|Number} [angle_id] The view: its own order when it has one.
	 * @return {Array} choice models
	 */
	picture: function( angle_id ) {
		var models = [];
		_.each( this.layers_in_image_order( angle_id ), function( layer ) {
			models.push.apply( models, this.shown_choices( layer ) );
		}, this );
		return models;
	}
};
