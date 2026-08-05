import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import GLTFMaterialsVariantsExtension from '../../vendor/KHR_materials_variants.js';

/**
 * Internal module caches (per runtime)
 */
let DRACOLoaderModule = null;
let MeshoptModule = null;
let cachedDracoLoader = null;
let sharedLoaderPromise = null;

/**
 * Default 3D loader config
 */
export function getDefaultGltfConfig() {
	const lang = window.PC_lang || {};
	const config = (window.PC_config && window.PC_config.config) || {};

	return {
		fe_3d_use_draco_loader: !!(lang.fe_3d_use_draco_loader || config.fe_3d_use_draco_loader),
		fe_3d_use_meshopt_loader: !!(lang.fe_3d_use_meshopt_loader || config.fe_3d_use_meshopt_loader),
		fe_3d_draco_decoder_path:
			lang.fe_3d_draco_decoder_path ||
			config.fe_3d_draco_decoder_path ||
			((window.PC_config && window.PC_config.assets_url)
				? window.PC_config.assets_url + 'js/vendor/draco/gltf/'
				: ''),
	};
}

/**
 * Create configured GLTFLoader (async because of dynamic imports).
 * Prefer getSharedGltfLoader() for multi-model loads so one instance is reused.
 */
export async function createGltfLoader(config = null) {

	const cfg = config || getDefaultGltfConfig();
	const loader = new GLTFLoader();

	/* ===============================
	   DRACO (lazy + cached)
	================================ */
	if (cfg.fe_3d_use_draco_loader) {

		// Load module only once
		if (!DRACOLoaderModule) {
			DRACOLoaderModule = await import(
				'three/addons/loaders/DRACOLoader.js'
			);
		}

		// Create decoder only once
		if (!cachedDracoLoader) {
			const { DRACOLoader } = DRACOLoaderModule;
			cachedDracoLoader = new DRACOLoader();

			if (cfg.fe_3d_draco_decoder_path) {
				cachedDracoLoader.setDecoderPath(cfg.fe_3d_draco_decoder_path);
			}

			// Optional but recommended
			cachedDracoLoader.setDecoderConfig({ type: 'wasm' });
		}

		loader.setDRACOLoader(cachedDracoLoader);
	}

	/* ===============================
	   Meshopt (lazy + cached)
	================================ */
	if (cfg.fe_3d_use_meshopt_loader) {

		if (!MeshoptModule) {
			MeshoptModule = await import(
				'three/addons/libs/meshopt_decoder.module.js'
			);
		}

		loader.setMeshoptDecoder(MeshoptModule.MeshoptDecoder);
	}

	/* ===============================
	   Variants extension
	================================ */
	loader.register((parser) => new GLTFMaterialsVariantsExtension(parser));

	return loader;
}

/**
 * Shared/cached GLTFLoader for the page lifetime (admin + frontend).
 * @param {Object|null} config
 * @returns {Promise<import('three/addons/loaders/GLTFLoader.js').GLTFLoader>}
 */
export function getSharedGltfLoader( config = null ) {
	if ( ! sharedLoaderPromise ) {
		sharedLoaderPromise = createGltfLoader( config || getDefaultGltfConfig() );
	}
	return sharedLoaderPromise;
}
