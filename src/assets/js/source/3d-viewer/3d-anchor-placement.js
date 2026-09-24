/**
 * Anchor placement: move an object — a whole model or any node in one — onto
 * one or more anchors, usually empties authored in another model.
 *
 * Every placement is a request keyed by whoever made it: a layer or choice's
 * default placement, or a choice's "Attach to anchor" action. For each target
 * the highest-priority request whose anchors can be found wins. With no
 * request left, the target goes back to the parent and local transform it had
 * before it was first moved — always that stored original, never "where it was
 * before the last move", or undoing choices in a different order would drift.
 *
 * With several anchors the target itself goes on the first and copies go on
 * the others. Copies share geometry and materials and read `visible` and
 * `material` live from their source node, so layer visibility and material
 * actions aimed at the source show on every copy.
 *
 * See docs/3d-anchor-placement-spec.md.
 */
import * as THREE from 'three';
import { isModelRoot, isAnchorCopy, isPlacedNode, setPlacedOrigin, setAnchorCopies } from './3d-scene-utils.js';

/**
 * Compare two priorities, as arrays of numbers, lexicographically. A shorter
 * array that is a prefix of the other sorts first.
 *
 * @param {number[]} a
 * @param {number[]} b
 * @returns {number} <0 when a is lower
 */
export function compare_priority( a, b ) {
	const pa = Array.isArray( a ) ? a : [];
	const pb = Array.isArray( b ) ? b : [];
	const len = Math.max( pa.length, pb.length );
	for ( let i = 0; i < len; i++ ) {
		if ( i >= pa.length ) return -1;
		if ( i >= pb.length ) return 1;
		const d = ( Number( pa[ i ] ) || 0 ) - ( Number( pb[ i ] ) || 0 );
		if ( d !== 0 ) return d;
	}
	return 0;
}

/**
 * Read a stored follow flag. Absent means the default: follow rotation is on
 * unless explicitly turned off, follow scale off unless turned on.
 *
 * @param {*} value - bool, or the string/number forms the admin may store
 * @param {boolean} fallback
 * @returns {boolean}
 */
export function read_follow_flag( value, fallback ) {
	if ( value === undefined || value === null || value === '' ) return !! fallback;
	if ( value === true || value === 1 ) return true;
	if ( typeof value === 'string' ) {
		const v = value.trim().toLowerCase();
		return v === '1' || v === 'true' || v === 'on' || v === 'yes';
	}
	return false;
}

/**
 * Normalise a stored anchor list: an array of composite ids, or a single id,
 * or a comma/newline separated string.
 *
 * @param {*} value
 * @returns {string[]}
 */
export function normalize_anchor_ids( value ) {
	let list = value;
	if ( typeof list === 'string' ) list = list.split( /[\n,]+/ );
	if ( ! Array.isArray( list ) ) return [];
	const out = [];
	list.forEach( ( id ) => {
		const s = id == null ? '' : String( id ).trim();
		if ( s && out.indexOf( s ) === -1 ) out.push( s );
	} );
	return out;
}

/**
 * Where a whole model attaches: the origin of its single top-level object.
 *
 * A part exported on its own keeps the location it had in the artist's scene
 * — a table leg modelled at its corner is saved 0.7 up and off to the side.
 * Placing the file's own origin on the anchor would add that offset, so the
 * leg's object origin (at the top of the leg, where the artist put it) is
 * what lands on the anchor instead. With several top-level objects there is
 * no single "object origin", and the file's origin is used.
 *
 * @param {THREE.Object3D} root - A model's scene root
 * @param {string[]} [ignore_names] - Objects to leave out (the hidden-objects list: bounding-box helpers)
 * @returns {{ x: number, y: number, z: number }|null} Point in the root's local space, or null for its origin
 */
export function model_attachment_point( root, ignore_names ) {
	if ( ! root || ! Array.isArray( root.children ) ) return null;
	const ignore = new Set( Array.isArray( ignore_names ) ? ignore_names : [] );
	const candidates = root.children.filter( ( c ) => c && ! c.isLight && ! c.isCamera && ! ignore.has( c.name ) );
	if ( candidates.length !== 1 ) return null;
	const p = candidates[ 0 ].position;
	return { x: p.x, y: p.y, z: p.z };
}

const _identityQuat = new THREE.Quaternion();
const _unitScale = new THREE.Vector3( 1, 1, 1 );

/**
 * The world matrix `node` had as authored: its local transform times its
 * ancestors', walking original parents and original local transforms for
 * anything that has been moved. Moving an ancestor therefore does not change
 * what a later placement treats as the part's own orientation and scale.
 *
 * @param {THREE.Object3D} node
 * @param {Map} originals - node → { parent, position, quaternion, scale }
 * @returns {THREE.Matrix4}
 */
function authored_world_matrix( node, originals ) {
	const locals = [];
	let n = node;
	let guard = 0;
	while ( n && guard++ < 1000 ) {
		const o = originals.get( n );
		if ( o ) {
			locals.push( new THREE.Matrix4().compose( o.position, o.quaternion, o.scale ) );
			n = o.parent;
		} else {
			if ( n.matrixAutoUpdate ) n.updateMatrix();
			locals.push( n.matrix.clone() );
			n = n.parent;
		}
	}
	const m = new THREE.Matrix4();
	for ( let i = locals.length - 1; i >= 0; i-- ) m.multiply( locals[ i ] );
	return m;
}

/**
 * An anchor with a zero scale on any axis has no inverse, so nothing can be
 * expressed in its space.
 */
function is_usable_anchor( anchor ) {
	anchor.updateWorldMatrix( true, false );
	return Math.abs( anchor.matrixWorld.determinant() ) >= 1e-12;
}

/**
 * Parent `obj` to `anchor` with the local transform that puts its attachment
 * point at the anchor's position, plus the anchor's rotation and/or scale if
 * followed, on top of the object's authored orientation and scale.
 *
 * @param {THREE.Vector3|null} pivot - Attachment point in obj's local space; null for its origin
 */
function place_under_anchor( obj, anchor, authored, follow_rotation, follow_scale, pivot ) {
	anchor.updateWorldMatrix( true, false );
	const A = anchor.matrixWorld;
	const pA = new THREE.Vector3();
	const qA = new THREE.Quaternion();
	const sA = new THREE.Vector3();
	A.decompose( pA, qA, sA );
	const A_follow = new THREE.Matrix4().compose(
		pA,
		follow_rotation ? qA : _identityQuat,
		follow_scale ? sA : _unitScale
	);
	const P = authored.clone().setPosition( 0, 0, 0 );
	const desired = A_follow.multiply( P );
	if ( pivot ) {
		// Shift so the pivot, not obj's origin, lands on the anchor.
		const offset = pivot.clone().applyMatrix4( desired.clone().setPosition( 0, 0, 0 ) );
		desired.setPosition( pA.clone().sub( offset ) );
	}
	const local = A.clone().invert().multiply( desired );
	anchor.add( obj );
	local.decompose( obj.position, obj.quaternion, obj.scale );
	obj.updateMatrixWorld( true );
}

/**
 * Make `copy` read `visible` (and `material`, for drawables) from `source`, so
 * whatever hides or recolours the source shows on the copy too.
 */
function mirror_source( copy, source ) {
	Object.defineProperty( copy, 'visible', {
		configurable: true,
		enumerable: true,
		get: () => source.visible,
		set: () => {},
	} );
	if ( copy.isMesh || copy.isLine || copy.isPoints || copy.isSprite ) {
		Object.defineProperty( copy, 'material', {
			configurable: true,
			enumerable: true,
			get: () => source.material,
			set: () => {},
		} );
	}
}

/**
 * Subtrees that belong to something else and are not copied along: other
 * models mounted on this one's anchors, copies, and nodes moved in from
 * elsewhere (each of those is placed by its own request).
 */
function is_foreign_child( child ) {
	return isModelRoot( child ) || isAnchorCopy( child ) || isPlacedNode( child );
}

/**
 * Copy `node` and its own descendants, sharing geometry and materials.
 *
 * Object3D.clone deep-copies userData through JSON, which would serialise any
 * material or texture parked there (the action handlers' restore records do
 * exactly that). userData is detached for the clone and copied shallowly.
 *
 * @param {THREE.Object3D} node
 * @param {Map} counterparts - filled with source node → [copy nodes]
 * @returns {THREE.Object3D}
 */
function clone_for_anchor( node, counterparts ) {
	const user_data = node.userData;
	node.userData = {};
	let copy;
	try {
		copy = node.clone( false );
	} finally {
		node.userData = user_data;
	}
	copy.userData = Object.assign( {}, user_data );
	// A copy is not a model: composite lookups must never resolve to it.
	delete copy.userData.object_id;
	delete copy.userData.attachment_id;
	mirror_source( copy, node );
	let list = counterparts.get( node );
	if ( ! list ) {
		list = [];
		counterparts.set( node, list );
	}
	list.push( copy );
	node.children.forEach( ( child ) => {
		if ( is_foreign_child( child ) ) return;
		copy.add( clone_for_anchor( child, counterparts ) );
	} );
	return copy;
}

function has_skinned_mesh( node ) {
	let found = false;
	node.traverse( ( n ) => {
		if ( n.isSkinnedMesh ) found = true;
	} );
	return found;
}

function is_inside( node, ancestor ) {
	let n = node;
	while ( n ) {
		if ( n === ancestor ) return true;
		n = n.parent;
	}
	return false;
}

/**
 * @param {Object} options
 * @param {function(string): (THREE.Object3D|null)} options.resolve_object - composite id → object
 * @param {function(string): (THREE.Object3D|null)} [options.resolve_model] - objects3d id → model root
 * @param {function(string): boolean} [options.is_source_settled] - whether the model behind a
 *   composite id has finished loading (or failed), so a missing node is really missing
 * @param {function(string): Promise} [options.ensure_loaded] - load the model behind a composite id
 * @param {function(Object)} [options.on_change] - { target, anchors, copies } after each move or revert
 * @param {function()} [options.on_settled] - once per refresh that moved anything
 * @param {function(): THREE.Object3D} [options.get_parking_parent] - hidden group that parked
 *   objects are moved into; it should sit inside the searched scene so lookups still find them
 * @param {function(string)} [options.warn]
 */
export function create_anchor_placement( options = {} ) {
	const resolve_object = options.resolve_object || ( () => null );
	const resolve_model = options.resolve_model || ( () => null );
	const is_source_settled = options.is_source_settled || ( () => true );
	const ensure_loaded = options.ensure_loaded || null;
	const on_change = options.on_change || null;
	const on_settled = options.on_settled || null;
	let fallback_parking = null;
	const get_parking_parent = options.get_parking_parent || ( () => {
		if ( ! fallback_parking ) {
			fallback_parking = new THREE.Group();
			fallback_parking.name = '__pc_parked';
			fallback_parking.visible = false;
		}
		return fallback_parking;
	} );
	// eslint-disable-next-line no-console
	const warn = options.warn || ( ( message ) => console.warn( message ) );

	const requests = new Map(); // key → normalised request
	const applied = new Map(); // target → { key, anchors, copies, follow_rotation, follow_scale }
	const originals = new Map(); // target → { parent, position, quaternion, scale }
	const warned = new Set();
	const loading = new Set();
	let refreshing = false;
	let refresh_again = false;

	function warn_once( key, message ) {
		if ( warned.has( key ) ) return;
		warned.add( key );
		warn( '3D viewer: ' + message );
	}

	function normalise( key, spec ) {
		return {
			key,
			target_object: spec.target_object || null,
			target_id: spec.target_id ? String( spec.target_id ).trim() : '',
			target_object3d_id: spec.target_object3d_id != null ? String( spec.target_object3d_id ).trim() : '',
			anchor_ids: normalize_anchor_ids( spec.anchor_ids ),
			follow_rotation: spec.follow_rotation !== false,
			follow_scale: spec.follow_scale === true,
			priority: Array.isArray( spec.priority ) ? spec.priority.slice() : [],
			hide_if_unplaced: spec.hide_if_unplaced === true,
		};
	}

	function resolve_target( req ) {
		if ( req.target_object ) return req.target_object;
		if ( req.target_id ) return resolve_object( req.target_id ) || null;
		if ( req.target_object3d_id ) return resolve_model( req.target_object3d_id ) || null;
		return null;
	}

	function load_then_refresh( id ) {
		if ( ! ensure_loaded || loading.has( id ) ) return;
		loading.add( id );
		Promise.resolve( ensure_loaded( id ) ).then(
			() => {
				loading.delete( id );
				refresh();
			},
			() => {
				loading.delete( id );
				refresh();
			}
		);
	}

	/**
	 * @returns {{ anchors: THREE.Object3D[], waiting: boolean }}
	 */
	function resolve_anchors( req, target ) {
		const anchors = [];
		let waiting = false;
		req.anchor_ids.forEach( ( id ) => {
			const anchor = resolve_object( id );
			if ( ! anchor ) {
				if ( ! is_source_settled( id ) ) {
					waiting = true;
					load_then_refresh( id );
				} else {
					warn_once( req.key + '|' + id, 'anchor "' + id + '" was not found. The object may have been renamed or removed since it was selected.' );
				}
				return;
			}
			if ( is_inside( anchor, target ) ) {
				warn_once( req.key + '|cycle|' + id, 'anchor "' + id + '" is inside the object being placed on it, so it is ignored.' );
				return;
			}
			if ( anchors.indexOf( anchor ) === -1 ) anchors.push( anchor );
		} );
		return { anchors, waiting };
	}

	function same_placement( state, req, anchors ) {
		if ( ! state ) return false;
		if ( state.key !== req.key ) return false;
		if ( state.follow_rotation !== req.follow_rotation || state.follow_scale !== req.follow_scale ) return false;
		if ( state.anchors.length !== anchors.length ) return false;
		return state.anchors.every( ( a, i ) => a === anchors[ i ] );
	}

	function revert( target ) {
		const state = applied.get( target );
		if ( state ) {
			state.copies.forEach( ( c ) => {
				if ( c.parent ) c.parent.remove( c );
			} );
			setAnchorCopies( target, [] );
		}
		const o = originals.get( target );
		if ( o ) {
			if ( o.parent ) o.parent.add( target );
			else if ( target.parent ) target.parent.remove( target );
			target.position.copy( o.position );
			target.quaternion.copy( o.quaternion );
			target.scale.copy( o.scale );
			target.updateMatrixWorld( true );
		}
		setPlacedOrigin( target, null );
		originals.delete( target );
		applied.delete( target );
		if ( state && on_change ) on_change( { target, anchors: [], copies: [] } );
		return !! state;
	}

	function capture_original( target ) {
		if ( originals.has( target ) ) return;
		const point = isModelRoot( target ) && target.userData ? target.userData.pc_attach_point : null;
		originals.set( target, {
			parent: target.parent,
			position: target.position.clone(),
			quaternion: target.quaternion.clone(),
			scale: target.scale.clone(),
			// Measured before anything inside the model moves away.
			pivot: point ? new THREE.Vector3( point.x, point.y, point.z ) : null,
		} );
	}

	function apply( target, req, anchors ) {
		capture_original( target );
		let use = anchors;
		if ( use.length > 1 && has_skinned_mesh( target ) ) {
			warn_once( req.key + '|skinned', 'skinned meshes cannot be copied onto several anchors; only the first anchor is used.' );
			use = use.slice( 0, 1 );
		}
		const authored = authored_world_matrix( target, originals );
		const placed_anchors = [];
		const copies = [];
		const counterparts = new Map();
		use.forEach( ( anchor ) => {
			if ( ! is_usable_anchor( anchor ) ) {
				warn_once( req.key + '|singular|' + anchor.uuid, 'anchor "' + ( anchor.name || anchor.uuid ) + '" has a zero scale and cannot be used.' );
				return;
			}
			const obj = placed_anchors.length === 0 ? target : clone_for_anchor( target, counterparts );
			place_under_anchor( obj, anchor, authored, req.follow_rotation, req.follow_scale, originals.get( target ).pivot );
			placed_anchors.push( anchor );
			if ( obj !== target ) copies.push( obj );
		} );
		if ( ! placed_anchors.length ) {
			if ( req.hide_if_unplaced ) return park( target, req );
			// Every anchor was unusable: leave the target where it was authored.
			revert( target );
			return false;
		}
		setPlacedOrigin( target, origin_model_root_from_original( target ) );
		setAnchorCopies( target, copies, counterparts );
		applied.set( target, {
			key: req.key,
			anchors: placed_anchors,
			copies,
			follow_rotation: req.follow_rotation,
			follow_scale: req.follow_scale,
		} );
		if ( on_change ) on_change( { target, anchors: placed_anchors.slice(), copies: copies.slice() } );
		return true;
	}

	/**
	 * Hide a target that must not show where it was authored — a model on a
	 * layout whose current variant has no usable anchor. It goes into a hidden
	 * group rather than out of the scene, so lookups still find it and a later
	 * variant can place it again. Its own `visible` is left alone: a choice
	 * showing or hiding the model keeps working while it is parked.
	 */
	function park( target, req ) {
		capture_original( target );
		get_parking_parent().add( target );
		setPlacedOrigin( target, origin_model_root_from_original( target ) );
		applied.set( target, {
			key: req.key,
			anchors: [],
			copies: [],
			parked: true,
			follow_rotation: req.follow_rotation,
			follow_scale: req.follow_scale,
		} );
		if ( on_change ) on_change( { target, anchors: [], copies: [], parked: true } );
		return true;
	}

	// The model a node was authored in, found through its original parent.
	function origin_model_root_from_original( target ) {
		const o = originals.get( target );
		if ( ! o || isModelRoot( target ) ) return null;
		let n = o.parent;
		while ( n ) {
			if ( isModelRoot( n ) ) return n;
			const on = originals.get( n );
			n = on ? on.parent : n.parent;
		}
		return null;
	}

	/**
	 * Placed targets with copies that contain `target` as authored. Their
	 * copies were cloned from the source as it was then, so when a part moves
	 * out of the source (or back in) they no longer match it.
	 */
	function copied_ancestors( target ) {
		const out = [];
		const o = originals.get( target );
		let n = o ? o.parent : target.parent;
		let guard = 0;
		while ( n && guard++ < 1000 ) {
			const state = applied.get( n );
			if ( state && state.copies.length ) out.push( n );
			const on = originals.get( n );
			n = on ? on.parent : n.parent;
		}
		return out;
	}

	function run_refresh() {
		let changed = false;
		const moved = new Set();
		// Group requests by the object they move.
		const by_target = new Map();
		requests.forEach( ( req ) => {
			const target = resolve_target( req );
			if ( ! target ) return;
			let list = by_target.get( target );
			if ( ! list ) {
				list = [];
				by_target.set( target, list );
			}
			list.push( req );
		} );

		// Targets placed earlier whose requests are all gone.
		Array.from( applied.keys() ).forEach( ( target ) => {
			if ( ! by_target.has( target ) && revert( target ) ) {
				changed = true;
				moved.add( target );
			}
		} );

		by_target.forEach( ( list, target ) => {
			list.sort( ( a, b ) => compare_priority( b.priority, a.priority ) );
			let chosen = null;
			let chosen_anchors = null;
			for ( let i = 0; i < list.length; i++ ) {
				const { anchors, waiting } = resolve_anchors( list[ i ], target );
				if ( waiting ) {
					// The winning request is still loading its host: keep whatever
					// is showing until it arrives, rather than flash a fallback.
					return;
				}
				if ( anchors.length ) {
					chosen = list[ i ];
					chosen_anchors = anchors;
					break;
				}
				if ( list[ i ].hide_if_unplaced ) {
					// Nothing to stand on, and not allowed to fall back to where
					// it was modelled: this request wins by hiding the target.
					chosen = list[ i ];
					chosen_anchors = [];
					break;
				}
			}
			const state = applied.get( target );
			if ( ! chosen ) {
				if ( state && revert( target ) ) {
					changed = true;
					moved.add( target );
				}
				return;
			}
			if ( same_placement( state, chosen, chosen_anchors ) ) return;
			if ( state ) revert( target );
			if ( chosen_anchors.length ) apply( target, chosen, chosen_anchors );
			else park( target, chosen );
			changed = true;
			moved.add( target );
		} );

		// Rebuild the copies of any placed model a moved part belongs to, so
		// the copies match the source again (a part that left is gone from them
		// too; a part that came back is in them again).
		const rebuild = new Set();
		moved.forEach( ( target ) => copied_ancestors( target ).forEach( ( a ) => rebuild.add( a ) ) );
		rebuild.forEach( ( target ) => {
			if ( moved.has( target ) ) return;
			const state = applied.get( target );
			const req = state && requests.get( state.key );
			if ( ! state || ! req || ! state.copies.length ) return;
			const anchors = state.anchors.slice();
			revert( target );
			apply( target, req, anchors );
		} );
		return changed;
	}

	function refresh() {
		// A move can fire callbacks that request more moves; run those after.
		if ( refreshing ) {
			refresh_again = true;
			return;
		}
		refreshing = true;
		let changed = false;
		try {
			let passes = 0;
			do {
				refresh_again = false;
				changed = run_refresh() || changed;
			} while ( refresh_again && ++passes < 10 );
		} finally {
			refreshing = false;
		}
		if ( changed && on_settled ) on_settled();
	}

	return {
		/**
		 * Add or replace a placement request.
		 *
		 * @param {string} key - Unique per requester, e.g. "choice:12:34:0"
		 * @param {Object} spec
		 * @param {THREE.Object3D} [spec.target_object] - The object to move, or:
		 * @param {string} [spec.target_id] - its composite id, or:
		 * @param {string} [spec.target_object3d_id] - an objects3d id (the whole model)
		 * @param {string[]} spec.anchor_ids - Composite ids
		 * @param {boolean} [spec.follow_rotation=true]
		 * @param {boolean} [spec.follow_scale=false]
		 * @param {number[]} [spec.priority]
		 * @param {boolean} [spec.hide_if_unplaced=false] - with no usable anchor, hide the
		 *   target instead of letting a lower request or the authored position show
		 */
		request( key, spec ) {
			if ( ! key || ! spec ) return;
			const req = normalise( String( key ), spec );
			if ( ! req.anchor_ids.length && ! req.hide_if_unplaced ) {
				this.release( key );
				return;
			}
			requests.set( req.key, req );
			refresh();
		},
		release( key ) {
			if ( requests.delete( String( key ) ) ) refresh();
		},
		refresh,
		/** Put every placed object back and forget all requests. */
		reset() {
			requests.clear();
			Array.from( applied.keys() ).forEach( ( target ) => revert( target ) );
			originals.clear();
			warned.clear();
		},
		/** @returns {THREE.Object3D[]} The anchors an object currently sits on, or [] */
		get_anchors( target ) {
			const state = applied.get( target );
			return state ? state.anchors.slice() : [];
		},
		/** @returns {boolean} Whether an object is currently parked (hidden for lack of anchors) */
		is_parked( target ) {
			const state = applied.get( target );
			return !! ( state && state.parked );
		},
		/** @returns {boolean} */
		has_requests() {
			return requests.size > 0;
		},
	};
}
