var PC = PC || {};
// PC.model = PC.model || {};


PC.angles = Backbone.Collection.extend({
	url: function() { return ajaxurl + '?action='+PC.actionParameter+'&data=angles' },
	model: PC.layer, // use the same basic model as the layers
	nextOrder: function() {
		if ( !this.length ) {
			return 1;
		}
		return this.last().get('order') + 1;
	},
	parse: function(models) {
		// Look for an angle that already has has_thumbnails
		let hasMarker = _.find(models, function(model) {
			return model.has_thumbnails === true;
		});

		// If none found, mark the first one
		if (!hasMarker && models.length > 0) {
			models[0].has_thumbnails = true;
		}

		return models;
	},
	comparator: function( layer ) {
	   	return layer.get('order');
    },
})