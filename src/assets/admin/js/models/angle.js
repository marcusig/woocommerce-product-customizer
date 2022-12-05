var PC = PC || {};
// PC.model = PC.model || {};


PC.angle = PC.layer.extend({ 
	url: function() {
		var base = PC_lang.rest_url + PC_lang.rest_base + PC.app.id + '/angles';
		if ( this.id ) base += '/' + this.id;
		base += '?_wpnonce=' + PC_lang.rest_nonce;
		return base;
	},
	idAttribute: 'id',
	preinitialize: function( attributes ) {
		if ( ! attributes.id && attributes._id ) {
			attributes.id = attributes._id;
		}
	},
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