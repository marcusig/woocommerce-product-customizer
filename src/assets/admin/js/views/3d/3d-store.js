/**
 * Admin 3D store: one load per URL, buildObjectTreeFromScene, getMaterialVariantsFromUrl, getMaterialNamesFromUrl, resolveChoiceModelUrl.
 * Depends on PC.threeD.getGltfLoader (3d-loader.js).
 */
function buildObjectTreeFromScene( root ) {
	const list = [];
	const skipTypes = [ 'Scene', 'Camera', 'Light', 'AmbientLight', 'DirectionalLight', 'PointLight', 'SpotLight', 'RectAreaLight' ];
	const isSkip = ( obj ) => obj && skipTypes.indexOf( obj.type ) !== -1;
	function add( obj, depth ) {
		if ( ! obj || isSkip( obj ) ) return;
		const name = obj.name || obj.type || ( 'Object_' + ( obj.uuid || '' ).slice( 0, 8 ) );
		const id = obj.name || obj.uuid;
		list.push( { id, name, type: obj.type || '', depth } );
		if ( obj.children && obj.children.length ) {
			obj.children.forEach( ( ch ) => add( ch, depth + 1 ) );
		}
	}
	if ( root && root.children ) {
		root.children.forEach( ( ch ) => add( ch, 0 ) );
	}
	return list;
}

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
			entry.gltf.scene.traverse( ( obj ) => {
				if ( obj.geometry ) obj.geometry.dispose();
				if ( obj.material ) {
					const mats = Array.isArray( obj.material ) ? obj.material : [ obj.material ];
					mats.forEach( ( m ) => {
						if ( m && m.dispose ) m.dispose();
						if ( m && m.map && m.map.dispose ) m.map.dispose();
					} );
				}
			} );
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
		return callback( mainUrl );
	}
	if ( source === 'upload_model' ) return resolveAttachmentUrl( choiceModel.get( 'model_upload_3d' ), callback );
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
