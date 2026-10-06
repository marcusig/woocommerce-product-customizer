/**
 * Planar fake shadow, built from two layers with independent strengths.
 *
 * One orthographic depth pass looks up at the model from the shadow plane and
 * stores, per texel, the height of the lowest surface above it. Two different
 * shadows are then derived from that single height map:
 *
 * - the *general* shadow: the model's silhouette, darkened by how low it sits.
 *   This is the classic contact-shadow trick (three's webgl_shadow_contact), and
 *   it is a rasterised shape rather than an estimate, so it carries no sampling
 *   noise at all and blurs into a clean soft blob.
 * - the *contact* shadow: a short-range ambient occlusion integral that tightens
 *   sharply where geometry actually meets the ground.
 *
 * They are separated because they fail in opposite ways. The occlusion integral
 * reads a car underside at 30mm resolution — suspension arms, exhaust, gaps — and
 * faithfully reports every bit of it, which at any useful search radius looks
 * mottled. The silhouette has no detail to be mottled by, but on its own it is a
 * flat cutout with no sense of where the product touches. Splitting them means
 * each can be blurred by the amount its own frequency content wants, and a
 * product that is meant to float can turn the contact layer off entirely while
 * keeping a soft shadow beneath it.
 *
 * No real-time shadow maps. Everything here runs on invalidate(), never per frame.
 * Shared by admin 3D settings and frontend 3D viewer.
 */
import * as THREE from 'three';

/**
 * Both shadow layers, written to one texture: red is contact, green is general.
 *
 * Packing them together is what keeps the pass count down — the separable blur
 * below softens both channels in the same two passes, with a different sigma for
 * each, so adding the second layer costs one extra full-screen pass in total
 * rather than doubling the chain.
 *
 * The occlusion half: for a ground point, an occluder at horizontal distance d
 * whose underside sits at height h blocks d^2 / ( d^2 + h^2 ) of the cosine-
 * weighted hemisphere. Touching the floor blocks everything, high overhangs block
 * almost nothing. The search radius is deliberately short, because this layer is
 * only being asked for the contact patch now; the mass of the shadow comes from
 * the silhouette instead.
 *
 * The silhouette half reads four depth texels rather than one. The height map is
 * about twice this texture's resolution, so a single tap would throw away half
 * the silhouette's edge detail and alias it; four taps average the 2x2 block that
 * actually falls under this texel. They cannot be replaced by one bilinear fetch,
 * because the coverage mask has to be applied per depth texel — averaging across
 * the model's edge first would blend real heights with cleared zeroes and paint
 * shadow into empty space.
 */
const ShadowLayersShader = {
	name: 'ShadowLayersShader',
	uniforms: {
		tDepth: { value: null },
		depthTexel: { value: new THREE.Vector2( 1, 1 ) },
		planeSize: { value: new THREE.Vector2( 1, 1 ) },
		heightScale: { value: 1 },
		radius: { value: 1 },
	},
	vertexShader: /* glsl */`
		varying vec2 vUv;
		void main() {
			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
		}`,
	fragmentShader: /* glsl */`
		uniform sampler2D tDepth;
		uniform vec2 depthTexel;
		uniform vec2 planeSize;
		uniform float heightScale;
		uniform float radius;
		varying vec2 vUv;

		const int SAMPLES = 64;
		const float GOLDEN_ANGLE = 2.39996323;

		// How fast the silhouette gives up with height. Linear (1.0) is what three's
		// example uses, and it leaves a car's roofline casting half as much as its
		// sills. Squaring biases the layer towards what is actually near the floor
		// without touching anything in contact with it, where the term is 1 either way.
		const float SILHOUETTE_FALLOFF = 2.0;

		void main() {
			// --- contact: short-range occlusion integral ---
			float contact = 0.0;
			for ( int i = 0; i < SAMPLES; i++ ) {
				float fi = float( i );
				// Vogel spiral: even coverage of the disc with no rings of its own.
				float angle = fi * GOLDEN_ANGLE;
				float dist = radius * sqrt( ( fi + 0.5 ) / float( SAMPLES ) );
				vec2 uv = vUv + vec2( cos( angle ), sin( angle ) ) * dist / planeSize;
				if ( uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0 ) continue;

				vec4 depthSample = texture2D( tDepth, uv );
				// Nothing overhead: this direction sees sky.
				if ( depthSample.a <= 0.002 ) continue;

				float h = depthSample.r * heightScale;
				contact += ( dist * dist ) / ( dist * dist + h * h );
			}
			contact /= float( SAMPLES );

			// --- general: the silhouette, darkened by how low it sits ---
			float general = 0.0;
			for ( int sy = 0; sy < 2; sy++ ) {
				for ( int sx = 0; sx < 2; sx++ ) {
					vec2 offset = ( vec2( float( sx ), float( sy ) ) - 0.5 ) * depthTexel;
					vec4 d = texture2D( tDepth, vUv + offset );
					if ( d.a <= 0.002 ) continue;
					general += pow( 1.0 - d.r, SILHOUETTE_FALLOFF );
				}
			}
			general *= 0.25;

			// The margin is sized so both layers reach zero before the texture does,
			// but a hard edge is bad enough — and subtle enough on a light background
			// — that it is worth making structurally impossible rather than merely
			// arithmetically avoided. Costs nothing when the margin is doing its job.
			vec2 toEdge = min( vUv, 1.0 - vUv );
			float edgeFade = smoothstep( 0.0, 0.06, min( toEdge.x, toEdge.y ) );

			gl_FragColor = vec4( contact * edgeFade, general * edgeFade, 0.0, 1.0 );
		}`,
};

/**
 * Separable Gaussian over both layers at once, one texel per tap, with a
 * different standard deviation for each channel.
 *
 * Two sigmas rather than two blur chains: the taps are the expensive part and
 * both channels want the same tap positions, only weighted differently. So the
 * contact layer can stay tight while the general layer gets the wide softening
 * that makes a silhouette stop reading as a cutout, for the price of one blur.
 *
 * A wide kernel is affordable here because the map is small: one texel per tap
 * covers three standard deviations in eighteen taps, so the kernel is continuous.
 * An earlier attempt had the opposite arrangement — a handful of taps stretched
 * across a large map — and the gaps between them are what banding is.
 */
const ShadowBlurShader = {
	name: 'ShadowBlurShader',
	uniforms: {
		tLayers: { value: null },
		direction: { value: new THREE.Vector2( 1, 0 ) },
		// x: contact sigma, y: general sigma, both in texels.
		sigma: { value: new THREE.Vector2( 1, 1 ) },
	},
	vertexShader: /* glsl */`
		varying vec2 vUv;
		void main() {
			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
		}`,
	fragmentShader: /* glsl */`
		uniform sampler2D tLayers;
		uniform vec2 direction;
		uniform vec2 sigma;
		varying vec2 vUv;

		const int TAPS = 18;

		void main() {
			vec2 twoSigmaSq = 2.0 * max( sigma * sigma, vec2( 0.0001 ) );
			vec2 total = texture2D( tLayers, vUv ).rg;
			vec2 weightTotal = vec2( 1.0 );

			for ( int i = 1; i <= TAPS; i++ ) {
				float fi = float( i );
				vec2 weight = exp( - vec2( fi * fi ) / twoSigmaSq );
				vec2 step = direction * fi;
				vec2 near = texture2D( tLayers, vUv + step ).rg;
				vec2 far = texture2D( tLayers, vUv - step ).rg;
				total += ( near + far ) * weight;
				weightTotal += 2.0 * weight;
			}

			gl_FragColor = vec4( total / weightTotal, 0.0, 1.0 );
		}`,
};

/**
 * Combine the two blurred layers into the alpha the floor plane shows.
 *
 * Combined as independent occluders — 1 - ( 1 - a )( 1 - b ) — rather than added.
 * Adding overshoots and clips to a flat black patch wherever both layers are
 * strong, which on a car is the entire area between the wheels. The product form
 * cannot exceed 1, stays smooth, and makes the contact layer deepen the general
 * shadow rather than replace it.
 *
 * The two are not really independent — they describe the same object — so this
 * double counts a little where they overlap. That is what the separate strengths
 * are for: the general layer carries the mass, and contact is dialled in on top
 * as an accent.
 *
 * rgb stays black so the floor tints nothing; only alpha carries the shadow.
 */
const ShadowCompositeShader = {
	name: 'ShadowCompositeShader',
	uniforms: {
		tLayers: { value: null },
		contactStrength: { value: 1 },
		generalStrength: { value: 1 },
	},
	vertexShader: /* glsl */`
		varying vec2 vUv;
		void main() {
			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
		}`,
	fragmentShader: /* glsl */`
		uniform sampler2D tLayers;
		uniform float contactStrength;
		uniform float generalStrength;
		varying vec2 vUv;

		void main() {
			vec2 layers = texture2D( tLayers, vUv ).rg;
			float contact = clamp( layers.r * contactStrength, 0.0, 1.0 );
			float general = clamp( layers.g * generalStrength, 0.0, 1.0 );
			float occlusion = 1.0 - ( 1.0 - general ) * ( 1.0 - contact );
			gl_FragColor = vec4( vec3( 0.0 ), occlusion );
		}`,
};

/**
 * The line in three's MeshDepthMaterial fragment shader that the shadow pass
 * rewrites, so depth becomes alpha on a black plane rather than a grey value.
 * Verified against three r182.
 */
const DEPTH_FRAGMENT_TARGET = 'gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );';

/**
 * Long-axis size of the height map both layers are derived from. Larger than the
 * shadow it produces: the shadow can be small because it is smooth, but the
 * heights need enough detail to tell a wheel from a sill.
 */
const DEPTH_RESOLUTION = 256;

/**
 * Long-axis size of the shadow itself. Far below the screen size it is magnified
 * to — bilinear filtering does the fine smoothing for free — but not so small
 * that the ramps between texels span enough screen pixels to read as flat panels
 * meeting at creases, which is what an earlier 64 looked like.
 */
const SHADOW_RESOLUTION = 128;

/**
 * Occlusion search radius for the contact layer, as a fraction of the footprint.
 *
 * Short on purpose. A wider search does buy a darker shadow under the body, but
 * it buys it by dilating the contact patches and by aliasing more of the model's
 * underside into the estimate. The general layer supplies that darkness now, for
 * free and without noise, which is what lets this one shrink to the job it is
 * actually good at.
 */
const AO_RADIUS = 0.03;

/**
 * Blur standard deviations as fractions of the footprint: a floor that always
 * applies, plus the range the softness setting adds on top.
 *
 * The general layer has a real floor because an unblurred silhouette is a cutout
 * — it is the one thing that layer cannot be allowed to look like. The contact
 * layer's floor is barely more than a texel, just enough to take the edge off the
 * occlusion estimate without spreading the patch it exists to keep tight.
 */
const CONTACT_BLUR_MIN = 0.006;
const CONTACT_BLUR_RANGE = 0.02;
const GENERAL_BLUR_MIN = 0.04;
const GENERAL_BLUR_RANGE = 0.055;

/** How much of the widest blur's tail the plane has to leave room for. */
const BLUR_TAIL_SIGMAS = 3;


export class FakeShadow extends THREE.Object3D {
	constructor(scene) {
		super();

		this._scene = scene;
		this._camera = new THREE.OrthographicCamera(-0.5, 0.5, 0.5, -0.5, 0, 1);
		this._camera.rotation.x = Math.PI / 2;
		this.add(this._camera);

		this._depthMaterial = new THREE.MeshDepthMaterial();
		this._depthMaterial.depthTest = true;
		this._depthMaterial.depthWrite = true;
		this._depthMaterial.side = THREE.DoubleSide;
		this._depthMaterial.onBeforeCompile = (shader) => {
			const patched = shader.fragmentShader.replace(
				DEPTH_FRAGMENT_TARGET,
				// Red carries the raw normalised height, which both layers read;
				// alpha is the coverage mask. They need separate channels because
				// alpha is saturated below into a clean "was anything drawn here",
				// which would destroy the height if they shared one.
				'gl_FragColor = vec4( vec3( fragCoordZ ), ( 1.0 - fragCoordZ ) * opacity );'
			);
			// This patches three's own depth shader by string match. If three
			// changes that line the replace silently does nothing and the ground
			// plane renders as an opaque inverted-depth slab instead of a shadow,
			// which is easy to misread as a lighting problem. Fail loudly instead.
			if (patched === shader.fragmentShader) {
				console.error(
					'FakeShadow: could not patch the depth shader — three.js has changed MeshDepthMaterial. ' +
					'The ground shadow will not render correctly until the replacement target is updated.'
				);
				return;
			}
			shader.fragmentShader = patched;
		};

		// The height map both layers are derived from, at its own larger size.
		this._renderTargetDepth = null;
		// Contact in red, general in green; also the blur's ping-pong home.
		this._renderTargetLayers = null;
		// Ping-pong partner for the separable blur.
		this._renderTargetBlur = null;
		// The composited result, and the texture the floor plane shows.
		this._renderTarget = null;

		const material = ( shader ) => {
			const m = new THREE.ShaderMaterial( shader );
			m.uniforms = THREE.UniformsUtils.clone( shader.uniforms );
			m.depthTest = false;
			return m;
		};
		this._layersMaterial = material( ShadowLayersShader );
		this._blurMaterial = material( ShadowBlurShader );
		this._compositeMaterial = material( ShadowCompositeShader );

		// One geometry shared by the floor and the full-screen quad; disposed once,
		// via this reference, rather than through both meshes.
		this._planeGeometry = new THREE.PlaneGeometry(1, 1);
		this._floor = new THREE.Mesh(
			this._planeGeometry,
			new THREE.MeshBasicMaterial({
				transparent: true,
				opacity: 1,
				side: THREE.BackSide,
			})
		);
		this._floor.userData.noHit = true;
		this._camera.add(this._floor);

		this._quad = new THREE.Mesh(this._planeGeometry);
		this._quad.visible = false;
		this._camera.add(this._quad);

		this._boundingBox = new THREE.Box3();
		this._size = new THREE.Vector3();
		this._intensity = 0;
		this._contactStrength = 1;
		this._generalStrength = 1;
		this._contactSigmaWorld = 0;
		this._generalSigmaWorld = 0;
		this._enabled = true;
		this._needs_render = true;

		scene.add(this);
	}

	/**
	 * Mark the passes dirty so the next render() rebuilds the shadow texture.
	 * Call when model visibility, transforms, or ground settings change — not every frame.
	 */
	invalidate() {
		this._needs_render = true;
	}

	/**
	 * Update shadow size, position, strengths and softness from model and ground settings.
	 *
	 * @param {THREE.Object3D} modelRoot - Model to fit (e.g. gltf.scene).
	 * @param {Object} ground - Ground settings:
	 *   `enabled`, `shadow_opacity` (0–1, master), `shadow_blur` (0–10 softness),
	 *   `shadow_contact` (0–1), `shadow_general` (0–1),
	 *   `shadow_offset` (scene units; negative drops the plane below the product).
	 * @param {boolean} [enabled] - Whether the fake shadow is the active shadow
	 *   mode. Passed explicitly because the mode lives above `ground` in the
	 *   settings, and only the caller can see it.
	 */
	update(modelRoot, ground, enabled) {
		if (!modelRoot) return;

		this._boundingBox.setFromObject(modelRoot);
		this._size.copy(this._boundingBox.getSize(new THREE.Vector3()));
		const center = this._boundingBox.getCenter(new THREE.Vector3());

		const setting = ( key, fallback ) => (
			ground && ground[ key ] != null ? Number( ground[ key ] ) : fallback
		);
		const clamp01 = ( v ) => Math.min( 1, Math.max( 0, v ) );

		const opacity = setting( 'shadow_opacity', 0.5 );
		const softness = clamp01( setting( 'shadow_blur', 0 ) / 10 );
		const offset = setting( 'shadow_offset', 0 );

		// The plane sits at the bottom of the model by default. A product that is
		// meant to read as floating needs it somewhere else, so the offset moves it
		// along Y — negative to drop it to the floor the product is hovering above.
		this.position.set(center.x, this._boundingBox.min.y + offset, center.z);

		// Capture the model's footprint rather than a square of its largest
		// dimension. A car is more than twice as long as it is wide, so a square
		// spent most of the texture on empty floor beside it.
		//
		// Margin is derived from the blur and search radii, not a proportion of each
		// axis. A proportional margin gave the short axis less room than the search
		// needed, so occlusion was still non-zero at the very edge of the texture and
		// stopped there in a straight line. Both radii come from the geometric mean
		// of the footprint, so one long axis cannot dictate a margin the short one
		// has to absorb.
		const footprint = Math.sqrt(Math.max(this._size.x, 0.01) * Math.max(this._size.z, 0.01));
		this._aoRadiusWorld = footprint * AO_RADIUS;
		this._contactSigmaWorld = footprint * (CONTACT_BLUR_MIN + softness * CONTACT_BLUR_RANGE);
		this._generalSigmaWorld = footprint * (GENERAL_BLUR_MIN + softness * GENERAL_BLUR_RANGE);

		// The margin allows for the widest blur the slider can ask for, whether or
		// not this setting asks for it. Sizing it to the current softness instead
		// would make the plane — and so the texel size, and so the amount of detail
		// captured — change every time the slider moves, which reads as the shadow
		// scaling rather than softening.
		const maxGeneralSigma = GENERAL_BLUR_MIN + GENERAL_BLUR_RANGE;
		const margin = footprint * (AO_RADIUS * 1.35 + maxGeneralSigma * BLUR_TAIL_SIGMAS);
		this._planeWidth = Math.max(this._size.x, 0.01) + margin * 2;
		this._planeDepth = Math.max(this._size.z, 0.01) + margin * 2;

		this._camera.near = 0;
		// Height is normalised over this range, and the general layer's darkness is
		// a function of it, so the far plane decides how fast the shadow fades with
		// height. It used to be twice the largest dimension, which for anything
		// wider than it is tall crushed the whole model into the first sliver of the
		// range and left nothing separating contact from the bodywork above it.
		//
		// The offset is subtracted rather than ignored: dropping the plane puts the
		// model further from the camera, and a range still fitted to the bare model
		// height would push it out past the far plane and lose the shadow entirely.
		this._camera.far = Math.max(this._size.y - offset, 0.01) * 5;
		this._camera.updateProjectionMatrix();

		this._enabled = enabled != null
			? !! enabled
			: !! ( ground && ground.enabled !== false );
		this.visible = this._enabled;

		this._intensity = opacity;
		this._contactStrength = clamp01( setting( 'shadow_contact', 1 ) );
		this._generalStrength = clamp01( setting( 'shadow_general', 1 ) );

		this._setMapSize();
		this._setIntensity();
		this._needs_render = true;
	}

	_setMapSize() {
		// Texture aspect follows the captured area, not the raw model size. The two
		// used to disagree — a square capture written into a footprint-shaped
		// texture — which stretched texels along one axis and quietly halved the
		// resolution across the other.
		const planeWidth = this._planeWidth != null ? this._planeWidth : 1;
		const planeDepth = this._planeDepth != null ? this._planeDepth : 1;
		const aspect = planeWidth / Math.max(0.01, planeDepth);
		const axes = ( longSide ) => ( {
			width: Math.max( 4, Math.round( aspect >= 1 ? longSide : longSide * aspect ) ),
			height: Math.max( 4, Math.round( aspect >= 1 ? longSide / aspect : longSide ) ),
		} );
		const shadow = axes( SHADOW_RESOLUTION );
		const depth = axes( DEPTH_RESOLUTION );

		if (
			this._renderTarget &&
			(this._renderTarget.width !== shadow.width || this._renderTarget.height !== shadow.height)
		) {
			this._disposeTargets();
		}

		if (!this._renderTarget) {
			const target = ( width, height ) => {
				const rt = new THREE.WebGLRenderTarget( width, height, {
					format: THREE.RGBAFormat,
					type: THREE.UnsignedByteType,
				} );
				// Bilinear is what turns this handful of texels into a smooth shadow
				// once it is stretched over the floor, and what lets the layers pass
				// read the height map between texels. It is the whole smoothing
				// strategy on top of the explicit blur.
				rt.texture.minFilter = THREE.LinearFilter;
				rt.texture.magFilter = THREE.LinearFilter;
				return rt;
			};
			this._renderTargetDepth = target( depth.width, depth.height );
			this._renderTargetLayers = target( shadow.width, shadow.height );
			this._renderTargetBlur = target( shadow.width, shadow.height );
			this._renderTarget = target( shadow.width, shadow.height );
			this._floor.material.map = this._renderTarget.texture;
		}

		// Captured area and plane are the same thing: the margin baked into the plane
		// size is what the blur tail spreads into, so there is nothing extra to pad.
		this._camera.scale.set( planeWidth, planeDepth, 1 );
	}

	_disposeTargets() {
		[ '_renderTarget', '_renderTargetDepth', '_renderTargetLayers', '_renderTargetBlur' ]
			.forEach( ( key ) => {
				if ( this[ key ] ) this[ key ].dispose();
				this[ key ] = null;
			} );
	}

	_setIntensity() {
		// Straight through: the composite produces a calibrated 0..1 occlusion, so
		// opacity is the master strength and nothing has to be compensated for.
		const opacity = this._intensity > 0 ? this._intensity : 0;
		this._floor.visible = this._intensity > 0;
		this._floor.material.opacity = opacity;
	}

	/**
	 * Rebuild the shadow texture. Call before the main scene render.
	 * Skips the whole chain when nothing has changed since the last render.
	 *
	 * @param {THREE.WebGLRenderer} renderer
	 * @param {THREE.Scene} scene - Full scene containing the model.
	 */
	render(renderer, scene) {
		if (!this._enabled || !this._renderTarget || this._intensity <= 0) {
			this._floor.visible = false;
			return;
		}

		if (!this._needs_render) {
			this._setIntensity();
			return;
		}

		const initialClearAlpha = renderer.getClearAlpha();
		renderer.setClearAlpha(0);
		this._floor.visible = false;

		const xrEnabled = renderer.xr.enabled;
		renderer.xr.enabled = false;

		const oldOverride = scene.overrideMaterial;
		scene.overrideMaterial = this._depthMaterial;

		// The background is not geometry, and overrideMaterial does not reach it:
		// three paints it as its own step, opaque, before anything else. Left in
		// place it filled the height map edge to edge with "an occluder at the
		// background colour's brightness", so every ground point outside the model
		// still integrated a few percent of occlusion and the whole plane showed as
		// a faint rectangle with visible corners against the page.
		const oldBackground = scene.background;
		scene.background = null;
		// Alpha is only a coverage mask — "was anything drawn here" — so it wants to
		// saturate wherever geometry exists. Height itself travels in red, untouched.
		this._depthMaterial.opacity = 100;

		const oldRenderTarget = renderer.getRenderTarget();
		renderer.setRenderTarget(this._renderTargetDepth);
		renderer.render(scene, this._camera);

		scene.overrideMaterial = oldOverride;
		scene.background = oldBackground;
		this._floor.visible = true;

		this._renderLayers(renderer);
		this._blurLayers(renderer);
		this._composite(renderer);

		renderer.xr.enabled = xrEnabled;
		renderer.setRenderTarget(oldRenderTarget);
		renderer.setClearAlpha(initialClearAlpha);

		this._setIntensity();
		this._needs_render = false;
	}

	/**
	 * Draw the full-screen quad with one of the shader materials.
	 *
	 * @param {THREE.WebGLRenderer} renderer
	 * @param {THREE.Material} material
	 * @param {THREE.WebGLRenderTarget} target
	 */
	_pass(renderer, material, target) {
		this._quad.visible = true;
		this._quad.material = material;
		renderer.setRenderTarget(target);
		renderer.render(this._quad, this._camera);
		this._quad.visible = false;
	}

	/**
	 * Derive both layers from the height map into one texture.
	 *
	 * @param {THREE.WebGLRenderer} renderer
	 */
	_renderLayers(renderer) {
		const uniforms = this._layersMaterial.uniforms;
		uniforms.tDepth.value = this._renderTargetDepth.texture;
		uniforms.depthTexel.value.set(
			1 / this._renderTargetDepth.width,
			1 / this._renderTargetDepth.height
		);
		uniforms.planeSize.value.set(this._planeWidth || 1, this._planeDepth || 1);
		// Red is normalised over the shadow camera's depth range.
		uniforms.heightScale.value = this._camera.far;
		uniforms.radius.value = this._aoRadiusWorld || 0.01;

		this._pass(renderer, this._layersMaterial, this._renderTargetLayers);
	}

	/**
	 * Soften both layers, horizontally then vertically, each by its own sigma.
	 *
	 * Two passes land the result back in _renderTargetLayers, ready to composite.
	 *
	 * @param {THREE.WebGLRenderer} renderer
	 */
	_blurLayers(renderer) {
		const width = this._renderTargetLayers.width;
		const height = this._renderTargetLayers.height;
		// Texels are square in world terms — the texture aspect follows the plane
		// aspect — so one sigma is the same number of texels on either axis.
		const texelWorld = this._planeDepth / height;

		const uniforms = this._blurMaterial.uniforms;
		uniforms.sigma.value.set(
			this._contactSigmaWorld / texelWorld,
			this._generalSigmaWorld / texelWorld
		);

		uniforms.tLayers.value = this._renderTargetLayers.texture;
		uniforms.direction.value.set(1 / width, 0);
		this._pass(renderer, this._blurMaterial, this._renderTargetBlur);

		uniforms.tLayers.value = this._renderTargetBlur.texture;
		uniforms.direction.value.set(0, 1 / height);
		this._pass(renderer, this._blurMaterial, this._renderTargetLayers);
	}

	/**
	 * Combine the blurred layers into the floor's texture.
	 *
	 * @param {THREE.WebGLRenderer} renderer
	 */
	_composite(renderer) {
		const uniforms = this._compositeMaterial.uniforms;
		uniforms.tLayers.value = this._renderTargetLayers.texture;
		uniforms.contactStrength.value = this._contactStrength;
		uniforms.generalStrength.value = this._generalStrength;

		this._pass(renderer, this._compositeMaterial, this._renderTarget);
	}

	dispose() {
		this._disposeTargets();
		this._depthMaterial.dispose();
		this._layersMaterial.dispose();
		this._blurMaterial.dispose();
		this._compositeMaterial.dispose();
		this._floor.material.dispose();
		this._planeGeometry.dispose();
		this.removeFromParent();
	}
}
