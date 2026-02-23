/**
 * Admin 3D store: one load per URL, getMaterialVariantsFromUrl, getMaterialNamesFromUrl, resolveModelUrl, populateModelSourceSelect.
 * Depends on PC.threeD.getGltfLoader (3d-loader.js). Uses shared buildObjectTreeFromScene and disposeScene.
 */
import { buildObjectTreeFromScene, disposeScene } from '../../../../js/source/3d-viewer/3d-scene-utils.js';

function getMainUrl() {
	return ( window.PC && window.PC.app && window.PC.app.admin && window.PC.app.admin.settings_3d && window.PC.app.admin.settings_3d.url )
		? window.PC.app.admin.settings_3d.url
		: null;
}

function getLayersCollection() {
	return ( window.PC && window.PC.app && window.PC.app.admin && window.PC.app.admin.layers )
		? window.PC.app.admin.layers
		: ( window.PC && window.PC.app && typeof window.PC.app.get_collection === 'function' && window.PC.app.get_collection( 'layers' ) )
			? window.PC.app.get_collection( 'layers' )
			: null;
}

function resolveAttachmentUrl( attId, done ) {
	if ( ! attId ) return done( null );
	const att = wp.media.attachment( attId );
	att.fetch().done( function() {
		const j = att.toJSON();
		done( j.gltf_url || j.url || null );
	} ).fail( () => done( null ) );
}

/**
 * Unified model URL resolver for layers, choices, and angles.
 * @param {Backbone.Model} model - The layer, choice, or angle model.
 * @param {{ sourceKey: string, uploadKey: string|null }} options - sourceKey, uploadKey.
 * @param {function(string|null)} callback - Called with the resolved URL or null.
 */
function resolveModelUrl( model, options, callback ) {
	if ( ! model || typeof callback !== 'function' ) {
		if ( typeof callback === 'function' ) callback( null );
		return;
	}
	const sourceKey = options && options.sourceKey ? options.sourceKey : 'object_selection_3d';
	const uploadKey = options && options.uploadKey !== undefined ? options.uploadKey : 'model_upload_3d';
	const source = model.get( sourceKey ) || 'main_model';
	const mainUrl = getMainUrl();

	if ( source === 'main_model' ) return callback( mainUrl );
	if ( source === 'upload_model' && uploadKey ) {
		return resolveAttachmentUrl( model.get( uploadKey ), callback );
	}
	if ( typeof source === 'string' && source.indexOf( 'layer_' ) === 0 ) {
		const otherId = source.replace( /^layer_/, '' );
		const layers = getLayersCollection();
		const other = layers && layers.get ? layers.get( otherId ) : null;
		if ( other && other.get( 'model_upload_3d' ) ) {
			return resolveAttachmentUrl( other.get( 'model_upload_3d' ), callback );
		}
		return callback( mainUrl );
	}
	callback( mainUrl );
}

function createStore() {
	const _cache = {};

	function get( url, callback ) {
		if ( ! url || typeof callback !== 'function' ) return;
		if ( _cache[ url ] !== undefined ) {
			return callback( null, _cache[ url ] );
		}
		const getLoader = window.PC.threeD.getGltfLoader;
		if ( typeof getLoader !== 'function' ) {
			return callback( new Error( 'getGltfLoader not available' ), null );
		}
		Promise.resolve( getLoader() ).then( ( loader ) => {
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
		} ).catch( ( err ) => callback( err || new Error( 'Failed to get loader' ), null ) );
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
	resolveModelUrl( choiceModel, { sourceKey: 'object_selection_3d', uploadKey: 'model_upload_3d' }, callback );
}

function resolveLayerModelUrl( layerModel, callback ) {
	resolveModelUrl( layerModel, { sourceKey: 'object_selection_3d', uploadKey: 'model_upload_3d' }, callback );
}

function resolveAngleCameraTargetModelUrl( angleModel, callback ) {
	resolveModelUrl( angleModel, { sourceKey: 'camera_target_model', uploadKey: null }, callback );
}

/**
 * Populate a model source select (Main, Layer: X…, optional Upload). Call from layer/choice/angle view with jQuery.
 * @param {jQuery} $ - jQuery
 * @param {jQuery} $sel - The select element (must already have option main_model and optionally upload_model)
 * @param {string} currentVal - Current value to restore
 * @param {{ includeUpload?: boolean, excludeLayerId?: string }} options - includeUpload: add Upload option; excludeLayerId: omit this layer from list (e.g. layer form)
 */
function populateModelSourceSelect( $, $sel, currentVal, options ) {
	if ( ! $sel || ! $sel.length ) return;
	const includeUpload = options && options.includeUpload !== false;
	const excludeLayerId = options && options.excludeLayerId;
	const $main = $sel.find( 'option[value="main_model"]' ).clone();
	const $upload = $sel.find( 'option[value="upload_model"]' ).clone();
	$sel.empty().append( $main );
	const layers = getLayersCollection();
	if ( layers && layers.length ) {
		layers.each( function( layer ) {
			if ( excludeLayerId && layer.id === excludeLayerId ) return;
			if ( layer.get( 'object_selection_3d' ) !== 'upload_model' || ! layer.get( 'model_upload_3d' ) ) return;
			const name = layer.get( 'name' ) || ( 'Layer ' + ( layer.get( '_id' ) || layer.id || layer.cid ) );
			$sel.append( $( '<option></option>' ).attr( 'value', 'layer_' + layer.id ).text( name ) );
		} );
	}
	if ( includeUpload && $upload.length ) $sel.append( $upload );
	$sel.val( currentVal );
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
window.PC.threeD.resolveModelUrl = resolveModelUrl;
window.PC.threeD.resolveChoiceModelUrl = resolveChoiceModelUrl;
window.PC.threeD.resolveLayerModelUrl = resolveLayerModelUrl;
window.PC.threeD.resolveAngleCameraTargetModelUrl = resolveAngleCameraTargetModelUrl;
window.PC.threeD.populateModelSourceSelect = populateModelSourceSelect;
