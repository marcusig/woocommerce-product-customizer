/**
 * Planar fake shadow (model-viewer style).
 * Renders scene depth from above to a texture, blurs it, and displays it on a ground plane.
 * No real-time shadow maps; one orthographic depth pass + horizontal/vertical blur.
 */
import * as THREE from 'three';
import { HorizontalBlurShader } from 'three/addons/shaders/HorizontalBlurShader.js';
import { VerticalBlurShader } from 'three/addons/shaders/VerticalBlurShader.js';

const LOG_MAX_RESOLUTION = 9;
const LOG_MIN_RESOLUTION = 6;
const TAP_WIDTH = 10;
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
			shader.fragmentShader = shader.fragmentShader.replace(
				'gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );',
				'gl_FragColor = vec4( vec3( 0.0 ), ( 1.0 - fragCoordZ ) * opacity );'
			);
		};

		this._renderTarget = null;
		this._renderTargetBlur = null;
		this._horizontalBlurMaterial = new THREE.ShaderMaterial(HorizontalBlurShader);
		this._verticalBlurMaterial = new THREE.ShaderMaterial(VerticalBlurShader);
		this._horizontalBlurMaterial.depthTest = false;
		this._verticalBlurMaterial.depthTest = false;

		const planeGeometry = new THREE.PlaneGeometry(1, 1);
		this._floor = new THREE.Mesh(
			planeGeometry,
			new THREE.MeshBasicMaterial({
				transparent: true,
				opacity: 1,
				side: THREE.BackSide,
				color: 0x000000,
				alphaTest: 0.01,
				depthWrite: false,
			})
		);
		this._floor.userData.noHit = true;
		this._camera.add(this._floor);

		this._blurPlane = new THREE.Mesh(planeGeometry);
		this._blurPlane.visible = false;
		this._camera.add(this._blurPlane);

		this._boundingBox = new THREE.Box3();
		this._size = new THREE.Vector3();
		this._intensity = 0;
		this._softness = 1;
		this._enabled = true;

		scene.add(this);
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

		const gSize = (ground && typeof ground.size === 'number') ? ground.size : 10;
		const maxDim = Math.max(this._size.x, this._size.y, this._size.z, 1);
		this._planeSize = Math.max(maxDim * 1.2, gSize * 0.5);
		this._camera.near = 0;
		this._camera.far = maxDim * 2;
		this._camera.updateProjectionMatrix();

		this._enabled = ground && ground.enabled !== false;
		this.visible = this._enabled;

		const opacity = (ground && ground.shadow_opacity != null) ? Number(ground.shadow_opacity) : 0.5;
		const blurRaw = (ground && ground.shadow_blur != null) ? Number(ground.shadow_blur) : 0;
		this._softness = Math.min(1, Math.max(0, blurRaw / 10));
		this._intensity = opacity;

		this._setMapSize();
		this._setIntensity();
	}

	_setMapSize() {
		const resolution = Math.pow(
			2,
			LOG_MAX_RESOLUTION - this._softness * (LOG_MAX_RESOLUTION - LOG_MIN_RESOLUTION)
		);
		const baseWidth = Math.floor(this._size.x > this._size.z ? resolution : resolution * Math.max(0.01, this._size.x) / Math.max(0.01, this._size.z));
		const baseHeight = Math.floor(this._size.x > this._size.z ? resolution * Math.max(0.01, this._size.z) / Math.max(0.01, this._size.x) : resolution);
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

		const planeSize = this._planeSize != null ? this._planeSize : 1;
		const scaleX = planeSize * (1 + TAP_WIDTH / Math.max(1, baseWidth));
		const scaleZ = planeSize * (1 + TAP_WIDTH / Math.max(1, baseHeight));
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
	 * @param {THREE.WebGLRenderer} renderer
	 * @param {THREE.Scene} scene - Full scene containing the model.
	 */
	render(renderer, scene) {
		if (!this._enabled || !this._renderTarget || this._intensity <= 0) {
			this._floor.visible = false;
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
		this._floor.geometry.dispose();
		this._blurPlane.geometry.dispose();
		this.removeFromParent();
	}
}
