/**
 * Tests for conditional logic hiding a layer's model.
 *
 * Layers point at a model to pick their objects from it, so several layers
 * often share one — every layer of a single-model product does. Hiding one of
 * them must not hide the model the others are still showing.
 */
import * as THREE from 'three';

jest.mock( '../3d-scene-lifecycle.js', () => ( {
	initScene: jest.fn(),
	cleanupThree: jest.fn(),
	apply_camera_view_offset: jest.fn(),
} ) );
jest.mock( 'three/examples/jsm/utils/SkeletonUtils.js', () => ( { clone: jest.fn() } ) );

let viewerPrototype;

beforeAll( () => {
	// main-viewer reads these when it is evaluated, so it is required, not imported.
	window.Backbone = { View: { extend: ( proto ) => proto }, Events: {}, Collection: class {} };
	window.wp = { template: () => () => '', hooks: { doAction() {}, applyFilters: ( name, value ) => value } };
	viewerPrototype = require( '../main-viewer.js' ).default;
} );

afterAll( () => {
	delete window.Backbone;
	delete window.wp;
} );

function layer( cshow ) {
	const attrs = { cshow };
	return { get: ( key ) => attrs[ key ], set: ( key, value ) => ( attrs[ key ] = value ) };
}

function view_with( layer_scenes ) {
	return Object.assign( Object.create( viewerPrototype ), {
		_layer_scenes: layer_scenes,
		invalidate_fake_shadow() {},
		_requestAngleReframe() {},
		_refreshPostprocessingSceneScale() {},
	} );
}

describe( '_apply_layer_cshow_visibility', () => {
	it( 'keeps a shared model shown while any layer using it is shown', () => {
		const watch = new THREE.Group();
		// The hidden layer last: applied one by one, it would have the final word.
		const view = view_with( [
			{ layer_model: layer( true ), scene: watch },
			{ layer_model: layer( true ), scene: watch },
			{ layer_model: layer( false ), scene: watch },
		] );
		view._apply_layer_cshow_visibility();
		expect( watch.visible ).toBe( true );
	} );

	it( 'hides a shared model once every layer using it is hidden', () => {
		const watch = new THREE.Group();
		const view = view_with( [
			{ layer_model: layer( false ), scene: watch },
			{ layer_model: layer( false ), scene: watch },
		] );
		view._apply_layer_cshow_visibility();
		expect( watch.visible ).toBe( false );
	} );

	it( 'hides a layer\'s own model with the layer', () => {
		const watch = new THREE.Group();
		const strap = new THREE.Group();
		const view = view_with( [
			{ layer_model: layer( true ), scene: watch },
			{ layer_model: layer( false ), scene: strap },
		] );
		view._apply_layer_cshow_visibility();
		expect( watch.visible ).toBe( true );
		expect( strap.visible ).toBe( false );
	} );
} );
