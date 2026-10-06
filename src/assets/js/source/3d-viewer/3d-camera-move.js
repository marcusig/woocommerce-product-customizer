/**
 * The path a camera takes between two views: an orbit, not a straight line.
 *
 * Moving the camera position in a straight line cuts across the product
 * between views on opposite sides of it, and dips towards the product halfway
 * there before backing out again. Interpolating in orbit terms instead -
 * turn around the pivot, tilt, distance, and the pivot itself - keeps the
 * camera travelling around the product the way a customer would drag it.
 *
 * Angles are in OrbitControls' convention: theta is atan2( x, z ) around the
 * world Y axis, phi is measured down from +Y. The viewer's camera uses the
 * default Y-up, as OrbitControls does.
 */
import * as THREE from 'three';

const TWO_PI = Math.PI * 2;

/**
 * Whether an angle asks to be arrived at turning a particular way.
 *
 * @param {Backbone.Model|Object} angle
 * @returns {'cw'|'ccw'|'shortest'} 'cw' and 'ccw' as seen from above
 */
export function angle_turn_direction( angle ) {
	const value = angle && ( typeof angle.get === 'function' ? angle.get( 'camera_turn' ) : angle.camera_turn );
	return value === 'cw' || value === 'ccw' ? value : 'shortest';
}

const to_orbit = ( offset ) => {
	const radius = Math.max( offset.length(), 1e-6 );
	return {
		radius,
		phi: Math.acos( THREE.MathUtils.clamp( offset.y / radius, -1, 1 ) ),
		theta: Math.atan2( offset.x, offset.z ),
	};
};

/**
 * How far to turn around the Y axis, from theta0 to theta1.
 *
 * With azimuth limits the camera cannot pass through the excluded arc, so the
 * only allowed way is the one inside [min, max], whatever the turn setting
 * asks: OrbitControls would otherwise clamp the camera mid-move and leave it
 * stuck against the limit.
 *
 * @param {number} theta0
 * @param {number} theta1
 * @param {'cw'|'ccw'|'shortest'} turn
 * @param {number} [minAzimuth]
 * @param {number} [maxAzimuth]
 * @returns {number} Signed radians; positive turns counter-clockwise seen from above
 */
export function turn_delta( theta0, theta1, turn, minAzimuth = -Infinity, maxAzimuth = Infinity ) {
	const limited = isFinite( minAzimuth ) && isFinite( maxAzimuth ) && ( maxAzimuth - minAzimuth ) < TWO_PI - 1e-6;
	if ( limited ) {
		const into = ( theta ) => {
			let a = theta;
			while ( a < minAzimuth ) a += TWO_PI;
			while ( a >= minAzimuth + TWO_PI ) a -= TWO_PI;
			return a;
		};
		return into( theta1 ) - into( theta0 );
	}
	let delta = theta1 - theta0;
	while ( delta > Math.PI ) delta -= TWO_PI;
	while ( delta < -Math.PI ) delta += TWO_PI;
	if ( turn === 'cw' && delta > 0 ) delta -= TWO_PI;
	if ( turn === 'ccw' && delta < 0 ) delta += TWO_PI;
	return delta;
}

/**
 * Plan an orbiting move from one view to another.
 *
 * Distance changes geometrically rather than linearly, so zooming in by half
 * feels like the same move as zooming out by double.
 *
 * @param {Object} from - { position: THREE.Vector3, target: THREE.Vector3 }
 * @param {Object} to   - { position: THREE.Vector3, target: THREE.Vector3 }
 * @param {Object} [options]
 * @param {'cw'|'ccw'|'shortest'} [options.turn='shortest']
 * @param {number} [options.minAzimuth] - OrbitControls.minAzimuthAngle
 * @param {number} [options.maxAzimuth] - OrbitControls.maxAzimuthAngle
 * @returns {function(number, THREE.Vector3, THREE.Vector3): void}
 *          Writes the camera position and target at progress k (0..1) into
 *          the given vectors. At 1 they are exactly the `to` view.
 */
export function plan_orbit_move( from, to, options = {} ) {
	const startTarget = from.target.clone();
	const endTarget = to.target.clone();
	const endPosition = to.position.clone();
	const a = to_orbit( from.position.clone().sub( startTarget ) );
	const b = to_orbit( endPosition.clone().sub( endTarget ) );
	const dTheta = turn_delta( a.theta, b.theta, options.turn || 'shortest', options.minAzimuth, options.maxAzimuth );
	const ratio = b.radius / a.radius;

	return ( k, outPosition, outTarget ) => {
		if ( k >= 1 ) {
			outPosition.copy( endPosition );
			outTarget.copy( endTarget );
			return;
		}
		outTarget.lerpVectors( startTarget, endTarget, k );
		const radius = a.radius * Math.pow( ratio, k );
		const phi = a.phi + ( b.phi - a.phi ) * k;
		const theta = a.theta + dTheta * k;
		const s = Math.sin( phi );
		outPosition.set(
			radius * s * Math.sin( theta ),
			radius * Math.cos( phi ),
			radius * s * Math.cos( theta )
		).add( outTarget );
	};
}
