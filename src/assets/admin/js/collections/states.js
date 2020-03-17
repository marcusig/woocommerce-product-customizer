var PC = PC || {};

PC.states = Backbone.Collection.extend({
	url: function() { return ajaxurl + '?action='+PC.actionParameter+'&data=menu' },
	model: PC.state,
	initialize: function() {
	}
});

// PC.menus = Backbone.Collection.extend({
// 	model: PC.menu,
// });
