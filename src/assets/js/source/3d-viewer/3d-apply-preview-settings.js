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
	blurEnvironmentTexture,
	getEnvironmentKey,
	resolveShadowMode,
	SHADOW_MODES,
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
 * @param {{ current: string|null, texture: THREE.Texture|null }} [options.currentBgImageRef] - ref to
 *        the loaded `background.mode: 'image'` texture, so it is only (re)loaded when the URL changes.
 * @param {function()} [options.onBgImageLoaded] - called after a background image texture is loaded.
 * @param {function()} [options.onBgImageError]
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
	const env_blur = ( env.blur != null ) ? env.blur : 0;
	const desiredKey = getEnvironmentKey( desiredUrl, env_blur );
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
				const blurred = blurEnvironmentTexture( renderer, texture, env_blur );
				if ( blurred ) {
					// The sharp original was only ever the source for the convolution.
					if ( typeof texture.dispose === 'function' ) texture.dispose();
					setSceneEnvironment( scene, blurred );
				} else {
					setSceneEnvironment( scene, texture );
				}
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
	// Anything that is not a solid colour or an image renders transparent, which also
	// lands any legacy stored 'environment' on the sensible answer without a migration.
	const solid_color = ( bg.mode === 'solid' && bg.color ) ? bg.color : null;
	const bg_image_url = ( bg.mode === 'image' && bg.image && bg.image.url ) ? bg.image.url : null;
	const bg_image_ref = options.currentBgImageRef || { current: null, texture: null };
	if ( ! bg_image_url ) {
		if ( bg_image_ref.current !== null ) {
			if ( bg_image_ref.texture && typeof bg_image_ref.texture.dispose === 'function' ) {
				bg_image_ref.texture.dispose();
			}
			bg_image_ref.current = null;
			bg_image_ref.texture = null;
		}
	} else if ( bg_image_ref.current !== bg_image_url ) {
		bg_image_ref.current = bg_image_url;
		new THREE.TextureLoader().load(
			bg_image_url,
			( texture ) => {
				texture.colorSpace = THREE.SRGBColorSpace;
				if ( bg_image_ref.texture && typeof bg_image_ref.texture.dispose === 'function' ) {
					bg_image_ref.texture.dispose();
				}
				bg_image_ref.texture = texture;
				if ( typeof options.onBgImageLoaded === 'function' ) options.onBgImageLoaded();
			},
			undefined,
			() => {
				bg_image_ref.current = null;
				if ( typeof options.onBgImageError === 'function' ) options.onBgImageError();
			}
		);
	}
	const image_texture = ( bg.mode === 'image' ) ? bg_image_ref.texture : null;
	renderer.setClearAlpha( ( ( solid_color || image_texture ) && ! r.alpha ) ? 1 : 0 );
	scene.background = image_texture || ( solid_color ? new THREE.Color( solid_color ) : null );
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
		options.fakeShadow.update( options.modelRoot, g, resolveShadowMode( s ) === SHADOW_MODES.FAKE );
	}

	const gi = 1;
	scene.traverse( ( obj ) => {
		if ( ! obj.isLight ) return;
		const base = ( obj.userData && obj.userData.baseIntensity != null ) ? obj.userData.baseIntensity : obj.intensity;
		obj.intensity = base * gi;
	} );
}
