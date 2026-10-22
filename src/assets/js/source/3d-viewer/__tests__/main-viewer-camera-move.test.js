/**
 * Tests for a viewer camera move meeting the customer's hand.
 *
 * A choice change reframes the camera over 850 ms. A customer who grabs the
 * model during that time must get the camera: the move used to keep writing
 * the planned pose every frame, dragging their orbit back until it ran out.
 */
import * as THREE from 'three';

jest.mock( '../3d-scene-lifecycle.js', () => ( {
	initScene: jest.fn(),
	cleanupThree: jest.fn(),
	apply_camera_view_offset: jest.fn(),
} ) );
jest.mock( '../3d-scene-config.js', () => ( {
	...jest.requireActual( '../3d-scene-config.js' ),
	prefersReducedMotion: () => false,
} ) );
jest.mock( 'three/examples/jsm/utils/SkeletonUtils.js', () => ( { clone: jest.fn() } ) );

let viewerPrototype;
let frames;
let now;

beforeAll( () => {
	window.Backbone = { View: { extend: ( proto ) => proto }, Events: {}, Collection: class {} };
	window.wp = { template: () => () => '', hooks: { doAction: jest.fn(), applyFilters: ( name, value ) => value } };
	viewerPrototype = require( '../main-viewer.js' ).default;
} );

afterAll( () => {
	delete window.Backbone;
	delete window.wp;
} );

beforeEach( () => {
	frames = [];
	now = 0;
	jest.spyOn( window, 'requestAnimationFrame' ).mockImplementation( ( cb ) => frames.push( cb ) );
	jest.spyOn( window, 'cancelAnimationFrame' ).mockImplementation( () => {} );
	jest.spyOn( performance, 'now' ).mockImplementation( () => now );
} );

afterEach( () => jest.restoreAllMocks() );

/** Run the next queued frame at the given time. */
function frameAt( ms ) {
	now = ms;
	const cb = frames.shift();
	if ( cb ) cb( ms );
}

/** Minimal OrbitControls: an event target with a target point and limits. */
function makeControls() {
	const listeners = {};
	return {
		target: new THREE.Vector3(),
		minAzimuthAngle: -Infinity,
		maxAzimuthAngle: Infinity,
		update: jest.fn(),
		addEventListener( name, fn ) {
			( listeners[ name ] = listeners[ name ] || [] ).push( fn );
		},
		dispatch( name ) {
			( listeners[ name ] || [] ).forEach( ( fn ) => fn() );
		},
	};
}

function makeView() {
	const camera = new THREE.PerspectiveCamera();
	camera.position.set( 0, 0, 10 );
	const controls = makeControls();
	const view = Object.assign( Object.create( viewerPrototype ), {
		_three: { camera, controls, framing_shift: { x: 0, y: 0 } },
		_cameraHeld: false,
		_cameraMove: null,
		_framingTouched: false,
		_requestRender: jest.fn(),
	} );
	view._bindFramingInteraction( controls, null );
	return { view, camera, controls };
}

/** Orbit the camera around the current target by `radians`, as a drag would. */
function orbit( camera, controls, radians ) {
	const offset = camera.position.clone().sub( controls.target );
	offset.applyAxisAngle( new THREE.Vector3( 0, 1, 0 ), radians );
	camera.position.copy( controls.target ).add( offset );
}

const offsetOf = ( camera, controls ) => camera.position.clone().sub( controls.target );

describe( 'camera move handed to the customer', () => {
	it( 'stops driving the orbit once the model is grabbed, but still slides the pivot', () => {
		const { view, camera, controls } = makeView();
		const endTarget = new THREE.Vector3( 1, 0, 0 );
		view._moveCameraTo( new THREE.Vector3( 1, 0, 10 ), endTarget, { duration: 1000 } );
		frameAt( 200 );

		controls.dispatch( 'start' );
		orbit( camera, controls, Math.PI / 2 );
		const held = offsetOf( camera, controls );

		frameAt( 500 );
		expect( offsetOf( camera, controls ).distanceTo( held ) ).toBeLessThan( 1e-9 );

		frameAt( 1000 );
		expect( controls.target.distanceTo( endTarget ) ).toBeLessThan( 1e-9 );
		expect( offsetOf( camera, controls ).distanceTo( held ) ).toBeLessThan( 1e-9 );
		expect( view._cameraMove ).toBeNull();
	} );

	it( 'hands over a move that starts while the model is already held', () => {
		const { view, camera, controls } = makeView();
		controls.dispatch( 'start' );
		orbit( camera, controls, Math.PI / 2 );
		const held = offsetOf( camera, controls );

		// A lazy model finishing its load mid-drag reframes from the old pose.
		view._moveCameraTo( new THREE.Vector3( 0, 0, 10 ), new THREE.Vector3( 0, 1, 0 ), { duration: 850 } );
		frameAt( 400 );
		expect( offsetOf( camera, controls ).distanceTo( held ) ).toBeLessThan( 1e-9 );
	} );

	it( 'still drives the full move when nobody touches the camera', () => {
		const { view, camera, controls } = makeView();
		const endPos = new THREE.Vector3( 10, 0, 0 );
		view._moveCameraTo( endPos, new THREE.Vector3(), { duration: 1000 } );
		frameAt( 500 );
		frameAt( 1000 );
		expect( camera.position.distanceTo( endPos ) ).toBeLessThan( 1e-9 );
	} );

	it( 'does not hand a later move to a customer who has let go', () => {
		const { view, camera, controls } = makeView();
		controls.dispatch( 'start' );
		controls.dispatch( 'end' );
		const endPos = new THREE.Vector3( 10, 0, 0 );
		view._moveCameraTo( endPos, new THREE.Vector3(), { duration: 1000 } );
		frameAt( 1000 );
		expect( camera.position.distanceTo( endPos ) ).toBeLessThan( 1e-9 );
	} );
} );

describe( 'camera move and the zoom-out limit', () => {
	it( 'holds the start distance until a move to a nearer fitted view lands', () => {
		const { view, controls } = makeView();
		// Leaving a view fitted 10 away, past a merchant limit of 4.
		controls.maxDistance = 4;
		view._moveCameraTo( new THREE.Vector3( 0, 0, 3 ), new THREE.Vector3(), { duration: 1000, fittedDistance: 3 } );
		expect( controls.maxDistance ).toBe( 10 );
		frameAt( 500 );
		expect( controls.maxDistance ).toBe( 10 );
		frameAt( 1000 );
		expect( controls.maxDistance ).toBe( 4 );
	} );

	it( 'lets the limit give way to a view fitted further out, and leaves it alone otherwise', () => {
		const { view, controls } = makeView();
		controls.maxDistance = 4;
		view._moveCameraTo( new THREE.Vector3( 0, 0, 6 ), new THREE.Vector3(), { immediate: true, fittedDistance: 6 } );
		expect( controls.maxDistance ).toBe( 6 );
		view._moveCameraTo( new THREE.Vector3( 0, 0, 5 ), new THREE.Vector3(), { immediate: true } );
		expect( controls.maxDistance ).toBe( 6 );
	} );
} );
