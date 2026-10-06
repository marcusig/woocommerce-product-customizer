/**
 * RequestAnimationFrame loop that fully stops when the document is hidden
 * (cancelAnimationFrame) and restarts on visibilitychange.
 *
 * @param {Object} bag - Object that stores animation_id (e.g. _three)
 * @param {function(number): void} on_frame - Called each frame with DOMHighResTimeStamp
 * @returns {function(): void} stop - Unbind visibility listener and cancel the loop
 */
export function start_animation_loop( bag, on_frame ) {
	if ( ! bag || typeof on_frame !== 'function' ) {
		return function () {};
	}

	if ( typeof bag.stop_animation_loop === 'function' ) {
		bag.stop_animation_loop();
	}

	let running = false;

	function tick( now ) {
		if ( ! running ) {
			return;
		}
		bag.animation_id = requestAnimationFrame( tick );
		on_frame( now );
	}

	function start() {
		if ( running || ( typeof document !== 'undefined' && document.hidden ) ) {
			return;
		}
		running = true;
		bag.animation_id = requestAnimationFrame( tick );
	}

	function stop() {
		running = false;
		if ( bag.animation_id != null ) {
			cancelAnimationFrame( bag.animation_id );
			bag.animation_id = null;
		}
	}

	function on_visibility_change() {
		if ( document.hidden ) {
			stop();
		} else {
			start();
		}
	}

	if ( typeof document !== 'undefined' ) {
		document.addEventListener( 'visibilitychange', on_visibility_change );
	}
	start();

	bag.stop_animation_loop = function () {
		if ( typeof document !== 'undefined' ) {
			document.removeEventListener( 'visibilitychange', on_visibility_change );
		}
		stop();
		bag.stop_animation_loop = null;
	};

	return bag.stop_animation_loop;
}
