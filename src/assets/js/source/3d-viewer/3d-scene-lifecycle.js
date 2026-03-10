/**
 * Frontend 3D scene lifecycle: init scene/camera/renderer/controls and dispose.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { getToneMapping, getOutputColorSpace, getOrbitLimitsFromEnv } from './3d-scene-config.js';
import { disposeScene as disposeSceneUtil } from './3d-scene-utils.js';

/**
 * Create renderer, scene, camera, controls, default light and the _three bag.
 * @param {HTMLElement} container
 * @param {Object} s - settings_3d (renderer, lighting, environment)
 * @returns {Object} _three bag: { scene, camera, renderer, controls, animation_id, on_resize, fake_shadow, model_root, gltf, current_env_url, default_light, container, initial_camera_position, initial_controls_target, material_registry, textureLoader }
 */
export function initScene( container, s ) {
	const r = s.renderer || {};
	const renderer = new THREE.WebGLRenderer( { antialias: true, alpha: !!r.alpha } );
	renderer.shadowMap.enabled = false;
	renderer.setSize( container.clientWidth, container.clientHeight );
	renderer.setPixelRatio( window.devicePixelRatio );
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

	const onResize = () => {
		camera.aspect = container.clientWidth / container.clientHeight;
		camera.updateProjectionMatrix();
		renderer.setSize( container.clientWidth, container.clientHeight );
		renderer.setPixelRatio( window.devicePixelRatio );
	};
	window.addEventListener( 'resize', onResize );

	return {
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
		container,
		initial_camera_position: null,
		initial_controls_target: null,
		material_registry: new Map(),
		textureLoader: new THREE.TextureLoader(),
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
	if ( t.scene ) disposeSceneUtil( t.scene );
}
