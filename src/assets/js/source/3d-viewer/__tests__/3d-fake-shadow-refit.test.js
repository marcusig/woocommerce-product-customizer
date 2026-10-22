/**
 * Tests for the fake shadow following models added after it was fitted.
 *
 * The plane was only fitted when settings were applied, so a model loaded
 * lazily beside the eager one fell outside the captured area and cast no
 * shadow at all. Loading it only invalidated the shadow, which redrew the
 * same area.
 */
import * as THREE from 'three';
import { FakeShadow } from '../3d-fake-shadow.js';

function stub_renderer() {
	return {
		xr: { enabled: false },
		getClearAlpha: () => 1,
		setClearAlpha: () => {},
		getRenderTarget: () => null,
		setRenderTarget: () => {},
		render: jest.fn(),
	};
}

function box_mesh( size, x = 0 ) {
	const mesh = new THREE.Mesh( new THREE.BoxGeometry( size, size, size ) );
	mesh.position.set( x, size / 2, 0 );
	return mesh;
}

/** The ground area the shadow captures, in world space. */
function captured_area( shadow ) {
	shadow.updateMatrixWorld( true );
	const half_x = shadow._planeWidth / 2;
	const half_z = shadow._planeDepth / 2;
	const centre = shadow.getWorldPosition( new THREE.Vector3() );
	return { min_x: centre.x - half_x, max_x: centre.x + half_x, min_z: centre.z - half_z, max_z: centre.z + half_z };
}

describe( 'FakeShadow refit', () => {
	let scene, root, shadow, renderer;
	const ground = { shadow_opacity: 0.5 };

	beforeEach( () => {
		scene = new THREE.Scene();
		root = new THREE.Group();
		scene.add( root );
		root.add( box_mesh( 1 ) );
		shadow = new FakeShadow( scene );
		shadow.update( root, ground, true );
		renderer = stub_renderer();
		shadow.render( renderer, scene );
	} );

	afterEach( () => shadow.dispose() );

	it( 'grows to cover a model loaded after the fit', () => {
		root.add( box_mesh( 1, 6 ) );
		shadow.invalidate();
		shadow.render( renderer, scene );

		const area = captured_area( shadow );
		expect( area.min_x ).toBeLessThan( -0.5 );
		expect( area.max_x ).toBeGreaterThan( 6.5 );
	} );

	it( 'follows a model that moved', () => {
		root.children[ 0 ].position.x = 10;
		shadow.invalidate();
		shadow.render( renderer, scene );

		const area = captured_area( shadow );
		expect( area.min_x ).toBeLessThan( 9.5 );
		expect( area.max_x ).toBeGreaterThan( 10.5 );
	} );

	it( 'keeps the settings it was fitted with', () => {
		shadow.update( root, { shadow_opacity: 0.8, shadow_contact: 0.3 }, true );
		root.add( box_mesh( 1, 6 ) );
		shadow.invalidate();
		shadow.render( renderer, scene );

		expect( shadow._intensity ).toBe( 0.8 );
		expect( shadow._contactStrength ).toBe( 0.3 );
	} );

	it( 'leaves the fit alone when nothing moved', () => {
		const update = jest.spyOn( shadow, 'update' );
		shadow.invalidate();
		shadow.render( renderer, scene );
		expect( update ).not.toHaveBeenCalled();
	} );

	it( 'does not measure anything without a rebuild', () => {
		const measure = jest.spyOn( shadow._measuredBox, 'setFromObject' );
		root.add( box_mesh( 1, 6 ) );
		shadow.render( renderer, scene );
		expect( measure ).not.toHaveBeenCalled();
	} );
} );
