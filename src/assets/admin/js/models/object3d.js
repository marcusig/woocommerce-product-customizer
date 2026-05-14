var PC = PC || {};

PC.Object3D = Backbone.Model.extend({
	idAttribute: '_id',
	defaults: {
		_id: 0,
		name: '',
	},
	parse: function( resp ) {
		if ( ! resp || typeof resp !== 'object' ) return resp;
		var attrs = _.extend( {}, resp );
		if ( attrs.gltf && ( attrs.gltf.filename !== undefined ) ) {
			attrs.gltf = _.omit( attrs.gltf, 'filename' );
		}
		return attrs;
	},
	sync: function( method, model, options ) {},
});
