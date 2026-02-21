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
	_attached_model_root: null,
	_attach_parent: null,

	initialize( options ) {
		this.model = options.model;
		this.layer_model = options.layer_model;
		this.parent_view = options.parent;
		this.target_id = this.model.get( 'object_id_3d' ) || this.layer_model.get( 'object_id_3d' );
		this.target_object = this.get_target_object();
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
		const root = t.model_root;
		const obj = this.parent_view._findObject( root, String( target_id ).trim() );
		return obj || null;
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

		if ( this._attached_model_root ) {
			if ( ! visible && this._attached_model_root.parent ) {
				this._attached_model_root.parent.remove( this._attached_model_root );
			} else if ( visible ) {
				const parent = this._attach_parent || t.model_root;
				if ( this._attached_model_root.parent !== parent ) parent.add( this._attached_model_root );
				this._attached_model_root.visible = true;
			}
		}
		if ( this.target_object && has_toggle_visibility ) this.target_object.visible = visible;
	},

	_apply_visibility_and_actions() {
		const t = this.parent_view._three;
		if ( ! t || ! t.model_root ) return;
		const select_variant = t.gltf && t.gltf.functions && t.gltf.functions.selectVariant;
		const registry = t.material_registry;
		const actions = this.model.get( 'actions_3d' ) || [];
		const has_toggle_visibility = actions.some( ( a ) => a.action_type === 'toggle_visibility' );
		const visible = this._effective_visible();

		if ( this.target_object && has_toggle_visibility ) this.target_object.visible = visible;

		actions.forEach( ( action ) => {
			const type = action.action_type;
			if ( type === 'toggle_visibility' ) return;
			if ( type === 'material_variant' && select_variant && this.target_object ) {
				const variant_name = action.material_variant_value || action.variant_select;
				if ( variant_name ) select_variant( this.target_object, variant_name, true, null );
			} else if ( type === 'material_color' && this.target_object ) {
				const color_hex = action.material_color_value;
				if ( color_hex && this.target_object.material ) {
					this.target_object.material.color.set( color_hex );
				}
			} else if ( type === 'material_texture' && this.target_object ) {
				const texture_url = action.material_texture_url || action.material_texture_value;
				if ( texture_url ) {
					const loader = new THREE.TextureLoader();
					loader.load( texture_url, ( texture ) => {
						texture.colorSpace = THREE.SRGBColorSpace;
						this._set_material_map( this.target_object, texture );
					} );
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
		const visible = this._effective_visible();
		const actions = this.model.get( 'actions_3d' ) || [];
		const has_toggle_visibility = actions.some( ( a ) => a.action_type === 'toggle_visibility' );

		if ( ! visible ) {
			if ( this._attached_model_root && this._attached_model_root.parent ) {
				this._attached_model_root.parent.remove( this._attached_model_root );
			}
			if ( this.target_object && has_toggle_visibility ) this.target_object.visible = false;
			return;
		}

		const model_upload_3d = this.model.get( 'model_upload_3d' );
		const model_upload_3d_url = this.model.get( 'model_upload_3d_url' );

		if ( model_upload_3d && model_upload_3d_url ) {
			if ( this._attached_model_root ) {
				this.target_object = this._attached_model_root;
				const parent = this._attach_parent || t.model_root;
				if ( this._attached_model_root.parent !== parent ) parent.add( this._attached_model_root );
				this._attached_model_root.visible = true;
				this._apply_visibility_and_actions();
			} else {
				this.parent_view._load_choice_gltf( model_upload_3d_url, ( scene ) => {
					if ( ! scene || ! t || ! t.model_root ) return;
					this._attached_model_root = scene;
					this._attach_parent = this.target_object || t.model_root;
					this.target_object = scene;
					this._attach_parent.add( scene );
					this._attached_model_root.visible = true;
					this._apply_visibility_and_actions();
				} );
			}
			return;
		}

		this._apply_visibility_and_actions();
	},

	remove() {
		if ( this._attached_model_root && this._attached_model_root.parent ) {
			this._attached_model_root.parent.remove( this._attached_model_root );
			this._attached_model_root = null;
		}
		return Backbone.View.prototype.remove.apply( this, arguments );
	},
});

export default viewer_3d_choice;

