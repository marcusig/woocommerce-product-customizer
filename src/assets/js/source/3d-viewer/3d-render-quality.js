/**
 * Interaction-driven render quality, shared by the frontend viewer and the admin
 * preview.
 *
 * Both viewers want the same behaviour and had drifted into two implementations
 * of part of it — the admin's orbit downscale was silently doing nothing, its
 * drag quality snapped back on mouse-up rather than when the movement stopped,
 * and it never refined a still image at all. This is that logic in one place, so
 * the two cannot disagree again. It is the same reason getHdrUrlFromEnv ended up
 * shared: the preview's private copy had drifted and was wrong.
 *
 * The policy in one line: while anything moves, render cheap and once; when it
 * stops, keep re-rendering the same frame at sub-pixel offsets and average them.
 *
 * The host keeps what is genuinely its own — how a frame is drawn, and how a
 * sub-pixel camera offset composes with whatever else it has the view offset
 * doing. Everything between those is here.
 */

/**
 * @param {Object} config
 * @param {function(): (Object|null)} config.getLayer - Current postprocessing layer, if any
 * @param {function(): (Object|null)} config.getControls - OrbitControls instance
 * @param {function(): number} config.getPixelRatio - Device pixel ratio, capped
 * @param {number} config.orbitScale - Resolution multiplier while dragging
 * @param {function(({x: number, y: number}|null)): void} config.applyJitter
 *        Apply a sub-pixel camera offset, or clear it when passed null.
 * @returns {Object} driver
 */
export function create_render_quality( config ) {
	const get_layer = config.getLayer;
	const get_controls = config.getControls;
	const get_pixel_ratio = config.getPixelRatio;
	const orbit_scale = config.orbitScale;
	const apply_jitter = config.applyJitter;

	// Frames still owed to a change. Two rather than one: a change often lands
	// between a frame being scheduled and it running.
	let frames = 0;
	let orbiting = false;
	let pointer_down = false;
	let sample_index = 0;

	/**
	 * Push the pixel ratio and the drag quality scale into the composer.
	 *
	 * The scale goes over as its own value wherever the layer accepts one. The
	 * layer caps the ratio internally — tighter still when AO or SSR are on — so
	 * pre-scaling it here only produced a number the cap clamped straight back:
	 * on a 2x screen with those effects on, dragging never dropped resolution at
	 * all, which is precisely where it was needed most.
	 */
	function apply_quality() {
		const layer = get_layer();
		if ( ! layer ) return;
		const ratio = get_pixel_ratio();
		const scale = orbiting ? orbit_scale : 1;
		if ( typeof layer.setQualityScale === 'function' ) {
			layer.setPixelRatio( ratio );
			layer.setQualityScale( scale );
			return;
		}
		// Layer build without a quality scale: a pre-scaled ratio is all it takes.
		layer.setPixelRatio( ratio * scale );
	}

	function set_orbiting( next ) {
		if ( orbiting === next ) return;
		orbiting = next;
		apply_quality();
		frames = 2;
	}

	/**
	 * Bring damped controls to an actual stop.
	 *
	 * Damping decays asymptotically, and update() only refreshes its reference
	 * position on the frames it reports movement. So it goes quiet while a residual
	 * delta is still creeping the camera along, and that creep silently accumulates
	 * until it crosses the threshold again — repeatedly, for about half a second
	 * after the view looks stationary. Each crossing counts as a scene change and
	 * throws away the refinement in progress.
	 *
	 * Three zeroes the leftover delta on any update() taken with damping off, so
	 * one such update flushes it. What it costs is a single sub-pixel step: the
	 * delta being flushed is by definition below the threshold that would have
	 * counted as movement.
	 */
	function settle_controls() {
		const controls = get_controls();
		if ( ! controls || ! controls.enableDamping ) return;
		controls.enableDamping = false;
		controls.update();
		controls.enableDamping = true;
	}

	/**
	 * Spend an idle frame improving the still image instead of redrawing it.
	 *
	 * This is the expensive half of the split, and it is what clears the aliasing
	 * SMAA cannot touch — sparkle on specular highlights and along the silhouette —
	 * because those need more samples, not smarter edge reconstruction.
	 */
	function refine() {
		const layer = get_layer();
		if ( ! layer || typeof layer.accumulateSample !== 'function' ) return;
		// Still under the customer's hand, or gliding to a stop: not settled yet.
		if ( orbiting || pointer_down ) return;

		const total = layer.getAccumulationSamples();
		if ( sample_index >= total ) return;

		if ( typeof layer.getSampleOffset === 'function' ) {
			apply_jitter( layer.getSampleOffset( sample_index ) );
		}

		// False means the layer declined — out of its time budget on this machine,
		// or unable to allocate. Either way stop asking, and put the projection back.
		if ( ! layer.accumulateSample( sample_index ) ) {
			sample_index = total;
			apply_jitter( null );
			return;
		}
		sample_index += 1;

		if ( sample_index >= total ) {
			// Leave the projection where the rest of the viewer expects it — captures
			// and hotspot picking both read this matrix.
			apply_jitter( null );
		}
	}

	return {
		/** Ask for the scene to be drawn again. */
		request() {
			frames = 2;
		},

		/** Re-apply the pixel ratio and drag scale, after a resize or a rebuild. */
		applyQuality: apply_quality,

		/** Throw away any refinement in progress and redraw. */
		invalidate() {
			sample_index = 0;
			frames = 2;
		},

		/** Whether the customer is currently moving the camera. */
		get orbiting() {
			return orbiting;
		},

		/** How far a refinement in progress has got; 0 when there is none. */
		get sampleIndex() {
			return sample_index;
		},

		/**
		 * Track the drag through the controls.
		 *
		 * 'end' only clears the pointer flag. Damping means the camera keeps gliding
		 * after release, and dropping the drag quality there would restore full
		 * resolution partway through a motion the customer is still watching; the
		 * frame loop clears it once the controls report they have come to rest.
		 *
		 * @param {Object} controls - OrbitControls
		 */
		attach( controls ) {
			if ( ! controls ) return;
			controls.addEventListener( 'start', () => {
				pointer_down = true;
				set_orbiting( true );
			} );
			controls.addEventListener( 'end', () => {
				pointer_down = false;
			} );
			controls.addEventListener( 'change', () => {
				frames = 2;
			} );
		},

		/**
		 * One tick. Calls draw() for a frame that has to be redrawn, and otherwise
		 * spends the tick refining what is already on screen.
		 *
		 * @param {function(): void} draw - Host's normal render
		 * @returns {boolean} Whether draw() was called
		 */
		frame( draw ) {
			const controls = get_controls();
			const moving = !! ( controls && controls.update() );
			if ( moving ) frames = 2;

			// The drag ends when the motion does, not when the pointer lifts. Holding
			// a still pointer counts as dragging too, hence the separate flag:
			// update() reports no movement then, but the customer has not let go.
			if ( orbiting && ! pointer_down && ! moving ) {
				settle_controls();
				set_orbiting( false );
			}

			// An add-on pass may drive itself from a clock, with no scene change to
			// key off. Nothing in the stock chain does — the grain is a static overlay.
			const layer = get_layer();
			if ( layer && typeof layer.isAnimated === 'function' && layer.isAnimated() ) {
				frames = 2;
			}

			if ( ! frames ) {
				refine();
				return false;
			}

			frames -= 1;
			// A real frame supersedes whatever the refinement had converged to.
			sample_index = 0;
			draw();
			return true;
		},
	};
}
