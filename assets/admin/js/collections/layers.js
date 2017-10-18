var PC = PC || {};
// PC.model = PC.model || {};


PC.layers = Backbone.Collection.extend({
	url: function() { return ajaxurl + '?action='+PC.actionParameter+'&data=layers' },
	model: PC.layer, 
	nextOrder: function() {
		if ( !this.length ) {
			return 1;
		}
		return parseInt( this.last().get('order') ) + 1;
	},
	comparator: function( layer ) {
	   	return layer.get('order');
    },

    sync: function( method, model, options ) {
    	// console.log('layers.sync');
    	// console.log(method, model, options);
    },

    
})