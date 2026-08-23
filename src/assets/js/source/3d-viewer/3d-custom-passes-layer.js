/**
 * Minimal postprocessing chain for add-on supplied passes.
 *
 * The 3D Premium add-on owns the real effect chain (SSR, AO, bloom, SMAA,
 * grading) through PC.3d.createPostprocessingLayer, and when it is present the
 * add-on's chain is the one that runs — a second composer on the same renderer
 * would just fight it. This module is the other case: a developer registered a
 * pass through PC.3d.postprocessingPasses and there is no add-on chain to hang
 * it on, either because 3D Premium is not installed or because none of its
 * effects are enabled on this product. Without it a custom shader pass would
 * only ever work on stores that happen to own the add-on.
 *
 * Loaded lazily, so a store with no custom passes never pays for the composer.
 */
import * as THREE from 'three';

/** MSAA sample count requested for the composer buffer. */
const MSAA_SAMPLES = 4;

/** Composer buffers at a phone's raw devicePixelRatio of 3 cost 9x the fill. */
const MAX_PIXEL_RATIO = 2;

function to_pixel_ratio( value ) {
	const parsed = typeof value === 'number' ? value : parseFloat( value );
	if ( ! Number.isFinite( parsed ) || parsed <= 0 ) return 1;
	return Math.min( parsed, MAX_PIXEL_RATIO );
}

/**
 * Build a composer around add-on passes.
 *
 * Pass order is RenderPass → 'before-output' passes → OutputPass →
 * 'after-output' passes. OutputPass is where tone mapping and the conversion
 * out of scene-linear happen, so which side a pass sits on decides what its
 * fragment shader is handed: passes before it see linear HDR values (the right
 * place for anything light-like — bloom, ambient occlusion, blurs), passes
 * after it see the display-referred image (the right place for a look — colour
 * grading, vignette, grain). Default is before, matching three's own examples;
 * a pass opts out with `pass.pcStage = 'after-output'`.
 *
 * @param {THREE.WebGLRenderer} renderer
 * @param {THREE.Scene} scene
 * @param {THREE.Camera} camera
 * @param {Object} options
 * @param {Object[]} options.passes - Pass instances, already constructed
 * @param {number} options.width
 * @param {number} options.height
 * @param {number} [options.pixelRatio]
 * @returns {Promise<Object|null>} Layer matching the host contract, or null
 */
export async function create_custom_passes_layer( renderer, scene, camera, options ) {
	const opts = options || {};
	const passes = Array.isArray( opts.passes ) ? opts.passes.filter( Boolean ) : [];
	if ( ! passes.length ) return null;

	let current_width = Math.max( 1, Math.floor( opts.width || 1 ) );
	let current_height = Math.max( 1, Math.floor( opts.height || 1 ) );
	let current_ratio = to_pixel_ratio(
		opts.pixelRatio != null ? opts.pixelRatio : ( typeof window !== 'undefined' ? window.devicePixelRatio : 1 )
	);

	let modules;
	try {
		modules = await Promise.all( [
			import( 'three/addons/postprocessing/EffectComposer.js' ),
			import( 'three/addons/postprocessing/RenderPass.js' ),
			import( 'three/addons/postprocessing/OutputPass.js' ),
		] );
	} catch ( err ) {
		// Returning null makes the host fall back to a plain renderer.render(),
		// so a failed chunk costs the custom passes but never the product view.
		// eslint-disable-next-line no-console
		console.warn( '3D viewer: failed to load the postprocessing composer, rendering without custom passes', err );
		return null;
	}

	const [ { EffectComposer }, { RenderPass }, { OutputPass } ] = modules;

	const render_target = new THREE.WebGLRenderTarget( current_width, current_height, { type: THREE.HalfFloatType } );
	render_target.texture.name = 'PC3D.customPasses.rt';

	// The renderer is created with antialias:true, but that MSAA applies to the
	// default framebuffer only and is lost the moment a composer takes over.
	const max_samples = ( renderer.capabilities && renderer.capabilities.maxSamples != null )
		? renderer.capabilities.maxSamples
		: 0;
	render_target.samples = Math.min( MSAA_SAMPLES, max_samples );

	const composer = new EffectComposer( renderer, render_target );
	composer.addPass( new RenderPass( scene, camera ) );

	passes.forEach( ( pass ) => {
		if ( pass.pcStage !== 'after-output' ) composer.addPass( pass );
	} );
	composer.addPass( new OutputPass() );
	passes.forEach( ( pass ) => {
		if ( pass.pcStage === 'after-output' ) composer.addPass( pass );
	} );

	// Sizing has to happen once the chain is complete: setSize only forwards the
	// effective (pixel-ratio scaled) dimensions to passes already added.
	composer.setPixelRatio( current_ratio );
	composer.setSize( current_width, current_height );

	const animated = passes.some( ( pass ) => pass.pcAnimated === true );

	return {
		composer,

		setSize( next_width, next_height ) {
			current_width = Math.max( 1, Math.floor( next_width || 1 ) );
			current_height = Math.max( 1, Math.floor( next_height || 1 ) );
			composer.setSize( current_width, current_height );
		},

		setPixelRatio( ratio ) {
			current_ratio = to_pixel_ratio( ratio );
			composer.setPixelRatio( current_ratio );
		},

		/**
		 * Whether the image changes on its own with no scene change to key off.
		 * Rendering is on-demand, so a time-driven shader that does not say so
		 * here draws once and then appears frozen.
		 *
		 * @returns {boolean}
		 */
		isAnimated() {
			return animated;
		},

		/**
		 * @param {boolean} [bypass=false] - Caller renders plainly instead
		 */
		render( bypass ) {
			if ( bypass ) return;
			composer.render();
		},

		dispose() {
			composer.passes.forEach( ( pass ) => {
				if ( typeof pass.dispose === 'function' ) pass.dispose();
			} );
			composer.passes.length = 0;
			// Disposes both composer buffers, render_target included.
			composer.dispose();
		},
	};
}
