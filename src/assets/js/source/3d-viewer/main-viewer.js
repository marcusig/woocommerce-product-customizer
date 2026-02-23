/**
 * Frontend 3D viewer – Backbone view that renders the product 3D model
 * using settings from PC.fe.currentProductData.settings_3d and applies
 * layer/choice 3D actions (visibility, material variant, color, texture).
 */
import * as THREE from 'three';
import { FakeShadow } from './3d-fake-shadow.js';
import viewer_3d_choice from './choice-view.js';
import { getSettings, getHdrBaseUrl, getPostprocessingFlags } from './3d-scene-config.js';
import { createPostprocessingLayer } from './3d-postprocessing.js';
import { createGltfLoader } from './3d-loader-factory.js';
import { initScene, cleanupThree } from './3d-scene-lifecycle.js';
import { applySettingsToScene } from './3d-apply-preview-settings.js';
import { hideObjectsByName, getHiddenObjectNamesList, getObjectTargetPosition } from './3d-scene-utils.js';

const Backbone = window.Backbone;
const wp = window.wp;

export default Backbone.View.extend({
	tagName: 'div',
	className: 'mkl_pc_viewer mkl_pc_viewer--3d',
	template: wp.template( 'mkl-pc-configurator-viewer' ),
	_three: null,

	initialize( options ) {
		this.parent = options.parent || window.PC.fe;
		if ( window.PC.fe && window.PC.fe.angles ) {
			this.listenTo( window.PC.fe.angles, 'change:active', this._applyAngleCamera );
		}
		return this;
	},

	_applyAngleCamera() {
		const t = this._three;
		if ( ! t || ! t.camera || ! t.controls ) return;
		const angles = window.PC.fe && window.PC.fe.angles;
		if ( ! angles ) return;
		const active = angles.findWhere( { active: true } );
		if ( ! active ) return;
		const pos = active.get( 'camera_position' );
		let tgt = active.get( 'camera_target' );
		const targetObjectId = active.get( 'camera_target_object_id' );
		if ( targetObjectId && t.model_root ) {
			const obj = this._findObject( t.model_root, String( targetObjectId ).trim() );
			if ( obj ) {
				getObjectTargetPosition( obj, t.controls.target );
				tgt = { x: t.controls.target.x, y: t.controls.target.y, z: t.controls.target.z };
			}
		}
		if ( pos && typeof pos.x === 'number' && typeof pos.y === 'number' && typeof pos.z === 'number' ) {
			t.camera.position.set( pos.x, pos.y, pos.z );
		}
		if ( tgt && typeof tgt.x === 'number' && typeof tgt.y === 'number' && typeof tgt.z === 'number' ) {
			t.controls.target.set( tgt.x, tgt.y, tgt.z );
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

		const s = getSettings();
		if ( ! s ) {
			this.$layers.append( '<p class="mkl_pc_3d_error">No 3D model configured.</p>' );
			wp.hooks.doAction( 'PC.fe.viewer.render', this );
			return this.$el;
		}

		this._initScene( container, s );
		this._loadInitialModels( s );
		wp.hooks.doAction( 'PC.fe.viewer.render', this );
		return this.$el;
	},

	_initScene( container, s ) {
		this.maybe_cleanup();
		this._three = initScene( container, s );
	},

	/**
	 * Register materials from a scene in the global registry. If a material with the same name
	 * already exists (different instance), replace the mesh's material with the registry one.
	 * @param {Object} t - this._three
	 * @param {THREE.Object3D} sceneRoot - Scene or group to traverse
	 */
	_registerSceneMaterials( t, sceneRoot ) {
		if ( ! t || ! t.material_registry || ! sceneRoot ) return;
		const registry = t.material_registry;

		sceneRoot.traverse( ( obj ) => {
			if ( ! obj.material ) return;

			const materials = Array.isArray( obj.material ) ? obj.material : [ obj.material ];
			const resolved = [];

			for ( let i = 0; i < materials.length; i++ ) {
				const mat = materials[ i ];
				if ( ! mat ) continue;

				const name = ( mat.name && String( mat.name ).trim() ) || mat.uuid;
				const existing = registry.get( name );

				if ( existing !== undefined && existing !== mat ) {
					resolved.push( existing );
				} else {
					registry.set( name, mat );
					resolved.push( mat );
				}
			}

			if ( resolved.length === 1 ) {
				obj.material = resolved[ 0 ];
			} else if ( resolved.length > 1 ) {
				obj.material = resolved;
			}
		} );
	},

	_getGltfLoader() {
		if ( ! this._gltfLoaderPromise ) {
			this._gltfLoaderPromise = createGltfLoader( null );
		}
		return this._gltfLoaderPromise;
	},

	_loadGltf( url, onSuccess, onError ) {
		if ( ! url ) return;
		this._getGltfLoader().then( ( loader ) => {
			loader.load( url, onSuccess, undefined, onError || ( () => {} ) );
		} ).catch( ( err ) => {
			if ( typeof onError === 'function' ) onError( err );
		} );
	},

	_load_choice_gltf( url, done ) {
		if ( ! url || typeof done !== 'function' ) return;
		const t = this._three;
		this._loadGltf(
			url,
			( gltf ) => {
				const scene = gltf && gltf.scene ? gltf.scene : null;
				if ( scene && t && t.material_registry ) {
					this._registerSceneMaterials( t, scene );
				}
				done( scene );
			},
			() => done( null )
		);
	},

	_loadInitialModels( s ) {
		const t = this._three;
		if ( ! t || ! t.scene ) return;

		const mainUrl = s.url || null;
		const layerEntries = []; // { layer_model, url } for layers with uploaded model
		const layers = window.PC.fe && window.PC.fe.layers;
		if ( layers ) {
			layers.each( ( layer_model ) => {
				if ( layer_model.get( 'object_selection_3d' ) !== 'upload_model' ) return;
				const url = layer_model.get( 'model_upload_3d_url' );
				if ( ! layer_model.get( 'model_upload_3d' ) || ! url ) return;
				layerEntries.push( { layer_model, url } );
			} );
		}
		
		if ( ! mainUrl && layerEntries.length === 0 ) {
			this.$layers.find( '.mkl_pc_3d_canvas_container' ).after( '<p class="mkl_pc_3d_error">No 3D model configured.</p>' );
			return;
		}

		const env = s.environment || {};
		const hdrBase = getHdrBaseUrl();
		const presetFile = ( env.preset === 'studio' ) ? 'studio_small_08_1k.hdr' : 'royal_esplanade_1k.hdr';
		const hdrUrl = ( env.mode === 'custom' && env.custom_hdr_url ) ? env.custom_hdr_url : hdrBase + presetFile;

		this.$layers.find( '.mkl_pc_3d_canvas_container' ).after( '<div class="mkl_pc_3d_loader">Loading…</div>' );
		const hideLoader = () => this.$layers.find( '.mkl_pc_3d_loader' ).remove();
		const showError = ( msg ) => {
			hideLoader();
			this.$layers.find( '.mkl_pc_3d_canvas_container' ).after( '<p class="mkl_pc_3d_error">' + ( msg || 'Failed to load 3D model.' ) + '</p>' );
		};

		const promises = [];

		if ( mainUrl ) {
			promises.push( new Promise( ( resolve, reject ) => {
				this._loadGltf(
					mainUrl,
					( gltf ) => resolve( { type: 'main', gltf } ),
					() => reject( new Error( 'Main model failed to load.' ) )
				);
			} ) );
		}

		layerEntries.forEach( ( { layer_model, url } ) => {
			promises.push( new Promise( ( resolve ) => {
				this._loadGltf(
					url,
					( gltf ) => resolve( { type: 'layer', layer_model, scene: gltf && gltf.scene ? gltf.scene : null } ),
					() => resolve( { type: 'layer', layer_model, scene: null } )
				);
			} ) );
		} );

		promises.push( new Promise( ( resolve ) => {
			new HDRLoader().load(
				hdrUrl,
				( texture ) => {
					texture.mapping = THREE.EquirectangularReflectionMapping;
					resolve( { type: 'hdr', texture } );
				},
				undefined,
				() => resolve( { type: 'hdr', texture: null } )
			);
		} ) );

		Promise.all( promises ).then( ( results ) => {
			let mainGltf = null;
			const layerResults = []; // { layer_model, scene }
			let hdrTexture = null;
			results.forEach( ( r ) => {
				if ( r.type === 'main' ) mainGltf = r.gltf;
				else if ( r.type === 'layer' ) layerResults.push( { layer_model: r.layer_model, scene: r.scene } );
				else if ( r.type === 'hdr' ) hdrTexture = r.texture;
			} );

			if ( mainUrl && ! mainGltf ) {
				showError( 'Failed to load 3D model.' );
				return;
			}

			hideLoader();

			if ( mainGltf ) {
				t.scene.add( mainGltf.scene );
				t.model_root = mainGltf.scene;
				t.gltf = mainGltf;
				this._registerSceneMaterials( t, mainGltf.scene );
			} else {
				const emptyRoot = new THREE.Group();
				t.scene.add( emptyRoot );
				t.model_root = emptyRoot;
				t.gltf = null;
			}

			this._layer_scenes = [];
			layerResults.forEach( ( { layer_model, scene } ) => {
				if ( scene ) {
					t.model_root.add( scene );
					this._registerSceneMaterials( t, scene );
					this._layer_scenes.push( { layer_model, scene } );
				}
			} );
			this._layer_objects = [];
			if ( layers && t.model_root ) {
				layers.each( ( layer_model ) => {
					if ( layer_model.get( 'object_selection_3d' ) === 'upload_model' ) return;
					const oid = layer_model.get( 'object_id_3d' );
					if ( ! oid ) return;
					const obj = this._findObject( t.model_root, String( oid ).trim() );
					if ( obj ) this._layer_objects.push( { layer_model, object: obj } );
				} );
			}
			this._apply_layer_cshow_visibility();
			this._bind_layer_cshow();

			const s = getSettings();
			const defaultHidden = ( window.PC.fe && window.PC.fe.currentProductData && window.PC.fe.currentProductData.default_hidden_object_names ) || null;
			const customHidden = ( s && s.hidden_object_names ) || '';
			hideObjectsByName( t.model_root, getHiddenObjectNamesList( defaultHidden, customHidden ) );

			if ( hdrTexture ) {
				t.scene.environment = hdrTexture;
				t.current_env_url = hdrUrl;
			}

			t.fake_shadow = new FakeShadow( t.scene );

			t.bypassPostprocessing = false;
			t.controls.addEventListener( 'start', () => { t.bypassPostprocessing = true; } );
			t.controls.addEventListener( 'end', () => { t.bypassPostprocessing = false; } );

			const flags = getPostprocessingFlags( s );
			createPostprocessingLayer( t.renderer, t.scene, t.camera, {
				width: t.container.clientWidth,
				height: t.container.clientHeight,
				flags
			} ).then( ( layer ) => {
				if ( ! t.container || ! t.on_resize ) return;
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
			} ).catch( () => {} );

			const box = new THREE.Box3().setFromObject( t.model_root );
			if ( ! box.isEmpty() ) {
				const size = box.getSize( new THREE.Vector3() ).length();
				const center = box.getCenter( new THREE.Vector3() );
				t.controls.target.copy( center );
				t.camera.position.copy( center ).add( new THREE.Vector3( size / 2, size / 2, size / 2 ) );
				t.camera.lookAt( center );
				// Store the framed camera as the \"initial\" view for later screenshots.
				if ( ! t.initial_camera_position ) {
					t.initial_camera_position = t.camera.position.clone();
					t.initial_controls_target = t.controls.target.clone();
				}
			}
			if ( t.on_resize ) t.on_resize();

			this.apply_preview_settings();
			this._applyAngleCamera();
			this._create_choice_views();

			const g = ( s && s.ground ) || {};
			const animate = () => {
				t.animation_id = requestAnimationFrame( animate );
				if ( document.hidden ) return;
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
		} ).catch( ( err ) => {
			showError( err && err.message ? err.message : 'Failed to load 3D model.' );
		} );
	},

	apply_preview_settings() {
		const t = this._three;
		const s = getSettings();
		if ( ! t || ! t.scene || ! t.renderer || ! s ) return;

		const urlRef = { get current() { return t.current_env_url; }, set current( v ) { t.current_env_url = v; } };
		applySettingsToScene( t.scene, t.renderer, t.controls, s, {
			defaultLight: t.default_light,
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
		const layers = window.PC.fe && window.PC.fe.layers;
		if ( layers ) {
			layers.each( ( layer_model ) => {
				const oid = layer_model.get( 'object_id_3d' );
				if ( oid ) return;
				const src = layer_model.get( 'object_selection_3d' );
				if ( src !== 'upload_model' && ( ! src || String( src ).indexOf( 'layer_' ) !== 0 ) ) return;
				if ( src === 'upload_model' ) return;
				const otherId = String( src ).replace( /^layer_/, '' );
				const otherScene = this._getSceneByLayerId( otherId );
				if ( otherScene ) otherScene.visible = cshow( layer_model );
			} );
		}
	},

	_bind_layer_cshow() {
		const layerModels = new Set();
		if ( this._layer_scenes ) this._layer_scenes.forEach( ( { layer_model } ) => layerModels.add( layer_model ) );
		if ( this._layer_objects ) this._layer_objects.forEach( ( { layer_model } ) => layerModels.add( layer_model ) );
		const layers = window.PC.fe && window.PC.fe.layers;
		if ( layers ) {
			layers.each( ( layer_model ) => {
				const oid = layer_model.get( 'object_id_3d' );
				const src = layer_model.get( 'object_selection_3d' );
				if ( ! oid && src && String( src ).indexOf( 'layer_' ) === 0 ) layerModels.add( layer_model );
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
			const obj = this._findObject( root, id );
			if ( obj ) obj.visible = false;
		} );

		this._choice_views = [];
		layers.each( ( layer_model ) => {
			const choices = window.PC.fe.getLayerContent && window.PC.fe.getLayerContent( layer_model.id );
			if ( ! choices ) return;
			choices.each( ( choice_model ) => {
				const has_3d = choice_model.get( 'object_id_3d' ) || ( Array.isArray( choice_model.get( 'actions_3d' ) ) && choice_model.get( 'actions_3d' ).length ) || choice_model.get( 'model_upload_3d' ) || choice_model.get( 'model_upload_3d_url' );
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
		cleanupThree( this._three );
		this._three = null;
	},

	remove() {
		this.maybe_cleanup();
		Backbone.View.prototype.remove.apply( this, arguments );
		return this;
	},
});
