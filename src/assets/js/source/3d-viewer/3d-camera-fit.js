/**
 * Fit an angle's target in view, whatever the shape of the canvas.
 *
 * An angle stores an absolute camera position, picked by eye in the admin
 * preview. The distance in it only suits canvases shaped like that preview: the
 * vertical field of view is fixed, so a narrower canvas sees less horizontally
 * and crops the product. Fitting keeps the direction the merchant chose and
 * works out the distance for the canvas actually on screen.
 *
 * Centring is done with a lens shift (see framing_shift_to_pixels), not by
 * moving the camera. Perspective makes the near end of the product look bigger,
 * so the centre of its bounding box does not land in the middle of what the
 * customer sees; the shift centres the outline instead. Moving the camera
 * sideways would do the same, but it also moves the orbit pivot off the
 * product's centre, and orbiting around an off-centre point feels wrong.
 *
 * The shift is worked out once, for the angle's own direction, and is not
 * recomputed while the customer orbits. The product then turns around one fixed
 * point on screen. Recomputing it per frame was tried and rejected: it keeps the
 * product centred from every side, but the pivot drifts on screen while
 * dragging, and that reads as the model sliding.
 */
import * as THREE from 'three';
import { findObject, findObjectByCompositeId } from './3d-scene-utils.js';

/** Upper bound on the vertices sampled per fit; plenty for an outline. */
export const FIT_POINT_BUDGET = 6000;

/** Margin used when an angle sets none, as a fraction of the half-frame. */
export const DEFAULT_FIT_MARGIN = 0.05;

/**
 * Whether an angle asks for its target to be fitted in view. On unless the
 * merchant chose the fixed camera position, so angles saved before the setting
 * existed are fitted too.
 *
 * @param {Backbone.Model|Object} angle
 * @returns {boolean}
 */
export function angle_fits_target( angle ) {
	const value = angle && ( typeof angle.get === 'function' ? angle.get( 'camera_framing' ) : angle.camera_framing );
	return value !== 'fixed';
}

/**
 * The angle's margin as a fraction of the half-frame, from the percentage the
 * merchant entered. Empty or invalid falls back to the default.
 *
 * @param {Backbone.Model|Object} angle
 * @returns {number}
 */
export function angle_fit_margin( angle ) {
	const raw = angle && ( typeof angle.get === 'function' ? angle.get( 'camera_fit_margin' ) : angle.camera_fit_margin );
	if ( raw === '' || raw == null ) return DEFAULT_FIT_MARGIN;
	const pct = parseFloat( raw );
	if ( ! isFinite( pct ) ) return DEFAULT_FIT_MARGIN;
	return Math.max( 0, Math.min( 45, pct ) ) / 100;
}

/**
 * The largest the angle's target may be drawn, in CSS pixels; 0 for no cap.
 *
 * The margin is relative to the canvas, so on a large screen it alone would
 * blow the product up to fill it. The caps stop the fit growing the product
 * past this size; the canvas then just shows more space around it.
 *
 * @param {Backbone.Model|Object} angle
 * @returns {{ width: number, height: number }}
 */
export function angle_fit_max_size( angle ) {
	const read = ( key ) => {
		const raw = angle && ( typeof angle.get === 'function' ? angle.get( key ) : angle[ key ] );
		const px = parseFloat( raw );
		return isFinite( px ) && px > 0 ? px : 0;
	};
	return { width: read( 'camera_fit_max_width' ), height: read( 'camera_fit_max_height' ) };
}

/**
 * The objects an angle frames: its focus objects, else its camera target
 * object, else the whole model.
 *
 * @param {THREE.Object3D} root - Scene root holding the models
 * @param {Backbone.Model} angle
 * @returns {THREE.Object3D[]}
 */
export function angle_fit_objects( root, angle ) {
	if ( ! root || ! angle ) return [];
	const focusIds = angle.get( 'camera_focus_object_ids' );
	if ( Array.isArray( focusIds ) && focusIds.length ) {
		const objects = [];
		focusIds.forEach( ( id ) => {
			if ( id == null || String( id ).trim() === '' ) return;
			const obj = findObjectByCompositeId( root, String( id ).trim() );
			if ( obj ) objects.push( obj );
		} );
		if ( objects.length ) return objects;
	}
	const targetObjectId = angle.get( 'camera_target_object_id' );
	if ( targetObjectId ) {
		const obj = findObject( root, String( targetObjectId ).trim() );
		if ( obj ) return [ obj ];
	}
	return [ root ];
}

/**
 * Camera pose that fits an angle's target in an output of the given aspect.
 *
 * Keeps the direction the merchant set (their camera position looking at the
 * target) and replaces only the distance, plus a lens shift that centres the
 * outline. Shared by the frontend viewer and the admin preview, so what the
 * merchant frames is what the customer gets.
 *
 * @param {Object} args
 * @param {Backbone.Model} args.angle
 * @param {THREE.Object3D} args.root              - Scene root holding the models
 * @param {THREE.PerspectiveCamera} args.camera   - Supplies fov and up
 * @param {THREE.Vector3|null} args.from          - The angle's camera position; the camera's own when unset
 * @param {THREE.Vector3} args.target             - Resolved orbit target
 * @param {number} args.aspect
 * @param {{width: number, height: number}} [args.size] - Output size in CSS pixels, which the
 *        angle's maximum size is measured against. Left out, the maximum does not apply: a
 *        capture fills its own image rather than copying the on-screen cap.
 * @param {{min: number, max: number}} [args.distanceLimits] - The orbit's zoom limits, which
 *        win over the fit
 * @returns {{ position: THREE.Vector3, target: THREE.Vector3, shift: {x: number, y: number} }|null}
 *          null when the angle does not fit, or there is nothing to fit
 */
export function fit_angle_camera( { angle, root, camera, from, target, aspect, size, distanceLimits } ) {
	if ( ! root || ! camera || ! camera.isPerspectiveCamera || ! target || ! angle_fits_target( angle ) ) return null;
	const direction = target.clone().sub( from || camera.position );
	if ( direction.lengthSq() < 1e-12 ) return null;
	direction.normalize();
	const max = angle_fit_max_size( angle );
	const fit = fit_points_in_view( collect_fit_points( angle_fit_objects( root, angle ) ), {
		pivot: target,
		direction,
		up: camera.up,
		fov: camera.fov,
		aspect,
		margin: angle_fit_margin( angle ),
		maxWidth: max.width && size && size.width > 0 ? max.width / size.width : null,
		maxHeight: max.height && size && size.height > 0 ? max.height / size.height : null,
		minDistance: distanceLimits ? distanceLimits.min : 0,
		maxDistance: distanceLimits ? distanceLimits.max : Infinity,
	} );
	if ( ! fit ) return null;
	return {
		position: target.clone().addScaledVector( direction, -fit.distance ),
		target: target.clone(),
		shift: fit.shift,
	};
}

const isEffectivelyVisible = ( obj ) => {
	for ( let node = obj; node; node = node.parent ) {
		if ( node.visible === false ) return false;
	}
	return true;
};

/**
 * Sample the world-space vertices of the visible meshes under `roots`.
 *
 * Vertices rather than bounding-box corners: the corners of a box sit in empty
 * space around a rounded product, and fitting to them leaves a visibly larger
 * margin than the one set, differently on every angle. Striding keeps the cost
 * flat on heavy models; the margin absorbs the few extremes a stride can skip.
 *
 * getVertexPosition applies morph targets and skinning, so a posed or animated
 * mesh is fitted as it is drawn.
 *
 * @param {THREE.Object3D[]} roots
 * @param {number} [budget]
 * @returns {Float32Array} xyz triplets, possibly empty
 */
export function collect_fit_points( roots, budget = FIT_POINT_BUDGET ) {
	const meshes = [];
	let total = 0;
	const seen = new Set();
	( roots || [] ).forEach( ( root ) => {
		if ( ! root ) return;
		root.updateWorldMatrix( true, true );
		root.traverse( ( obj ) => {
			if ( seen.has( obj ) ) return;
			seen.add( obj );
			if ( ! obj.isMesh || ! obj.geometry || ! obj.geometry.attributes || ! obj.geometry.attributes.position ) return;
			if ( ! isEffectivelyVisible( obj ) ) return;
			meshes.push( obj );
			total += obj.geometry.attributes.position.count * ( obj.isInstancedMesh ? obj.count : 1 );
		} );
	} );
	if ( ! total ) return new Float32Array( 0 );

	const stride = Math.max( 1, Math.ceil( total / budget ) );
	const out = [];
	const v = new THREE.Vector3();
	const instanceMatrix = new THREE.Matrix4();
	const world = new THREE.Matrix4();
	meshes.forEach( ( mesh ) => {
		const count = mesh.geometry.attributes.position.count;
		const instances = mesh.isInstancedMesh ? mesh.count : 1;
		for ( let k = 0; k < instances; k++ ) {
			if ( mesh.isInstancedMesh ) {
				mesh.getMatrixAt( k, instanceMatrix );
				world.multiplyMatrices( mesh.matrixWorld, instanceMatrix );
			} else {
				world.copy( mesh.matrixWorld );
			}
			for ( let i = 0; i < count; i += stride ) {
				mesh.getVertexPosition( i, v ).applyMatrix4( world );
				out.push( v.x, v.y, v.z );
			}
		}
	} );
	return new Float32Array( out );
}

/**
 * Distance and lens shift that fit `points` in view, looking along `direction`
 * at `pivot`.
 *
 * The distance is the smallest one at which the outline fits both ways inside
 * the frame less the margin; the shift then centres the outline. Both are
 * exact for the given points rather than estimated from a sphere or a box.
 *
 * @param {Float32Array} points - World-space xyz triplets
 * @param {Object} view
 * @param {THREE.Vector3} view.pivot     - Orbit target the camera looks at
 * @param {THREE.Vector3} view.direction - From the camera towards the pivot
 * @param {THREE.Vector3} [view.up]      - Camera up; world up by default
 * @param {number} view.fov              - Vertical field of view, in degrees
 * @param {number} view.aspect           - Width / height of the output
 * @param {number} [view.margin]         - Fraction of the half-frame kept clear on each side
 * @param {number} [view.maxWidth]       - Widest the outline may be, as a fraction of the
 *        frame width. Applies only where it is tighter than the margin.
 * @param {number} [view.maxHeight]      - Same, for the height
 * @param {number} [view.minDistance]    - Zoom limits the distance is clamped to
 * @param {number} [view.maxDistance]
 * @returns {{ distance: number, shift: { x: number, y: number } }|null}
 *          shift is in tangent units along the camera's right and up axes
 *          (see framing_shift_to_pixels); null when there is nothing to fit.
 */
export function fit_points_in_view( points, view ) {
	if ( ! points || points.length < 3 || ! view || ! view.pivot || ! view.direction ) return null;
	const fov = view.fov;
	const aspect = view.aspect;
	if ( ! ( fov > 0 && fov < 180 ) || ! ( aspect > 0 ) ) return null;
	const margin = Math.max( 0, Math.min( 0.9, view.margin != null ? view.margin : DEFAULT_FIT_MARGIN ) );

	const dir = view.direction.clone().normalize();
	if ( dir.lengthSq() === 0 ) return null;
	const up = ( view.up || new THREE.Vector3( 0, 1, 0 ) ).clone();
	const right = new THREE.Vector3().crossVectors( dir, up );
	// Looking straight along up: any sideways axis will do, as lookAt picks one too.
	if ( right.lengthSq() < 1e-10 ) right.crossVectors( dir, new THREE.Vector3( 0, 0, -1 ) );
	right.normalize();
	const camUp = new THREE.Vector3().crossVectors( right, dir ).normalize();

	// Each point relative to the pivot, in camera axes: across, up, and depth.
	const n = points.length / 3;
	const across = new Float64Array( n );
	const high = new Float64Array( n );
	const depth = new Float64Array( n );
	let nearest = -Infinity;
	let extent = 0;
	for ( let i = 0; i < n; i++ ) {
		const x = points[ i * 3 ] - view.pivot.x;
		const y = points[ i * 3 + 1 ] - view.pivot.y;
		const z = points[ i * 3 + 2 ] - view.pivot.z;
		across[ i ] = x * right.x + y * right.y + z * right.z;
		high[ i ] = x * camUp.x + y * camUp.y + z * camUp.z;
		depth[ i ] = x * dir.x + y * dir.y + z * dir.z;
		if ( -depth[ i ] > nearest ) nearest = -depth[ i ];
		extent = Math.max( extent, Math.abs( x ), Math.abs( y ), Math.abs( z ) );
	}
	if ( ! ( extent > 0 ) ) return null;

	// Share of the frame the outline may fill on each axis: the margin, or the
	// maximum size where that is tighter.
	const share = ( max ) => ( max > 0 ? Math.min( 1 - margin, max ) : 1 - margin );
	const tanV = Math.tan( ( fov * Math.PI ) / 360 ) * share( view.maxHeight );
	const tanH = Math.tan( ( fov * Math.PI ) / 360 ) * aspect * share( view.maxWidth );

	// Outline of the points, in tangent units, with the camera `d` from the pivot.
	const outline = ( d ) => {
		let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
		for ( let i = 0; i < n; i++ ) {
			const z = depth[ i ] + d;
			const x = across[ i ] / z;
			const y = high[ i ] / z;
			if ( x < x0 ) x0 = x;
			if ( x > x1 ) x1 = x;
			if ( y < y0 ) y0 = y;
			if ( y > y1 ) y1 = y;
		}
		return { x0, x1, y0, y1 };
	};
	const fits = ( d ) => {
		const o = outline( d );
		return ( o.x1 - o.x0 ) <= 2 * tanH && ( o.y1 - o.y0 ) <= 2 * tanV;
	};

	// Every point has to stay in front of the camera, so the search starts just
	// past the nearest one. The outline shrinks as the camera backs away.
	let lo = Math.max( 0, nearest ) + extent * 1e-4;
	let hi = Math.max( lo * 2, extent * 2 );
	for ( let i = 0; i < 60 && ! fits( hi ); i++ ) hi *= 2;
	if ( ! fits( hi ) ) return null;
	for ( let i = 0; i < 40; i++ ) {
		const mid = ( lo + hi ) / 2;
		if ( fits( mid ) ) hi = mid;
		else lo = mid;
	}

	// Zoom limits win over the fit. Clamping here rather than leaving it to
	// OrbitControls keeps the centring shift true to where the camera ends up.
	const minDistance = view.minDistance > 0 ? view.minDistance : 0;
	const maxDistance = view.maxDistance > 0 ? view.maxDistance : Infinity;
	hi = Math.min( Math.max( hi, minDistance, lo ), maxDistance );
	// A limit that puts the camera inside the target leaves nothing to centre.
	if ( hi <= nearest ) return null;

	const o = outline( hi );
	return {
		distance: hi,
		shift: { x: ( o.x0 + o.x1 ) / 2, y: ( o.y0 + o.y1 ) / 2 },
	};
}

/**
 * Convert a lens shift in tangent units into setViewOffset pixels.
 *
 * Tangent units are independent of the canvas shape, which is what lets the
 * same shift serve the canvas, a resize and a capture at another size.
 * Positive x and y move the view window right and up, so the product moves
 * left and down; setViewOffset measures y downwards, hence the sign flip.
 *
 * @param {{x: number, y: number}|null} shift
 * @param {number} fov    - Vertical field of view, in degrees
 * @param {number} width  - Output width, in the units setViewOffset is given
 * @param {number} height - Output height, same units
 * @returns {{x: number, y: number}}
 */
export function framing_shift_to_pixels( shift, fov, width, height ) {
	if ( ! shift || ( ! shift.x && ! shift.y ) || ! ( fov > 0 ) || ! ( width > 0 ) || ! ( height > 0 ) ) {
		return { x: 0, y: 0 };
	}
	const tanV = Math.tan( ( fov * Math.PI ) / 360 );
	const tanH = tanV * ( width / height );
	return {
		x: ( shift.x / tanH ) * ( width / 2 ),
		y: -( shift.y / tanV ) * ( height / 2 ),
	};
}
