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
} from './3d-scene-utils.js';

export { getToneMapping, getOutputColorSpace, getOrbitLimitsFromEnv, createLightFromSettings, getHdrUrlFromEnv, getDefaultHdrPresetFilename };

export function getSettings() {
	const data = window.PC && window.PC.fe && window.PC.fe.currentProductData;
	return ( data && data.settings_3d ) ? data.settings_3d : null;
}

/**
 * Returns which postprocessing passes are enabled in settings.
 * On the front-end, load and apply only the passes that are enabled (e.g. use dynamic import per pass).
 *
 * @param {Object} [settings] - settings_3d (defaults to getSettings())
 * @returns {{ ssr: boolean, ssao: boolean, bloom: boolean, smaa: boolean }}
 */
export function getPostprocessingFlags( settings = null ) {
	const s = settings || getSettings();
	const pp = ( s && s.postprocessing ) ? s.postprocessing : {};
	return {
		ssr: !! pp.ssr,
		ssao: !! pp.ssao,
		bloom: !! pp.bloom,
		smaa: !! pp.smaa,
	};
}

export function getHdrBaseUrl() {
	if ( typeof window.PC_lang !== 'undefined' && window.PC_lang.hdr_base_url ) {
		return window.PC_lang.hdr_base_url;
	}
	return ( window.PC_config && window.PC_config.assets_url ) ? window.PC_config.assets_url + 'images/hdr/' : '';
}
