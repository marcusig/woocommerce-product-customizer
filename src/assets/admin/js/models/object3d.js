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
		// Normalize legacy root attachment_id/url into gltf object (do not store filename).
		if ( ! attrs.gltf && ( attrs.attachment_id != null || attrs.url != null ) ) {
			attrs.gltf = {
				attachment_id: attrs.attachment_id != null ? attrs.attachment_id : null,
				url: attrs.url || '',
			};
		}
		if ( attrs.gltf && ( attrs.gltf.filename !== undefined ) ) {
			attrs.gltf = _.omit( attrs.gltf, 'filename' );
		}
		// Remove legacy root keys so we only store gltf.
		delete attrs.attachment_id;
		delete attrs.url;
		delete attrs.filename;
		return attrs;
	},
	sync: function( method, model, options ) {},
});
