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

describe( 'layers without choices that display an object', () => {
	function display_layer( target, cshow ) {
		const attrs = { not_a_choice: '1', object_3d_id: 1, target_object_id: target, cshow };
		return { get: ( key ) => attrs[ key ], set: ( key, value ) => ( attrs[ key ] = value ) };
	}

	function bike() {
		const root = new THREE.Group();
		const bike_model = new THREE.Group();
		bike_model.userData.object_id = '1';
		const hooks = new THREE.Group();
		hooks.name = 'front_basket_hooks';
		const support = new THREE.Group();
		support.name = 'support';
		bike_model.add( hooks, support );
		root.add( bike_model );
		return { root, bike_model, hooks, support };
	}

	afterEach( () => {
		delete window.PC;
	} );

	it( "show and hide their object with the layer, and leave the rest of the model alone", () => {
		const { root, bike_model, hooks, support } = bike();
		const front = display_layer( '1:front_basket_hooks', false );
		window.PC = { fe: { layers: [ front ] } };
		const view = Object.assign( view_with( [ { layer_model: front, scene: bike_model } ] ), { _three: { model_root: root } } );
		// Another layer keeps the bike itself shown.
		view._layer_scenes.push( { layer_model: layer( true ), scene: bike_model } );

		view._apply_layer_cshow_visibility();
		expect( hooks.visible ).toBe( false );
		expect( support.visible ).toBe( true );
		expect( bike_model.visible ).toBe( true );

		front.set( 'cshow', true );
		view._apply_layer_cshow_visibility();
		expect( hooks.visible ).toBe( true );
	} );

	it( 'keep a shared object shown while any of their layers is shown', () => {
		const { root, support } = bike();
		window.PC = { fe: { layers: [ display_layer( '1:support', false ), display_layer( '1:support', true ) ] } };
		const view = Object.assign( view_with( [] ), { _three: { model_root: root } } );
		view._apply_layer_cshow_visibility();
		expect( support.visible ).toBe( true );
	} );

	it( 'load a lazy model when the layer is shown and its object is not in the scene yet', () => {
		const root = new THREE.Group();
		window.PC = { fe: { layers: [ display_layer( '2:crate_straps', true ), display_layer( '3:other', false ) ] } };
		const loads = [];
		const view = Object.assign( view_with( [] ), {
			_three: { model_root: root },
			_objects3dById: new Map( [ [ '2', { _id: 2 } ], [ '3', { _id: 3 } ] ] ),
			_objects3dByAttachmentId: new Map(),
			_scene_models: { get: () => ( { get: () => 'unloaded' } ) },
			_ensureObjects3dSceneLoadedById: ( oid ) => loads.push( oid ),
		} );
		view._apply_layer_cshow_visibility();
		// Only the shown layer's model; a hidden layer has nothing to show yet.
		expect( loads ).toEqual( [ '2' ] );
	} );
} );
