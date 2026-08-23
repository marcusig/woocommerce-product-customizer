/**
 * Frontend 3D viewer – Backbone view that renders the product 3D model
 * using settings from PC.fe.currentProductData.settings_3d and applies
 * layer/choice 3D actions (visibility, material variant, color, texture).
 *
 * Pipeline: 1) Get settings → 2) Async load conditional modules → 3) Load assets → 4) Setup scene.
 */
import * as THREE from 'three';

if ( typeof window !== 'undefined' ) {
	window.THREE = THREE;
}

import viewer_3d_choice from './choice-view.js';
import { getSettings, getHdrBaseUrl, getPostprocessingSettings, isPostprocessingEnabled, getCustomPassFactories, isMobileViewport, getHdrUrlFromEnv, getPixelRatio, prefersReducedMotion, ORBIT_PIXEL_RATIO_SCALE } from './3d-scene-config.js';
import { initScene, cleanupThree } from './3d-scene-lifecycle.js';
import { applySettingsToScene } from './3d-apply-preview-settings.js';
import {
	create_error_element,
	create_loading_overlay,
	get_loading_string,
	get_poster_url,
	hide_loading_overlay,
	set_loading_progress,
	set_loading_step,
} from './loading-overlay.js';
import { start_animation_loop } from './3d-animation-loop.js';
import { hideObjectsByName, getHiddenObjectNamesList, getObjectTargetPosition, getBoundingBoxFromObjectIds, findObject, findObjectByCompositeId, createLightFromSettings, applyLightCookie, removeLightsFromScene, loadEnvMap, registerSceneMaterials, setSceneEnvironment, applyShadowFlagsToObject, applyShadowSettingsToLight, applyRendererShadowSettings, refreshSceneShadows, supportsLightShadows } from './3d-scene-utils.js';
import { warn_gltf_load_error } from './3d-gltf-load-error.js';

const Backbone = window.Backbone;
const wp = window.wp;

/**
 * Shape version of the object handed to add-ons on PC.fe.viewer.runtime.ready.
 * Bumped when something an add-on can observe changes; add-ons that need a
 * newer member should feature-detect it rather than compare numbers.
 */
const RUNTIME_API_VERSION = 1;

/**
 * Release passes that never made it into a composer. A pass holds render
 * targets and materials from the moment it is constructed, so one that is built
 * and then dropped leaks GPU memory for the life of the page.
 *
 * @param {Object[]} passes
 */
function disposeUnusedPasses( passes ) {
	passes.forEach( ( pass ) => {
		if ( pass && typeof pass.dispose === 'function' ) pass.dispose();
	} );
}

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
	_hiddenObjectNames: null,
	_angleReframeFrame: null,
	_sceneReady: false,
	_container: null,
	_contextLost: false,
	_rebuilding: false,
	_onContextLost: null,
	_onContextRestored: null,

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
		this._hiddenObjectNames = [];
		this._angleReframeFrame = null;
		this._sceneReady = false;
		this._container = null;
		this._contextLost = false;
		this._rebuilding = false;
		if ( window.PC.fe && window.PC.fe.angles ) {
			// Wrapped: Backbone calls change handlers with (model, value, options),
			// which would otherwise arrive as _applyAngleCamera's options argument.
			this.listenTo( window.PC.fe.angles, 'change:active', () => this._applyAngleCamera() );
		}
		return this;
	},

	/**
	 * Mark the scene as needing a frame.
	 *
	 * The render loop is on-demand: it only draws when something has actually
	 * changed. Two frames are queued rather than one, because a change that
	 * uploads a texture or recompiles a material often lands a frame after the
	 * call that caused it.
	 */
	_requestRender() {
		const t = this._three;
		if ( t ) t._render_frames = 2;
	},

	/**
	 * Reframe the active angle once per frame at most.
	 *
	 * Every choice switch fires twice (active:false on the outgoing choice, then
	 * active:true on the incoming one) and each lazy model load fires again, while
	 * a reframe costs a bounding-box pass over the focus objects plus a camera
	 * tween. Coalescing keeps that to one per interaction.
	 */
	_requestAngleReframe() {
		// Nothing to coalesce onto during setup, and _setupScene finishes by
		// applying the active angle itself. Scheduling here would land a reframe
		// tween immediately after that initial framing and visibly move the camera.
		if ( ! this._sceneReady ) return;
		if ( this._angleReframeFrame != null ) return;
		this._angleReframeFrame = requestAnimationFrame( () => {
			this._angleReframeFrame = null;
			if ( ! this._three ) return;
			this._applyAngleCamera( { reframe: true } );
		} );
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

	/**
	 * Announce that a choice action overwrote material state.
	 *
	 * Choice actions write straight onto the materials in the registry, and
	 * apply_material reassigns mesh.material outright. An add-on that installed
	 * its own material — a ShaderMaterial, or a stock material patched through
	 * onBeforeCompile — loses it the moment the customer clicks a choice that
	 * targets the same material or mesh. This is the signal to put it back, and
	 * it names exactly what moved so the add-on does not have to re-walk the
	 * scene to find out.
	 *
	 * Payload keys are camelCase because this crosses into the public runtime
	 * API; the handlers themselves use the snake_case of their own module.
	 *
	 * @param {Object} payload - From 3d-action-handlers, via choice-view
	 */
	_emitMaterialEvent( payload ) {
		const p = payload || {};
		const event = {
			phase: p.phase === 'restore' ? 'restore' : 'apply',
			actionType: p.action_type || '',
			action: p.action || null,
			material: p.material || null,
			materialName: p.material_name || '',
			meshes: Array.isArray( p.meshes ) ? p.meshes : [],
			variantRoot: p.variant_root || null,
			targetObject: p.target_object || null,
			targetScene: p.target_scene || null,
			choice: p.choice || null,
			layer: p.layer || null,
		};
		this._emitRuntimeAction( 'PC.fe.viewer.material.applied', [ this, event, this._runtimeApi ] );
		this._emitRuntimeEvent( 'material:applied', event );
	},

	_createRuntimeApi() {
		if ( this._runtimeApi ) return this._runtimeApi;
		this._runtimeApi = {
			// Bumped when the shape below changes in a way add-ons can observe.
			apiVersion: RUNTIME_API_VERSION,
			THREE,
			getTHREE: () => THREE,
			getScene: () => ( this._three ? this._three.scene : null ),
			getCamera: () => ( this._three ? this._three.camera : null ),
			getControls: () => ( this._three ? this._three.controls : null ),
			getRenderer: () => ( this._three ? this._three.renderer : null ),
			getModelRoot: () => ( this._three ? this._three.model_root : null ),
			// The live registry the choice actions write to: material name →
			// THREE.Material, built from every loaded model. An add-on that wants
			// to patch or replace what the configurator drives needs this rather
			// than its own traversal, or the two disagree about which material a
			// name refers to.
			getMaterialRegistry: () => ( this._three ? this._three.material_registry : null ),
			getMaterial: ( name ) => {
				const t = this._three;
				if ( ! t || ! t.material_registry || name == null ) return null;
				return t.material_registry.get( String( name ) ) || null;
			},
			// Shared so add-on textures land in the same cache and colour space
			// handling as the host's.
			getTextureLoader: () => ( this._three ? this._three.textureLoader : null ),
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
			pauseRenderLoop: () => this._pauseRenderLoop(),
			resumeRenderLoop: () => this._resumeRenderLoop(),
			// Rendering is on-demand. Add-ons that mutate the scene outside of the
			// host's own change handlers — animation mixers, canvas textures — must
			// call this or their work will not reach the screen.
			requestRender: () => this._requestRender(),
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
		// A swooping camera on every choice click is exactly what
		// prefers-reduced-motion is for; jump straight to the new framing.
		const immediate = opts.immediate === true || prefersReducedMotion();
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
			this._requestRender();
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
			this._requestRender();
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
				const obj = findObject( t.model_root, String( targetObjectId ).trim() );
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

		if ( s.extend_under_toolbar ) {
			this.$el.addClass( 'mkl_pc_viewer--extend-under-toolbar' );
		} else {
			this.$el.removeClass( 'mkl_pc_viewer--extend-under-toolbar' );
		}

		// Phase 1 done (we have s). Run pipeline: phases 2 → 3 → 4.
		this._container = container;
		this._showLoadingOverlay( container );
		this._runViewerPipeline( container, s )
			.then( () => {
				this._hideLoadingOverlay();
				wp.hooks.doAction( 'PC.fe.viewer.render', this );
			} )
			.catch( ( err ) => {
				this._hideLoadingOverlay();
				this._handlePipelineError( err );
			} );

		return this.$el;
	},

	/**
	 * Decide what the customer sees when the viewer cannot start.
	 *
	 * A browser with no WebGL is not an error the shopper can act on, so show
	 * the product poster instead — a still image of the product sells better
	 * than a failure message. Everything else keeps the explicit error.
	 *
	 * @param {Error} err
	 */
	_handlePipelineError( err ) {
		if ( err && err.isWebGLUnavailable ) {
			this._showPosterFallback();
			this._emitRuntimeAction( 'PC.fe.viewer.webgl.unavailable', [ this, err ] );
			return;
		}
		this._showError( err && err.message ? err.message : 'Failed to load 3D model.' );
	},

	/**
	 * Replace the viewer with the configured poster image, or an explanatory
	 * line when the product has no poster set.
	 */
	_showPosterFallback() {
		const container = this._container;
		if ( ! container ) return;
		const poster_url = get_poster_url( getSettings() );
		if ( ! poster_url ) {
			this._showError( get_loading_string(
				'webgl_unavailable',
				'3D view is not supported by this browser.'
			) );
			return;
		}
		const poster = document.createElement( 'div' );
		poster.className = 'mkl_pc_3d_poster_fallback';
		poster.style.backgroundImage = 'url(' + JSON.stringify( poster_url ) + ')';
		poster.setAttribute( 'role', 'img' );
		poster.setAttribute( 'aria-label', get_loading_string(
			'webgl_unavailable',
			'3D view is not supported by this browser.'
		) );
		container.after( poster );
		this.$el.addClass( 'mkl_pc_viewer--poster-fallback' );
	},

	/**
	 * Watch for the browser taking the WebGL context away.
	 *
	 * Routine on mobile — background the tab for long enough, open a few more,
	 * or hit a driver reset, and the context is dropped. Without this the canvas
	 * goes black permanently with no error and no recovery, and the customer is
	 * looking at a blank product.
	 *
	 * @param {HTMLCanvasElement} canvas
	 */
	_bindContextLossHandlers( canvas ) {
		if ( ! canvas ) return;

		this._onContextLost = ( event ) => {
			// Required, or the browser will not fire webglcontextrestored.
			event.preventDefault();
			this._contextLost = true;
			this._pauseRenderLoop();
			this._emitRuntimeAction( 'PC.fe.viewer.context.lost', [ this, this._runtimeApi ] );
			this._emitRuntimeEvent( 'context:lost', {} );
			this._showContextLostOverlay();
		};

		this._onContextRestored = () => {
			this._contextLost = false;
			this._emitRuntimeAction( 'PC.fe.viewer.context.restored', [ this, this._runtimeApi ] );
			this._emitRuntimeEvent( 'context:restored', {} );
			this._rebuildAfterContextLoss();
		};

		canvas.addEventListener( 'webglcontextlost', this._onContextLost, false );
		canvas.addEventListener( 'webglcontextrestored', this._onContextRestored, false );
	},

	/**
	 * Show the poster (or a message) over the dead canvas, with a manual retry —
	 * some browsers never fire webglcontextrestored at all.
	 */
	_showContextLostOverlay() {
		if ( this._loadingOverlay ) return;
		const container = this._container;
		if ( ! container ) return;
		const overlay = create_loading_overlay( {
			text: get_loading_string( 'context_lost', '3D view interrupted' ),
			poster_url: get_poster_url( getSettings() ),
		} );
		overlay.classList.add( 'mkl_pc_3d_loader--context-lost' );

		const retry = document.createElement( 'button' );
		retry.type = 'button';
		retry.className = 'mkl_pc_3d_loader__retry';
		retry.textContent = get_loading_string( 'context_lost_retry', 'Reload 3D view' );
		retry.addEventListener( 'click', () => this._rebuildAfterContextLoss() );
		const content = overlay.querySelector( '.mkl_pc_3d_loader__content' ) || overlay;
		content.appendChild( retry );

		container.after( overlay );
		this._loadingOverlay = overlay;
	},

	/**
	 * Build the scene again on a fresh context.
	 *
	 * _setupScene already starts with maybe_cleanup, so re-running the pipeline
	 * is the whole recovery — no special-case teardown needed here.
	 */
	_rebuildAfterContextLoss() {
		if ( this._rebuilding ) return;
		const container = this._container;
		const s = getSettings();
		if ( ! container || ! s ) return;
		this._rebuilding = true;
		this._hideLoadingOverlay();
		this._showLoadingOverlay( container );
		this._runViewerPipeline( container, s )
			.then( () => {
				this._rebuilding = false;
				this._hideLoadingOverlay();
				wp.hooks.doAction( 'PC.fe.viewer.render', this );
			} )
			.catch( ( err ) => {
				this._rebuilding = false;
				this._hideLoadingOverlay();
				this._handlePipelineError( err );
			} );
	},

	_showLoadingOverlay( container ) {
		const settings = getSettings();
		const overlay = create_loading_overlay( {
			text: get_loading_string( 'loading_viewer', 'Loading…' ),
			poster_url: get_poster_url( settings ),
		} );
		container.after( overlay );
		this._loadingOverlay = overlay;
	},

	_setLoadingStep( text ) {
		set_loading_step( this._loadingOverlay, text || '' );
	},

	_hideLoadingOverlay() {
		const overlay = this._loadingOverlay;
		this._loadingOverlay = null;
		hide_loading_overlay( overlay );
	},

	_showError( msg ) {
		const container = this.$layers.find( '.mkl_pc_3d_canvas_container' )[ 0 ];
		if ( ! container ) return;
		if ( container.nextElementSibling && container.nextElementSibling.classList.contains( 'mkl_pc_3d_error' ) ) return;
		const element = create_error_element( msg || 'Failed to load 3D model.' );
		container.parentNode.insertBefore( element, container.nextSibling );
	},

	/** Forward GLTFLoader byte progress to the loading overlay. */
	_onGltfProgress( event ) {
		set_loading_progress( this._loadingOverlay, event );
	},

	/**
	 * Pipeline: load modules (phase 2) → load assets (phase 3) → setup scene (phase 4).
	 * @param {HTMLElement} container - Canvas container
	 * @param {Object} s - settings_3d from phase 1
	 * @returns {Promise<void>}
	 */
	async _runViewerPipeline( container, s ) {
		this._setLoadingStep( get_loading_string( 'loading_viewer_preparing', 'Preparing 3D…' ) );
		const modules = await this._loadModules( s );
		this._setLoadingStep( get_loading_string( 'loading_model', 'Loading 3D model…' ) );
		const assets = await this._loadAssets( s, modules );
		this._setLoadingStep( get_loading_string( 'loading_viewer_setup', 'Setting up scene…' ) );
		await this._setupScene( container, s, modules, assets );
	},

	/**
	 * Phase 2: Load conditional modules in parallel (loader, FakeShadow).
	 * Postprocessing creator comes from add-ons via PC.3d.createPostprocessingLayer.
	 * @param {Object} s - settings_3d
	 * @returns {Promise<{ gltfLoader: *, FakeShadow: *, createPostprocessingLayer: *, passFactories: function[] }>}
	 */
	async _loadModules( s ) {
		const { getSharedGltfLoader } = await import( './3d-loader-factory.js' );
		const groundEnabled = ( s.ground && s.ground.enabled !== false );
		// A registered custom pass is reason enough to build a composer, even
		// when none of the add-on's own effects are switched on for this product.
		const passFactories = getCustomPassFactories( s );
		const anyPostprocessing = isPostprocessingEnabled( s ) || passFactories.length > 0;

		const promises = [
			getSharedGltfLoader(),
		];
		if ( groundEnabled ) promises.push( import( './3d-fake-shadow.js' ) );

		const results = await Promise.all( promises );
		let idx = 0;
		const gltfLoader = results[ idx++ ];
		const FakeShadowModule = groundEnabled ? results[ idx++ ] : { FakeShadow: null };

		let createPostprocessingLayer = null;
		if ( anyPostprocessing && window.wp && window.wp.hooks && typeof window.wp.hooks.applyFilters === 'function' ) {
			const creator = window.wp.hooks.applyFilters( 'PC.3d.createPostprocessingLayer', null );
			if ( typeof creator === 'function' ) {
				createPostprocessingLayer = creator;
			}
		}

		return {
			gltfLoader,
			FakeShadow: FakeShadowModule.FakeShadow || null,
			createPostprocessingLayer,
			passFactories,
		};
	},

	/**
	 * Instantiate the passes add-ons registered through PC.3d.postprocessingPasses.
	 *
	 * Factories may be async, and are given three's pass classes in the context
	 * so a plain enqueued script can build a pass without bundling anything.
	 *
	 * @param {function[]} factories
	 * @param {Object} t - the _three bag
	 * @param {Object} s - settings_3d
	 * @returns {Promise<Object[]>} Pass instances
	 */
	async _buildCustomPasses( factories, t, s ) {
		if ( ! Array.isArray( factories ) || ! factories.length ) return [];

		let toolkit = null;
		try {
			const module = await import(
				/* webpackChunkName: "fe-3d-pass-toolkit" */ './3d-pass-toolkit.js'
			);
			toolkit = await module.load_pass_toolkit();
		} catch ( err ) {
			// eslint-disable-next-line no-console
			console.warn( '3D viewer: failed to load the postprocessing pass classes, skipping custom passes', err );
			return [];
		}

		const context = {
			THREE,
			passes: toolkit,
			renderer: t.renderer,
			scene: t.scene,
			camera: t.camera,
			width: t.container.clientWidth,
			height: t.container.clientHeight,
			pixelRatio: getPixelRatio(),
			isMobile: isMobileViewport(),
			settings: getPostprocessingSettings( s ),
			api: this._createRuntimeApi(),
		};

		const built = await Promise.all( factories.map( async ( factory ) => {
			try {
				return await factory( context );
			} catch ( err ) {
				// One add-on's broken factory must not cost the product view.
				// eslint-disable-next-line no-console
				console.warn( '3D viewer: a custom postprocessing pass factory threw and was skipped', err );
				return null;
			}
		} ) );

		// Returning null is the documented way to opt out per product or device.
		return built.filter( Boolean );
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
		return supportsLightShadows( light );
	},

	_applyShadowFlagsToObject( root, enabled ) {
		applyShadowFlagsToObject( root, enabled );
	},

	/** Shadow map resolution: high on desktop, halved on phones where fill rate is scarce. */
	_getShadowMapSize() {
		return isMobileViewport() ? 1024 : 2048;
	},

	/** Model bounds used to fit shadow cameras. Null until the model is mounted. */
	_getShadowBounds() {
		const t = this._three;
		if ( ! t || ! t.model_root ) return null;
		const bounds = new THREE.Box3().setFromObject( t.model_root );
		return bounds.isEmpty() ? null : bounds;
	},

	_applyShadowSettingsToLight( light, item ) {
		if ( !light ) return;
		// The light keeps its own choice so shadows can be re-applied later
		// without walking back to the objects3d model.
		light.userData.cast_shadows = !!( item && item.cast_shadows === true );
		applyShadowSettingsToLight( light, {
			enabled: this._shadowsEnabled,
			castShadows: light.userData.cast_shadows,
			bounds: this._getShadowBounds(),
			mapSize: this._getShadowMapSize(),
		} );
	},

	/**
	 * Re-apply shadow state to the live scene. Called after the model is framed so
	 * the shadow cameras can be fitted to real bounds, and whenever settings change.
	 */
	_refreshShadows() {
		const t = this._three;
		if ( ! t || ! t.renderer || ! t.scene ) return;
		refreshSceneShadows( {
			renderer: t.renderer,
			scene: t.scene,
			modelRoot: t.model_root,
			enabled: this._shadowsEnabled,
			mapSize: this._getShadowMapSize(),
		} );
		this._requestRender();
	},

	/**
	 * Phase 3: Load assets (eager GLTFs from objects3d, HDR).
	 * @param {Object} s - settings_3d
	 * @param {Object} modules - from _loadModules
	 * @returns {Promise<{ eagerObjectIds: string[], hdrTexture: *, hdrUrl: string|string[]|null }>}
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

		let hdrTexture = null;
		if ( hdrUrl ) {
			hdrTexture = await new Promise( ( resolve ) => {
				loadEnvMap( hdrUrl, ( texture ) => resolve( texture ), undefined, () => resolve( null ) );
			} );
		}

		return { eagerObjectIds, hdrTexture, hdrUrl };
	},

	/**
	 * Phase 4: Init scene, add models, FakeShadow, postprocessing, frame camera, apply settings, start loop.
	 * @param {HTMLElement} container
	 * @param {Object} s - settings_3d
	 * @param {Object} modules - from _loadModules
	 * @param {Object} assets - from _loadAssets
	 */
	async _setupScene( container, s, modules, assets ) {
		const { eagerObjectIds, hdrTexture, hdrUrl } = assets;
		// Start from a clean viewer state before creating a fresh scene graph.
		this.maybe_cleanup();
		this._gltfLoader = modules.gltfLoader;
		// Create core Three.js objects (scene, camera, renderer, controls, etc.).
		this._three = initScene( container, s );
		const t = this._three;
		this._container = container;
		this._bindContextLossHandlers( t.renderer.domElement );

		// Resizing the renderer reallocates — and so clears — the drawing buffer.
		// Rendering is on demand, so without this the canvas stays empty until
		// something else happens to request a frame (a choice change, an orbit).
		// Registered here rather than alongside the postprocessing layer, which is
		// the only other resize listener and is not always present.
		t.resize_listeners.push( () => this._requestRender() );
		const layers = window.PC.fe && window.PC.fe.layers;
		// Enable or disable shadows globally, then mirror the setting to the renderer.
		this._shadowsEnabled = !!( s && s.enable_shadows );
		applyRendererShadowSettings( t.renderer, this._shadowsEnabled );

		// Every model — eager or lazy — is mounted under this root by
		// _ensureObjects3dSceneLoadedById. There is no separate "main" glTF.
		const modelRoot = new THREE.Group();
		t.scene.add( modelRoot );
		t.model_root = modelRoot;

		const productData = window.PC.fe && window.PC.fe.currentProductData;
		const objects3d = productData && productData['objects3d'];
		// Build runtime stores used by both eager and lazy-loaded 3D assets.
		this._initSceneModelsStore( objects3d );
		this._layer_scenes = [];
		// Resolve the hidden-object list before any model is mounted, so eager and
		// lazy loads are both hidden through the same path in the load callback.
		const defaultHidden = ( productData && productData.default_hidden_object_names ) || null;
		this._hiddenObjectNames = getHiddenObjectNamesList( defaultHidden, ( s && s.hidden_object_names ) || '' );
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
		// Apply cshow visibility rules once, then subscribe so later layer changes keep scene in sync.
		this._apply_layer_cshow_visibility();
		this._bind_layer_cshow();

		// Catch-all for anything mounted outside the store path; models loaded
		// through _ensureObjects3dSceneLoadedById are already hidden by then.
		hideObjectsByName( t.model_root, this._hiddenObjectNames );

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
				if ( cookie && cookie.url ) applyLightCookie( light, cookie, () => this._requestRender() );
			} );
		}

		// Assign environment lighting/reflections (HDR) when available. Routed
		// through setSceneEnvironment so the previous texture is always released.
		if ( hdrTexture ) {
			setSceneEnvironment( t.scene, hdrTexture );
			t.current_env_url = Array.isArray( hdrUrl ) ? hdrUrl.join( '|' ) : hdrUrl;
		}

		// Optional fake shadow pass for products without fully baked real-time shadows.
		if ( modules.FakeShadow ) {
			t.fake_shadow = new modules.FakeShadow( t.scene );
		}

		// Orbiting drops the composer's resolution rather than bypassing the effect
		// chain. Bypassing made ambient occlusion, bloom and the colour grade all
		// switch off the moment the customer touched the model and back on when they
		// let go, which reads as a rendering glitch; a softer image for the duration
		// of a drag does not.
		t.controls.addEventListener( 'start', () => this._setOrbiting( true ) );
		t.controls.addEventListener( 'end', () => this._setOrbiting( false ) );
		// Every control change moves the camera, so the scene needs a frame.
		t.controls.addEventListener( 'change', () => this._requestRender() );

		// Create postprocessing pipeline and keep it in sync with container resize events.
		const passFactories = modules.passFactories || [];
		if ( modules.createPostprocessingLayer || passFactories.length ) {
			const extraPasses = await this._buildCustomPasses( passFactories, t, s );
			let layer = null;
			if ( modules.createPostprocessingLayer ) {
				layer = await modules.createPostprocessingLayer( t.renderer, t.scene, t.camera, {
					width: t.container.clientWidth,
					height: t.container.clientHeight,
					settings: getPostprocessingSettings( s ),
					isMobile: isMobileViewport(),
					pixelRatio: getPixelRatio(),
					// Ambient occlusion is scaled from the model bounds, not the whole scene.
					boundsObject: () => t.model_root,
					extraPasses,
				} );
			}
			if ( ! layer && extraPasses.length ) {
				// No add-on chain claimed the passes — either no add-on is present,
				// or it declined because none of its own effects are enabled here.
				// Run them in a composer of our own rather than dropping them.
				const { create_custom_passes_layer } = await import(
					/* webpackChunkName: "fe-3d-custom-passes" */ './3d-custom-passes-layer.js'
				);
				layer = await create_custom_passes_layer( t.renderer, t.scene, t.camera, {
					passes: extraPasses,
					width: t.container.clientWidth,
					height: t.container.clientHeight,
					pixelRatio: getPixelRatio(),
				} );
			} else if ( layer && extraPasses.length && layer.extraPassesApplied !== true ) {
				// An add-on chain is running but is too old to know about custom
				// passes. A second composer on the same renderer would fight it, so
				// say plainly that the passes were dropped instead of failing silently.
				// eslint-disable-next-line no-console
				console.warn(
					'3D viewer: ' + extraPasses.length + ' custom postprocessing pass(es) were dropped. ' +
					'The active postprocessing add-on does not support PC.3d.postprocessingPasses — update it.'
				);
				disposeUnusedPasses( extraPasses );
			}
			// The composer could not be built at all — a failed chunk, or a layer
			// that declined. Either way the passes are going nowhere.
			if ( ! layer && extraPasses.length ) disposeUnusedPasses( extraPasses );
			if ( layer && t.container && t.resize_listeners ) {
				t.postprocessingLayer = layer;
				t.resize_listeners.push( ( width, height, ratio ) => {
					layer.setSize( width, height );
					layer.setPixelRatio( t._orbiting ? ratio * ORBIT_PIXEL_RATIO_SCALE : ratio );
				} );
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

		// Now that the model is mounted, fit each shadow camera to its real bounds.
		// Lights are built before this point, when the bounds are not yet known.
		this._refreshShadows();

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
		t._ground_settings = g;
		t._orbiting = false;
		// From here on, visibility changes are user-driven and may reframe.
		this._sceneReady = true;
		this._startRenderLoop();
	},

	/**
	 * Enter or leave the "customer is dragging" state.
	 * @param {boolean} orbiting
	 */
	_setOrbiting( orbiting ) {
		const t = this._three;
		if ( ! t || t._orbiting === orbiting ) return;
		t._orbiting = orbiting;
		if ( ! t.postprocessingLayer ) return;
		const ratio = getPixelRatio();
		t.postprocessingLayer.setPixelRatio( orbiting ? ratio * ORBIT_PIXEL_RATIO_SCALE : ratio );
		this._requestRender();
	},

	/**
	 * One tick of the render loop.
	 *
	 * The loop itself runs continuously so add-ons keep receiving `frame` events
	 * (animation mixers depend on the delta), but the GPU work — which is nearly
	 * all of the cost — only happens when something has changed. Anything that
	 * mutates the scene calls _requestRender; add-ons use api.requestRender().
	 *
	 * @param {number} now - DOMHighResTimeStamp
	 */
	_onRenderFrame( now ) {
		const t = this._three;
		if ( ! t ) return;
		const g = t._ground_settings || {};
		if ( t._lastFrameTs == null ) t._lastFrameTs = now;
		const deltaSeconds = Math.max( 0, ( now - t._lastFrameTs ) / 1000 );
		t._lastFrameTs = now;

		// A large gap means the loop was parked while the document was hidden. The
		// browser may have discarded the drawing buffer, so redraw unconditionally.
		if ( deltaSeconds > 1 ) this._requestRender();

		this._emitRuntimeAction( 'PC.fe.viewer.frame', [ this, deltaSeconds, this._runtimeApi ] );
		this._emitRuntimeEvent( 'frame', { deltaSeconds } );

		// Damping keeps returning true until the camera settles, so this covers the
		// tail of every drag and flick without any explicit bookkeeping.
		if ( t.controls && t.controls.update() ) this._requestRender();

		// Some effects (animated film grain) change the image every frame on their
		// own, with no scene change to key off.
		if ( t.postprocessingLayer
			&& typeof t.postprocessingLayer.isAnimated === 'function'
			&& t.postprocessingLayer.isAnimated() ) {
			this._requestRender();
		}

		if ( ! t._render_frames ) return;
		t._render_frames--;

		if ( t.fake_shadow && g.enabled !== false ) {
			t.fake_shadow.render( t.renderer, t.scene );
		}
		if ( t.postprocessingLayer ) {
			t.postprocessingLayer.render();
		} else {
			t.renderer.render( t.scene, t.camera );
		}
	},

	_startRenderLoop() {
		const t = this._three;
		if ( ! t ) return;
		this._requestRender();
		start_animation_loop( t, ( now ) => this._onRenderFrame( now ) );
	},

	_pauseRenderLoop() {
		const t = this._three;
		if ( t && typeof t.stop_animation_loop === 'function' ) {
			t.stop_animation_loop();
		}
	},

	_resumeRenderLoop() {
		const t = this._three;
		if ( ! t ) return;
		if ( typeof t.stop_animation_loop === 'function' ) {
			t.stop_animation_loop();
		}
		t._lastFrameTs = null;
		this._startRenderLoop();
	},

	_getGltfLoader() {
		if ( this._gltfLoader ) return Promise.resolve( this._gltfLoader );
		return import( './3d-loader-factory.js' ).then( ( m ) => m.getSharedGltfLoader() ).then( ( loader ) => {
			this._gltfLoader = loader;
			return loader;
		} );
	},

	_loadGltf( url, onSuccess, onError ) {
		if ( ! url ) return;
		this._getGltfLoader().then( ( loader ) => {
			loader.load(
				url,
				onSuccess,
				( event ) => this._onGltfProgress( event ),
				( err ) => {
					warn_gltf_load_error( err, url );
					if ( typeof onError === 'function' ) onError( err );
				}
			);
		} ).catch( ( err ) => {
			warn_gltf_load_error( err, url );
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
					// Objects named in the product's hidden list must be hidden here,
					// not only in _setupScene: a lazily loaded model is mounted long
					// after that ran, and its bounding-box helper would otherwise show
					// up and inflate the shadow and ground plane fitted to it.
					hideObjectsByName( sceneToAdd, this._hiddenObjectNames );
					this._applyShadowFlagsToObject( sceneToAdd, this._shadowsEnabled );
					if ( ! sceneToAdd.parent ) t.model_root.add( sceneToAdd );
					// Bounds just grew, so the shadow cameras need refitting.
					if ( this._shadowsEnabled ) this._refreshShadows();
					registerSceneMaterials( t, sceneToAdd );
					this._objectIdToScene[ idStr ] = sceneToAdd;
					this._syncLayerSceneForObjectId( idStr, sceneToAdd );
					this._apply_layer_cshow_visibility();
					this.invalidate_fake_shadow();
					// AO radius and the SSR reflective-mesh list were sized against
					// whatever was in the scene before this model existed.
					this._refreshPostprocessingSceneScale();
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
		const oid = this._resolveObject3dIdForCompositeId( compositeId );
		if ( ! oid ) return Promise.resolve( null );
		return this._ensureObjects3dSceneLoadedById( oid );
	},

	/**
	 * Resolve the objects3d entry a composite id "sourceId:objectName" points at.
	 * sourceId can match objects3d _id/id or gltf.attachment_id.
	 *
	 * Callers use this to ask whether the model behind a target has already been
	 * loaded, so they can stop retrying a target name that will never resolve.
	 *
	 * @param {string} compositeId
	 * @returns {string} objects3d id, or '' when the composite names no known source
	 */
	_resolveObject3dIdForCompositeId( compositeId ) {
		if ( ! compositeId ) return '';
		const id = String( compositeId ).trim();
		const sepIdx = id.indexOf( ':' );
		if ( sepIdx === -1 ) return '';
		const sourceId = id.slice( 0, sepIdx );
		if ( ! sourceId ) return '';

		const byId = this._objects3dById ? this._objects3dById.get( sourceId ) : null;
		const byAtt = this._objects3dByAttachmentId ? this._objects3dByAttachmentId.get( sourceId ) : null;
		const obj = byId || byAtt;
		if ( ! obj ) return '';
		return String( obj._id != null ? obj._id : obj.id || '' );
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
		this._requestRender();
	},

	/**
	 * Resolve target_object_id (plain name/uuid or composite "sourceId:objectName") to a scene object.
	 * Uses findObjectByCompositeId so multiple loaded models are disambiguated by attachment_id/object_id.
	 */
	_findObjectById( id ) {
		const t = this._three;
		if ( ! t || ! t.model_root || id == null || String( id ).trim() === '' ) return null;
		const s = String( id ).trim();
		const byComposite = findObjectByCompositeId( t.model_root, s );
		if ( byComposite ) return byComposite;
		return findObject( t.model_root, s );
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
		this.invalidate_fake_shadow();
		// Keep active-angle framing in sync with current visibility state.
		this._requestAngleReframe();
		this._refreshPostprocessingSceneScale();
	},

	/**
	 * Mark the planar fake shadow dirty after visibility / geometry changes.
	 */
	invalidate_fake_shadow() {
		const t = this._three;
		if ( t && t.fake_shadow && typeof t.fake_shadow.invalidate === 'function' ) {
			t.fake_shadow.invalidate();
		}
		this._requestRender();
	},

	/**
	 * Re-measure the scene for the postprocessing passes whose parameters are in
	 * world units — the ambient occlusion radius and SSR's ray march distance and
	 * reflective-mesh list. Coalesced onto a frame because it walks the model, and
	 * the events that invalidate it (lazy loads, visibility changes) arrive in bursts.
	 */
	_refreshPostprocessingSceneScale() {
		const t = this._three;
		if ( ! t || ! t.postprocessingLayer || typeof t.postprocessingLayer.refreshSceneScale !== 'function' ) return;
		if ( t._sceneScaleFrame != null ) return;
		t._sceneScaleFrame = requestAnimationFrame( () => {
			t._sceneScaleFrame = null;
			if ( ! this._three || ! t.postprocessingLayer ) return;
			t.postprocessingLayer.refreshSceneScale();
			this._requestRender();
		} );
	},

	_bind_layer_cshow() {
		const layerModels = new Set();
		if ( this._layer_scenes ) this._layer_scenes.forEach( ( { layer_model } ) => layerModels.add( layer_model ) );
		const layers = window.PC.fe && window.PC.fe.layers;
		if ( layers ) {
			layers.each( ( layer_model ) => {
				const targetId = layer_model.get( 'target_object_id' );
				const object3dId = layer_model.get( 'object_3d_id' );
				if ( ! targetId && object3dId ) layerModels.add( layer_model );
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
			// Any camera authored into one of the loaded models. They are mounted
			// under model_root, so the scene graph is the only place to look.
			let otherCam = null;
			scene.traverse( ( obj ) => {
				if ( ! otherCam && obj.isCamera && obj !== baseCamera ) otherCam = obj;
			} );
			if ( otherCam ) {
				cameraForShot = otherCam;
			}
		}

		const renderer = t.renderer;
		const canvas = renderer.domElement;
		let width = options.width != null ? Math.max( 1, Math.floor( options.width ) ) : canvas.width;
		let height = options.height != null ? Math.max( 1, Math.floor( options.height ) ) : canvas.height;
		if ( ! width || ! height ) return null;

		// Capture through the effect chain when one is active, so the image saved to
		// the cart or order matches what the customer was looking at. The composer is
		// bound to the live camera, so other view modes pose that camera and restore
		// it rather than rendering a clone.
		const layer = t.postprocessingLayer;
		const usePostprocessing = !!( layer && typeof layer.capturePixels === 'function' );

		const savedAspect = baseCamera.aspect;
		const savedPosition = usePostprocessing ? baseCamera.position.clone() : null;
		const savedQuaternion = usePostprocessing ? baseCamera.quaternion.clone() : null;
		const savedFov = ( usePostprocessing && baseCamera.isPerspectiveCamera ) ? baseCamera.fov : null;

		// Clear toolbar view-offset for a centered product shot (restored via on_resize below).
		const had_view_offset = !!( baseCamera.view && baseCamera.view.enabled );
		if ( had_view_offset && ( usePostprocessing || cameraForShot === baseCamera ) ) {
			baseCamera.clearViewOffset();
		}

		if ( usePostprocessing && cameraForShot !== baseCamera ) {
			cameraForShot.updateMatrixWorld();
			baseCamera.position.setFromMatrixPosition( cameraForShot.matrixWorld );
			baseCamera.quaternion.setFromRotationMatrix( cameraForShot.matrixWorld );
			if ( cameraForShot.isPerspectiveCamera && baseCamera.isPerspectiveCamera ) {
				baseCamera.fov = cameraForShot.fov;
			}
		}

		const needAspectRestore = usePostprocessing
			|| ( ( width !== canvas.width || height !== canvas.height ) && cameraForShot === baseCamera );
		if ( needAspectRestore ) {
			baseCamera.aspect = width / height;
			baseCamera.updateProjectionMatrix();
		}

		let pixels = usePostprocessing ? layer.capturePixels( width, height ) : null;

		if ( ! pixels ) {
			// Render into an off-screen target so the visible canvas doesn't change.
			// The visible canvas is created with antialias:true; without matching
			// samples here the image saved to the cart is visibly more jagged than
			// what the customer was looking at.
			const maxSamples = ( renderer.capabilities && renderer.capabilities.maxSamples != null )
				? renderer.capabilities.maxSamples
				: 0;
			const renderTarget = new THREE.WebGLRenderTarget( width, height, {
				samples: Math.min( 4, maxSamples ),
			} );
			renderTarget.texture.colorSpace = renderer.outputColorSpace;
			const prevTarget = renderer.getRenderTarget();

			renderer.setRenderTarget( renderTarget );
			renderer.render( scene, usePostprocessing ? baseCamera : cameraForShot );
			renderer.setRenderTarget( prevTarget );

			pixels = new Uint8Array( width * height * 4 );
			renderer.readRenderTargetPixels( renderTarget, 0, 0, width, height, pixels );
			renderTarget.dispose();
		}

		if ( savedPosition ) {
			baseCamera.position.copy( savedPosition );
			baseCamera.quaternion.copy( savedQuaternion );
			if ( savedFov != null ) baseCamera.fov = savedFov;
		}
		if ( needAspectRestore ) {
			baseCamera.aspect = savedAspect;
			baseCamera.updateProjectionMatrix();
		}
		if ( had_view_offset && typeof t.on_resize === 'function' ) {
			t.on_resize();
		}

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
				const main_oid = choice_model.get( 'target_object_id' ) || layer_model.get( 'target_object_id' );
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
				const has_3d = choice_model.get( 'target_object_id' ) || ( Array.isArray( choice_model.get( 'actions_3d' ) ) && choice_model.get( 'actions_3d' ).length ) || choice_model.get( 'object_3d_id' );
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
		if ( this.angles_selector ) {
			this.angles_selector.remove();
			this.angles_selector = null;
		}
		this._layer_scenes = [];
		// Keep shared GLTFLoader module cache; drop the instance ref only.
		this._gltfLoader = null;
		if ( this._scene_models ) this._scene_models.reset();
		this._objectIdToScene = {};
		this._shadowsEnabled = false;
		this._hiddenObjectNames = [];
		this._sceneReady = false;
		if ( this._three && this._three.renderer && this._onContextLost ) {
			const canvas = this._three.renderer.domElement;
			canvas.removeEventListener( 'webglcontextlost', this._onContextLost );
			canvas.removeEventListener( 'webglcontextrestored', this._onContextRestored );
			this._onContextLost = null;
			this._onContextRestored = null;
		}
		if ( this._angleReframeFrame != null ) {
			cancelAnimationFrame( this._angleReframeFrame );
			this._angleReframeFrame = null;
		}
		if ( this._three && this._three._sceneScaleFrame != null ) {
			cancelAnimationFrame( this._three._sceneScaleFrame );
			this._three._sceneScaleFrame = null;
		}
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
