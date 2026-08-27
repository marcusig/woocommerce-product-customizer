/**
 * Shared 3D scene utilities: lights, dispose, orbit/HDR helpers, tone mapping, object tree.
 * Used by both frontend 3D viewer and admin 3D settings.
 */
import * as THREE from 'three';

// -------------------------------------------------------------------------
// Constants (3.7)
// -------------------------------------------------------------------------

/**
 * Cube-face sizes a blurred environment is captured at, sharpest first.
 *
 * Size is half the blur: fewer pixels hold less detail. It also sets the ceiling
 * on how far the convolution can go, which is why both move together — see
 * getEnvironmentBlurParams.
 */
const ENV_BLUR_SIZES = [ 256, 128, 64, 32, 16 ];

/**
 * Cache key for a loaded environment.
 *
 * Blur belongs in the key because it is baked into the PMREM when the map is
 * generated, not applied to it afterwards — two blur levels are two different
 * textures. Both the eager load in the viewer and the settings pass build the key
 * from here, because when they disagreed the viewer fetched the HDR twice.
 *
 * @param {string|string[]|null} url - Environment URL, or cubemap face list
 * @param {number} blur - 0..1
 * @returns {string|null} Key, or null when there is no environment
 */
export function getEnvironmentKey( url, blur ) {
	const base = Array.isArray( url ) ? url.join( '|' ) : ( url || null );
	if ( ! base ) return null;
	const numeric = typeof blur === 'number' ? blur : parseFloat( blur );
	return base + '#blur:' + ( Number.isFinite( numeric ) ? numeric : 0 );
}

/**
 * Widest blur, in radians, at the top of the slider.
 *
 * Not the widest three can produce — that is about 0.62, and the first attempt
 * used it. It made the control useless: everything past roughly 0.15 was already
 * a shapeless wash, so the entire usable range was crammed into the bottom
 * seventh of the travel. This is that usable range spread across the whole
 * slider, which costs nothing real, since a blur wide enough to erase the
 * environment is not a setting anyone reaches for.
 */
const MAX_ENV_BLUR_SIGMA = 0.1;

/**
 * Capture size and blur radius for a 0..1 environment blur strength.
 *
 * three blurs in radians but caps the filter at 20 taps and warns past that:
 *
 *     pixels  = size - 1
 *     taps    = 1 + floor( 3 * sigma / ( PI / ( 2 * pixels ) ) )
 *
 * So a given sigma is only affordable at a small enough capture — about 0.039 rad
 * is all the default 256 can serve, which is barely a blur.
 *
 * Sigma therefore leads and size follows: the requested blur is taken at face
 * value, and the capture drops to the largest size whose tap budget can pay for
 * it. Deriving it the other way round — stepping size and sweeping sigma within
 * each step — made the control non-monotonic, because sigma fell back to zero
 * every time the size halved and the image could come out sharper as the slider
 * went up.
 *
 * @param {number} blur - 0..1, where 0 means no blur at all
 * @returns {{size: number, sigma: number}|null} Null when there is nothing to do
 */
export function getEnvironmentBlurParams( blur ) {
	const numeric = typeof blur === 'number' ? blur : parseFloat( blur );
	const strength = Number.isFinite( numeric ) ? Math.min( 1, Math.max( 0, numeric ) ) : 0;
	if ( strength <= 0 ) return null;

	const sigma = MAX_ENV_BLUR_SIGMA * strength;
	// Solving taps <= 19 for the pixel count, one under the cap so the filter
	// never clips: pixels <= 19 * PI / ( 6 * sigma ).
	const max_pixels = ( 19 * Math.PI ) / ( 6 * sigma );

	let size = ENV_BLUR_SIZES[ ENV_BLUR_SIZES.length - 1 ];
	for ( let i = 0; i < ENV_BLUR_SIZES.length; i++ ) {
		if ( ENV_BLUR_SIZES[ i ] - 1 <= max_pixels ) {
			size = ENV_BLUR_SIZES[ i ];
			break;
		}
	}

	return { size, sigma };
}

/**
 * Build a blurred copy of an environment map.
 *
 * Blurs what the materials actually sample, so lighting and reflections soften
 * together — scene.backgroundBlurriness cannot do this, it only touches the
 * backdrop. The route is PMREMGenerator.fromScene, whose sigma argument is the
 * only blur three exposes on the generating side; fromEquirectangular has none.
 * The source texture is handed over as a throwaway scene's background because
 * that is what fromScene captures.
 *
 * Tone mapping is not a worry here: fromScene forces NoToneMapping while it
 * captures and restores it afterwards, so the result carries the same radiance
 * as the unblurred map.
 *
 * @param {THREE.WebGLRenderer} renderer
 * @param {THREE.Texture} texture - Loaded environment map
 * @param {number} blur - 0..1
 * @returns {THREE.Texture|null} Blurred texture, or null when no blur applies
 */
export function blurEnvironmentTexture( renderer, texture, blur ) {
	const params = getEnvironmentBlurParams( blur );
	if ( ! params || ! renderer || ! texture ) return null;

	const generator = new THREE.PMREMGenerator( renderer );
	const source = new THREE.Scene();
	source.background = texture;

	let target = null;
	try {
		target = generator.fromScene( source, params.sigma, 0.1, 100, { size: params.size } );
	} catch ( err ) {
		console.warn( '3D viewer: could not blur the environment map', err );
		return null;
	} finally {
		generator.dispose();
		// Leave the caller's texture where it found it; the scene is scrap.
		source.background = null;
	}

	// The render target owns the framebuffer behind this texture, and disposing
	// the texture alone would leak it. setSceneEnvironment looks for this.
	target.texture.userData.pcPmremTarget = target;
	return target.texture;
}

/** HDR preset filename by preset key. */
export function getDefaultHdrPresetFilename( preset ) {
	return preset === 'studio' ? 'studio_small_08_1k.hdr' : 'royal_esplanade_1k.hdr';
}

/**
 * Upper bound for the renderer's pixel ratio.
 *
 * A modern phone reports devicePixelRatio 3, which is 9x the fragment work of a
 * 1x buffer. The postprocessing add-on already caps its own composer buffers for
 * this reason; without the same cap on the renderer the canvas backing store is
 * still allocated at the raw ratio, so the composer result is upscaled onto it
 * and most of the saving is given back on the final blit.
 */
export const MAX_PIXEL_RATIO = 2;

/**
 * Ratio multiplier applied while the user is dragging the model. Dropping
 * resolution keeps the effect chain running — so the look stays consistent —
 * where bypassing postprocessing makes the image visibly jump on every touch.
 */
export const ORBIT_PIXEL_RATIO_SCALE = 0.75;

/**
 * Device pixel ratio, capped.
 *
 * @param {number} [max=MAX_PIXEL_RATIO]
 * @returns {number}
 */
export function getPixelRatio( max = MAX_PIXEL_RATIO ) {
	const raw = ( typeof window !== 'undefined' && window.devicePixelRatio ) ? window.devicePixelRatio : 1;
	return Math.max( 1, Math.min( raw, max ) );
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
 * Zoom limits apply unless `env.orbit_zoom_limits_enabled` is explicitly false;
 * angle limits always apply.
 *
 * @param {Object} env - environment settings (orbit_* in degrees / distance; orbit_zoom_limits_enabled)
 * @returns {{ minPolarAngle: number, maxPolarAngle: number, minAzimuthAngle: number, maxAzimuthAngle: number, minDistance: number, maxDistance: number }}
 */
export function getOrbitLimitsFromEnv( env ) {
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
	const zoomLimitsEnabled = env.orbit_zoom_limits_enabled !== false;
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
 * - env.mode === 'none' → no environment map (unlit / baked lighting)
 * - env.mode === 'object' with env.object_id → looks up objects3d environment entry (hdri/cubemap)
 * - env.mode === 'custom' with env.custom_hdr_url → uses that URL
 * - presets (outdoor/studio) → uses built-in HDR filename
 *
 * @param {Object} env - environment settings (preset, mode, custom_hdr_url, object_id)
 * @param {string} hdrBaseUrl - base URL for preset files
 * @param {Array|null} [objects3d] - objects3d entries to resolve `mode: 'object'` against.
 *        Defaults to the frontend product data; the admin passes its own collection so both
 *        contexts resolve the environment through this one function.
 * @returns {string|string[]|null} HDR/EXR URL, cubemap URL array [px,nx,py,ny,pz,nz], or null when none
 */
export function getHdrUrlFromEnv( env, hdrBaseUrl, objects3d = null ) {
	if ( env && env.mode === 'none' ) return null;
	if ( ! env ) return ( hdrBaseUrl || '' ) + getDefaultHdrPresetFilename( 'outdoor' );

	// Environment from objects3d (frontend: currentProductData.objects3d)
	if ( env.mode === 'object' && env.object_id != null && String( env.object_id ).trim() !== '' ) {
		const productData = ( typeof window !== 'undefined' && window.PC && window.PC.fe && window.PC.fe.currentProductData ) ? window.PC.fe.currentProductData : null;
		const list = Array.isArray( objects3d ) ? objects3d : ( productData && productData.objects3d );
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
 * Assign or clear the scene environment map, disposing the previous texture.
 *
 * @param {THREE.Scene} scene
 * @param {THREE.Texture|null} texture
 */
export function setSceneEnvironment( scene, texture ) {
	if ( ! scene ) return;
	const previous = scene.environment;
	if ( previous === texture ) return;
	if ( previous && scene.background === previous ) {
		scene.background = texture || null;
	}
	if ( previous && typeof previous.dispose === 'function' ) {
		// A blurred environment is the texture of a render target, and that target
		// owns the framebuffer. Disposing the texture on its own would leave it.
		const pmrem_target = previous.userData && previous.userData.pcPmremTarget;
		if ( pmrem_target && typeof pmrem_target.dispose === 'function' ) {
			pmrem_target.dispose();
		} else {
			previous.dispose();
		}
	}
	scene.environment = texture || null;
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
 * @param {function()} [onLoaded] - called once the texture is applied, so an
 *        on-demand renderer knows the scene changed after the async load
 */
export function applyLightCookie( light, cookie, onLoaded ) {
	if ( ! light || ! cookie ) return;
	const url = typeof cookie === 'string' ? cookie : ( cookie.url || '' );
	if ( ! url ) return;
	if ( light.map && light.map.dispose ) light.map.dispose();
	const loader = new THREE.TextureLoader();
	loader.load( url, ( texture ) => {
		texture.colorSpace = THREE.SRGBColorSpace;
		if ( light.map && light.map !== texture && light.map.dispose ) light.map.dispose();
		light.map = texture;
		if ( typeof onLoaded === 'function' ) onLoaded();
	} );
}

// -------------------------------------------------------------------------
// Scene light stripping & dispose (3.8)
// -------------------------------------------------------------------------

// -------------------------------------------------------------------------
// Real-time shadows
// -------------------------------------------------------------------------

/** Default shadow map resolution per light. */
export const DEFAULT_SHADOW_MAP_SIZE = 2048;

/**
 * Penumbra half-width at softness 0 and 1, as a fraction of the model radius.
 *
 * These are what the old texel-based radius (1..16) worked out to on a 2048 map
 * at the frustum the fit used to produce, so a product tuned before this reads
 * the same after it.
 */
const MIN_PENUMBRA_RATIO = 0.001123;
const MAX_PENUMBRA_RATIO = 0.045;

/**
 * Never blur by less than this, whatever the world-space penumbra works out to.
 *
 * The floor is in texels rather than world units because what it exists to hide
 * is a texel-space artifact: below about two texels the blur is narrower than the
 * shadow map's own staircase, so the softness setting stops doing anything visible
 * and the edge is raw stair-stepping. At the bottom of the range that came out at
 * 0.4 texels, which is why 0 read as unusable rather than as "sharp".
 */
const MIN_BLUR_TEXELS = 2;

/**
 * Widest gap allowed between blur taps, in texels.
 *
 * three spreads blurSamples evenly across the whole kernel, so samples and radius
 * have to move together: a fixed count stretched over a growing radius is what
 * leaves gaps, and gaps are what banding is. Comfortably under one texel here,
 * because the tap count is cheap next to being unable to trust the top of the
 * range.
 */
const MAX_BLUR_TAP_SPACING = 0.9;

/** Light types that can cast a real-time shadow. */
export function supportsLightShadows( light ) {
	return !! ( light && ( light.isDirectionalLight || light.isSpotLight || light.isPointLight ) );
}

/**
 * Enable or disable shadow casting/receiving on every mesh in a subtree.
 * @param {THREE.Object3D} root
 * @param {boolean} enabled
 */
export function applyShadowFlagsToObject( root, enabled ) {
	if ( ! root || ! root.traverse ) return;
	root.traverse( ( obj ) => {
		if ( obj.isMesh ) {
			obj.castShadow = !! enabled;
			obj.receiveShadow = !! enabled;
		}
	} );
}

/**
 * How far past the model the frustum may stretch to follow a shadow, as a
 * multiple of the model radius.
 *
 * A shadow's reach across the ground is height / tan( elevation ), which goes to
 * infinity as the light approaches the horizon. Uncapped, a near-horizontal light
 * would take the texel density down with it — the shadow map covers the frustum,
 * so a frustum ten times too big is a shadow ten times too coarse. Past this the
 * far end of a very long shadow is clipped, which is the lesser of the two.
 */
const MAX_SHADOW_FIT_SCALE = 6;

/**
 * How much of the penumbra's natural stretch along a grazing shadow to keep.
 *
 * A penumbra is a fixed angular width at the light, so landing on the ground at a
 * grazing angle it is stretched by 1/sin(elevation) along the shadow and not at
 * all across it. The shadow map gets that for free — a foreshortened axis stretches
 * whatever is drawn on it — but fitting the frustum tightly in light space shrinks
 * the texels by exactly the factor the projection was about to stretch them by,
 * and the two cancel. That is how a round penumbra ended up on a shadow that
 * should have had a long one.
 *
 * 0 keeps none of it (a tight fit, isotropic, what this used to do), 1 keeps all
 * of it (a square light-space box, the physically correct 1/sin). In between
 * trades it against resolution: the along axis is stretched by
 * 1/sin(elevation)^BIAS, and its texels get coarser by the same factor. Half is a
 * reasonable place to sit, because the axis losing resolution is the one whose
 * penumbra is widest — the detail being given up there is detail the blur was
 * going to destroy anyway.
 */
const SHADOW_ALONG_BIAS = 4;

/** Cap on that stretch, since 1/sin runs away as the light approaches the horizon. */
const MAX_SHADOW_ALONG_BIAS = 4;

/** Scratch for the directional fit; it runs on change, but not rarely enough to allocate. */
const _fit_matrix = new THREE.Matrix4();
const _fit_point = new THREE.Vector3();
const _fit_projected = new THREE.Vector3();
const _fit_light_space = new THREE.Vector3();
const _fit_ground_a = new THREE.Vector3();
const _fit_ground_b = new THREE.Vector3();

/**
 * Fit a directional light's orthographic shadow camera to the model *and to the
 * ground its shadow falls on*.
 *
 * Fitting to the model alone is right for the caster and wrong for the receiver.
 * The shadow map covers the frustum and nothing outside it is shadowed at all, so
 * a low elevation — where the shadow stretches far past the model's own footprint
 * — had the shadow stop dead along a straight line in mid-air. Enlarging the
 * ground plane could not help: the crop was the shadow camera, not the plane.
 *
 * So the box is fitted to the eight model corners plus where each of them throws
 * its shadow, in the light's own space. Asymmetric on purpose: the shadow only
 * goes one way, and a symmetric box would spend half its resolution on the empty
 * side. At the default elevation this adds about a metre to a car's frustum; it
 * only grows to matter when the merchant actually asks for a long shadow.
 *
 * @param {THREE.DirectionalLight} light
 * @param {THREE.Box3} bounds
 * @param {THREE.Sphere} sphere - Bounding sphere of the same bounds
 * @param {number} radius - Bounding sphere radius, already floored
 */
function fitDirectionalShadowCamera( light, bounds, sphere, radius, ground_extent ) {
	const camera = light.shadow.camera;
	const eye = light.getWorldPosition( new THREE.Vector3() );
	const target = light.target
		? light.target.getWorldPosition( new THREE.Vector3() )
		: sphere.center.clone();

	// The same basis three gives the shadow camera at render time — it positions
	// the camera at the light and lookAt()s the target with the camera's own up —
	// so the box fitted here is the box that actually gets used.
	_fit_matrix.lookAt( eye, target, camera.up );
	_fit_matrix.setPosition( eye );
	_fit_matrix.invert();

	const direction = target.clone().sub( eye ).normalize();
	const ground_y = bounds.min.y;
	const max_extent = radius * MAX_SHADOW_FIT_SCALE;

	let min_x = Infinity, max_x = - Infinity;
	let min_y = Infinity, max_y = - Infinity;
	let min_z = Infinity, max_z = - Infinity;

	// Depth and area are fitted to different things on purpose. A shadow lands on
	// the same shadow-map texel as the thing casting it, so the area only ever has
	// to cover the caster — widening it to the ground would spend most of the map
	// on empty floor. Depth is the opposite: the receiver is further from the light
	// than the caster, and anything past the far plane fails three's
	// `shadowCoord.z <= 1.0` test and comes out lit. Because the far plane is
	// perpendicular to the light, where it crossed the ground it drew a straight
	// line across the shadow, perpendicular to its direction.
	const include = ( point, depth_only ) => {
		_fit_light_space.copy( point ).applyMatrix4( _fit_matrix );
		min_z = Math.min( min_z, _fit_light_space.z );
		max_z = Math.max( max_z, _fit_light_space.z );
		if ( depth_only ) return;
		min_x = Math.min( min_x, _fit_light_space.x );
		max_x = Math.max( max_x, _fit_light_space.x );
		min_y = Math.min( min_y, _fit_light_space.y );
		max_y = Math.max( max_y, _fit_light_space.y );
	};

	for ( let i = 0; i < 8; i ++ ) {
		_fit_point.set(
			( i & 1 ) ? bounds.max.x : bounds.min.x,
			( i & 2 ) ? bounds.max.y : bounds.min.y,
			( i & 4 ) ? bounds.max.z : bounds.min.z
		);
		include( _fit_point );

		// Where this corner's shadow lands on the ground.
		if ( direction.y < - 1e-4 ) {
			const reach = ( ground_y - _fit_point.y ) / direction.y;
			if ( reach > 0 ) {
				_fit_projected.copy( _fit_point ).addScaledVector( direction, Math.min( reach, max_extent ) );
				include( _fit_projected );
			}
		}
	}

	// The whole receiving plane, in every axis — not depth only.
	//
	// The plane is the independent variable here and the frustum follows it. The
	// other way round does not work: clamping the plane to a tightly fitted
	// frustum throttles it to the *narrowest* axis, and a square plane cannot be
	// wide across the shadow and long along it. That crops the shadow at a low
	// angle, which is exactly where the length matters.
	//
	// It costs texel density — the map is spread over the plane rather than the
	// product — and that cost is what MAX_SHADOW_REACH_SCALE exists to bound.
	const half = Math.max( Number( ground_extent ) || 0, 0 ) / 2;
	const centre_x = ( bounds.min.x + bounds.max.x ) / 2;
	const centre_z = ( bounds.min.z + bounds.max.z ) / 2;
	if ( half > 0 ) {
		for ( let i = 0; i < 4; i ++ ) {
			_fit_point.set(
				centre_x + ( ( i & 1 ) ? half : - half ),
				ground_y,
				centre_z + ( ( i & 2 ) ? half : - half )
			);
			include( _fit_point );
		}
	}

	const margin = radius * 0.15;
	camera.left = Math.max( min_x - margin, - max_extent );
	camera.right = Math.min( max_x + margin, max_extent );
	camera.bottom = Math.max( min_y - margin, - max_extent );
	camera.top = Math.min( max_y + margin, max_extent );

	// Give the along axis back some of the stretch the tight fit cancelled. Applied
	// after the box is fitted, so it only ever adds coverage — it cannot crop.
	if ( SHADOW_ALONG_BIAS > 0 ) {
		const sin_elevation = Math.min( 1, Math.max( 0.02, - direction.y ) );
		const bias = Math.min(
			MAX_SHADOW_ALONG_BIAS,
			1 / Math.pow( sin_elevation, SHADOW_ALONG_BIAS )
		);
		camera.top *= bias;
		camera.bottom *= bias;
	}
	// Light space looks down -Z, so the nearest point has the largest z.
	camera.near = Math.max( - max_z - margin, 1e-4 );
	camera.far = Math.max( - min_z + margin, camera.near + radius );
	camera.updateProjectionMatrix();

	// How far across the ground this frustum actually reaches, so the catcher can
	// be kept inside it.
	//
	// Nothing outside the frustum is shadowed at all, and the boundary is a hard
	// edge — the top and bottom planes cut the ground in a line perpendicular to
	// the shadow. A plane that extends past it shows that line. Measured rather
	// than derived: step a metre along the ground each way, see how far that moves
	// in light space, and divide the frustum's half-extents by it.
	_fit_ground_a.set( centre_x, ground_y, centre_z ).applyMatrix4( _fit_matrix );
	const along = new THREE.Vector3( direction.x, 0, direction.z );
	if ( along.lengthSq() < 1e-8 ) along.set( 0, 0, 1 );
	along.normalize();
	_fit_ground_b.set( centre_x + along.x, ground_y, centre_z + along.z ).applyMatrix4( _fit_matrix );
	const per_metre_y = Math.abs( _fit_ground_b.y - _fit_ground_a.y );
	_fit_ground_b.set( centre_x - along.z, ground_y, centre_z + along.x ).applyMatrix4( _fit_matrix );
	const per_metre_x = Math.abs( _fit_ground_b.x - _fit_ground_a.x );

	const half_along = per_metre_y > 1e-4 ? Math.min( - camera.bottom, camera.top ) / per_metre_y : Infinity;
	const half_across = per_metre_x > 1e-4 ? Math.min( - camera.left, camera.right ) / per_metre_x : Infinity;
	light.userData.pc_shadow_ground_half = Math.min( half_along, half_across );
}

/**
 * Fit a light's shadow camera to the model.
 *
 * Three's defaults assume a scene tens of units across (spot/point near 0.5 far 500,
 * directional a fixed 10x10x500 box). On a product modelled in metres that spends
 * almost all of the depth range — and, for directional lights, almost all of the
 * shadow map's area — on empty space, which is what makes shadows look coarse and
 * forces large biases. Sizing the camera to the actual bounds is the single biggest
 * quality win available here.
 *
 * @param {THREE.Light} light
 * @param {THREE.Box3} bounds - World-space bounds of the model
 */
export function fitShadowCameraToBounds( light, bounds, options = {} ) {
	if ( ! light || ! light.shadow || ! light.shadow.camera ) return;
	if ( ! bounds || bounds.isEmpty() ) return;

	const sphere = bounds.getBoundingSphere( new THREE.Sphere() );
	const radius = Math.max( sphere.radius, 1e-4 );
	const camera = light.shadow.camera;

	const light_position = light.getWorldPosition( new THREE.Vector3() );
	const distance = light_position.distanceTo( sphere.center );

	// Keep the whole model inside the frustum with a margin for orbiting.
	const margin = radius * 1.5;

	if ( light.isDirectionalLight ) {
		fitDirectionalShadowCamera( light, bounds, sphere, radius, options.groundExtent );
		return;
	}

	if ( light.isPointLight ) {
		// Omnidirectional: the camera sits at the light, so near must simply be small.
		camera.near = Math.max( radius * 0.01, 1e-4 );
		camera.far = Math.max( distance + margin, camera.near + radius );
	} else {
		camera.near = Math.max( distance - margin, radius * 0.01, 1e-4 );
		camera.far = Math.max( distance + margin, camera.near + radius );
	}

	camera.updateProjectionMatrix();
}

/**
 * Apply the full shadow configuration to a light.
 *
 * @param {THREE.Light} light
 * @param {Object} options
 * @param {boolean} options.enabled - Global "real-time shadows" setting
 * @param {boolean} options.castShadows - This light's own cast_shadows setting
 * @param {THREE.Box3} [options.bounds] - World-space model bounds
 * @param {number} [options.mapSize=DEFAULT_SHADOW_MAP_SIZE]
 */
export function applyShadowSettingsToLight( light, options = {} ) {
	if ( ! light ) return;

	const cast = !! ( options.enabled && options.castShadows && supportsLightShadows( light ) );
	light.castShadow = cast;
	if ( ! cast || ! light.shadow ) return;

	const map_size = options.mapSize || DEFAULT_SHADOW_MAP_SIZE;
	if ( light.shadow.mapSize.width !== map_size || light.shadow.mapSize.height !== map_size ) {
		light.shadow.mapSize.width = map_size;
		light.shadow.mapSize.height = map_size;
		// mapSize is baked into the render target, so an existing one must go.
		if ( light.shadow.map ) {
			light.shadow.map.dispose();
			light.shadow.map = null;
		}
	}

	fitShadowCameraToBounds( light, options.bounds, { groundExtent: options.groundExtent } );

	// Everything below is specified in world units and converted through the size
	// of one shadow-map texel, read back from the camera the fit just sized.
	//
	// That indirection is the whole point. shadow.radius and normalBias are both
	// in texels, and a texel is only as big as the frustum divided by the map — so
	// a fixed texel value meant one thing on a 2048 desktop map and twice as much
	// on a 1024 phone, and now would also drift every time a low shadow angle
	// widened the frustum to cover its own reach. Working in world units and
	// converting here makes each setting mean one thing everywhere.
	let texel_world_size = null;
	let bounds_radius = null;
	if ( options.bounds && ! options.bounds.isEmpty() ) {
		const sphere = options.bounds.getBoundingSphere( new THREE.Sphere() );
		bounds_radius = Math.max( sphere.radius, 1e-4 );
	}
	const shadow_camera = light.shadow.camera;
	if ( light.isDirectionalLight && shadow_camera && shadow_camera.isOrthographicCamera ) {
		// The across axis, not the larger of the two. Texels are deliberately
		// anisotropic now, and this is the axis the softness setting refers to: the
		// penumbra's width measured across the shadow, which is the one the light's
		// angle does not stretch. The along axis then comes out wider by the bias,
		// which is the entire point of applying it.
		texel_world_size = Math.max( ( shadow_camera.right - shadow_camera.left ) / map_size, 1e-6 );
	} else if ( bounds_radius != null ) {
		// Perspective shadows have no single texel size — it grows with distance —
		// so the model's own scale is the best available stand-in.
		texel_world_size = ( bounds_radius * 2 ) / map_size;
	}

	// Softness, as a penumbra width proportional to the product. The ratios are
	// the range the texel-based version happened to produce on a 2048 map at the
	// original frustum, so nothing already tuned moves.
	if ( options.softness != null ) {
		const softness = Math.min( 1, Math.max( 0, Number( options.softness ) || 0 ) );
		if ( texel_world_size != null && bounds_radius != null ) {
			const penumbra = bounds_radius * (
				MIN_PENUMBRA_RATIO + softness * ( MAX_PENUMBRA_RATIO - MIN_PENUMBRA_RATIO )
			);
			light.shadow.radius = Math.min(
				48,
				Math.max( MIN_BLUR_TEXELS, penumbra / texel_world_size )
			);
		} else {
			light.shadow.radius = 1 + softness * 15;
		}
		// Enough taps to keep the kernel continuous at whatever radius that came to.
		light.shadow.blurSamples = Math.min( 48, Math.max(
			4,
			Math.round( ( 2 * light.shadow.radius ) / MAX_BLUR_TAP_SPACING ) + 1
		) );
	}

	// normalBias is in world units, so derive it from roughly two shadow texels.
	// A fixed value (the old 0.02) is 2cm — enormous on a small product, which is
	// what detaches shadows from the surfaces casting them.
	let normal_bias = 0.02;
	if ( texel_world_size != null && bounds_radius != null ) {
		normal_bias = Math.min( Math.max( texel_world_size * 2, 1e-5 ), bounds_radius * 0.05 );
	}

	if ( light.isPointLight ) {
		light.shadow.bias = -0.0005;
	} else {
		light.shadow.bias = -0.0001;
		light.shadow.normalBias = normal_bias;
	}
}

/**
 * Mirror the global shadow setting onto the renderer.
 * @param {THREE.WebGLRenderer} renderer
 * @param {boolean} enabled
 */
/** Marks the viewer's own shadow light, so scene code can tell it from a real one. */
export const SHADOW_LIGHT_NAME = 'PC_ShadowLight';

/**
 * A light that casts a shadow and gives no light.
 *
 * Intensity zero is not a trick: ShadowMaterial takes its alpha from
 * 1 - getShadowMask(), and getShadowMask is built only from shadow parameters —
 * bias, radius, shadow.intensity. The light's brightness never enters it. So this
 * puts a shadow on the catcher while contributing nothing to how the product is
 * lit, and nothing to self-shadowing either.
 *
 * Owning the light is what makes the mode work at all. Depending on the product's
 * own lighting meant depending on something most products do not have: of the
 * eight configured here, five have no lights whatsoever and none of the other
 * three has a light flagged to cast. The shadow now arrives with its own.
 *
 * @returns {THREE.DirectionalLight}
 */
export function createShadowLight() {
	const light = new THREE.DirectionalLight( 0xffffff, 0 );
	light.name = SHADOW_LIGHT_NAME;
	light.castShadow = true;
	// refreshSceneShadows reads this to decide which lights get fitted.
	light.userData.cast_shadows = true;
	light.userData.pc_shadow_light = true;
	return light;
}

/**
 * Point the shadow light at the model from a given elevation and azimuth.
 *
 * Direction is a property of the shadow rather than of the lighting now, which is
 * the point of owning the light: the product can be lit by an environment from
 * anywhere while its shadow falls where the merchant wants it.
 *
 * @param {THREE.DirectionalLight} light
 * @param {THREE.Box3} bounds - Model bounds
 * @param {Object} [options]
 * @param {number} [options.elevation=55] - Degrees above the horizon
 * @param {number} [options.azimuth=135] - Degrees around, 0 looking down -Z
 */
export function aimShadowLight( light, bounds, options = {} ) {
	if ( ! light || ! bounds || bounds.isEmpty() ) return;
	const centre = bounds.getCenter( new THREE.Vector3() );
	const size = bounds.getSize( new THREE.Vector3() );
	// Far enough out that the whole model sits inside the shadow camera, which is
	// orthographic, so the distance costs nothing in projection terms.
	const distance = Math.max( size.x, size.y, size.z, 1 ) * 2;

	const elevation = ( options.elevation != null ? options.elevation : 55 ) * Math.PI / 180;
	const azimuth = ( options.azimuth != null ? options.azimuth : 135 ) * Math.PI / 180;
	light.position.set(
		centre.x + distance * Math.cos( elevation ) * Math.sin( azimuth ),
		centre.y + distance * Math.sin( elevation ),
		centre.z + distance * Math.cos( elevation ) * Math.cos( azimuth )
	);
	light.target.position.copy( centre );
	light.target.updateMatrixWorld();
	light.updateMatrixWorld();
}

/**
 * How much wider than the model the shadow catcher is when the shadow is short.
 *
 * Only a floor. A low angle's long shadow is covered by the reach term in
 * shadowGroundExtent, which is explicit about it; this is just enough room around
 * the product for a short shadow and the fade band.
 *
 * It used to be 2.5, from before the reach was calculated, and that is expensive
 * now that the shadow camera is fitted to the plane: on a car it held the plane at
 * 14.85m whatever the angle, spreading the shadow map over more than twice the
 * ground it needed and taking the texel size from 4.5mm to 10mm with it.
 */
const SHADOW_CATCHER_MARGIN = 1.4;

/** Cap on how far past the footprint the catcher grows to follow a low shadow. */
const MAX_SHADOW_REACH_SCALE = 6;

/**
 * Where the shadow fade reaches zero, as a fraction of the plane's radius.
 *
 * Deliberately short of the geometry. Ending the fade exactly at the edge leaves
 * the plane's boundary sitting where alpha is still changing, and the edge of a
 * large transparent quad is a straight line that finds a way to show — through
 * antialiasing, blending precision, or the shadow map's own border. Stopping the
 * fade early means the outer band is exactly zero everywhere, so there is no
 * boundary left to draw. The plane is grown to compensate, so nothing is lost.
 */
const FADE_COMPLETE_AT = 0.85;

/**
 * Shadow below this counts as none at all, on the catcher.
 *
 * Variance shadow mapping never returns exactly "fully lit": in an unshadowed
 * spot the Chebyshev bound lands a fraction under 1, so the catcher carries a
 * half-percent wash of shadow across the whole frustum. Outside the frustum
 * three's own bounds test returns exactly 1 instead, and the step between the two
 * drew a faint line — perpendicular to the light, because the frustum's top and
 * bottom planes cut the ground that way, and rotating with it. Well under a level
 * out of 255, but a straight coherent edge is exactly what an eye is good at.
 *
 * Clipping the toe removes the wash, so there is nothing left to step down from.
 * Real shadow starts far above this, and the alternative — growing the frustum
 * until its boundary leaves the plane — costs texel density everywhere to hide an
 * artifact at the edge.
 */
const SHADOW_TOE = 0.03;


/**
 * How wide the ground the shadow lands on is, in scene units.
 *
 * Shared by the catcher, which is sized by it, and by the shadow camera fit,
 * which has to push its depth range past it — see fitDirectionalShadowCamera.
 * They cannot be allowed to disagree: the whole bug this exists to prevent is a
 * frustum that ends partway across the surface it is shadowing.
 *
 * @param {THREE.Vector3} size - Model bounding box size
 * @param {number} [elevationDeg] - Shadow light elevation
 * @param {number} [explicit] - Explicit size, treated as a floor
 * @returns {number}
 */
export function shadowGroundExtent( size, elevationDeg, explicit ) {
	const footprint = Math.max( size.x, size.z, 0.01 );
	let reach = 0;
	if ( elevationDeg > 0 && elevationDeg < 90 ) {
		reach = Math.max( size.y, 0 ) / Math.tan( elevationDeg * Math.PI / 180 );
		reach = Math.min( reach, footprint * MAX_SHADOW_REACH_SCALE );
	}
	return Math.max(
		Number( explicit ) > 0 ? Number( explicit ) : 0,
		footprint * SHADOW_CATCHER_MARGIN,
		footprint + reach * 2
	) / FADE_COMPLETE_AT;
}

/**
 * The three ways a product can be grounded, and how to read it off the settings.
 *
 * One dropdown replaced two independent checkboxes ("enable fake shadow" and
 * "enable real-time shadows"), which could both be on at once and produced two
 * shadows stacked on each other. A single mode makes that unrepresentable.
 *
 * The fallback is for products saved before the dropdown existed: real-time wins
 * if it was on, because a product set up that way was relying on it.
 */
export const SHADOW_MODES = {
	NONE: 'none',
	FAKE: 'fake',
	REALTIME: 'realtime',
};

/**
 * @param {Object} settings - settings_3d
 * @returns {string} One of SHADOW_MODES
 */
export function resolveShadowMode( settings ) {
	const ground = ( settings && settings.ground ) || {};
	const mode = ground.shadow_mode;
	if (
		mode === SHADOW_MODES.NONE ||
		mode === SHADOW_MODES.FAKE ||
		mode === SHADOW_MODES.REALTIME
	) {
		return mode;
	}
	if ( settings && settings.enable_shadows ) return SHADOW_MODES.REALTIME;
	return ground.enabled === false ? SHADOW_MODES.NONE : SHADOW_MODES.FAKE;
}

/**
 * A plane that shows real-time shadows and nothing else.
 *
 * Real-time shadows only appear on geometry that receives them, and a product
 * modelled without a floor gives them nowhere to land — the mode looked broken
 * for exactly the models it works best on. ShadowMaterial renders the shadow term
 * alone and stays transparent everywhere else, so the plane is invisible except
 * where the product actually shades it.
 *
 * Deliberately not a child of model_root: the shadow camera is fitted to that
 * root's bounds, and a plane several times the model's size would blow the
 * frustum straight back up and throw away the resolution the fit is for.
 */
export class ShadowCatcher extends THREE.Mesh {
	constructor() {
		super(
			new THREE.PlaneGeometry( 1, 1 ),
			new THREE.ShadowMaterial( { transparent: true, opacity: 0.5 } )
		);
		this.rotation.x = -Math.PI / 2;
		this.receiveShadow = true;
		// Casting would let the catcher shadow itself, which reads as a flat wash
		// over the whole plane.
		this.castShadow = false;
		this.userData.noHit = true;
		this.name = 'ShadowCatcher';

		// Fade the shadow out towards the edge of the plane.
		//
		// A directional shadow is uniform: it is exactly as dark and exactly as
		// hard a metre from the product as it is ten metres away. That reads as
		// wrong on a long shadow, because a real one softens and lightens with
		// distance as the penumbra widens — and the shadow map cannot do that, the
		// blur it gets is one width everywhere. Fading with distance approximates
		// the half of it that matters, and costs one smoothstep.
		//
		// Driven off the plane's own uv rather than a world position, because the
		// plane is already sized to the shadow's reach: the model sits in the
		// middle and the tip of the shadow is out near the edge, so uv distance
		// from the centre is the measure we want with nothing else to compute.
		// Uniforms rather than baked constants: these are the two knobs worth
		// scrubbing against a live product, and recompiling a shader to try a value
		// is a poor way to find one.
		this._fade = {
			fadeInner: { value: 0.5 },
			fadeOuter: { value: FADE_COMPLETE_AT },
			shadowToe: { value: SHADOW_TOE },
		};
		this.material.onBeforeCompile = ( shader ) => {
			shader.uniforms.fadeInner = this._fade.fadeInner;
			shader.uniforms.fadeOuter = this._fade.fadeOuter;
			shader.uniforms.shadowToe = this._fade.shadowToe;
			shader.vertexShader = 'varying vec2 vCatcherUv;\n' + shader.vertexShader.replace(
				'#include <begin_vertex>',
				'#include <begin_vertex>\n\tvCatcherUv = uv;'
			);
			const target = 'gl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) );';
			const patched = shader.fragmentShader.replace(
				target,
				'float catcherFade = 1.0 - smoothstep( fadeInner, fadeOuter, length( vCatcherUv - 0.5 ) * 2.0 );\n' +
				'\tfloat catcherShadow = 1.0 - getShadowMask();\n' +
				'\tcatcherShadow = clamp( ( catcherShadow - shadowToe ) / max( 1.0 - shadowToe, 1e-4 ), 0.0, 1.0 );\n' +
				'\tgl_FragColor = vec4( color, opacity * catcherShadow * catcherFade );'
			);
			if ( patched === shader.fragmentShader ) {
				// three has changed ShadowMaterial. Losing the fade is cosmetic, so
				// say so and carry on rather than breaking the shadow.
				console.warn( 'ShadowCatcher: could not patch ShadowMaterial, shadow will not fade with distance.' );
				return;
			}
			shader.fragmentShader =
				'uniform float fadeInner;\nuniform float fadeOuter;\nuniform float shadowToe;\nvarying vec2 vCatcherUv;\n' + patched;
		};
	}

	/**
	 * Sit the catcher under the model and size it to the footprint.
	 *
	 * @param {THREE.Object3D} modelRoot
	 * @param {Object} [options]
	 * @param {number} [options.opacity=0.5] - Shadow darkness
	 * @param {number} [options.size] - Plane size in scene units, as a floor.
	 * @param {number} [options.elevation] - Shadow light elevation in degrees, so
	 *        the plane can be grown to cover the shadow's reach.
	 * @returns {boolean} Whether the catcher could be placed
	 */
	update( modelRoot, options = {} ) {
		if ( ! modelRoot ) return false;
		const box = new THREE.Box3().setFromObject( modelRoot );
		if ( box.isEmpty() ) return false;

		const size = box.getSize( new THREE.Vector3() );
		const center = box.getCenter( new THREE.Vector3() );
		const footprint = Math.max( size.x, size.z, 0.01 );
		const extent = shadowGroundExtent( size, Number( options.elevation ), options.size );
		// Clamped to the frustum. The two used to be worked out separately and
		// disagreed: the plane ran to 14.85m while the frustum reached 6.4m, so the
		// boundary landed in open plane, a long way outside the shadow, and drew a
		// faint line there. The fade cannot help at that distance — it is scaled to
		// the plane, and the plane was the thing that was too big.
		this.scale.set( extent, extent, 1 );

		// Hold the shadow at full strength while it is still under the product, then
		// fade across whatever is left of the plane. On a short shadow that band is
		// most of the plane and the fade is invisible; on a long one it is the taper
		// that stops it ending in a flat wall of grey.
		if ( this._fade ) {
			const covered = footprint / Math.max( extent, 1e-4 );
			if ( covered >= FADE_COMPLETE_AT ) {
				// No room between the product and the edge to fade across. Pushing the
				// band inwards anyway is what cropped the shadow, so it is switched
				// off instead — values past any uv put smoothstep at 0 and the fade
				// term at 1.
				this._fade.fadeInner.value = 1e3;
				this._fade.fadeOuter.value = 1e4;
			} else {
				this._fade.fadeInner.value = covered;
				this._fade.fadeOuter.value = FADE_COMPLETE_AT;
			}
		}
		// A hair below the lowest geometry, so a model whose wheels sit exactly on
		// zero does not z-fight with the plane it is standing on.
		this.position.set( center.x, box.min.y - Math.max( size.y, 1 ) * 0.001, center.z );

		this.material.opacity = options.opacity != null ? Number( options.opacity ) : 0.5;
		this.visible = this.material.opacity > 0;
		return true;
	}

	dispose() {
		this.geometry.dispose();
		this.material.dispose();
		this.removeFromParent();
	}
}

/**
 * Re-render the shadow maps on the next frame.
 *
 * Shadow maps are baked rather than refreshed every frame — see
 * applyRendererShadowSettings — so anything that changes the scene has to say so.
 * A camera move is not one of those things: a directional light's shadow does not
 * depend on where it is viewed from.
 *
 * @param {THREE.WebGLRenderer} renderer
 */
export function invalidateBakedShadows( renderer ) {
	if ( renderer && renderer.shadowMap ) renderer.shadowMap.needsUpdate = true;
}

export function applyRendererShadowSettings( renderer, enabled ) {
	if ( ! renderer || ! renderer.shadowMap ) return;
	renderer.shadowMap.enabled = !! enabled;
	if ( ! enabled ) return;
	// VSM, not PCFSoftShadowMap: that constant is deprecated in three r182 and is
	// silently downgraded to PCFShadowMap with a console warning on every viewer.
	// VSM is normally avoided because blurring the shadow map costs per frame — but
	// the map is baked here, so that cost is paid once, and in exchange the
	// penumbra is genuinely smooth instead of five dithered taps.
	renderer.shadowMap.type = THREE.VSMShadowMap;
	// Bake rather than refresh every frame. A configurator scene is static between
	// changes, and the viewer only renders on demand anyway, so re-rendering the
	// shadow map each frame is work nobody sees. It also means the map can be a
	// size that would be indefensible live: 2048 puts a texel at about 3mm across
	// a car, where the 512 default puts it at 12mm.
	//
	// The cost of this is that every scene change must call invalidateBakedShadows.
	renderer.shadowMap.autoUpdate = false;
	renderer.shadowMap.needsUpdate = true;
}

/**
 * Re-apply every part of the shadow configuration to a live scene: renderer flag,
 * mesh flags and each light. Safe to call whenever settings change.
 *
 * Lights carry their own `cast_shadows` choice in userData, set when they are built.
 *
 * @param {Object} params
 * @param {THREE.WebGLRenderer} params.renderer
 * @param {THREE.Scene} params.scene
 * @param {THREE.Object3D} [params.modelRoot]
 * @param {boolean} params.enabled
 * @param {number} [params.mapSize]
 */
export function refreshSceneShadows( { renderer, scene, modelRoot, enabled, mapSize, softness, groundExtent } ) {
	applyRendererShadowSettings( renderer, enabled );
	if ( ! scene ) return;

	applyShadowFlagsToObject( modelRoot || scene, enabled );

	// Strictly the model: the ground/fake-shadow plane is sized from the ground
	// setting (10 units by default) and would blow the shadow camera back up to
	// the oversized frustum this is meant to fix.
	let bounds = null;
	if ( modelRoot ) {
		const measured = new THREE.Box3().setFromObject( modelRoot );
		if ( ! measured.isEmpty() ) bounds = measured;
	}

	scene.traverse( ( obj ) => {
		if ( ! obj.isLight ) return;
		applyShadowSettingsToLight( obj, {
			enabled,
			castShadows: !! ( obj.userData && obj.userData.cast_shadows ),
			bounds,
			mapSize,
			softness,
			groundExtent,
		} );
	} );
}

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
 * Dispose a texture once, tracking what has already been released.
 * Materials are shared across meshes (and, through the material registry, across
 * models), so the same texture is reached many times in one traversal.
 *
 * @param {THREE.Texture|null} texture
 * @param {Set<THREE.Texture>} seen
 */
function disposeTextureOnce( texture, seen ) {
	if ( ! texture || ! texture.isTexture || typeof texture.dispose !== 'function' ) return;
	if ( seen.has( texture ) ) return;
	seen.add( texture );
	texture.dispose();
}

/**
 * Dispose every texture a material references.
 *
 * A PBR material carries a dozen map slots — normal, roughness, metalness, ao,
 * emissive, alpha, clearcoat, transmission and so on — and on a product model
 * those are several times the memory of the base colour map. Releasing only
 * `map` leaves nearly all of it allocated.
 *
 * @param {THREE.Material} material
 * @param {Set<THREE.Texture>} seen
 */
function disposeMaterialTextures( material, seen ) {
	if ( ! material ) return;
	for ( const key in material ) {
		disposeTextureOnce( material[ key ], seen );
	}
}

/**
 * Traverse a scene and release everything it holds on the GPU: geometries,
 * materials, every texture those materials reference, and — for a Scene — the
 * environment and background maps, which are properties rather than children and
 * so are never reached by the traversal.
 *
 * @param {THREE.Object3D} scene
 */
export function disposeScene( scene ) {
	if ( ! scene ) return;
	const seenTextures = new Set();
	const seenMaterials = new Set();

	scene.traverse( ( obj ) => {
		if ( obj.geometry ) obj.geometry.dispose();
		if ( obj.material ) {
			const mats = Array.isArray( obj.material ) ? obj.material : [ obj.material ];
			mats.forEach( ( m ) => {
				if ( ! m || seenMaterials.has( m ) ) return;
				seenMaterials.add( m );
				disposeMaterialTextures( m, seenTextures );
				if ( m.dispose ) m.dispose();
			} );
		}
		// Light cookies (SpotLight/DirectionalLight projection maps).
		if ( obj.isLight ) disposeTextureOnce( obj.map, seenTextures );
	} );

	if ( scene.isScene ) {
		disposeTextureOnce( scene.background, seenTextures );
		disposeTextureOnce( scene.environment, seenTextures );
		scene.background = null;
		scene.environment = null;
	}
}

// -------------------------------------------------------------------------
// Object lookup and target position
// -------------------------------------------------------------------------

/**
 * Find an object in the scene by name or uuid.
 *
 * Uses an explicit stack rather than Object3D.traverse, which cannot break early
 * and so walks the whole tree even after a match. This is on the hot path for
 * hotspots and camera framing, where it runs many times per interaction.
 *
 * @param {THREE.Object3D} root
 * @param {string} objectId - object name or uuid
 * @returns {THREE.Object3D|null}
 */
export function findObject( root, objectId ) {
	if ( ! root || ! objectId ) return null;
	const stack = [ root ];
	while ( stack.length ) {
		const obj = stack.pop();
		if ( obj.name === objectId || ( obj.uuid && obj.uuid === objectId ) ) return obj;
		const children = obj.children;
		if ( children ) {
			for ( let i = children.length - 1; i >= 0; i-- ) stack.push( children[ i ] );
		}
	}
	return null;
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
 * NOTE ON SHARING: the key is the material's *name*, across every loaded model.
 * That is what lets a material_color_registry or material_property action target
 * a material by name and reach all of it. The flip side is that two independently
 * authored glTF files that both contain, say, "Material" or "Metal" are silently
 * merged into one instance: the second model's appearance changes when it loads,
 * and an action aimed at one model visibly changes the other. Collisions between
 * different models are reported once each via console.warn so the cause is
 * findable; naming materials distinctly per model is the fix on the asset side.
 *
 * @param {{ material_registry?: Map<string,THREE.Material> }} threeCtx
 * @param {THREE.Object3D} sceneRoot
 * @param {{ defaultAoIntensity?: number }} [opts]
 */
export function registerSceneMaterials( threeCtx, sceneRoot, opts = {} ) {
	if ( ! threeCtx || ! threeCtx.material_registry || ! sceneRoot ) return;
	const registry = threeCtx.material_registry;
	const aoIntensity = ( typeof opts.defaultAoIntensity === 'number' ) ? opts.defaultAoIntensity : 0.5;
	// Which model each name was first claimed by, so a cross-model collision can
	// be named in the warning rather than just detected.
	const owners = threeCtx.material_registry_owners || ( threeCtx.material_registry_owners = new Map() );
	const warned = threeCtx.material_registry_warned || ( threeCtx.material_registry_warned = new Set() );
	const sourceId = ( sceneRoot.userData && ( sceneRoot.userData.object_id || sceneRoot.userData.name ) ) || sceneRoot.name || 'model';

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
				const owner = owners.get( name );
				if ( owner !== undefined && String( owner ) !== String( sourceId ) && ! warned.has( name ) ) {
					warned.add( name );
					// eslint-disable-next-line no-console
					console.warn(
						'3D viewer: material "' + name + '" exists in more than one model (' + owner + ' and ' +
						sourceId + '). They now share one instance, so both models change together and a ' +
						'material action aimed at one affects the other. Rename the material in one of the files ' +
						'if they are meant to be independent.'
					);
				}
				resolved.push( existing );
			} else {
				registry.set( name, mat );
				if ( ! owners.has( name ) ) owners.set( name, sourceId );
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
