/**
 * Admin 3D store: one load per URL, getMaterialVariantsFromUrl, getMaterialNamesFromUrl, resolveModelUrl, populateModelSourceSelect.
 * Depends on PC.threeD.getGltfLoader (3d-loader.js). Uses shared buildObjectTreeFromScene and disposeScene.
 */
import { buildObjectTreeFromScene, disposeScene } from '../../../../js/source/3d-viewer/3d-scene-utils.js';

function get3DObjectsCollection() {
	return ( window.PC && window.PC.app && typeof window.PC.app.get_collection === 'function' && window.PC.app.get_collection( 'objects3d' ) )
		? window.PC.app.get_collection( 'objects3d' )
		: null;
}

function getLayersCollection() {
	return ( window.PC && window.PC.app && window.PC.app.admin && window.PC.app.admin.layers )
		? window.PC.app.admin.layers
		: ( window.PC && window.PC.app && typeof window.PC.app.get_collection === 'function' && window.PC.app.get_collection( 'layers' ) )
			? window.PC.app.get_collection( 'layers' )
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
 * Resolve model URL for a layer or choice: use object_3d_id (from objects3d).
 * When options.sourceKey is 'camera_target_model' (angle), resolves layer_<id> from layer's object_3d_id.
 * @param {Backbone.Model} model - Layer, choice, or angle model.
 * @param {{ sourceKey: string, uploadKey: string|null }} options - sourceKey for angle: 'camera_target_model'.
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
		// Legacy: main_model no longer used
		if ( source === 'main_model' ) return callback( null );
		// Layer reference: resolve via layer's object_3d_id
		if ( typeof source === 'string' && source.indexOf( 'layer_' ) === 0 ) {
			const layerId = source.replace( /^layer_/, '' );
			const layers = getLayersCollection();
			const layer = layers && layers.get ? layers.get( layerId ) : null;
			if ( layer ) {
				const oid = layer.get( 'object_3d_id' );
				if ( oid != null && oid !== '' ) return resolveObject3DUrl( oid, callback );
			}
			return callback( null );
		}
		// Direct objects3d id (from Camera target model dropdown)
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

function resolveChoiceModelUrl( choiceModel, layerModel, callback ) {
	resolveModelUrl( choiceModel, {}, callback );
}

function resolveLayerModelUrl( layerModel, callback ) {
	resolveModelUrl( layerModel, {}, callback );
}

function resolveAngleCameraTargetModelUrl( angleModel, callback ) {
	resolveModelUrl( angleModel, { sourceKey: 'camera_target_model', uploadKey: null }, callback );
}

/**
 * Resolve attachment_id for a layer/choice model's 3D source (object_3d_id from objects3d).
 * @param {Backbone.Model} model - Layer or choice model.
 * @param {{ sourceKey: string, uploadKey: string|null }} options - Ignored; kept for API compatibility.
 * @param {function(number|string|null)} callback - Called with attachment_id or null.
 */
function resolveModelAttachmentId( model, options, callback ) {
	if ( ! model || typeof callback !== 'function' ) {
		if ( typeof callback === 'function' ) callback( null );
		return;
	}
	const object3dId = model.get( 'object_3d_id' );
	if ( object3dId != null && object3dId !== '' ) {
		const objects3d = get3DObjectsCollection();
		if ( objects3d ) {
			const obj = objects3d.get( object3dId );
			if ( obj ) return callback( obj.get( 'attachment_id' ) != null ? obj.get( 'attachment_id' ) : null );
		}
		return callback( null );
	}
	return callback( null );
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
 * Get all model sources that make up the configurator scene (each layer with a model).
 * sourceId is the attachment_id (stable file id) for camera_focus_object_ids composite ids.
 * @param {function(Error|null, Array<{ sourceLabel: string, url: string, sourceId: string }>)} callback
 */
function getSceneModelSources( callback ) {
	if ( typeof callback !== 'function' ) return;
	const out = [];
	const layers = getLayersCollection();
	if ( ! layers || ! layers.length ) {
		return callback( null, out );
	}
	const layerResults = new Array( layers.length );
	let pending = layers.length;
	let done = false;
	function onLayer( idx, url, label, attachmentId ) {
		if ( done ) return;
		layerResults[ idx ] = url ? { sourceLabel: label, url, sourceId: attachmentId != null ? String( attachmentId ) : null } : null;
		pending--;
		if ( pending <= 0 ) {
			done = true;
			const seen = new Set( out.map( ( s ) => s.url ) );
			layerResults.forEach( ( r ) => {
				if ( r && r.url && ! seen.has( r.url ) ) {
					seen.add( r.url );
					out.push( r );
				}
			} );
			callback( null, out );
		}
	}
	layers.each( function( layer, idx ) {
		const layerName = layer.get( 'name' ) || ( 'Layer ' + ( layer.get( '_id' ) || layer.id || layer.cid ) );
		const label = 'Layer: ' + layerName;
		resolveModelUrl( layer, {}, function( url ) {
			resolveModelAttachmentId( layer, {}, function( attachmentId ) {
				onLayer( idx, url, label, attachmentId );
			} );
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
window.PC.threeD.resolveChoiceModelUrl = resolveChoiceModelUrl;
window.PC.threeD.resolveLayerModelUrl = resolveLayerModelUrl;
window.PC.threeD.resolveAngleCameraTargetModelUrl = resolveAngleCameraTargetModelUrl;
window.PC.threeD.getSceneModelSources = getSceneModelSources;
window.PC.threeD.getObjects3DModelSources = getObjects3DModelSources;
window.PC.threeD.populateModelSourceSelect = populateModelSourceSelect;
