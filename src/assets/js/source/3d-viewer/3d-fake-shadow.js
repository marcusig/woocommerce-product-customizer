/**
 * Planar fake shadow (model-viewer style).
 * Renders scene depth from above to a texture, integrates ground occlusion from it,
 * blurs that, and displays the result on a ground plane. No real-time shadow maps;
 * one orthographic depth pass, one occlusion pass, two blur passes.
 * Shared by admin 3D settings and frontend 3D viewer.
 */
import * as THREE from 'three';

/**
 * Ground occlusion, integrated from the depth pass into a deliberately small map.
 *
 * The small map is most of the idea. A ground shadow is low-frequency information
 * — a soft blob with slightly darker patches where things touch — so a map of a
 * few thousand texels holds everything there is to hold, and magnifying it over
 * the floor costs nothing to smooth.
 *
 * An earlier attempt did the opposite: a large map, few samples per texel to keep
 * the cost down, then wide blur passes to soften it. Every artifact came from
 * that combination — a 9-tap kernel spread over 60 texels leaves 15-texel gaps,
 * and gaps are what banding is. Working small inverts that: the blur that follows
 * this pass moves one texel per tap, so it has no gaps to leave.
 *
 * Small also means samples are nearly free. A car's map is a few thousand texels,
 * so 64 samples each is a few hundred thousand in total, for an operation that
 * runs only when something changes.
 *
 * For a ground point, an occluder at horizontal distance d whose underside sits at
 * height h blocks d^2 / ( d^2 + h^2 ) of the cosine-weighted hemisphere: touching
 * the floor blocks everything, high overhangs block almost nothing. That ratio is
 * what puts a tight dark patch under a tyre and leaves it open under a nose.
 */
const GroundAOShader = {
	name: 'GroundAOShader',
	uniforms: {
		tDepth: { value: null },
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
		uniform vec2 planeSize;
		uniform float heightScale;
		uniform float radius;
		varying vec2 vUv;

		const int SAMPLES = 64;
		const float GOLDEN_ANGLE = 2.39996323;

		void main() {
			float total = 0.0;

			for ( int i = 0; i < SAMPLES; i++ ) {
				float fi = float( i );
				// Vogel spiral: even coverage of the disc with no rings of its own.
				// No per-texel rotation needed — at this many samples per texel the
				// estimate is smooth without dithering it.
				float angle = fi * GOLDEN_ANGLE;
				float dist = radius * sqrt( ( fi + 0.5 ) / float( SAMPLES ) );
				vec2 uv = vUv + vec2( cos( angle ), sin( angle ) ) * dist / planeSize;
				if ( uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0 ) continue;

				vec4 depthSample = texture2D( tDepth, uv );
				// Nothing overhead: this direction sees sky.
				if ( depthSample.a <= 0.002 ) continue;

				float h = depthSample.r * heightScale;
				total += ( dist * dist ) / ( dist * dist + h * h );
			}

			// The margin above is sized so occlusion reaches zero before the texture
			// does, but a hard edge is bad enough — and subtle enough on a light
			// background — that it is worth making structurally impossible rather
			// than merely arithmetically avoided. This fades the last few percent to
			// nothing, and costs nothing when the margin is doing its job.
			vec2 toEdge = min( vUv, 1.0 - vUv );
			float edgeFade = smoothstep( 0.0, 0.08, min( toEdge.x, toEdge.y ) );
			gl_FragColor = vec4( vec3( 0.0 ), ( total / float( SAMPLES ) ) * edgeFade );
		}`,
};

/**
 * Separable Gaussian, run on the occlusion map at one texel per tap.
 *
 * This is what the softness slider drives now. It used to drive the occlusion
 * search radius instead, which is dilation, not blur: widening the search made
 * the shadow itself larger rather than softer, which is exactly how it read.
 * Radius is now fixed, so softness changes only how sharply the shadow falls off.
 *
 * A wide Gaussian is affordable here for the same reason the map is small: at
 * this size one texel per tap covers three standard deviations in sixteen taps,
 * so the kernel is continuous rather than a comb. The banding an earlier attempt
 * produced came from the opposite arrangement — a handful of taps stretched
 * across a large map, leaving gaps between them.
 *
 * Only alpha carries the shadow; rgb stays black so the floor tints nothing.
 */
const ShadowBlurShader = {
	name: 'ShadowBlurShader',
	uniforms: {
		tShadow: { value: null },
		direction: { value: new THREE.Vector2( 1, 0 ) },
		sigma: { value: 1 },
	},
	vertexShader: /* glsl */`
		varying vec2 vUv;
		void main() {
			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
		}`,
	fragmentShader: /* glsl */`
		uniform sampler2D tShadow;
		uniform vec2 direction;
		uniform float sigma;
		varying vec2 vUv;

		const int TAPS = 16;

		void main() {
			float twoSigmaSq = 2.0 * max( sigma * sigma, 0.0001 );
			float total = texture2D( tShadow, vUv ).a;
			float weightTotal = 1.0;

			for ( int i = 1; i <= TAPS; i++ ) {
				float fi = float( i );
				float weight = exp( - ( fi * fi ) / twoSigmaSq );
				vec2 step = direction * fi;
				total += ( texture2D( tShadow, vUv + step ).a + texture2D( tShadow, vUv - step ).a ) * weight;
				weightTotal += 2.0 * weight;
			}

			gl_FragColor = vec4( vec3( 0.0 ), total / weightTotal );
		}`,
};

/**
 * The line in three's MeshDepthMaterial fragment shader that the shadow pass
 * rewrites, so depth becomes alpha on a black plane rather than a grey value.
 * Verified against three r182.
 */
const DEPTH_FRAGMENT_TARGET = 'gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );';

/**
 * Long-axis size of the height map the occlusion is integrated from. Larger than
 * the shadow it produces: the shadow can be tiny because it is smooth, but the
 * heights need enough detail to tell a wheel from a sill.
 */
const DEPTH_RESOLUTION = 256;

/**
 * Long-axis size of the shadow itself. Still far below the screen size it is
 * magnified to — bilinear filtering does the fine smoothing for free — but no
 * longer as small as it was. At 64 the magnified gradients showed faceting: the
 * eye reads the linear ramps between widely spaced texels as flat panels meeting
 * at creases, which is what "blocky, with corners" was. Doubling it halves the
 * screen span of each ramp, and the blur pass below smooths what remains.
 */
const SHADOW_RESOLUTION = 128;

/**
 * Occlusion search radius as a fraction of the footprint. Fixed: this sets how
 * far from a contact point the ground still darkens, which is a property of the
 * geometry, not of the softness setting.
 *
 * It also sets how dark the shadow gets, because the integral is truncated at
 * this radius — a ground point under a car's floorpan is in reality occluded from
 * nearly every direction, and only a search wide enough to find the floorpan says
 * so. Too small and the body reads as a faint smudge with the tyres floating on
 * it; much wider and the tyres dissolve into one uniform slab and the sampling
 * pattern starts to streak. Compared at 0.045 / 0.09 / 0.15 / 0.25 of the
 * footprint against this model; 0.09 is where the body is solid and the contact
 * patches are still separate from it.
 */
const AO_RADIUS = 0.03;

/**
 * Blur standard deviation at maximum softness, as a fraction of the footprint,
 * and how much of the tail the plane has to leave room for.
 */
const MAX_BLUR_SIGMA = 0.075;
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
				// Red carries the raw normalised height for the occlusion pass; alpha
				// stays the coverage mask. They need separate channels because alpha
				// is scaled by 1/softness below and saturates across most of the
				// model, which would read back as no height at all.
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

		this._renderTarget = null;
		// The height map the occlusion is integrated from, kept at its own larger size.
		this._renderTargetDepth = null;
		// Ping-pong partner for the separable blur, same size as the shadow itself.
		// Allocated only if softness is ever asked for.
		this._renderTargetBlur = null;
		this._aoMaterial = new THREE.ShaderMaterial(GroundAOShader);
		this._aoMaterial.uniforms = THREE.UniformsUtils.clone(GroundAOShader.uniforms);
		this._aoMaterial.depthTest = false;
		this._blurMaterial = new THREE.ShaderMaterial(ShadowBlurShader);
		this._blurMaterial.uniforms = THREE.UniformsUtils.clone(ShadowBlurShader.uniforms);
		this._blurMaterial.depthTest = false;

		// One geometry shared by the floor and the blur quad; disposed once, via
		// this reference, rather than through both meshes.
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

		this._blurPlane = new THREE.Mesh(this._planeGeometry);
		this._blurPlane.visible = false;
		this._camera.add(this._blurPlane);

		this._boundingBox = new THREE.Box3();
		this._size = new THREE.Vector3();
		this._intensity = 0;
		this._blurSigmaWorld = 0;
		this._enabled = true;
		this._needs_render = true;

		scene.add(this);
	}

	/**
	 * Mark the depth/blur passes dirty so the next render() rebuilds the shadow texture.
	 * Call when model visibility, transforms, or ground settings change — not every frame.
	 */
	invalidate() {
		this._needs_render = true;
	}

	/**
	 * Update shadow size, position, intensity and softness from model and ground settings.
	 * @param {THREE.Object3D} modelRoot - Model to fit (e.g. gltf.scene).
	 * @param {Object} ground - { enabled, size, shadow_opacity, shadow_blur } (shadow_blur 0–10 mapped to softness 0–1).
	 */
	update(modelRoot, ground) {
		if (!modelRoot) return;

		this._boundingBox.setFromObject(modelRoot);
		this._size.copy(this._boundingBox.getSize(new THREE.Vector3()));
		const center = this._boundingBox.getCenter(new THREE.Vector3());

		this.position.set(center.x, this._boundingBox.min.y, center.z);

		const opacity = (ground && ground.shadow_opacity != null) ? Number(ground.shadow_opacity) : 0.5;
		const blurRaw = (ground && ground.shadow_blur != null) ? Number(ground.shadow_blur) : 0;
		const softness = Math.min(1, Math.max(0, blurRaw / 10));

		// Capture the model's footprint rather than a square of its largest
		// dimension. A car is more than twice as long as it is wide, so a square
		// spent most of the texture on empty floor beside it — and the old
		// `gSize * 0.5` floor made that worse by tying the captured area to the
		// ground size, which has nothing to do with where the shadow falls.
		//
		// Margin is derived from the occlusion radius, not a proportion of each axis.
		// A proportional margin gave the short axis less room than the search needed
		// — on a car, 0.27 of margin against a 0.36 radius — so occlusion was still
		// non-zero at the very edge of the texture and stopped there in a straight
		// line. Radius itself comes from the geometric mean of the footprint so one
		// long axis cannot dictate a margin the short one has to absorb.
		const footprint = Math.sqrt(Math.max(this._size.x, 0.01) * Math.max(this._size.z, 0.01));
		this._aoRadiusWorld = footprint * AO_RADIUS;
		this._blurSigmaWorld = footprint * MAX_BLUR_SIGMA * softness;

		// The margin allows for the widest blur the slider can ask for, whether or
		// not this setting asks for it. Sizing it to the current softness instead
		// would make the plane — and so the texel size, and so the amount of detail
		// captured — change every time the slider moves, which is the other half of
		// why blurring used to look like scaling.
		const margin = footprint * (AO_RADIUS * 1.35 + MAX_BLUR_SIGMA * BLUR_TAIL_SIGMAS);
		this._planeWidth = Math.max(this._size.x, 0.01) + margin * 2;
		this._planeDepth = Math.max(this._size.z, 0.01) + margin * 2;

		this._camera.near = 0;
		// Depth becomes the shadow's darkness — alpha is ( 1 - fragCoordZ ) * opacity
		// — so the far plane decides how fast the shadow fades with height. It used
		// to be twice the largest dimension, which for anything wider than it is
		// tall crushed the whole model into the first sliver of the range: on a car
		// the roof came out at 0.86 of full darkness against the tyres' 1.0, so
		// nothing separated contact from the bodywork above it and the result read
		// as one flat blob. Fitting it to the model's height spends the full range
		// where it matters.
		this._camera.far = Math.max(this._size.y, 0.01) * 1.05;
		this._camera.updateProjectionMatrix();

		this._enabled = ground && ground.enabled !== false;
		this.visible = this._enabled;

		this._intensity = opacity;

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
			this._renderTarget.dispose();
			this._renderTarget = null;
			if (this._renderTargetDepth) {
				this._renderTargetDepth.dispose();
				this._renderTargetDepth = null;
			}
			if (this._renderTargetBlur) {
				this._renderTargetBlur.dispose();
				this._renderTargetBlur = null;
			}
		}

		if (!this._renderTarget) {
			this._renderTarget = new THREE.WebGLRenderTarget(shadow.width, shadow.height, {
				format: THREE.RGBAFormat,
				type: THREE.UnsignedByteType,
			});
			// Bilinear is what turns this handful of texels into a smooth shadow once
			// it is stretched over the floor. It is the whole smoothing strategy.
			this._renderTarget.texture.minFilter = THREE.LinearFilter;
			this._renderTarget.texture.magFilter = THREE.LinearFilter;
			this._renderTargetDepth = new THREE.WebGLRenderTarget(depth.width, depth.height, {
				format: THREE.RGBAFormat,
				type: THREE.UnsignedByteType,
			});
			this._floor.material.map = this._renderTarget.texture;
		}

		// Captured area and plane are the same thing: the margin baked into the plane
		// size is what the blur tail spreads into, so there is nothing extra to pad.
		this._camera.scale.set( planeWidth, planeDepth, 1 );
	}

	_setIntensity() {
		// Straight through: the occlusion pass produces a calibrated 0..1 coverage,
		// unlike the old depth pass which multiplied alpha by 1/softness and
		// saturated it. That saturation is what the 0.3 + 0.7 * softness^2 ramp used
		// to compensate for, and with it gone the ramp would just be throwing away
		// most of whatever opacity was asked for.
		const opacity = this._intensity > 0 ? this._intensity : 0;
		this._floor.visible = this._intensity > 0;
		this._floor.material.opacity = opacity;
	}

	/**
	 * Render depth pass and blur; updates the floor texture. Call before the main scene render.
	 * Skips the expensive depth/blur passes when nothing has changed since the last render.
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
		// Alpha is only a coverage mask now — "was anything drawn here" — so it wants
		// to saturate wherever geometry exists. It used to be scaled by 1/softness,
		// which at full softness left anything near the top of the model reading as
		// empty sky. Height itself travels in red, untouched by this.
		this._depthMaterial.opacity = 100;

		const oldRenderTarget = renderer.getRenderTarget();
		renderer.setRenderTarget(this._renderTargetDepth);
		renderer.render(scene, this._camera);

		scene.overrideMaterial = oldOverride;
		scene.background = oldBackground;
		this._floor.visible = true;

		this._renderOcclusion(renderer);

		renderer.xr.enabled = xrEnabled;
		renderer.setRenderTarget(oldRenderTarget);
		renderer.setClearAlpha(initialClearAlpha);

		this._setIntensity();
		this._needs_render = false;
	}

	/**
	 * Integrate the height map into the shadow, then soften it.
	 *
	 * @param {THREE.WebGLRenderer} renderer
	 */
	_renderOcclusion(renderer) {
		const uniforms = this._aoMaterial.uniforms;
		uniforms.tDepth.value = this._renderTargetDepth.texture;
		uniforms.planeSize.value.set(this._planeWidth || 1, this._planeDepth || 1);
		// Red is normalised over the shadow camera's depth range, which is fitted to
		// the model's height.
		uniforms.heightScale.value = this._camera.far;
		uniforms.radius.value = this._aoRadiusWorld || 0.01;

		this._blurPlane.visible = true;
		this._blurPlane.material = this._aoMaterial;
		renderer.setRenderTarget(this._renderTarget);
		renderer.render(this._blurPlane, this._camera);
		this._blurPlane.visible = false;

		this._blurOcclusion(renderer);
	}

	/**
	 * Soften the occlusion map in place, horizontally then vertically.
	 *
	 * Two passes land the result back in _renderTarget, which is the texture the
	 * floor is already showing, so nothing downstream has to know this ran.
	 *
	 * @param {THREE.WebGLRenderer} renderer
	 */
	_blurOcclusion(renderer) {
		const sigmaWorld = this._blurSigmaWorld || 0;
		if (sigmaWorld <= 0) return;

		const width = this._renderTarget.width;
		const height = this._renderTarget.height;

		if (!this._renderTargetBlur) {
			this._renderTargetBlur = new THREE.WebGLRenderTarget(width, height, {
				format: THREE.RGBAFormat,
				type: THREE.UnsignedByteType,
			});
			this._renderTargetBlur.texture.minFilter = THREE.LinearFilter;
			this._renderTargetBlur.texture.magFilter = THREE.LinearFilter;
		}

		// Texels are square in world terms — the texture aspect follows the plane
		// aspect — so one sigma is the same number of texels on either axis.
		const sigmaTexels = sigmaWorld / (this._planeDepth / height);

		const uniforms = this._blurMaterial.uniforms;
		uniforms.sigma.value = sigmaTexels;

		this._blurPlane.visible = true;
		this._blurPlane.material = this._blurMaterial;

		uniforms.tShadow.value = this._renderTarget.texture;
		uniforms.direction.value.set(1 / width, 0);
		renderer.setRenderTarget(this._renderTargetBlur);
		renderer.render(this._blurPlane, this._camera);

		uniforms.tShadow.value = this._renderTargetBlur.texture;
		uniforms.direction.value.set(0, 1 / height);
		renderer.setRenderTarget(this._renderTarget);
		renderer.render(this._blurPlane, this._camera);

		this._blurPlane.visible = false;
	}

	dispose() {
		if (this._renderTarget) this._renderTarget.dispose();
		if (this._renderTargetDepth) this._renderTargetDepth.dispose();
		if (this._renderTargetBlur) this._renderTargetBlur.dispose();
		this._depthMaterial.dispose();
		this._aoMaterial.dispose();
		this._blurMaterial.dispose();
		this._floor.material.dispose();
		this._planeGeometry.dispose();
		this.removeFromParent();
	}
}
