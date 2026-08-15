/**
 * Admin 3D preview/scene methods mixin for PC.views.settings_3d.
 * Imported by 3d-settings.js.
 */

import { start_animation_loop } from '../../../../js/source/3d-viewer/3d-animation-loop.js';

const $ = window.jQuery;

function get_three() {
	return window.PC && window.PC.threeD && typeof window.PC.threeD.getTHREE === 'function'
		? window.PC.threeD.getTHREE()
		: null;
}

function get_three_deps() {
	return window.PC && window.PC.threeD && typeof window.PC.threeD.getThreeDeps === 'function'
		? window.PC.threeD.getThreeDeps()
		: null;
}

export const settings_3d_preview_mixin = {
	/**
	 * Resolve the environment map URL for the preview.
	 *
	 * Delegates to the same getHdrUrlFromEnv the frontend viewer uses, passing the
	 * admin's objects3d collection as the lookup source. The preview previously had
	 * its own copy of this logic, which had drifted: it treated a cubemap with a
	 * missing face as valid (the emptiness check compared against null, but a
	 * missing face reads as undefined) and returned no environment in cases where
	 * the frontend falls back to the preset.
	 *
	 * @param {Object} env - settings_3d.environment
	 * @returns {string|string[]|null} URL, cubemap URL array, or null to skip load
	 */
	get_env_url_for_preview: function ( env ) {
		const deps = get_three_deps();
		if ( ! deps || typeof deps.getHdrUrlFromEnv !== 'function' ) return null;
		const hdr_base = ( typeof PC_lang !== 'undefined' && PC_lang.hdr_base_url ) ? PC_lang.hdr_base_url : '';
		const col = PC.app.get_collection ? PC.app.get_collection( 'objects3d' ) : null;
		const objects3d = col && typeof col.toJSON === 'function' ? col.toJSON() : null;
		return deps.getHdrUrlFromEnv( env, hdr_base, objects3d );
	},
	apply_preview_settings: function () {
		const THREE = get_three();
		const deps = get_three_deps();
		if ( ! THREE || ! deps ) return;
		const { loadEnvMap, setSceneEnvironment } = deps;
		if ( !this._three || !this._three.scene || !this._three.renderer ) return;
		const s = PC.app.admin.settings_3d;
		const scene = this._three.scene;
		const renderer = this._three.renderer;

		// Renderer: tone mapping, exposure, alpha (color space always sRGB)
		const r = s.renderer || {};
		const bg = s.background || {};
		const env = s.environment || {};
		const env_is_none = env.mode === 'none';
		renderer.toneMapping = deps.getToneMapping( r );
		renderer.toneMappingExposure = typeof r.exposure === 'number' ? r.exposure : 1;
		renderer.outputColorSpace = THREE.SRGBColorSpace;

		const apply_background_and_env_props = function () {
			renderer.setClearAlpha( ( bg.mode === 'transparent' || r.alpha || ( bg.mode === 'environment' && env_is_none ) ) ? 0 : 1 );
			if ( bg.mode === 'transparent' || ( bg.mode === 'environment' && env_is_none ) ) {
				scene.background = null;
			} else if ( bg.mode === 'solid' && bg.color ) {
				scene.background = new THREE.Color( bg.color );
			} else if ( bg.mode === 'environment' && scene.environment ) {
				scene.background = scene.environment;
			}
			if ( typeof scene.environmentIntensity !== 'undefined' ) {
				scene.environmentIntensity = ( env.intensity != null ) ? env.intensity : 1;
			}
			if ( typeof scene.environmentRotation !== 'undefined' && env.rotation != null ) {
				scene.environmentRotation = new THREE.Euler( 0, env.rotation * Math.PI / 180, 0 );
				if ( typeof scene.backgroundRotation !== 'undefined' && bg.mode === 'environment' && ! env_is_none ) {
					scene.backgroundRotation = new THREE.Euler( 0, env.rotation * Math.PI / 180, 0 );
				}
			}
		};

		const desired_url = this.get_env_url_for_preview( env );
		const desired_key = Array.isArray( desired_url ) ? desired_url.join( '|' ) : desired_url || null;
		if ( ! desired_key ) {
			if ( typeof setSceneEnvironment === 'function' ) {
				setSceneEnvironment( scene, null );
			} else {
				scene.environment = null;
			}
			this._three.current_env_key = null;
			this._three.current_env_url = null;
			apply_background_and_env_props();
		} else if ( this._three.current_env_key !== desired_key ) {
			this._three.current_env_key = desired_key;
			loadEnvMap( desired_url, ( texture ) => {
				if ( typeof setSceneEnvironment === 'function' ) {
					setSceneEnvironment( scene, texture );
				} else {
					scene.environment = texture;
				}
				this._three.current_env_url = desired_url;
				apply_background_and_env_props();
			}, undefined, () => { this._three.current_env_key = null; } );
		} else {
			apply_background_and_env_props();
		}

		// OrbitControls polar, azimuth and zoom limits — resolved by the same helper
		// the frontend uses, so the preview cannot drift from what customers get.
		if ( this._three.controls && typeof deps.getOrbitLimitsFromEnv === 'function' ) {
			Object.assign( this._three.controls, deps.getOrbitLimitsFromEnv( env ) );
		}
		this.update_zoom_buttons_state();

		// Fake shadow (planar) – updated in fake_shadow.update() when model_root exists
		const g = s.ground || {};
		if ( this._three.fake_shadow && this._three.model_root ) {
			this._three.fake_shadow.update( this._three.model_root, g );
		}

		// Global light intensity (used by objects3d lights when applied in scene)
		const gi = 1;
		scene.traverse( ( obj ) => {
			if ( ! obj.isLight ) return;
			const base = obj.userData?.baseIntensity ?? obj.intensity;
			obj.intensity = base * gi;
		} );

		// Real-time shadows: re-applied on every settings change so the toggle takes
		// effect immediately, rather than only when the preview is next rebuilt.
		this.apply_shadow_settings();

		// Postprocessing: build or update the composer from settings (order: SSR → AO → Bloom → SMAA); loads passes async
		this.setup_preview_postprocessing();
	},
	/**
	 * Mirror settings_3d.enable_shadows onto the live preview: renderer flag, mesh
	 * flags and every light, with each shadow camera refitted to the model bounds.
	 */
	apply_shadow_settings: function () {
		const t = this._three;
		if ( ! t || ! t.renderer || ! t.scene ) return;
		if ( ! PC.threeD || typeof PC.threeD.refreshSceneShadows !== 'function' ) return;
		const s = PC.app.admin.settings_3d;
		PC.threeD.refreshSceneShadows( {
			renderer: t.renderer,
			scene: t.scene,
			modelRoot: t.model_root,
			enabled: !!( s && s.enable_shadows ),
		} );
	},
	setup_preview_postprocessing: async function () {
		// A rebuild loads pass modules asynchronously. Coalesce anything that
		// arrives meanwhile into a single reconcile once the build settles.
		if ( this._pp_building ) {
			this._pp_dirty = true;
			return;
		}
		const deps = get_three_deps();
		if ( ! deps ) return;
		let createPostprocessingLayer = deps.createPostprocessingLayer;
		if ( typeof createPostprocessingLayer !== 'function'
			&& window.wp && window.wp.hooks && typeof window.wp.hooks.applyFilters === 'function' ) {
			createPostprocessingLayer = window.wp.hooks.applyFilters( 'PC.3d.createPostprocessingLayer', null );
		}
		if ( typeof createPostprocessingLayer !== 'function' ) return;
		if ( !this._three || !this._three.scene || !this._three.camera || !this._three.renderer ) return;
		const s = PC.app.admin.settings_3d;
		const pp = ( s && s.postprocessing ) ? s.postprocessing : {};
		const scene = this._three.scene;
		const camera = this._three.camera;
		const renderer = this._three.renderer;
		const container = this.$( '.pc-3d-preview--canvas-container' )[0];
		if ( !container ) return;
		const w = container.clientWidth || 1;
		const h = container.clientHeight || 1;

		const options = {
			width: w,
			height: h,
			// The add-on resolves presets and per-effect values from the raw settings.
			settings: pp,
			isMobile: false,
			boundsObject: () => this._three && this._three.model_root,
		};

		// Tuning a slider fires on every input event: update the existing passes in
		// place instead of tearing down and reallocating the composer each time.
		const existing = this._three.postprocessingLayer;
		if ( existing && typeof existing.updateOptions === 'function' && existing.updateOptions( options ) ) {
			return;
		}

		if ( existing ) {
			existing.dispose();
			this._three.postprocessingLayer = null;
			this._three.composer = null;
		}

		this._pp_building = true;
		let layer = null;
		try {
			layer = await createPostprocessingLayer( renderer, scene, camera, options );
		} finally {
			this._pp_building = false;
		}

		// The preview can be torn down while the passes are loading.
		if ( ! this._three ) {
			if ( layer ) layer.dispose();
			return;
		}

		this._three.postprocessingLayer = layer;
		this._three.composer = layer ? layer.composer : null;

		if ( this._pp_dirty ) {
			this._pp_dirty = false;
			return this.setup_preview_postprocessing();
		}
	},
	on_window_resize: function () {

	},
	/**
	 * Tear the preview scene down.
	 *
	 * Ends by dropping the _three reference. Several async callbacks — the model
	 * store, the postprocessing build, onAllLoaded — guard on `!this._three` to
	 * detect exactly this, and while the reference survived teardown none of them
	 * could ever fire: composers were attached to disposed renderers and models
	 * finished loading into a scene that was already gone.
	 */
	maybe_cleanup: function () {
		const t = this._three;
		if ( ! t ) return;
		this._three = null;

		if ( typeof t.stop_animation_loop === 'function' ) {
			t.stop_animation_loop();
		}
		if ( t.animation_id ) {
			cancelAnimationFrame( t.animation_id );
			t.animation_id = null;
		}
		if ( t.fake_shadow ) {
			t.fake_shadow.dispose();
			t.fake_shadow = null;
		}
		if ( t.light_helpers && t.light_helpers.length ) {
			t.light_helpers.forEach( function ( h ) {
				if ( h.parent ) h.parent.remove( h );
				if ( h.dispose ) h.dispose();
			} );
			t.light_helpers = [];
		}
		if ( t.postprocessingLayer ) {
			t.postprocessingLayer.dispose();
			t.postprocessingLayer = null;
			t.composer = null;
		}
		if ( t.on_resize ) {
			window.removeEventListener( 'resize', t.on_resize );
			t.on_resize = null;
		}
		if ( t.controls ) t.controls.dispose();
		if ( t.renderer ) {
			t.renderer.dispose();
			if ( t.renderer.domElement?.parentNode ) {
				t.renderer.domElement.parentNode.removeChild( t.renderer.domElement );
			}
		}
		// Scene disposal is not conditional on the renderer: a bag without one still
		// holds geometries, materials, textures and the environment map.
		const deps = get_three_deps();
		if ( t.scene && deps && typeof deps.disposeScene === 'function' ) {
			deps.disposeScene( t.scene );
		}
		if ( t.material_registry && t.material_registry.clear ) {
			t.material_registry.clear();
		}
	},
	/**
	 * Collect 3D model entries (for preview and tree).
	 * @returns {Array<{ url: string, label: string }>}
	 */
	/**
	 * Get display label for an objects3d model (for preview loading steps and scene_roots).
	 * @param {Backbone.Model} model - Model from objects3d collection
	 * @returns {string}
	 */
	_get_model_entry_label: function ( model ) {
		return model.get( 'name' ) || model.get( 'filename' ) || ( 'Object #' + ( model.get( '_id' ) || model.id || '' ) );
	},
	get_model_entries: function () {
		const objects3d = PC.app.get_collection( 'objects3d' );
		if ( ! objects3d ) return [];
		return objects3d.where( { object_type: 'gltf' } );
	},

	_setPreviewLoadingStep: function ( stepId, label ) {
		const container = this.$( '.pc-3d-preview--canvas-container' )[0];
		if ( !container ) return;
		let overlay = container.querySelector( '.pc-3d-preview-loading' );
		if ( !overlay ) return;
		const list = overlay.querySelector( '.pc-3d-preview-loading-steps' );
		if ( !list ) return;
		let li = list.querySelector( '[data-step-id="' + stepId + '"]' );
		if ( li ) {
			li.querySelector( '.pc-3d-preview-loading-label' ).textContent = label;
			return;
		}
		li = document.createElement( 'li' );
		li.setAttribute( 'data-step-id', stepId );
		li.className = 'pc-3d-preview-loading-step';
		li.innerHTML = '<span class="spinner is-active" aria-hidden="true"></span> <span class="pc-3d-preview-loading-label">' + ( label || stepId ) + '</span>';
		list.appendChild( li );
	},
	_removePreviewLoadingStep: function ( stepId ) {
		const container = this.$( '.pc-3d-preview--canvas-container' )[0];
		if ( !container ) return;
		const li = container.querySelector( '.pc-3d-preview-loading [data-step-id="' + stepId + '"]' );
		if ( li ) li.remove();
	},
	_hidePreviewLoading: function () {
		const container = this.$( '.pc-3d-preview--canvas-container' )[0];
		if ( !container ) return;
		const overlay = container.querySelector( '.pc-3d-preview-loading' );
		if ( overlay ) overlay.classList.add( 'is-hidden' );
	},
	render_tree_loading: function () {
		const tree_el = this.$( '.pc-3d-tree' );
		if ( !tree_el.length ) return;
		tree_el.empty().append(
			'<div class="pc-3d-tree-loading"><span class="spinner is-active" aria-hidden="true"></span> ' +
			( ( typeof PC_lang !== 'undefined' && PC_lang.loading_scene_structure ) ? PC_lang.loading_scene_structure : 'Loading scene structure…' ) +
			'</div>'
		);
	},
	render_tree_message: function ( message ) {
		const tree_el = this.$( '.pc-3d-tree' );
		if ( !tree_el.length ) return;
		tree_el.empty().append( '<p class="pc-3d-tree-message description">' + ( message || '' ) + '</p>' );
	},

	render_preview: function ( url ) {
		const container = this.$( '.pc-3d-preview--canvas-container' )[0];
		if ( ! container ) return;

		this.maybe_cleanup();
		container.innerHTML = '';

		// Loading overlay: list of current steps (HDR, models)
		const loadingOverlay = document.createElement( 'div' );
		loadingOverlay.className = 'pc-3d-preview-loading';
		loadingOverlay.setAttribute( 'aria-live', 'polite' );
		loadingOverlay.innerHTML = '<ul class="pc-3d-preview-loading-steps" role="list"></ul>';
		container.appendChild( loadingOverlay );

		this.render_tree_loading();

		const depsReady = this._threeDepsPromise || ( PC.threeD.ensureReady && PC.threeD.ensureReady() );
		depsReady.then( () => {
			const THREE = get_three();
			const deps = get_three_deps();
			if ( ! THREE || ! deps ) return;
			const {
				OrbitControls,
				FakeShadow,
				loadEnvMap,
				hideObjectsByName,
				getHiddenObjectNamesList,
				findObjectByCompositeId,
				getObjectTargetPosition,
				removeLightsFromScene,
				registerSceneMaterials,
				RectAreaLightHelper,
			} = deps;

			const s = PC.app.admin.settings_3d;
			const r = s.renderer || {};
			const bg = s.background || {};
			// Enable alpha channel when transparent background or renderer alpha option is on (needed for see-through)
			const useAlpha = !!( r.alpha || bg.mode === 'transparent' );
			const renderer = new THREE.WebGLRenderer( {
				antialias: true,
				alpha: useAlpha,
				powerPreference: 'high-performance',
			} );
			const shadowsEnabled = !!( s && s.enable_shadows );
			PC.threeD.applyRendererShadowSettings( renderer, shadowsEnabled );
			renderer.setSize( container.clientWidth, container.clientHeight );
			renderer.setPixelRatio( deps.getPixelRatio() );
			renderer.toneMapping = deps.getToneMapping( r );
			renderer.toneMappingExposure = typeof r.exposure === 'number' ? r.exposure : 1;
			renderer.outputColorSpace = THREE.SRGBColorSpace;
			renderer.setClearAlpha( ( bg.mode === 'transparent' || r.alpha ) ? 0 : 1 );
			container.appendChild( renderer.domElement );

			const scene = new THREE.Scene();
			const camera = new THREE.PerspectiveCamera( 45, container.clientWidth / container.clientHeight, 0.1, 1000 );
			camera.position.set( 0, 1, 3 );

			this._three = { scene, camera, renderer, controls: null, animation_id: null, on_resize: null, fake_shadow: null, model_root: null, scene_roots: [], current_env_url: null, postprocessingLayer: null, composer: null, material_registry: new Map() };
			if ( window.wp && window.wp.hooks && typeof window.wp.hooks.doAction === 'function' ) {
				window.wp.hooks.doAction( 'PC.admin.3d_settings.viewer_ready', this, this._three, THREE );
			}

			const env = s.environment || {};
			const initial_env_url = this.get_env_url_for_preview( env );

			const modelEntries = this.get_model_entries();
			if ( initial_env_url ) {
				const hdrLabel = ( typeof PC_lang !== 'undefined' && PC_lang.loading_hdr ) ? PC_lang.loading_hdr : 'HDR environment';
				this._setPreviewLoadingStep( 'hdr', hdrLabel );
			}

			modelEntries.forEach( ( me, i ) => {
				const label = this._get_model_entry_label( me );
				this._setPreviewLoadingStep( 'model-' + i, ( typeof PC_lang !== 'undefined' && PC_lang.loading_model ) ? PC_lang.loading_model.replace( '%s', label ) : ( 'Model: ' + label ) );
			} );

			if ( !initial_env_url ) {
				this.apply_preview_settings();
			} else {
				loadEnvMap( initial_env_url, ( texture ) => {
					scene.environment = texture;
					this._three.current_env_url = initial_env_url;
					this._three.current_env_key = Array.isArray( initial_env_url ) ? initial_env_url.join( '|' ) : initial_env_url;
					this._removePreviewLoadingStep( 'hdr' );
					this.apply_preview_settings();
				}, undefined, () => {
					this._removePreviewLoadingStep( 'hdr' );
				} );
			}

			if ( bg.mode === 'transparent' ) scene.background = null;
			else if ( bg.mode === 'solid' && bg.color ) scene.background = new THREE.Color( bg.color );

			const controls = new OrbitControls( camera, renderer.domElement );
			controls.enableDamping = true;
			controls.dampingFactor = 0.1;
			controls.screenSpacePanning = false;

			Object.assign( controls, deps.getOrbitLimitsFromEnv( s.environment || {} ) );
			this._three.controls = controls;
			this._three.orbiting = false;
			// Drop composer resolution while dragging rather than bypassing the pass
			// chain, so the merchant is always looking at the look they configured.
			const set_orbiting = ( orbiting ) => {
				if ( ! this._three || this._three.orbiting === orbiting ) return;
				this._three.orbiting = orbiting;
				if ( ! this._three.postprocessingLayer ) return;
				const ratio = deps.getPixelRatio();
				this._three.postprocessingLayer.setPixelRatio(
					orbiting ? ratio * deps.ORBIT_PIXEL_RATIO_SCALE : ratio
				);
			};
			controls.addEventListener( 'start', () => set_orbiting( true ) );
			controls.addEventListener( 'end', () => set_orbiting( false ) );

			const on_resize = () => {
				if ( ! this._three ) return;
				const w = container.clientWidth;
				const h = container.clientHeight;
				const pr = deps.getPixelRatio();
				camera.aspect = w / h;
				camera.updateProjectionMatrix();
				renderer.setSize( w, h );
				renderer.setPixelRatio( pr );
				if ( this._three.postprocessingLayer ) {
					this._three.postprocessingLayer.setSize( w, h );
					this._three.postprocessingLayer.setPixelRatio(
						this._three.orbiting ? pr * deps.ORBIT_PIXEL_RATIO_SCALE : pr
					);
				}
			};

			this._three.on_resize = on_resize;
			window.addEventListener( 'resize', on_resize );

			const rootGroup = new THREE.Group();
			rootGroup.name = 'ConfiguratorRoot';

			// Always run model load in next tick so the animation loop is started first (fixes preview not loading when store returns cached data synchronously)
			var viewRef = this;
			var scene_roots = [];

			var onAllLoaded = function () {
				if ( !viewRef._three || !viewRef._three.scene ) return;
				viewRef._hidePreviewLoading();
				if ( viewRef._three.fake_shadow ) {
					viewRef._three.fake_shadow.dispose();
					viewRef._three.fake_shadow = null;
				}

				viewRef._three.THREE = THREE;

				viewRef._three.scene.add( rootGroup );
				viewRef._three.model_root = rootGroup;
				viewRef._three.scene_roots = scene_roots;
				// Real-time shadows: meshes need cast/receive flags.
				rootGroup.traverse( function( obj ) {
					if ( obj && obj.isMesh ) {
						obj.castShadow = shadowsEnabled;
						obj.receiveShadow = shadowsEnabled;
					}
				} );
				const defaultHidden = ( typeof PC_lang !== 'undefined' && PC_lang.default_hidden_object_names ) ? PC_lang.default_hidden_object_names : null;
				const customHidden = ( viewRef.admin && viewRef.admin.settings_3d && viewRef.admin.settings_3d.hidden_object_names ) || '';
				hideObjectsByName( rootGroup, getHiddenObjectNamesList( defaultHidden, customHidden ) );
				viewRef._three.fake_shadow = new FakeShadow( viewRef._three.scene );
				viewRef.render_tree( viewRef._three.scene_roots );
				var s = PC.app.admin.settings_3d;
				var gi = 1;
				var objects3dCol = PC.app.get_collection( 'objects3d' );
				viewRef._three.light_helpers = viewRef._three.light_helpers || [];
				// Measured once: the model does not change while the light loop runs,
				// and setFromObject walks the whole tree.
				var lightBounds = rootGroup ? new THREE.Box3().setFromObject( rootGroup ) : null;
				if ( objects3dCol && typeof PC.threeD.createLightFromSettings === 'function' ) {
					objects3dCol.each( function ( obj ) {
						if ( obj.get( 'object_type' ) !== 'light' ) return;
						var settings = {
							type: obj.get( 'light_type' ) || 'PointLight',
							color: obj.get( 'light_color' ) || '#ffffff',
							intensity: ( obj.get( 'light_intensity' ) != null ) ? obj.get( 'light_intensity' ) : 1
						};
						settings.position = obj.get( 'light_position' );
						settings.target = obj.get( 'light_target' );
						settings.angle = obj.get( 'light_angle' );
						settings.penumbra = obj.get( 'penumbra' );
						settings.distance = obj.get( 'distance' );
						settings.decay = obj.get( 'decay' );
						settings.width = obj.get( 'rect_width' );
						settings.height = obj.get( 'rect_height' );
						// Optional explicit rotation (degrees) for RectAreaLight and other lights.
						var rot = obj.get( 'rect_rotation' );
						if ( rot ) settings.rotation = rot;
						settings.groundColor = obj.get( 'light_ground_color' );
						var light = PC.threeD.createLightFromSettings( settings, gi );
						light.name = obj.get( 'name' ) || 'Light';
						// Remembered on the light so shadows can be re-applied when the
						// setting is toggled, without walking back to the objects3d model.
						light.userData.cast_shadows = obj.get( 'cast_shadows' ) === true;
						PC.threeD.applyShadowSettingsToLight( light, {
							enabled: shadowsEnabled,
							castShadows: light.userData.cast_shadows,
							bounds: lightBounds,
						} );
						var targetId = obj.get( 'light_target_object_id' );
						if ( light.target && targetId && rootGroup && typeof findObjectByCompositeId === 'function' && typeof getObjectTargetPosition === 'function' ) {
							var targetObj = findObjectByCompositeId( viewRef._three.scene, targetId );
							if ( targetObj ) getObjectTargetPosition( targetObj, light.target.position );
						} else if ( light.target && settings.target ) {
							light.target.position.set(
								settings.target.x || 0,
								settings.target.y || 0,
								settings.target.z || 0
							);
						}
						viewRef._three.scene.add( light );
						if ( light.target ) viewRef._three.scene.add( light.target );
						var cookie = obj.get( 'light_cookie' );
						if ( cookie && cookie.url && typeof PC.threeD.applyLightCookie === 'function' ) {
							PC.threeD.applyLightCookie( light, cookie );
						}
						var helper = null;
						if ( THREE.PointLightHelper && light.isPointLight ) {
							helper = new THREE.PointLightHelper( light, 0.5 );
						} else if ( THREE.DirectionalLightHelper && light.isDirectionalLight ) {
							helper = new THREE.DirectionalLightHelper( light, 1 );
						} else if ( THREE.SpotLightHelper && light.isSpotLight ) {
							helper = new THREE.SpotLightHelper( light );
						} else if ( RectAreaLightHelper && light.isRectAreaLight ) {
							helper = new RectAreaLightHelper( light );
						}

						if ( helper ) {
							if ( light.isRectAreaLight ) {
								light.add( helper );
							} else {
								viewRef._three.scene.add( helper );
							}
							viewRef._three.light_helpers.push( helper );
						}
					} );
				}

				var box = new THREE.Box3().setFromObject( rootGroup );
				if ( !box.isEmpty() ) {
					var size = box.getSize( new THREE.Vector3() ).length();
					var center = box.getCenter( new THREE.Vector3() );
					var angles = viewRef.admin && viewRef.admin.angles;
					var selectedId = viewRef.$( '.pc-3d-angle-select' ).val();
					var angle = ( selectedId && angles ) ? angles.get( selectedId ) : null;
					if ( !angle && angles && angles.length ) angle = angles.first();
					var pos = angle && angle.get( 'camera_position' );
					var tgt = angle && angle.get( 'camera_target' );
					var targetFromObject = angle && rootGroup ? viewRef._resolveAngleTarget( angle, rootGroup ) : null;
					var orbitTarget = center.clone();
					if ( targetFromObject ) {
						orbitTarget.copy( targetFromObject );
						tgt = { x: targetFromObject.x, y: targetFromObject.y, z: targetFromObject.z };
					} else if ( tgt && typeof tgt.x === 'number' && typeof tgt.y === 'number' && typeof tgt.z === 'number' ) {
						orbitTarget.set( tgt.x, tgt.y, tgt.z );
					}
					controls.target.copy( orbitTarget );
					if ( pos && tgt && typeof pos.x === 'number' && typeof pos.y === 'number' && typeof pos.z === 'number' && typeof tgt.x === 'number' && typeof tgt.y === 'number' && typeof tgt.z === 'number' ) {
						camera.position.set( pos.x, pos.y, pos.z );
						camera.lookAt( orbitTarget.x, orbitTarget.y, orbitTarget.z );
					} else {
						camera.position.copy( center ).add( new THREE.Vector3( size / 2, size / 2, size / 2 ) );
						camera.lookAt( orbitTarget.x, orbitTarget.y, orbitTarget.z );
					}
					controls.update();
				}
				on_resize();
				viewRef.apply_preview_settings();
			};

			var runPreviewLoad = function () {
				// Load models from objects3d collection only (no main model)
				if ( modelEntries.length === 0 ) {
					onAllLoaded();
					return;
				}
				var pending = modelEntries.length;
				modelEntries.forEach( function ( me, i ) {
					const gltf = me.get( 'gltf' );
					if ( ! gltf || ! gltf.url ) {
						pending--;
						if ( pending === 0 ) onAllLoaded();
						return;
					}
					const url = gltf.url;
					PC.threeD.store.get( url, function ( errModel, dataModel ) {
						if ( ! viewRef._three ) return;
						viewRef._removePreviewLoadingStep( 'model-' + i );
						if ( errModel || ! dataModel ) {
							pending--;
							if ( pending === 0 ) onAllLoaded();
							return;
						}
						var modelScene = dataModel.gltf.scene.clone( true );
						// Remove any lights included in the GLTF; only objects3d lights should be used.
						if ( typeof removeLightsFromScene === 'function' ) {
							removeLightsFromScene( modelScene );
						}
						if ( typeof registerSceneMaterials === 'function' ) {
							registerSceneMaterials( viewRef._three, modelScene );
						}
						var label = viewRef._get_model_entry_label( me );
						modelScene.name = label || modelScene.name;
						rootGroup.add( modelScene );
						modelScene.userData.object_id = me.id;
						modelScene.userData.name = me.get( 'name' );
						if ( me.get( 'loading_strategy' ) === 'lazy' ) {
							modelScene.visible = false;
						}
						scene_roots.push( { object_id: me.get( '_id' ), object: modelScene, label: label } );
						pending--;
						if ( pending === 0 ) onAllLoaded();
					} );
				} );
			};
			setTimeout( runPreviewLoad, 0 );

			// Fully pauses (cancelAnimationFrame) while the document is hidden.
			start_animation_loop( this._three, () => {
				// The bag is dropped by maybe_cleanup; the loop is stopped there too,
				// but guard rather than rely on the ordering.
				if ( ! this._three ) return;
				controls.update();
				if ( this._three.light_helpers && this._three.light_helpers.length ) {
					this._three.light_helpers.forEach( function ( h ) {
						if ( h.update ) h.update();
					} );
				}
				const g = PC.app.admin.settings_3d.ground || {};
				if ( this._three.fake_shadow && g.enabled !== false ) {
					this._three.fake_shadow.render( renderer, scene );
				}
				if ( this._three.postprocessingLayer ) {
					this._three.postprocessingLayer.render();
				} else {
					renderer.render( scene, camera );
				}
			} );
		} );
	},
	/**
	 * Build tree UI from scene roots (layer models). Each item has a visibility toggle.
	 *
	 * Children are built the first time a node is expanded rather than up front.
	 * A CAD-derived model runs to thousands of nodes, and eagerly creating a row,
	 * a toggle, a checkbox and two event bindings for every one of them locked the
	 * admin tab for seconds and pinned the whole scene graph in jQuery's data cache.
	 * Events are delegated from the tree root for the same reason.
	 *
	 * @param {Array<{ object: THREE.Object3D, label: string }>} scene_roots
	 */
	render_tree: function ( scene_roots ) {
		const tree_el = this.$( '.pc-3d-tree' ).empty();
		const view_ref = this;
		if ( !scene_roots || !scene_roots.length ) {
			const msg = ( typeof PC_lang !== 'undefined' && PC_lang.no_objects_in_scene ) ? PC_lang.no_objects_in_scene : 'No objects in scene.';
			tree_el.append( '<p class="pc-3d-tree-message description">' + msg + '</p>' );
			return;
		}

		const invalidate_shadow = function () {
			if ( view_ref._three && view_ref._three.fake_shadow && typeof view_ref._three.fake_shadow.invalidate === 'function' ) {
				view_ref._three.fake_shadow.invalidate();
			}
		};

		/**
		 * One row. Children are not built here — see expand_item.
		 *
		 * @param {THREE.Object3D} obj
		 * @param {string} [label] - overrides the derived "name [type]" label
		 * @param {boolean} [is_root]
		 * @returns {jQuery}
		 */
		const build_item = ( obj, label, is_root ) => {
			const has_children = !! ( obj.children && obj.children.length );
			const li_el = $( '<li class="pc-3d-tree-item">' )
				.toggleClass( 'pc-3d-tree-item--root', !! is_root )
				.toggleClass( 'pc-3d-tree-item--has-children', has_children )
				// Collapsed by default: expanding is what builds the children.
				.toggleClass( 'is-collapsed', has_children )
				.data( 'object3d', obj );

			if ( has_children ) {
				li_el.append(
					$( '<button type="button" class="pc-3d-tree-toggle" aria-label="Toggle children" aria-expanded="false"></button>' )
				);
			}

			li_el.append(
				$( '<input type="checkbox" class="pc-3d-tree-visible" title="Show/hide in preview">' )
					.prop( 'checked', obj.visible !== false )
			);
			li_el.append( ' ' );
			li_el.append(
				$( '<span class="pc-3d-tree-label">' ).text( label || ( ( obj.name || '' ) + ' [' + ( obj.type || '' ) + ']' ) )
			);
			return li_el;
		};

		/** Build one level of children under an item, once. */
		const expand_item = ( $li ) => {
			if ( $li.data( 'children-built' ) ) return;
			$li.data( 'children-built', true );
			const obj = $li.data( 'object3d' );
			if ( ! obj || ! obj.children ) return;
			const child_ul = $( '<ul>' );
			obj.children.forEach( ( child ) => child_ul.append( build_item( child ) ) );
			$li.append( child_ul );
		};

		/** Expand an item and mark its toggle accordingly. */
		const open_item = ( $li ) => {
			expand_item( $li );
			$li.removeClass( 'is-collapsed' );
			$li.children( 'ul' ).show();
			$li.children( '.pc-3d-tree-toggle' ).attr( 'aria-expanded', 'true' );
		};

		const ul_el = $( '<ul class="pc-3d-tree-list">' );
		const root_items = scene_roots.map( ( { object, label } ) => {
			const $li = build_item( object, label, true );
			ul_el.append( $li );
			return $li;
		} );

		// Delegated: one pair of handlers for the whole tree, however deep it goes.
		// Namespaced and cleared first, because render_tree runs again on every reload.
		tree_el
			.off( '.pc3dtree' )
			.on( 'click.pc3dtree', '.pc-3d-tree-toggle', function () {
				const $li = $( this ).closest( '.pc-3d-tree-item' );
				const is_collapsed = $li.toggleClass( 'is-collapsed' ).hasClass( 'is-collapsed' );
				if ( ! is_collapsed ) expand_item( $li );
				$li.children( 'ul' ).toggle( ! is_collapsed );
				$( this ).attr( 'aria-expanded', String( ! is_collapsed ) );
			} )
			.on( 'change.pc3dtree', '.pc-3d-tree-visible', function () {
				const obj = $( this ).closest( '.pc-3d-tree-item' ).data( 'object3d' );
				if ( obj ) obj.visible = this.checked;
				invalidate_shadow();
			} );

		tree_el.append( ul_el );

		// The model's top-level parts are what the merchant is looking for, so open
		// the roots straight away. Everything below stays lazy.
		root_items.forEach( open_item );
	},
};
