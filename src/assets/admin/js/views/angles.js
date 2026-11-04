var PC = PC || {};
PC.views = PC.views || {};

// Camera target values that are not a model; mirror CAMERA_TARGET_VISIBLE and
// CAMERA_TARGET_OBJECTS in 3d-camera-fit.js.
var CAMERA_TARGET_VISIBLE = 'visible';
var CAMERA_TARGET_OBJECTS = 'objects';


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
			'objects_selected': 'on_objects_selected'
		} );
	} )(),
	pre_init: function( options ) {
		this.listenTo( this.model, 'change:use_in_cart' , this.set_default_view );
		this.normalize_camera_target();
		// Framing and target decide which camera fields apply, and field
		// conditions are only read when the form renders.
		this.listenTo( this.model, 'change:camera_target_model', this.on_camera_target_model_change );
		this.listenTo( this.model, 'change:camera_framing', this.render );
	},
	/**
	 * Show an angle saved with the old camera settings in the new form, before
	 * it renders. Its focus objects came first, then its target object; both
	 * become the "Specific objects" list. Silent: nothing changes until the
	 * angles are saved, and the viewer reads either form the same way
	 * (angle_target in 3d-camera-fit.js).
	 */
	normalize_camera_target: function() {
		var m = this.model;
		var model = String( m.get( 'camera_target_model' ) || '' ).trim();
		if ( model === CAMERA_TARGET_OBJECTS ) return;
		var ids = _.filter( _.map( m.get( 'camera_focus_object_ids' ) || [], function( id ) { return String( id == null ? '' : id ).trim(); } ) );
		var object = String( m.get( 'camera_target_object_id' ) || '' ).trim();
		if ( ids.length ) {
			m.set( { camera_target_model: CAMERA_TARGET_OBJECTS, camera_target_object_id: '' }, { silent: true } );
		} else if ( object ) {
			// With its model in front, as the object picker lists it.
			var composite = model && model !== CAMERA_TARGET_VISIBLE && object.indexOf( ':' ) === -1 ? model + ':' + object : object;
			m.set( { camera_target_model: CAMERA_TARGET_OBJECTS, camera_focus_object_ids: [ composite ], camera_target_object_id: '' }, { silent: true } );
		}
	},
	on_objects_selected: function( event, payload ) {
		if ( ! payload || payload.setting !== 'camera_focus_object_ids' ) return;
		var ids = payload.ids || [];
		var $list = this.$( '.mkl-pc--framing-objects-list' );
		if ( $list.length ) {
			$list.html( ids.length ? ids.join( ', ' ) : '<em>' + ( window.PC_lang && PC_lang.none_selected ? PC_lang.none_selected : 'None selected' ) + '</em>' );
		}
	},
	/**
	 * A target other than "Specific objects" drops the list: the viewer reads
	 * a list left behind as the target, as it did the old focus objects.
	 */
	on_camera_target_model_change: function( model, value ) {
		if ( value !== CAMERA_TARGET_OBJECTS ) {
			this.model.set( { camera_focus_object_ids: [], camera_target_object_id: '' } );
		}
		if ( window.PC.app && window.PC.app.is_modified ) window.PC.app.is_modified.angles = true;
		this.render();
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
				extra: [
					{ value: CAMERA_TARGET_VISIBLE, label: lang.threed_visible_objects || 'Visible objects' },
					{ value: CAMERA_TARGET_OBJECTS, label: lang.threed_specific_objects || 'Specific objects…' },
				],
			} );
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