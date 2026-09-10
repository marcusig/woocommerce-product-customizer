/**
 * Orbit affordance for the 3D viewer (no Three.js).
 *
 * A still render and a model that turns look identical until something moves,
 * so a shopper who never drags never finds out the product is interactive at
 * all. This is the answer: a frosted puck over the canvas showing a pointer
 * riding an orbit ring, put up once the model is on screen and taken away the
 * moment the customer touches it.
 *
 * The whole thing is `pointer-events: none` — the drag that dismisses the hint
 * has to be the same drag that orbits the model, or the affordance swallows the
 * very interaction it is asking for.
 *
 * DOM only, like loading-overlay.js: nothing here needs the scene, so it costs
 * no frames from the on-demand render loop.
 */

import { get_loading_string } from './loading-overlay.js';
import SVG_ICONS from '../generated/svg-icons.js';

/**
 * Remembers, for this tab only, that the customer has orbited something.
 *
 * Per session rather than persisted: the gesture is worth teaching once a
 * visit, and a shopper comparing five products should not be told five times.
 */
const SESSION_KEY = 'mkl_pc_3d_orbit_hint_done';

/**
 * Icon key in the generated frontend icon module, for each half of the mark.
 *
 * The art lives in src/assets/icons/frontend/orbit-hint/ as ordinary SVG files
 * — see the README there before editing one. Nothing in this module depends on
 * anything inside those files beyond `currentColor` and the viewBox aspect, so
 * an editor that rewrites the markup does no harm.
 */
const RING_ICON = 'orbit-hint/ring';
const POINTER_ICONS = {
	mouse: 'orbit-hint/pointer-mouse',
	touch: 'orbit-hint/pointer-touch',
};

/**
 * SVG markup for one icon key, or an empty string when the generated module has
 * no such icon — a renamed file, or a build that has not been regenerated yet.
 * A hint missing its art is worth shipping; a thrown error over the product is
 * not.
 *
 * @param {string} key
 * @returns {string}
 */
function get_icon( key ) {
	const markup = SVG_ICONS && SVG_ICONS[ key ];
	if ( typeof markup !== 'string' ) {
		// eslint-disable-next-line no-console
		console.warn( '3D viewer: missing SVG icon "' + key + '". Run npm run build:svg-icons.' );
		return '';
	}
	return markup;
}

/**
 * Whether the visitor is pointing with something precise (a mouse or trackpad)
 * rather than a finger. Decides which glyph and which verb the hint uses.
 *
 * @returns {boolean}
 */
export function has_fine_pointer() {
	if ( typeof window === 'undefined' || typeof window.matchMedia !== 'function' ) {
		return true;
	}
	return window.matchMedia( '(hover: hover) and (pointer: fine)' ).matches;
}

/**
 * Has the customer already been shown — and acted on — the hint this session?
 *
 * @returns {boolean}
 */
export function orbit_hint_done() {
	try {
		return window.sessionStorage.getItem( SESSION_KEY ) === '1';
	} catch ( err ) {
		// Safari in private mode throws on the property itself. Not being able
		// to tell means showing the hint, which is the harmless way to be wrong.
		return false;
	}
}

/** Remember that the customer knows the gesture. */
export function mark_orbit_hint_done() {
	try {
		window.sessionStorage.setItem( SESSION_KEY, '1' );
	} catch ( err ) {
		// Storage disabled or full. The hint reappearing next page is the cost.
	}
}

/**
 * Build the orbit hint DOM.
 *
 * @param {Object}  [options]
 * @param {string}  [options.text]  - Override the label.
 * @param {boolean} [options.touch] - Force the touch or the pointer variant.
 * @returns {HTMLElement}
 */
export function create_orbit_hint( options ) {
	const options_object = options || {};
	const touch = options_object.touch != null
		? !! options_object.touch
		: ! has_fine_pointer();
	const label_text = options_object.text || get_loading_string(
		touch ? 'orbit_hint_touch' : 'orbit_hint',
		touch ? 'Swipe to rotate' : 'Drag to rotate'
	);

	const hint = document.createElement( 'div' );
	hint.className = 'mkl_pc_3d_hint' + ( touch ? ' is-touch' : '' );
	// The canvas already carries role="application" and an aria-label saying the
	// arrow keys rotate, so to a screen reader this is decoration that repeats
	// something better said. Sighted-only affordance, hidden from the tree.
	hint.setAttribute( 'aria-hidden', 'true' );

	const puck = document.createElement( 'div' );
	puck.className = 'mkl_pc_3d_hint__puck';

	// Both icons go in a wrapper of their own, which is what the CSS sizes and
	// animates. That keeps every positioning hook out of the SVG files, so they
	// stay plain art anyone can open in a vector editor and save back.
	//
	// innerHTML is safe here: the markup is inlined from the repo's own icon
	// files at build time and never touches the network.
	const ring = document.createElement( 'span' );
	ring.className = 'mkl_pc_3d_hint__orbit';
	ring.innerHTML = get_icon( RING_ICON );
	puck.appendChild( ring );

	const glyph = document.createElement( 'span' );
	glyph.className = 'mkl_pc_3d_hint__glyph';
	glyph.innerHTML = get_icon( touch ? POINTER_ICONS.touch : POINTER_ICONS.mouse );
	puck.appendChild( glyph );

	const label = document.createElement( 'p' );
	label.className = 'mkl_pc_3d_hint__label';
	label.textContent = label_text;

	hint.appendChild( puck );
	hint.appendChild( label );

	return hint;
}

/**
 * Fade the hint out and remove it.
 *
 * @param {HTMLElement|null} hint
 * @param {Function} [on_done]
 */
export function dismiss_orbit_hint( hint, on_done ) {
	if ( ! hint ) {
		if ( typeof on_done === 'function' ) {
			on_done();
		}
		return;
	}

	const finish = () => {
		if ( hint.parentNode ) {
			hint.parentNode.removeChild( hint );
		}
		if ( typeof on_done === 'function' ) {
			on_done();
		}
	};

	const prefers_reduced_motion = typeof window !== 'undefined'
		&& window.matchMedia
		&& window.matchMedia( '(prefers-reduced-motion: reduce)' ).matches;

	if ( prefers_reduced_motion || ! hint.parentNode ) {
		finish();
		return;
	}

	hint.classList.add( 'is-hiding' );
	hint.addEventListener( 'transitionend', finish, { once: true } );
	window.setTimeout( finish, 400 );
}
