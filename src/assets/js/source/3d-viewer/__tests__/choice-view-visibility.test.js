/**
 * Tests for what a choice's toggle_visibility shows and hides.
 *
 * The shape that broke: a single-model watch whose every layer points at the
 * model to pick its objects ("1:hands_2", "1:Metal_band"). On load the product
 * was invisible until a choice was clicked, because each inactive choice hid
 * the whole model along with its object, and the last choice in the list was
 * an inactive one.
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

const TOGGLE = [ { action_type: 'toggle_visibility' } ];

/**
 * A viewer with model "1" loaded: a "Scene" group holding the named meshes.
 */
function setup( names = [ 'hands_1', 'hands_2' ] ) {
	const scene = new THREE.Group();
	scene.name = 'Scene';
	const objects = {};
	names.forEach( ( name ) => {
		const mesh = new THREE.Mesh();
		mesh.name = name;
		scene.add( mesh );
		objects[ '1:' + name ] = mesh;
	} );
	const parent = {
		_three: { model_root: new THREE.Group(), material_registry: new Map() },
		_objectIdToScene: { 1: scene },
		_findObjectById: ( id ) => objects[ id ] || null,
		_requestRender() {},
		invalidate_fake_shadow() {},
		_requestAngleReframe() {},
	};
	parent._three.model_root.add( scene );

	const layer = ( attrs = {} ) => fakeModel( { cshow: true, object_3d_id: 1, ...attrs } );
	// Built and applied one at a time, in list order, the way the viewer does.
	const choice = ( layer_model, attrs ) => {
		const model = fakeModel( { active: false, cshow: true, actions_3d: TOGGLE, ...attrs } );
		const view = Object.assign( Object.create( ChoiceView ), { model, layer_model, parent_view: parent } );
		view.apply_actions();
		return view;
	};
	return { scene, objects, layer, choice };
}

describe( 'a choice that picks an object in its layer\'s model', () => {
	it( 'hides only that object when inactive, not the model it comes from', () => {
		const { scene, objects, layer, choice } = setup();
		const hands = layer();
		choice( hands, { target_object_id: '1:hands_1', active: true } );
		choice( hands, { target_object_id: '1:hands_2' } );

		expect( scene.visible ).toBe( true );
		expect( objects[ '1:hands_1' ].visible ).toBe( true );
		expect( objects[ '1:hands_2' ].visible ).toBe( false );
	} );

	it( 'leaves the model alone when the picked object is missing', () => {
		const { scene, layer, choice } = setup();
		choice( layer(), { target_object_id: '1:renamed_mesh' } );

		expect( scene.visible ).toBe( true );
	} );
} );

describe( 'a choice with no object picked', () => {
	it( 'shows and hides its model as a whole', () => {
		const { scene, layer, choice } = setup();
		const view = choice( layer(), { active: true } );
		expect( scene.visible ).toBe( true );

		view.model.set( 'active', false );
		view.apply_actions();
		expect( scene.visible ).toBe( false );
	} );
} );

describe( 'the reported product', () => {
	it( 'shows the model on load with every layer pointing at it', () => {
		const { scene, objects, layer, choice } = setup( [ 'Metal_band', 'Leather_band', 'hands_1', 'hands_2' ] );
		const band = layer();
		choice( band, { target_object_id: '1:Metal_band', active: true } );
		choice( band, { target_object_id: '1:Leather_band' } );
		const hands = layer();
		choice( hands, { target_object_id: '1:hands_1', active: true } );
		choice( hands, { target_object_id: '1:hands_2' } );

		expect( scene.visible ).toBe( true );
		const shown = Object.keys( objects ).filter( ( id ) => objects[ id ].visible );
		expect( shown.sort() ).toEqual( [ '1:Metal_band', '1:hands_1' ] );
	} );
} );
