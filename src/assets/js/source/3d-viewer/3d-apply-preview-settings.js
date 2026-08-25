/**
 * Shared "apply preview settings" to a Three.js scene (renderer, background, env, orbit, fake shadow, lights).
 * Used by both frontend main-viewer and admin 3d-settings.
 */
import * as THREE from 'three';
import {
	getToneMapping,
	getOutputColorSpace,
	getOrbitLimitsFromEnv,
	getHdrUrlFromEnv,
	loadEnvMap,
	setSceneEnvironment,
} from './3d-scene-utils.js';

/**
 * Apply settings_3d to scene, renderer, controls, lights, and optional fake shadow / default light.
 * HDR loading is async; when URL changes we load and then call onEnvLoaded so the view can re-apply or update UI.
 *
 * @param {THREE.Scene} scene
 * @param {THREE.WebGLRenderer} renderer
 * @param {object} [controls] - OrbitControls (optional)
 * @param {Object} s - settings_3d (renderer, background, environment, ground, lighting)
 * @param {Object} options
 * @param {THREE.Light|null} [options.defaultLight]
 * @param {object|null} [options.fakeShadow] - FakeShadow instance with .update(modelRoot, ground)
 * @param {THREE.Object3D|null} [options.modelRoot]
 * @param {function(): string} [options.getHdrBaseUrl]
 * @param {{ current: string|null }} [options.currentEnvUrlRef] - ref to store current HDR URL
 * @param {function()} [options.onEnvLoaded] - called after HDR texture is loaded (view may re-call apply)
 * @param {function()} [options.onEnvError]
 * @param {Array|null} [options.objects3d] - objects3d entries for `environment.mode: 'object'`.
 *        The frontend leaves this unset and the lookup falls back to the product data;
 *        the admin passes its live collection.
 */
export function applySettingsToScene( scene, renderer, controls, s, options = {} ) {
	const r = s.renderer || {};
	const bg = s.background || {};
	const env = s.environment || {};
	renderer.toneMapping = getToneMapping( r );
	renderer.toneMappingExposure = typeof r.exposure === 'number' ? r.exposure : 1;
	renderer.outputColorSpace = getOutputColorSpace( r );

	const hdrBase = ( typeof options.getHdrBaseUrl === 'function' ? options.getHdrBaseUrl() : '' );
	const desiredUrl = getHdrUrlFromEnv( env, hdrBase, options.objects3d || null );
	const urlRef = options.currentEnvUrlRef || { current: null };
	const desiredKey = Array.isArray( desiredUrl ) ? desiredUrl.join( '|' ) : ( desiredUrl || null );
	if ( ! desiredKey ) {
		if ( urlRef.current !== null || scene.environment ) {
			setSceneEnvironment( scene, null );
			urlRef.current = null;
		}
	} else if ( urlRef.current !== desiredKey ) {
		urlRef.current = desiredKey;
		loadEnvMap(
			desiredUrl,
			( texture ) => {
				setSceneEnvironment( scene, texture );
				urlRef.current = desiredKey;
				if ( typeof options.onEnvLoaded === 'function' ) options.onEnvLoaded();
			},
			undefined,
			() => {
				urlRef.current = null;
				if ( typeof options.onEnvError === 'function' ) options.onEnvError();
			}
		);
	}

	// There used to be an 'environment' mode that drew the HDR itself as the
	// backdrop. It is gone: a photographic room behind a product almost never
	// matches the page the configurator sits on, and the environment still does the
	// job that matters — lighting and reflections — without being seen directly.
	// Anything that is not a solid colour renders transparent, which also lands any
	// legacy stored 'environment' on the sensible answer without a migration.
	const solid_color = ( bg.mode === 'solid' && bg.color ) ? bg.color : null;
	renderer.setClearAlpha( ( solid_color && ! r.alpha ) ? 1 : 0 );
	scene.background = solid_color ? new THREE.Color( solid_color ) : null;
	if ( typeof scene.environmentIntensity !== 'undefined' ) {
		scene.environmentIntensity = ( env.intensity != null ) ? env.intensity : 1;
	}
	if ( typeof scene.environmentRotation !== 'undefined' && env.rotation != null ) {
		// Only the environment rotates now. backgroundRotation went with the mode
		// that drew the environment as the backdrop.
		scene.environmentRotation = new THREE.Euler( 0, env.rotation * Math.PI / 180, 0 );
	}

	if ( controls ) {
		const limits = getOrbitLimitsFromEnv( env );
		controls.minPolarAngle = limits.minPolarAngle;
		controls.maxPolarAngle = limits.maxPolarAngle;
		controls.minAzimuthAngle = limits.minAzimuthAngle;
		controls.maxAzimuthAngle = limits.maxAzimuthAngle;
		controls.minDistance = limits.minDistance;
		controls.maxDistance = limits.maxDistance;
	}

	const g = s.ground || {};
	if ( options.fakeShadow && options.modelRoot ) {
		options.fakeShadow.update( options.modelRoot, g );
	}

	const gi = 1;
	scene.traverse( ( obj ) => {
		if ( ! obj.isLight ) return;
		const base = ( obj.userData && obj.userData.baseIntensity != null ) ? obj.userData.baseIntensity : obj.intensity;
		obj.intensity = base * gi;
	} );
}
