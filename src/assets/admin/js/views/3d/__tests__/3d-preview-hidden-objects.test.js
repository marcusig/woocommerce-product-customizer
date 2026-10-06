/**
 * Tests for applying Display > Hidden objects to the admin preview live.
 */
import * as THREE from 'three';
import { getHiddenObjectNamesList } from '../../../../../js/source/3d-viewer/3d-scene-utils.js';
import { settings_3d_preview_mixin } from '../3d-preview-view.js';

function named( name, parent ) {
	const obj = new THREE.Object3D();
	obj.name = name;
	parent.add( obj );
	return obj;
}

function setup( list ) {
	window.PC = { threeD: { getThreeDeps: () => ( { getHiddenObjectNamesList } ) } };
	const root = new THREE.Group();
	const view = Object.assign( Object.create( settings_3d_preview_mixin ), {
		_three: { model_root: root },
		admin: { settings_3d: { hidden_object_names: list } },
		$: () => ( { each() {} } ),
		apply_shadow_settings: jest.fn(),
	} );
	return { root, view };
}

describe( 'apply_preview_hidden_objects', () => {
	test( 'hides what the list names', () => {
		const { root, view } = setup( 'bolt' );
		const bolt = named( 'bolt', root );
		const nut = named( 'nut', root );
		view.apply_preview_hidden_objects( { refresh: false } );
		expect( bolt.visible ).toBe( false );
		expect( nut.visible ).toBe( true );
	} );

	test( 'a name taken off the list shows its object again', () => {
		const { root, view } = setup( 'bolt\nnut' );
		const bolt = named( 'bolt', root );
		const nut = named( 'nut', root );
		view.apply_preview_hidden_objects();
		view.admin.settings_3d.hidden_object_names = 'nut';
		view.apply_preview_hidden_objects();
		expect( bolt.visible ).toBe( true );
		expect( nut.visible ).toBe( false );
	} );

	test( 'an object hidden for another reason stays hidden', () => {
		const { root, view } = setup( 'bolt' );
		// A lazy model, or a box unticked in the scene tree.
		const bolt = named( 'bolt', root );
		bolt.visible = false;
		view.apply_preview_hidden_objects();
		view.admin.settings_3d.hidden_object_names = '';
		view.apply_preview_hidden_objects();
		expect( bolt.visible ).toBe( false );
	} );

	test( 'a hidden object ticked back on in the tree is left as it is', () => {
		const { root, view } = setup( 'bolt' );
		const bolt = named( 'bolt', root );
		view.apply_preview_hidden_objects();
		bolt.visible = true;
		view.admin.settings_3d.hidden_object_names = 'bolt\nnut';
		view.apply_preview_hidden_objects();
		expect( bolt.visible ).toBe( true );
	} );

	test( 'refreshes the shadows only when asked to', () => {
		const { root, view } = setup( 'bolt' );
		named( 'bolt', root );
		view.apply_preview_hidden_objects( { refresh: false } );
		expect( view.apply_shadow_settings ).not.toHaveBeenCalled();
		view.apply_preview_hidden_objects();
		expect( view.apply_shadow_settings ).toHaveBeenCalledTimes( 1 );
	} );
} );
