/**
 * Tests for the orbiting camera move between angles.
 *
 * What the customer notices is the shape of the path: it goes round the
 * product rather than through it, it does not dip towards the product halfway,
 * it turns the way the destination asks, and it never pushes against azimuth
 * limits (OrbitControls would clamp the camera there and stall the move).
 */
import * as THREE from 'three';
import { angle_turn_direction, plan_orbit_move, turn_delta } from '../3d-camera-move.js';

const DEG = Math.PI / 180;
const at = ( deg, radius = 5, y = 1 ) => new THREE.Vector3( radius * Math.sin( deg * DEG ), y, radius * Math.cos( deg * DEG ) );

const sample = ( move, steps = 20 ) => {
	const out = [];
	for ( let i = 0; i <= steps; i++ ) {
		const position = new THREE.Vector3();
		const target = new THREE.Vector3();
		move( i / steps, position, target );
		out.push( { position, target } );
	}
	return out;
};

describe( 'plan_orbit_move', () => {
	const origin = new THREE.Vector3();

	it( 'starts at the start view and ends exactly on the end view', () => {
		const from = { position: at( 10 ), target: origin };
		const to = { position: at( 120, 3 ), target: new THREE.Vector3( 0.5, 0.2, 0 ) };
		const path = sample( plan_orbit_move( from, to ) );
		expect( path[ 0 ].position.distanceTo( from.position ) ).toBeLessThan( 1e-9 );
		expect( path[ path.length - 1 ].position.equals( to.position ) ).toBe( true );
		expect( path[ path.length - 1 ].target.equals( to.target ) ).toBe( true );
	} );

	it( 'goes round the product between opposite views, not through it', () => {
		const path = sample( plan_orbit_move(
			{ position: at( 0 ), target: origin },
			{ position: at( 179 ), target: origin }
		) );
		path.forEach( ( { position, target } ) => {
			expect( position.distanceTo( target ) ).toBeCloseTo( at( 0 ).length(), 6 );
		} );
	} );

	it( 'changes distance evenly, without dipping below either end', () => {
		const path = sample( plan_orbit_move(
			{ position: at( 0, 8 ), target: origin },
			{ position: at( 90, 2 ), target: origin }
		) );
		const d = path.map( ( { position, target } ) => position.distanceTo( target ) );
		for ( let i = 1; i < d.length; i++ ) expect( d[ i ] ).toBeLessThanOrEqual( d[ i - 1 ] + 1e-9 );
		expect( Math.min( ...d ) ).toBeGreaterThanOrEqual( at( 90, 2 ).length() - 1e-9 );
	} );

	it( 'turns the way the destination asks', () => {
		// 0 to 90 degrees: shortest is counter-clockwise from above, so passes 45.
		const mid = ( turn ) => {
			const position = new THREE.Vector3();
			plan_orbit_move(
				{ position: at( 0 ), target: origin },
				{ position: at( 90 ), target: origin },
				{ turn }
			)( 0.5, position, new THREE.Vector3() );
			return Math.round( Math.atan2( position.x, position.z ) / DEG );
		};
		expect( mid( 'shortest' ) ).toBe( 45 );
		expect( mid( 'ccw' ) ).toBe( 45 );
		expect( mid( 'cw' ) ).toBe( -135 );
	} );
} );

describe( 'turn_delta', () => {
	it( 'takes the short way round without a setting', () => {
		expect( turn_delta( 170 * DEG, -170 * DEG, 'shortest' ) / DEG ).toBeCloseTo( 20 );
		expect( turn_delta( -170 * DEG, 170 * DEG, 'shortest' ) / DEG ).toBeCloseTo( -20 );
	} );

	it( 'goes the long way when told to', () => {
		expect( turn_delta( 170 * DEG, -170 * DEG, 'cw' ) / DEG ).toBeCloseTo( -340 );
		expect( turn_delta( -170 * DEG, 170 * DEG, 'ccw' ) / DEG ).toBeCloseTo( 340 );
	} );

	it( 'stays inside azimuth limits, whatever the setting', () => {
		// Limited to the front half: going from -80 to 80 must pass 0, not 180.
		const min = -90 * DEG;
		const max = 90 * DEG;
		[ 'shortest', 'cw', 'ccw' ].forEach( ( turn ) => {
			expect( turn_delta( -80 * DEG, 80 * DEG, turn, min, max ) / DEG ).toBeCloseTo( 160 );
		} );
	} );

	it( 'treats full-circle limits as no limits', () => {
		expect( turn_delta( 170 * DEG, -170 * DEG, 'shortest', -Math.PI, Math.PI ) / DEG ).toBeCloseTo( 20 );
	} );
} );

describe( 'angle_turn_direction', () => {
	it( 'defaults to the shortest way', () => {
		expect( angle_turn_direction( {} ) ).toBe( 'shortest' );
		expect( angle_turn_direction( { camera_turn: 'sideways' } ) ).toBe( 'shortest' );
		expect( angle_turn_direction( { camera_turn: 'cw' } ) ).toBe( 'cw' );
		expect( angle_turn_direction( { get: () => 'ccw' } ) ).toBe( 'ccw' );
	} );
} );
