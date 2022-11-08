var PC = PC || {};
// PC.model = PC.model || {};


PC.angle = PC.layer.extend({ 
	url: function() {
		return '';
	},
	idAttribute: '_id',
	defaults: {
		_id: 0,
		name: '',
		description: '',
		order:0,
		image_order:0,
		image: {
			url:'',
			id: null,
		},
		not_a_choice: false,
		type: 'simple',
	}

})