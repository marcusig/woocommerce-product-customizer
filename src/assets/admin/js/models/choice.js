var PC = PC || {};
// PC.model = PC.model || {};


PC.choice = Backbone.Model.extend({
	idAttribute: '_id',
	defaults: {
		_id:0,
		name: '',
		description: '',
		images: null,
		layerId: null,
		available: true,
	},
	initialize: function( attributes, options ) {

		if ( ! attributes.layerId ) this.set( 'layerId', options.layer.id );

		if ( ! ( attributes.images instanceof Backbone.Collection ) ) {
			var images = new PC.choice_pictures( attributes.images );
			this.set('images', images); 
		}

		switch ( attributes.available ) {
			case '0':
				this.set( 'available', false);
				break;
			case '1':
			default:
				this.set( 'available', true);
				break;
			}

		if ( 'undefined' != attributes.is_group && 1 == parseInt( attributes.is_group ) ) {
			this.set( 'available', false);
		}
		wp.hooks.doAction( 'PC.fe.models.choice.init', this );
	},
	get_image: function( image, what ) { 
		image = image || 'image'; 
		what = what || 'url'; 
		var active_angle = PC.fe.angles.findWhere( { active: true } ) || PC.fe.angles.first(); 
		var angle_id = active_angle.id; 
		var m = this.attributes.images.get( angle_id );
		return m ? m.attributes[image][what] : ''; 
	},

	parse: function( response ) {
		// console.log('choice model parse:', response);
	},
	sync: function( method, model, options ) {
	},
	
});

PC.content = Backbone.Model.extend({ 
	idAttribute: 'layerId',
	defaults: {
		layerId: null,
		choices: null,
	},
});

PC.choice_picture = Backbone.Model.extend({
	idAttribute: 'angleId',
	defaults: {
		// _id:0,
		image:{
			id: null,
			url: '',
			dimensions: null,
		},
		thumbnail:{
			id: null,
			url: '',
		},
		angleId: null,
	}
});
