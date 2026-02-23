/**
 * Admin 3D store: one load per URL, getMaterialVariantsFromUrl, getMaterialNamesFromUrl, resolveChoiceModelUrl.
 * Depends on PC.threeD.getGltfLoader (3d-loader.js). Uses shared buildObjectTreeFromScene and disposeScene.
 */
import { buildObjectTreeFromScene, disposeScene } from '../../../../js/source/3d-viewer/3d-scene-utils.js';

function createStore() {
	const _cache = {};

	function get( url, callback ) {
		if ( ! url || typeof callback !== 'function' ) return;
		if ( _cache[ url ] !== undefined ) {
			return callback( null, _cache[ url ] );
		}
		const loader = window.PC.threeD.getGltfLoader();
		loader.load(
			url,
			( gltf ) => {
				const variants = ( gltf.userData && gltf.userData.variants && gltf.userData.variants.length )
					? gltf.userData.variants.slice()
					: [];
				const materialNames = [];
				const seen = {};
				if ( gltf.scene && gltf.scene.traverse ) {
					gltf.scene.traverse( ( obj ) => {
						if ( ! obj.material ) return;
						const materials = Array.isArray( obj.material ) ? obj.material : [ obj.material ];
						materials.forEach( ( mat ) => {
							if ( ! mat ) return;
							const name = ( mat.name && String( mat.name ).trim() ) ? mat.name : mat.uuid;
							if ( ! seen[ name ] ) {
								seen[ name ] = true;
								materialNames.push( name );
							}
						} );
					} );
				}
				const objectTree = buildObjectTreeFromScene( gltf.scene );
				const data = { gltf, variants, materialNames, objectTree };
				_cache[ url ] = data;
				callback( null, data );
			},
			undefined,
			( err ) => callback( err || new Error( 'Failed to load model' ), null )
		);
	}

	function remove( url ) {
		if ( ! url ) return;
		const entry = _cache[ url ];
		if ( entry && entry.gltf && entry.gltf.scene ) {
			disposeScene( entry.gltf.scene );
		}
		delete _cache[ url ];
	}

	return { get, remove };
}

function resolveChoiceModelUrl( choiceModel, layerModel, callback ) {
	if ( ! choiceModel || typeof callback !== 'function' ) {
		if ( typeof callback === 'function' ) callback( null );
		return;
	}
	const source = choiceModel.get( 'object_selection_3d' ) || 'main_model';
	const mainUrl = ( window.PC.app.admin.settings_3d && window.PC.app.admin.settings_3d.url ) ? window.PC.app.admin.settings_3d.url : null;

	function resolveAttachmentUrl( attId, done ) {
		if ( ! attId ) return done( null );
		const att = wp.media.attachment( attId );
		att.fetch().done( function() {
			const j = att.toJSON();
			done( j.gltf_url || j.url || null );
		} ).fail( () => done( null ) );
	}

	if ( source === 'main_model' ) return callback( mainUrl );
	if ( source === 'layer_model' && layerModel ) {
		const layerSource = layerModel.get( 'object_selection_3d' ) || 'main_model';
		if ( layerSource === 'main_model' ) return callback( mainUrl );
		if ( layerSource === 'upload_model' ) return resolveAttachmentUrl( layerModel.get( 'model_upload_3d' ), callback );
		if ( typeof layerSource === 'string' && layerSource.indexOf( 'layer_' ) === 0 ) {
			const otherId = layerSource.replace( /^layer_/, '' );
			const layers = window.PC.app && window.PC.app.admin && window.PC.app.admin.layers;
			const other = layers && layers.get ? layers.get( otherId ) : null;
			if ( other && other.get( 'model_upload_3d' ) ) return resolveAttachmentUrl( other.get( 'model_upload_3d' ), callback );
			return callback( mainUrl );
		}
		return callback( mainUrl );
	}
	if ( source === 'upload_model' ) return resolveAttachmentUrl( choiceModel.get( 'model_upload_3d' ), callback );
	if ( typeof source === 'string' && source.indexOf( 'layer_' ) === 0 ) {
		const otherId = source.replace( /^layer_/, '' );
		const layers = window.PC.app && window.PC.app.admin && window.PC.app.admin.layers;
		const other = layers && layers.get ? layers.get( otherId ) : null;
		if ( other && other.get( 'model_upload_3d' ) ) return resolveAttachmentUrl( other.get( 'model_upload_3d' ), callback );
		return callback( mainUrl );
	}
	callback( mainUrl );
}

function resolveLayerModelUrl( layerModel, callback ) {
	if ( ! layerModel || typeof callback !== 'function' ) {
		if ( typeof callback === 'function' ) callback( null );
		return;
	}
	const mainUrl = ( window.PC.app && window.PC.app.admin && window.PC.app.admin.settings_3d && window.PC.app.admin.settings_3d.url ) ? window.PC.app.admin.settings_3d.url : null;
	function resolveAttachmentUrl( attId, done ) {
		if ( ! attId ) return done( null );
		const att = wp.media.attachment( attId );
		att.fetch().done( function() {
			const j = att.toJSON();
			done( j.gltf_url || j.url || null );
		} ).fail( () => done( null ) );
	}
	const source = layerModel.get( 'object_selection_3d' ) || 'main_model';
	if ( source === 'main_model' ) return callback( mainUrl );
	if ( source === 'upload_model' ) return resolveAttachmentUrl( layerModel.get( 'model_upload_3d' ), callback );
	if ( typeof source === 'string' && source.indexOf( 'layer_' ) === 0 ) {
		const otherId = source.replace( /^layer_/, '' );
		const layers = window.PC.app && window.PC.app.admin && window.PC.app.admin.layers;
		const other = layers && layers.get ? layers.get( otherId ) : null;
		if ( other && other.get( 'model_upload_3d' ) ) return resolveAttachmentUrl( other.get( 'model_upload_3d' ), callback );
		return callback( mainUrl );
	}
	callback( mainUrl );
}

window.PC = window.PC || {};
window.PC.threeD = window.PC.threeD || {};
window.PC.threeD.store = createStore();
window.PC.threeD.getMaterialVariantsFromUrl = function( url, callback ) {
	if ( ! url || typeof callback !== 'function' ) return;
	window.PC.threeD.store.get( url, ( err, data ) => callback( err, data ? data.variants : [] ) );
};
window.PC.threeD.getMaterialNamesFromUrl = function( url, callback ) {
	if ( ! url || typeof callback !== 'function' ) return;
	window.PC.threeD.store.get( url, ( err, data ) => callback( err, data ? data.materialNames : [] ) );
};
window.PC.threeD.resolveChoiceModelUrl = resolveChoiceModelUrl;
window.PC.threeD.resolveLayerModelUrl = resolveLayerModelUrl;
