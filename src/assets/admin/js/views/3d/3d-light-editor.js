/**
 * Admin 3D preview: light helpers and live light placement.
 *
 * Every objects3d light gets a helper, including the two three.js has none for
 * in the set the preview used to build: AmbientLight, which has no helper at
 * all, and HemisphereLight, whose helper was simply never created. Clicking a
 * helper attaches TransformControls to that light; for a spot or directional
 * light with a free target, a second, smaller handle moves the target.
 *
 * The editor only moves the three.js objects and reports back. Writing the
 * result to the objects3d model is the preview's job, through on_commit.
 *
 * Imported by the preview view once three is loaded; it takes THREE and the
 * addon classes as arguments rather than importing them, so it does not pull
 * three into the eager admin entry.
 */

/** Decimal places kept when a dragged position is written back. */
const POSITION_DECIMALS = 4;

/** Decimal places kept for a rotation, in degrees. */
const ROTATION_DECIMALS = 2;

/** A press that moves further than this, in CSS pixels, is an orbit, not a click. */
const CLICK_TOLERANCE = 4;

/** Helper size as a fraction of the model's bounding-box diagonal. */
const HELPER_SIZE_RATIO = 0.05;

/** Helper size when there is no model to measure: the size the preview always used. */
const DEFAULT_HELPER_SIZE = 0.5;

/**
 * Colour of a hovered light's helper. Light colours are mostly white or warm,
 * so a cool, saturated one reads as "this one" against nearly all of them.
 */
export const HIGHLIGHT_COLOR = 0x00c8ff;

/** Draws a highlighted helper after the model, since it is drawn through it. */
const HIGHLIGHT_RENDER_ORDER = 999;

function round_to( value, decimals ) {
	const f = Math.pow( 10, decimals );
	const r = Math.round( ( Number( value ) || 0 ) * f ) / f;
	// Keep -0 out of saved data: it reads as a change where there is none.
	return r === 0 ? 0 : r;
}

/**
 * A vector as the {x, y, z} the objects3d fields store.
 *
 * @param {{x: number, y: number, z: number}} v
 * @returns {{x: number, y: number, z: number}}
 */
export function vector_to_setting( v ) {
	return {
		x: round_to( v.x, POSITION_DECIMALS ),
		y: round_to( v.y, POSITION_DECIMALS ),
		z: round_to( v.z, POSITION_DECIMALS ),
	};
}

/**
 * An Euler in radians as the degrees rect_rotation stores. The order is the
 * default XYZ, which is what createLightFromSettings reads it back with.
 *
 * @param {{x: number, y: number, z: number}} euler
 * @returns {{x: number, y: number, z: number}}
 */
export function euler_to_setting( euler ) {
	const deg = 180 / Math.PI;
	return {
		x: round_to( euler.x * deg, ROTATION_DECIMALS ),
		y: round_to( euler.y * deg, ROTATION_DECIMALS ),
		z: round_to( euler.z * deg, ROTATION_DECIMALS ),
	};
}

/**
 * Helper size for a model of a given bounding-box diagonal.
 *
 * Helpers used fixed sizes (0.5, 1) that vanish on a model authored in
 * millimetres and swallow one authored at the scale of a ring.
 *
 * @param {number} diagonal - Bounding-box diagonal, 0 when there is no model
 * @returns {number}
 */
export function helper_size_for( diagonal ) {
	return diagonal > 0 ? diagonal * HELPER_SIZE_RATIO : DEFAULT_HELPER_SIZE;
}

/**
 * Which transform modes a handle offers.
 *
 * A rect area light has no target: it points where it is rotated, so it is the
 * only light the rotate mode means anything for.
 *
 * @param {THREE.Light} light
 * @param {string} handle - 'light' or 'target'
 * @returns {string[]}
 */
export function modes_for( light, handle ) {
	if ( handle === 'light' && light && light.isRectAreaLight ) return [ 'translate', 'rotate' ];
	return [ 'translate' ];
}

/**
 * Stand-in helper for an ambient light, which three.js has none for.
 *
 * Its position has no effect on the lighting; the marker is there so the light
 * can be seen and selected at all. Follows the light the same way
 * PointLightHelper does, by sharing its world matrix.
 */
function create_ambient_helper( THREE, light, size ) {
	const geometry = new THREE.WireframeGeometry( new THREE.SphereGeometry( size * 0.5, 8, 4 ) );
	const material = new THREE.LineBasicMaterial( { fog: false, toneMapped: false } );
	const helper = new THREE.LineSegments( geometry, material );
	helper.type = 'AmbientLightHelper';
	helper.matrix = light.matrixWorld;
	helper.matrixAutoUpdate = false;
	helper.update = function () {
		// Honours `color` like three's own light helpers, which is how highlighting works.
		if ( helper.color !== undefined ) material.color.set( helper.color );
		else material.color.copy( light.color );
	};
	helper.dispose = function () {
		geometry.dispose();
		material.dispose();
	};
	helper.update();
	return helper;
}

function create_helper( THREE, RectAreaLightHelper, light, size ) {
	if ( light.isPointLight ) return new THREE.PointLightHelper( light, size * 0.5 );
	if ( light.isDirectionalLight ) return new THREE.DirectionalLightHelper( light, size );
	if ( light.isSpotLight ) return new THREE.SpotLightHelper( light );
	if ( light.isHemisphereLight ) return new THREE.HemisphereLightHelper( light, size * 0.5 );
	if ( light.isRectAreaLight && RectAreaLightHelper ) return new RectAreaLightHelper( light );
	if ( light.isAmbientLight ) return create_ambient_helper( THREE, light, size );
	return null;
}

/**
 * An invisible mesh to click on. Lines are awkward to hit with a raycaster, and
 * the helpers differ in shape, so every handle gets one of these instead - the
 * same approach as the three.js editor.
 */
function create_picker( THREE, light, size ) {
	const material = new THREE.MeshBasicMaterial( { visible: false, side: THREE.DoubleSide } );
	const geometry = light.isRectAreaLight
		? new THREE.PlaneGeometry( Math.max( light.width, size ), Math.max( light.height, size ) )
		: new THREE.SphereGeometry( size * 0.6, 8, 6 );
	const picker = new THREE.Mesh( geometry, material );
	picker.name = '__pc_light_picker';
	return picker;
}

/** Visible marker for a movable target, parented to light.target. */
function create_target_marker( THREE, light, size ) {
	const geometry = new THREE.WireframeGeometry( new THREE.OctahedronGeometry( size * 0.25 ) );
	const material = new THREE.LineBasicMaterial( { color: light.color, fog: false, toneMapped: false } );
	const marker = new THREE.LineSegments( geometry, material );
	marker.name = '__pc_light_target_marker';
	return marker;
}

function dispose_object( obj ) {
	if ( ! obj ) return;
	if ( obj.parent ) obj.parent.remove( obj );
	if ( typeof obj.dispose === 'function' ) {
		obj.dispose();
		return;
	}
	if ( obj.geometry ) obj.geometry.dispose();
	if ( obj.material ) obj.material.dispose();
}

/**
 * @param {Object} opts
 * @param {Object} opts.THREE
 * @param {Function} opts.TransformControls
 * @param {Function} [opts.RectAreaLightHelper]
 * @param {THREE.Scene} opts.scene
 * @param {THREE.Camera} opts.camera
 * @param {HTMLElement} opts.dom - The renderer's canvas
 * @param {Object} opts.orbit - OrbitControls, disabled while a handle is dragged
 * @param {number} opts.size - Helper size, from helper_size_for
 * @param {function(): void} opts.request_render
 * @param {function(Object, string): void} [opts.on_change] - Every step of a drag
 * @param {function(Object, string): void} [opts.on_commit] - Once, when a drag ends
 * @param {function(Object|null, string|null): void} [opts.on_select]
 * @param {function(Object|null): void} [opts.on_hover] - The highlighted light changed
 * @returns {Object} editor
 */
export function create_light_editor( opts ) {
	const { THREE, TransformControls, RectAreaLightHelper, scene, camera, dom, orbit, size } = opts;
	const noop = () => {};
	const request_render = opts.request_render || noop;
	const on_change = opts.on_change || noop;
	const on_commit = opts.on_commit || noop;
	const on_select = opts.on_select || noop;
	const on_hover = opts.on_hover || noop;

	// Every helper lives here, so the whole set can be hidden from passes that
	// render the scene for something other than the picture - the fake shadow
	// renders the full scene from below, and would print the helpers into it.
	const overlay = new THREE.Group();
	overlay.name = '__pc_light_helpers';
	scene.add( overlay );

	const entries = [];
	const pickers = [];
	let selected = null;
	let selected_handle = null;
	let mode = 'translate';
	// Off: nothing drawn, nothing pickable. The preview only edits lights in one
	// settings section.
	let enabled = true;

	const transform = TransformControls ? new TransformControls( camera, dom ) : null;
	const gizmo = transform ? transform.getHelper() : null;
	let dragged = false;

	if ( transform ) {
		transform.setSize( 0.8 );
		scene.add( gizmo );
		transform.addEventListener( 'dragging-changed', ( e ) => {
			if ( orbit ) orbit.enabled = ! e.value;
			if ( e.value ) dragged = true;
		} );
		// Hover highlights and every step of a drag.
		transform.addEventListener( 'change', request_render );
		transform.addEventListener( 'objectChange', () => {
			if ( ! selected ) return;
			sync_entry( selected );
			on_change( selected, selected_handle );
		} );
		transform.addEventListener( 'mouseUp', () => {
			if ( selected ) on_commit( selected, selected_handle );
		} );
	}

	function sync_entry( entry ) {
		entry.light.updateMatrixWorld();
		if ( entry.light.target ) entry.light.target.updateMatrixWorld();
		if ( entry.helper && entry.helper.update ) entry.helper.update();
		if ( entry.target_marker ) {
			if ( entry === highlighted ) entry.target_marker.material.color.set( HIGHLIGHT_COLOR );
			else entry.target_marker.material.color.copy( entry.light.color );
		}
	}

	// -----------------------------------------------------------------
	// Highlight: one light at a time, from hovering its row in the list or
	// its handle in the preview. Drawn in HIGHLIGHT_COLOR and on top of the
	// model, because the lights hardest to find are the ones inside it.
	// -----------------------------------------------------------------

	let highlighted = null;
	let highlight_source = null;

	/** Every material an entry draws with, and the object that carries it. */
	function drawables( entry ) {
		const out = [];
		[ entry.helper, entry.target_marker ].forEach( ( root ) => {
			if ( ! root ) return;
			root.traverse( ( obj ) => {
				if ( obj.material ) out.push( obj );
			} );
		} );
		return out;
	}

	function set_highlighted( entry, on ) {
		const helper = entry.helper;
		if ( helper ) {
			helper.color = on ? HIGHLIGHT_COLOR : undefined;
			// Its octahedron is coloured per vertex (sky and ground), which would
			// tint the highlight rather than show it.
			if ( entry.light.isHemisphereLight && helper.material ) {
				helper.material.vertexColors = ! on;
				if ( ! on ) helper.material.color.set( 0xffffff );
				helper.material.needsUpdate = true;
			}
		}
		drawables( entry ).forEach( ( obj ) => {
			if ( on ) {
				obj.userData.pc_highlight_saved = { depthTest: obj.material.depthTest, renderOrder: obj.renderOrder };
				obj.material.depthTest = false;
				obj.renderOrder = HIGHLIGHT_RENDER_ORDER;
			} else if ( obj.userData.pc_highlight_saved ) {
				obj.material.depthTest = obj.userData.pc_highlight_saved.depthTest;
				obj.renderOrder = obj.userData.pc_highlight_saved.renderOrder;
				delete obj.userData.pc_highlight_saved;
			}
		} );
	}

	/**
	 * @param {Object|null} entry
	 * @param {string} [source] - 'list' or 'canvas'
	 */
	function highlight( entry, source ) {
		if ( entry && ! enabled ) entry = null;
		if ( entry === highlighted ) {
			highlight_source = entry ? source || highlight_source : null;
			return;
		}
		const previous = highlighted;
		highlighted = entry;
		highlight_source = entry ? source || null : null;
		if ( previous ) {
			set_highlighted( previous, false );
			sync_entry( previous );
		}
		if ( entry ) {
			set_highlighted( entry, true );
			sync_entry( entry );
		}
		on_hover( entry );
		request_render();
	}

	function attach( entry, handle ) {
		if ( ! enabled ) return;
		selected = entry;
		selected_handle = handle;
		if ( transform ) {
			const allowed = modes_for( entry.light, handle );
			if ( allowed.indexOf( mode ) === -1 ) mode = allowed[ 0 ];
			transform.setMode( mode );
			transform.attach( handle === 'target' ? entry.light.target : entry.light );
		}
		on_select( entry, handle );
		request_render();
	}

	function detach() {
		if ( ! selected ) return;
		selected = null;
		selected_handle = null;
		if ( transform ) transform.detach();
		on_select( null, null );
		request_render();
	}

	// ---------------------------------------------------------------------
	// Picking: a click (not an orbit) on a handle selects it, on nothing
	// deselects.
	// ---------------------------------------------------------------------

	const raycaster = new THREE.Raycaster();
	const pointer = new THREE.Vector2();
	let press = null;

	function pick( event ) {
		const rect = dom.getBoundingClientRect();
		if ( ! rect.width || ! rect.height ) return null;
		pointer.set(
			( ( event.clientX - rect.left ) / rect.width ) * 2 - 1,
			- ( ( event.clientY - rect.top ) / rect.height ) * 2 + 1
		);
		raycaster.setFromCamera( pointer, camera );
		// World matrices are otherwise only refreshed by a render, and a click can
		// land before the first one after a handle was added or moved.
		pickers.forEach( ( p ) => p.updateWorldMatrix( true, false ) );
		const hits = raycaster.intersectObjects( pickers, false );
		return hits.length ? hits[ 0 ].object.userData.pc_light_handle : null;
	}

	function on_pointer_down( event ) {
		if ( ! enabled || event.button !== 0 ) return;
		press = { x: event.clientX, y: event.clientY };
		dragged = false;
	}

	function on_pointer_up( event ) {
		const start = press;
		press = null;
		if ( ! start || event.button !== 0 ) return;
		if ( dragged ) return;
		if ( Math.hypot( event.clientX - start.x, event.clientY - start.y ) > CLICK_TOLERANCE ) return;
		// A click on the gizmo itself, without moving it. Read before the gizmo's
		// own pointerup clears the axis, which is why this listener captures.
		if ( transform && transform.axis !== null ) return;
		const hit = pick( event );
		if ( hit ) {
			if ( hit.entry !== selected || hit.handle !== selected_handle ) attach( hit.entry, hit.handle );
		} else {
			detach();
		}
	}

	let hovering = false;
	function on_pointer_move( event ) {
		if ( ! enabled || press || ( transform && transform.dragging ) ) return;
		const hit = pick( event );
		const over = !! hit;
		if ( over !== hovering ) {
			hovering = over;
			dom.style.cursor = over ? 'pointer' : '';
		}
		if ( hit ) highlight( hit.entry, 'canvas' );
		// Leave a highlight the list asked for alone: the pointer is not on it.
		else if ( highlight_source === 'canvas' ) highlight( null );
	}

	function on_pointer_leave() {
		if ( highlight_source === 'canvas' ) highlight( null );
		if ( hovering ) {
			hovering = false;
			dom.style.cursor = '';
		}
	}

	function on_key_down( event ) {
		if ( event.key !== 'Escape' || ! selected ) return;
		const tag = event.target && event.target.tagName;
		if ( tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' ) return;
		detach();
	}

	// Capture phase, so these run before the gizmo's listeners on the same
	// canvas: pointerdown has to reset `dragged` before the gizmo can set it, and
	// pointerup has to see the axis before the gizmo resets it.
	dom.addEventListener( 'pointerdown', on_pointer_down, true );
	dom.addEventListener( 'pointerup', on_pointer_up, true );
	dom.addEventListener( 'pointermove', on_pointer_move );
	dom.addEventListener( 'pointerleave', on_pointer_leave );
	document.addEventListener( 'keydown', on_key_down );

	function add_picker( parent, entry, handle, picker ) {
		picker.userData.pc_light_handle = { entry, handle };
		parent.add( picker );
		pickers.push( picker );
		return picker;
	}

	return {
		overlay,

		/**
		 * Add a helper and handles for a light already in the scene.
		 *
		 * @param {THREE.Light} light
		 * @param {Object} meta
		 * @param {Object} [meta.model] - The objects3d model the light came from
		 * @param {boolean} [meta.target_locked] - Target follows an object, so it gets no handle
		 * @returns {Object} entry
		 */
		add( light, meta = {} ) {
			const entry = { light, model: meta.model || null, helper: null, target_marker: null, target_locked: !! meta.target_locked };
			entry.helper = create_helper( THREE, RectAreaLightHelper, light, size );
			if ( entry.helper ) overlay.add( entry.helper );
			add_picker( light, entry, 'light', create_picker( THREE, light, size ) );
			if ( light.target && ! entry.target_locked ) {
				entry.target_marker = create_target_marker( THREE, light, size );
				entry.target_marker.visible = enabled;
				light.target.add( entry.target_marker );
				add_picker( light.target, entry, 'target', new THREE.Mesh(
					new THREE.SphereGeometry( size * 0.4, 8, 6 ),
					new THREE.MeshBasicMaterial( { visible: false } )
				) );
			}
			entries.push( entry );
			return entry;
		},

		get entries() {
			return entries;
		},
		get selected() {
			return selected;
		},
		get selected_handle() {
			return selected_handle;
		},
		get mode() {
			return mode;
		},

		select: attach,
		deselect: detach,

		/**
		 * @param {Object} model - objects3d model
		 * @returns {Object|null} entry
		 */
		find( model ) {
			return entries.find( ( e ) => e.model === model ) || null;
		},

		/**
		 * Re-read a light after something outside the gizmo changed it: a typed
		 * position, a new colour.
		 *
		 * @param {Object} entry
		 */
		sync( entry ) {
			if ( entry ) sync_entry( entry );
			request_render();
		},

		get enabled() {
			return enabled;
		},

		get highlighted() {
			return highlighted;
		},

		/**
		 * Highlight a light from outside the preview (its row in the list is
		 * hovered), or clear it with null.
		 *
		 * @param {Object|null} entry
		 */
		highlight( entry ) {
			highlight( entry, 'list' );
		},

		/**
		 * Show or hide the helpers and handles, and switch picking with them.
		 * Turning off drops the selection, so nothing stays grabbed out of sight.
		 *
		 * @param {boolean} next
		 */
		set_enabled( next ) {
			next = !! next;
			if ( next === enabled ) return;
			if ( ! next ) {
				detach();
				highlight( null );
			}
			enabled = next;
			overlay.visible = next;
			entries.forEach( ( e ) => {
				if ( e.target_marker ) e.target_marker.visible = next;
			} );
			if ( ! next && hovering ) {
				hovering = false;
				dom.style.cursor = '';
			}
			request_render();
		},

		/** @param {string} next - 'translate' or 'rotate' */
		set_mode( next ) {
			if ( ! selected || modes_for( selected.light, selected_handle ).indexOf( next ) === -1 ) return;
			mode = next;
			if ( transform ) transform.setMode( mode );
			request_render();
		},

		/** Per frame, before rendering: helpers read their light's current state. */
		update() {
			entries.forEach( ( entry ) => {
				if ( entry.helper && entry.helper.update ) entry.helper.update();
			} );
		},

		/**
		 * Show or hide everything the editor draws.
		 *
		 * Returns a function that puts the previous state back, because the gizmo
		 * manages its own visibility (hidden while nothing is attached) and must
		 * not be forced visible afterwards.
		 *
		 * @returns {function(): void}
		 */
		hide_temporarily() {
			const markers = entries.map( ( e ) => e.target_marker ).filter( Boolean );
			const previous = {
				overlay: overlay.visible,
				gizmo: gizmo ? gizmo.visible : false,
				markers: markers.map( ( m ) => m.visible ),
			};
			overlay.visible = false;
			if ( gizmo ) gizmo.visible = false;
			markers.forEach( ( m ) => { m.visible = false; } );
			return () => {
				overlay.visible = previous.overlay;
				if ( gizmo ) gizmo.visible = previous.gizmo;
				markers.forEach( ( m, i ) => { m.visible = previous.markers[ i ]; } );
			};
		},

		dispose() {
			dom.removeEventListener( 'pointerdown', on_pointer_down, true );
			dom.removeEventListener( 'pointerup', on_pointer_up, true );
			dom.removeEventListener( 'pointermove', on_pointer_move );
			dom.removeEventListener( 'pointerleave', on_pointer_leave );
			document.removeEventListener( 'keydown', on_key_down );
			if ( hovering ) dom.style.cursor = '';
			if ( transform ) {
				transform.detach();
				transform.dispose();
				if ( gizmo && gizmo.parent ) gizmo.parent.remove( gizmo );
			}
			if ( orbit ) orbit.enabled = true;
			entries.forEach( ( entry ) => {
				dispose_object( entry.helper );
				dispose_object( entry.target_marker );
			} );
			pickers.forEach( dispose_object );
			if ( overlay.parent ) overlay.parent.remove( overlay );
			entries.length = 0;
			pickers.length = 0;
			selected = null;
			selected_handle = null;
		},
	};
}
