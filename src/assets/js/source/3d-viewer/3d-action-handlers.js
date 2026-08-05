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

function apply_material_to_object( obj, material ) {
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
}

function apply_material_variant( context, action ) {
	const { target_object, target_scene, three } = context;
	if ( ! target_object ) return;
	const variant_name = action.material_variant_value || action.variant_select;
	if ( ! variant_name ) return;

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
	if ( ! select_variant ) {
		select_variant = three.gltf && three.gltf.functions && three.gltf.functions.selectVariant;
	}
	if ( typeof select_variant === 'function' ) {
		select_variant( variant_root, variant_name, true, null );
	}
}

function apply_material_texture( context, action ) {
	const { registry, texture_loader } = context;
	if ( ! registry ) return;
	const name = action.material_texture_material_name || action.material_name;
	const texture_url = action.material_texture_url || action.material_texture_value;
	if ( ! name || ! texture_url ) return;
	const mat = registry.get( name );
	if ( ! mat ) return;
	const loader = texture_loader || new THREE.TextureLoader();
	loader.load( texture_url, ( texture ) => {
		texture.colorSpace = THREE.SRGBColorSpace;
		if ( mat.map && mat.map.dispose ) mat.map.dispose();
		mat.map = texture;
		mat.needsUpdate = true;
	} );
}

function apply_material_color_registry( context, action ) {
	const { registry } = context;
	if ( ! registry ) return;
	const name = action.material_name;
	const color_hex = action.material_registry_color;
	if ( ! name || ! color_hex ) return;
	const mat = registry.get( name );
	if ( mat && mat.color ) mat.color.set( color_hex );
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
	mat[ prop ] = value;
}

function apply_material( context, action ) {
	const { registry, target_object } = context;
	if ( ! registry || ! target_object ) return;
	const name = action.material_name;
	if ( ! name ) return;
	const registry_material = registry.get( name );
	if ( ! registry_material ) return;
	apply_material_to_object( target_object, registry_material );
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
 * Run all non-visibility actions_3d entries against the current choice context.
 *
 * @param {Object} context
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
