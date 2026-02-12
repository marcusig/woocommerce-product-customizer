/**
 * Frontend 3D viewer – Backbone view that renders the product 3D model
 * using settings from PC.fe.currentProductData.settings_3d and applies
 * layer/choice 3D actions (visibility, material variant, color, texture).
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { FakeShadow } from '../../../admin/js/views/3d-fake-shadow.js';
import GLTFMaterialsVariantsExtension from '../../vendor/KHR_materials_variants.js';
import viewer_3d_choice from './choice-view.js';

const Backbone = window.Backbone;
const wp = window.wp;

function getSettings() {
	const data = window.PC && window.PC.fe && window.PC.fe.currentProductData;
	return (data && data.settings_3d) ? data.settings_3d : null;
}

function getHdrBaseUrl() {
	if ( typeof window.PC_lang !== 'undefined' && window.PC_lang.hdr_base_url ) {
		return window.PC_lang.hdr_base_url;
	}
	return ( window.PC_config && window.PC_config.assets_url ) ? window.PC_config.assets_url + 'images/hdr/' : '';
}

// Create a light from settings (mirrors admin _create_light_from_settings)
function createLightFromSettings( settings, gi ) {
	const color = new THREE.Color( settings.color || '#ffffff' );
	const base = ( settings.intensity != null ) ? settings.intensity : 1;
	const intensity = base * gi;
	const type = settings.type || 'PointLight';
	let light;
	if ( type === 'DirectionalLight' ) {
		light = new THREE.DirectionalLight( color, intensity );
	} else if ( type === 'SpotLight' ) {
		light = new THREE.SpotLight( color, intensity );
	} else {
		light = new THREE.PointLight( color, intensity );
	}
	light.userData = light.userData || {};
	light.userData.baseIntensity = base;
	return light;
}

export default Backbone.View.extend({
	tagName: 'div',
	className: 'mkl_pc_viewer mkl_pc_viewer--3d',
	template: wp.template( 'mkl-pc-configurator-viewer' ),
	_three: null,

	initialize( options ) {
		this.parent = options.parent || window.PC.fe;
		return this;
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
		const r = s.renderer || {};
		const renderer = new THREE.WebGLRenderer( { antialias: true, alpha: !!r.alpha } );
		renderer.shadowMap.enabled = false;
		renderer.setSize( container.clientWidth, container.clientHeight );
		renderer.setPixelRatio( window.devicePixelRatio );
		renderer.toneMapping = r.tone_mapping === 'aces' ? THREE.ACESFilmicToneMapping : r.tone_mapping === 'linear' ? THREE.LinearToneMapping : THREE.NoToneMapping;
		renderer.toneMappingExposure = typeof r.exposure === 'number' ? r.exposure : 1;
		renderer.outputColorSpace = r.output_color_space === 'linear' ? THREE.LinearSRGBColorSpace : THREE.SRGBColorSpace;
		renderer.setClearAlpha( r.alpha ? 0 : 1 );
		container.appendChild( renderer.domElement );

		const scene = new THREE.Scene();
		const camera = new THREE.PerspectiveCamera( 45, container.clientWidth / container.clientHeight, 0.1, 1000 );
		camera.position.set( 0, 1, 3 );

		// Only add default light if enabled in settings (matches admin behaviour).
		const lighting = s.lighting || {};
		let defaultLight = null;
		if ( lighting.default_light_enabled !== false ) {
			defaultLight = new THREE.DirectionalLight( 0xffffff, 1.2 );
			defaultLight.position.set( 5, 10, 7.5 );
			defaultLight.userData = { baseIntensity: 1.2, isDefaultLight: true };
			scene.add( defaultLight );
			scene.add( defaultLight.target );
		}

		const controls = new OrbitControls( camera, renderer.domElement );
		const env = s.environment || {};
		const minPolar = ( env.orbit_min_polar_angle != null ) ? env.orbit_min_polar_angle : 0;
		const maxPolar = ( env.orbit_max_polar_angle != null ) ? env.orbit_max_polar_angle : 90;
		controls.minPolarAngle = ( minPolar * Math.PI ) / 180;
		controls.maxPolarAngle = ( maxPolar * Math.PI ) / 180;

		const onResize = () => {
			camera.aspect = container.clientWidth / container.clientHeight;
			camera.updateProjectionMatrix();
			renderer.setSize( container.clientWidth, container.clientHeight );
			renderer.setPixelRatio( window.devicePixelRatio );
		};
		window.addEventListener( 'resize', onResize );

		this._three = {
			scene,
			camera,
			renderer,
			controls,
			animation_id: null,
			on_resize: onResize,
			fake_shadow: null,
			model_root: null,
			gltf: null,
			current_env_url: null,
			default_light: defaultLight,
			container,
			// Will be filled after initial framing so we can reuse it for screenshots
			initial_camera_position: null,
			initial_controls_target: null,
		};
	},

	_loadGltf( url, onSuccess, onError ) {
		if ( ! url ) return;
		const loader = new GLTFLoader();
		const config = ( window.PC_config && window.PC_config.config ) || {};
		if ( config.fe_3d_use_draco_loader && typeof window.DRACOLoader !== 'undefined' ) {
			if ( ! this._dracoLoader ) {
				this._dracoLoader = new window.DRACOLoader();
				const decoderPath = config.fe_3d_draco_decoder_path || ( ( window.PC_config && window.PC_config.assets_url ) ? window.PC_config.assets_url + 'js/vendor/draco/gltf/' : '' );
				if ( decoderPath ) {
					this._dracoLoader.setDecoderPath( decoderPath );
				}
			}
			loader.setDRACOLoader( this._dracoLoader );
		}
		if ( config.fe_3d_use_meshopt_loader && typeof window.MeshoptDecoder !== 'undefined' ) {
			loader.setMeshoptDecoder( window.MeshoptDecoder );
		}
		loader.register( ( parser ) => new GLTFMaterialsVariantsExtension( parser ) );
		loader.load( url, onSuccess, undefined, onError || ( () => {} ) );
	},

	_load_choice_gltf( url, done ) {
		if ( ! url || typeof done !== 'function' ) return;
		this._loadGltf(
			url,
			( gltf ) => done( gltf && gltf.scene ? gltf.scene : null ),
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
			new RGBELoader().load(
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

			if ( hdrTexture ) {
				t.scene.environment = hdrTexture;
				t.current_env_url = hdrUrl;
			}
			console.log(t.model_root);
			
			t.fake_shadow = new FakeShadow( t.scene );

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
			this._create_choice_views();

			const g = ( s && s.ground ) || {};
			const animate = () => {
				t.animation_id = requestAnimationFrame( animate );
				t.controls.update();
				if ( t.fake_shadow && g.enabled !== false ) {
					t.fake_shadow.render( t.renderer, t.scene );
				}
				t.renderer.render( t.scene, t.camera );
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

		const scene = t.scene;
		const renderer = t.renderer;
		const r = s.renderer || {};
		renderer.toneMapping = r.tone_mapping === 'aces' ? THREE.ACESFilmicToneMapping : r.tone_mapping === 'linear' ? THREE.LinearToneMapping : THREE.NoToneMapping;
		renderer.toneMappingExposure = typeof r.exposure === 'number' ? r.exposure : 1;
		renderer.outputColorSpace = r.output_color_space === 'linear' ? THREE.LinearSRGBColorSpace : THREE.SRGBColorSpace;
		renderer.setClearAlpha( r.alpha ? 0 : 1 );

		const bg = s.background || {};
		if ( bg.mode === 'transparent' ) {
			scene.background = null;
		} else if ( bg.mode === 'solid' && bg.color ) {
			scene.background = new THREE.Color( bg.color );
		}

		const env = s.environment || {};
		const hdrBase = getHdrBaseUrl();
		const presetFile = ( env.preset === 'studio' ) ? 'studio_small_08_1k.hdr' : 'royal_esplanade_1k.hdr';
		const desiredUrl = ( env.mode === 'custom' && env.custom_hdr_url ) ? env.custom_hdr_url : hdrBase + presetFile;
		if ( t.current_env_url !== desiredUrl ) {
			t.current_env_url = desiredUrl;
			new RGBELoader().load(
				desiredUrl,
				( texture ) => {
					texture.mapping = THREE.EquirectangularReflectionMapping;
					scene.environment = texture;
					this.apply_preview_settings();
				},
				undefined,
				() => { t.current_env_url = null; }
			);
		}

		if ( t.controls ) {
			const minPolar = ( env.orbit_min_polar_angle != null ) ? env.orbit_min_polar_angle : 0;
			const maxPolar = ( env.orbit_max_polar_angle != null ) ? env.orbit_max_polar_angle : 90;
			t.controls.minPolarAngle = ( minPolar * Math.PI ) / 180;
			t.controls.maxPolarAngle = ( maxPolar * Math.PI ) / 180;
		}

		const g = s.ground || {};
		if ( t.fake_shadow && t.model_root ) {
			t.fake_shadow.update( t.model_root, g );
		}

		// Global light intensity and per-light settings (mirrors admin preview).
		const gi = ( s.lighting && s.lighting.global_intensity != null ) ? s.lighting.global_intensity : 1;
		const lightsList = ( s.lighting && s.lighting.lights ) || [];
		const sceneLights = [];
		scene.traverse( ( obj ) => {
			if ( ! obj.isLight || obj.userData?.isDefaultLight === true ) return;
			sceneLights.push( { obj, settings: lightsList[ sceneLights.length ] } );
		} );

		sceneLights.forEach( ( { obj, settings } ) => {
			let target = obj;
			target.userData = target.userData || {};
			if ( settings ) {
				const desiredType = settings.type || 'PointLight';
				const typeMatches =
					( desiredType === 'PointLight' && obj.isPointLight ) ||
					( desiredType === 'DirectionalLight' && obj.isDirectionalLight ) ||
					( desiredType === 'SpotLight' && obj.isSpotLight );
				if ( ! typeMatches ) {
					const parent = obj.parent;
					if ( parent ) {
						const idx = parent.children.indexOf( obj );
						const newLight = createLightFromSettings( settings, gi );
						newLight.position.copy( obj.position );
						newLight.quaternion.copy( obj.quaternion );
						if ( obj.target && newLight.target ) {
							newLight.target.position.copy( obj.target.position );
							if ( obj.target.parent ) {
								obj.target.parent.add( newLight.target );
							} else {
								parent.add( newLight.target );
							}
						}
						parent.remove( obj );
						parent.children.splice( idx, 0, newLight );
						newLight.parent = parent;
						target = newLight;
					}
				}
				target.visible = settings.enabled !== false;
				if ( target.visible ) {
					if ( settings.color ) target.color.set( settings.color );
					target.userData.baseIntensity = ( settings.intensity != null ) ? settings.intensity : ( target.userData.baseIntensity ?? target.intensity );
					target.intensity = target.userData.baseIntensity * gi;
				}
			} else {
				// No per-light override: only apply global intensity using stored baseIntensity.
				if ( target.userData.baseIntensity == null ) {
					target.userData.baseIntensity = target.intensity;
				}
				target.intensity = target.userData.baseIntensity * gi;
			}
		} );

		if ( t.default_light ) {
			const lighting = s.lighting || {};
			const enabled = lighting.default_light_enabled !== false;
			t.default_light.visible = enabled;
			if ( enabled ) {
				const base = ( t.default_light.userData && t.default_light.userData.baseIntensity != null )
					? t.default_light.userData.baseIntensity
					: 1.2;
				t.default_light.intensity = base * gi;
			}
		}
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
	},

	_bind_layer_cshow() {
		const layerModels = new Set();
		if ( this._layer_scenes ) this._layer_scenes.forEach( ( { layer_model } ) => layerModels.add( layer_model ) );
		if ( this._layer_objects ) this._layer_objects.forEach( ( { layer_model } ) => layerModels.add( layer_model ) );
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
		const t = this._three;
		if ( ! t ) return;
		if ( t.fake_shadow ) {
			t.fake_shadow.dispose();
			t.fake_shadow = null;
		}
		if ( t.animation_id ) {
			cancelAnimationFrame( t.animation_id );
			t.animation_id = null;
		}
		if ( t.on_resize ) {
			window.removeEventListener( 'resize', t.on_resize );
			t.on_resize = null;
		}
		if ( t.renderer ) {
			t.renderer.dispose();
			if ( t.renderer.domElement && t.renderer.domElement.parentNode ) {
				t.renderer.domElement.parentNode.removeChild( t.renderer.domElement );
			}
		}
		if ( t.controls ) t.controls.dispose();
		if ( t.scene ) {
			t.scene.traverse( ( obj ) => {
				if ( obj.geometry ) obj.geometry.dispose();
				if ( obj.material ) {
					if ( Array.isArray( obj.material ) ) {
						obj.material.forEach( ( m ) => m.dispose && m.dispose() );
					} else if ( obj.material.dispose ) {
						obj.material.dispose();
					}
				}
			} );
		}
		this._three = null;
	},

	remove() {
		this.maybe_cleanup();
		Backbone.View.prototype.remove.apply( this, arguments );
		return this;
	},
});
