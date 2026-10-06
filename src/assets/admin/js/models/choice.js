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

		// A choice belongs to the layer whose collection it is being built in. The stored value
		// can say otherwise - choices served from a global layer carry the id of the layer they
		// were authored in, not the id of the layer they are shown under - and everything that
		// needs a choice's layer looks it up by this: PC.fe.layers.get( choice.get( 'layerId' ) )
		// in the choice view and the viewer, and the actioner match in conditional logic.
		var collection_layer_id = ( options && options.layer ) ? options.layer.id : null;
		if ( collection_layer_id ) {
			this.set( 'layerId', collection_layer_id );
		}

		if ( ! ( attributes.images instanceof Backbone.Collection ) ) {
			var images = new PC.choice_pictures( attributes.images, { parse: true } );
			this.set('images', images); 
		}

		// Reset choice selection to false by default, but only with a configurator
		// actually running. `PC.fe` is a namespace several scripts create defensively
		// on load, so its mere existence does not mean the frontend is up - and in the
		// editor this would quietly clear the selection state off every choice it
		// builds. `layers` is assigned before any choice is constructed, so it is the
		// earliest thing that only a running configurator has.
		if ( PC.fe && PC.fe.layers ) this.set( 'active', false );

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
	get_image: function( image, what, angle_id ) { 
		image = image || 'image'; 
		what = what || 'url'; 
		if ( 'thumbnail' == image ) {
			angle_id = PC.fe.angles.findWhere( { has_thumbnails: true } );
			if ( !angle_id ) angle_id = PC.fe.angles.first().id;
		} else {
			if ( !angle_id || ! PC.fe.angles.get( angle_id ) ) {
				var active_angle = PC.fe.angles.findWhere( { active: true } ) || PC.fe.angles.first();
				angle_id = active_angle.id;
			}
		}	
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
