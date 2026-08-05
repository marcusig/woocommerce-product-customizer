/**
 * 3D choice view – one Backbone view per choice that has 3D actions.
 * Listens to the choice model and applies visibility + 3D actions
 * (material variant, color, texture) for that choice only.
 * No DOM; just drives the Three.js scene for its object.
 */
import { apply_choice_actions } from './3d-action-handlers.js';

const Backbone = window.Backbone;

const viewer_3d_choice = Backbone.View.extend({
	// No el appended; view exists only to hold listeners and apply 3D actions.
	tagName: 'div',
	className: 'mkl_pc_viewer_3d_choice',
	target_id: null,
	target_object: null,
	target_scene: null,

	initialize( options ) {
		this.model = options.model;
		this.layer_model = options.layer_model;
		this.parent_view = options.parent;
		this.target_id = this.model.get( 'target_object_id' ) || this.layer_model.get( 'target_object_id' );
		this.target_object = this.get_target_object();
		this.target_scene = this.get_target_scene();
		this.listenTo( this.model, 'change:active', this.apply_actions );
		this.listenTo( this.model, 'change:cshow', this._apply_cshow_visibility_only );
		this.listenTo( this.layer_model, 'change:cshow', this._apply_cshow_visibility_only );
	},

	get_target_object() {
		const t = this.parent_view._three;
		if ( ! t || ! t.model_root ) return null;
		const target_id =
			this.model.get( 'target_object_id' ) ||
			this.layer_model.get( 'target_object_id' );
		if ( ! target_id ) return null;
		if ( typeof this.parent_view._findObjectById === 'function' ) {
			return this.parent_view._findObjectById( target_id ) || null;
		}
		const root = t.model_root;
		const obj = this.parent_view._findObject( root, String( target_id ).trim() );
		return obj || null;
	},

	/**
	 * Resolve the objects3d scene root for this choice/layer, if loaded.
	 * @returns {THREE.Object3D|null}
	 */
	get_target_scene() {
		const object3d_id = this._resolve_object3d_id();
		if ( ! object3d_id ) return null;
		if ( this.parent_view._objectIdToScene && this.parent_view._objectIdToScene[ object3d_id ] ) {
			return this.parent_view._objectIdToScene[ object3d_id ];
		}
		return null;
	},

	/**
	 * Prefer choice object_3d_id, fall back to layer.
	 * @returns {string}
	 */
	_resolve_object3d_id() {
		const choice_id = this.model.get( 'object_3d_id' );
		if ( choice_id != null && String( choice_id ).trim() !== '' ) {
			return String( choice_id ).trim();
		}
		const layer_id = this.layer_model && this.layer_model.get ? this.layer_model.get( 'object_3d_id' ) : null;
		if ( layer_id != null && String( layer_id ).trim() !== '' ) {
			return String( layer_id ).trim();
		}
		return '';
	},

	_effective_visible() {
		return this.model.get( 'active' ) && false !== this.model.get( 'cshow' ) && false !== this.layer_model.get( 'cshow' );
	},

	/** Only update visibility (for cshow changes). Does not run material/variant/color/texture actions. */
	_apply_cshow_visibility_only() {
		const t = this.parent_view._three;
		if ( ! t || ! t.model_root ) return;
		const visible = this._effective_visible();
		const actions = this.model.get( 'actions_3d' ) || [];
		const has_toggle_visibility = actions.some( ( a ) => a.action_type === 'toggle_visibility' );

		const target_object = this.get_target_object();
		const target_scene = this.get_target_scene() || this.target_scene;
		if ( target_object && has_toggle_visibility ) target_object.visible = visible;
		if ( target_scene && has_toggle_visibility ) target_scene.visible = visible;
		if ( has_toggle_visibility ) {
			this._invalidate_fake_shadow();
		}
		if ( has_toggle_visibility && typeof this.parent_view._applyAngleCamera === 'function' ) {
			this.parent_view._applyAngleCamera( { reframe: true } );
		}

		// If conditional logic just made an active choice visible, ensure lazy targets can load.
		if ( visible && this.model.get( 'active' ) ) {
			this.apply_actions();
		}
	},

	_invalidate_fake_shadow() {
		if ( this.parent_view && typeof this.parent_view.invalidate_fake_shadow === 'function' ) {
			this.parent_view.invalidate_fake_shadow();
		}
	},

	_apply_visibility_and_actions() {
		const t = this.parent_view._three;
		if ( ! t || ! t.model_root ) return;
		const resolved_scene = this.target_scene;
		this.target_object = this.get_target_object();
		this.target_scene = this.get_target_scene() || resolved_scene;
		if ( ! this.target_object && this.target_scene ) this.target_object = this.target_scene;
		const actions = this.model.get( 'actions_3d' ) || [];
		const has_toggle_visibility = actions.some( ( a ) => a.action_type === 'toggle_visibility' );
		const visible = this._effective_visible();

		if ( this.target_object && has_toggle_visibility ) this.target_object.visible = visible;
		if ( this.target_scene && has_toggle_visibility && this.target_scene !== this.target_object ) {
			this.target_scene.visible = visible;
		}

		apply_choice_actions(
			{
				three: t,
				registry: t.material_registry,
				texture_loader: t.textureLoader || null,
				target_object: this.target_object,
				target_scene: this.target_scene,
			},
			actions
		);

		if ( has_toggle_visibility ) {
			this._invalidate_fake_shadow();
		}
		if ( has_toggle_visibility && typeof this.parent_view._applyAngleCamera === 'function' ) {
			this.parent_view._applyAngleCamera( { reframe: true } );
		}
	},

	apply_actions() {
		const t = this.parent_view._three;
		if ( ! t || ! t.model_root ) return;
		this.target_object = this.get_target_object();
		this.target_scene = this.get_target_scene() || this.target_scene;
		const visible = this._effective_visible();
		const actions = this.model.get( 'actions_3d' ) || [];
		const has_toggle_visibility = actions.some( ( a ) => a.action_type === 'toggle_visibility' );

		if ( ! visible ) {
			if ( this.target_object && has_toggle_visibility ) this.target_object.visible = false;
			if ( this.target_scene && has_toggle_visibility ) this.target_scene.visible = false;
			if ( has_toggle_visibility ) {
				this._invalidate_fake_shadow();
			}
			if ( has_toggle_visibility && typeof this.parent_view._applyAngleCamera === 'function' ) {
				this.parent_view._applyAngleCamera( { reframe: true } );
			}
			return;
		}

		// Lazy-load only when the target is not in the scene yet. Retries must stop once the
		// objects3d scene is already loaded (otherwise Promise.resolve → apply_actions loops forever
		// and freezes the page — e.g. Display object / toggle_visibility with a layer object_3d_id).
		if ( has_toggle_visibility && this.parent_view && ! this.target_object && ! this.target_scene ) {
			if ( this._loading_targets_promise ) {
				this._loading_targets_promise.then( () => this.apply_actions() );
				return;
			}

			const target_id = this.model.get( 'target_object_id' ) || this.layer_model.get( 'target_object_id' );
			const needs_object = target_id && String( target_id ).indexOf( ':' ) !== -1;
			const layer_object3d_id = this.layer_model && this.layer_model.get ? this.layer_model.get( 'object_3d_id' ) : null;
			const layer_object_id_str = layer_object3d_id != null ? String( layer_object3d_id ).trim() : '';
			const layer_scene_loaded = layer_object_id_str !== '' && this._is_objects3d_scene_loaded( layer_object_id_str );
			const needs_scene = layer_object_id_str !== '' && ! layer_scene_loaded;

			if ( needs_object && typeof this.parent_view._ensureObjects3dSceneLoadedForCompositeId === 'function' ) {
				this._loading_targets_promise = this.parent_view._ensureObjects3dSceneLoadedForCompositeId( target_id )
					.finally( () => { this._loading_targets_promise = null; } );
				this._loading_targets_promise.then( () => this.apply_actions() );
				return;
			}

			if ( needs_scene && typeof this.parent_view._ensureObjects3dSceneLoadedById === 'function' ) {
				this._loading_targets_promise = this.parent_view._ensureObjects3dSceneLoadedById( layer_object3d_id )
					.finally( () => { this._loading_targets_promise = null; } );
				this._loading_targets_promise.then( () => this.apply_actions() );
				return;
			}
		}

		const object3d_id = this.model.get( 'object_3d_id' );
		const has_choice_model = object3d_id != null && String( object3d_id ).trim() !== '';

		if ( has_choice_model && this.parent_view._ensureObjects3dSceneLoadedById ) {
			this.parent_view._ensureObjects3dSceneLoadedById( object3d_id ).then( ( scene ) => {
				if ( ! scene || ! t || ! t.model_root ) return;
				this.target_scene = scene;
				if ( ! this.target_object ) this.target_object = this.get_target_object() || scene;
				this._apply_visibility_and_actions();
			} );
			return;
		}

		this._apply_visibility_and_actions();
	},

	/**
	 * Whether an objects3d scene id is already loaded (or failed) on the parent viewer.
	 * Used to avoid lazy-load retry loops when the target mesh is still missing after load.
	 * @param {string} object3d_id
	 * @returns {boolean}
	 */
	_is_objects3d_scene_loaded( object3d_id ) {
		if ( ! object3d_id || ! this.parent_view ) return false;
		const id_str = String( object3d_id ).trim();
		if ( this.parent_view._objectIdToScene && this.parent_view._objectIdToScene[ id_str ] ) {
			return true;
		}
		const scene_model = this.parent_view._scene_models && this.parent_view._scene_models.get( id_str );
		if ( ! scene_model ) return false;
		const state = scene_model.get( 'state' );
		return state === 'loaded' || state === 'error';
	},

	remove() {
		return Backbone.View.prototype.remove.apply( this, arguments );
	},
});

export default viewer_3d_choice;
