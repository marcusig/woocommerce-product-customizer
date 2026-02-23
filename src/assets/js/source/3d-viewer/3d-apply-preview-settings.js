/**
 * Shared "apply preview settings" to a Three.js scene (renderer, background, env, orbit, fake shadow, lights).
 * Used by both frontend main-viewer and admin 3d-settings.
 */
import * as THREE from 'three';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import {
	getToneMapping,
	getOutputColorSpace,
	getOrbitLimitsFromEnv,
	getHdrUrlFromEnv,
	createLightFromSettings,
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
 * @param {{ useZoomLimitsToggle?: boolean }} [options.orbitOpts] - passed to getOrbitLimitsFromEnv (e.g. for admin zoom toggle)
 */
export function applySettingsToScene( scene, renderer, controls, s, options = {} ) {
	const r = s.renderer || {};
	const bg = s.background || {};
	renderer.toneMapping = getToneMapping( r );
	renderer.toneMappingExposure = typeof r.exposure === 'number' ? r.exposure : 1;
	renderer.outputColorSpace = getOutputColorSpace( r );
	renderer.setClearAlpha( ( bg.mode === 'transparent' || r.alpha ) ? 0 : 1 );

	if ( bg.mode === 'transparent' ) {
		scene.background = null;
	} else if ( bg.mode === 'solid' && bg.color ) {
		scene.background = new THREE.Color( bg.color );
	}

	const env = s.environment || {};
	const hdrBase = ( typeof options.getHdrBaseUrl === 'function' ? options.getHdrBaseUrl() : '' );
	const desiredUrl = getHdrUrlFromEnv( env, hdrBase );
	const urlRef = options.currentEnvUrlRef || { current: null };
	if ( urlRef.current !== desiredUrl ) {
		urlRef.current = desiredUrl;
		new HDRLoader().load(
			desiredUrl,
			( texture ) => {
				texture.mapping = THREE.EquirectangularReflectionMapping;
				scene.environment = texture;
				urlRef.current = desiredUrl;
				if ( typeof options.onEnvLoaded === 'function' ) options.onEnvLoaded();
			},
			undefined,
			() => {
				urlRef.current = null;
				if ( typeof options.onEnvError === 'function' ) options.onEnvError();
			}
		);
	}
	if ( typeof scene.environmentIntensity !== 'undefined' ) {
		scene.environmentIntensity = ( env.intensity != null ) ? env.intensity : 1;
	}
	if ( typeof scene.environmentRotation !== 'undefined' && env.rotation != null ) {
		scene.environmentRotation = new THREE.Euler( 0, env.rotation * Math.PI / 180, 0 );
	}

	if ( controls ) {
		const limits = getOrbitLimitsFromEnv( env, options.orbitOpts || {} );
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

	const gi = ( s.lighting && s.lighting.global_intensity != null ) ? s.lighting.global_intensity : 1;
	const lightsList = ( s.lighting && s.lighting.lights ) || [];
	const sceneLights = [];
	scene.traverse( ( obj ) => {
		if ( ! obj.isLight || obj.userData?.isDefaultLight === true ) return;
		sceneLights.push( { obj, settings: lightsList[ sceneLights.length ] } );
	} );

	sceneLights.forEach( ( { obj, settings } ) => {
		let target = obj;
		target.userData = target.userData || {};
		if ( settings ) {
			const desiredType = settings.type || 'PointLight';
			const typeMatches =
				( desiredType === 'PointLight' && obj.isPointLight ) ||
				( desiredType === 'DirectionalLight' && obj.isDirectionalLight ) ||
				( desiredType === 'SpotLight' && obj.isSpotLight );
			if ( ! typeMatches ) {
				const parent = obj.parent;
				if ( parent ) {
					const idx = parent.children.indexOf( obj );
					const newLight = createLightFromSettings( settings, gi );
					newLight.position.copy( obj.position );
					newLight.quaternion.copy( obj.quaternion );
					if ( obj.target && newLight.target ) {
						newLight.target.position.copy( obj.target.position );
						if ( obj.target.parent ) obj.target.parent.add( newLight.target );
						else parent.add( newLight.target );
					}
					parent.remove( obj );
					parent.children.splice( idx, 0, newLight );
					newLight.parent = parent;
					target = newLight;
				}
			}
			target.visible = settings.enabled !== false;
			if ( target.visible ) {
				if ( settings.color ) target.color.set( settings.color );
				target.userData.baseIntensity = ( settings.intensity != null ) ? settings.intensity : ( target.userData.baseIntensity ?? target.intensity );
				target.intensity = target.userData.baseIntensity * gi;
			}
		} else {
			if ( target.userData.baseIntensity == null ) target.userData.baseIntensity = target.intensity;
			target.intensity = target.userData.baseIntensity * gi;
		}
	} );

	if ( options.defaultLight ) {
		const enabled = ( s.lighting && s.lighting.default_light_enabled !== false );
		options.defaultLight.visible = enabled;
		if ( enabled ) {
			const base = ( options.defaultLight.userData && options.defaultLight.userData.baseIntensity != null ) ? options.defaultLight.userData.baseIntensity : 1.2;
			options.defaultLight.intensity = base * gi;
		}
	}
}
