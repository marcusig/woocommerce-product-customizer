var PC = PC || {};

PC.states = Backbone.Collection.extend({
	url: function() { return ajaxurl + '?action='+PC.actionParameter+'&data=menu' },
	model: PC.state,
	initialize: function() {
	},
	comparator: function( layer ) {
	   	return layer.get( 'order' );
    },
});

// PC.menus = Backbone.Collection.extend({
// 	model: PC.menu,
// });
