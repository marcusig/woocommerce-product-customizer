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

		// Reset choice selection to false by default
		if ( PC.fe ) this.set( 'active', false );

		switch ( attributes.available ) {
			case '0':
				this.set( 'available', false);
				break;
			case '1':
			default:
				this.set( 'available', true);
				break;
		}

		if ( 'undefined' != attributes.is_group && attributes.is_group ) {
			this.set( 'available', false);
		}
		wp.hooks.doAction( 'PC.fe.models.choice.init', this );
	},
	get_image: function( image, what ) { 
		image = image || 'image'; 
		what = what || 'url'; 
		if ( 'thumbnail' == image ) {
			var active_angle = PC.fe.angles.first(); 
		} else {
			var active_angle = PC.fe.angles.findWhere( { active: true } ) || PC.fe.angles.first(); 
		}
		var angle_id = active_angle.id; 
		var m = this.attributes.images.get( angle_id );
		return m ? m.attributes[image][what] : ''; 
	},
	has_image: function() {
		var count = 0;
		this.get( 'images' ).each( function( item ) {
			if ( item.get( 'image' ) && item.get( 'image' ).url ) count++;
		} );
		return count;
	},
	parse: function( response ) {
		// console.log('choice model parse:', response);
	},
	sync: function( method, model, options ) {
	},
	get_name: function () {
		var attrs = wp.hooks.applyFilters( 'PC.fe.configurator.choice_data', this.attributes );
		return attrs.name;
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
