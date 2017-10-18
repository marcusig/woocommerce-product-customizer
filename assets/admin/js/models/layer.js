var PC = PC || {};
// PC.model = PC.model || {};


PC.layer = Backbone.Model.extend({ 
	idAttribute: '_id',
	defaults: {
		_id: 0,
		name: '',
		description: '',
		order:0,
		image: {
			url:'',
			id: null,
		},
		not_a_choice: false,
	},
	sync: function( method, model, options ) {
		// console.log('layer.sync');
		// console.log(method, model, options);
	}
})