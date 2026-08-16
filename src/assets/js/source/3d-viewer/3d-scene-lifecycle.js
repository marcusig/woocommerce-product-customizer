/**
 * Frontend 3D scene lifecycle: init scene/camera/renderer/controls and dispose.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { getToneMapping, getOutputColorSpace, getOrbitLimitsFromEnv, getPixelRatio } from './3d-scene-config.js';
import { disposeScene as disposeSceneUtil, setSceneEnvironment } from './3d-scene-utils.js';
import { setKtx2Renderer } from './3d-loader-factory.js';

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
 * Accessible name for the canvas, translatable through PC_config.lang.
 * @returns {string}
 */
function getViewerLabel() {
	const lang = ( typeof window !== 'undefined' && window.PC_config && window.PC_config.lang ) || {};
	return lang.viewer_3d_label
		|| ( typeof window !== 'undefined' && window.PC_lang && window.PC_lang.viewer_3d_label )
		|| 'Interactive 3D view of the product. Use the arrow keys to rotate.';
}

/** Radians rotated per arrow-key press (about 4 degrees). */
const KEY_ROTATE_STEP = Math.PI / 45;

/**
 * Orbit the camera from the keyboard.
 *
 * OrbitControls' own listenToKeyEvents is no use here: in three r182 a bare
 * arrow key pans and only Ctrl/Meta/Shift + arrow rotates, and this viewer
 * disables panning — so the arrow keys would do nothing at all. Rotating the
 * camera around the controls' target through Spherical uses only public API
 * and honours the configured polar and azimuth limits.
 *
 * Moving the camera and calling update() makes OrbitControls emit its own
 * 'change' event, which is what asks the on-demand renderer for a frame.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {THREE.PerspectiveCamera} camera
 * @param {OrbitControls} controls
 * @returns {function(): void} unbind
 */
function bind_keyboard_orbit( canvas, camera, controls ) {
	const offset = new THREE.Vector3();
	const spherical = new THREE.Spherical();

	const on_key_down = ( event ) => {
		if ( event.altKey || event.ctrlKey || event.metaKey ) return;
		let d_theta = 0;
		let d_phi = 0;
		switch ( event.key ) {
			case 'ArrowLeft': d_theta = -KEY_ROTATE_STEP; break;
			case 'ArrowRight': d_theta = KEY_ROTATE_STEP; break;
			case 'ArrowUp': d_phi = -KEY_ROTATE_STEP; break;
			case 'ArrowDown': d_phi = KEY_ROTATE_STEP; break;
			default: return;
		}
		// Only claim the key once we know we are acting on it, so Tab and the
		// rest of the page's keyboard behaviour are untouched.
		event.preventDefault();

		offset.copy( camera.position ).sub( controls.target );
		spherical.setFromVector3( offset );
		spherical.theta = Math.min(
			controls.maxAzimuthAngle,
			Math.max( controls.minAzimuthAngle, spherical.theta + d_theta )
		);
		spherical.phi = Math.min(
			controls.maxPolarAngle,
			Math.max( controls.minPolarAngle, spherical.phi + d_phi )
		);
		// Degenerate at the poles, where the camera direction is undefined.
		spherical.makeSafe();
		camera.position.copy( controls.target ).add( offset.setFromSpherical( spherical ) );
		controls.update();
	};

	canvas.addEventListener( 'keydown', on_key_down );
	return () => canvas.removeEventListener( 'keydown', on_key_down );
}

/**
 * Error thrown when the browser cannot give us a WebGL context at all.
 * Carries a flag so the viewer can show the product poster rather than a
 * generic "failed to load" message — a blank error converts worse than a
 * still image of the thing being sold.
 */
export class WebGLUnavailableError extends Error {
	constructor( message, cause ) {
		super( message );
		this.name = 'WebGLUnavailableError';
		this.isWebGLUnavailable = true;
		this.cause = cause;
	}
}

/**
 * Build the renderer, preferring a real GPU but accepting a software one.
 *
 * failIfMajorPerformanceCaveat rejects contexts backed by a software
 * rasteriser, where a product model runs at single-digit frames. We ask for
 * that first, and on failure retry without it: a slow viewer still beats no
 * viewer. Only when both attempts fail is WebGL genuinely unavailable.
 *
 * @param {Object} r - settings_3d.renderer
 * @returns {THREE.WebGLRenderer}
 * @throws {WebGLUnavailableError}
 */
function create_renderer( r ) {
	const base = {
		antialias: true,
		alpha: !!r.alpha,
		powerPreference: 'high-performance',
	};
	try {
		return new THREE.WebGLRenderer( Object.assign( {}, base, { failIfMajorPerformanceCaveat: true } ) );
	} catch ( performance_error ) {
		try {
			return new THREE.WebGLRenderer( base );
		} catch ( fatal_error ) {
			throw new WebGLUnavailableError(
				'WebGL is not available in this browser.',
				fatal_error
			);
		}
	}
}

/**
 * Create renderer, scene, camera, controls, default light and the _three bag.
 * @param {HTMLElement} container
 * @param {Object} s - settings_3d (renderer, lighting, environment)
 * @returns {Object} _three bag: { scene, camera, renderer, controls, animation_id, on_resize, on_window_resize, resize_listeners, fake_shadow, model_root, current_env_url, container, initial_camera_position, initial_controls_target, material_registry, textureLoader, extend_under_toolbar }
 */
export function initScene( container, s ) {
	const r = s.renderer || {};
	const extend_under_toolbar = !!( s && s.extend_under_toolbar );
	const renderer = create_renderer( r );
	renderer.shadowMap.enabled = false;
	renderer.setSize( container.clientWidth, container.clientHeight );
	renderer.setPixelRatio( getPixelRatio() );
	renderer.toneMapping = getToneMapping( r );
	renderer.toneMappingExposure = typeof r.exposure === 'number' ? r.exposure : 1;
	renderer.outputColorSpace = getOutputColorSpace( r );
	renderer.setClearAlpha( r.alpha ? 0 : 1 );
	container.appendChild( renderer.domElement );

	// KTX2 transcoding needs to know the GPU's supported formats. The loader is
	// built before this point, so hand it the renderer now — before any model
	// is loaded, which is what matters.
	setKtx2Renderer( renderer );

	const scene = new THREE.Scene();
	const camera = new THREE.PerspectiveCamera( 45, container.clientWidth / container.clientHeight, 0.1, 1000 );
	camera.position.set( 0, 1, 3 );

	// Keyboard and screen-reader access to the model. Without this the canvas is
	// not focusable and orbiting is pointer-only, so the 3D view — and with it
	// the angle presets, which are what most customers actually want — is
	// unreachable without a mouse.
	const canvas = renderer.domElement;
	canvas.setAttribute( 'tabindex', '0' );
	canvas.setAttribute( 'role', 'application' );
	canvas.setAttribute( 'aria-label', getViewerLabel() );

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

	const unbind_keyboard_orbit = bind_keyboard_orbit( canvas, camera, controls );

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
		unbind_keyboard_orbit,
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
	if ( typeof t.unbind_keyboard_orbit === 'function' ) {
		t.unbind_keyboard_orbit();
		t.unbind_keyboard_orbit = null;
	}
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
	if ( t.material_registry_owners ) t.material_registry_owners.clear();
	if ( t.material_registry_warned ) t.material_registry_warned.clear();
}
