/**
 * Shared 3D viewer loading overlay (no Three.js).
 * Used by the lightweight entry chunk and the full main-viewer chunk.
 */

/**
 * Resolve a loading string from PC_config.lang / PC_lang / fallback.
 * @param {string} key
 * @param {string} fallback
 * @returns {string}
 */
export function get_loading_string( key, fallback ) {
	if ( window.PC_config && window.PC_config.lang && window.PC_config.lang[ key ] ) {
		return window.PC_config.lang[ key ];
	}
	if ( typeof window.PC_lang !== 'undefined' && window.PC_lang[ key ] ) {
		return window.PC_lang[ key ];
	}
	return fallback;
}

/**
 * Read poster URL from settings_3d.
 * @param {Object|null} settings
 * @returns {string}
 */
export function get_poster_url( settings ) {
	if ( ! settings || ! settings.poster || ! settings.poster.url ) {
		return '';
	}
	return String( settings.poster.url );
}

/**
 * Build an error paragraph with textContent (never inject untrusted HTML).
 * Shared so the lightweight entry chunk and the full viewer report errors the
 * same way — messages can come from PC_lang or a thrown Error.
 *
 * @param {string} message
 * @returns {HTMLParagraphElement}
 */
export function create_error_element( message ) {
	const error_element = document.createElement( 'p' );
	error_element.className = 'mkl_pc_3d_error';
	error_element.textContent = message == null ? '' : String( message );
	return error_element;
}

/**
 * Update the loading overlay with download progress for the current step.
 * Called from GLTFLoader's onProgress, which reports bytes for the model itself.
 *
 * @param {HTMLElement|null} overlay
 * @param {ProgressEvent} event
 */
export function set_loading_progress( overlay, event ) {
	if ( ! overlay || ! event || ! event.lengthComputable || ! event.total ) {
		return;
	}
	const ratio = Math.max( 0, Math.min( 1, event.loaded / event.total ) );
	overlay.style.setProperty( '--mkl_pc_3d_loader_progress', String( ratio ) );
	const bar = overlay.querySelector( '.mkl_pc_3d_loader__progress' );
	if ( bar ) {
		bar.setAttribute( 'aria-valuenow', String( Math.round( ratio * 100 ) ) );
	}
}

/**
 * Create the loading overlay DOM.
 * @param {Object} [options]
 * @param {string} [options.text]
 * @param {string} [options.poster_url]
 * @returns {HTMLElement}
 */
export function create_loading_overlay( options ) {
	const options_object = options || {};
	const text = options_object.text || get_loading_string( 'loading_viewer', 'Loading…' );
	const poster_url = options_object.poster_url || '';

	const overlay = document.createElement( 'div' );
	overlay.className = 'mkl_pc_3d_loader mkl_pc_3d_loading';
	overlay.setAttribute( 'aria-live', 'polite' );
	if ( poster_url ) {
		overlay.classList.add( 'has-poster' );
	}

	if ( poster_url ) {
		const poster = document.createElement( 'div' );
		poster.className = 'mkl_pc_3d_loader__poster';
		poster.style.backgroundImage = 'url(' + JSON.stringify( poster_url ) + ')';
		poster.setAttribute( 'aria-hidden', 'true' );
		overlay.appendChild( poster );
	}

	const content = document.createElement( 'div' );
	content.className = 'mkl_pc_3d_loader__content';

	const spinner = document.createElement( 'div' );
	spinner.className = 'mkl_pc_3d_loader__spinner';
	spinner.setAttribute( 'aria-hidden', 'true' );
	content.appendChild( spinner );

	const text_wrap = document.createElement( 'div' );
	text_wrap.className = 'mkl_pc_3d_loader__text';

	const track = document.createElement( 'div' );
	track.className = 'mkl_pc_3d_loader__text-track';

	const item = document.createElement( 'span' );
	item.className = 'mkl_pc_3d_loader__text-item is-active';
	item.textContent = text;
	track.appendChild( item );

	text_wrap.appendChild( track );
	content.appendChild( text_wrap );

	// Filled by set_loading_progress from GLTFLoader's onProgress. Stays at zero
	// width (and so invisible) for servers that do not send Content-Length.
	const progress = document.createElement( 'div' );
	progress.className = 'mkl_pc_3d_loader__progress';
	progress.setAttribute( 'role', 'progressbar' );
	progress.setAttribute( 'aria-valuemin', '0' );
	progress.setAttribute( 'aria-valuemax', '100' );
	const progress_bar = document.createElement( 'div' );
	progress_bar.className = 'mkl_pc_3d_loader__progress-bar';
	progress.appendChild( progress_bar );
	content.appendChild( progress );

	overlay.appendChild( content );

	return overlay;
}

/**
 * Animate loading step text with a slide-up transition.
 * @param {HTMLElement|null} overlay
 * @param {string} text
 */
export function set_loading_step( overlay, text ) {
	if ( ! overlay ) {
		return;
	}

	const next_text = text || '';
	const track = overlay.querySelector( '.mkl_pc_3d_loader__text-track' );
	if ( ! track ) {
		overlay.textContent = next_text;
		return;
	}

	const current = track.querySelector( '.mkl_pc_3d_loader__text-item.is-active' );
	if ( current && current.textContent === next_text ) {
		return;
	}

	const prefers_reduced_motion = window.matchMedia
		&& window.matchMedia( '(prefers-reduced-motion: reduce)' ).matches;

	if ( prefers_reduced_motion ) {
		if ( current ) {
			current.textContent = next_text;
		}
		return;
	}

	const next_item = document.createElement( 'span' );
	next_item.className = 'mkl_pc_3d_loader__text-item is-entering';
	next_item.textContent = next_text;
	track.appendChild( next_item );

	// Force layout so the entering class can transition.
	void next_item.offsetWidth;

	if ( current ) {
		current.classList.remove( 'is-active' );
		current.classList.add( 'is-leaving' );
	}
	next_item.classList.remove( 'is-entering' );
	next_item.classList.add( 'is-active' );

	const cleanup = () => {
		if ( current && current.parentNode ) {
			current.parentNode.removeChild( current );
		}
	};

	if ( current ) {
		current.addEventListener( 'transitionend', cleanup, { once: true } );
		window.setTimeout( cleanup, 450 );
	}
}

/**
 * Fade out and remove the loading overlay.
 * @param {HTMLElement|null} overlay
 * @param {Function} [on_done]
 */
export function hide_loading_overlay( overlay, on_done ) {
	if ( ! overlay ) {
		if ( typeof on_done === 'function' ) {
			on_done();
		}
		return;
	}

	const finish = () => {
		if ( overlay.parentNode ) {
			overlay.parentNode.removeChild( overlay );
		}
		if ( typeof on_done === 'function' ) {
			on_done();
		}
	};

	const prefers_reduced_motion = window.matchMedia
		&& window.matchMedia( '(prefers-reduced-motion: reduce)' ).matches;

	if ( prefers_reduced_motion || ! overlay.parentNode ) {
		finish();
		return;
	}

	overlay.classList.add( 'is-hiding' );
	overlay.addEventListener( 'transitionend', finish, { once: true } );
	window.setTimeout( finish, 450 );
}
