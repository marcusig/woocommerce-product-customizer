/**
 * Admin 3D preview/scene methods mixin for PC.views.settings_3d.
 * Imported by 3d-settings.js.
 */

import { start_animation_loop } from '../../../../js/source/3d-viewer/3d-animation-loop.js';
import { create_render_quality } from '../../../../js/source/3d-viewer/3d-render-quality.js';
import { format_gltf_load_notice, normalize_gltf_load_error } from '../../../../js/source/3d-viewer/3d-gltf-load-error.js';
import { create_light_editor, helper_size_for, modes_for, vector_to_setting, euler_to_setting } from './3d-light-editor.js';

const $ = window.jQuery;

function get_three() {
	return window.PC && window.PC.threeD && typeof window.PC.threeD.getTHREE === 'function'
		? window.PC.threeD.getTHREE()
		: null;
}

function get_three_deps() {
	return window.PC && window.PC.threeD && typeof window.PC.threeD.getThreeDeps === 'function'
		? window.PC.threeD.getThreeDeps()
		: null;
}

export const settings_3d_preview_mixin = {
	/**
	 * Resolve the environment map URL for the preview.
	 *
	 * Delegates to the same getHdrUrlFromEnv the frontend viewer uses, passing the
	 * admin's objects3d collection as the lookup source. The preview previously had
	 * its own copy of this logic, which had drifted: it treated a cubemap with a
	 * missing face as valid (the emptiness check compared against null, but a
	 * missing face reads as undefined) and returned no environment in cases where
	 * the frontend falls back to the preset.
	 *
	 * @param {Object} env - settings_3d.environment
	 * @returns {string|string[]|null} URL, cubemap URL array, or null to skip load
	 */
	get_env_url_for_preview: function ( env ) {
		const deps = get_three_deps();
		if ( ! deps || typeof deps.getHdrUrlFromEnv !== 'function' ) return null;
		const hdr_base = ( typeof PC_lang !== 'undefined' && PC_lang.hdr_base_url ) ? PC_lang.hdr_base_url : '';
		const col = PC.app.get_collection ? PC.app.get_collection( 'objects3d' ) : null;
		const objects3d = col && typeof col.toJSON === 'function' ? col.toJSON() : null;
		return deps.getHdrUrlFromEnv( env, hdr_base, objects3d );
	},
	/**
	 * Push the current settings_3d onto the live preview scene.
	 *
	 * Renderer, background, environment, orbit limits, ground and light intensity
	 * are all applied by applySettingsToScene — the same function the frontend
	 * viewer uses. The preview had its own copy of this logic and the two had
	 * already drifted (cubemap validation, environment fallbacks), which is what
	 * makes a preview stop matching what customers actually see.
	 *
	 * Only the genuinely admin-only parts stay here: the zoom buttons, the shadow
	 * toggle and the postprocessing rebuild.
	 */
	/**
	 * Ask the preview for a frame.
	 *
	 * The preview renders on demand now, so anything that changes the scene has to
	 * say so. The settings panel is a wide surface — colours, sliders, model
	 * visibility, light gizmos — so as well as the explicit calls at the points
	 * below, render_preview binds a catch-all to the panel: two frames per
	 * interaction costs nothing and means a control nobody remembered to wire up
	 * still updates the view.
	 */
	request_preview_render: function () {
		if ( this._three && this._three.quality ) this._three.quality.request();
	},
	apply_preview_settings: function () {
		const deps = get_three_deps();
		if ( ! deps || typeof deps.applySettingsToScene !== 'function' ) return;
		if ( !this._three || !this._three.scene || !this._three.renderer ) return;

		const s = PC.app.admin.settings_3d;
		const t = this._three;
		const col = PC.app.get_collection ? PC.app.get_collection( 'objects3d' ) : null;

		// The shared function tracks the loaded environment through this ref.
		const env_url_ref = {
			get current() { return t.current_env_url; },
			set current( v ) { t.current_env_url = v; },
		};
		// Same idea for a `background.mode: 'image'` texture.
		const bg_image_ref = {
			get current() { return t.current_bg_image_url; },
			set current( v ) { t.current_bg_image_url = v; },
			get texture() { return t.bg_image_texture; },
			set texture( v ) { t.bg_image_texture = v; },
		};

		deps.applySettingsToScene( t.scene, t.renderer, t.controls, s, {
			fakeShadow: t.fake_shadow,
			modelRoot: t.model_root,
			getHdrBaseUrl: () => ( ( typeof PC_lang !== 'undefined' && PC_lang.hdr_base_url ) ? PC_lang.hdr_base_url : '' ),
			currentEnvUrlRef: env_url_ref,
			// The admin resolves environment objects against the live collection
			// being edited, not the saved product data.
			objects3d: col && typeof col.toJSON === 'function' ? col.toJSON() : null,
			onEnvLoaded: () => {
				this._removePreviewLoadingStep( 'hdr' );
				this.apply_preview_settings();
			},
			onEnvError: () => this._removePreviewLoadingStep( 'hdr' ),
			currentBgImageRef: bg_image_ref,
			onBgImageLoaded: () => this.apply_preview_settings(),
		} );

		this.update_zoom_buttons_state();

		// Real-time shadows: re-applied on every settings change so the toggle takes
		// effect immediately, rather than only when the preview is next rebuilt.
		this.apply_shadow_settings();

		// Postprocessing: build or update the composer from settings (order: SSR → AO → Bloom → SMAA); loads passes async
		this.setup_preview_postprocessing();
		this.request_preview_render();
	},
	/**
	 * Mirror settings_3d.enable_shadows onto the live preview: renderer flag, mesh
	 * flags and every light, with each shadow camera refitted to the model bounds.
	 */
	apply_shadow_settings: function () {
		const t = this._three;
		if ( ! t || ! t.renderer || ! t.scene ) return;
		if ( ! PC.threeD || typeof PC.threeD.refreshSceneShadows !== 'function' ) return;
		const deps = get_three_deps();
		if ( ! deps || typeof deps.resolveShadowMode !== 'function' ) return;
		const s = PC.app.admin.settings_3d;
		const ground = s.ground || {};
		const realtime = deps.resolveShadowMode( s ) === deps.SHADOW_MODES.REALTIME;
		const softness = Math.min( 1, Math.max( 0, ( Number( ground.shadow_blur ) || 0 ) / 10 ) );

		if ( realtime && ground.shadow_light !== false && ! t.shadow_light && typeof PC.threeD.createShadowLight === 'function' ) {
			// Built on first use rather than at scene setup: a preview that never
			// switches to real-time shadows should not carry a shadow camera around.
			t.shadow_light = PC.threeD.createShadowLight();
			t.scene.add( t.shadow_light );
			t.scene.add( t.shadow_light.target );
		}
		if ( realtime && ground.shadow_catcher === true && ! t.shadow_catcher && typeof PC.threeD.ShadowCatcher === 'function' ) {
			t.shadow_catcher = new PC.threeD.ShadowCatcher();
			t.scene.add( t.shadow_catcher );
		}

		if ( t.shadow_light ) {
			// See main-viewer: optional caster, and cast_shadows has to move with
			// visibility because refreshSceneShadows keys the camera fit off it.
			const useShadowLight = realtime && ground.shadow_light !== false;
			t.shadow_light.visible = useShadowLight;
			t.shadow_light.userData.cast_shadows = useShadowLight;
			const THREE_ = get_three();
			if ( useShadowLight && t.model_root && THREE_ && typeof PC.threeD.aimShadowLight === 'function' ) {
				const bounds = new THREE_.Box3().setFromObject( t.model_root );
				if ( ! bounds.isEmpty() ) {
					PC.threeD.aimShadowLight( t.shadow_light, bounds, {
						elevation: ground.shadow_elevation,
						azimuth: ground.shadow_azimuth,
					} );
				}
			}
		}

		// Fitted against the light's final direction, and before the catcher, which
		// is sized from the frustum this produces.
		// One number for both the frustum fit and the catcher — see main-viewer.
		var THREE_g = get_three();
		var groundExtent = ( t.model_root && THREE_g && typeof PC.threeD.shadowGroundExtent === 'function' )
			? PC.threeD.shadowGroundExtent(
				new THREE_g.Box3().setFromObject( t.model_root ).getSize( new THREE_g.Vector3() ),
				ground.shadow_elevation != null ? ground.shadow_elevation : 55,
				ground.size
			)
			: 0;

		PC.threeD.refreshSceneShadows( {
			renderer: t.renderer,
			scene: t.scene,
			modelRoot: t.model_root,
			enabled: realtime,
			groundExtent: groundExtent,
			// The same slider the fake shadow uses, so softness means one thing
			// whichever kind of shadow a product is set up with.
			softness: softness,
		} );

		if ( t.shadow_catcher ) {
			// After the fit — see main-viewer: the plane is clamped to the frustum's
			// own reach, because outside it there is no shadow and the boundary
			// shows as a hard line.
			const wantsCatcher = realtime && ground.shadow_catcher === true;
			const placed = wantsCatcher && t.shadow_catcher.update( t.model_root, {
				opacity: ground.shadow_opacity != null ? ground.shadow_opacity : 0.5,
				size: ground.size,
				elevation: ground.shadow_elevation != null ? ground.shadow_elevation : 55,
			} );
			t.shadow_catcher.visible = !! placed;
		}


		// The map is baked, so a settings or geometry change has to ask for a new one.
		if ( typeof PC.threeD.invalidateBakedShadows === 'function' ) {
			PC.threeD.invalidateBakedShadows( t.renderer );
		}
		this.request_preview_render();
	},
	setup_preview_postprocessing: async function () {
		// A rebuild loads pass modules asynchronously. Coalesce anything that
		// arrives meanwhile into a single reconcile once the build settles.
		if ( this._pp_building ) {
			this._pp_dirty = true;
			return;
		}
		const deps = get_three_deps();
		if ( ! deps ) return;
		let createPostprocessingLayer = deps.createPostprocessingLayer;
		if ( typeof createPostprocessingLayer !== 'function'
			&& window.wp && window.wp.hooks && typeof window.wp.hooks.applyFilters === 'function' ) {
			createPostprocessingLayer = window.wp.hooks.applyFilters( 'PC.3d.createPostprocessingLayer', null );
		}
		if ( typeof createPostprocessingLayer !== 'function' ) return;
		if ( !this._three || !this._three.scene || !this._three.camera || !this._three.renderer ) return;
		const s = PC.app.admin.settings_3d;
		const pp = ( s && s.postprocessing ) ? s.postprocessing : {};
		const scene = this._three.scene;
		const camera = this._three.camera;
		const renderer = this._three.renderer;
		const container = this.$( '.pc-3d-preview--canvas-container' )[0];
		if ( !container ) return;
		const w = container.clientWidth || 1;
		const h = container.clientHeight || 1;

		const options = {
			width: w,
			height: h,
			// The add-on resolves presets and per-effect values from the raw settings.
			settings: pp,
			isMobile: false,
			boundsObject: () => this._three && this._three.model_root,
		};

		// Tuning a slider fires on every input event: update the existing passes in
		// place instead of tearing down and reallocating the composer each time.
		const existing = this._three.postprocessingLayer;
		if ( existing && typeof existing.updateOptions === 'function' && existing.updateOptions( options ) ) {
			return;
		}

		if ( existing ) {
			existing.dispose();
			this._three.postprocessingLayer = null;
			this._three.composer = null;
		}

		this._pp_building = true;
		let layer = null;
		try {
			layer = await createPostprocessingLayer( renderer, scene, camera, options );
		} finally {
			this._pp_building = false;
		}

		// The preview can be torn down while the passes are loading.
		if ( ! this._three ) {
			if ( layer ) layer.dispose();
			return;
		}

		this._three.postprocessingLayer = layer;
		this._three.composer = layer ? layer.composer : null;
		// A rebuilt chain renders nothing until asked, and its buffers are new.
		this._three.quality.applyQuality();
		this._three.quality.invalidate();

		if ( this._pp_dirty ) {
			this._pp_dirty = false;
			return this.setup_preview_postprocessing();
		}
	},
	/**
	 * Set the lens shift of a fitted angle and re-apply the view offset it rides on.
	 *
	 * @param {{x: number, y: number}|null} shift - Tangent units; null for none
	 */
	_setPreviewFramingShift: function ( shift ) {
		const t = this._three;
		if ( ! t || ! t.framing_shift ) return;
		t.framing_shift.x = shift ? shift.x : 0;
		t.framing_shift.y = shift ? shift.y : 0;
		this._applyPreviewViewOffset();
		if ( t.quality ) t.quality.invalidate();
	},

	/**
	 * Apply the camera view offset: the framing lens shift plus optional
	 * accumulation jitter. One call for both, because setViewOffset replaces
	 * rather than adds - the same constraint as the frontend's
	 * apply_camera_view_offset.
	 *
	 * @param {{x: number, y: number}} [jitter] - In CSS pixels
	 */
	_applyPreviewViewOffset: function ( jitter ) {
		const t = this._three;
		if ( ! t || ! t.camera || ! t.container ) return;
		const cam = t.camera;
		const w = Math.max( 1, t.container.clientWidth );
		const h = Math.max( 1, t.container.clientHeight );
		const deps = get_three_deps();
		const shift = deps && deps.cameraFit
			? deps.cameraFit.framing_shift_to_pixels( t.framing_shift, cam.fov, w, h )
			: { x: 0, y: 0 };
		const x = shift.x + ( jitter ? jitter.x : 0 );
		const y = shift.y + ( jitter ? jitter.y : 0 );
		if ( x === 0 && y === 0 ) {
			cam.clearViewOffset();
		} else {
			cam.setViewOffset( w, h, x, y, w, h );
		}
		cam.updateProjectionMatrix();
	},

	on_window_resize: function () {

	},
	/**
	 * Tear the preview scene down.
	 *
	 * Ends by dropping the _three reference. Several async callbacks — the model
	 * store, the postprocessing build, onAllLoaded — guard on `!this._three` to
	 * detect exactly this, and while the reference survived teardown none of them
	 * could ever fire: composers were attached to disposed renderers and models
	 * finished loading into a scene that was already gone.
	 */
	/**
	 * Hide the objects named in Display > Hidden objects, and show again any the
	 * previous list hid.
	 *
	 * Only what this hid is shown again. An object can be hidden for other
	 * reasons - a lazy model, a box unticked in the scene tree - and those are
	 * not this list's to undo. The list used to be read once, when the scene
	 * loaded, so a change only showed after leaving 3D settings and coming back.
	 *
	 * @param {Object} [options]
	 * @param {boolean} [options.refresh=true] - Sync the tree and the shadows. Off
	 *        while the scene is still being assembled, before either exists.
	 */
	apply_preview_hidden_objects: function ( options = {} ) {
		const t = this._three;
		const deps = get_three_deps();
		if ( ! t || ! t.model_root || ! deps || typeof deps.getHiddenObjectNamesList !== 'function' ) return;
		const defaultHidden = ( typeof PC_lang !== 'undefined' && PC_lang.default_hidden_object_names ) ? PC_lang.default_hidden_object_names : null;
		const customHidden = ( this.admin && this.admin.settings_3d && this.admin.settings_3d.hidden_object_names ) || '';
		const names = new Set( deps.getHiddenObjectNamesList( defaultHidden, customHidden ) );

		const previous = t.hidden_by_name || new Set();
		const now = new Set();
		t.model_root.traverse( ( obj ) => {
			if ( ! obj.name || ! names.has( obj.name ) ) return;
			// Hidden by the list before and still on it: still ours.
			if ( previous.has( obj ) ) {
				now.add( obj );
			} else if ( obj.visible ) {
				obj.visible = false;
				now.add( obj );
			}
		} );
		previous.forEach( ( obj ) => {
			if ( ! now.has( obj ) ) obj.visible = true;
		} );
		t.hidden_by_name = now;

		if ( options.refresh === false ) return;
		this.$( '.pc-3d-tree-item' ).each( function () {
			const obj = $( this ).data( 'object3d' );
			if ( obj ) $( this ).children( '.pc-3d-tree-visible' ).prop( 'checked', obj.visible !== false );
		} );
		if ( t.fake_shadow && typeof t.fake_shadow.invalidate === 'function' ) t.fake_shadow.invalidate();
		// Real-time shadow cameras are fitted to what is visible.
		this.apply_shadow_settings();
		if ( t.quality ) t.quality.invalidate();
	},

	/**
	 * Give add-ons that place models (3D Premium) a placement manager for the
	 * preview, and let them file their requests: the same engine as the product
	 * page. Choices are not applied here: the preview shows the product as it
	 * starts. Add-ons call `refresh` from the payload when their settings change.
	 */
	apply_model_positions: function () {
		const t = this._three;
		const THREE = get_three();
		if ( ! t || ! t.model_root || ! THREE ) return;
		if ( ! window.wp || ! window.wp.hooks || ! window.wp.hooks.hasAction( 'PC.admin.3d_preview.placement' ) ) return;
		const col = PC.app.get_collection ? PC.app.get_collection( 'objects3d' ) : null;
		if ( ! col ) return;
		if ( t.placement ) t.placement.reset();
		const root = t.model_root;
		if ( ! t.parking_group ) {
			t.parking_group = new THREE.Group();
			t.parking_group.name = '__pc_parked';
			t.parking_group.visible = false;
			root.add( t.parking_group );
		}
		const by_id = {};
		const defaultHidden = ( typeof PC_lang !== 'undefined' && PC_lang.default_hidden_object_names ) ? PC_lang.default_hidden_object_names : null;
		const customHidden = ( this.admin && this.admin.settings_3d && this.admin.settings_3d.hidden_object_names ) || '';
		const deps = get_three_deps();
		const placement = deps && deps.anchorPlacement;
		if ( ! placement ) return;
		const hidden_names = typeof deps.getHiddenObjectNamesList === 'function' ? deps.getHiddenObjectNamesList( defaultHidden, customHidden ) : [];
		root.children.forEach( ( c ) => {
			if ( ! c.userData || c.userData.object_id == null ) return;
			by_id[ String( c.userData.object_id ) ] = c;
			// Same attachment point as the product page: the single top-level object's origin.
			if ( c.userData.pc_attach_point === undefined ) c.userData.pc_attach_point = placement.model_attachment_point( c, hidden_names );
		} );
		t.placement = placement.create_anchor_placement( {
			resolve_object: ( id ) => deps.findObjectByCompositeId( root, id ),
			resolve_model: ( oid ) => by_id[ String( oid ) ] || null,
			get_parking_parent: () => t.parking_group,
			warn: () => {},
		} );
		window.wp.hooks.doAction( 'PC.admin.3d_preview.placement', {
			placement: t.placement,
			objects3d: col.toJSON(),
			model_root: root,
			utils: {
				compare_priority: placement.compare_priority,
				normalize_anchor_ids: placement.normalize_anchor_ids,
				read_follow_flag: placement.read_follow_flag,
			},
			refresh: () => {
				if ( this._three && this._three.model_root ) this.apply_model_positions();
			},
		} );
		this.request_preview_render();
	},

	/**
	 * Helpers for every light, and the gizmo that moves them.
	 *
	 * @param {Object} THREE
	 * @param {Object} deps - getThreeDeps()
	 * @param {number} diagonal - Model bounding-box diagonal, 0 when unknown
	 * @returns {Object} light editor
	 */
	_create_light_editor: function ( THREE, deps, diagonal ) {
		const t = this._three;
		return create_light_editor( {
			THREE,
			TransformControls: deps.TransformControls,
			RectAreaLightHelper: deps.RectAreaLightHelper,
			scene: t.scene,
			camera: t.camera,
			dom: t.renderer.domElement,
			orbit: t.controls,
			size: helper_size_for( diagonal ),
			request_render: () => this.request_preview_render(),
			on_change: ( entry ) => {
				this._on_light_changed();
				this._sync_light_position_fields( entry );
			},
			on_commit: ( entry, handle ) => this._commit_light_edit( entry, handle ),
			on_select: () => {
				this._render_light_edit_ui();
				this._render_lights_panel();
			},
			on_hover: ( entry ) => this._sync_light_row_hover( entry ),
		} );
	},

	/** The lighting changed: a still being refined, and baked shadows, are out of date. */
	_on_light_changed: function () {
		const t = this._three;
		if ( ! t ) return;
		if ( t.quality ) t.quality.invalidate();
		if ( typeof PC.threeD.invalidateBakedShadows === 'function' ) {
			PC.threeD.invalidateBakedShadows( t.renderer );
		}
	},

	/** Lights are placed from the Environment section, and only there. */
	_light_editing_active: function () {
		return this.$( '.pc-3d-section-panel.active' ).data( 'section-id' ) === 'environment';
	},

	/**
	 * Show the helpers and allow editing when the Environment section is open,
	 * hide them everywhere else. Leaving the section drops the selection.
	 */
	_sync_light_editing: function () {
		const editor = this._three && this._three.light_editor;
		if ( editor ) editor.set_enabled( this._light_editing_active() );
		this._render_light_edit_ui();
		this._render_lights_panel();
	},

	/**
	 * Write a dragged light back to its objects3d model.
	 *
	 * @param {Object} entry - Light editor entry
	 * @param {string} handle - 'light' or 'target'
	 */
	_commit_light_edit: function ( entry, handle ) {
		if ( ! entry || ! entry.model ) return;
		const light = entry.light;
		if ( handle === 'target' ) {
			entry.model.set( 'light_target', vector_to_setting( light.target.position ) );
		} else if ( this._three && this._three.light_editor && this._three.light_editor.mode === 'rotate' ) {
			entry.model.set( 'rect_rotation', euler_to_setting( light.rotation ) );
		} else {
			entry.model.set( 'light_position', vector_to_setting( light.position ) );
		}
		this.mark_dirty( 'objects3d' );
		// Shadow cameras are fitted along the light's direction, which just changed.
		this.apply_shadow_settings();
	},

	/**
	 * The panel over the canvas: a hint while nothing is selected, the selected
	 * light's name and modes while something is.
	 */
	_render_light_edit_ui: function () {
		const t = this._three;
		const container = t && t.container;
		if ( ! container ) return;
		let panel = container.querySelector( '.pc-3d-light-edit' );
		const editor = t.light_editor;
		if ( ! editor || ! editor.entries.length || ! editor.enabled ) {
			if ( panel ) panel.remove();
			return;
		}
		if ( ! panel ) {
			panel = document.createElement( 'div' );
			panel.className = 'pc-3d-light-edit';
			container.appendChild( panel );
		}
		const lang = ( key, fallback ) => ( typeof PC_lang !== 'undefined' && PC_lang[ key ] ) ? PC_lang[ key ] : fallback;
		panel.textContent = '';
		const entry = editor.selected;
		panel.classList.toggle( 'is-active', !! entry );
		if ( ! entry ) {
			panel.textContent = lang( 'light_edit_hint', 'Click a light to move it' );
			return;
		}

		const handle = editor.selected_handle;
		const name = entry.light.name || 'Light';
		const title = document.createElement( 'strong' );
		title.className = 'pc-3d-light-edit__name';
		title.textContent = handle === 'target' ? lang( 'light_edit_target_of', 'Target of %s' ).replace( '%s', name ) : name;
		panel.appendChild( title );

		const modes = modes_for( entry.light, handle );
		if ( modes.length > 1 ) {
			const group = document.createElement( 'span' );
			group.className = 'pc-3d-light-edit__modes';
			modes.forEach( ( mode ) => {
				const button = document.createElement( 'button' );
				button.type = 'button';
				button.className = 'button button-small' + ( editor.mode === mode ? ' is-pressed' : '' );
				button.setAttribute( 'aria-pressed', editor.mode === mode ? 'true' : 'false' );
				button.textContent = mode === 'rotate' ? lang( 'light_edit_rotate', 'Rotate' ) : lang( 'light_edit_move', 'Move' );
				button.addEventListener( 'click', () => {
					editor.set_mode( mode );
					this._render_light_edit_ui();
				} );
				group.appendChild( button );
			} );
			panel.appendChild( group );
		}

		const done = document.createElement( 'button' );
		done.type = 'button';
		done.className = 'button button-small pc-3d-light-edit__done';
		done.textContent = lang( 'light_edit_done', 'Done' );
		done.addEventListener( 'click', () => editor.deselect() );
		panel.appendChild( done );

		if ( entry.light.isAmbientLight ) {
			const note = document.createElement( 'span' );
			note.className = 'pc-3d-light-edit__note';
			note.textContent = lang( 'light_edit_ambient_note', 'An ambient light lights everything evenly: its position has no effect.' );
			panel.appendChild( note );
		}
	},

	/**
	 * The Lights group in the Environment section: every light, and the common
	 * settings of the selected one. Everything else about a light stays in
	 * 3D Objects, which the "All settings" link opens.
	 */
	_render_lights_panel: function () {
		const $panel = this.$( '.pc-3d-lights-panel' );
		if ( ! $panel.length ) return;
		const lang = ( key, fallback ) => ( typeof PC_lang !== 'undefined' && PC_lang[ key ] ) ? PC_lang[ key ] : fallback;
		const editor = this._three && this._three.light_editor;
		$panel.empty();

		const open_objects = () => $( '<button type="button" class="button-link pc-3d-light-open-objects"></button>' )
			.text( lang( 'light_edit_open_objects', 'Open 3D Objects' ) );

		if ( ! editor ) {
			// Before the scene has loaded there is nothing to list yet; without a
			// model there is no preview to place anything in.
			if ( ! this.get_model_entries().length ) {
				$panel.append( $( '<p class="description"></p>' ).text( lang( 'light_edit_no_model', 'Add a 3D model in 3D Objects to preview and place the lights.' ) ).append( ' ', open_objects() ) );
			}
			return;
		}
		if ( ! editor.entries.length ) {
			$panel.append( $( '<p class="description"></p>' ).text( lang( 'light_edit_no_lights', 'This product has no lights yet.' ) ).append( ' ', open_objects() ) );
			return;
		}

		const type_labels = ( typeof PC_lang !== 'undefined' && PC_lang.light_type_labels ) || {};
		const $list = $( '<ul class="pc-3d-lights-list"></ul>' );
		editor.entries.forEach( ( entry, index ) => {
			const is_selected = entry === editor.selected;
			const $item = $( '<button type="button" class="pc-3d-lights-list__item"></button>' )
				.attr( 'data-index', index )
				.attr( 'aria-pressed', is_selected ? 'true' : 'false' )
				.toggleClass( 'is-selected', is_selected )
				.toggleClass( 'is-hovered', entry === editor.highlighted );
			$item.append( $( '<span class="pc-3d-lights-list__swatch" aria-hidden="true"></span>' ).css( 'background-color', '#' + entry.light.color.getHexString() ) );
			$item.append( $( '<span class="pc-3d-lights-list__name"></span>' ).text( entry.light.name || 'Light' ) );
			$item.append( $( '<span class="pc-3d-lights-list__type"></span>' ).text( type_labels[ entry.light.type ] || entry.light.type ) );
			$list.append( $( '<li></li>' ).append( $item ) );
		} );
		$panel.append( $list );

		const entry = editor.selected;
		if ( entry ) $panel.append( this._build_light_settings( entry, lang ) );
	},

	/**
	 * @param {Object} entry - Light editor entry
	 * @param {function(string, string): string} lang
	 * @returns {jQuery}
	 */
	_build_light_settings: function ( entry, lang ) {
		const light = entry.light;
		const $box = $( '<div class="pc-3d-light-settings"></div>' );
		const row = ( label_text, id ) => {
			const $row = $( '<p class="field-row"></p>' );
			$row.append( $( '<label></label>' ).attr( 'for', id ).text( label_text ) );
			return $row;
		};

		// The field has no upper bound - a point light in physical units can need
		// hundreds - so the slider's range follows the value it opens on.
		const intensity = light.userData.baseIntensity != null ? light.userData.baseIntensity : light.intensity;
		const $intensity = row( lang( 'light_edit_intensity', 'Intensity' ), 'pc-3d-light-intensity' );
		$intensity.append(
			$( '<input type="range" class="pc-3d-light-field" data-light-field="intensity" min="0" step="any">' )
				.attr( 'id', 'pc-3d-light-intensity' )
				.attr( 'max', Math.max( 10, Math.ceil( intensity * 3 ) ) )
				.val( intensity ),
			$( '<input type="number" class="small-text pc-3d-light-field" data-light-field="intensity" min="0" step="any">' ).val( intensity )
		);
		$box.append( $intensity );

		const $color = row( lang( 'light_edit_color', 'Color' ), 'pc-3d-light-color' );
		$color.append(
			$( '<input type="color" class="pc-3d-light-field" data-light-field="color">' )
				.attr( 'id', 'pc-3d-light-color' )
				.val( '#' + light.color.getHexString() )
		);
		$box.append( $color );

		if ( light.isDirectionalLight || light.isSpotLight || light.isPointLight ) {
			const $label = $( '<label></label>' ).append(
				$( '<input type="checkbox" class="pc-3d-light-field" data-light-field="cast_shadows">' ).prop( 'checked', light.userData.cast_shadows === true ),
				' ',
				document.createTextNode( lang( 'light_edit_cast_shadows', 'Cast shadows' ) )
			);
			$box.append( $( '<p class="field-row"></p>' ).append( $label ) );
		}

		if ( ! light.isAmbientLight ) {
			const $position = row( lang( 'light_edit_position', 'Position' ), 'pc-3d-light-position-x' );
			const $inputs = $( '<span class="pc-3d-light-position"></span>' );
			[ 'x', 'y', 'z' ].forEach( ( axis ) => {
				$inputs.append( $( '<input type="number" class="small-text pc-3d-light-field" data-light-field="position" step="any">' )
					.attr( 'id', 'pc-3d-light-position-' + axis )
					.attr( 'data-component', axis )
					.attr( 'aria-label', axis.toUpperCase() )
					.val( vector_to_setting( light.position )[ axis ] ) );
			} );
			$position.append( $inputs );
			$box.append( $position );
		}

		$box.append(
			$( '<p class="pc-3d-light-settings__more"></p>' ).append(
				$( '<button type="button" class="button-link pc-3d-light-open-objects"></button>' )
					.attr( 'data-index', this._three.light_editor.entries.indexOf( entry ) )
					.text( lang( 'light_edit_all_settings', 'All settings' ) )
			)
		);
		return $box;
	},

	/** Delegated once per view: the panel is rebuilt, the handlers are not. */
	_bind_lights_panel: function () {
		const entry_at = ( el ) => {
			const editor = this._three && this._three.light_editor;
			const index = parseInt( $( el ).attr( 'data-index' ), 10 );
			return editor && ! isNaN( index ) ? editor.entries[ index ] || null : null;
		};
		this.$el.off( '.pc3dlights' )
			.on( 'click.pc3dlights', '.pc-3d-lights-list__item', ( e ) => {
				const entry = entry_at( e.currentTarget );
				if ( entry ) this._three.light_editor.select( entry, 'light' );
			} )
			// Hovering or focusing a row shows which light it is in the preview.
			.on( 'mouseenter.pc3dlights focusin.pc3dlights', '.pc-3d-lights-list__item', ( e ) => {
				const entry = entry_at( e.currentTarget );
				if ( entry ) this._three.light_editor.highlight( entry );
			} )
			.on( 'mouseleave.pc3dlights focusout.pc3dlights', '.pc-3d-lights-list__item', ( e ) => {
				const editor = this._three && this._three.light_editor;
				if ( editor && editor.highlighted === entry_at( e.currentTarget ) ) editor.highlight( null );
			} )
			.on( 'click.pc3dlights', '.pc-3d-light-open-objects', ( e ) => {
				e.preventDefault();
				const entry = entry_at( e.currentTarget );
				this._open_objects3d( entry ? entry.model : null );
			} )
			.on( 'input.pc3dlights change.pc3dlights', '.pc-3d-light-field', ( e ) => {
				const editor = this._three && this._three.light_editor;
				if ( editor && editor.selected ) this._apply_light_field( editor.selected, e.currentTarget, e.type );
			} );
	},

	/**
	 * A setting typed into the Lights panel: onto the live light, then the model.
	 *
	 * @param {Object} entry
	 * @param {HTMLInputElement} input
	 * @param {string} event_type - 'input' while typing or dragging, 'change' when done
	 */
	_apply_light_field: function ( entry, input, event_type ) {
		const light = entry.light;
		const model = entry.model;
		const $box = $( input ).closest( '.pc-3d-light-settings' );
		const field = input.getAttribute( 'data-light-field' );

		if ( field === 'intensity' ) {
			const value = parseFloat( input.value );
			if ( isNaN( value ) || value < 0 ) return;
			// applySettingsToScene re-derives every intensity from this on each
			// settings pass, so setting only light.intensity would not stick.
			light.userData.baseIntensity = value;
			light.intensity = value;
			$box.find( '[data-light-field="intensity"]' ).not( input ).each( function () {
				if ( this.type === 'range' && value > parseFloat( this.max ) ) this.max = Math.ceil( value * 2 );
				this.value = value;
			} );
			if ( model ) model.set( 'light_intensity', value );
		} else if ( field === 'color' ) {
			light.color.set( input.value );
			if ( model ) model.set( 'light_color', input.value );
			const index = this._three.light_editor.entries.indexOf( entry );
			this.$( '.pc-3d-lights-list__item[data-index="' + index + '"] .pc-3d-lights-list__swatch' ).css( 'background-color', input.value );
		} else if ( field === 'cast_shadows' ) {
			if ( event_type !== 'change' ) return;
			light.userData.cast_shadows = input.checked;
			if ( model ) model.set( 'cast_shadows', input.checked );
			this.apply_shadow_settings();
		} else if ( field === 'position' ) {
			const next = light.position.clone();
			$box.find( '[data-light-field="position"]' ).each( function () {
				const v = parseFloat( this.value );
				if ( ! isNaN( v ) ) next[ this.getAttribute( 'data-component' ) ] = v;
			} );
			light.position.copy( next );
			if ( model ) model.set( 'light_position', vector_to_setting( next ) );
			// Refitting shadow cameras on every keystroke is wasted work.
			if ( event_type === 'change' ) this.apply_shadow_settings();
		} else {
			return;
		}

		this._three.light_editor.sync( entry );
		this._on_light_changed();
		this.mark_dirty( 'objects3d' );
	},

	/**
	 * Mark the row of the highlighted light, whichever side the hover came from.
	 *
	 * @param {Object|null} entry
	 */
	_sync_light_row_hover: function ( entry ) {
		const editor = this._three && this._three.light_editor;
		const index = editor && entry ? editor.entries.indexOf( entry ) : -1;
		this.$( '.pc-3d-lights-list__item' ).each( function () {
			$( this ).toggleClass( 'is-hovered', String( index ) === this.getAttribute( 'data-index' ) );
		} );
	},

	/**
	 * Keep the typed position in step with the gizmo while it is dragged.
	 * A field being typed in is left alone.
	 *
	 * @param {Object} entry
	 */
	_sync_light_position_fields: function ( entry ) {
		const editor = this._three && this._three.light_editor;
		if ( ! editor || entry !== editor.selected || editor.selected_handle !== 'light' ) return;
		const value = vector_to_setting( entry.light.position );
		this.$( '.pc-3d-light-settings [data-light-field="position"]' ).each( function () {
			if ( this !== document.activeElement ) this.value = value[ this.getAttribute( 'data-component' ) ];
		} );
	},

	/**
	 * Go to 3D Objects, opening a light's form when one is given.
	 *
	 * @param {Backbone.Model|null} model
	 */
	_open_objects3d: function ( model ) {
		const col = PC.app.get_collection ? PC.app.get_collection( 'objects3d' ) : null;
		if ( model && col ) {
			// The list opens the form of whichever item is active when it renders.
			col.each( ( m ) => {
				if ( m !== model && m.get( 'active' ) ) m.set( 'active', false );
			} );
			model.set( 'active', true );
		}
		$( '.pc-modal.mkl-pc-admin-ui .mkl-pc-admin-ui__nav-item[data-menu-id="objects3d"]' ).first().trigger( 'click' );
	},

	maybe_cleanup: function () {
		const t = this._three;
		if ( ! t ) return;
		if ( t.placement ) t.placement.reset();
		this._three = null;
		if ( this.$el ) this.$el.off( '.pc3drender' );

		if ( typeof t.stop_animation_loop === 'function' ) {
			t.stop_animation_loop();
		}
		if ( t.animation_id ) {
			cancelAnimationFrame( t.animation_id );
			t.animation_id = null;
		}
		if ( t.fake_shadow ) {
			t.fake_shadow.dispose();
			t.fake_shadow = null;
		}
		if ( t.light_editor ) {
			t.light_editor.dispose();
			t.light_editor = null;
		}
		if ( t.postprocessingLayer ) {
			t.postprocessingLayer.dispose();
			t.postprocessingLayer = null;
			t.composer = null;
		}
		if ( t.base_composer ) {
			t.base_composer.dispose();
			t.base_composer = null;
		}
		if ( t.shadow_catcher ) {
			if ( t.shadow_catcher.parent ) t.shadow_catcher.parent.remove( t.shadow_catcher );
			if ( t.shadow_catcher.dispose ) t.shadow_catcher.dispose();
			t.shadow_catcher = null;
		}
		if ( t.shadow_light ) {
			if ( t.shadow_light.target && t.shadow_light.target.parent ) {
				t.shadow_light.target.parent.remove( t.shadow_light.target );
			}
			if ( t.shadow_light.parent ) t.shadow_light.parent.remove( t.shadow_light );
			t.shadow_light = null;
		}
		if ( t.on_resize ) {
			window.removeEventListener( 'resize', t.on_resize );
			t.on_resize = null;
		}
		if ( t.controls ) t.controls.dispose();
		if ( t.renderer ) {
			t.renderer.dispose();
			if ( t.renderer.domElement?.parentNode ) {
				t.renderer.domElement.parentNode.removeChild( t.renderer.domElement );
			}
		}
		// Scene disposal is not conditional on the renderer: a bag without one still
		// holds geometries, materials, textures and the environment map.
		const deps = get_three_deps();
		if ( t.scene && deps && typeof deps.disposeScene === 'function' ) {
			deps.disposeScene( t.scene );
		}
		if ( t.material_registry && t.material_registry.clear ) {
			t.material_registry.clear();
		}
	},
	/**
	 * Collect 3D model entries (for preview and tree).
	 * @returns {Array<{ url: string, label: string }>}
	 */
	/**
	 * Get display label for an objects3d model (for preview loading steps and scene_roots).
	 * @param {Backbone.Model} model - Model from objects3d collection
	 * @returns {string}
	 */
	_get_model_entry_label: function ( model ) {
		return model.get( 'name' ) || model.get( 'filename' ) || ( 'Object #' + ( model.get( '_id' ) || model.id || '' ) );
	},
	get_model_entries: function () {
		const objects3d = PC.app.get_collection( 'objects3d' );
		if ( ! objects3d ) return [];
		return objects3d.where( { object_type: 'gltf' } );
	},

	_setPreviewLoadingStep: function ( stepId, label ) {
		const container = this.$( '.pc-3d-preview--canvas-container' )[0];
		if ( !container ) return;
		let overlay = container.querySelector( '.pc-3d-preview-loading' );
		if ( !overlay ) return;
		const list = overlay.querySelector( '.pc-3d-preview-loading-steps' );
		if ( !list ) return;
		let li = list.querySelector( '[data-step-id="' + stepId + '"]' );
		if ( li ) {
			li.querySelector( '.pc-3d-preview-loading-label' ).textContent = label;
			return;
		}
		li = document.createElement( 'li' );
		li.setAttribute( 'data-step-id', stepId );
		li.className = 'pc-3d-preview-loading-step';
		li.innerHTML = '<span class="spinner is-active" aria-hidden="true"></span> <span class="pc-3d-preview-loading-label">' + ( label || stepId ) + '</span>';
		list.appendChild( li );
	},
	_removePreviewLoadingStep: function ( stepId ) {
		const container = this.$( '.pc-3d-preview--canvas-container' )[0];
		if ( !container ) return;
		const li = container.querySelector( '.pc-3d-preview-loading [data-step-id="' + stepId + '"]' );
		if ( li ) li.remove();
	},
	_hidePreviewLoading: function () {
		const container = this.$( '.pc-3d-preview--canvas-container' )[0];
		if ( !container ) return;
		const overlay = container.querySelector( '.pc-3d-preview-loading' );
		if ( overlay ) overlay.classList.add( 'is-hidden' );
	},
	_notify_model_load_errors: function ( load_errors ) {
		if ( ! load_errors || ! load_errors.length ) {
			return;
		}
		if ( window.PC && typeof window.PC.show_notice === 'function' ) {
			load_errors.forEach( ( item ) => {
				if ( item.err && item.err.code === 'missing_url' ) {
					return;
				}
				window.PC.show_notice( item.text, 'error' );
			} );
		}
		this._show_preview_load_errors( load_errors );
	},
	_show_preview_load_errors: function ( load_errors ) {
		const container = this.$( '.pc-3d-preview--canvas-container' )[ 0 ];
		if ( ! container || ! load_errors || ! load_errors.length ) {
			return;
		}
		let banner = container.querySelector( '.pc-3d-preview-error' );
		if ( ! banner ) {
			banner = document.createElement( 'div' );
			banner.className = 'pc-3d-preview-error';
			banner.setAttribute( 'role', 'alert' );
			container.appendChild( banner );
		}
		banner.textContent = '';
		const heading = document.createElement( 'p' );
		heading.className = 'pc-3d-preview-error__heading';
		heading.textContent = ( typeof PC_lang !== 'undefined' && PC_lang.gltf_load_failed )
			? PC_lang.gltf_load_failed
			: 'Failed to load the 3D model.';
		banner.appendChild( heading );
		const list = document.createElement( 'ul' );
		list.className = 'pc-3d-preview-error__list';
		load_errors.forEach( ( item ) => {
			const li = document.createElement( 'li' );
			li.textContent = item.text;
			list.appendChild( li );
		} );
		banner.appendChild( list );
	},
	render_tree_loading: function () {
		const tree_el = this.$( '.pc-3d-tree' );
		if ( !tree_el.length ) return;
		tree_el.empty().append(
			'<div class="pc-3d-tree-loading"><span class="spinner is-active" aria-hidden="true"></span> ' +
			( ( typeof PC_lang !== 'undefined' && PC_lang.loading_scene_structure ) ? PC_lang.loading_scene_structure : 'Loading scene structure…' ) +
			'</div>'
		);
	},
	render_tree_message: function ( message ) {
		const tree_el = this.$( '.pc-3d-tree' );
		if ( !tree_el.length ) return;
		tree_el.empty().append( '<p class="pc-3d-tree-message description">' + ( message || '' ) + '</p>' );
	},

	render_preview: function ( url ) {
		const container = this.$( '.pc-3d-preview--canvas-container' )[0];
		if ( ! container ) return;

		this.maybe_cleanup();
		container.innerHTML = '';

		// Loading overlay: list of current steps (HDR, models)
		const loadingOverlay = document.createElement( 'div' );
		loadingOverlay.className = 'pc-3d-preview-loading';
		loadingOverlay.setAttribute( 'aria-live', 'polite' );
		loadingOverlay.innerHTML = '<ul class="pc-3d-preview-loading-steps" role="list"></ul>';
		container.appendChild( loadingOverlay );

		this.render_tree_loading();

		const depsReady = this._threeDepsPromise || ( PC.threeD.ensureReady && PC.threeD.ensureReady() );
		depsReady.then( () => {
			const THREE = get_three();
			const deps = get_three_deps();
			if ( ! THREE || ! deps ) return;
			const {
				OrbitControls,
				FakeShadow,
				findObjectByCompositeId,
				getObjectTargetPosition,
				removeLightsFromScene,
				registerSceneMaterials,
			} = deps;

			const s = PC.app.admin.settings_3d;
			const r = s.renderer || {};
			const bg = s.background || {};
			// Enable alpha channel when transparent background or renderer alpha option is on (needed for see-through)
			const useAlpha = !!( r.alpha || bg.mode === 'transparent' );
			const renderer = new THREE.WebGLRenderer( {
				antialias: true,
				alpha: useAlpha,
				powerPreference: 'high-performance',
			} );
			const shadowsEnabled = deps.resolveShadowMode( s ) === deps.SHADOW_MODES.REALTIME;
			PC.threeD.applyRendererShadowSettings( renderer, shadowsEnabled );
			renderer.setSize( container.clientWidth, container.clientHeight );
			renderer.setPixelRatio( deps.getPixelRatio() );
			renderer.toneMapping = deps.getToneMapping( r );
			renderer.toneMappingExposure = typeof r.exposure === 'number' ? r.exposure : 1;
			renderer.outputColorSpace = THREE.SRGBColorSpace;
			renderer.setClearAlpha( ( bg.mode === 'transparent' || r.alpha ) ? 0 : 1 );
			container.appendChild( renderer.domElement );

			// The preview shares the frontend's GLTFLoader, so KTX2 needs this
			// renderer probed before the first model is pulled from the store.
			deps.setKtx2Renderer( renderer );

			const scene = new THREE.Scene();
			const camera = new THREE.PerspectiveCamera( 45, container.clientWidth / container.clientHeight, 0.1, 1000 );
			camera.position.set( 0, 1, 3 );

			this._three = { scene, camera, renderer, container, controls: null, animation_id: null, on_resize: null, fake_shadow: null, shadow_catcher: null, shadow_light: null, model_root: null, scene_roots: [], current_env_url: null, postprocessingLayer: null, composer: null, material_registry: new Map(), framing_shift: { x: 0, y: 0 } };
			this._previewAngle = null;
			this._previewFramingTouched = false;
			if ( window.wp && window.wp.hooks && typeof window.wp.hooks.doAction === 'function' ) {
				window.wp.hooks.doAction( 'PC.admin.3d_settings.viewer_ready', this, this._three, THREE );
			}

			const env = s.environment || {};
			const initial_env_url = this.get_env_url_for_preview( env );

			const modelEntries = this.get_model_entries();
			if ( initial_env_url ) {
				const hdrLabel = ( typeof PC_lang !== 'undefined' && PC_lang.loading_hdr ) ? PC_lang.loading_hdr : 'HDR environment';
				this._setPreviewLoadingStep( 'hdr', hdrLabel );
			}

			modelEntries.forEach( ( me, i ) => {
				const label = this._get_model_entry_label( me );
				this._setPreviewLoadingStep( 'model-' + i, ( typeof PC_lang !== 'undefined' && PC_lang.loading_model ) ? PC_lang.loading_model.replace( '%s', label ) : ( 'Model: ' + label ) );
			} );

			// Environment loading, background and orbit limits are all driven by
			// apply_preview_settings below; it only needs current_env_url to start
			// out null, which the _three bag above guarantees.
			const controls = new OrbitControls( camera, renderer.domElement );
			controls.enableDamping = true;
			controls.dampingFactor = 0.1;
			controls.screenSpacePanning = false;

			Object.assign( controls, deps.getOrbitLimitsFromEnv( s.environment || {} ) );
			this._three.controls = controls;
			// The no-effects chain, so the preview matches the frontend and so that
			// switching an effect on does not change the look. Same component, same
			// reasoning — see 3d-base-composer.js.
			// Captured, not `this`: an object-literal getter has its own `this`. The
			// _three object is stable while the preview lives, and its camera is
			// reassigned in place, so reading through it stays live.
			const three = this._three;
			this._three.base_composer = deps.create_base_composer( {
				renderer: three.renderer,
				scene: three.scene,
				get camera() {
					return three.camera;
				},
			} );
			// Same interaction-quality behaviour as the frontend viewer, from the same
			// component: cheap while dragging, refined once it settles. The preview
			// used to carry its own partial copy of this, and every part of it had a
			// bug the frontend had already fixed.
			this._three.quality = create_render_quality( {
				getLayer: () => this._three && this._three.postprocessingLayer,
				getControls: () => this._three && this._three.controls,
				getPixelRatio: deps.getPixelRatio,
				orbitScale: deps.ORBIT_PIXEL_RATIO_SCALE,
				// No toolbar framing here, so the view offset carries the jitter and
				// the lens shift of a fitted angle.
				applyJitter: ( offset ) => this._applyPreviewViewOffset( offset ),
			} );
			this._three.quality.attach( controls );
			// Orbiting or zooming hands the camera to the merchant: a resize stops
			// refitting the angle, so a view being lined up is not thrown away.
			controls.addEventListener( 'start', () => {
				this._previewFramingTouched = true;
			} );

			// Catch-all for anything in the panel that mutates the scene without
			// routing through one of the apply points above. Namespaced so cleanup
			// can drop it.
			this.$el.off( '.pc3drender' ).on(
				'change.pc3drender input.pc3drender click.pc3drender',
				() => this.request_preview_render()
			);

			const on_resize = () => {
				if ( ! this._three ) return;
				const w = container.clientWidth;
				const h = container.clientHeight;
				const pr = deps.getPixelRatio();
				camera.aspect = w / h;
				camera.updateProjectionMatrix();
				this._refitPreviewAngle();
				// The offset is in pixels of the old size until re-applied.
				this._applyPreviewViewOffset();
				renderer.setSize( w, h );
				renderer.setPixelRatio( pr );
				if ( this._three.postprocessingLayer ) {
					this._three.postprocessingLayer.setSize( w, h );
					this._three.quality.applyQuality();
				}
				// New buffers hold nothing of the old average.
				this._three.quality.invalidate();
			};

			this._three.on_resize = on_resize;
			window.addEventListener( 'resize', on_resize );

			// Start the environment load now so it runs alongside the models rather
			// than after them. apply_preview_settings runs again from onAllLoaded.
			this.apply_preview_settings();

			const rootGroup = new THREE.Group();
			rootGroup.name = 'ConfiguratorRoot';

			// Always run model load in next tick so the animation loop is started first (fixes preview not loading when store returns cached data synchronously)
			var viewRef = this;
			var scene_roots = [];
			var load_errors = [];

			var onAllLoaded = function () {
				if ( !viewRef._three || !viewRef._three.scene ) return;
				viewRef.request_preview_render();
				viewRef._hidePreviewLoading();
				viewRef._notify_model_load_errors( load_errors );
				if ( viewRef._three.fake_shadow ) {
					viewRef._three.fake_shadow.dispose();
					viewRef._three.fake_shadow = null;
				}

				viewRef._three.THREE = THREE;

				viewRef._three.scene.add( rootGroup );
				viewRef._three.model_root = rootGroup;
				viewRef._three.scene_roots = scene_roots;
				// Real-time shadows: meshes need cast/receive flags.
				rootGroup.traverse( function( obj ) {
					if ( obj && obj.isMesh ) {
						obj.castShadow = shadowsEnabled;
						obj.receiveShadow = shadowsEnabled;
					}
				} );
				// The tree and the shadows are built below, from visibility as it now is.
				viewRef.apply_preview_hidden_objects( { refresh: false } );
				// Before bounds, lights and framing are measured.
				viewRef.apply_model_positions();
				viewRef._three.fake_shadow = new FakeShadow( viewRef._three.scene );
				viewRef.render_tree( viewRef._three.scene_roots );
				var s = PC.app.admin.settings_3d;
				var gi = 1;
				var objects3dCol = PC.app.get_collection( 'objects3d' );
				// Measured once: the model does not change while the light loop runs,
				// and setFromObject walks the whole tree.
				var lightBounds = rootGroup ? new THREE.Box3().setFromObject( rootGroup ) : null;
				viewRef._three.light_editor = viewRef._create_light_editor(
					THREE,
					deps,
					lightBounds && ! lightBounds.isEmpty() ? lightBounds.getSize( new THREE.Vector3() ).length() : 0
				);
				if ( objects3dCol && typeof PC.threeD.createLightFromSettings === 'function' ) {
					objects3dCol.each( function ( obj ) {
						if ( obj.get( 'object_type' ) !== 'light' ) return;
						var settings = {
							type: obj.get( 'light_type' ) || 'PointLight',
							color: obj.get( 'light_color' ) || '#ffffff',
							intensity: ( obj.get( 'light_intensity' ) != null ) ? obj.get( 'light_intensity' ) : 1
						};
						settings.position = obj.get( 'light_position' );
						settings.target = obj.get( 'light_target' );
						settings.angle = obj.get( 'light_angle' );
						settings.penumbra = obj.get( 'penumbra' );
						settings.distance = obj.get( 'distance' );
						settings.decay = obj.get( 'decay' );
						settings.width = obj.get( 'rect_width' );
						settings.height = obj.get( 'rect_height' );
						// Optional explicit rotation (degrees) for RectAreaLight and other lights.
						var rot = obj.get( 'rect_rotation' );
						if ( rot ) settings.rotation = rot;
						settings.groundColor = obj.get( 'light_ground_color' );
						var light = PC.threeD.createLightFromSettings( settings, gi );
						light.name = obj.get( 'name' ) || 'Light';
						// Remembered on the light so shadows can be re-applied when the
						// setting is toggled, without walking back to the objects3d model.
						light.userData.cast_shadows = obj.get( 'cast_shadows' ) === true;
						PC.threeD.applyShadowSettingsToLight( light, {
							enabled: shadowsEnabled,
							castShadows: light.userData.cast_shadows,
							bounds: lightBounds,
						} );
						var targetId = obj.get( 'light_target_object_id' );
						if ( light.target && targetId && rootGroup && typeof findObjectByCompositeId === 'function' && typeof getObjectTargetPosition === 'function' ) {
							var targetObj = findObjectByCompositeId( viewRef._three.scene, targetId );
							if ( targetObj ) getObjectTargetPosition( targetObj, light.target.position );
						} else if ( light.target && settings.target ) {
							light.target.position.set(
								settings.target.x || 0,
								settings.target.y || 0,
								settings.target.z || 0
							);
						}
						viewRef._three.scene.add( light );
						if ( light.target ) viewRef._three.scene.add( light.target );
						var cookie = obj.get( 'light_cookie' );
						if ( cookie && cookie.url && typeof PC.threeD.applyLightCookie === 'function' ) {
							PC.threeD.applyLightCookie( light, cookie );
						}
						viewRef._three.light_editor.add( light, {
							model: obj,
							// A target that follows an object is not the merchant's to drag.
							target_locked: !! targetId,
						} );
					} );
				}
				viewRef._sync_light_editing();

				var box = new THREE.Box3().setFromObject( rootGroup );
				if ( !box.isEmpty() ) {
					var size = box.getSize( new THREE.Vector3() ).length();
					var center = box.getCenter( new THREE.Vector3() );
					var angles = viewRef.get_angles();
					var selectedId = viewRef.$( '.pc-3d-angle-select' ).val();
					var angle = ( selectedId && angles ) ? angles.get( selectedId ) : null;
					if ( !angle && angles && angles.length ) angle = angles.first();
					var fallbackPosition = center.clone().add( new THREE.Vector3( size / 2, size / 2, size / 2 ) );
					if ( angle ) {
						viewRef._applyAngleToPreview( angle, { target: center, position: fallbackPosition } );
					} else {
						controls.target.copy( center );
						camera.position.copy( fallbackPosition );
						camera.lookAt( center );
						controls.update();
					}
				}
				on_resize();
				viewRef.apply_preview_settings();
			};

			var runPreviewLoad = function () {
				// Load models from objects3d collection only (no main model)
				if ( modelEntries.length === 0 ) {
					onAllLoaded();
					return;
				}
				var pending = modelEntries.length;
				modelEntries.forEach( function ( me, i ) {
					const gltf = me.get( 'gltf' );
					const label = viewRef._get_model_entry_label( me );
					if ( ! gltf || ! gltf.url ) {
						const missing = normalize_gltf_load_error( new Error( 'No 3D file is assigned to this object.' ), '' );
						load_errors.push( { label, err: missing, text: format_gltf_load_notice( label, missing ) } );
						pending--;
						if ( pending === 0 ) onAllLoaded();
						return;
					}
					const url = gltf.url;
					PC.threeD.store.get( url, function ( errModel, dataModel ) {
						if ( ! viewRef._three ) return;
						viewRef._removePreviewLoadingStep( 'model-' + i );
						if ( errModel || ! dataModel ) {
							const normalized = errModel && errModel.message
								? errModel
								: normalize_gltf_load_error( errModel || new Error( 'Failed to load the 3D model.' ), url );
							load_errors.push( { label, err: normalized, text: format_gltf_load_notice( label, normalized ) } );
							pending--;
							if ( pending === 0 ) onAllLoaded();
							return;
						}
						var modelScene = dataModel.gltf.scene.clone( true );
						// Remove any lights included in the GLTF; only objects3d lights should be used.
						if ( typeof removeLightsFromScene === 'function' ) {
							removeLightsFromScene( modelScene );
						}
						if ( typeof registerSceneMaterials === 'function' ) {
							registerSceneMaterials( viewRef._three, modelScene );
						}
						modelScene.name = label || modelScene.name;
						rootGroup.add( modelScene );
						modelScene.userData.object_id = me.id;
						modelScene.userData.name = me.get( 'name' );
						if ( me.get( 'loading_strategy' ) === 'lazy' ) {
							modelScene.visible = false;
						}
						scene_roots.push( { object_id: me.get( '_id' ), object: modelScene, label: label } );
						pending--;
						if ( pending === 0 ) onAllLoaded();
					} );
				} );
			};
			setTimeout( runPreviewLoad, 0 );

			// Fully pauses (cancelAnimationFrame) while the document is hidden.
			start_animation_loop( this._three, () => {
				// The bag is dropped by maybe_cleanup; the loop is stopped there too,
				// but guard rather than rely on the ordering.
				if ( ! this._three ) return;
				this._three.quality.frame( () => {
					const editor = this._three.light_editor;
					if ( editor ) editor.update();
					// No mode check: update() has already told the instance whether it
					// is the active shadow, and render() is a no-op when it is not.
					if ( this._three.fake_shadow ) {
						// The shadow pass renders the whole scene, so it would print the
						// helpers and the gizmo into the shadow.
						const restore = editor ? editor.hide_temporarily() : null;
						this._three.fake_shadow.render( renderer, scene );
						if ( restore ) restore();
					}
					if ( this._three.postprocessingLayer ) {
						this._three.postprocessingLayer.render();
					} else if ( this._three.base_composer ) {
						this._three.base_composer.render();
					} else {
						renderer.render( scene, camera );
					}
				} );
			} );
		} );
	},
	/**
	 * Build tree UI from scene roots (layer models). Each item has a visibility toggle.
	 *
	 * Children are built the first time a node is expanded rather than up front.
	 * A CAD-derived model runs to thousands of nodes, and eagerly creating a row,
	 * a toggle, a checkbox and two event bindings for every one of them locked the
	 * admin tab for seconds and pinned the whole scene graph in jQuery's data cache.
	 * Events are delegated from the tree root for the same reason.
	 *
	 * @param {Array<{ object: THREE.Object3D, label: string }>} scene_roots
	 */
	render_tree: function ( scene_roots ) {
		const tree_el = this.$( '.pc-3d-tree' ).empty();
		const view_ref = this;
		if ( !scene_roots || !scene_roots.length ) {
			const msg = ( typeof PC_lang !== 'undefined' && PC_lang.no_objects_in_scene ) ? PC_lang.no_objects_in_scene : 'No objects in scene.';
			tree_el.append( '<p class="pc-3d-tree-message description">' + msg + '</p>' );
			return;
		}

		const invalidate_shadow = function () {
			if ( view_ref._three && view_ref._three.fake_shadow && typeof view_ref._three.fake_shadow.invalidate === 'function' ) {
				view_ref._three.fake_shadow.invalidate();
			}
			view_ref.request_preview_render();
		};

		/**
		 * One row. Children are not built here — see expand_item.
		 *
		 * @param {THREE.Object3D} obj
		 * @param {string} [label] - overrides the derived "name [type]" label
		 * @param {boolean} [is_root]
		 * @returns {jQuery}
		 */
		const build_item = ( obj, label, is_root ) => {
			const has_children = !! ( obj.children && obj.children.length );
			const li_el = $( '<li class="pc-3d-tree-item">' )
				.toggleClass( 'pc-3d-tree-item--root', !! is_root )
				.toggleClass( 'pc-3d-tree-item--has-children', has_children )
				// Collapsed by default: expanding is what builds the children.
				.toggleClass( 'is-collapsed', has_children )
				.data( 'object3d', obj );

			if ( has_children ) {
				li_el.append(
					$( '<button type="button" class="pc-3d-tree-toggle" aria-label="Toggle children" aria-expanded="false"></button>' )
				);
			}

			li_el.append(
				$( '<input type="checkbox" class="pc-3d-tree-visible" title="Show/hide in preview">' )
					.prop( 'checked', obj.visible !== false )
			);
			li_el.append( ' ' );
			li_el.append(
				$( '<span class="pc-3d-tree-label">' ).text( label || ( ( obj.name || '' ) + ' [' + ( obj.type || '' ) + ']' ) )
			);
			return li_el;
		};

		/** Build one level of children under an item, once. */
		const expand_item = ( $li ) => {
			if ( $li.data( 'children-built' ) ) return;
			$li.data( 'children-built', true );
			const obj = $li.data( 'object3d' );
			if ( ! obj || ! obj.children ) return;
			const child_ul = $( '<ul>' );
			obj.children.forEach( ( child ) => child_ul.append( build_item( child ) ) );
			$li.append( child_ul );
		};

		/** Expand an item and mark its toggle accordingly. */
		const open_item = ( $li ) => {
			expand_item( $li );
			$li.removeClass( 'is-collapsed' );
			$li.children( 'ul' ).show();
			$li.children( '.pc-3d-tree-toggle' ).attr( 'aria-expanded', 'true' );
		};

		const ul_el = $( '<ul class="pc-3d-tree-list">' );
		const root_items = scene_roots.map( ( { object, label } ) => {
			const $li = build_item( object, label, true );
			ul_el.append( $li );
			return $li;
		} );

		// Delegated: one pair of handlers for the whole tree, however deep it goes.
		// Namespaced and cleared first, because render_tree runs again on every reload.
		tree_el
			.off( '.pc3dtree' )
			.on( 'click.pc3dtree', '.pc-3d-tree-toggle', function () {
				const $li = $( this ).closest( '.pc-3d-tree-item' );
				const is_collapsed = $li.toggleClass( 'is-collapsed' ).hasClass( 'is-collapsed' );
				if ( ! is_collapsed ) expand_item( $li );
				$li.children( 'ul' ).toggle( ! is_collapsed );
				$( this ).attr( 'aria-expanded', String( ! is_collapsed ) );
			} )
			.on( 'change.pc3dtree', '.pc-3d-tree-visible', function () {
				const obj = $( this ).closest( '.pc-3d-tree-item' ).data( 'object3d' );
				if ( obj ) obj.visible = this.checked;
				invalidate_shadow();
			} );

		tree_el.append( ul_el );

		// The model's top-level parts are what the merchant is looking for, so open
		// the roots straight away. Everything below stays lazy.
		root_items.forEach( open_item );
	},
};
