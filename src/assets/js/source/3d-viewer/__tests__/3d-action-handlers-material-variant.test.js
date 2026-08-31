/**
 * Tests for material_variant scoping.
 *
 * Two things must both hold:
 *
 * 1. A choice scoped to one specific object (target_object_id set) must not
 *    touch a sibling part's already-selected variant, even though the
 *    selectVariant function itself is only ever found on the shared scene
 *    root that declared the KHR_materials_variants extension.
 *
 * 2. A choice scoped to the whole model (no target_object_id — e.g. a car
 *    body plus a left and right door with no authored common parent) must
 *    still be able to recolor all of them from a single choice, by picking
 *    up every mesh whose own variants table happens to define that name —
 *    while leaving any mesh whose table does not define it exactly as it
 *    was, not reset to its default material.
 */
import { apply_choice_actions, restore_choice_actions } from '../3d-action-handlers.js';

/**
 * Minimal stand-in for the three.js GLTFMaterialsVariantsExtension runtime.
 * Mirrors switchMaterial's rule: a variant name absent from a mesh's own
 * table (or a null variantName) puts that mesh back on its original
 * material; doTraverse=false, as the handler always uses, touches only the
 * node it is called with.
 */
function make_select_variant() {
	return ( object, variantName, doTraverse = true ) => {
		const switch_one = ( node ) => {
			if ( ! node.userData || ! node.userData.variantMaterials ) return;
			const table = node.userData.variantMaterials;
			node.material = ( variantName !== null && table[ variantName ] )
				? table[ variantName ]
				: node.userData.originalMaterial;
		};
		if ( doTraverse ) {
			node_traverse( object, switch_one );
		} else {
			switch_one( object );
		}
		return Promise.resolve();
	};
}

function node_traverse( node, callback ) {
	callback( node );
	( node.children || [] ).forEach( ( child ) => node_traverse( child, callback ) );
}

function make_node( name, variantMaterials ) {
	const node = { name, isMesh: !! variantMaterials, children: [], userData: {} };
	node.traverse = ( callback ) => node_traverse( node, callback );
	if ( variantMaterials ) {
		node.userData.originalMaterial = { name: name + ':original' };
		node.userData.variantMaterials = variantMaterials;
		node.material = node.userData.originalMaterial;
	}
	return node;
}

function add_child( parent, child ) {
	parent.children.push( child );
	child.parent = parent;
}

function make_scene_root() {
	const root = { userData: { gltf_functions: { selectVariant: make_select_variant() } }, children: [] };
	root.traverse = ( callback ) => node_traverse( root, callback );
	return root;
}

describe( 'material_variant scoping to a single object', () => {
	it( 'does not reset a sibling part whose variant table lacks the selected name', () => {
		const red = { name: 'Red' };
		const wood = { name: 'Wood' };
		const scene_root = make_scene_root();
		const body = make_node( 'Body', { Red: red } );
		const handle = make_node( 'Handle', { Wood: wood } );
		add_child( scene_root, body );
		add_child( scene_root, handle );

		// Handle already has its own variant selected, as if a prior choice set it.
		handle.material = wood;

		const ctx = { target_object: body, target_scene: scene_root, notify: jest.fn() };
		apply_choice_actions( ctx, [ {
			action_type: 'material_variant',
			material_variant_value: 'Red',
		} ] );

		expect( body.material ).toBe( red );
		expect( handle.material ).toBe( wood );
	} );

	it( 'restores the original material when the choice is deselected', () => {
		const red = { name: 'Red' };
		const scene_root = make_scene_root();
		const body = make_node( 'Body', { Red: red } );
		add_child( scene_root, body );

		const ctx = { target_object: body, target_scene: scene_root, notify: jest.fn() };
		const action = { action_type: 'material_variant', material_variant_value: 'Red' };

		apply_choice_actions( ctx, [ action ] );
		expect( body.material ).toBe( red );

		restore_choice_actions( ctx, [ action ] );
		expect( body.material ).toBe( body.userData.originalMaterial );
	} );
} );

describe( 'material_variant scoped to the whole model (no shared parent)', () => {
	function build_car() {
		const root = make_scene_root();
		const body = make_node( 'Body', { Red: { name: 'Body:Red' }, Blue: { name: 'Body:Blue' } } );
		const left_door = make_node( 'LeftDoor', { Red: { name: 'LeftDoor:Red' }, Blue: { name: 'LeftDoor:Blue' } } );
		const right_door = make_node( 'RightDoor', { Red: { name: 'RightDoor:Red' }, Blue: { name: 'RightDoor:Blue' } } );
		// Trim has its own, unrelated variant set and no "Red"/"Blue" entries.
		const trim = make_node( 'Trim', { Chrome: { name: 'Trim:Chrome' }, Black: { name: 'Trim:Black' } } );
		[ body, left_door, right_door, trim ].forEach( ( n ) => add_child( root, n ) );
		return { root, body, left_door, right_door, trim };
	}

	it( 'recolors every mesh that declares the variant, and leaves the rest untouched', () => {
		const { root, body, left_door, right_door, trim } = build_car();

		// Trim already has its own variant selected (as a separate choice would do).
		root.userData.gltf_functions.selectVariant( trim, 'Chrome', false, null );
		expect( trim.material ).toBe( trim.userData.variantMaterials.Chrome );

		const ctx = { target_object: root, target_scene: root, notify: jest.fn() };
		apply_choice_actions( ctx, [ {
			action_type: 'material_variant',
			material_variant_value: 'Red',
		} ] );

		expect( body.material ).toBe( body.userData.variantMaterials.Red );
		expect( left_door.material ).toBe( left_door.userData.variantMaterials.Red );
		expect( right_door.material ).toBe( right_door.userData.variantMaterials.Red );
		// Not reset to Trim's default — the "Red" choice never touches it.
		expect( trim.material ).toBe( trim.userData.variantMaterials.Chrome );

		const applied = ctx.notify.mock.calls[ 0 ][ 0 ];
		expect( applied.meshes ).toEqual( [ body, left_door, right_door ] );
	} );

	it( 'restore only puts back the meshes it actually changed', () => {
		const { root, body, left_door, right_door, trim } = build_car();
		root.userData.gltf_functions.selectVariant( trim, 'Chrome', false, null );

		const ctx = { target_object: root, target_scene: root, notify: jest.fn() };
		const action = { action_type: 'material_variant', material_variant_value: 'Red' };

		apply_choice_actions( ctx, [ action ] );
		restore_choice_actions( ctx, [ action ] );

		expect( body.material ).toBe( body.userData.originalMaterial );
		expect( left_door.material ).toBe( left_door.userData.originalMaterial );
		expect( right_door.material ).toBe( right_door.userData.originalMaterial );
		expect( trim.material ).toBe( trim.userData.variantMaterials.Chrome );
	} );
} );
