var PC = PC || {};
// PC.model = PC.model || {};


PC.choice = Backbone.Model.extend({
	idAttribute: '_id',
	defaults: {
		_id:0,
		name: '',
		description: '',
		images:null,
		layerId: null,
	},
	initialize: function( attributes ) {
		
		if( ! ( attributes.images instanceof Backbone.Collection ) ) {
			
			var images = new PC.choice_pictures( attributes.images );
			this.set('images', images); 
		}

	},
	get_image: function( image, what ) { 
		image = image || 'image'; 
		what = what || 'url'; 
		var active_angle = PC.fe.angles.findWhere( { active: true } ) || PC.fe.angles.first(); 
		var angle_id = active_angle.id; 
		return this.attributes.images.get( angle_id ).attributes[image][what]; 
	},

	parse: function( response ) {
		console.log('choice model parse:', response);
	},
	sync: function( method, model, options ) {
	}
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
