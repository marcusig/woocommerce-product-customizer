var PC = PC || {};

PC.states = Backbone.Collection.extend({
	url: function() { return ajaxurl + '?action='+PC.actionParameter+'&data=menu' },
	model: PC.state,
	initialize: function() {
		// console.log(ajaxurl);
		// console.log('this.ajaxSettings:');
		// console.log(this.ajaxSettings);
	}
});

// PC.menus = Backbone.Collection.extend({
// 	model: PC.menu,
// });
