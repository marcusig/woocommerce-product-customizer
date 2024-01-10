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
	collectionName: 'angles',
	template: wp.template('mkl-pc-structure-angle-form'),
	pre_init: function( options ) {
		this.listenTo( this.model, 'change:use_in_cart' , this.set_default_view );
	},
	set_default_view: function( model, seleted ) {
		if ( seleted ) {
			// Reset use_in_cart in the other angles
			this.model.collection.each( function( item ) {
				if ( item.id != model.id ) {
					item.set( 'use_in_cart', false );
				}
			}.bind( this ) );
		}
	},
});