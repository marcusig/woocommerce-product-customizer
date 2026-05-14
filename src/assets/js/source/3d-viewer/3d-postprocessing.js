/**
 * Reusable postprocessing layer for 3D viewer (admin preview and frontend).
 * Creates an EffectComposer with optional SSAO, SSR, Bloom, SMAA and a final OutputPass.
 * Loads addon passes in parallel; bypass rendering for smooth orbit/pan/zoom.
 */
import * as THREE from 'three';

/**
 * Create a postprocessing layer: composer + passes (SSAO → SSR → Bloom → SMAA → OutputPass).
 *
 * @param {THREE.WebGLRenderer} renderer
 * @param {THREE.Scene} scene
 * @param {THREE.Camera} camera
 * @param {Object} options
 * @param {number} options.width - Buffer width (e.g. container.clientWidth)
 * @param {number} options.height - Buffer height (e.g. container.clientHeight)
 * @param {Object} options.flags - { ssao, ssr, bloom, smaa } booleans
 * @param {number} [options.bloomStrength=0.6]
 * @param {number} [options.bloomRadius=0.04]
 * @param {number} [options.bloomThreshold=0.85]
 * @returns {Promise<{ composer: THREE.EffectComposer, setSize: function, setPixelRatio: function, render: function, dispose: function }>}
 */
export async function createPostprocessingLayer( renderer, scene, camera, options ) {
	const { width, height, flags } = options;
	const w = width || 1;
	const h = height || 1;
	const useSSAO = !!flags.ssao;
	const useSSR = !!flags.ssr;
	const useBloom = !!flags.bloom;
	const useSMAA = !!flags.smaa;
	const anyEnabled = useSSAO || useSSR || useBloom || useSMAA;

	if ( ! anyEnabled ) {
		return null;
	}

	const { EffectComposer } = await import( 'three/addons/postprocessing/EffectComposer.js' );
	const { RenderPass } = await import( 'three/addons/postprocessing/RenderPass.js' );

	const composer = new EffectComposer( renderer );
	composer.addPass( new RenderPass( scene, camera ) );

	try {
		const [
			ssaoModule,
			ssrModule,
			bloomModule,
			smaaModule,
			outputModule
		] = await Promise.all( [
			useSSAO ? import( 'three/addons/postprocessing/SSAOPass.js' ) : null,
			useSSR ? import( 'three/addons/postprocessing/SSRPass.js' ) : null,
			useBloom ? import( 'three/addons/postprocessing/UnrealBloomPass.js' ) : null,
			useSMAA ? import( 'three/addons/postprocessing/SMAAPass.js' ) : null,
			import( 'three/addons/postprocessing/OutputPass.js' )
		] );

		if ( ssaoModule ) {
			const { SSAOPass } = ssaoModule;
			composer.addPass( new SSAOPass( scene, camera, w, h ) );
		}
		if ( ssrModule ) {
			const { SSRPass } = ssrModule;
			composer.addPass( new SSRPass( { renderer, scene, camera, width: w, height: h } ) );
		}
		if ( bloomModule ) {
			const { UnrealBloomPass } = bloomModule;
			const resolution = new THREE.Vector2( w, h );
			const strength = options.bloomStrength != null ? options.bloomStrength : 0.05;
			const radius = options.bloomRadius != null ? options.bloomRadius : 0.04;
			const threshold = options.bloomThreshold != null ? options.bloomThreshold : 0.85;
			composer.addPass( new UnrealBloomPass( resolution, strength, radius, threshold ) );
		}
		if ( smaaModule ) {
			const { SMAAPass } = smaaModule;
			composer.addPass( new SMAAPass() );
		}
		const { OutputPass } = outputModule;
		composer.addPass( new OutputPass() );
	} catch ( err ) {
		console.warn( '3D postprocessing: failed to load one or more passes', err );
	}

	composer.setSize( w, h );
	composer.setPixelRatio( typeof window !== 'undefined' ? window.devicePixelRatio : 1 );

	return {
		composer,
		setSize( width, height ) {
			composer.setSize( width, height );
		},
		setPixelRatio( ratio ) {
			composer.setPixelRatio( ratio );
		},
		/**
		 * @param {boolean} [bypass=false] - If true, caller should render with renderer.render(scene, camera) instead.
		 */
		render( bypass ) {
			if ( bypass ) return;
			composer.render();
		},
		dispose() {
			composer.dispose();
		}
	};
}
