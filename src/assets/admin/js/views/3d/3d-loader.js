/**
 * Admin 3D loader: exposes getGltfLoader using shared factory and config.
 */
import { getDefaultGltfConfig, createGltfLoader } from '../../../../js/source/3d-viewer/3d-loader-factory.js';

let _adminDracoLoader = null;

function getGltfLoader() {
	const result = createGltfLoader( getDefaultGltfConfig(), _adminDracoLoader );
	if ( result.dracoLoader ) _adminDracoLoader = result.dracoLoader;
	return result.loader;
}

window.PC = window.PC || {};
window.PC.threeD = window.PC.threeD || {};
window.PC.threeD.getGltfLoader = getGltfLoader;
