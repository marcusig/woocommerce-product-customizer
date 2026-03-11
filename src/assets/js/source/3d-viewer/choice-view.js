/**
 * 3D choice view – one Backbone view per choice that has 3D actions.
 * Listens to the choice model and applies visibility + 3D actions
 * (material variant, color, texture) for that choice only.
 * No DOM; just drives the Three.js scene for its object.
 */
import * as THREE from 'three';

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
		this.target_id = this.model.get( 'object_id_3d' ) || this.layer_model.get( 'object_id_3d' );
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
			this.model.get( 'object_id_3d' ) ||
			this.layer_model.get( 'object_id_3d' );
		if ( ! target_id ) return null;
		if ( typeof this.parent_view._findObjectById === 'function' ) {
			return this.parent_view._findObjectById( target_id ) || null;
		}
		const root = t.model_root;
		const obj = this.parent_view._findObject( root, String( target_id ).trim() );
		return obj || null;
	},

	get_target_scene() {
		return null;
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

		const targetObject = this.get_target_object();
		const targetScene = this.get_target_scene();
		if ( targetObject && has_toggle_visibility ) targetObject.visible = visible;
		if ( targetScene && has_toggle_visibility ) targetScene.visible = visible;
		if ( has_toggle_visibility && typeof this.parent_view._applyAngleCamera === 'function' ) {
			this.parent_view._applyAngleCamera( { reframe: true } );
		}

		// If conditional logic just made an active choice visible, ensure lazy targets can load.
		if ( visible && this.model.get( 'active' ) ) {
			this.apply_actions();
		}
	},

	_apply_visibility_and_actions() {
		const t = this.parent_view._three;
		if ( ! t || ! t.model_root ) return;
		this.target_object = this.get_target_object();
		this.target_scene = this.get_target_scene();
		if ( ! this.target_object && this.target_scene ) this.target_object = this.target_scene;
		const registry = t.material_registry;
		const actions = this.model.get( 'actions_3d' ) || [];
		const has_toggle_visibility = actions.some( ( a ) => a.action_type === 'toggle_visibility' );
		const visible = this._effective_visible();

		if ( this.target_object && has_toggle_visibility ) this.target_object.visible = visible;
		if ( this.target_scene && has_toggle_visibility ) this.target_scene.visible = visible;

		actions.forEach( ( action ) => {
			const type = action.action_type;
			if ( type === 'toggle_visibility' ) return;
			if ( type === 'material_variant' && this.target_object ) {
				const variant_name = action.material_variant_value || action.variant_select;
				if ( variant_name ) {
					let variantRoot = this.target_scene || this.target_object;
					let selectVariant = null;
					let node = variantRoot;
					while ( node ) {
						if ( node.userData && node.userData.gltf_functions && typeof node.userData.gltf_functions.selectVariant === 'function' ) {
							selectVariant = node.userData.gltf_functions.selectVariant;
							variantRoot = node;
							break;
						}
						node = node.parent;
					}
					// Fallback for main model actions.
					if ( ! selectVariant ) {
						selectVariant = t.gltf && t.gltf.functions && t.gltf.functions.selectVariant;
					}
					if ( typeof selectVariant === 'function' ) {
						selectVariant( variantRoot, variant_name, true, null );
					}
				}
			} else if ( type === 'material_texture' && registry ) {
				const name = action.material_texture_material_name || action.material_name;
				const texture_url = action.material_texture_url || action.material_texture_value;
				if ( name && texture_url ) {
					const mat = registry.get( name );
					if ( mat ) {
						const loader = ( this.parent_view._three && this.parent_view._three.textureLoader ) || new THREE.TextureLoader();
						loader.load( texture_url, ( texture ) => {
							texture.colorSpace = THREE.SRGBColorSpace;
							if ( mat.map && mat.map.dispose ) mat.map.dispose();
							mat.map = texture;
							mat.needsUpdate = true;
						} );
					}
				}
			} else if ( type === 'material_color_registry' && registry ) {
				const name = action.material_name;
				const color_hex = action.material_registry_color;
				if ( name && color_hex ) {
					const mat = registry.get( name );
					if ( mat && mat.color ) mat.color.set( color_hex );
				}
			} else if ( type === 'material_property' && registry ) {
				const name = action.material_name;
				const prop = action.material_property_name;
				const raw = action.material_property_value;
				if ( name && prop && raw !== undefined && raw !== '' ) {
					const mat = registry.get( name );
					if ( ! mat || mat[ prop ] === undefined ) return;
					let value = raw;
					if ( typeof mat[ prop ] === 'number' ) {
						value = parseFloat( raw );
						if ( Number.isNaN( value ) ) return;
					} else if ( typeof mat[ prop ] === 'boolean' ) {
						value = raw === 'true' || raw === '1';
					}
					mat[ prop ] = value;
				}
			} else if ( type === 'apply_material' && registry && this.target_object ) {
				const name = action.material_name;
				if ( ! name ) return;
				const registryMaterial = registry.get( name );
				if ( ! registryMaterial ) return;
				this._apply_material_to_object( this.target_object, registryMaterial );
			}
		} );
		if ( has_toggle_visibility && typeof this.parent_view._applyAngleCamera === 'function' ) {
			this.parent_view._applyAngleCamera( { reframe: true } );
		}
	},

	_apply_material_to_object( obj, material ) {
		if ( ! obj ) return;
		if ( obj.isMesh && obj.material !== undefined ) {
			obj.material = material;
			return;
		}
		obj.traverse( ( child ) => {
			if ( child.isMesh && child.material !== undefined ) {
				child.material = material;
			}
		} );
	},

	_set_material_map( obj, texture ) {
		if ( ! obj ) return;

		obj.traverse( ( child ) => {
			if ( ! child.material ) return;

			const materials = Array.isArray( child.material )
				? child.material
				: [ child.material ];

			materials.forEach( ( mat ) => {
				if ( ! mat ) return;

				const oldMap = mat.map;
				const tex = texture.clone();

				if ( oldMap ) {
					tex.repeat.copy( oldMap.repeat );
					tex.offset.copy( oldMap.offset );
					tex.center.copy( oldMap.center );
					tex.rotation = oldMap.rotation;
				}

				mat.map = tex;
				mat.needsUpdate = true;
			} );
		} );
	},

	apply_actions() {
		const t = this.parent_view._three;
		if ( ! t || ! t.model_root ) return;
		this.target_object = this.get_target_object();
		this.target_scene = this.get_target_scene();
		const visible = this._effective_visible();
		const actions = this.model.get( 'actions_3d' ) || [];
		const has_toggle_visibility = actions.some( ( a ) => a.action_type === 'toggle_visibility' );

		if ( ! visible ) {
			if ( this.target_object && has_toggle_visibility ) this.target_object.visible = false;
			if ( this.target_scene && has_toggle_visibility ) this.target_scene.visible = false;
			if ( has_toggle_visibility && typeof this.parent_view._applyAngleCamera === 'function' ) {
				this.parent_view._applyAngleCamera( { reframe: true } );
			}
			return;
		}

		// If this choice needs to toggle visibility for an object/scene that isn't loaded yet,
		// lazily load the corresponding objects3d model on demand.
		if ( has_toggle_visibility && this.parent_view ) {
			if ( this._loading_targets_promise ) {
				// Wait for the in-flight load, then retry.
				this._loading_targets_promise.then( () => this.apply_actions() );
				return;
			}

			const targetId = this.model.get( 'object_id_3d' ) || this.layer_model.get( 'object_id_3d' );
			const needsObject = ! this.target_object && targetId && String( targetId ).indexOf( ':' ) !== -1;
			const layerObject3dId = this.layer_model && this.layer_model.get ? this.layer_model.get( 'object_3d_id' ) : null;
			const needsScene = layerObject3dId != null && String( layerObject3dId ).trim() !== '';

			if ( needsObject && typeof this.parent_view._ensureObjects3dSceneLoadedForCompositeId === 'function' ) {
				this._loading_targets_promise = this.parent_view._ensureObjects3dSceneLoadedForCompositeId( targetId )
					.finally( () => { this._loading_targets_promise = null; } );
				this._loading_targets_promise.then( () => this.apply_actions() );
				return;
			}

			if ( needsScene && typeof this.parent_view._ensureObjects3dSceneLoadedById === 'function' ) {
				this._loading_targets_promise = this.parent_view._ensureObjects3dSceneLoadedById( layerObject3dId )
					.finally( () => { this._loading_targets_promise = null; } );
				this._loading_targets_promise.then( () => this.apply_actions() );
				return;
			}
		}

		const object3dId = this.model.get( 'object_3d_id' );
		const hasChoiceModel = object3dId != null && String( object3dId ).trim() !== '';

		if ( hasChoiceModel && this.parent_view._ensureObjects3dSceneLoadedById ) {
			this.parent_view._ensureObjects3dSceneLoadedById( object3dId ).then( ( scene ) => {
				if ( ! scene || ! t || ! t.model_root ) return;
				this.target_scene = scene;
				if ( ! this.target_object ) this.target_object = scene;
				this._apply_visibility_and_actions();
			} );
			return;
		}

		this._apply_visibility_and_actions();
	},

	remove() {
		return Backbone.View.prototype.remove.apply( this, arguments );
	},
});

export default viewer_3d_choice;

