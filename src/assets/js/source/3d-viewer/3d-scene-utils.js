/**
 * Shared 3D scene utilities: lights, dispose, orbit/HDR helpers, tone mapping, object tree.
 * Used by both frontend 3D viewer and admin 3D settings.
 */
import * as THREE from 'three';

// -------------------------------------------------------------------------
// Constants (3.7)
// -------------------------------------------------------------------------

/** HDR preset filename by preset key. */
export function getDefaultHdrPresetFilename( preset ) {
	return preset === 'studio' ? 'studio_small_08_1k.hdr' : 'royal_esplanade_1k.hdr';
}

/** Object types to skip when building a scene tree (3.6). */
export const OBJECT_TREE_SKIP_TYPES = [ 'Scene', 'Camera', 'Light', 'AmbientLight', 'DirectionalLight', 'PointLight', 'SpotLight', 'RectAreaLight' ];

/**
 * Build the full list of object names to hide: default names (from PHP, filterable) + custom names from textarea.
 * All defaults come from PHP via mkl_pc_3d_default_hidden_object_names; no fallback in JS.
 * @param {string[]} [defaultNames] - Default names from PHP (filterable). Empty if not provided.
 * @param {string} [customTextarea] - Newline-separated custom names from settings.
 * @returns {string[]} Combined list, no duplicates, no empty strings.
 */
export function getHiddenObjectNamesList( defaultNames, customTextarea ) {
	const defaults = Array.isArray( defaultNames ) ? defaultNames : [];
	const set = new Set( defaults );
	if ( typeof customTextarea === 'string' && customTextarea.trim() ) {
		customTextarea.split( /[\r\n]+/ ).forEach( ( line ) => {
			const name = line.trim();
			if ( name ) set.add( name );
		} );
	}
	return [ ...set ];
}

// -------------------------------------------------------------------------
// Tone mapping and color space (3.7)
// -------------------------------------------------------------------------

/**
 * @param {Object} r - renderer settings (tone_mapping)
 * @returns {number} THREE.ToneMapping
 */
export function getToneMapping( r ) {
	if ( ! r ) THREE.ACESFilmicToneMapping;
	return r.tone_mapping;
}

/**
 * Always returns sRGB color space for the renderer.
 * @returns {number} THREE.SRGBColorSpace
 */
export function getOutputColorSpace() {
	return THREE.SRGBColorSpace;
}

// -------------------------------------------------------------------------
// Orbit limits (3.3)
// -------------------------------------------------------------------------

/**
 * @param {Object} env - environment settings (orbit_* in degrees / distance; optional orbit_zoom_limits_enabled for admin)
 * @param {{ useZoomLimitsToggle?: boolean }} [opts] - if useZoomLimitsToggle true, respect env.orbit_zoom_limits_enabled for min/max distance
 * @returns {{ minPolarAngle: number, maxPolarAngle: number, minAzimuthAngle: number, maxAzimuthAngle: number, minDistance: number, maxDistance: number }}
 */
export function getOrbitLimitsFromEnv( env, opts = {} ) {
	if ( ! env ) {
		return {
			minPolarAngle: 0,
			maxPolarAngle: ( 90 * Math.PI ) / 180,
			minAzimuthAngle: ( -180 * Math.PI ) / 180,
			maxAzimuthAngle: ( 180 * Math.PI ) / 180,
			minDistance: 0,
			maxDistance: Infinity,
		};
	}
	const minPolar = ( env.orbit_min_polar_angle != null ) ? env.orbit_min_polar_angle : 0;
	const maxPolar = ( env.orbit_max_polar_angle != null ) ? env.orbit_max_polar_angle : 90;
	const minAzimuth = ( env.orbit_min_azimuth_angle != null ) ? env.orbit_min_azimuth_angle : -180;
	const maxAzimuth = ( env.orbit_max_azimuth_angle != null ) ? env.orbit_max_azimuth_angle : 180;
	const zoomLimitsEnabled = opts.useZoomLimitsToggle === false ? true : ( env.orbit_zoom_limits_enabled !== false );
	const minDist = zoomLimitsEnabled && ( typeof env.orbit_min_distance === 'number' && env.orbit_min_distance > 0 ) ? env.orbit_min_distance : 0;
	const maxDist = zoomLimitsEnabled && ( typeof env.orbit_max_distance === 'number' && env.orbit_max_distance > 0 ) ? env.orbit_max_distance : Infinity;
	return {
		minPolarAngle: ( minPolar * Math.PI ) / 180,
		maxPolarAngle: ( maxPolar * Math.PI ) / 180,
		minAzimuthAngle: ( minAzimuth * Math.PI ) / 180,
		maxAzimuthAngle: ( maxAzimuth * Math.PI ) / 180,
		minDistance: minDist,
		maxDistance: maxDist,
	};
}

// -------------------------------------------------------------------------
// HDR URL (3.3)
// -------------------------------------------------------------------------

/**
 * @param {Object} env - environment settings (preset, mode, custom_hdr_url)
 * @param {string} hdrBaseUrl - base URL for preset files
 * @returns {string} full HDR URL
 */
export function getHdrUrlFromEnv( env, hdrBaseUrl ) {
	if ( ! env ) return ( hdrBaseUrl || '' ) + getDefaultHdrPresetFilename( 'outdoor' );
	if ( env.mode === 'custom' && env.custom_hdr_url ) return env.custom_hdr_url;
	const preset = ( env.preset === 'studio' ) ? 'studio' : 'outdoor';
	return ( hdrBaseUrl || '' ) + getDefaultHdrPresetFilename( preset );
}

// -------------------------------------------------------------------------
// Light creation (3.1)
// -------------------------------------------------------------------------

/**
 * Create a light from settings (type, color, intensity).
 * @param {Object} settings - { type?, color?, intensity? }
 * @param {number} gi - global intensity multiplier
 * @returns {THREE.Light}
 */
export function createLightFromSettings( settings, gi ) {
	const color = new THREE.Color( settings.color || '#ffffff' );
	const base = ( settings.intensity != null ) ? settings.intensity : 1;
	const intensity = base * gi;
	const type = settings.type || 'PointLight';
	let light;
	if ( type === 'DirectionalLight' ) {
		light = new THREE.DirectionalLight( color, intensity );
	} else if ( type === 'SpotLight' ) {
		light = new THREE.SpotLight( color, intensity );
	} else {
		light = new THREE.PointLight( color, intensity );
	}
	light.userData = light.userData || {};
	light.userData.baseIntensity = base;
	return light;
}

// -------------------------------------------------------------------------
// Scene dispose (3.5)
// -------------------------------------------------------------------------

/**
 * Traverse scene and dispose geometries and materials (and material maps).
 * @param {THREE.Object3D} scene
 */
export function disposeScene( scene ) {
	if ( ! scene ) return;
	scene.traverse( ( obj ) => {
		if ( obj.geometry ) obj.geometry.dispose();
		if ( obj.material ) {
			const mats = Array.isArray( obj.material ) ? obj.material : [ obj.material ];
			mats.forEach( ( m ) => {
				if ( m && m.dispose ) m.dispose();
				if ( m && m.map && m.map.dispose ) m.map.dispose();
			} );
		}
	} );
}

// -------------------------------------------------------------------------
// Object lookup and target position
// -------------------------------------------------------------------------

/**
 * Find an object in the scene by name or uuid.
 * @param {THREE.Object3D} root
 * @param {string} objectId - object name or uuid
 * @returns {THREE.Object3D|null}
 */
export function findObject( root, objectId ) {
	if ( ! root || ! objectId ) return null;
	let found = null;
	root.traverse( ( obj ) => {
		if ( found ) return;
		if ( obj.name === objectId || ( obj.uuid && obj.uuid === objectId ) ) {
			found = obj;
		}
	} );
	return found;
}

/**
 * Get world-space target position for an object (bounding box center).
 * @param {THREE.Object3D} obj
 * @param {THREE.Vector3} [target] - optional vector to write into
 * @returns {THREE.Vector3}
 */
export function getObjectTargetPosition( obj, target = new THREE.Vector3() ) {
	if ( ! obj ) return target;
	const box = new THREE.Box3().setFromObject( obj );
	return box.getCenter( target );
}

/**
 * Hide all objects whose name is in the given list (traverses root).
 * @param {THREE.Object3D} root
 * @param {string[]} names
 */
export function hideObjectsByName( root, names ) {
	if ( ! root || ! Array.isArray( names ) || names.length === 0 ) return;
	const set = new Set( names );
	root.traverse( ( obj ) => {
		if ( obj.name && set.has( obj.name ) ) {
			obj.visible = false;
		}
	} );
}

// -------------------------------------------------------------------------
// Object tree (3.6)
// -------------------------------------------------------------------------

/**
 * Build a plain object tree from a scene root (no Three.js refs stored).
 * @param {THREE.Object3D} root
 * @param {string[]} [skipTypes] - optional override; defaults to OBJECT_TREE_SKIP_TYPES
 * @returns {Array<{ id: string, name: string, type: string, depth: number }>}
 */
export function buildObjectTreeFromScene( root, skipTypes = OBJECT_TREE_SKIP_TYPES ) {
	const list = [];
	const isSkip = ( obj ) => obj && skipTypes.indexOf( obj.type ) !== -1;
	function add( obj, depth ) {
		if ( ! obj || isSkip( obj ) ) return;
		const name = obj.name || obj.type || ( 'Object_' + ( obj.uuid || '' ).slice( 0, 8 ) );
		const id = obj.name || obj.uuid;
		list.push( { id, name, type: obj.type || '', depth } );
		if ( obj.children && obj.children.length ) {
			obj.children.forEach( ( ch ) => add( ch, depth + 1 ) );
		}
	}
	if ( root && root.children ) {
		root.children.forEach( ( ch ) => add( ch, 0 ) );
	}
	return list;
}
