/**
 * Tests for anchor placement.
 *
 * The scene mirrors the cargo-bike case: a frame model with an anchor per
 * frame size, and a separate handlebar model placed on whichever anchor the
 * current choices ask for.
 */
import * as THREE from 'three';
import {
	create_anchor_placement,
	compare_priority,
	read_follow_flag,
	normalize_anchor_ids,
} from '../3d-anchor-placement.js';
import { findObjectByCompositeId, findObjectsByCompositeId } from '../3d-scene-utils.js';

const EPS = 1e-6;

function group( name, userData = {} ) {
	const g = new THREE.Group();
	g.name = name;
	Object.assign( g.userData, userData );
	return g;
}

function mesh( name ) {
	const m = new THREE.Mesh( new THREE.BoxGeometry( 1, 1, 1 ), new THREE.MeshStandardMaterial() );
	m.name = name;
	return m;
}

function world_position( obj ) {
	obj.updateWorldMatrix( true, false );
	return new THREE.Vector3().setFromMatrixPosition( obj.matrixWorld );
}

function world_quaternion( obj ) {
	obj.updateWorldMatrix( true, false );
	return obj.getWorldQuaternion( new THREE.Quaternion() );
}

function world_scale( obj ) {
	obj.updateWorldMatrix( true, false );
	return obj.getWorldScale( new THREE.Vector3() );
}

function expect_vec( actual, x, y, z ) {
	expect( actual.x ).toBeCloseTo( x, 5 );
	expect( actual.y ).toBeCloseTo( y, 5 );
	expect( actual.z ).toBeCloseTo( z, 5 );
}

function build() {
	const scene = new THREE.Scene();
	const root = group( 'model_root' );
	scene.add( root );

	const frame = group( 'frame', { object_id: '1', attachment_id: 101 } );
	const anchor_s = group( 'anchor_handles_s' );
	anchor_s.position.set( 1, 0, 0 );
	const anchor_l = group( 'anchor_handles_l' );
	anchor_l.position.set( 2, 1, 0 );
	anchor_l.rotation.set( 0, Math.PI / 2, 0 );
	const bracket = mesh( 'bracket' );
	bracket.position.set( 0, 3, 0 );
	frame.add( anchor_s, anchor_l, bracket );

	const handles = group( 'handles', { object_id: '2' } );
	const grip = mesh( 'grip' );
	grip.position.set( 0.5, 0, 0 );
	const handles_anchor = group( 'handles_socket' );
	handles_anchor.position.set( 0, 0.25, 0 );
	handles.add( grip, handles_anchor );

	root.add( frame, handles );

	const warnings = [];
	const settled = new Set( [ '1', '2', '101' ] );
	const placement = create_anchor_placement( {
		resolve_object: ( id ) => findObjectByCompositeId( root, id ),
		resolve_model: ( oid ) => ( { 1: frame, 2: handles } )[ oid ] || null,
		is_source_settled: ( id ) => settled.has( String( id ).split( ':' )[ 0 ] ),
		warn: ( m ) => warnings.push( m ),
	} );
	return { scene, root, frame, anchor_s, anchor_l, bracket, handles, grip, handles_anchor, placement, warnings, settled };
}

describe( 'helpers', () => {
	it( 'compares priorities as arrays', () => {
		expect( compare_priority( [ 1, 0 ], [ 0, 9 ] ) ).toBeGreaterThan( 0 );
		expect( compare_priority( [ 0, 2, 1 ], [ 0, 2, 3 ] ) ).toBeLessThan( 0 );
		expect( compare_priority( [ 0, 2 ], [ 0, 2, 0 ] ) ).toBeLessThan( 0 );
		expect( compare_priority( [ 1 ], [ 1 ] ) ).toBe( 0 );
	} );

	it( 'reads follow flags with their defaults', () => {
		expect( read_follow_flag( undefined, true ) ).toBe( true );
		expect( read_follow_flag( '', false ) ).toBe( false );
		expect( read_follow_flag( false, true ) ).toBe( false );
		expect( read_follow_flag( 'false', true ) ).toBe( false );
		expect( read_follow_flag( '1', false ) ).toBe( true );
		expect( read_follow_flag( true, false ) ).toBe( true );
	} );

	it( 'normalises anchor lists', () => {
		expect( normalize_anchor_ids( [ ' 1:a ', '', '1:a', '1:b' ] ) ).toEqual( [ '1:a', '1:b' ] );
		expect( normalize_anchor_ids( '1:a, 1:b\n1:c' ) ).toEqual( [ '1:a', '1:b', '1:c' ] );
		expect( normalize_anchor_ids( null ) ).toEqual( [] );
	} );
} );

describe( 'placing a model on an anchor', () => {
	it( 'parents the model to the anchor with its origin on it', () => {
		const { placement, handles, anchor_s } = build();
		placement.request( 'base', { target_object3d_id: '2', anchor_ids: [ '1:anchor_handles_s' ] } );
		expect( handles.parent ).toBe( anchor_s );
		expect_vec( world_position( handles ), 1, 0, 0 );
	} );

	it( 'follows the anchor rotation by default, and not when turned off', () => {
		const { placement, handles } = build();
		placement.request( 'base', { target_object3d_id: '2', anchor_ids: [ '1:anchor_handles_l' ] } );
		const expected = new THREE.Quaternion().setFromEuler( new THREE.Euler( 0, Math.PI / 2, 0 ) );
		expect( world_quaternion( handles ).angleTo( expected ) ).toBeLessThan( EPS );
		expect_vec( world_position( handles ), 2, 1, 0 );

		placement.request( 'base', { target_object3d_id: '2', anchor_ids: [ '1:anchor_handles_l' ], follow_rotation: false } );
		expect( world_quaternion( handles ).angleTo( new THREE.Quaternion() ) ).toBeLessThan( EPS );
		expect_vec( world_position( handles ), 2, 1, 0 );
	} );

	it( 'keeps the authored world scale unless scale is followed', () => {
		const { placement, handles, frame } = build();
		frame.scale.set( 3, 3, 3 );
		placement.request( 'base', { target_object3d_id: '2', anchor_ids: [ '1:anchor_handles_s' ] } );
		expect_vec( world_scale( handles ), 1, 1, 1 );
		expect_vec( world_position( handles ), 3, 0, 0 );

		placement.request( 'base', { target_object3d_id: '2', anchor_ids: [ '1:anchor_handles_s' ], follow_scale: true } );
		expect_vec( world_scale( handles ), 3, 3, 3 );
	} );

	it( 'keeps the part as modelled on an axis-aligned empty', () => {
		const { placement, handles } = build();
		handles.rotation.set( 0.3, 0, 0 );
		handles.scale.set( 2, 2, 2 );
		const authored_q = handles.quaternion.clone();
		placement.request( 'base', { target_object3d_id: '2', anchor_ids: [ '1:anchor_handles_s' ] } );
		expect( world_quaternion( handles ).angleTo( authored_q ) ).toBeLessThan( EPS );
		expect_vec( world_scale( handles ), 2, 2, 2 );
	} );

	it( 'mirrors the part on a negatively scaled anchor when scale is followed', () => {
		const { placement, grip, anchor_s } = build();
		anchor_s.scale.set( -1, 1, 1 );
		placement.request( 'mirror', { target_id: '2:grip', anchor_ids: [ '1:anchor_handles_s' ], follow_scale: true } );
		grip.updateWorldMatrix( true, false );
		expect( grip.matrixWorld.determinant() ).toBeLessThan( 0 );
		expect_vec( world_position( grip ), 1, 0, 0 );
	} );
} );

describe( 'reverting', () => {
	it( 'puts the object back under its original parent with its original transform', () => {
		const { placement, handles, root } = build();
		handles.position.set( 0.1, 0.2, 0.3 );
		handles.rotation.set( 0.1, 0.2, 0.3 );
		const before = { p: handles.position.clone(), q: handles.quaternion.clone(), s: handles.scale.clone() };
		placement.request( 'base', { target_object3d_id: '2', anchor_ids: [ '1:anchor_handles_l' ] } );
		placement.release( 'base' );
		expect( handles.parent ).toBe( root );
		expect( handles.position.distanceTo( before.p ) ).toBeLessThan( EPS );
		expect( handles.quaternion.angleTo( before.q ) ).toBeLessThan( EPS );
		expect( handles.scale.distanceTo( before.s ) ).toBeLessThan( EPS );
	} );

	it( 'falls back through requests by priority, whatever order they are released in', () => {
		const { placement, handles, anchor_s, anchor_l, root } = build();
		placement.request( 'base', { target_object3d_id: '2', anchor_ids: [ '1:anchor_handles_s' ], priority: [ 0, 1, -1 ] } );
		placement.request( 'size_l', { target_object3d_id: '2', anchor_ids: [ '1:anchor_handles_l' ], priority: [ 1, 0, 2, 0 ] } );
		expect( handles.parent ).toBe( anchor_l );
		placement.release( 'base' );
		expect( handles.parent ).toBe( anchor_l );
		placement.request( 'base', { target_object3d_id: '2', anchor_ids: [ '1:anchor_handles_s' ], priority: [ 0, 1, -1 ] } );
		placement.release( 'size_l' );
		expect( handles.parent ).toBe( anchor_s );
		placement.release( 'base' );
		expect( handles.parent ).toBe( root );
		expect_vec( world_position( handles ), 0, 0, 0 );
	} );

	it( 'reset puts everything back', () => {
		const { placement, handles, bracket, frame, root } = build();
		placement.request( 'a', { target_object3d_id: '2', anchor_ids: [ '1:anchor_handles_s' ] } );
		placement.request( 'b', { target_id: '1:bracket', anchor_ids: [ '2:handles_socket' ] } );
		placement.reset();
		expect( handles.parent ).toBe( root );
		expect( bracket.parent ).toBe( frame );
		expect( placement.has_requests() ).toBe( false );
	} );
} );

describe( 'anchors that cannot be used', () => {
	it( 'skips a request whose anchor is missing and warns once', () => {
		const { placement, handles, anchor_s, warnings } = build();
		placement.request( 'base', { target_object3d_id: '2', anchor_ids: [ '1:anchor_handles_s' ], priority: [ 0 ] } );
		placement.request( 'broken', { target_object3d_id: '2', anchor_ids: [ '1:renamed_anchor' ], priority: [ 1 ] } );
		placement.refresh();
		expect( handles.parent ).toBe( anchor_s );
		expect( warnings.filter( ( w ) => w.indexOf( 'renamed_anchor' ) !== -1 ) ).toHaveLength( 1 );
	} );

	it( 'waits for a host that is still loading, keeping the current placement', async () => {
		const { root, handles, anchor_s, frame } = build();
		// A lazy host that is not mounted yet.
		const lazy = group( 'frame_xl', { object_id: '3' } );
		const anchor_xl = group( 'anchor_handles_xl' );
		anchor_xl.position.set( 5, 0, 0 );
		lazy.add( anchor_xl );
		let settled = false;
		const loads = [];
		const placement = create_anchor_placement( {
			resolve_object: ( id ) => findObjectByCompositeId( root, id ),
			resolve_model: ( oid ) => ( oid === '2' ? handles : null ),
			is_source_settled: ( id ) => ! id.startsWith( '3:' ) || settled,
			ensure_loaded: ( id ) => {
				loads.push( id );
				return Promise.resolve().then( () => {
					root.add( lazy );
					settled = true;
				} );
			},
			warn: () => {},
		} );
		placement.request( 'base', { target_object3d_id: '2', anchor_ids: [ '1:anchor_handles_s' ], priority: [ 0 ] } );
		placement.request( 'xl', { target_object3d_id: '2', anchor_ids: [ '3:anchor_handles_xl' ], priority: [ 1 ] } );
		expect( handles.parent ).toBe( anchor_s );
		expect( loads ).toEqual( [ '3:anchor_handles_xl' ] );
		await Promise.resolve();
		await Promise.resolve();
		expect( handles.parent ).toBe( anchor_xl );
		expect( frame.parent ).toBe( root );
	} );

	it( 'ignores an anchor inside the object being placed', () => {
		const { placement, handles, root, warnings } = build();
		placement.request( 'cycle', { target_object3d_id: '2', anchor_ids: [ '2:handles_socket' ] } );
		expect( handles.parent ).toBe( root );
		expect( warnings.some( ( w ) => w.indexOf( 'inside the object' ) !== -1 ) ).toBe( true );
	} );

	it( 'ignores an anchor with a zero scale', () => {
		const { placement, handles, root, anchor_s } = build();
		anchor_s.scale.set( 0, 1, 1 );
		placement.request( 'flat', { target_object3d_id: '2', anchor_ids: [ '1:anchor_handles_s' ] } );
		expect( handles.parent ).toBe( root );
	} );
} );

describe( 'copies on several anchors', () => {
	it( 'puts the source on the first anchor and a copy on each other', () => {
		const { placement, handles, anchor_s, anchor_l } = build();
		placement.request( 'legs', { target_object3d_id: '2', anchor_ids: [ '1:anchor_handles_s', '1:anchor_handles_l' ] } );
		expect( handles.parent ).toBe( anchor_s );
		expect( anchor_l.children ).toHaveLength( 1 );
		const copy = anchor_l.children[ 0 ];
		expect( copy ).not.toBe( handles );
		expect_vec( world_position( copy ), 2, 1, 0 );
		// Copies share geometry and are not model roots.
		expect( copy.children[ 0 ].geometry ).toBe( handles.children[ 0 ].geometry );
		expect( copy.userData.object_id ).toBeUndefined();
	} );

	it( 'mirrors visibility and material from the source', () => {
		const { placement, handles, grip, anchor_l } = build();
		placement.request( 'legs', { target_object3d_id: '2', anchor_ids: [ '1:anchor_handles_s', '1:anchor_handles_l' ] } );
		const copy = anchor_l.children[ 0 ];
		const copy_grip = copy.children.find( ( c ) => c.name === 'grip' );
		handles.visible = false;
		expect( copy.visible ).toBe( false );
		handles.visible = true;
		grip.visible = false;
		expect( copy_grip.visible ).toBe( false );
		const red = new THREE.MeshBasicMaterial( { color: 0xff0000 } );
		grip.material = red;
		expect( copy_grip.material ).toBe( red );
	} );

	it( 'is found by the plural lookup and never by the singular one', () => {
		const { placement, root, grip, anchor_l } = build();
		placement.request( 'legs', { target_object3d_id: '2', anchor_ids: [ '1:anchor_handles_s', '1:anchor_handles_l' ] } );
		const copy_grip = anchor_l.children[ 0 ].children.find( ( c ) => c.name === 'grip' );
		expect( findObjectByCompositeId( root, '2:grip' ) ).toBe( grip );
		expect( findObjectsByCompositeId( root, '2:grip' ) ).toEqual( [ grip, copy_grip ] );
	} );

	it( 'resolves a bare name to the source even when a copy comes first in the tree', () => {
		// The source goes on the first listed anchor (L); the copy lands on S,
		// which is earlier among the frame's children.
		const { placement, root, grip, anchor_s } = build();
		placement.request( 'legs', { target_object3d_id: '2', anchor_ids: [ '1:anchor_handles_l', '1:anchor_handles_s' ] } );
		const copy_grip = anchor_s.children[ 0 ].children.find( ( c ) => c.name === 'grip' );
		expect( findObjectByCompositeId( root, 'grip' ) ).toBe( grip );
		expect( findObjectsByCompositeId( root, 'grip' ) ).toEqual( [ grip, copy_grip ] );
	} );

	it( 'removes the copies when the placement changes', () => {
		const { placement, anchor_l, root, grip } = build();
		placement.request( 'legs', { target_object3d_id: '2', anchor_ids: [ '1:anchor_handles_s', '1:anchor_handles_l' ] } );
		placement.release( 'legs' );
		expect( anchor_l.children ).toHaveLength( 0 );
		expect( findObjectsByCompositeId( root, '2:grip' ) ).toEqual( [ grip ] );
	} );
} );

describe( 'lookups once things have moved', () => {
	it( 'still finds a model and its parts after the model root has moved', () => {
		const { placement, root, grip, handles_anchor } = build();
		placement.request( 'base', { target_object3d_id: '2', anchor_ids: [ '1:anchor_handles_s' ] } );
		expect( findObjectByCompositeId( root, '2:grip' ) ).toBe( grip );
		expect( findObjectByCompositeId( root, '2:handles_socket' ) ).toBe( handles_anchor );
	} );

	it( 'does not find another model\'s parts through an anchor', () => {
		const { placement, root } = build();
		placement.request( 'base', { target_object3d_id: '2', anchor_ids: [ '1:anchor_handles_s' ] } );
		// The grip now hangs under the frame, but it is not the frame's.
		expect( findObjectByCompositeId( root, '1:grip' ) ).toBeNull();
	} );

	it( 'finds a moved node under the model it was authored in', () => {
		const { placement, root, bracket, handles_anchor } = build();
		placement.request( 'b', { target_id: '1:bracket', anchor_ids: [ '2:handles_socket' ] } );
		expect( bracket.parent ).toBe( handles_anchor );
		expect( findObjectByCompositeId( root, '1:bracket' ) ).toBe( bracket );
		expect( findObjectByCompositeId( root, '2:bracket' ) ).toBeNull();
	} );

	it( 'uses the authored orientation when an ancestor has already been moved', () => {
		const { placement, root, grip, anchor_l, anchor_s } = build();
		// Handles go on the rotated L anchor; the grip is then sent to the S anchor.
		placement.request( 'handles', { target_object3d_id: '2', anchor_ids: [ '1:anchor_handles_l' ] } );
		placement.request( 'grip', { target_id: '2:grip', anchor_ids: [ '1:anchor_handles_s' ] } );
		expect( grip.parent ).toBe( anchor_s );
		// The S anchor is unrotated, so the grip must not inherit the L anchor's turn.
		expect( world_quaternion( grip ).angleTo( new THREE.Quaternion() ) ).toBeLessThan( EPS );
		expect( findObjectByCompositeId( root, '2:grip' ) ).toBe( grip );
		expect( anchor_l.children ).toHaveLength( 1 );
	} );
} );
