import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import GLTFMaterialsVariantsExtension from '../../vendor/KHR_materials_variants.js';

/**
 * Internal module caches (per runtime)
 */
let DRACOLoaderModule = null;
let MeshoptModule = null;
let KTX2LoaderModule = null;
let cachedDracoLoader = null;
let cachedKtx2Loader = null;
let sharedLoaderPromise = null;

/**
 * KTX2Loader has to know which compressed texture formats the GPU supports
 * before it can transcode, and that means a renderer. The loader is built in
 * the viewer's module phase, before initScene exists, so the renderer arrives
 * separately through here.
 */
let ktx2Renderer = null;

/**
 * Hand the KTX2 transcoder a renderer to probe.
 *
 * Call once per renderer, right after it is created and before any model is
 * loaded. Safe to call when KTX2 is disabled or the loader has not been built
 * yet — the renderer is remembered and applied when it is.
 *
 * @param {THREE.WebGLRenderer|null} renderer
 */
export function setKtx2Renderer( renderer ) {
	ktx2Renderer = renderer || null;
	if ( cachedKtx2Loader && ktx2Renderer ) {
		cachedKtx2Loader.detectSupport( ktx2Renderer );
	}
}

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
		fe_3d_use_ktx2_loader: !!(lang.fe_3d_use_ktx2_loader || config.fe_3d_use_ktx2_loader),
		fe_3d_ktx2_transcoder_path:
			lang.fe_3d_ktx2_transcoder_path ||
			config.fe_3d_ktx2_transcoder_path ||
			((window.PC_config && window.PC_config.assets_url)
				? window.PC_config.assets_url + 'js/vendor/basis/'
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
	   KTX2 / Basis Universal (lazy + cached)

	   Supercompressed textures stay compressed on the GPU, so this cuts both
	   the download and the VRAM a product model needs — usually the larger win
	   on a textured model than the geometry compression DRACO provides.
	================================ */
	if (cfg.fe_3d_use_ktx2_loader) {

		if (!KTX2LoaderModule) {
			KTX2LoaderModule = await import(
				'three/addons/loaders/KTX2Loader.js'
			);
		}

		if (!cachedKtx2Loader) {
			const { KTX2Loader } = KTX2LoaderModule;
			cachedKtx2Loader = new KTX2Loader();

			if (cfg.fe_3d_ktx2_transcoder_path) {
				cachedKtx2Loader.setTranscoderPath(cfg.fe_3d_ktx2_transcoder_path);
			}

			// May be null this early; setKtx2Renderer applies it later. Without
			// it KTX2Loader throws on the first transcode, so the viewer calls
			// that as soon as its renderer exists.
			if (ktx2Renderer) {
				cachedKtx2Loader.detectSupport(ktx2Renderer);
			}
		}

		loader.setKTX2Loader(cachedKtx2Loader);
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
