var PC = PC || {};

PC.Object3D = Backbone.Model.extend({
	idAttribute: '_id',
	defaults: {
		_id: 0,
		label: '',
		attachment_id: null,
		url: '',
		filename: '',
		object_type: 'gltf',
		loading_strategy: 'eager',
	},
	sync: function( method, model, options ) {},
});
