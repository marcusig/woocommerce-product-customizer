var PC = PC || {};
PC.views = PC.views || {};


PC.views.angles = PC.views.layers.extend({
	collectionName: 'angles',
	// singleView: PC.views.angle,
	single_view: function() { return PC.views.angle; },
});

PC.views.angle = PC.views.layer.extend({
	edit_view: function(){ return PC.views.angle_form; },
});

PC.views.angle_form = PC.views.layer_form.extend({
	template: wp.template('mkl-pc-structure-angle-form'),
});