/**
 * Admin 3D store: cache by URL, resolveModelUrl (object_3d_id / camera_target_model), getObjects3DModelSources, populateModelSourceSelect.
 * Depends on PC.threeD.getGltfLoader (3d-loader.js). Uses shared buildObjectTreeFromScene and disposeScene.
 */
import { buildObjectTreeFromScene, disposeScene } from '../../../../js/source/3d-viewer/3d-scene-utils.js';

function get3DObjectsCollection() {
	return ( window.PC && window.PC.app && typeof window.PC.app.get_collection === 'function' && window.PC.app.get_collection( 'objects3d' ) )
		? window.PC.app.get_collection( 'objects3d' )
		: null;
}

/**
 * Resolve URL for a 3D object by id from the objects3d collection.
 * @param {string|number} objectId - _id of the 3D object
 * @param {function(string|null)} callback - Called with the URL or null
 */
function resolveObject3DUrl( objectId, callback ) {
	if ( objectId == null || objectId === '' || typeof callback !== 'function' ) {
		if ( typeof callback === 'function' ) callback( null );
		return;
	}
	const objects3d = get3DObjectsCollection();
	if ( ! objects3d ) return callback( null );
	const obj = objects3d.get( objectId );
	if ( ! obj ) return callback( null );
	const url = obj.get( 'url' );
	if ( url ) return callback( url );
	const attachmentId = obj.get( 'attachment_id' );
	if ( attachmentId != null ) {
		return resolveAttachmentUrl( attachmentId, callback );
	}
	callback( null );
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
 * Resolve model URL for a layer, choice, or angle.
 * - Layers/choices: use object_3d_id (from objects3d).
 * - Angles (sourceKey 'camera_target_model'): use camera_target_model value as objects3d id.
 * @param {Backbone.Model} model - Layer, choice, or angle model.
 * @param {{ sourceKey: string }} options - sourceKey for angle: 'camera_target_model'.
 * @param {function(string|null)} callback - Called with the resolved URL or null.
 */
function resolveModelUrl( model, options, callback ) {
	if ( ! model || typeof callback !== 'function' ) {
		if ( typeof callback === 'function' ) callback( null );
		return;
	}
	const sourceKey = options && options.sourceKey ? options.sourceKey : 'object_3d_id';
	if ( sourceKey === 'camera_target_model' ) {
		const source = model.get( 'camera_target_model' );
		if ( source == null || source === '' ) return callback( null );
		return resolveObject3DUrl( String( source ), callback );
	}
	const object3dId = model.get( 'object_3d_id' );
	if ( object3dId != null && object3dId !== '' ) {
		return resolveObject3DUrl( object3dId, callback );
	}
	return callback( null );
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

function resolveAngleCameraTargetModelUrl( angleModel, callback ) {
	resolveModelUrl( angleModel, { sourceKey: 'camera_target_model' }, callback );
}

/**
 * Get model sources from the objects3d collection (for Camera focus selector).
 * sourceId is the object's _id for camera_focus_object_ids composite ids (e.g. "1:MeshName").
 * @param {function(Error|null, Array<{ sourceLabel: string, url: string, sourceId: string }>)} callback
 */
function getObjects3DModelSources( callback ) {
	if ( typeof callback !== 'function' ) return;
	const objects3d = get3DObjectsCollection();
	if ( ! objects3d || ! objects3d.length ) {
		return callback( null, [] );
	}
	const out = [];
	const results = new Array( objects3d.length );
	let pending = objects3d.length;
	let done = false;
	function onObject( idx, url, label, sourceId ) {
		if ( done ) return;
		results[ idx ] = url && sourceId != null ? { sourceLabel: label, url, sourceId: String( sourceId ) } : null;
		pending--;
		if ( pending <= 0 ) {
			done = true;
			results.forEach( ( r ) => {
				if ( r && r.url ) out.push( r );
			} );
			callback( null, out );
		}
	}
	objects3d.each( function( obj, idx ) {
		const id = obj.get( '_id' ) || obj.id;
		const label = obj.get( 'name' ) || obj.get( 'filename' ) || ( 'Object #' + id );
		resolveObject3DUrl( id, function( url ) {
			onObject( idx, url, label, id );
		} );
	} );
}

/**
 * Populate a model source select with options from the objects3d collection. Used for angle camera_target_model. Layer/choice forms use object_3d_id select from objects3d directly.
 */
function populateModelSourceSelect( $, $sel, currentVal, options ) {
	if ( ! $sel || ! $sel.length ) return;
	const objects3d = get3DObjectsCollection();
	$sel.find( 'option:not(:first)' ).remove();
	if ( objects3d && objects3d.length ) {
		objects3d.each( function( obj ) {
			const id = obj.get( '_id' ) || obj.id;
			const label = obj.get( 'name' ) || obj.get( 'filename' ) || ( 'Object #' + id );
			$sel.append( $( '<option></option>' ).attr( 'value', id ).text( label ) );
		} );
	}
	if ( currentVal != null && currentVal !== '' ) $sel.val( currentVal );
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
window.PC.threeD.get3DObjectsCollection = get3DObjectsCollection;
window.PC.threeD.resolveObject3DUrl = resolveObject3DUrl;
window.PC.threeD.resolveModelUrl = resolveModelUrl;
window.PC.threeD.resolveAngleCameraTargetModelUrl = resolveAngleCameraTargetModelUrl;
window.PC.threeD.getObjects3DModelSources = getObjects3DModelSources;
window.PC.threeD.populateModelSourceSelect = populateModelSourceSelect;
