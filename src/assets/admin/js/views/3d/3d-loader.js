/**
 * Admin 3D loader: exposes getGltfLoader (async) using shared factory and config.
 */
import { getDefaultGltfConfig, createGltfLoader } from '../../../../js/source/3d-viewer/3d-loader-factory.js';

let _loaderPromise = null;

/**
 * Returns a Promise that resolves to the configured GLTFLoader (cached after first call).
 * @returns {Promise<THREE.GLTFLoader>}
 */
function getGltfLoader() {
	if ( ! _loaderPromise ) {
		_loaderPromise = createGltfLoader( getDefaultGltfConfig() );
	}
	return _loaderPromise;
}

window.PC = window.PC || {};
window.PC.threeD = window.PC.threeD || {};
window.PC.threeD.getGltfLoader = getGltfLoader;
