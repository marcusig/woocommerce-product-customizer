var PC = PC || {};
// PC.model = PC.model || {};


PC.angles = Backbone.Collection.extend({
	url: function() { return ajaxurl + '?action='+PC.actionParameter+'&data=angles' },
	model: PC.layer, // use the same basic model as the layers
	nextOrder: function() {
		if ( !this.length ) {
			return 1;
		}
		return this.last().get('order') + 1;
	},
	comparator: function( layer ) {
	   	return layer.get('order');
    },
})