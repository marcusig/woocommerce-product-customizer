/**
 * Admin 3D loader: config and GLTFLoader factory (Draco, Meshopt, KHR_materials_variants).
 */
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import GLTFMaterialsVariantsExtension from '../../../../js/vendor/KHR_materials_variants.js';

let _adminDracoLoader = null;

function getAdmin3dConfig() {
	const lang = window.PC_lang || {};
	const config = ( window.PC_config && window.PC_config.config ) || {};
	return {
		fe_3d_use_draco_loader: !!( lang.fe_3d_use_draco_loader || config.fe_3d_use_draco_loader ),
		fe_3d_use_meshopt_loader: !!( lang.fe_3d_use_meshopt_loader || config.fe_3d_use_meshopt_loader ),
		fe_3d_draco_decoder_path: lang.fe_3d_draco_decoder_path || config.fe_3d_draco_decoder_path || ( ( window.PC_config && window.PC_config.assets_url ) ? window.PC_config.assets_url + 'js/vendor/draco/gltf/' : '' ),
	};
}

function getGltfLoader() {
	const loader = new GLTFLoader();
	const config = getAdmin3dConfig();
	if ( config.fe_3d_use_draco_loader && typeof window.DRACOLoader !== 'undefined' ) {
		if ( !_adminDracoLoader ) {
			_adminDracoLoader = new window.DRACOLoader();
			if ( config.fe_3d_draco_decoder_path ) {
				_adminDracoLoader.setDecoderPath( config.fe_3d_draco_decoder_path );
			}
		}
		loader.setDRACOLoader( _adminDracoLoader );
	}
	if ( config.fe_3d_use_meshopt_loader && typeof window.MeshoptDecoder !== 'undefined' ) {
		loader.setMeshoptDecoder( window.MeshoptDecoder );
	}
	loader.register( ( parser ) => new GLTFMaterialsVariantsExtension( parser ) );
	return loader;
}

window.PC = window.PC || {};
window.PC.threeD = window.PC.threeD || {};
window.PC.threeD.getGltfLoader = getGltfLoader;
