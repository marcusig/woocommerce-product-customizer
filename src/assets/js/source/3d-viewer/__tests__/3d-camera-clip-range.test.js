/**
 * Tests for fitting the main camera's depth range to the model.
 *
 * The viewer had a fixed 0.1–1000 range, which clipped a model 300 units across
 * (a Fusion 360 export in millimetres) as soon as the camera pulled back. These
 * check the range holds the whole model at any scale and any distance.
 */
import * as THREE from 'three';
import { getClipSphere, fitCameraClipRange } from '../3d-scene-utils.js';

function camera_at( distance, center = new THREE.Vector3() ) {
	const camera = new THREE.PerspectiveCamera( 45, 1.5, 0.1, 1000 );
	camera.position.copy( center ).add( new THREE.Vector3( 1, 0.6, 0.8 ).normalize().multiplyScalar( distance ) );
	camera.lookAt( center );
	return camera;
}

describe( 'fitCameraClipRange', () => {
	const scales = [ 0.02, 1, 300 ];
	const distances = [ 1.2, 3, 20 ];

	scales.forEach( ( radius ) => {
		distances.forEach( ( k ) => {
			it( `keeps a radius ${ radius } model in range from ${ k } radii away`, () => {
				const sphere = new THREE.Sphere( new THREE.Vector3( radius, radius / 2, 0 ), radius );
				const distance = radius * k;
				const camera = camera_at( distance, sphere.center );
				fitCameraClipRange( camera, sphere );
				// The model's nearest and furthest points, and the shadow catcher at its widest.
				expect( camera.near ).toBeLessThan( distance - radius );
				expect( camera.far ).toBeGreaterThan( distance + radius * 15 );
			} );
		} );
	} );

	it( 'scales with the model, so precision is the same in any unit', () => {
		const metres = camera_at( 3 );
		const millimetres = camera_at( 3000 );
		fitCameraClipRange( metres, new THREE.Sphere( new THREE.Vector3(), 1 ) );
		fitCameraClipRange( millimetres, new THREE.Sphere( new THREE.Vector3(), 1000 ) );
		expect( millimetres.near / metres.near ).toBeCloseTo( 1000, 6 );
		expect( millimetres.far / metres.far ).toBeCloseTo( 1000, 6 );
	} );

	it( 'stays positive with the camera on the centre', () => {
		const camera = new THREE.PerspectiveCamera();
		fitCameraClipRange( camera, new THREE.Sphere( new THREE.Vector3(), 2 ) );
		expect( camera.near ).toBeGreaterThan( 0 );
		expect( camera.far ).toBeGreaterThan( camera.near );
	} );

	it( 'updates the projection only when the planes move', () => {
		const camera = camera_at( 900 );
		const sphere = new THREE.Sphere( new THREE.Vector3(), 300 );
		const before = camera.projectionMatrix.clone();
		expect( fitCameraClipRange( camera, sphere ) ).toBe( true );
		expect( camera.projectionMatrix.equals( before ) ).toBe( false );
		expect( fitCameraClipRange( camera, sphere ) ).toBe( false );
	} );

	it( 'keeps the view offset the framing shift rides on', () => {
		const camera = camera_at( 900 );
		camera.setViewOffset( 1500, 1000, 40, -20, 1500, 1000 );
		fitCameraClipRange( camera, new THREE.Sphere( new THREE.Vector3(), 300 ) );
		const expected = camera.clone();
		expected.updateProjectionMatrix();
		expect( camera.view.enabled ).toBe( true );
		expect( camera.projectionMatrix.equals( expected.projectionMatrix ) ).toBe( true );
	} );

	it( 'leaves the camera alone without a model', () => {
		const camera = camera_at( 3 );
		expect( fitCameraClipRange( camera, null ) ).toBe( false );
		expect( [ camera.near, camera.far ] ).toEqual( [ 0.1, 1000 ] );
	} );
} );

describe( 'getClipSphere', () => {
	it( 'is null for an empty root', () => {
		expect( getClipSphere( new THREE.Group() ) ).toBeNull();
		expect( getClipSphere( null ) ).toBeNull();
	} );

	it( 'encloses the model, hidden parts included', () => {
		const root = new THREE.Group();
		root.add( new THREE.Mesh( new THREE.BoxGeometry( 300, 100, 200 ) ) );
		const hidden = new THREE.Mesh( new THREE.BoxGeometry( 10, 10, 10 ) );
		hidden.position.set( 400, 0, 0 );
		hidden.visible = false;
		root.add( hidden );
		const sphere = getClipSphere( root );
		expect( sphere.containsPoint( new THREE.Vector3( 150, 50, 100 ) ) ).toBe( true );
		expect( sphere.containsPoint( new THREE.Vector3( 405, 0, 0 ) ) ).toBe( true );
	} );
} );
