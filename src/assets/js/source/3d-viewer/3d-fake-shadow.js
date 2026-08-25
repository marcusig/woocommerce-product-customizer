/**
 * Planar fake shadow (model-viewer style).
 * Renders scene depth from above to a texture, blurs it, and displays it on a ground plane.
 * No real-time shadow maps; one orthographic depth pass + horizontal/vertical blur.
 * Shared by admin 3D settings and frontend 3D viewer.
 */
import * as THREE from 'three';
import { HorizontalBlurShader } from 'three/addons/shaders/HorizontalBlurShader.js';
import { VerticalBlurShader } from 'three/addons/shaders/VerticalBlurShader.js';

/**
 * The line in three's MeshDepthMaterial fragment shader that the shadow pass
 * rewrites, so depth becomes alpha on a black plane rather than a grey value.
 * Verified against three r182.
 */
const DEPTH_FRAGMENT_TARGET = 'gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );';

const LOG_MAX_RESOLUTION = 9;
const LOG_MIN_RESOLUTION = 6;
const TAP_WIDTH = 10;

/**
 * How much wider than the model the captured area is, so the blur has somewhere
 * to spread before it runs into the edge of the texture — past which the floor
 * plane simply stops and the falloff would be cut off in a straight line.
 */
const PLANE_MARGIN = 1.25;
const DEFAULT_HARD_INTENSITY = 0.3;

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
				'gl_FragColor = vec4( vec3( 0.0 ), ( 1.0 - fragCoordZ ) * opacity );'
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
		this._renderTargetBlur = null;
		this._horizontalBlurMaterial = new THREE.ShaderMaterial(HorizontalBlurShader);
		this._verticalBlurMaterial = new THREE.ShaderMaterial(VerticalBlurShader);
		this._horizontalBlurMaterial.depthTest = false;
		this._verticalBlurMaterial.depthTest = false;

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
		this._softness = 1;
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

		// Capture the model's footprint rather than a square of its largest
		// dimension. A car is more than twice as long as it is wide, so a square
		// spent most of the texture on empty floor beside it — and the old
		// `gSize * 0.5` floor made that worse by tying the captured area to the
		// ground size, which has nothing to do with where the shadow falls. The
		// margin is room for the blur to spread into before it reaches the edge.
		this._planeWidth = Math.max(this._size.x, 0.01) * PLANE_MARGIN;
		this._planeDepth = Math.max(this._size.z, 0.01) * PLANE_MARGIN;

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

		const opacity = (ground && ground.shadow_opacity != null) ? Number(ground.shadow_opacity) : 0.5;
		const blurRaw = (ground && ground.shadow_blur != null) ? Number(ground.shadow_blur) : 0;
		this._softness = Math.min(1, Math.max(0, blurRaw / 10));
		this._intensity = opacity;

		this._setMapSize();
		this._setIntensity();
		this._needs_render = true;
	}

	_setMapSize() {
		const resolution = Math.pow(
			2,
			LOG_MAX_RESOLUTION - this._softness * (LOG_MAX_RESOLUTION - LOG_MIN_RESOLUTION)
		);
		// Texture aspect follows the captured area, not the raw model size. The two
		// used to disagree — a square capture written into a footprint-shaped
		// texture — which stretched texels along one axis and quietly halved the
		// resolution across the other.
		const planeWidth = this._planeWidth != null ? this._planeWidth : 1;
		const planeDepth = this._planeDepth != null ? this._planeDepth : 1;
		const aspect = planeWidth / Math.max(0.01, planeDepth);
		const baseWidth = Math.floor(aspect >= 1 ? resolution : resolution * aspect);
		const baseHeight = Math.floor(aspect >= 1 ? resolution / aspect : resolution);
		const width = TAP_WIDTH + Math.max(1, baseWidth);
		const height = TAP_WIDTH + Math.max(1, baseHeight);

		if (
			this._renderTarget &&
			(this._renderTarget.width !== width || this._renderTarget.height !== height)
		) {
			this._renderTarget.dispose();
			this._renderTarget = null;
			if (this._renderTargetBlur) {
				this._renderTargetBlur.dispose();
				this._renderTargetBlur = null;
			}
		}

		if (!this._renderTarget) {
			this._renderTarget = new THREE.WebGLRenderTarget(width, height, {
				format: THREE.RGBAFormat,
				type: THREE.UnsignedByteType,
			});
			this._renderTargetBlur = new THREE.WebGLRenderTarget(width, height, {
				format: THREE.RGBAFormat,
				type: THREE.UnsignedByteType,
			});
			this._floor.material.map = this._renderTarget.texture;
		}

		const scaleX = planeWidth * (1 + TAP_WIDTH / Math.max(1, baseWidth));
		const scaleZ = planeDepth * (1 + TAP_WIDTH / Math.max(1, baseHeight));
		this._camera.scale.set(scaleX, scaleZ, 1);
	}

	_setIntensity() {
		const opacity = this._intensity > 0
			? this._intensity * (DEFAULT_HARD_INTENSITY + (1 - DEFAULT_HARD_INTENSITY) * this._softness * this._softness)
			: 0;
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
		this._depthMaterial.opacity = 1 / Math.max(0.01, this._softness);

		const oldRenderTarget = renderer.getRenderTarget();
		renderer.setRenderTarget(this._renderTarget);
		renderer.render(scene, this._camera);

		scene.overrideMaterial = oldOverride;
		this._floor.visible = true;

		this._blurShadow(renderer);

		renderer.xr.enabled = xrEnabled;
		renderer.setRenderTarget(oldRenderTarget);
		renderer.setClearAlpha(initialClearAlpha);

		this._setIntensity();
		this._needs_render = false;
	}

	_blurShadow(renderer) {
		const cam = this._camera;
		const blurPlane = this._blurPlane;
		const rt = this._renderTarget;
		const rtBlur = this._renderTargetBlur;

		blurPlane.visible = true;

		blurPlane.material = this._horizontalBlurMaterial;
		this._horizontalBlurMaterial.uniforms.h.value = 1 / rt.width;
		this._horizontalBlurMaterial.uniforms.tDiffuse.value = rt.texture;
		renderer.setRenderTarget(rtBlur);
		renderer.render(blurPlane, cam);

		blurPlane.material = this._verticalBlurMaterial;
		this._verticalBlurMaterial.uniforms.v.value = 1 / rt.height;
		this._verticalBlurMaterial.uniforms.tDiffuse.value = rtBlur.texture;
		renderer.setRenderTarget(rt);
		renderer.render(blurPlane, cam);

		blurPlane.visible = false;
	}

	dispose() {
		if (this._renderTarget) this._renderTarget.dispose();
		if (this._renderTargetBlur) this._renderTargetBlur.dispose();
		this._depthMaterial.dispose();
		this._horizontalBlurMaterial.dispose();
		this._verticalBlurMaterial.dispose();
		this._floor.material.dispose();
		this._planeGeometry.dispose();
		this.removeFromParent();
	}
}
