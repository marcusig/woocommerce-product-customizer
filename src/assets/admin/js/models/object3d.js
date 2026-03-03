var PC = PC || {};

PC.Object3D = Backbone.Model.extend({
	idAttribute: '_id',
	defaults: {
		_id: 0,
		name: '',
		url: '',
		attachment_id: null,
		filename: '',
		object_type: 'gltf',
		loading_strategy: 'eager',
		light_data: null,
	},
	sync: function( method, model, options ) {},
});
