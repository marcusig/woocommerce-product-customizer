/**
 * Frontend 3D scene lifecycle: init scene/camera/renderer/controls and dispose.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { getToneMapping, getOutputColorSpace, getOrbitLimitsFromEnv, getPixelRatio } from './3d-scene-config.js';
import { disposeScene as disposeSceneUtil, setSceneEnvironment } from './3d-scene-utils.js';

/**
 * Parse a CSS length (px, %, or unitless) against an axis size in pixels.
 * @param {string} raw
 * @param {number} axis_size
 * @returns {number}
 */
function parse_css_length( raw, axis_size ) {
	const value = String( raw || '' ).trim();
	if ( ! value ) return 0;
	if ( value.endsWith( '%' ) ) {
		const percent = parseFloat( value );
		return Number.isFinite( percent ) ? ( percent / 100 ) * axis_size : 0;
	}
	const number = parseFloat( value );
	return Number.isFinite( number ) ? number : 0;
}

/**
 * Read theme-defined focus insets from CSS custom properties on the viewer.
 * Themes set any of: --mkl_pc_viewer_focus_inset_{left,right,top,bottom} (px or %).
 * @param {HTMLElement} element
 * @param {number} full_width
 * @param {number} full_height
 * @returns {{ left: number, right: number, top: number, bottom: number }}
 */
function read_focus_insets( element, full_width, full_height ) {
	const style = window.getComputedStyle( element );
	return {
		left: parse_css_length( style.getPropertyValue( '--mkl_pc_viewer_focus_inset_left' ), full_width ),
		right: parse_css_length( style.getPropertyValue( '--mkl_pc_viewer_focus_inset_right' ), full_width ),
		top: parse_css_length( style.getPropertyValue( '--mkl_pc_viewer_focus_inset_top' ), full_height ),
		bottom: parse_css_length( style.getPropertyValue( '--mkl_pc_viewer_focus_inset_bottom' ), full_height ),
	};
}

/**
 * Keep the product framed in the non-toolbar region while rendering full-bleed.
 * Uses PerspectiveCamera.setViewOffset; inset direction comes from theme CSS vars
 * (--mkl_pc_viewer_focus_inset_{left,right,top,bottom} = toolbar side).
 *
 * Shift the optical center into the clear area by half the net inset and keep the
 * full view size so FOV / product scale match the non-offset framing.
 *
 * @param {THREE.PerspectiveCamera} camera
 * @param {HTMLElement} container
 * @param {boolean} enabled
 */
export function apply_camera_view_offset( camera, container, enabled ) {
	const full_width = Math.max( 1, container.clientWidth );
	const full_height = Math.max( 1, container.clientHeight );
	camera.aspect = full_width / full_height;

	if ( ! enabled ) {
		camera.clearViewOffset();
		camera.updateProjectionMatrix();
		return;
	}

	const inset_element = ( container.closest && container.closest( '.mkl_pc_viewer' ) ) || container;
	const insets = read_focus_insets( inset_element, full_width, full_height );

	if ( insets.left === 0 && insets.right === 0 && insets.top === 0 && insets.bottom === 0 ) {
		camera.clearViewOffset();
		camera.updateProjectionMatrix();
		return;
	}

	// Canvas center is at W/2; clear-area center is at (left + W - right) / 2.
	// Delta = (right - left) / 2 — shift optical axis into the free region only.
	const offset_x = ( insets.right - insets.left ) / 2;
	const offset_y = ( insets.bottom - insets.top ) / 2;

	camera.setViewOffset(
		full_width,
		full_height,
		offset_x,
		offset_y,
		full_width,
		full_height
	);
	camera.updateProjectionMatrix();
}

/**
 * Create renderer, scene, camera, controls, default light and the _three bag.
 * @param {HTMLElement} container
 * @param {Object} s - settings_3d (renderer, lighting, environment)
 * @returns {Object} _three bag: { scene, camera, renderer, controls, animation_id, on_resize, fake_shadow, model_root, gltf, current_env_url, default_light, container, initial_camera_position, initial_controls_target, material_registry, textureLoader, extend_under_toolbar }
 */
export function initScene( container, s ) {
	const r = s.renderer || {};
	const extend_under_toolbar = !!( s && s.extend_under_toolbar );
	const renderer = new THREE.WebGLRenderer( {
		antialias: true,
		alpha: !!r.alpha,
		powerPreference: 'high-performance',
	} );
	renderer.shadowMap.enabled = false;
	renderer.setSize( container.clientWidth, container.clientHeight );
	renderer.setPixelRatio( getPixelRatio() );
	renderer.toneMapping = getToneMapping( r );
	renderer.toneMappingExposure = typeof r.exposure === 'number' ? r.exposure : 1;
	renderer.outputColorSpace = getOutputColorSpace( r );
	renderer.setClearAlpha( r.alpha ? 0 : 1 );
	container.appendChild( renderer.domElement );

	const scene = new THREE.Scene();
	const camera = new THREE.PerspectiveCamera( 45, container.clientWidth / container.clientHeight, 0.1, 1000 );
	camera.position.set( 0, 1, 3 );

	const controls = new OrbitControls( camera, renderer.domElement );
	const limits = getOrbitLimitsFromEnv( s.environment || {} );
	controls.minPolarAngle = limits.minPolarAngle;
	controls.maxPolarAngle = limits.maxPolarAngle;
	controls.minAzimuthAngle = limits.minAzimuthAngle;
	controls.maxAzimuthAngle = limits.maxAzimuthAngle;
	controls.minDistance = limits.minDistance;
	controls.maxDistance = limits.maxDistance;
	controls.enablePan = false;
	controls.enableDamping = true;
	controls.dampingFactor = 0.1;

	// Anything that has to be resized alongside the renderer (the postprocessing
	// composer, for one) registers here rather than replacing the window listener.
	const resize_listeners = [];

	const onResize = () => {
		apply_camera_view_offset( camera, container, extend_under_toolbar );
		const width = container.clientWidth;
		const height = container.clientHeight;
		const ratio = getPixelRatio();
		renderer.setSize( width, height );
		renderer.setPixelRatio( ratio );
		for ( let i = 0; i < resize_listeners.length; i++ ) {
			resize_listeners[ i ]( width, height, ratio );
		}
	};

	// Resizing reallocates the renderer's buffers and every composer target, so
	// coalesce the burst of events a window drag produces into one per frame.
	// onResize itself stays synchronous — screenshot capture relies on being able
	// to restore the camera view offset immediately.
	let resize_frame = null;
	const onWindowResize = () => {
		if ( resize_frame != null ) return;
		resize_frame = requestAnimationFrame( () => {
			resize_frame = null;
			onResize();
		} );
	};
	window.addEventListener( 'resize', onWindowResize );
	onResize();

	return {
		scene,
		camera,
		renderer,
		controls,
		animation_id: null,
		on_resize: onResize,
		on_window_resize: onWindowResize,
		resize_listeners,
		fake_shadow: null,
		model_root: null,
		current_env_url: null,
		container,
		initial_camera_position: null,
		initial_controls_target: null,
		material_registry: new Map(),
		textureLoader: new THREE.TextureLoader(),
		extend_under_toolbar,
	};
}

/** Re-export shared disposeScene for callers that import from lifecycle. */
export const disposeScene = disposeSceneUtil;

/**
 * Full cleanup of the _three bag: fake_shadow, animation frame, resize listener, renderer, controls, scene dispose.
 * @param {Object} t - this._three
 */
export function cleanupThree( t ) {
	if ( ! t ) return;
	if ( typeof t.stop_animation_loop === 'function' ) {
		t.stop_animation_loop();
	}
	if ( t.fake_shadow ) {
		t.fake_shadow.dispose();
		t.fake_shadow = null;
	}
	if ( t.animation_id ) {
		cancelAnimationFrame( t.animation_id );
		t.animation_id = null;
	}
	if ( t.on_window_resize ) {
		window.removeEventListener( 'resize', t.on_window_resize );
		t.on_window_resize = null;
	}
	t.on_resize = null;
	if ( t.resize_listeners ) t.resize_listeners.length = 0;
	if ( t.postprocessingLayer && t.postprocessingLayer.dispose ) {
		t.postprocessingLayer.dispose();
		t.postprocessingLayer = null;
	}
	if ( t.renderer ) {
		t.renderer.dispose();
		if ( t.renderer.domElement && t.renderer.domElement.parentNode ) {
			t.renderer.domElement.parentNode.removeChild( t.renderer.domElement );
		}
	}
	if ( t.controls ) t.controls.dispose();
	if ( t.scene ) {
		// Release the environment map explicitly first: it is a property rather
		// than a child, so it survived every teardown before this.
		setSceneEnvironment( t.scene, null );
		disposeSceneUtil( t.scene );
	}
	if ( t.material_registry ) t.material_registry.clear();
}
