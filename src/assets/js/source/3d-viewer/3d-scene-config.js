/**
 * Frontend 3D scene config: settings access, HDR base URL.
 * Re-exports shared utils (tone mapping, orbit limits, light creation).
 */
import {
	getToneMapping,
	getOutputColorSpace,
	getOrbitLimitsFromEnv,
	createLightFromSettings,
	getHdrUrlFromEnv,
	getDefaultHdrPresetFilename,
	getPixelRatio,
	MAX_PIXEL_RATIO,
	ORBIT_PIXEL_RATIO_SCALE,
} from './3d-scene-utils.js';

export { getToneMapping, getOutputColorSpace, getOrbitLimitsFromEnv, createLightFromSettings, getHdrUrlFromEnv, getDefaultHdrPresetFilename, getPixelRatio, MAX_PIXEL_RATIO, ORBIT_PIXEL_RATIO_SCALE };

export function getSettings() {
	const data = window.PC && window.PC.fe && window.PC.fe.currentProductData;
	return ( data && data.settings_3d ) ? data.settings_3d : null;
}

/**
 * Raw postprocessing settings. The host stores and forwards these without
 * interpreting them — which effects exist is entirely the add-on's business.
 *
 * @param {Object} [settings] - settings_3d (defaults to getSettings())
 * @returns {Object}
 */
export function getPostprocessingSettings( settings = null ) {
	const s = settings || getSettings();
	return ( s && s.postprocessing ) ? s.postprocessing : {};
}

/**
 * Whether the viewport should be treated as mobile for postprocessing cost.
 *
 * @returns {boolean}
 */
export function isMobileViewport() {
	if ( typeof window === 'undefined' || typeof window.matchMedia !== 'function' ) return false;
	return window.matchMedia( '(max-width: 767px)' ).matches;
}

/**
 * Pass factories registered by add-ons through PC.3d.postprocessingPasses.
 *
 * Factories, not pass instances: a pass needs the renderer, camera and buffer
 * size to construct, and none of those exist yet when this is first consulted —
 * the host has to decide whether to load a composer at all before it builds the
 * scene. The viewer calls each factory later with a full context.
 *
 * @param {Object} [settings] - settings_3d (defaults to getSettings())
 * @returns {function[]}
 */
export function getCustomPassFactories( settings = null ) {
	if ( ! window.wp || ! window.wp.hooks || typeof window.wp.hooks.applyFilters !== 'function' ) {
		return [];
	}
	const list = window.wp.hooks.applyFilters(
		'PC.3d.postprocessingPasses',
		[],
		{ settings: getPostprocessingSettings( settings ), isMobile: isMobileViewport() }
	);
	return Array.isArray( list ) ? list.filter( ( f ) => typeof f === 'function' ) : [];
}

/**
 * Whether any postprocessing effect would run. Answered by the add-on, so the
 * host never loads the heavy modules for a configuration that needs none.
 *
 * @param {Object} [settings] - settings_3d (defaults to getSettings())
 * @returns {boolean}
 */
export function isPostprocessingEnabled( settings = null ) {
	if ( ! window.wp || ! window.wp.hooks || typeof window.wp.hooks.applyFilters !== 'function' ) {
		return false;
	}
	return !! window.wp.hooks.applyFilters(
		'PC.3d.postprocessingEnabled',
		false,
		getPostprocessingSettings( settings ),
		{ isMobile: isMobileViewport() }
	);
}

/**
 * Whether the visitor has asked their OS to reduce motion.
 *
 * The loading overlay already honours this for its transitions; camera moves
 * are the larger offender, since a swooping tween on every choice click is
 * exactly the kind of motion the setting exists to suppress.
 *
 * @returns {boolean}
 */
export function prefersReducedMotion() {
	if ( typeof window === 'undefined' || typeof window.matchMedia !== 'function' ) return false;
	return window.matchMedia( '(prefers-reduced-motion: reduce)' ).matches;
}

export function getHdrBaseUrl() {
	if ( typeof window.PC_lang !== 'undefined' && window.PC_lang.hdr_base_url ) {
		return window.PC_lang.hdr_base_url;
	}
	return ( window.PC_config && window.PC_config.assets_url ) ? window.PC_config.assets_url + 'images/hdr/' : '';
}
