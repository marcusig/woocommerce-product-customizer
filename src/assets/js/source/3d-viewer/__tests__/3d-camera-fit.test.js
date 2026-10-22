/**
 * Tests for fitting an angle's target in view.
 *
 * The property that matters is the one the customer sees: after the fit, the
 * outline of the points, projected through a camera at the fitted distance with
 * the lens shift applied, spans the frame less the margin on its tighter axis
 * and is centred on both. These tests project through a real PerspectiveCamera
 * rather than re-deriving the maths, so a sign error in the shift shows up.
 */
import * as THREE from 'three';
import {
	angle_fits_target,
	angle_fit_margin,
	angle_fit_max_size,
	angle_fit_objects,
	angle_model_pivot,
	CAMERA_TARGET_VISIBLE,
	collect_fit_points,
	fit_angle_camera,
	set_orbit_fitted_distance,
	set_orbit_max_distance,
	fit_points_in_view,
	framing_shift_to_pixels,
	DEFAULT_FIT_MARGIN,
} from '../3d-camera-fit.js';

const box_points = ( min, max ) => {
	const out = [];
	for ( let i = 0; i < 8; i++ ) {
		out.push(
			i & 1 ? max[ 0 ] : min[ 0 ],
			i & 2 ? max[ 1 ] : min[ 1 ],
			i & 4 ? max[ 2 ] : min[ 2 ]
		);
	}
	return new Float32Array( out );
};

/** Project points through a camera posed and shifted as the viewer would. */
const projected_outline = ( points, { pivot, direction, fov, aspect, fit } ) => {
	const width = 1000 * aspect;
	const height = 1000;
	const camera = new THREE.PerspectiveCamera( fov, aspect, 0.01, 1000 );
	camera.position.copy( pivot ).addScaledVector( direction.clone().normalize(), -fit.distance );
	camera.lookAt( pivot );
	const px = framing_shift_to_pixels( fit.shift, fov, width, height );
	camera.setViewOffset( width, height, px.x, px.y, width, height );
	camera.updateProjectionMatrix();
	camera.updateMatrixWorld();
	let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
	const v = new THREE.Vector3();
	for ( let i = 0; i < points.length; i += 3 ) {
		v.set( points[ i ], points[ i + 1 ], points[ i + 2 ] ).project( camera );
		x0 = Math.min( x0, v.x );
		x1 = Math.max( x1, v.x );
		y0 = Math.min( y0, v.y );
		y1 = Math.max( y1, v.y );
	}
	return { x0, x1, y0, y1 };
};

describe( 'fit_points_in_view', () => {
	// A car-like box seen from a front three-quarter, above: the near end looks
	// bigger, so the box centre does not project to the middle of the outline.
	const points = box_points( [ -2.6, 0, -1.1 ], [ 2.4, 1.3, 1.1 ] );
	const pivot = new THREE.Vector3( -0.1, 0.65, 0 );
	const direction = pivot.clone().sub( new THREE.Vector3( 4.4, 0.9, 2.8 ) );

	it.each( [
		[ 'portrait', 0.77 ],
		[ 'square', 1 ],
		[ 'landscape', 1.8 ],
	] )( 'fills the tighter axis and centres the outline (%s)', ( _label, aspect ) => {
		const margin = 0.05;
		const fit = fit_points_in_view( points, { pivot, direction, fov: 45, aspect, margin } );
		const o = projected_outline( points, { pivot, direction, fov: 45, aspect, fit } );
		const limit = 1 - margin;
		// Centred on both axes.
		expect( o.x0 + o.x1 ).toBeCloseTo( 0, 4 );
		expect( o.y0 + o.y1 ).toBeCloseTo( 0, 4 );
		// Inside the frame, touching the margin on the axis that decided the distance.
		expect( Math.max( o.x1, o.y1 ) ).toBeCloseTo( limit, 4 );
		expect( o.x1 ).toBeLessThanOrEqual( limit + 1e-6 );
		expect( o.y1 ).toBeLessThanOrEqual( limit + 1e-6 );
	} );

	it( 'stops at the maximum width on a wide frame, still centred', () => {
		// A 2000 px wide frame with a 600 px cap: the outline may fill 30% of it.
		const fit = fit_points_in_view( points, { pivot, direction, fov: 45, aspect: 2, margin: 0.05, maxWidth: 0.3 } );
		const o = projected_outline( points, { pivot, direction, fov: 45, aspect: 2, fit } );
		expect( o.x1 - o.x0 ).toBeCloseTo( 2 * 0.3, 4 );
		expect( o.x0 + o.x1 ).toBeCloseTo( 0, 4 );
		expect( o.y0 + o.y1 ).toBeCloseTo( 0, 4 );
	} );

	it( 'stops at the maximum height when that is the tighter one', () => {
		const fit = fit_points_in_view( points, { pivot, direction, fov: 45, aspect: 1.5, margin: 0.05, maxHeight: 0.1 } );
		const o = projected_outline( points, { pivot, direction, fov: 45, aspect: 1.5, fit } );
		expect( o.y1 - o.y0 ).toBeCloseTo( 2 * 0.1, 4 );
		expect( o.x1 - o.x0 ).toBeLessThan( 2 * 0.95 );
	} );

	it( 'stops at the zoom limit and centres the outline where the camera really is', () => {
		const free = fit_points_in_view( points, { pivot, direction, fov: 45, aspect: 2, maxWidth: 0.1 } );
		const limit = free.distance * 0.6;
		const fit = fit_points_in_view( points, { pivot, direction, fov: 45, aspect: 2, maxWidth: 0.1, maxDistance: limit } );
		expect( fit.distance ).toBeCloseTo( limit, 9 );
		const o = projected_outline( points, { pivot, direction, fov: 45, aspect: 2, fit } );
		expect( o.x0 + o.x1 ).toBeCloseTo( 0, 4 );
		expect( o.y0 + o.y1 ).toBeCloseTo( 0, 4 );
	} );

	it( 'lets the margin win where it is tighter than the maximum', () => {
		const capped = fit_points_in_view( points, { pivot, direction, fov: 45, aspect: 0.77, margin: 0.05, maxWidth: 0.99, maxHeight: 0.99 } );
		const plain = fit_points_in_view( points, { pivot, direction, fov: 45, aspect: 0.77, margin: 0.05 } );
		expect( capped.distance ).toBeCloseTo( plain.distance, 6 );
	} );

	it( 'backs further away for a narrower output', () => {
		const narrow = fit_points_in_view( points, { pivot, direction, fov: 45, aspect: 0.6 } );
		const wide = fit_points_in_view( points, { pivot, direction, fov: 45, aspect: 1.6 } );
		expect( narrow.distance ).toBeGreaterThan( wide.distance );
	} );

	it( 'needs no shift for a symmetric view of a symmetric target', () => {
		const cube = box_points( [ -1, -1, -1 ], [ 1, 1, 1 ] );
		const fit = fit_points_in_view( cube, {
			pivot: new THREE.Vector3(),
			direction: new THREE.Vector3( 0, 0, -1 ),
			fov: 45,
			aspect: 1,
		} );
		expect( fit.shift.x ).toBeCloseTo( 0, 6 );
		expect( fit.shift.y ).toBeCloseTo( 0, 6 );
	} );

	it( 'returns null when there is nothing to fit', () => {
		expect( fit_points_in_view( new Float32Array( 0 ), { pivot, direction, fov: 45, aspect: 1 } ) ).toBeNull();
		expect( fit_points_in_view( points, { pivot, direction: new THREE.Vector3(), fov: 45, aspect: 1 } ) ).toBeNull();
	} );
} );

describe( 'framing_shift_to_pixels', () => {
	it( 'is zero without a shift', () => {
		expect( framing_shift_to_pixels( null, 45, 800, 600 ) ).toEqual( { x: 0, y: 0 } );
		expect( framing_shift_to_pixels( { x: 0, y: 0 }, 45, 800, 600 ) ).toEqual( { x: 0, y: 0 } );
	} );

	it( 'scales with the output, so one shift serves any size of the same shape', () => {
		const small = framing_shift_to_pixels( { x: 0.1, y: 0.05 }, 45, 400, 300 );
		const big = framing_shift_to_pixels( { x: 0.1, y: 0.05 }, 45, 1600, 1200 );
		expect( big.x ).toBeCloseTo( small.x * 4, 6 );
		expect( big.y ).toBeCloseTo( small.y * 4, 6 );
	} );
} );

describe( 'collect_fit_points', () => {
	it( 'samples visible meshes in world space and skips hidden ones', () => {
		const root = new THREE.Group();
		const shown = new THREE.Mesh( new THREE.BoxGeometry( 2, 2, 2 ) );
		shown.position.set( 10, 0, 0 );
		const hiddenParent = new THREE.Group();
		hiddenParent.visible = false;
		const hidden = new THREE.Mesh( new THREE.BoxGeometry( 2, 2, 2 ) );
		hidden.position.set( -50, 0, 0 );
		hiddenParent.add( hidden );
		root.add( shown, hiddenParent );

		const points = collect_fit_points( [ root ] );
		expect( points.length ).toBeGreaterThan( 0 );
		for ( let i = 0; i < points.length; i += 3 ) {
			expect( points[ i ] ).toBeGreaterThanOrEqual( 9 - 1e-6 );
			expect( points[ i ] ).toBeLessThanOrEqual( 11 + 1e-6 );
		}
	} );

	it( 'stays within the budget on heavy geometry', () => {
		const mesh = new THREE.Mesh( new THREE.SphereGeometry( 1, 256, 256 ) );
		const points = collect_fit_points( [ mesh ], 1000 );
		expect( points.length / 3 ).toBeLessThanOrEqual( 1000 );
		expect( points.length / 3 ).toBeGreaterThan( 500 );
	} );
} );

describe( 'angle settings', () => {
	it( 'fits unless the angle asks for its camera position as set', () => {
		expect( angle_fits_target( {} ) ).toBe( true );
		expect( angle_fits_target( { camera_framing: 'fit' } ) ).toBe( true );
		expect( angle_fits_target( { camera_framing: '' } ) ).toBe( true );
		expect( angle_fits_target( { camera_framing: 'fixed' } ) ).toBe( false );
		expect( angle_fits_target( { get: ( key ) => ( { camera_framing: 'fixed' } )[ key ] } ) ).toBe( false );
	} );

	it( 'reads the maximum size in pixels, empty or invalid meaning no cap', () => {
		expect( angle_fit_max_size( {} ) ).toEqual( { width: 0, height: 0 } );
		expect( angle_fit_max_size( { camera_fit_max_width: '', camera_fit_max_height: 'abc' } ) ).toEqual( { width: 0, height: 0 } );
		expect( angle_fit_max_size( { camera_fit_max_width: '900', camera_fit_max_height: -5 } ) ).toEqual( { width: 900, height: 0 } );
	} );

	it( 'reads the margin as a percentage, keeping 0 and defaulting empty', () => {
		expect( angle_fit_margin( {} ) ).toBe( DEFAULT_FIT_MARGIN );
		expect( angle_fit_margin( { camera_fit_margin: '' } ) ).toBe( DEFAULT_FIT_MARGIN );
		expect( angle_fit_margin( { camera_fit_margin: 'abc' } ) ).toBe( DEFAULT_FIT_MARGIN );
		expect( angle_fit_margin( { camera_fit_margin: 0 } ) ).toBe( 0 );
		expect( angle_fit_margin( { camera_fit_margin: '10' } ) ).toBeCloseTo( 0.1 );
		expect( angle_fit_margin( { camera_fit_margin: 90 } ) ).toBeCloseTo( 0.45 );
	} );
} );

describe( 'an angle that names a model but no object', () => {
	const angle = ( attrs ) => ( { get: ( key ) => attrs[ key ] } );
	const box_mesh = ( name, x ) => {
		const mesh = new THREE.Mesh( new THREE.BoxGeometry( 2, 2, 2 ) );
		mesh.name = name;
		mesh.position.set( x, 1, 0 );
		return mesh;
	};
	// Two loaded models, tagged as the viewer mounts them: the stored target
	// (the origin) is in neither.
	const scene = () => {
		const root = new THREE.Group();
		const car = new THREE.Group();
		car.userData.object_id = 9;
		car.add( box_mesh( 'Body', 10 ), box_mesh( 'Spoiler', 14 ) );
		const shed = new THREE.Group();
		shed.userData.object_id = 8;
		shed.add( box_mesh( 'Shed', -10 ) );
		root.add( car, shed );
		return { root, car };
	};

	it( 'frames and turns around that whole model', () => {
		const { root, car } = scene();
		const a = angle( { camera_target_model: '9', camera_target_object_id: '', camera_focus_object_ids: [] } );
		expect( angle_fit_objects( root, a ) ).toEqual( [ car ] );
		expect( angle_model_pivot( root, a ).toArray() ).toEqual( [ 12, 1, 0 ] );
	} );

	it( 'centres on what is shown, leaving hidden choices out', () => {
		const { root, car } = scene();
		car.getObjectByName( 'Spoiler' ).visible = false;
		const pivot = angle_model_pivot( root, angle( { camera_target_model: '9' } ) );
		expect( pivot.toArray() ).toEqual( [ 10, 1, 0 ] );
	} );

	it( 'keeps the stored target for a fixed angle, or one naming no model', () => {
		const { root } = scene();
		expect( angle_model_pivot( root, angle( { camera_target_model: '9', camera_framing: 'fixed' } ) ) ).toBeNull();
		expect( angle_model_pivot( root, angle( {} ) ) ).toBeNull();
		expect( angle_fit_objects( root, angle( {} ) ) ).toEqual( [ root ] );
	} );

	it( 'turns around everything shown while the model is hidden or not loaded', () => {
		const { root, car } = scene();
		const hidden = angle( { camera_target_model: '9' } );
		car.visible = false;
		expect( angle_fit_objects( root, hidden ) ).toEqual( [ root ] );
		expect( angle_model_pivot( root, hidden ).toArray() ).toEqual( [ -10, 1, 0 ] );
		car.visible = true;
		expect( angle_model_pivot( root, angle( { camera_target_model: '42' } ) ).toArray() ).toEqual( [ 2, 1, 0 ] );
	} );

	it( 'frames and turns around everything shown for "Visible objects"', () => {
		const { root, car } = scene();
		const a = angle( { camera_target_model: CAMERA_TARGET_VISIBLE } );
		expect( angle_fit_objects( root, a ) ).toEqual( [ root ] );
		expect( angle_model_pivot( root, a ).toArray() ).toEqual( [ 2, 1, 0 ] );
		car.visible = false;
		expect( angle_model_pivot( root, a ).toArray() ).toEqual( [ -10, 1, 0 ] );
		expect( angle_model_pivot( root, angle( { camera_target_model: CAMERA_TARGET_VISIBLE, camera_framing: 'fixed' } ) ) ).toBeNull();
	} );

	it( 'still prefers a target object or focus objects', () => {
		const { root, car } = scene();
		const body = car.getObjectByName( 'Body' );
		expect( angle_fit_objects( root, angle( { camera_target_model: '9', camera_target_object_id: 'Shed' } ) ) ).toEqual( [ root.getObjectByName( 'Shed' ) ] );
		expect( angle_fit_objects( root, angle( { camera_target_model: '8', camera_focus_object_ids: [ '9:Body' ] } ) ) ).toEqual( [ body ] );
	} );
} );

describe( 'the zoom-out limit and a fitted angle', () => {
	const angle = { get: () => undefined };
	const scene = () => {
		const root = new THREE.Group();
		const mesh = new THREE.Mesh( new THREE.BoxGeometry( 4, 1, 1 ) );
		root.add( mesh );
		return root;
	};
	const camera = () => new THREE.PerspectiveCamera( 45, 0.6, 0.01, 1000 );

	it( 'fits past the zoom-out limit, but not inside the zoom-in one', () => {
		const args = { angle, root: scene(), camera: camera(), from: new THREE.Vector3( 0, 0, 10 ), target: new THREE.Vector3(), aspect: 0.6 };
		const free = fit_angle_camera( args ).distance;
		const limited = fit_angle_camera( { ...args, distanceLimits: { min: 0, max: free / 2 } } );
		expect( limited.distance ).toBeCloseTo( free );
		expect( limited.position.distanceTo( limited.target ) ).toBeCloseTo( free );
		const near = fit_angle_camera( { ...args, distanceLimits: { min: free * 2, max: Infinity } } );
		expect( near.distance ).toBeCloseTo( free * 2 );
	} );

	it( 'gives way to the fitted distance, and returns once the view is not fitted', () => {
		const controls = { maxDistance: 1.1 };
		set_orbit_fitted_distance( controls, 1.7 );
		expect( controls.maxDistance ).toBe( 1.7 );
		set_orbit_fitted_distance( controls, 0.8 );
		expect( controls.maxDistance ).toBe( 1.1 );
		set_orbit_fitted_distance( controls, 0 );
		expect( controls.maxDistance ).toBe( 1.1 );
	} );

	it( 'keeps the fitted distance when the settings set the limit again', () => {
		const controls = { maxDistance: 1.1 };
		set_orbit_fitted_distance( controls, 1.7 );
		set_orbit_max_distance( controls, 1.1 );
		expect( controls.maxDistance ).toBe( 1.7 );
		set_orbit_max_distance( controls, 2.5 );
		expect( controls.maxDistance ).toBe( 2.5 );
		set_orbit_max_distance( controls, Infinity );
		expect( controls.maxDistance ).toBe( Infinity );
	} );
} );
