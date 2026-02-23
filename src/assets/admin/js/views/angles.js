var PC = PC || {};
PC.views = PC.views || {};


PC.views.angles = PC.views.layers.extend({
	collectionName: 'angles',
	// singleView: PC.views.angle,
	single_view: function() { return PC.views.angle; },
	new_attributes: function( name ) {
		const attributes = {
			_id: PC.app.get_new_id( this.col ),
			name: name,
			order: this.col.nextOrder(),
			image_order: this.col.nextOrder(),
			active: true,
			// completed: false
		};
		if ( !this.col.length ) {
			attributes.has_thumbnails = true;
		}

		return attributes;
	},
});

PC.views.angle = PC.views.layer.extend({
	edit_view: function(){ return PC.views.angle_form; },
});

PC.views.angle_form = PC.views.layer_form.extend({
	collectionName: 'angles',
	template: wp.template('mkl-pc-structure-angle-form'),
	events: ( function() {
		var parent = PC.views.layer_form.prototype.events || {};
		return _.extend( {}, parent, {
			'change select[data-setting="camera_target_model"]': 'on_camera_target_model_change'
		} );
	} )(),
	pre_init: function( options ) {
		this.listenTo( this.model, 'change:use_in_cart' , this.set_default_view );
	},
	on_camera_target_model_change: function() {
		this.model.set( 'camera_target_object_id', '' );
		this.$( 'input[data-setting="camera_target_object_id"]' ).val( '' );
		if ( window.PC.app && window.PC.app.is_modified ) window.PC.app.is_modified.angles = true;
	},
	render: function() {
		var ret = PC.views.layer_form.prototype.render.apply( this, arguments );
		if ( this.$( 'select[data-setting="camera_target_model"]' ).length ) {
			this.populate_camera_target_model();
		}
		return ret;
	},
	populate_camera_target_model: function() {
		var $sel = this.$( 'select[data-setting="camera_target_model"]' );
		if ( ! $sel.length || ! PC.threeD || typeof PC.threeD.populateModelSourceSelect !== 'function' ) return;
		var currentVal = this.model.get( 'camera_target_model' ) || 'main_model';
		PC.threeD.populateModelSourceSelect( jQuery, $sel, currentVal, { includeUpload: false } );
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