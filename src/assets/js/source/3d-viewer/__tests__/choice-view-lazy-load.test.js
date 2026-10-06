/**
 * Tests for a choice whose model loads lazily and is deselected before it arrives.
 *
 * The customer picks A, whose model is not loaded yet, then B before A's file
 * is in. A's deselect runs straight away, while its model is still missing;
 * when the model lands, A must not apply its actions over B's.
 */
import * as THREE from 'three';

let ChoiceView;

beforeAll( () => {
	window.Backbone = { View: { extend: ( proto ) => proto } };
	window.PC = { fe: {} };
	ChoiceView = require( '../choice-view.js' ).default;
} );

afterAll( () => {
	delete window.Backbone;
	delete window.PC;
} );

function fakeModel( attrs ) {
	return {
		get: ( key ) => attrs[ key ],
		set: ( key, value ) => {
			attrs[ key ] = value;
		},
	};
}

function deferred() {
	let resolve;
	const promise = new Promise( ( r ) => {
		resolve = r;
	} );
	return { promise, resolve };
}

const flush = () => new Promise( ( r ) => setTimeout( r, 0 ) );

function setup( actions ) {
	const paint = new THREE.MeshStandardMaterial( { color: 0xffffff } );
	const load = deferred();
	const objectIdToScene = {};
	const parent = {
		_three: { model_root: new THREE.Group(), material_registry: new Map( [ [ 'Paint', paint ] ] ) },
		_objectIdToScene: objectIdToScene,
		_findObjectById: () => null,
		_ensureObjects3dSceneLoadedById: () => load.promise,
		_requestRender() {},
		invalidate_fake_shadow() {},
		_requestAngleReframe() {},
	};
	const choice = fakeModel( { active: true, cshow: true, object_3d_id: '5', actions_3d: actions } );
	const layer = fakeModel( { cshow: true } );
	const view = Object.assign( Object.create( ChoiceView ), {
		model: choice,
		layer_model: layer,
		parent_view: parent,
	} );
	const arrive = () => {
		const scene = new THREE.Group();
		objectIdToScene[ '5' ] = scene;
		load.resolve( scene );
		return scene;
	};
	return { view, choice, paint, arrive };
}

describe( 'a lazily loaded choice deselected before its model arrives', () => {
	it( 'does not apply its material actions', async () => {
		const { view, choice, paint, arrive } = setup( [
			{ action_type: 'material_color_registry', material_name: 'Paint', material_registry_color: '#ff0000' },
		] );

		view.apply_actions();
		choice.set( 'active', false );
		view.apply_actions();
		arrive();
		await flush();

		expect( paint.color.getHex() ).toBe( 0xffffff );
	} );

	it( 'hides its model once it can reach it', async () => {
		const { view, choice, arrive } = setup( [ { action_type: 'toggle_visibility' } ] );

		view.apply_actions();
		choice.set( 'active', false );
		view.apply_actions();
		const scene = arrive();
		await flush();

		expect( scene.visible ).toBe( false );
	} );

	it( 'still applies its actions when it is still selected', async () => {
		const { view, paint, arrive } = setup( [
			{ action_type: 'material_color_registry', material_name: 'Paint', material_registry_color: '#ff0000' },
		] );

		view.apply_actions();
		arrive();
		await flush();

		expect( paint.color.getHex() ).toBe( 0xff0000 );
	} );
} );
