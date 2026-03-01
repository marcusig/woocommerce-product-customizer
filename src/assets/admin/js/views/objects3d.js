/**
 * 3D Objects state view: list and form for managing the 3d_objects collection.
 */
var PC = PC || {};
PC.views = PC.views || {};

( function( $, _ ) {

	PC.views.objects3d = PC.views.layers.extend({
		collectionName: 'objects3d',
		single_view: function() { return PC.views.object3d_item; },
		new_attributes: function( name ) {
			return {
				_id: PC.app.get_new_id( this.col ),
				name: name,
				order: this.col.nextOrder(),
				active: true,
			};
		},
	} );

	PC.views.object3d_item = PC.views.layer.extend({
		edit_view: function() { return PC.views.object3d_form; },
	} );

	PC.views.object3d_form = PC.views.layer_form.extend({
		collectionName: 'objects3d',
		template: wp.template('mkl-pc-structure-object3d-form'),
		events: ( function() {
			var parent = PC.views.layer_form.prototype.events || {};
			return _.extend( {}, parent, {
				'change .object3d-label': 'change_label',
				'change .object3d-type': 'change_type',
				'change .object3d-loading': 'change_loading',
				'click .object3d-upload': 'open_upload',
				'click .object3d-clear-file': 'clear_file',
			} );
		} )(),
		initialize: function( options ) {
			if ( this.pre_init ) this.pre_init( options );
			this.toggled_status.init();
			this.collection = this.model.collection;
			this.listenTo( this.model, 'destroy', this.remove );
			this.listenTo( this.model, wp.hooks.applyFilters( 'PC.admin.object3d_form.render.on.change.events', 'change:name change:object_type change:loading_strategy' ), this.render );
		},
		render: function() {
			var ret = PC.views.layer_form.prototype.render.apply( this, arguments );
			return ret;
		},
	} );

}( jQuery, PC._us || window._ ) );
