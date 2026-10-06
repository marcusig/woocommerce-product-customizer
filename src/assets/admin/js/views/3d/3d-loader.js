/**
 * Admin 3D loader: exposes getGltfLoader (async) using shared factory and config.
 */
import { getSharedGltfLoader } from '../../../../js/source/3d-viewer/3d-loader-factory.js';

/**
 * Returns a Promise that resolves to the shared configured GLTFLoader.
 * @returns {Promise<THREE.GLTFLoader>}
 */
function getGltfLoader() {
	return getSharedGltfLoader();
}

window.PC = window.PC || {};
window.PC.threeD = window.PC.threeD || {};
window.PC.threeD.getGltfLoader = getGltfLoader;
