var PC = PC || {};
// PC.model = PC.model || {};


PC.layer = Backbone.Model.extend({ 
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
		display_mode: 'default',
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
	sync: function( method, model, options ) {
	},

})