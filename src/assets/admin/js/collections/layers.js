var PC = PC || {};
// PC.model = PC.model || {};

( function( _ ) {
	PC.layers = Backbone.Collection.extend({
		url: function() { 
			var url = ajaxurl + '?action='+PC.actionParameter+'&data=layers';
			if ( this.product_id ) url += '&id='+this.product_id;
			return url + PC.get_ajax_nonce_param();
		},
		model: PC.layer,
		initialize: function( data, options ) {
			if ( options && options.product_id ) {
				this.product_id = options.product_id;
			} 
		},
		/**
		 * The highest value of an order attribute across the collection.
		 *
		 * @param {String} order_name
		 * @return {Number}
		 */
		maxOrder: function( order_name ) {
			var max = 0;
			this.each( function( m ) {
				var value = parseFloat( m.get( order_name ) );
				if ( ! isNaN( value ) && value > max ) max = value;
			} );
			return max;
		},
		/**
		 * The next value for an order attribute.
		 *
		 * Taken from the highest value rather than from `last()`: `last()` is only the
		 * highest while the collection happens to be sorted by that same attribute, and
		 * it is sorted by `image_order` whenever the layers list is arranging the stack.
		 *
		 * @param {String} [order_name]
		 * @return {Number}
		 */
		nextOrder: function( order_name ) {
			if ( ! order_name ) order_name = 'order';
			if ( ! this.length ) {
				return 1;
			}
			return this.maxOrder( order_name ) + 1;
		},
		/**
		 * The `image_order` to give a new layer.
		 *
		 * 0 while the images still follow the menu, because any non-zero value here
		 * would flip the whole configurator onto image order in the frontend viewer
		 * (`add_layers()` in views/parts/viewer.js switches as soon as one layer has a
		 * value) - with every existing layer still at 0, and their stacking then
		 * decided by nothing at all. Once a stack really exists, a new layer goes in
		 * front of it.
		 *
		 * @return {Number}
		 */
		next_image_order: function() {
			var max = this.maxOrder( 'image_order' );
			return max > 0 ? max + 1 : 0;
		},
		/**
		 * The views' own orders to give a new layer: in front, in each view that has one
		 * (`image_order_by_angle`). Null when no view has its own order.
		 *
		 * @return {Object|null}
		 */
		next_image_order_by_angle: function() {
			var next = {};
			this.each( function( layer ) {
				var own = layer.get( 'image_order_by_angle' );
				if ( ! own || 'object' !== typeof own ) return;
				_.each( own, function( value, angle_id ) {
					value = parseFloat( value );
					if ( isNaN( value ) ) return;
					if ( ! _.has( next, angle_id ) || value + 1 > next[ angle_id ] ) next[ angle_id ] = value + 1;
				} );
			} );
			return _.isEmpty( next ) ? null : next;
		},
		comparator: function( layer ) {
			var value = parseFloat( layer.get( this.orderBy || 'order' ) );
			// Stored values come back as strings, and the floating add button inserts
			// at x.5, so this has to be a number and it cannot be an integer.
			return isNaN( value ) ? 0 : value;
		},

		sync: function( method, model, options ) {
		},

		/**
		 * Attributes for a layer added by duplicating or pasting one.
		 *
		 * A link to a global layer stays a link: the copy keeps `is_global` and `global_id`
		 * (and any per-link overrides). It can still be disconnected afterwards. A layer that
		 * is not a link is stored as its own data.
		 *
		 * @param {Object} data Source layer attributes.
		 * @return {Object}
		 */
		create_layer: function( data ) {
			data = data || {};
			var keep_global = !! ( data.is_global && data.global_id );
			var global_id = keep_global ? data.global_id : null;
			var new_id = PC.app.get_new_id( this );
			var layer = _.extend( data, {
				_id: new_id,
				id: new_id,
				order: this.nextOrder(),
				image_order: this.next_image_order(),
				image_order_by_angle: this.next_image_order_by_angle() || undefined,
				active: true,
				is_global: keep_global,
				global_id: global_id
			} );
			if ( ! keep_global ) {
				delete layer.overrides;
			}
			return layer;
		},
		get_children: function( model ) {
			if ( model.children ) return model.children;
			var children = this.where( { parent: model.id } );
			if ( children.length ) {
				_.each( children, function( layer ) {
					var other_chilren = this.get_children( layer );
					if ( other_chilren.count ) {
						children = children.concat( other_chilren );
					}
				}.bind( this ) );
			}
			// Cache the value
			model.children = children;
			return model.children;
		}
	} )
} ( PC._us || window._ ) )
