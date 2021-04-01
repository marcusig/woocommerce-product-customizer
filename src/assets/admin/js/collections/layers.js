var PC = PC || {};
// PC.model = PC.model || {};


PC.layers = Backbone.Collection.extend({
	url: function() { return ajaxurl + '?action='+PC.actionParameter+'&data=layers' },
	model: PC.layer, 
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

    
})