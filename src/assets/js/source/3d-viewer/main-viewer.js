/**
 * Frontend 3D viewer – Backbone view that renders the product 3D model
 * using settings from PC.fe.currentProductData.settings_3d and applies
 * layer/choice 3D actions (visibility, material variant, color, texture).
 *
 * Pipeline: 1) Get settings → 2) Async load conditional modules → 3) Load assets → 4) Setup scene.
 */
import * as THREE from 'three';
import viewer_3d_choice from './choice-view.js';
import { getSettings, getHdrBaseUrl, getPostprocessingFlags, getHdrUrlFromEnv } from './3d-scene-config.js';
import { initScene, cleanupThree } from './3d-scene-lifecycle.js';
import { applySettingsToScene } from './3d-apply-preview-settings.js';
import { hideObjectsByName, getHiddenObjectNamesList, getObjectTargetPosition, getBoundingBoxFromObjectIds, findObjectByCompositeId, createLightFromSettings, applyLightCookie, removeLightsFromScene, loadEnvMap, registerSceneMaterials } from './3d-scene-utils.js';

const Backbone = window.Backbone;
const wp = window.wp;

export default Backbone.View.extend({
	tagName: 'div',
	className: 'mkl_pc_viewer mkl_pc_viewer--3d',
	template: wp.template( 'mkl-pc-configurator-viewer' ),
	_three: null,
	_objects3dById: null,
	_objects3dByAttachmentId: null,
	_objectIdToScene: null,
	_scene_models: null,
	_shadowsEnabled: false,
	_runtimeApi: null,
	_runtimeBus: null,
	_lastActiveAngleId: null,

	initialize( options ) {
		this.parent = options.parent || window.PC.fe;
		this._objects3dById = new Map();
		this._objects3dByAttachmentId = new Map();
		this._objectIdToScene = {};
		this._scene_models = new Backbone.Collection();
		this._shadowsEnabled = false;
		this._runtimeApi = null;
		this._runtimeBus = Object.assign( {}, Backbone.Events );
		this._lastActiveAngleId = null;
		if ( window.PC.fe && window.PC.fe.angles ) {
			this.listenTo( window.PC.fe.angles, 'change:active', this._applyAngleCamera );
		}
		return this;
	},

	_emitRuntimeAction( hookName, args = [] ) {
		if ( ! window.wp || ! window.wp.hooks || typeof window.wp.hooks.doAction !== 'function' ) return;
		window.wp.hooks.doAction( hookName, ...args );
	},

	_emitRuntimeEvent( eventName, payload = {} ) {
		if ( this._runtimeBus && typeof this._runtimeBus.trigger === 'function' ) {
			this._runtimeBus.trigger( eventName, payload );
		}
		this._emitRuntimeAction( 'PC.fe.viewer.runtime.event', [ this, eventName, payload, this._runtimeApi ] );
	},

	_createRuntimeApi() {
		if ( this._runtimeApi ) return this._runtimeApi;
		this._runtimeApi = {
			THREE,
			getTHREE: () => THREE,
			getScene: () => ( this._three ? this._three.scene : null ),
			getCamera: () => ( this._three ? this._three.camera : null ),
			getControls: () => ( this._three ? this._three.controls : null ),
			getRenderer: () => ( this._three ? this._three.renderer : null ),
			getModelRoot: () => ( this._three ? this._three.model_root : null ),
			getSceneForObject3dId: ( object3dId ) => {
				if ( object3dId == null ) return null;
				return this._objectIdToScene[ String( object3dId ).trim() ] || null;
			},
			ensureObject3dLoaded: ( object3dId ) => this._ensureObjects3dSceneLoadedById( object3dId ),
			findObjectByCompositeId: ( compositeId ) => {
				const t = this._three;
				if ( ! t || ! t.model_root ) return null;
				return findObjectByCompositeId( t.model_root, compositeId );
			},
			findObjectById: ( id ) => this._findObjectById( id ),
			getActiveAngle: () => {
				const angles = window.PC.fe && window.PC.fe.angles;
				return angles ? angles.findWhere( { active: true } ) || null : null;
			},
			getObject3dAnimations: ( object3dId ) => {
				if ( object3dId == null ) return [];
				const model = this._scene_models && this._scene_models.get( String( object3dId ).trim() );
				if ( ! model ) return [];
				const clips = model.get( 'animations' );
				return Array.isArray( clips ) ? clips : [];
			},
			on: ( eventName, callback ) => {
				if ( ! this._runtimeBus || typeof this._runtimeBus.on !== 'function' ) return;
				this._runtimeBus.on( eventName, callback );
			},
			off: ( eventName, callback ) => {
				if ( ! this._runtimeBus || typeof this._runtimeBus.off !== 'function' ) return;
				this._runtimeBus.off( eventName, callback );
			},
		};
		if ( window.PC && window.PC.fe ) {
			window.PC.fe.threeApi = window.PC.fe.threeApi || {};
			window.PC.fe.threeApi.viewer = this._runtimeApi;
		}
		return this._runtimeApi;
	},

	_moveCameraTo( position, target, opts = {} ) {
		const t = this._three;
		if ( ! t || ! t.camera || ! t.controls ) return;
		const immediate = opts.immediate === true;
		const duration = typeof opts.duration === 'number' ? Math.max( 0, opts.duration ) : 850;
		const camera = t.camera;
		const controls = t.controls;

		if ( t._cameraAnimId ) {
			cancelAnimationFrame( t._cameraAnimId );
			t._cameraAnimId = null;
		}

		if ( immediate || duration === 0 ) {
			if ( position ) camera.position.copy( position );
			if ( target ) controls.target.copy( target );
			controls.update();
			return;
		}

		const startPos = camera.position.clone();
		const startTarget = controls.target.clone();
		const endPos = position ? position.clone() : startPos.clone();
		const endTarget = target ? target.clone() : startTarget.clone();
		const startTs = performance.now();
		const easeInOutCubic = ( x ) => ( x < 0.5 ? 4 * x * x * x : 1 - Math.pow( -2 * x + 2, 3 ) / 2 );

		const step = ( now ) => {
			const elapsed = now - startTs;
			const ratio = Math.min( 1, elapsed / duration );
			const k = easeInOutCubic( ratio );
			camera.position.lerpVectors( startPos, endPos, k );
			controls.target.lerpVectors( startTarget, endTarget, k );
			controls.update();
			if ( ratio < 1 ) {
				t._cameraAnimId = requestAnimationFrame( step );
			} else {
				t._cameraAnimId = null;
			}
		};
		t._cameraAnimId = requestAnimationFrame( step );
	},

	_applyAngleCamera( opts = {} ) {
		const t = this._three;
		if ( ! t || ! t.camera || ! t.controls ) return;
		const reframe = opts.reframe === true;
		const reframeBlend = ( typeof opts.reframeBlend === 'number' ) ? Math.max( 0, Math.min( 1, opts.reframeBlend ) ) : 1;
		const currentOffset = t.camera.position.clone().sub( t.controls.target );
		const angles = window.PC.fe && window.PC.fe.angles;
		if ( ! angles ) return;
		const active = angles.findWhere( { active: true } );
		if ( ! active ) return;
		const pos = active.get( 'camera_position' );
		let tgt = active.get( 'camera_target' );
		const focusIds = active.get( 'camera_focus_object_ids' );
		const useFocusIds = Array.isArray( focusIds ) && focusIds.length > 0 && t.model_root;
		if ( useFocusIds ) {
			const result = getBoundingBoxFromObjectIds( t.model_root, focusIds, { visibleOnly: true } );
			if ( result ) {
				tgt = { x: result.center.x, y: result.center.y, z: result.center.z };
			}
		}
		if ( ! useFocusIds || ! tgt ) {
			const targetObjectId = active.get( 'camera_target_object_id' );
			if ( targetObjectId && t.model_root ) {
				const obj = this._findObject( t.model_root, String( targetObjectId ).trim() );
				if ( obj ) {
					const targetPos = getObjectTargetPosition( obj, new THREE.Vector3() );
					tgt = { x: targetPos.x, y: targetPos.y, z: targetPos.z };
				}
			}
		}
		const nextPos = ( pos && typeof pos.x === 'number' && typeof pos.y === 'number' && typeof pos.z === 'number' )
			? new THREE.Vector3( pos.x, pos.y, pos.z )
			: null;
		const nextTarget = ( tgt && typeof tgt.x === 'number' && typeof tgt.y === 'number' && typeof tgt.z === 'number' )
			? new THREE.Vector3( tgt.x, tgt.y, tgt.z )
			: null;
		let finalPos = nextPos;
		if ( reframe && nextTarget ) {
			const offsetPos = nextTarget.clone().add( currentOffset );
			if ( finalPos ) {
				finalPos = finalPos.clone().lerp( offsetPos, reframeBlend );
			} else {
				finalPos = offsetPos;
			}
		}
		if ( !finalPos && !nextTarget ) return;
		this._moveCameraTo( finalPos, nextTarget, opts );
		const activeId = String( active.id != null ? active.id : active.get( '_id' ) || '' );
		if ( activeId && this._lastActiveAngleId !== activeId ) {
			const previous = this._lastActiveAngleId ? ( angles.get( this._lastActiveAngleId ) || null ) : null;
			this._lastActiveAngleId = activeId;
			this._emitRuntimeAction( 'PC.fe.viewer.angle.changed', [ this, previous, active, this._runtimeApi ] );
			this._emitRuntimeEvent( 'angle:changed', { previous, current: active } );
		}
	},

	render() {
		wp.hooks.doAction( 'PC.fe.viewer.render.before', this );
		this.$el.append( this.template() );

		this.$layers = this.$el.find( '.mkl_pc_layers' );
		this.$layers.empty();
		const container = document.createElement( 'div' );
		container.className = 'mkl_pc_3d_canvas_container';
		this.$layers.append( container );

		if ( PC.fe.angles.length > 1 ) {
			this.angles_selector = new PC.fe.views.angles({ parent: this }); 
			this.$el.append( this.angles_selector.render() );
		} else if ( PC.fe.angles.length ) {
			PC.fe.angles.first().set( 'active', true );
		}
		
		const s = getSettings();
		if ( ! s ) {
			this.$layers.append( '<p class="mkl_pc_3d_error">No 3D model configured.</p>' );
			wp.hooks.doAction( 'PC.fe.viewer.render', this );
			return this.$el;
		}

		// Phase 1 done (we have s). Run pipeline: phases 2 → 3 → 4.
		this._showLoadingOverlay( container );
		this._runViewerPipeline( container, s )
			.then( () => {
				this._hideLoadingOverlay();
				wp.hooks.doAction( 'PC.fe.viewer.render', this );
			} )
			.catch( ( err ) => {
				this._hideLoadingOverlay();
				this._showError( err && err.message ? err.message : 'Failed to load 3D model.' );
			} );

		return this.$el;
	},

	_showLoadingOverlay( container ) {
		const overlay = document.createElement( 'div' );
		overlay.className = 'mkl_pc_3d_loader mkl_pc_3d_loading';
		overlay.setAttribute( 'aria-live', 'polite' );
		overlay.textContent = typeof PC_lang !== 'undefined' && PC_lang.loading_viewer ? PC_lang.loading_viewer : 'Loading…';
		container.after( overlay );
		this._loadingOverlay = overlay;
	},

	_setLoadingStep( text ) {
		if ( this._loadingOverlay ) this._loadingOverlay.textContent = text || '';
	},

	_hideLoadingOverlay() {
		if ( this._loadingOverlay && this._loadingOverlay.parentNode ) {
			this._loadingOverlay.parentNode.removeChild( this._loadingOverlay );
		}
		this._loadingOverlay = null;
	},

	_showError( msg ) {
		const container = this.$layers.find( '.mkl_pc_3d_canvas_container' )[ 0 ];
		if ( container && container.nextElementSibling && container.nextElementSibling.classList.contains( 'mkl_pc_3d_error' ) ) return;
		this.$layers.find( '.mkl_pc_3d_canvas_container' ).after( '<p class="mkl_pc_3d_error">' + ( msg || 'Failed to load 3D model.' ) + '</p>' );
	},

	/**
	 * Pipeline: load modules (phase 2) → load assets (phase 3) → setup scene (phase 4).
	 * @param {HTMLElement} container - Canvas container
	 * @param {Object} s - settings_3d from phase 1
	 * @returns {Promise<void>}
	 */
	async _runViewerPipeline( container, s ) {
		this._setLoadingStep( typeof PC_lang !== 'undefined' && PC_lang.loading_viewer_preparing ? PC_lang.loading_viewer_preparing : 'Preparing 3D…' );
		const modules = await this._loadModules( s );
		this._setLoadingStep( typeof PC_lang !== 'undefined' && PC_lang.loading_model ? PC_lang.loading_model : 'Loading 3D model…' );
		const assets = await this._loadAssets( s, modules );
		this._setLoadingStep( typeof PC_lang !== 'undefined' && PC_lang.loading_viewer_setup ? PC_lang.loading_viewer_setup : 'Setting up scene…' );
		await this._setupScene( container, s, modules, assets );
	},

	/**
	 * Phase 2: Load conditional modules in parallel (loader, FakeShadow, postprocessing).
	 * @param {Object} s - settings_3d
	 * @returns {Promise<{ gltfLoader: *, FakeShadow: *, createPostprocessingLayer: * }>}
	 */
	async _loadModules( s ) {
		const { createGltfLoader, getDefaultGltfConfig } = await import( './3d-loader-factory.js' );
		const groundEnabled = ( s.ground && s.ground.enabled !== false );
		const ppFlags = getPostprocessingFlags( s );
		const anyPostprocessing = ppFlags.ssao || ppFlags.ssr || ppFlags.bloom || ppFlags.emissiveBloom || ppFlags.smaa;

		const promises = [
			createGltfLoader( getDefaultGltfConfig() ),
		];
		if ( groundEnabled ) promises.push( import( './3d-fake-shadow.js' ) );
		if ( anyPostprocessing ) promises.push( import( './3d-postprocessing.js' ) );

		const results = await Promise.all( promises );
		let idx = 0;
		const gltfLoader = results[ idx++ ];
		const FakeShadowModule = groundEnabled ? results[ idx++ ] : { FakeShadow: null };
		const postprocessingModule = anyPostprocessing ? results[ idx++ ] : { createPostprocessingLayer: null };

		return {
			gltfLoader,
			FakeShadow: FakeShadowModule.FakeShadow || null,
			createPostprocessingLayer: postprocessingModule.createPostprocessingLayer || null,
		};
	},

	_getUrlForObject3dId( object3dId ) {
		if ( object3dId == null || object3dId === '' ) return null;
		const data = window.PC.fe && window.PC.fe.currentProductData;
		const list = data && data['objects3d'];
		if ( ! Array.isArray( list ) ) return null;
		const idStr = String( object3dId );
		const obj = list.find( ( o ) => String( o._id || o.id ) === idStr );
		const gltf = obj && obj.gltf;
		return ( gltf && gltf.url ) ? gltf.url : ( obj && obj.url ? obj.url : null );
	},

	_initSceneModelsStore( objects3d ) {
		this._objects3dById = new Map();
		this._objects3dByAttachmentId = new Map();
		this._scene_models.reset();
		this._objectIdToScene = {};

		if ( ! Array.isArray( objects3d ) ) return;

		objects3d.forEach( ( item ) => {
			if ( ! item || item.object_type !== 'gltf' ) return;
			const oid = String( item._id != null ? item._id : item.id || '' );
			if ( ! oid ) return;
			const url = this._getUrlForObject3dId( oid );
			if ( ! url ) return;
			const strategy = item.loading_strategy != null ? item.loading_strategy : 'eager';
			const attId = item && item.gltf && item.gltf.attachment_id != null ? String( item.gltf.attachment_id ) : '';

			this._objects3dById.set( oid, item );
			if ( attId ) this._objects3dByAttachmentId.set( attId, item );

			this._scene_models.add( {
				id: oid,
				object3d: item,
				url,
				loading_strategy: strategy,
				state: 'unloaded',
				animations: [],
				scene: null,
				loadPromise: null,
			} );
		} );
	},

	_syncLayerSceneForObjectId( objectId, scene ) {
		const layers = window.PC.fe && window.PC.fe.layers;
		if ( !layers || ! scene ) return;
		layers.each( ( layer_model ) => {
			const lid = layer_model.get( 'object_3d_id' );
			if ( lid == null || String( lid ) !== String( objectId ) ) return;
			const exists = this._layer_scenes && this._layer_scenes.some( ( x ) => String( x.layer_model.id ) === String( layer_model.id ) );
			if ( ! exists ) this._layer_scenes.push( { layer_model, scene } );
		} );
	},

	_supportsLightShadows( light ) {
		return !!( light && ( light.isDirectionalLight || light.isSpotLight || light.isPointLight ) );
	},

	_applyShadowFlagsToObject( root, enabled ) {
		if ( !root || !root.traverse ) return;
		root.traverse( ( obj ) => {
			if ( obj.isMesh ) {
				obj.castShadow = !!enabled;
				obj.receiveShadow = !!enabled;
			}
		} );
	},

	_applyShadowSettingsToLight( light, item ) {
		if ( !light ) return;
		if ( !this._shadowsEnabled || !this._supportsLightShadows( light ) ) {
			light.castShadow = false;
			return;
		}
		const cast = item && item.cast_shadows === true;
		light.castShadow = cast;
		if ( !cast || !light.shadow ) return;
		light.shadow.mapSize.width = 1024;
		light.shadow.mapSize.height = 1024;
		if ( light.isDirectionalLight || light.isSpotLight ) {
			light.shadow.bias = -0.0001;
			light.shadow.normalBias = 0.02;
		} else if ( light.isPointLight ) {
			light.shadow.bias = -0.0005;
		}
	},

	/**
	 * Phase 3: Load assets (eager GLTFs from objects3d, HDR).
	 * @param {Object} s - settings_3d
	 * @param {Object} modules - from _loadModules
	 * @returns {Promise<{ mainGltf: *, modelResults: *, hdrTexture: *, hdrUrl: string }>}
	 */
	async _loadAssets( s, modules ) {
		const productData = window.PC.fe && window.PC.fe.currentProductData;
		const objects3d = ( productData && productData['objects3d'] ) || [];
		const eagerObjectIds = [];
		for ( let i = 0; i < objects3d.length; i++ ) {
			const obj = objects3d[ i ];
			if ( obj.object_type !== 'gltf' ) continue;
			const strategy = obj.loading_strategy != null ? obj.loading_strategy : 'eager';
			if ( strategy !== 'eager' ) continue;
			const oid = String( obj._id != null ? obj._id : obj.id || '' );
			if ( ! oid ) continue;
			const url = this._getUrlForObject3dId( oid );
			if ( ! url ) continue;
			eagerObjectIds.push( oid );
		}

		// Allow zero eager models: the viewer can start empty and lazily load models when choices require them.
		// Only error if there are no glTF entries at all.
		const hasAnyGltf = Array.isArray( objects3d ) && objects3d.some( ( o ) => o && o.object_type === 'gltf' && ( ( o.gltf && o.gltf.url ) || o.url ) );
		if ( eagerObjectIds.length === 0 && ! hasAnyGltf ) {
			throw new Error( typeof PC_lang !== 'undefined' && PC_lang.no_3d_model_configured ? PC_lang.no_3d_model_configured : 'No 3D model configured.' );
		}

		const env = s.environment || {};
		const hdrBase = getHdrBaseUrl();
		const hdrUrl = getHdrUrlFromEnv( env, hdrBase );

		const hdrTexture = await new Promise( ( resolve ) => {
			loadEnvMap( hdrUrl, ( texture ) => resolve( texture ), undefined, () => resolve( null ) );
		} );

		return { mainGltf: null, eagerObjectIds, hdrTexture, hdrUrl };
	},

	/**
	 * Phase 4: Init scene, add models, FakeShadow, postprocessing, frame camera, apply settings, start loop.
	 * @param {HTMLElement} container
	 * @param {Object} s - settings_3d
	 * @param {Object} modules - from _loadModules
	 * @param {Object} assets - from _loadAssets
	 */
	async _setupScene( container, s, modules, assets ) {
		const { mainGltf, eagerObjectIds, hdrTexture, hdrUrl } = assets;
		// Start from a clean viewer state before creating a fresh scene graph.
		this.maybe_cleanup();
		this._gltfLoader = modules.gltfLoader;
		// Create core Three.js objects (scene, camera, renderer, controls, etc.).
		this._three = initScene( container, s );
		const t = this._three;
		const layers = window.PC.fe && window.PC.fe.layers;
		// Enable or disable shadows globally, then mirror the setting to the renderer.
		this._shadowsEnabled = !!( s && s.enable_shadows );
		if ( t.renderer && t.renderer.shadowMap ) {
			t.renderer.shadowMap.enabled = this._shadowsEnabled;
			if ( this._shadowsEnabled ) t.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
		}

		// Mount the initial model root. If there is no eager main glTF, use an empty root as anchor.
		if ( mainGltf ) {
			t.scene.add( mainGltf.scene );
			t.model_root = mainGltf.scene;
			t.gltf = mainGltf;
			this._applyShadowFlagsToObject( mainGltf.scene, this._shadowsEnabled );
			registerSceneMaterials( t, mainGltf.scene );
		} else {
			const emptyRoot = new THREE.Group();
			t.scene.add( emptyRoot );
			t.model_root = emptyRoot;
			t.gltf = null;
		}

		const productData = window.PC.fe && window.PC.fe.currentProductData;
		const objects3d = productData && productData['objects3d'];
		// Build runtime stores used by both eager and lazy-loaded 3D assets.
		this._initSceneModelsStore( objects3d );
		this._layer_scenes = [];
		// Initial pass: load all eager objects through the same store path as lazy loads.
		if ( Array.isArray( eagerObjectIds ) && eagerObjectIds.length ) {
			await Promise.all( eagerObjectIds.map( ( oid ) => this._ensureObjects3dSceneLoadedById( oid ) ) );
		}
		// Map layer models to full scene assets (`object_3d_id`) when available.
		if ( layers ) {
			layers.each( ( layer_model ) => {
				const object3dId = layer_model.get( 'object_3d_id' );
				if ( object3dId == null || object3dId === '' ) return;
				const idStr = String( object3dId );
				const scene = this._objectIdToScene[ idStr ];
				if ( scene ) this._layer_scenes.push( { layer_model, scene } );
			} );
		}
		this._layer_objects = [];
		// Backward compatibility path: map layers to object references in the main root (`object_id_3d`).
		if ( layers && t.model_root ) {
			layers.each( ( layer_model ) => {
				if ( layer_model.get( 'object_3d_id' ) ) return;
				const oid = layer_model.get( 'object_id_3d' );
				if ( ! oid ) return;
				const obj = this._findObjectById( oid );
				if ( obj ) this._layer_objects.push( { layer_model, object: obj } );
			} );
		}
		// Apply cshow visibility rules once, then subscribe so later layer changes keep scene in sync.
		this._apply_layer_cshow_visibility();
		this._bind_layer_cshow();

		// Hide configured objects immediately so first rendered frame matches product settings.
		const defaultHidden = ( window.PC.fe && window.PC.fe.currentProductData && window.PC.fe.currentProductData.default_hidden_object_names ) || null;
		const customHidden = ( s && s.hidden_object_names ) || '';
		hideObjectsByName( t.model_root, getHiddenObjectNamesList( defaultHidden, customHidden ) );

		const gi = 1;
		// Recreate all configured lights from product settings (including targets/cookies/shadows).
		if ( Array.isArray( objects3d ) ) {
			objects3d.forEach( ( item ) => {
				if ( item.object_type !== 'light' ) return;
				// Flat keys only: light_type, light_position, light_color, etc.
				const type = item.light_type || 'PointLight';
				const settings = {
					type,
					color: item.light_color != null ? item.light_color : '#ffffff',
					intensity: item.light_intensity != null ? item.light_intensity : 1,
					position: item.light_position,
					target: item.light_target,
					angle: item.light_angle,
					penumbra: item.penumbra,
					distance: item.distance,
					decay: item.decay,
					width: item.rect_width,
					height: item.rect_height,
					groundColor: item.light_ground_color,
				};
				const rot = item.rect_rotation;
				if ( rot ) settings.rotation = rot;
				const light = createLightFromSettings( settings, gi );
				light.name = item.name || 'Light';
				this._applyShadowSettingsToLight( light, item );
				const targetObjectId = item.light_target_object_id;
				if ( light.target && targetObjectId && typeof findObjectByCompositeId === 'function' && typeof getObjectTargetPosition === 'function' ) {
					const targetObj = findObjectByCompositeId( t.scene, targetObjectId );
					if ( targetObj ) getObjectTargetPosition( targetObj, light.target.position );
				} else if ( light.target && settings.target ) {
					light.target.position.set(
						settings.target.x != null ? settings.target.x : 0,
						settings.target.y != null ? settings.target.y : 0,
						settings.target.z != null ? settings.target.z : 0
					);
				}
				t.scene.add( light );
				if ( light.target ) t.scene.add( light.target );
				const cookie = item.light_cookie;
				if ( cookie && cookie.url ) applyLightCookie( light, cookie );
			} );
		}

		// Assign environment lighting/reflections (HDR) when available.
		if ( hdrTexture ) {
			t.scene.environment = hdrTexture;
			t.current_env_url = Array.isArray( hdrUrl ) ? hdrUrl.join( '|' ) : hdrUrl;
		}

		// Optional fake shadow pass for products without fully baked real-time shadows.
		if ( modules.FakeShadow ) {
			t.fake_shadow = new modules.FakeShadow( t.scene );
		}

		// While orbiting, temporarily bypass heavier postprocessing for responsiveness.
		t.bypassPostprocessing = false;
		t.controls.addEventListener( 'start', () => { t.bypassPostprocessing = true; } );
		t.controls.addEventListener( 'end', () => { t.bypassPostprocessing = false; } );

		// Create postprocessing pipeline and keep it in sync with container resize events.
		if ( modules.createPostprocessingLayer ) {
			const flags = getPostprocessingFlags( s );
			const pp = ( s && s.postprocessing ) ? s.postprocessing : {};
			const layer = await modules.createPostprocessingLayer( t.renderer, t.scene, t.camera, {
				width: t.container.clientWidth,
				height: t.container.clientHeight,
				flags,
				bloomStrength: pp.bloom_strength,
				bloomRadius: pp.bloom_radius,
				bloomThreshold: pp.bloom_threshold,
			} );
			if ( layer && t.container && t.on_resize ) {
				t.postprocessingLayer = layer;
				const origResize = t.on_resize;
				window.removeEventListener( 'resize', origResize );
				t.on_resize = () => {
					origResize();
					if ( t.postprocessingLayer ) {
						t.postprocessingLayer.setSize( t.container.clientWidth, t.container.clientHeight );
						t.postprocessingLayer.setPixelRatio( window.devicePixelRatio );
					}
				};
				window.addEventListener( 'resize', t.on_resize );
			}
		}

		// Compute an initial framing so camera/controls target the loaded model bounds.
		const box = new THREE.Box3().setFromObject( t.model_root );
		if ( ! box.isEmpty() ) {
			const size = box.getSize( new THREE.Vector3() ).length();
			const center = box.getCenter( new THREE.Vector3() );
			t.controls.target.copy( center );
			t.camera.position.copy( center ).add( new THREE.Vector3( size / 2, size / 2, size / 2 ) );
			t.camera.lookAt( center );
		}
		if ( t.on_resize ) t.on_resize();

		// Apply project-specific preview/camera settings, then create choice-related view bindings.
		this.apply_preview_settings();
		this._applyAngleCamera( { immediate: true } );
		// Capture "initial" camera after applying active angle so screenshot/view reset
		// uses configured angle camera instead of fallback bbox framing.
		t.initial_camera_position = t.camera.position.clone();
		t.initial_controls_target = t.controls.target.clone();
		this._create_choice_views();
		this._createRuntimeApi();
		this._emitRuntimeAction( 'PC.fe.viewer.runtime.ready', [ this, t, this._runtimeApi ] );
		this._emitRuntimeEvent( 'runtime:ready', { three: t } );

		const g = ( s && s.ground ) || {};
		// Main render loop: update controls, shadow pass, postprocessing pass, then final render.
		const animate = ( now ) => {
			t.animation_id = requestAnimationFrame( animate );
			if ( document.hidden ) return;
			if ( t._lastFrameTs == null ) t._lastFrameTs = now;
			const deltaSeconds = Math.max( 0, ( now - t._lastFrameTs ) / 1000 );
			t._lastFrameTs = now;
			this._emitRuntimeAction( 'PC.fe.viewer.frame', [ this, deltaSeconds, this._runtimeApi ] );
			this._emitRuntimeEvent( 'frame', { deltaSeconds } );
			t.controls.update();
			if ( t.fake_shadow && g.enabled !== false ) {
				t.fake_shadow.render( t.renderer, t.scene );
			}
			if ( t.postprocessingLayer ) {
				t.postprocessingLayer.render( t.bypassPostprocessing );
			}
			if ( ! t.postprocessingLayer || t.bypassPostprocessing ) {
				t.renderer.render( t.scene, t.camera );
			}
		};
		animate();
	},

	_getGltfLoader() {
		if ( this._gltfLoader ) return Promise.resolve( this._gltfLoader );
		return import( './3d-loader-factory.js' ).then( ( m ) => m.createGltfLoader( m.getDefaultGltfConfig() ) ).then( ( loader ) => {
			this._gltfLoader = loader;
			return loader;
		} );
	},

	_loadGltf( url, onSuccess, onError ) {
		if ( ! url ) return;
		this._getGltfLoader().then( ( loader ) => {
			loader.load( url, onSuccess, undefined, onError || ( () => {} ) );
		} ).catch( ( err ) => {
			if ( typeof onError === 'function' ) onError( err );
		} );
	},

	_ensureObjects3dSceneLoadedById( object3dId ) {
		const t = this._three;
		if ( ! t || ! t.model_root || object3dId == null || String( object3dId ).trim() === '' ) return Promise.resolve( null );
		const idStr = String( object3dId ).trim();
		const sceneModel = this._scene_models && this._scene_models.get( idStr );
		if ( ! sceneModel ) return Promise.resolve( null );

		const state = sceneModel.get( 'state' );
		if ( state === 'loaded' ) return Promise.resolve( sceneModel.get( 'scene' ) || null );
		if ( state === 'loading' && sceneModel.get( 'loadPromise' ) ) return sceneModel.get( 'loadPromise' );

		const url = sceneModel.get( 'url' );
		if ( ! url ) {
			sceneModel.set( { state: 'error', loadPromise: null } );
			return Promise.resolve( null );
		}

		const loadPromise = new Promise( ( resolve ) => {
			this._loadGltf(
				url,
				( gltf ) => {
					const scene = gltf && gltf.scene ? gltf.scene : null;
					if ( ! scene ) {
						sceneModel.set( { state: 'error', loadPromise: null } );
						resolve( null );
						return;
					}
					removeLightsFromScene( scene );
					const sceneToAdd = scene.parent != null ? scene.clone( true ) : scene;
					sceneToAdd.userData = sceneToAdd.userData || {};
					sceneToAdd.userData.object_id = idStr;
					sceneToAdd.userData.gltf_functions = gltf && gltf.functions ? gltf.functions : null;
					const obj = sceneModel.get( 'object3d' );
					const attId = obj && obj.gltf && obj.gltf.attachment_id != null ? obj.gltf.attachment_id : null;
					if ( attId != null ) sceneToAdd.userData.attachment_id = attId;

					sceneModel.set( {
						scene: sceneToAdd,
						state: 'loaded',
						animations: Array.isArray( gltf.animations ) ? gltf.animations : [],
						loadPromise: null,
					} );
					this._applyShadowFlagsToObject( sceneToAdd, this._shadowsEnabled );
					if ( ! sceneToAdd.parent ) t.model_root.add( sceneToAdd );
					registerSceneMaterials( t, sceneToAdd );
					this._objectIdToScene[ idStr ] = sceneToAdd;
					this._syncLayerSceneForObjectId( idStr, sceneToAdd );
					this._apply_layer_cshow_visibility();
					this._emitRuntimeAction( 'PC.fe.viewer.object3d.loaded', [ this, idStr, sceneToAdd, sceneModel.get( 'animations' ) || [], this._runtimeApi ] );
					this._emitRuntimeEvent( 'object3d:loaded', { object3dId: idStr, scene: sceneToAdd, animations: sceneModel.get( 'animations' ) || [] } );
					resolve( sceneToAdd );
				},
				() => {
					sceneModel.set( { state: 'error', loadPromise: null } );
					resolve( null );
				}
			);
		} );

		sceneModel.set( { state: 'loading', loadPromise } );
		return loadPromise;
	},

	/**
	 * Lazily load an objects3d model based on a composite id "sourceId:objectName".
	 * sourceId can match objects3d _id/id or gltf.attachment_id.
	 *
	 * @param {string} compositeId
	 * @returns {Promise<THREE.Object3D|null>} scene root that was loaded/ensured
	 */
	_ensureObjects3dSceneLoadedForCompositeId( compositeId ) {
		if ( ! compositeId ) return Promise.resolve( null );
		const id = String( compositeId ).trim();
		const sepIdx = id.indexOf( ':' );
		if ( sepIdx === -1 ) return Promise.resolve( null );
		const sourceId = id.slice( 0, sepIdx );
		if ( ! sourceId ) return Promise.resolve( null );

		const byId = this._objects3dById ? this._objects3dById.get( sourceId ) : null;
		const byAtt = this._objects3dByAttachmentId ? this._objects3dByAttachmentId.get( sourceId ) : null;
		const obj = byId || byAtt;
		if ( ! obj ) return Promise.resolve( null );
		const oid = String( obj._id != null ? obj._id : obj.id || '' );
		if ( ! oid ) return Promise.resolve( null );
		return this._ensureObjects3dSceneLoadedById( oid );
	},

	apply_preview_settings() {
		const t = this._three;
		const s = getSettings();
		if ( ! t || ! t.scene || ! t.renderer || ! s ) return;

		const urlRef = { get current() { return t.current_env_url; }, set current( v ) { t.current_env_url = v; } };
		applySettingsToScene( t.scene, t.renderer, t.controls, s, {
			fakeShadow: t.fake_shadow,
			modelRoot: t.model_root,
			getHdrBaseUrl,
			currentEnvUrlRef: urlRef,
			onEnvLoaded: () => this.apply_preview_settings(),
		} );
	},

	_findObject( root, object_id ) {
		if ( ! root ) return null;
		let found = null;
		root.traverse( ( obj ) => {
			if ( found ) return;
			if ( obj.name === object_id || ( obj.uuid && obj.uuid === object_id ) ) {
				found = obj;
			}
		} );
		return found;
	},

	/**
	 * Resolve object_id_3d (plain name/uuid or composite "sourceId:objectName") to a scene object.
	 * Uses findObjectByCompositeId so multiple loaded models are disambiguated by attachment_id/object_id.
	 */
	_findObjectById( id ) {
		const t = this._three;
		if ( ! t || ! t.model_root || id == null || String( id ).trim() === '' ) return null;
		const s = String( id ).trim();
		const byComposite = findObjectByCompositeId( t.model_root, s );
		if ( byComposite ) return byComposite;
		return this._findObject( t.model_root, s );
	},

	_getSceneByLayerId( layerId ) {
		if ( ! this._layer_scenes || ! layerId ) return null;
		const e = this._layer_scenes.find( ( x ) => String( x.layer_model.id ) === String( layerId ) );
		return e ? e.scene : null;
	},

	_apply_layer_cshow_visibility() {
		const cshow = ( model ) => false !== model.get( 'cshow' );
		if ( this._layer_scenes && this._layer_scenes.length ) {
			this._layer_scenes.forEach( ( { layer_model, scene } ) => {
				if ( scene ) scene.visible = cshow( layer_model );
			} );
		}
		if ( this._layer_objects && this._layer_objects.length ) {
			this._layer_objects.forEach( ( { layer_model, object } ) => {
				if ( object ) object.visible = cshow( layer_model );
			} );
		}
		// Keep active-angle framing in sync with current visibility state.
		this._applyAngleCamera( { reframe: true } );
	},

	_bind_layer_cshow() {
		const layerModels = new Set();
		if ( this._layer_scenes ) this._layer_scenes.forEach( ( { layer_model } ) => layerModels.add( layer_model ) );
		if ( this._layer_objects ) this._layer_objects.forEach( ( { layer_model } ) => layerModels.add( layer_model ) );
		const layers = window.PC.fe && window.PC.fe.layers;
		if ( layers ) {
			layers.each( ( layer_model ) => {
				const oid = layer_model.get( 'object_id_3d' );
				const object3dId = layer_model.get( 'object_3d_id' );
				if ( ! oid && object3dId ) layerModels.add( layer_model );
			} );
		}
		layerModels.forEach( ( layer_model ) => {
			this.listenTo( layer_model, 'change:cshow', this._apply_layer_cshow_visibility );
		} );
	},

	/**
	 * Capture a PNG screenshot of the current scene without changing what the user sees.
	 *
	 * @param {Object} [options]
	 * @param {'current'|'initial'|'gltf'} [options.view='current']
	 *        - 'current': use the live OrbitControls camera
	 *        - 'initial': use the framed camera stored after initial load (if available)
	 *        - 'gltf': use the first camera found in the loaded glTF (if any)
	 * @param {number} [options.width] - output width (default: canvas width)
	 * @param {number} [options.height] - output height (default: canvas height)
	 * @returns {string|null} data URL (image/png) or null if capture is not possible
	 */
	captureScreenshot( options = {} ) {
		const t = this._three;
		if ( ! t || ! t.scene || ! t.renderer || ! t.camera ) return null;

		const mode = options.view || 'current';
		const scene = t.scene;
		const baseCamera = t.camera;
		let cameraForShot = baseCamera;

		// Choose which camera to use for the off-screen render.
		if ( mode === 'initial' && t.initial_camera_position && t.initial_controls_target ) {
			const cam = baseCamera.clone();
			cam.position.copy( t.initial_camera_position );
			cam.lookAt( t.initial_controls_target );
			cameraForShot = cam;
		} else if ( mode === 'gltf' ) {
			let otherCam = null;

			// Prefer explicit glTF cameras if present
			if ( t.gltf && Array.isArray( t.gltf.cameras ) && t.gltf.cameras.length ) {
				otherCam = t.gltf.cameras[ 0 ];
			}

			// Fallback: search the scene graph for any other camera
			if ( ! otherCam ) {
				const found = [];
				scene.traverse( ( obj ) => {
					if ( obj.isCamera && obj !== baseCamera ) found.push( obj );
				} );
				if ( found.length ) {
					otherCam = found[ 0 ];
				}
			}

			if ( otherCam ) {
				cameraForShot = otherCam;
			}
		}

		const renderer = t.renderer;
		const canvas = renderer.domElement;
		let width = options.width != null ? Math.max( 1, Math.floor( options.width ) ) : canvas.width;
		let height = options.height != null ? Math.max( 1, Math.floor( options.height ) ) : canvas.height;
		if ( ! width || ! height ) return null;

		// When using custom size, temporarily set camera aspect so the shot is not distorted.
		const needAspectRestore = ( width !== canvas.width || height !== canvas.height ) && cameraForShot === baseCamera;
		const savedAspect = needAspectRestore ? baseCamera.aspect : null;
		if ( needAspectRestore ) {
			baseCamera.aspect = width / height;
			baseCamera.updateProjectionMatrix();
		}

		// Render into an off-screen target so the visible canvas doesn't change.
		const renderTarget = new THREE.WebGLRenderTarget( width, height );
		renderTarget.texture.colorSpace = renderer.outputColorSpace;
		const prevTarget = renderer.getRenderTarget();

		renderer.setRenderTarget( renderTarget );
		renderer.render( scene, cameraForShot );
		renderer.setRenderTarget( prevTarget );

		if ( needAspectRestore && savedAspect != null ) {
			baseCamera.aspect = savedAspect;
			baseCamera.updateProjectionMatrix();
		}

		// Read pixels back and convert to a PNG data URL via a temporary 2D canvas.
		const pixels = new Uint8Array( width * height * 4 );
		renderer.readRenderTargetPixels( renderTarget, 0, 0, width, height, pixels );
		renderTarget.dispose();

		const outputCanvas = document.createElement( 'canvas' );
		outputCanvas.width = width;
		outputCanvas.height = height;
		const ctx = outputCanvas.getContext( '2d' );
		const imageData = ctx.createImageData( width, height );

		// WebGL's origin is bottom-left; flip vertically for the 2D canvas.
		for ( let y = 0; y < height; y++ ) {
			const srcY = height - 1 - y;
			const srcStart = srcY * width * 4;
			const destStart = y * width * 4;
			imageData.data.set(
				pixels.subarray( srcStart, srcStart + width * 4 ),
				destStart
			);
		}

		ctx.putImageData( imageData, 0, 0 );
		try {
			return outputCanvas.toDataURL( 'image/png' );
		} catch ( e ) {
			// Some browsers may block toDataURL for security reasons.
			return null;
		}
	},

	_create_choice_views() {
		const t = this._three;
		if ( ! t || ! t.model_root ) return;
		const root = t.model_root;
		const layers = window.PC.fe && window.PC.fe.layers;
		if ( ! layers ) return;

		if ( this._choice_views && this._choice_views.length ) {
			this._choice_views.forEach( ( view ) => view.remove() );
			this._choice_views = [];
		}

		const visibility_targets = new Set();
		layers.each( ( layer_model ) => {
			if ( layer_model.get( 'type') !== 'simple' && layer_model.get( 'type') !== 'multiple' ) return;
			const choices = window.PC.fe.getLayerContent && window.PC.fe.getLayerContent( layer_model.id );
			if ( ! choices ) return;
			choices.each( ( choice_model ) => {
				const actions = choice_model.get( 'actions_3d' );
				if ( ! Array.isArray( actions ) || ! actions.some( ( a ) => a.action_type === 'toggle_visibility' ) ) return;
				const main_oid = choice_model.get( 'object_id_3d' ) || layer_model.get( 'object_id_3d' );
				if ( main_oid ) visibility_targets.add( String( main_oid ).trim() );
			} );
		} );

		visibility_targets.forEach( ( id ) => {
			const obj = this._findObjectById( id );
			if ( obj ) obj.visible = false;
		} );

		this._choice_views = [];
		layers.each( ( layer_model ) => {
			const choices = window.PC.fe.getLayerContent && window.PC.fe.getLayerContent( layer_model.id );
			if ( ! choices ) return;
			choices.each( ( choice_model ) => {
				const has_3d = choice_model.get( 'object_id_3d' ) || ( Array.isArray( choice_model.get( 'actions_3d' ) ) && choice_model.get( 'actions_3d' ).length ) || choice_model.get( 'object_3d_id' );
				if ( ! has_3d ) return;
				const view = new viewer_3d_choice( {
					model: choice_model,
					layer_model: layer_model,
					parent: this,
				} );
				this._choice_views.push( view );
				view.apply_actions();
			} );
		} );
	},

	maybe_cleanup() {
		if ( this._choice_views && this._choice_views.length ) {
			this._choice_views.forEach( ( view ) => view.remove() );
			this._choice_views = [];
		}
		this._layer_scenes = [];
		this._layer_objects = [];
		this._gltfLoader = null;
		if ( this._scene_models ) this._scene_models.reset();
		this._objectIdToScene = {};
		this._shadowsEnabled = false;
		if ( this._three && this._three._cameraAnimId ) {
			cancelAnimationFrame( this._three._cameraAnimId );
			this._three._cameraAnimId = null;
		}
		if ( this._three ) this._emitRuntimeAction( 'PC.fe.viewer.runtime.dispose', [ this, this._three, this._runtimeApi ] );
		this._emitRuntimeEvent( 'runtime:dispose', {} );
		if ( this._runtimeBus ) this._runtimeBus.off();
		this._runtimeApi = null;
		this._lastActiveAngleId = null;
		cleanupThree( this._three );
		this._three = null;
	},

	remove() {
		this.maybe_cleanup();
		Backbone.View.prototype.remove.apply( this, arguments );
		return this;
	},
});
