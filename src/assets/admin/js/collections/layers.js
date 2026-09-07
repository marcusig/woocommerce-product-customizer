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
		comparator: function( layer ) {
			var value = parseFloat( layer.get( this.orderBy || 'order' ) );
			// Stored values come back as strings, and the floating add button inserts
			// at x.5, so this has to be a number and it cannot be an integer.
			return isNaN( value ) ? 0 : value;
		},

		sync: function( method, model, options ) {
		},

		create_layer: function( data ) {
			var m = _.extend( data, {
				_id: PC.app.get_new_id( this ),
				order: this.nextOrder(),
				image_order: this.next_image_order(),
				active: true,
				is_global: false,
				global_id: null
			} );
			return m;
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
