/**
 * Frontend 3D scene config: settings access, HDR base URL, orbit limits, and light creation.
 * Used by main-viewer and apply_preview_settings.
 */
import * as THREE from 'three';

export function getSettings() {
	const data = window.PC && window.PC.fe && window.PC.fe.currentProductData;
	return ( data && data.settings_3d ) ? data.settings_3d : null;
}

export function getHdrBaseUrl() {
	if ( typeof window.PC_lang !== 'undefined' && window.PC_lang.hdr_base_url ) {
		return window.PC_lang.hdr_base_url;
	}
	return ( window.PC_config && window.PC_config.assets_url ) ? window.PC_config.assets_url + 'images/hdr/' : '';
}

/**
 * @param {Object} r - renderer settings (tone_mapping, output_color_space)
 * @returns {number} THREE.ToneMapping
 */
export function getToneMapping( r ) {
	if ( ! r ) return THREE.NoToneMapping;
	return r.tone_mapping === 'aces' ? THREE.ACESFilmicToneMapping : r.tone_mapping === 'linear' ? THREE.LinearToneMapping : THREE.NoToneMapping;
}

/**
 * @param {Object} r - renderer settings
 * @returns {string} THREE.LinearSRGBColorSpace | THREE.SRGBColorSpace
 */
export function getOutputColorSpace( r ) {
	return ( r && r.output_color_space === 'linear' ) ? THREE.LinearSRGBColorSpace : THREE.SRGBColorSpace;
}

/**
 * @param {Object} env - environment settings (orbit_* in degrees / distance)
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
	const minDist = ( typeof env.orbit_min_distance === 'number' && env.orbit_min_distance > 0 ) ? env.orbit_min_distance : 0;
	const maxDist = ( typeof env.orbit_max_distance === 'number' && env.orbit_max_distance > 0 ) ? env.orbit_max_distance : Infinity;
	return {
		minPolarAngle: ( minPolar * Math.PI ) / 180,
		maxPolarAngle: ( maxPolar * Math.PI ) / 180,
		minAzimuthAngle: ( minAzimuth * Math.PI ) / 180,
		maxAzimuthAngle: ( maxAzimuth * Math.PI ) / 180,
		minDistance: minDist,
		maxDistance: maxDist,
	};
}

/**
 * Create a light from settings (type, color, intensity). Used by apply_preview_settings.
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
