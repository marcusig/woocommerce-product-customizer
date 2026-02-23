/**
 * Shared GLTF loader factory: config from PC_lang + PC_config, create loader with Draco/Meshopt/KHR_materials_variants.
 * Used by both frontend and admin.
 */
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import GLTFMaterialsVariantsExtension from '../../vendor/KHR_materials_variants.js';

/**
 * Default 3D loader config from PC_lang (admin) and PC_config.config (frontend).
 * @returns {{ fe_3d_use_draco_loader: boolean, fe_3d_use_meshopt_loader: boolean, fe_3d_draco_decoder_path: string }}
 */
export function getDefaultGltfConfig() {
	const lang = window.PC_lang || {};
	const config = ( window.PC_config && window.PC_config.config ) || {};
	return {
		fe_3d_use_draco_loader: !!( lang.fe_3d_use_draco_loader || config.fe_3d_use_draco_loader ),
		fe_3d_use_meshopt_loader: !!( lang.fe_3d_use_meshopt_loader || config.fe_3d_use_meshopt_loader ),
		fe_3d_draco_decoder_path: lang.fe_3d_draco_decoder_path || config.fe_3d_draco_decoder_path || ( ( window.PC_config && window.PC_config.assets_url ) ? window.PC_config.assets_url + 'js/vendor/draco/gltf/' : '' ),
	};
}

/**
 * Create a configured GLTFLoader. Config defaults to getDefaultGltfConfig().
 * Pass existingDracoLoader to reuse a cached DRACOLoader.
 * @param {Object} [config] - from getDefaultGltfConfig() or override
 * @param {object} [existingDracoLoader] - Cached DRACOLoader instance to reuse
 * @returns {{ loader: GLTFLoader, dracoLoader?: object }}
 */
export function createGltfLoader( config = null, existingDracoLoader = null ) {
	const cfg = config || getDefaultGltfConfig();
	const loader = new GLTFLoader();
	let dracoLoader = existingDracoLoader || null;
	if ( cfg.fe_3d_use_draco_loader && typeof window.DRACOLoader !== 'undefined' ) {
		if ( ! dracoLoader ) {
			dracoLoader = new window.DRACOLoader();
			if ( cfg.fe_3d_draco_decoder_path ) dracoLoader.setDecoderPath( cfg.fe_3d_draco_decoder_path );
		}
		loader.setDRACOLoader( dracoLoader );
	}
	if ( cfg.fe_3d_use_meshopt_loader && typeof window.MeshoptDecoder !== 'undefined' ) {
		loader.setMeshoptDecoder( window.MeshoptDecoder );
	}
	loader.register( ( parser ) => new GLTFMaterialsVariantsExtension( parser ) );
	return dracoLoader ? { loader, dracoLoader } : { loader };
}
