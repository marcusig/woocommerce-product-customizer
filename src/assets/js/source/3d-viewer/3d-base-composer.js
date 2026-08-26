/**
 * The no-effects render path, as a composer.
 *
 * Rendering straight to the canvas and rendering through a composer are not the
 * same picture, and the difference is not subtle on anything with a transparent
 * layer over it. three only tone maps a material when the destination is the
 * canvas — `_currentRenderTarget === null` — so a direct render tone maps and
 * clips every layer to 8 bits *before* it blends, while a composer accumulates
 * them raw in half float and tone maps once at the end. On a headlight, that is
 * the difference between the specular in the lens cover being flattened into the
 * chrome behind it and surviving as its own highlight.
 *
 * Which meant switching any effect on changed the product's appearance even with
 * every control at zero. Rather than leave two pipelines that disagree, the
 * viewer now composes whether or not there are effects to compose: this is the
 * chain used when the postprocessing add-on is absent, and it is deliberately the
 * same shape — render, tone map, put the background back.
 *
 * The background is held back for the duration for the same reason it is in the
 * add-on: three renders a `scene.background` colour as an opaque clear, so inside
 * a composer it is in the buffer before tone mapping and a chosen grey comes out
 * as a different grey. Composited afterwards instead, the colour that was picked
 * is the colour that appears.
 *
 * Shared by the frontend viewer and the admin preview, which had already drifted
 * apart once over exactly this kind of detail.
 */
import * as THREE from 'three';
import { load_pass_toolkit } from './3d-pass-toolkit.js';

/**
 * Matches the canvas. The renderer is created with antialias:true, but that MSAA
 * belongs to the default framebuffer and is lost the moment a composer takes
 * over — without asking for it again here, composing would trade a lighting
 * inconsistency for jagged edges.
 */
const MSAA_SAMPLES = 4;

/**
 * Put the background back under the tone mapped scene.
 *
 * Composited with the premultiplied "over" operator. three's blending already
 * leaves rgb premultiplied by alpha, which is the form this wants, so there is no
 * division anywhere — and additive light that carries no alpha of its own still
 * lands on top of the backdrop instead of being weighted away.
 */
const BackdropShader = {
	name: 'PCBackdropShader',
	uniforms: {
		tDiffuse: { value: null },
		// sRGB-encoded: this runs after OutputPass, on display-referred values.
		backdrop: { value: new THREE.Vector3( 1, 1, 1 ) },
		backdropEnabled: { value: 0 },
	},
	vertexShader: /* glsl */`
		varying vec2 vUv;
		void main() {
			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
		}`,
	fragmentShader: /* glsl */`
		uniform sampler2D tDiffuse;
		uniform vec3 backdrop;
		uniform float backdropEnabled;
		varying vec2 vUv;

		void main() {
			vec4 texel = texture2D( tDiffuse, vUv );
			if ( backdropEnabled < 0.5 ) {
				gl_FragColor = texel;
				return;
			}
			float alpha = clamp( texel.a, 0.0, 1.0 );
			gl_FragColor = vec4( texel.rgb + backdrop * ( 1.0 - alpha ), 1.0 );
		}`,
};

/**
 * @param {Object} config
 * @param {THREE.WebGLRenderer} config.renderer
 * @param {THREE.Scene} config.scene
 * @param {THREE.Camera} config.camera - Live reference; read at render time.
 * @returns {Object} base composer
 */
export function create_base_composer( config ) {
	const renderer = config.renderer;
	const scene = config.scene;

	let composer = null;
	let render_pass = null;
	let backdrop_pass = null;
	let capture_quad = null;
	let capture_target = null;
	let toolkit = null;
	let disposed = false;

	const backdrop_rgb = new THREE.Color();
	const css_size = new THREE.Vector2();
	let last_width = 0;
	let last_height = 0;
	let last_ratio = 0;

	function camera() {
		return config.camera;
	}

	const ready = load_pass_toolkit().then( ( loaded ) => {
		if ( disposed ) return;
		toolkit = loaded;

		renderer.getSize( css_size );
		const ratio = renderer.getPixelRatio();
		const target = new THREE.WebGLRenderTarget(
			Math.max( 1, Math.round( css_size.x * ratio ) ),
			Math.max( 1, Math.round( css_size.y * ratio ) ),
			{ type: THREE.HalfFloatType }
		);
		target.texture.name = 'PC3D.base.rt';
		const max_samples = ( renderer.capabilities && renderer.capabilities.maxSamples != null )
			? renderer.capabilities.maxSamples
			: 0;
		target.samples = Math.min( MSAA_SAMPLES, max_samples );

		// Built into locals and published only once the whole chain stands up. An
		// earlier version assigned `composer` first, so a throw while adding passes
		// left a composer with no passes in it — which renders nothing at all, and
		// looks exactly like a blank viewer rather than like an error.
		const built = new loaded.EffectComposer( renderer, target );
		const built_render_pass = new loaded.RenderPass( scene, camera() );
		built.addPass( built_render_pass );
		built.addPass( new loaded.OutputPass() );
		const built_backdrop = new loaded.ShaderPass( BackdropShader );
		built.addPass( built_backdrop );

		composer = built;
		render_pass = built_render_pass;
		backdrop_pass = built_backdrop;

		sync_size();
	} ).catch( ( err ) => {
		// A failed chunk costs the consistency, never the product view: render()
		// falls back to the direct path for the rest of the session.
		console.warn( '3D viewer: base composer unavailable, rendering directly', err );
	} );

	/**
	 * Follow the renderer's own size rather than being told about resizes.
	 *
	 * Both hosts resize the renderer through their own paths, and one of them
	 * already had a resize bug that only showed up here; reading the size back
	 * every frame is two comparisons and cannot fall out of step.
	 */
	function sync_size() {
		renderer.getSize( css_size );
		const ratio = renderer.getPixelRatio();
		const width = Math.max( 1, Math.round( css_size.x ) );
		const height = Math.max( 1, Math.round( css_size.y ) );
		if ( width === last_width && height === last_height && ratio === last_ratio ) return;
		last_width = width;
		last_height = height;
		last_ratio = ratio;
		composer.setPixelRatio( ratio );
		composer.setSize( width, height );
	}

	/**
	 * Point the chain's uniforms at the scene's background, and take the colour
	 * out of the scene so three does not clear with it.
	 *
	 * Read fresh every time rather than taken over once: the viewer rewrites
	 * scene.background whenever the background mode changes, so this is what keeps
	 * solid and transparent switching without either side tracking the other.
	 *
	 * @returns {THREE.Color|null} The colour to put back afterwards
	 */
	function hold_background() {
		const background = scene.background;
		const use_backdrop = !! ( background && background.isColor );
		backdrop_pass.uniforms.backdropEnabled.value = use_backdrop ? 1 : 0;
		if ( ! use_backdrop ) return null;

		background.getRGB( backdrop_rgb, THREE.SRGBColorSpace );
		backdrop_pass.uniforms.backdrop.value.set(
			backdrop_rgb.r,
			backdrop_rgb.g,
			backdrop_rgb.b
		);
		scene.background = null;
		return background;
	}

	return {
		/** Resolves once the chain is built, or once it is known to be unavailable. */
		ready,

		/** Whether the composer is in use; false means render() is going direct. */
		get available() {
			return !! composer;
		},

		/**
		 * Draw the scene. Falls back to a direct render until the chain is built.
		 */
		render() {
			if ( ! composer ) {
				renderer.render( scene, camera() );
				return;
			}

			sync_size();
			render_pass.camera = camera();

			const background = hold_background();
			const clear_alpha = renderer.getClearAlpha();
			if ( background ) renderer.setClearAlpha( 0 );
			try {
				composer.render();
			} finally {
				if ( background ) {
					scene.background = background;
					renderer.setClearAlpha( clear_alpha );
				}
			}
		},

		/**
		 * Render at an arbitrary size and read the pixels back.
		 *
		 * The saved image has to be the picture the customer was looking at, which
		 * before this went through renderer.render() into a render target — where
		 * three switches tone mapping off. The capture came out untone-mapped and
		 * nobody spotted it, because there was nothing beside it to compare against.
		 *
		 * @param {number} width
		 * @param {number} height
		 * @param {THREE.Camera} shot_camera
		 * @returns {Uint8Array|null} RGBA bytes, or null when unavailable
		 */
		capture( width, height, shot_camera ) {
			if ( ! composer || ! toolkit ) return null;

			const previous_ratio = last_ratio;
			const previous_target = renderer.getRenderTarget();
			const previous_to_screen = composer.renderToScreen;

			try {
				render_pass.camera = shot_camera || camera();
				composer.renderToScreen = false;
				composer.setPixelRatio( 1 );
				composer.setSize( width, height );

				const background = hold_background();
				const clear_alpha = renderer.getClearAlpha();
				if ( background ) renderer.setClearAlpha( 0 );
				try {
					composer.render();
				} finally {
					if ( background ) {
						scene.background = background;
						renderer.setClearAlpha( clear_alpha );
					}
				}

				// The chain's buffers are half float, so they cannot be read back as
				// bytes. One copy into an 8-bit target is what makes them readable.
				if ( ! capture_quad ) {
					capture_quad = new toolkit.FullScreenQuad(
						new THREE.ShaderMaterial( {
							uniforms: THREE.UniformsUtils.clone( toolkit.CopyShader.uniforms ),
							vertexShader: toolkit.CopyShader.vertexShader,
							fragmentShader: toolkit.CopyShader.fragmentShader,
							depthTest: false,
							depthWrite: false,
						} )
					);
				}
				if ( ! capture_target ) {
					capture_target = new THREE.WebGLRenderTarget( width, height, {
						type: THREE.UnsignedByteType,
					} );
				} else {
					capture_target.setSize( width, height );
				}

				capture_quad.material.uniforms.tDiffuse.value = composer.readBuffer.texture;
				renderer.setRenderTarget( capture_target );
				capture_quad.render( renderer );

				const pixels = new Uint8Array( width * height * 4 );
				renderer.readRenderTargetPixels( capture_target, 0, 0, width, height, pixels );
				return pixels;
			} catch ( err ) {
				console.warn( '3D viewer: base composer capture failed', err );
				return null;
			} finally {
				renderer.setRenderTarget( previous_target );
				composer.renderToScreen = previous_to_screen;
				render_pass.camera = camera();
				// Force sync_size to rebuild from the live renderer next frame.
				last_ratio = previous_ratio === 0 ? 0 : -1;
				sync_size();
			}
		},

		dispose() {
			disposed = true;
			if ( capture_target ) capture_target.dispose();
			if ( capture_quad ) capture_quad.dispose();
			if ( backdrop_pass && backdrop_pass.material ) backdrop_pass.material.dispose();
			if ( composer ) {
				if ( composer.renderTarget1 ) composer.renderTarget1.dispose();
				if ( composer.renderTarget2 ) composer.renderTarget2.dispose();
			}
			composer = null;
			render_pass = null;
			backdrop_pass = null;
			capture_quad = null;
			capture_target = null;
		},
	};
}
