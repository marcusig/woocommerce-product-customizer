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
			'change select[data-setting="camera_target_model"]': 'on_camera_target_model_change',
			'objects_selected': 'on_objects_selected'
		} );
	} )(),
	pre_init: function( options ) {
		this.listenTo( this.model, 'change:use_in_cart' , this.set_default_view );
	},
	on_objects_selected: function( event, payload ) {
		if ( ! payload || payload.setting !== 'camera_focus_object_ids' ) return;
		var ids = payload.ids || [];
		var $list = this.$( '.mkl-pc--framing-objects-list' );
		if ( $list.length ) {
			$list.html( ids.length ? ids.join( ', ' ) : '<em>' + ( window.PC_lang && PC_lang.none_selected ? PC_lang.none_selected : 'None selected' ) + '</em>' );
		}
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
		if ( ! $sel.length ) return;
		var currentVal = this.model.get( 'camera_target_model' ) || 'main_model';
		var opts = { includeUpload: false };
		var doPopulate = function() {
			if ( PC.threeD && typeof PC.threeD.populateModelSourceSelect === 'function' ) {
				PC.threeD.populateModelSourceSelect( jQuery, $sel, currentVal, opts );
			}
		};
		if ( typeof PC.threeD.populateModelSourceSelect === 'function' ) {
			doPopulate();
		} else if ( PC.threeD && typeof PC.threeD.ensureReady === 'function' ) {
			PC.threeD.ensureReady().then( doPopulate );
		}
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

PC.actions = PC.actions || {};
PC.actions.clear_framing_objects = function( el, context ) {
	if ( ! context || ! context.model ) return;
	context.model.set( 'camera_focus_object_ids', [] );
	var $list = context.$el && context.$el.find( '.mkl-pc--framing-objects-list' );
	if ( $list.length ) {
		$list.html( '<em>' + ( window.PC_lang && PC_lang.none_selected ? PC_lang.none_selected : 'None selected' ) + '</em>' );
	}
	if ( window.PC.app && window.PC.app.is_modified ) window.PC.app.is_modified.angles = true;
};