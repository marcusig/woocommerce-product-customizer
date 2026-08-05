/**
 * 3D choice view – one Backbone view per choice that has 3D actions.
 * Listens to the choice model and applies visibility + 3D actions
 * (material variant, color, texture) for that choice only.
 * No DOM; just drives the Three.js scene for its object.
 */
import * as THREE from 'three';

const Backbone = window.Backbone;

/**
 * Allowlisted Three.js material properties for material_property actions.
 * Keep in sync with mkl_pc_get_allowed_3d_material_properties() in PHP.
 */
const ALLOWED_MATERIAL_PROPERTIES = {
	metalness: true,
	roughness: true,
	opacity: true,
	transparent: true,
	emissiveIntensity: true,
	envMapIntensity: true,
	aoMapIntensity: true,
	lightMapIntensity: true,
	bumpScale: true,
	displacementScale: true,
	displacementBias: true,
	clearcoat: true,
	clearcoatRoughness: true,
	transmission: true,
	thickness: true,
	ior: true,
	sheen: true,
	sheenRoughness: true,
	reflectivity: true,
	iridescence: true,
	iridescenceIOR: true,
	attenuationDistance: true,
	specularIntensity: true,
	wireframe: true,
	flatShading: true,
	depthTest: true,
	depthWrite: true,
	fog: true,
	toneMapped: true,
	vertexColors: true,
};

function is_allowed_material_property( property_name ) {
	return !!( property_name && ALLOWED_MATERIAL_PROPERTIES[ property_name ] );
}

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
		const resolved_scene = this.target_scene;
		this.target_object = this.get_target_object();
		this.target_scene = this.get_target_scene() || resolved_scene;
		if ( ! this.target_object && this.target_scene ) this.target_object = this.target_scene;
		const registry = t.material_registry;
		const actions = this.model.get( 'actions_3d' ) || [];
		const has_toggle_visibility = actions.some( ( a ) => a.action_type === 'toggle_visibility' );
		const visible = this._effective_visible();

		if ( this.target_object && has_toggle_visibility ) this.target_object.visible = visible;
		if ( this.target_scene && has_toggle_visibility && this.target_scene !== this.target_object ) {
			this.target_scene.visible = visible;
		}

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
					if ( ! is_allowed_material_property( prop ) ) return;
					const mat = registry.get( name );
					if ( ! mat || mat[ prop ] === undefined ) return;
					let value = raw;
					if ( typeof mat[ prop ] === 'number' ) {
						value = parseFloat( raw );
						if ( Number.isNaN( value ) ) return;
					} else if ( typeof mat[ prop ] === 'boolean' ) {
						value = raw === 'true' || raw === '1';
					} else {
						return;
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

		// Lazy-load only when the target is not in the scene yet. Retries must stop once the
		// objects3d scene is already loaded (otherwise Promise.resolve → apply_actions loops forever
		// and freezes the page — e.g. Display object / toggle_visibility with a layer object_3d_id).
		if ( has_toggle_visibility && this.parent_view && ! this.target_object && ! this.target_scene ) {
			if ( this._loading_targets_promise ) {
				this._loading_targets_promise.then( () => this.apply_actions() );
				return;
			}

			const targetId = this.model.get( 'target_object_id' ) || this.layer_model.get( 'target_object_id' );
			const needsObject = targetId && String( targetId ).indexOf( ':' ) !== -1;
			const layerObject3dId = this.layer_model && this.layer_model.get ? this.layer_model.get( 'object_3d_id' ) : null;
			const layerObjectIdStr = layerObject3dId != null ? String( layerObject3dId ).trim() : '';
			const layerSceneLoaded = layerObjectIdStr !== '' && this._is_objects3d_scene_loaded( layerObjectIdStr );
			const needsScene = layerObjectIdStr !== '' && ! layerSceneLoaded;

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

