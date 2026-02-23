/**
 * Frontend 3D scene config: settings access, HDR base URL.
 * Re-exports shared utils (tone mapping, orbit limits, light creation) for backward compatibility.
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

export function getHdrBaseUrl() {
	if ( typeof window.PC_lang !== 'undefined' && window.PC_lang.hdr_base_url ) {
		return window.PC_lang.hdr_base_url;
	}
	return ( window.PC_config && window.PC_config.assets_url ) ? window.PC_config.assets_url + 'images/hdr/' : '';
}
