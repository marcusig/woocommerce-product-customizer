var PC = PC || {};
// PC.model = PC.model || {};

( function( _ ) {
	PC.layers = Backbone.Collection.extend({
		url: function() { 
			var url = ajaxurl + '?action='+PC.actionParameter+'&data=layers';
			if ( this.product_id ) url += '&id='+this.product_id;
			return url;
		},
		model: PC.layer,
		initialize: function( data, options ) {
			if ( options && options.product_id ) {
				this.product_id = options.product_id;
			} 
		},
		nextOrder: function( order_name ) {
			if ( ! order_name ) order_name = 'order';
			if ( ! this.length ) {
				return 1;
			}
			return parseInt( this.last().get( order_name ) ) + 1;
		},
		comparator: function( layer ) {
			if ( this.orderBy ) {
				return layer.get( this.orderBy );
			}
			return layer.get('order');
		},

		sync: function( method, model, options ) {
		},

		create_layer: function( data ) {
			var m = _.extend( data, {
				_id: PC.app.get_new_id( this ),
				order: this.nextOrder(),
				image_order: this.nextOrder( 'image_order' ),
				active: true
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
