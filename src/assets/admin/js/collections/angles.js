var PC = PC || {};
// PC.model = PC.model || {};

PC.angles = Backbone.Collection.extend( {
	url: function() { 
		var base = PC_lang.rest_url + PC_lang.rest_base + PC.app.id + '/angles?_wpnonce=' + PC_lang.rest_nonce;
		// if ( this.product_id ) url += '&id='+this.product_id;
		return base;
	},
	model: PC.angle, // use the same basic model as the layers
	nextOrder: function() {
		if ( ! this.length ) {
			return 1;
		}
		return this.last().get('order') + 1;
	},
	comparator: function( layer ) {
	   	return layer.get('order');
    },
	sync: PC.sync,
} )