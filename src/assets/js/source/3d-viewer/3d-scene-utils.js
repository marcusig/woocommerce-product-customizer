/**
 * Shared 3D scene utilities: lights, dispose, orbit/HDR helpers, tone mapping, object tree.
 * Used by both frontend 3D viewer and admin 3D settings.
 */
import * as THREE from 'three';
import { array } from 'three/tsl';

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
 * @param {Object} r - renderer settings (tone_mapping: 'linear' | 'aces' | string)
 * @returns {number} THREE.ToneMapping
 */
export function getToneMapping( r ) {
	if ( ! r || ! r.tone_mapping ) return THREE.NoToneMapping;
	const t = String( r.tone_mapping ).toLowerCase();
	if ( t === 'aces' ) return THREE.ACESFilmicToneMapping;
	if ( t === 'linear' ) return THREE.LinearToneMapping;
	return THREE.NoToneMapping;
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
 * Resolve environment source into a texture URL (HDR/EXR) or cubemap URLs array.
 *
 * Supported:
 * - env.mode === 'object' with env.object_id → looks up objects3d environment entry (hdri/cubemap)
 * - env.mode === 'custom' with env.custom_hdr_url → uses that URL
 * - presets (outdoor/studio) → uses built-in HDR filename
 *
 * @param {Object} env - environment settings (preset, mode, custom_hdr_url, object_id)
 * @param {string} hdrBaseUrl - base URL for preset files
 * @returns {string|string[]} HDR/EXR URL or cubemap URL array [px,nx,py,ny,pz,nz]
 */
export function getHdrUrlFromEnv( env, hdrBaseUrl ) {
	if ( ! env ) return ( hdrBaseUrl || '' ) + getDefaultHdrPresetFilename( 'outdoor' );

	// Environment from objects3d (frontend: currentProductData.objects3d)
	if ( env.mode === 'object' && env.object_id != null && String( env.object_id ).trim() !== '' ) {
		const productData = ( typeof window !== 'undefined' && window.PC && window.PC.fe && window.PC.fe.currentProductData ) ? window.PC.fe.currentProductData : null;
		const list = productData && productData.objects3d;
		const idStr = String( env.object_id ).trim();
		if ( Array.isArray( list ) ) {
			const o = list.find( ( item ) => String( item._id != null ? item._id : item.id ) === idStr );
			if ( o && o.object_type === 'environment' ) {
				const t = o.env_type != null ? String( o.env_type ).toLowerCase() : 'hdri';
				if ( t === 'cubemap' ) {
					const px = o.env_cubemap_px && o.env_cubemap_px.url;
					const nx = o.env_cubemap_nx && o.env_cubemap_nx.url;
					const py = o.env_cubemap_py && o.env_cubemap_py.url;
					const ny = o.env_cubemap_ny && o.env_cubemap_ny.url;
					const pz = o.env_cubemap_pz && o.env_cubemap_pz.url;
					const nz = o.env_cubemap_nz && o.env_cubemap_nz.url;
					if ( px && nx && py && ny && pz && nz ) {
						return [ px, nx, py, ny, pz, nz ];
					}
				} else {
					const url = o.env_hdri_file && o.env_hdri_file.url;
					if ( url ) return url;
				}
			}
		}
	}

	if ( env.mode === 'custom' && env.custom_hdr_url ) return env.custom_hdr_url;
	const p = env.preset != null ? String( env.preset ).toLowerCase() : '';
	const preset = ( p === 'studio' ) ? 'studio' : 'outdoor';
	return ( hdrBaseUrl || '' ) + getDefaultHdrPresetFilename( preset );
}

/**
 * Load an environment map (HDR or EXR) from URL. Uses HDRLoader for .hdr, EXRLoader for .exr.
 * @param {string} url - full URL to the file
 * @param {function(THREE.DataTexture)} onLoad - called with the loaded texture
 * @param {function()} [onProgress]
 * @param {function()} [onError]
 */
export function loadEnvMap( url, onLoad, onProgress, onError ) {
	if ( ! url ) {
		if ( onError ) onError();
		return;
	}
	if ( Array.isArray( url ) ) {
		const loader = new THREE.CubeTextureLoader();
		loader.load( url, ( texture ) => {
			if ( onLoad ) onLoad( texture );
		}, 
		onProgress || undefined, 
		onError || ( () => {} ) );
		return;
	}

	const isExr = /\.exr(\?|#|$)/i.test( url );
	const loaderModule = isExr ? import( 'three/addons/loaders/EXRLoader.js' ) : import( 'three/addons/loaders/HDRLoader.js' );
	loaderModule.then( ( mod ) => {
		const LoaderClass = isExr ? mod.EXRLoader : mod.HDRLoader;
		const loader = new LoaderClass();
		loader.load(
			url,
			( texture ) => {
				texture.mapping = THREE.EquirectangularReflectionMapping;
				if ( onLoad ) onLoad( texture );
			},
			onProgress || undefined,
			onError || ( () => {} )
		);
	} ).catch( onError || ( () => {} ) );
}

// -------------------------------------------------------------------------
// Light creation (3.1)
// -------------------------------------------------------------------------

/**
 * Create a light from settings (type, color, intensity, and type-specific params).
 * Optionally applies position; target must be set by caller (from ld.target or by resolving target_object_id).
 * @param {Object} settings - light_data: type?, color?, intensity?, position?, angle?, penumbra?, distance?, decay?, width?, height?, groundColor?
 * @param {number} gi - global intensity multiplier
 * @returns {THREE.Light}
 */
export function createLightFromSettings( settings, gi ) {
	const color = new THREE.Color( settings.color || '#ffffff' );
	const base = ( settings.intensity != null ) ? settings.intensity : 1;
	const intensity = base * gi;
	const type = settings.type || 'PointLight';
	let light;
	if ( type === 'AmbientLight' ) {
		light = new THREE.AmbientLight( color, intensity );
	} else if ( type === 'HemisphereLight' ) {
		const groundColor = new THREE.Color( settings.groundColor != null ? settings.groundColor : '#443333' );
		light = new THREE.HemisphereLight( color, groundColor, intensity );
	} else if ( type === 'DirectionalLight' ) {
		light = new THREE.DirectionalLight( color, intensity );
	} else if ( type === 'SpotLight' ) {
		const distance = ( settings.distance != null && settings.distance > 0 ) ? settings.distance : 0;
		const angle = settings.angle != null ? settings.angle : Math.PI / 4;
		const penumbra = settings.penumbra != null ? settings.penumbra : 0;
		const decay = settings.decay != null ? settings.decay : 2;
		light = new THREE.SpotLight( color, intensity, distance, angle, penumbra, decay );
	} else if ( type === 'RectAreaLight' ) {
		const width = settings.width != null ? settings.width : 10;
		const height = settings.height != null ? settings.height : 10;
		light = new THREE.RectAreaLight( color, intensity, width, height );
	} else {
		// PointLight (default)
		const distance = ( settings.distance != null && settings.distance > 0 ) ? settings.distance : 0;
		const decay = settings.decay != null ? settings.decay : 2;
		light = new THREE.PointLight( color, intensity, distance, decay );
	}
	light.userData = light.userData || {};
	light.userData.baseIntensity = base;
	if ( settings.position && ( settings.position.x != null || settings.position.y != null || settings.position.z != null ) ) {
		light.position.set(
			settings.position.x != null ? settings.position.x : 0,
			settings.position.y != null ? settings.position.y : 0,
			settings.position.z != null ? settings.position.z : 0
		);
	}
	if ( light.target && settings.target && ( settings.target.x != null || settings.target.y != null || settings.target.z != null ) ) {
		light.target.position.set(
			settings.target.x != null ? settings.target.x : 0,
			settings.target.y != null ? settings.target.y : 0,
			settings.target.z != null ? settings.target.z : 0
		);
	}
	// Optional explicit rotation in degrees (applied to all light types, mainly used for RectAreaLight).
	if ( settings.rotation && ( settings.rotation.x != null || settings.rotation.y != null || settings.rotation.z != null ) ) {
		const rx = ( settings.rotation.x != null ? settings.rotation.x : 0 ) * Math.PI / 180;
		const ry = ( settings.rotation.y != null ? settings.rotation.y : 0 ) * Math.PI / 180;
		const rz = ( settings.rotation.z != null ? settings.rotation.z : 0 ) * Math.PI / 180;
		light.rotation.set( rx, ry, rz );
	}
	return light;
}

/**
 * Apply a cookie (projection texture) to a light that supports it (SpotLight, DirectionalLight).
 * Loads the texture from cookie.url and sets light.map. Async.
 * @param {THREE.SpotLight|THREE.DirectionalLight} light - light with .map property
 * @param {{ url: string }|string} cookie - cookie object with url, or url string
 */
export function applyLightCookie( light, cookie ) {
	if ( ! light || ! cookie ) return;
	const url = typeof cookie === 'string' ? cookie : ( cookie.url || '' );
	if ( ! url ) return;
	if ( light.map && light.map.dispose ) light.map.dispose();
	const loader = new THREE.TextureLoader();
	loader.load( url, ( texture ) => {
		if ( light.map && light.map !== texture && light.map.dispose ) light.map.dispose();
		light.map = texture;
	} );
}

// -------------------------------------------------------------------------
// Scene light stripping & dispose (3.8)
// -------------------------------------------------------------------------

/**
 * Remove all lights (and their targets) from a scene or subtree.
 * Used to ensure only configured lights (from objects3d) are present, not GLTF-embedded lights.
 * @param {THREE.Object3D} root
 */
export function removeLightsFromScene( root ) {
	if ( ! root ) return;
	const toRemove = [];
	root.traverse( ( obj ) => {
		if ( obj && obj.isLight ) {
			toRemove.push( obj );
			if ( obj.target && obj.target.parent ) {
				toRemove.push( obj.target );
			}
		}
	} );
	toRemove.forEach( ( obj ) => {
		if ( obj.parent ) obj.parent.remove( obj );
	} );
}

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
		if ( obj.isLight && obj.map && obj.map.dispose ) obj.map.dispose();
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

const COMPOSITE_ID_SEP = ':';

/**
 * Find an object by composite id "sourceId:objectName" (e.g. attachment_id:objectName).
 * modelRoot must be the full scene root; direct children (and modelRoot itself) can have userData.attachment_id set.
 * Legacy: if id does not contain ':', looks up by name/uuid over the whole tree.
 * @param {THREE.Object3D} modelRoot - Full scene root (main + layer scenes as children)
 * @param {string} compositeId - "sourceId:objectName" or legacy "name"/"uuid"
 * @returns {THREE.Object3D|null}
 */
export function findObjectByCompositeId( modelRoot, compositeId ) {
	if ( ! modelRoot || ! compositeId ) return null;
	const id = String( compositeId ).trim();
	const sepIdx = id.indexOf( COMPOSITE_ID_SEP );
	if ( sepIdx === -1 ) {
		return findObject( modelRoot, id );
	}
	const sourceId = id.slice( 0, sepIdx );
	const objectName = id.slice( sepIdx + 1 );
	if ( ! objectName ) return null;
	const roots = [ modelRoot ].concat( modelRoot.children ? Array.from( modelRoot.children ) : [] );

	for ( let i = 0; i < roots.length; i++ ) {
		const r = roots[ i ];
		if ( ! r || ! r.userData ) continue;
		const attId = r.userData.attachment_id;
		const objId = r.userData.object_id;
		const match = ( attId != null && String( attId ) === sourceId ) || ( objId != null && String( objId ) === sourceId );
		if ( match ) {
			const obj = findObject( r, objectName );
			if ( obj ) return obj;
			return null;
		}
	}
	return null;
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
 * Build a combined bounding box from multiple objects by id; used for multi-object framing.
 * objectIds can be composite "sourceId:objectName" (e.g. attachment_id:name) or legacy name/uuid.
 * @param {THREE.Object3D} modelRoot - Scene root to search in (with userData.attachment_id on roots)
 * @param {string[]} objectIds - Array of composite ids or object names/uuids
 * @param {{ visibleOnly?: boolean }} [opts] - when visibleOnly=true, ignores objects hidden directly or via hidden parent
 * @returns {{ box: THREE.Box3, center: THREE.Vector3, size: THREE.Vector3 }|null} Combined box and center/size, or null if no valid objects found
 */
export function getBoundingBoxFromObjectIds( modelRoot, objectIds, opts = {} ) {
	if ( ! modelRoot || ! Array.isArray( objectIds ) || objectIds.length === 0 ) return null;
	const visibleOnly = opts && opts.visibleOnly === true;
	const isEffectivelyVisible = ( obj ) => {
		let current = obj;
		while ( current ) {
			if ( current.visible === false ) return false;
			current = current.parent;
		}
		return true;
	};
	const box = new THREE.Box3();
	let hasAny = false;
	for ( let i = 0; i < objectIds.length; i++ ) {
		const id = objectIds[ i ];
		if ( id == null || String( id ).trim() === '' ) continue;
		const obj = findObjectByCompositeId( modelRoot, String( id ).trim() );
		if ( ! obj ) continue;
		if ( visibleOnly && ! isEffectivelyVisible( obj ) ) continue;
		const objBox = new THREE.Box3().setFromObject( obj );
		if ( hasAny ) {
			box.union( objBox );
		} else {
			box.copy( objBox );
			hasAny = true;
		}
	}
	if ( ! hasAny ) return null;
	const center = box.getCenter( new THREE.Vector3() );
	const size = box.getSize( new THREE.Vector3() );
	return { box, center, size };
}

/**
 * Ensure unlit materials can use alpha from map/opacity when glTF omits alphaMode.
 * @param {THREE.Material} mat
 */
function ensureUnlitTransparency( mat ) {
	if ( ! mat || ! mat.isMeshBasicMaterial ) return;
	const hasAlpha = ( mat.map != null ) || ( typeof mat.opacity === 'number' && mat.opacity < 1 );
	if ( ! hasAlpha ) return;
	mat.transparent = true;
	mat.depthWrite = false;
}

/**
 * Apply default AO intensity for materials that have an AO map.
 * @param {THREE.Material} mat
 * @param {number} intensity
 */
function setDefaultAo( mat, intensity ) {
	const hasAoMap = ( mat && mat.aoMap != null );
	if ( ! hasAoMap ) return;
	mat.aoMapIntensity = intensity;
}

/**
 * Register materials from a scene in a global registry.
 * If a material with the same name already exists (different instance),
 * replace the mesh material with the registry one.
 *
 * Also normalizes unlit alpha handling and AO defaults.
 *
 * @param {{ material_registry?: Map<string,THREE.Material> }} threeCtx
 * @param {THREE.Object3D} sceneRoot
 * @param {{ defaultAoIntensity?: number }} [opts]
 */
export function registerSceneMaterials( threeCtx, sceneRoot, opts = {} ) {
	if ( ! threeCtx || ! threeCtx.material_registry || ! sceneRoot ) return;
	const registry = threeCtx.material_registry;
	const aoIntensity = ( typeof opts.defaultAoIntensity === 'number' ) ? opts.defaultAoIntensity : 0.5;

	sceneRoot.traverse( ( obj ) => {
		if ( ! obj.material ) return;
		const materials = Array.isArray( obj.material ) ? obj.material : [ obj.material ];
		const resolved = [];

		for ( let i = 0; i < materials.length; i++ ) {
			const mat = materials[ i ];
			if ( ! mat ) continue;
			ensureUnlitTransparency( mat );
			setDefaultAo( mat, aoIntensity );

			const name = ( mat.name && String( mat.name ).trim() ) || mat.uuid;
			const existing = registry.get( name );
			if ( existing !== undefined && existing !== mat ) {
				resolved.push( existing );
			} else {
				registry.set( name, mat );
				resolved.push( mat );
			}
		}

		if ( resolved.length === 1 ) obj.material = resolved[ 0 ];
		else if ( resolved.length > 1 ) obj.material = resolved;
	} );
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
 * @returns {Array<{ id: string, name: string, type: string, depth: number, uuid?: string }>}
 */
export function buildObjectTreeFromScene( root, skipTypes = OBJECT_TREE_SKIP_TYPES ) {
	const list = [];
	const isSkip = ( obj ) => obj && skipTypes.indexOf( obj.type ) !== -1;
	function add( obj, depth ) {
		if ( ! obj || isSkip( obj ) ) return;
		const name = obj.name || obj.type || ( 'Object_' + ( obj.uuid || '' ).slice( 0, 8 ) );
		const id = obj.name || obj.uuid;
		const node = { id, name, type: obj.type || '', depth };
		if ( obj.uuid ) node.uuid = obj.uuid;
		list.push( node );
		if ( obj.children && obj.children.length ) {
			obj.children.forEach( ( ch ) => add( ch, depth + 1 ) );
		}
	}
	if ( root && root.children ) {
		root.children.forEach( ( ch ) => add( ch, 0 ) );
	}
	return list;
}
