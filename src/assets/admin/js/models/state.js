var PC = PC || {};
PC.model = PC.model || {};

PC.state = Backbone.Model.extend({
	defaults: {
		label: '', // Laabel for menu
		title:'', // Title for the main modal window
		menu_id:'', 
		description: false,
		type:'part',
		active: false,
	},
	initialize: function() {
	}
});

// PC.model.menu = Backbone.Model.extend({
// 	default: {
// 		name: '',
// 		active: false,
// 	}
// });