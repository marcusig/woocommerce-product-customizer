var PC = PC || {};
PC.views = PC.views || {};

// Camera target (model) value for "Visible objects"; mirrors CAMERA_TARGET_VISIBLE in 3d-camera-fit.js.
var CAMERA_TARGET_VISIBLE = 'visible';


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
		// A new 3D view turns around and frames whatever is shown, until a model
		// or objects are picked. Only the 3D editor loads settings_3d.
		if ( PC.app.admin && PC.app.admin.settings_3d ) {
			attributes.camera_target_model = CAMERA_TARGET_VISIBLE;
		}

		return attributes;
	},
});

PC.views.angle = PC.views.layer.extend({
	object_type: 'angle',
	collectionName: 'angles',
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
		this.toggle_camera_target_object();
		if ( window.PC.app && window.PC.app.is_modified ) window.PC.app.is_modified.angles = true;
	},
	/**
	 * "Visible objects" names no model, so there is no object to pick in it.
	 * Toggled here rather than by a field condition: those are only read when
	 * the form renders.
	 */
	toggle_camera_target_object: function() {
		var visible = this.$( 'select[data-setting="camera_target_model"]' ).val() === CAMERA_TARGET_VISIBLE;
		this.$( '.setting-id-camera_target_object_id' ).toggle( ! visible );
	},
	render: function() {
		var ret = PC.views.layer_form.prototype.render.apply( this, arguments );
		if ( this.$( 'select[data-setting="camera_target_model"]' ).length ) {
			this.populate_camera_target_model();
		}
		return ret;
	},
	populate_camera_target_model: function() {
		var self = this;
		var lang = window.PC_lang || {};
		var populate = function() {
			PC.threeD.populateObjects3dSettingSelect( self, 'camera_target_model', {
				types: [ 'gltf' ],
				placeholder: lang.threed_saved_camera_target || '— Saved camera target —',
				extra: [ { value: CAMERA_TARGET_VISIBLE, label: lang.threed_visible_objects || 'Visible objects' } ],
			} );
			self.toggle_camera_target_object();
		};
		if ( PC.threeD && typeof PC.threeD.populateObjects3dSettingSelect === 'function' ) {
			populate();
		} else if ( PC.threeD && typeof PC.threeD.ensureReady === 'function' ) {
			PC.threeD.ensureReady().then( populate );
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