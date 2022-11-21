var PC = PC || {};
// PC.model = PC.model || {};


PC.layer = Backbone.Model.extend({ 
	url: function() {
		var base = PC_lang.rest_url + PC_lang.rest_base + PC.app.id + '/layers';
		if ( this.id ) base += '/' + this.id;
		base += '?_wpnonce=' + PC_lang.rest_nonce;
		return base;
	},
	idAttribute: 'id',
	defaults: {
		// _id: 0,
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
	},
	initialize: function(m) {
		if ( 'boolean' != typeof m.not_a_choice ) {
			switch ( m.not_a_choice ) {
				case 1:
				case "1":
				case "true":
					this.set( 'not_a_choice', true );
					break;
				case 0:
				case "0":
				case "false":
				default:
					this.set( 'not_a_choice', false );
					break;
			} 
		}
	},
	sync: PC.sync,
})