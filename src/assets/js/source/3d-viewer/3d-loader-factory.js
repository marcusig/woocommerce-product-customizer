/**
 * Frontend 3D GLTF loader factory: creates a GLTFLoader with Draco, Meshopt, and KHR_materials_variants.
 * The viewer caches the returned loader (and optional dracoLoader) for reuse.
 */
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import GLTFMaterialsVariantsExtension from '../../vendor/KHR_materials_variants.js';

/**
 * Create a configured GLTFLoader (Draco/Meshopt/variants from window.PC_config.config).
 * Pass existingDracoLoader to reuse a cached DRACOLoader; if Draco is used and none passed, a new one is created and returned for the caller to cache.
 * @param {object} [existingDracoLoader] - Cached DRACOLoader instance to reuse
 * @returns {{ loader: GLTFLoader, dracoLoader?: object }}
 */
export function createGltfLoader( existingDracoLoader = null ) {
	const loader = new GLTFLoader();
	const config = ( window.PC_config && window.PC_config.config ) || {};
	let dracoLoader = existingDracoLoader || null;
	if ( config.fe_3d_use_draco_loader && typeof window.DRACOLoader !== 'undefined' ) {
		if ( ! dracoLoader ) {
			dracoLoader = new window.DRACOLoader();
			const decoderPath = config.fe_3d_draco_decoder_path || ( ( window.PC_config && window.PC_config.assets_url ) ? window.PC_config.assets_url + 'js/vendor/draco/gltf/' : '' );
			if ( decoderPath ) dracoLoader.setDecoderPath( decoderPath );
		}
		loader.setDRACOLoader( dracoLoader );
	}
	if ( config.fe_3d_use_meshopt_loader && typeof window.MeshoptDecoder !== 'undefined' ) {
		loader.setMeshoptDecoder( window.MeshoptDecoder );
	}
	loader.register( ( parser ) => new GLTFMaterialsVariantsExtension( parser ) );
	return dracoLoader ? { loader, dracoLoader } : { loader };
}
