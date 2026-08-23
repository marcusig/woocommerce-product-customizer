/**
 * Frontend 3D choice action handlers.
 * Registry of action_type → apply function for actions_3d.
 */
import * as THREE from 'three';

/**
 * Allowlisted Three.js material properties for material_property actions.
 * Keep in sync with mkl_pc_get_allowed_3d_material_properties() in PHP.
 */
export const ALLOWED_MATERIAL_PROPERTIES = {
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

export function is_allowed_material_property( property_name ) {
	return !!( property_name && ALLOWED_MATERIAL_PROPERTIES[ property_name ] );
}

/**
 * userData key holding the values an action overwrote, so they can be put back.
 *
 * Choice actions write straight to shared materials. That is fine while every
 * choice in a layer sets the same property — the next choice overwrites it — but
 * not for a "multiple" layer where a choice can be deselected with nothing to
 * replace it, an optional layer with a "none" choice, or conditional logic that
 * hides a choice which had already applied. In all three the material keeps the
 * last value it was given.
 */
const DEFAULTS_KEY = '__pc_defaults';

/**
 * Record a value the first time an action overwrites it. Later writes do not
 * update the record, so the stored value is always the model's own.
 *
 * @param {Object} holder - Material or Object3D (anything with userData)
 * @param {string} key
 * @param {*} value
 */
function remember_default( holder, key, value ) {
	if ( ! holder ) return;
	holder.userData = holder.userData || {};
	const store = holder.userData[ DEFAULTS_KEY ] || ( holder.userData[ DEFAULTS_KEY ] = {} );
	if ( ! Object.prototype.hasOwnProperty.call( store, key ) ) {
		store[ key ] = value;
	}
}

/**
 * @param {Object} holder
 * @param {string} key
 * @returns {{ value: * }|null} Boxed so a stored null/0 is distinguishable from "not recorded"
 */
function recalled_default( holder, key ) {
	const store = holder && holder.userData && holder.userData[ DEFAULTS_KEY ];
	if ( ! store || ! Object.prototype.hasOwnProperty.call( store, key ) ) return null;
	return { value: store[ key ] };
}

/**
 * @param {THREE.Object3D} obj
 * @param {THREE.Material} material
 * @returns {THREE.Mesh[]} Meshes whose material reference was reassigned
 */
function apply_material_to_object( obj, material ) {
	const touched = [];
	if ( ! obj ) return touched;
	const assign = ( mesh ) => {
		remember_default( mesh, 'material', mesh.material );
		mesh.material = material;
		touched.push( mesh );
	};
	if ( obj.isMesh && obj.material !== undefined ) {
		assign( obj );
		return touched;
	}
	obj.traverse( ( child ) => {
		if ( child.isMesh && child.material !== undefined ) {
			assign( child );
		}
	} );
	return touched;
}

/**
 * @param {THREE.Object3D} obj
 * @returns {THREE.Mesh[]} Meshes whose material reference was put back
 */
function restore_material_on_object( obj ) {
	const touched = [];
	if ( ! obj ) return touched;
	const put_back = ( mesh ) => {
		const original = recalled_default( mesh, 'material' );
		if ( original ) {
			mesh.material = original.value;
			touched.push( mesh );
		}
	};
	if ( obj.isMesh && obj.material !== undefined ) {
		put_back( obj );
		return touched;
	}
	obj.traverse( ( child ) => {
		if ( child.isMesh && child.material !== undefined ) put_back( child );
	} );
	return touched;
}

/**
 * Announce a material mutation to whoever owns the context.
 *
 * Add-ons that install their own materials — a custom ShaderMaterial, a patched
 * material via onBeforeCompile — need to know when a choice has overwritten
 * their work, and on which meshes, so they can put it back. Without this the
 * only signal is the choice change itself, which says nothing about what in the
 * scene actually moved.
 *
 * @param {Object} context - apply_choice_actions context
 * @param {Object} payload - See the material:applied event in the runtime API
 */
function notify( context, payload ) {
	if ( ! context || typeof context.notify !== 'function' ) return;
	context.notify( Object.assign( {
		material: null,
		material_name: '',
		meshes: [],
	}, payload ) );
}

function apply_material_variant( context, action ) {
	const { target_object, target_scene } = context;
	if ( ! target_object ) return;
	const variant_name = action.material_variant_value || action.variant_select;
	if ( ! variant_name ) return;

	// selectVariant is stored on the scene root of the model that declared the
	// KHR_materials_variants extension, so walk up until one is found.
	let variant_root = target_scene || target_object;
	let select_variant = null;
	let node = variant_root;
	while ( node ) {
		if ( node.userData && node.userData.gltf_functions && typeof node.userData.gltf_functions.selectVariant === 'function' ) {
			select_variant = node.userData.gltf_functions.selectVariant;
			variant_root = node;
			break;
		}
		node = node.parent;
	}
	if ( typeof select_variant === 'function' ) {
		select_variant( variant_root, variant_name, true, null );
		// selectVariant swaps materials deep inside the glTF's own scene graph,
		// so there is no mesh list to report — only the root it ran against.
		notify( context, {
			phase: 'apply',
			action_type: 'material_variant',
			action,
			variant_root,
		} );
	}
}

function apply_material_texture( context, action ) {
	const { registry, texture_loader, request_render } = context;
	if ( ! registry ) return;
	const name = action.material_texture_material_name || action.material_name;
	const texture_url = action.material_texture_url || action.material_texture_value;
	if ( ! name || ! texture_url ) return;
	const mat = registry.get( name );
	if ( ! mat ) return;
	remember_default( mat, 'map', mat.map || null );
	const loader = texture_loader || new THREE.TextureLoader();
	loader.load( texture_url, ( texture ) => {
		texture.colorSpace = THREE.SRGBColorSpace;
		dispose_if_ours( mat );
		mat.map = texture;
		mat.needsUpdate = true;
		// Fires from the load callback, not the call that started it, so
		// listeners see the material in its finished state.
		notify( context, {
			phase: 'apply',
			action_type: 'material_texture',
			action,
			material: mat,
			material_name: name,
		} );
		// Landed after the render that ran when the choice changed.
		if ( typeof request_render === 'function' ) request_render();
	} );
}

/**
 * Release the current map only when this module put it there. The model's own
 * texture is the restore target and may be shared with other meshes, so
 * disposing it would blank them too.
 *
 * @param {THREE.Material} mat
 */
function dispose_if_ours( mat ) {
	const original = recalled_default( mat, 'map' );
	const is_original = original && original.value === mat.map;
	if ( mat.map && ! is_original && mat.map.dispose ) mat.map.dispose();
}

function restore_material_texture( context, action ) {
	const { registry } = context;
	if ( ! registry ) return;
	const name = action.material_texture_material_name || action.material_name;
	if ( ! name ) return;
	const mat = registry.get( name );
	const original = mat && recalled_default( mat, 'map' );
	if ( ! original ) return;
	dispose_if_ours( mat );
	mat.map = original.value;
	mat.needsUpdate = true;
	notify( context, {
		phase: 'restore',
		action_type: 'material_texture',
		action,
		material: mat,
		material_name: name,
	} );
}

function apply_material_color_registry( context, action ) {
	const { registry } = context;
	if ( ! registry ) return;
	const name = action.material_name;
	const color_hex = action.material_registry_color;
	if ( ! name || ! color_hex ) return;
	const mat = registry.get( name );
	if ( ! mat || ! mat.color ) return;
	remember_default( mat, 'color', mat.color.getHex() );
	mat.color.set( color_hex );
	notify( context, {
		phase: 'apply',
		action_type: 'material_color_registry',
		action,
		material: mat,
		material_name: name,
	} );
}

function restore_material_color_registry( context, action ) {
	const { registry } = context;
	if ( ! registry || ! action.material_name ) return;
	const mat = registry.get( action.material_name );
	const original = mat && mat.color && recalled_default( mat, 'color' );
	if ( ! original ) return;
	mat.color.setHex( original.value );
	notify( context, {
		phase: 'restore',
		action_type: 'material_color_registry',
		action,
		material: mat,
		material_name: action.material_name,
	} );
}

function apply_material_property( context, action ) {
	const { registry } = context;
	if ( ! registry ) return;
	const name = action.material_name;
	const prop = action.material_property_name;
	const raw = action.material_property_value;
	if ( ! name || ! prop || raw === undefined || raw === '' ) return;
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
	remember_default( mat, 'prop:' + prop, mat[ prop ] );
	mat[ prop ] = value;
	notify( context, {
		phase: 'apply',
		action_type: 'material_property',
		action,
		material: mat,
		material_name: name,
	} );
}

function restore_material_property( context, action ) {
	const { registry } = context;
	if ( ! registry ) return;
	const name = action.material_name;
	const prop = action.material_property_name;
	if ( ! name || ! prop ) return;
	const mat = registry.get( name );
	const original = mat && recalled_default( mat, 'prop:' + prop );
	if ( ! original ) return;
	mat[ prop ] = original.value;
	// Structural flags change the shader program, not just a uniform.
	if ( prop === 'transparent' || prop === 'flatShading' || prop === 'wireframe' || prop === 'vertexColors' ) {
		mat.needsUpdate = true;
	}
	notify( context, {
		phase: 'restore',
		action_type: 'material_property',
		action,
		material: mat,
		material_name: name,
	} );
}

function restore_material( context, action ) {
	const meshes = restore_material_on_object( context.target_object );
	if ( ! meshes.length ) return;
	notify( context, {
		phase: 'restore',
		action_type: 'apply_material',
		action,
		material_name: action ? action.material_name || '' : '',
		meshes,
	} );
}

function apply_material( context, action ) {
	const { registry, target_object } = context;
	if ( ! registry || ! target_object ) return;
	const name = action.material_name;
	if ( ! name ) return;
	const registry_material = registry.get( name );
	if ( ! registry_material ) return;
	const meshes = apply_material_to_object( target_object, registry_material );
	if ( ! meshes.length ) return;
	notify( context, {
		phase: 'apply',
		action_type: 'apply_material',
		action,
		material: registry_material,
		material_name: name,
		meshes,
	} );
}

/**
 * action_type → handler. toggle_visibility is applied outside the registry.
 */
export const ACTION_HANDLERS = {
	material_variant: apply_material_variant,
	material_texture: apply_material_texture,
	material_color_registry: apply_material_color_registry,
	material_property: apply_material_property,
	apply_material: apply_material,
};

/**
 * action_type → undo function. Missing entries are simply not reversible:
 * material_variant is one, because glTF variant state has no "no variant"
 * value to return to once selectVariant has run.
 */
export const RESTORE_HANDLERS = {
	material_texture: restore_material_texture,
	material_color_registry: restore_material_color_registry,
	material_property: restore_material_property,
	apply_material: restore_material,
};

/**
 * Run all non-visibility actions_3d entries against the current choice context.
 *
 * @param {Object} context
 * @param {Map} context.registry - material registry
 * @param {THREE.TextureLoader} [context.texture_loader]
 * @param {THREE.Object3D} [context.target_object]
 * @param {THREE.Object3D} [context.target_scene]
 * @param {function()} [context.request_render] - called when an async action lands
 * @param {function(Object)} [context.notify] - called after each material mutation
 * @param {Object[]} actions
 */
export function apply_choice_actions( context, actions ) {
	if ( ! Array.isArray( actions ) || ! actions.length ) return;
	actions.forEach( ( action ) => {
		const type = action && action.action_type;
		if ( ! type || type === 'toggle_visibility' ) return;
		const handler = ACTION_HANDLERS[ type ];
		if ( typeof handler === 'function' ) {
			handler( context, action );
		}
	} );
}

/**
 * Put back everything a choice's actions overwrote, in reverse order.
 *
 * Called when a choice stops being active. For a plain single-select layer this
 * is a no-op in effect — the incoming choice overwrites the same properties
 * moments later — but it is what stops a deselected choice in a "multiple"
 * layer, or one hidden by conditional logic, from leaving its material state
 * behind.
 *
 * @param {Object} context - Same shape as apply_choice_actions
 * @param {Object[]} actions
 */
export function restore_choice_actions( context, actions ) {
	if ( ! Array.isArray( actions ) || ! actions.length ) return;
	for ( let i = actions.length - 1; i >= 0; i-- ) {
		const action = actions[ i ];
		const type = action && action.action_type;
		if ( ! type || type === 'toggle_visibility' ) continue;
		const handler = RESTORE_HANDLERS[ type ];
		if ( typeof handler === 'function' ) {
			handler( context, action );
		}
	}
}
