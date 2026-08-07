/* global PC_lang, __webpack_public_path__ */

import { settings_3d_preview_mixin } from './3d/3d-preview-view.js';

// Ensure dynamic imports (async chunks) are loaded from the plugin's admin build URL,
// not from wp-includes or TinyMCE paths inferred at runtime.
if ( typeof PC_lang !== 'undefined' && PC_lang.admin_js_build_url ) {
	// Webpack runtime uses this as base URL for import() chunks.
	__webpack_public_path__ = PC_lang.admin_js_build_url;
}

let THREE;
let OrbitControls;
let loadEnvMap;
let FakeShadow;
let createPostprocessingLayer;
let hideObjectsByName;
let getHiddenObjectNamesList;
let findObject;
let findObjectByCompositeId;
let getObjectTargetPosition;
let getBoundingBoxFromObjectIds;
let removeLightsFromScene;
let registerSceneMaterials;
let RectAreaLightHelper = null;

let threeDepsPromise = null;

/**
 * Resolve postprocessing creator from 3D Premium (or other add-ons) via wp.hooks.
 * @returns {Function|null}
 */
function resolve_create_postprocessing_layer() {
	if ( window.wp && window.wp.hooks && typeof window.wp.hooks.applyFilters === 'function' ) {
		const creator = window.wp.hooks.applyFilters( 'PC.3d.createPostprocessingLayer', null );
		if ( typeof creator === 'function' ) {
			return creator;
		}
	}
	return null;
}

function ensureThreeDepsLoaded() {
	if ( threeDepsPromise ) return threeDepsPromise;

	threeDepsPromise = ( async () => {
		const [
			threeModule,
			controlsModule,
			fakeShadowModule,
			sceneUtilsModule,
			rectAreaLightHelperModule
		] = await Promise.all( [
			import( 'three' ),
			import( 'three/addons/controls/OrbitControls.js' ),
			import( '../../../js/source/3d-viewer/3d-fake-shadow.js' ),
			import( '../../../js/source/3d-viewer/3d-scene-utils.js' ),
			import( 'three/addons/helpers/RectAreaLightHelper.js' ),
		] );

		// Side-effect modules: loader/store/lights/object selector (attach to PC.threeD)
		await Promise.all( [
			import( './3d/3d-loader.js' ),
			import( './3d/3d-store.js' ),
			import( './3d/3d-lights.js' ),
			import( './3d/3d-object-selector-view.js' ),
		] );

		THREE = threeModule;
		if ( typeof window !== 'undefined' ) {
			window.THREE = threeModule;
		}
		OrbitControls = controlsModule.OrbitControls;
		loadEnvMap = sceneUtilsModule.loadEnvMap;
		FakeShadow = fakeShadowModule.FakeShadow;
		createPostprocessingLayer = resolve_create_postprocessing_layer();
		RectAreaLightHelper = rectAreaLightHelperModule.RectAreaLightHelper;

		( {
			hideObjectsByName,
			getHiddenObjectNamesList,
			findObject,
			findObjectByCompositeId,
			getObjectTargetPosition,
			getBoundingBoxFromObjectIds,
			removeLightsFromScene,
			registerSceneMaterials,
		} = sceneUtilsModule );
		PC.threeD = PC.threeD || {};
		PC.threeD.getTHREE = function () { return THREE; };
		PC.threeD.getThreeDeps = function () {
			return {
				THREE,
				OrbitControls,
				loadEnvMap,
				FakeShadow,
				createPostprocessingLayer: createPostprocessingLayer || resolve_create_postprocessing_layer(),
				hideObjectsByName,
				getHiddenObjectNamesList,
				findObject,
				findObjectByCompositeId,
				getObjectTargetPosition,
				getBoundingBoxFromObjectIds,
				removeLightsFromScene,
				registerSceneMaterials,
				RectAreaLightHelper,
			};
		};
		if ( window.wp && window.wp.hooks && typeof window.wp.hooks.doAction === 'function' ) {
			window.wp.hooks.doAction( 'PC.admin.3d_settings.three_ready', {
				THREE,
				OrbitControls,
				loadEnvMap,
				FakeShadow,
				createPostprocessingLayer: createPostprocessingLayer || resolve_create_postprocessing_layer(),
			} );
		}

		return {
			THREE,
			OrbitControls,
			loadEnvMap,
			FakeShadow,
			createPostprocessingLayer: createPostprocessingLayer || resolve_create_postprocessing_layer(),
			hideObjectsByName,
			getHiddenObjectNamesList,
			findObject,
			findObjectByCompositeId,
			getObjectTargetPosition,
			getBoundingBoxFromObjectIds,
		};
	} )();

	return threeDepsPromise;
}

const $ = window.jQuery;
const _ = window.PC._us || window._;
PC = window.PC || {};
PC.views = window.PC.views || {};

( function ( $, _ ) {

	// -------------------------------------------------------------------------
	// Shared helpers (DRY) for 3D model media selection
	// -------------------------------------------------------------------------
	PC.threeD = PC.threeD || {};
	PC.threeD.ensureReady = ensureThreeDepsLoaded;
	PC.actions = PC.actions || {};

	// Stub actions so "Select from list" / "Select 3D objects" work from Layers/Choices/Angles
	// before the user has opened the 3D settings tab. First click loads store + loader + real actions.
	if ( ! PC.actions.select_3d_object ) {
		PC.actions.select_3d_object = function ( el, context ) {
			ensureThreeDepsLoaded().then( function () {
				if ( PC.actions.select_3d_object ) PC.actions.select_3d_object( el, context );
			} );
		};
	}
	if ( ! PC.actions.select_3d_objects ) {
		PC.actions.select_3d_objects = function ( el, context ) {
			ensureThreeDepsLoaded().then( function () {
				if ( PC.actions.select_3d_objects ) PC.actions.select_3d_objects( el, context );
			} );
		};
	}

	/**
	 * Opens a WP media frame restricted to GLB/GLTF/ZIP (same as 3D settings).
	 *
	 * @param {Object} opts
	 * @param {number|null} [opts.selectedId]
	 * @param {string} [opts.title]
	 * @param {string} [opts.buttonText]
	 * @param {Function} opts.onSelect - called with attachment.toJSON()
	 * @returns {wp.media.view.MediaFrame}
	 */
	PC.threeD.openModelMediaFrame = function ( opts = {} ) {
		const selectedId = opts.selectedId != null ? opts.selectedId : null;
		const title = opts.title || 'Upload 3D Model';
		const buttonText = opts.buttonText || 'Use this file';
		const onSelect = typeof opts.onSelect === 'function' ? opts.onSelect : null;

		const frame = wp.media( {
			title: title,
			button: { text: buttonText },
			multiple: false,
			selected: selectedId,
			library: {
				type: ['model/gltf-binary', 'model/gltf+json', 'application/zip'],
			},
		} );

		// Maybe select existing item
		frame.on( 'open', function () {
			const selection = frame.state().get( 'selection' );
			if ( selectedId ) {
				const attachment = wp.media.attachment( selectedId );
				selection.add( attachment ? [attachment] : [] );
			} else {
				selection.reset( null );
			}
		} );

		// Set context for custom upload location (matches 3D settings)
		if ( frame.uploader?.options?.uploader?.params ) {
			frame.uploader.options.uploader.params.context = 'configurator_assets';
		}

		if ( onSelect ) {
			frame.on( 'select', () => {
				const attachment = frame.state().get( 'selection' ).first().toJSON();
				onSelect( attachment );
			} );
		}

		frame.open();
		return frame;
	};

	PC.views.settings_3d = Backbone.View.extend( Object.assign( {}, settings_3d_preview_mixin, {
		tagName: 'div',
		className: 'state settings-3d-state',
		template: wp.template( 'mkl-pc-3d-models' ),
		events: {
			'click .pc-3d-reset-settings': 'on_reset_settings',
			'click .pc-3d-set-min-zoom': 'set_min_zoom_from_view',
			'click .pc-3d-set-max-zoom': 'set_max_zoom_from_view',
			'click .pc-3d-set-view-to-angle': 'set_current_view_to_angle',
			'click .pc-3d-import-gltf-cameras': 'import_cameras_from_gltf',
			'change .pc-3d-angle-select': 'on_angle_select_change',
			'change .pc-3d-env-source': 'on_env_source_change',
			'change .pc-3d-bg-mode': 'on_bg_mode_change',
			'change .pc-3d-env-intensity, .pc-3d-env-rotation, .pc-3d-orbit-min-polar, .pc-3d-orbit-max-polar, .pc-3d-orbit-min-azimuth, .pc-3d-orbit-max-azimuth, .pc-3d-orbit-zoom-limits-enabled, .pc-3d-bg-color, .pc-3d-ground-enabled, .pc-3d-ground-size, .pc-3d-shadow-opacity, .pc-3d-shadow-blur': 'on_setting_change',
			'input .pc-3d-env-intensity, .pc-3d-env-rotation, .pc-3d-shadow-opacity, .pc-3d-shadow-blur, .pc-3d-exposure': 'on_slider_input',
			'change .pc-3d-tone-mapping, .pc-3d-exposure, .pc-3d-alpha, .pc-3d-enable-shadows': 'on_setting_change',
			'change .pc-3d-hidden-object-names': 'on_setting_change',
			'change .pc-3d-postprocess': 'on_setting_change',
			'input .pc-3d-bloom-strength, .pc-3d-bloom-radius, .pc-3d-bloom-threshold': 'on_slider_input',
			'change .pc-3d-bloom-strength, .pc-3d-bloom-radius, .pc-3d-bloom-threshold': 'on_setting_change',
		},
		remove: function () {
			this.on_remove();
			return Backbone.View.prototype.remove.call( this );
		},
		on_remove: function () {
			if ( PC.app && PC.app.exitSettings3dSidebarFocus ) {
				PC.app.exitSettings3dSidebarFocus( this.options && this.options.main_view );
			}
			this.maybe_cleanup();
		},
		collectionName: 'settings_3d',
		/**
		 * Mark a collection dirty and enable the sidebar Save button.
		 * @param {string} [collection_name='settings_3d']
		 */
		mark_dirty: function ( collection_name ) {
			const key = collection_name || this.collectionName || 'settings_3d';
			if ( PC.app && PC.app.is_modified ) {
				PC.app.is_modified[ key ] = true;
			}
			if ( PC.app && PC.app.syncSidebarSaveButtonState ) {
				PC.app.syncSidebarSaveButtonState();
			}
		},
		initialize: function ( options ) {
			this.options = options || {};
			this.admin = PC.app.get_admin();
			this.product = PC.app.get_product();
			this.col = this.admin.settings_3d;

			PC.selection.reset();

			if ( PC.app && PC.app.enterSettings3dSidebarFocus ) {
				PC.app.enterSettings3dSidebarFocus( this.options && this.options.main_view );
			}

			this._three = this._three || {};
			// Kick off async loading of Three.js and related modules; cached across instances.
			this._threeDepsPromise = ensureThreeDepsLoaded();
			this.render();
		},
		save: function ( e, f ) {
			if ( !PC.app.is_modified[this.collectionName] ) return;
			const state = PC.app.state;
			if ( state && state.$save_button ) state.$save_button.addClass( 'disabled' );
			if ( state && state.$save_all_button ) state.$save_all_button.addClass( 'disabled' );
			if ( state && state.$toolbar ) state.$toolbar.addClass( 'saving' );
			PC.app.save( this.collectionName, this.col, {
				success: () => { if ( state && state.state_saved ) state.state_saved(); },
				error: ( r, s ) => { if ( state && state.error_saving ) state.error_saving( r, s ); },
			} );
		},
		render: function () {
			const s = PC.app.admin.settings_3d;
			this.ensure_settings_defaults( s );
			this.$el.empty();
			this.$el.append( this.template( s ) );
			if ( window.wp && window.wp.hooks && typeof window.wp.hooks.doAction === 'function' ) {
				window.wp.hooks.doAction( 'PC.admin.3d_settings.render', this );
			}
			this.toggle_env_and_bg_visibility();
			this.bind_value_displays();
			this._populateEnvSource();
			this.update_zoom_buttons_state();
			this.populate_angle_select();
			// Load preview when there is at least one model to show (from objects3d)
			const modelEntries = this.get_model_entries();
			if ( modelEntries.length > 0 ) {
				this.render_preview( null );
			} else {
				this._three = this._three || {};
			}
			if ( PC.app && PC.app.syncSidebarFocusChrome ) {
				PC.app.syncSidebarFocusChrome( this.options && this.options.main_view );
			}
		},
		ensure_settings_defaults: function ( s ) {
			if ( s.hidden_object_names === undefined ) s.hidden_object_names = '';
			if ( !s.environment ) s.environment = { mode: 'preset', preset: 'outdoor', object_id: '', intensity: 1, rotation: 0, orbit_min_polar_angle: 0, orbit_max_polar_angle: 90, orbit_min_azimuth_angle: -180, orbit_max_azimuth_angle: 180, orbit_min_distance: null, orbit_max_distance: null, orbit_zoom_limits_enabled: true };
			if ( !s.background ) s.background = { mode: 'environment', color: '#ffffff' };
			if ( !s.ground ) s.ground = { enabled: true, size: 10, shadow_opacity: 0.5, shadow_blur: 0 };
			if ( s.enable_shadows === undefined ) s.enable_shadows = false;
			if ( !s.renderer ) s.renderer = { tone_mapping: 'linear', exposure: 1, output_color_space: 'srgb', alpha: false };
			if ( !s.lighting ) s.lighting = {};
			if ( !s.postprocessing ) s.postprocessing = {};
			if ( s.postprocessing.ssr === undefined ) s.postprocessing.ssr = false;
			if ( s.postprocessing.ssao === undefined ) s.postprocessing.ssao = false;
			if ( s.postprocessing.bloom === undefined ) s.postprocessing.bloom = false;
			if ( s.postprocessing.smaa === undefined ) s.postprocessing.smaa = false;
			if ( s.postprocessing.bloom_strength === undefined ) s.postprocessing.bloom_strength = 0.05;
			if ( s.postprocessing.bloom_radius === undefined ) s.postprocessing.bloom_radius = 0.04;
			if ( s.postprocessing.bloom_threshold === undefined ) s.postprocessing.bloom_threshold = 0.85;
		},
		on_reset_settings: function ( e ) {
			e.preventDefault();
			const msg = ( typeof PC_lang !== 'undefined' && PC_lang.reset_settings_3d_confirm ) ? PC_lang.reset_settings_3d_confirm : 'This will restore all 3D viewer settings to their defaults. Continue?';
			if ( !confirm( msg ) ) return;
			const defaults = ( typeof PC_lang !== 'undefined' && PC_lang.default_settings_3d ) ? PC_lang.default_settings_3d : {};
			const admin = PC.app.get_admin();
			admin.settings_3d = Object.assign( {}, defaults );
			this.col = admin.settings_3d;
			this.mark_dirty( 'settings_3d' );
			this.render();
			if ( this.apply_preview_settings ) this.apply_preview_settings();
		},
		on_section_tab_click: function ( e ) {
			e.preventDefault();
			const tab = $( e.currentTarget ).data( 'section-tab' );
			if ( !tab ) return;
			const main_view = this.options && this.options.main_view;
			const $sidebar_sections = main_view && main_view.$el
				? main_view.$el.find( '.mkl-pc-admin-ui__sidebar-3d-sections' )
				: $( '.pc-modal.mkl-pc-admin-ui' ).find( '.mkl-pc-admin-ui__sidebar-3d-sections' );
			$sidebar_sections.find( '.pc-3d-section-tab' ).removeClass( 'active' ).attr( 'aria-selected', 'false' );
			$sidebar_sections.find( '.pc-3d-section-tab[data-section-tab="' + tab + '"]' ).addClass( 'active' ).attr( 'aria-selected', 'true' );
			this.$( '.pc-3d-section-panel' ).removeClass( 'active' ).attr( 'hidden', 'hidden' );
			this.$( '#pc-3d-section-panel-' + tab ).addClass( 'active' ).removeAttr( 'hidden' );
		},
		toggle_env_and_bg_visibility: function () {
			const bg_mode = ( PC.app.admin.settings_3d.background && PC.app.admin.settings_3d.background.mode ) || 'environment';
			this.$( '.pc-3d-bg-color-row' ).toggle( bg_mode === 'solid' );
		},
		/**
		 * Populate .pc-3d-env-source: built-in presets first, then environment objects from objects3d.
		 * Set select value from env.mode + env.preset or env.object_id.
		 */
		_populateEnvSource: function () {
			const $sel = this.$( '.pc-3d-env-source' );
			if ( !$sel.length ) return;
			const env = ( PC.app.admin.settings_3d && PC.app.admin.settings_3d.environment ) || {};
			const opts = [];
			opts.push( { value: 'preset_outdoor', label: ( typeof PC_lang !== 'undefined' && PC_lang.env_preset_outdoor ) ? PC_lang.env_preset_outdoor : 'Preset: Outdoor' } );
			opts.push( { value: 'preset_studio', label: ( typeof PC_lang !== 'undefined' && PC_lang.env_preset_studio ) ? PC_lang.env_preset_studio : 'Preset: Studio' } );
			const col = PC.app.get_collection ? PC.app.get_collection( 'objects3d' ) : null;
			if ( col ) {
				col.where( { object_type: 'environment' } ).forEach( function ( m ) {
					const id = m.get( '_id' );
					const name = m.get( 'name' ) || m.get( 'label' ) || ( 'Environment ' + id );
					opts.push( { value: 'object_' + id, label: name } );
				} );
			}
			$sel.empty();
			opts.forEach( function ( o ) {
				$sel.append( $( '<option></option>' ).attr( 'value', o.value ).text( o.label ) );
			} );
			const mode = env.mode || 'preset';
			const preset = env.preset || 'outdoor';
			const objectId = env.object_id || '';
			const selected = mode === 'object' && objectId ? ( 'object_' + objectId ) : ( 'preset_' + preset );
			$sel.val( opts.some( function ( o ) { return o.value === selected; } ) ? selected : 'preset_outdoor' );
		},
		on_env_source_change: function () {
			const val = this.$( '.pc-3d-env-source' ).val() || 'preset_outdoor';
			PC.app.admin.settings_3d.environment = PC.app.admin.settings_3d.environment || {};
			if ( val.indexOf( 'preset_' ) === 0 ) {
				PC.app.admin.settings_3d.environment.mode = 'preset';
				PC.app.admin.settings_3d.environment.preset = val === 'preset_studio' ? 'studio' : 'outdoor';
				PC.app.admin.settings_3d.environment.object_id = '';
			} else if ( val.indexOf( 'object_' ) === 0 ) {
				PC.app.admin.settings_3d.environment.mode = 'object';
				PC.app.admin.settings_3d.environment.object_id = val.slice( 7 );
				PC.app.admin.settings_3d.environment.preset = 'outdoor';
			}
			this.mark_dirty( 'settings_3d' );
			this.apply_preview_settings();
		},
		bind_value_displays: function () {
			const sync = ( sel, val_sel ) => {
				const input_el = this.$( sel );
				const value_el = this.$( val_sel );
				if ( input_el.length && value_el.length ) value_el.text( input_el.val() );
			};
			sync( '.pc-3d-env-intensity', '.pc-3d-env-intensity-value' );
			sync( '.pc-3d-env-rotation', '.pc-3d-env-rotation-value' );
			sync( '.pc-3d-shadow-opacity', '.pc-3d-shadow-opacity-value' );
			sync( '.pc-3d-shadow-blur', '.pc-3d-shadow-blur-value' );
			sync( '.pc-3d-exposure', '.pc-3d-exposure-value' );
			sync( '.pc-3d-bloom-strength', '.pc-3d-bloom-strength-value' );
			sync( '.pc-3d-bloom-radius', '.pc-3d-bloom-radius-value' );
			sync( '.pc-3d-bloom-threshold', '.pc-3d-bloom-threshold-value' );
		},
		set_nested: function ( obj, path, value ) {
			const parts = path.split( '.' );
			let o = obj;
			for ( let i = 0; i < parts.length - 1; i++ ) {
				const k = parts[i];
				if ( !o[k] ) o[k] = {};
				o = o[k];
			}
			o[parts[parts.length - 1]] = value;
		},
		on_bg_mode_change: function () {
			const val = this.$( '.pc-3d-bg-mode' ).val();
			PC.app.admin.settings_3d.background = PC.app.admin.settings_3d.background || {};
			PC.app.admin.settings_3d.background.mode = val;
			this.mark_dirty( 'settings_3d' );
			this.toggle_env_and_bg_visibility();
			this.apply_preview_settings();
		},
		on_slider_input: function ( e ) {
			const el = $( e.currentTarget );
			const key = el.data( 'key' );
			const val = el.attr( 'type' ) === 'range' ? parseFloat( el.val() ) : el.val();
			if ( key ) {
				this.set_nested( PC.app.admin.settings_3d, key, val );
				this.mark_dirty( 'settings_3d' );
			}
			const val_sel = el.attr( 'type' ) === 'range' && el.next( '.pc-3d-value-display' ).length ? el.next( '.pc-3d-value-display' ) : null;
			if ( val_sel && val_sel.length ) val_sel.text( val );
			this.apply_preview_settings();
		},
		on_setting_change: function ( e ) {
			const el = $( e.currentTarget );
			const key = el.data( 'key' );
			let val = el.val();
			if ( el.attr( 'type' ) === 'checkbox' ) val = el.is( ':checked' );
			else if ( el.attr( 'type' ) === 'number' ) val = parseFloat( val ) || 0;
			else if ( el.attr( 'type' ) === 'range' ) val = parseFloat( val );
			if ( key ) {
				this.set_nested( PC.app.admin.settings_3d, key, val );
				this.mark_dirty( 'settings_3d' );
			}
			this.apply_preview_settings();
		},
		set_min_zoom_from_view: function ( e ) {
			e.preventDefault();
			if ( !this._three || !this._three.controls ) return;
			const distance = this._three.controls.getDistance();
			PC.app.admin.settings_3d.environment = PC.app.admin.settings_3d.environment || {};
			PC.app.admin.settings_3d.environment.orbit_min_distance = distance;
			this.mark_dirty( 'settings_3d' );
			this._three.controls.minDistance = distance;
			this.apply_preview_settings();
		},
		set_max_zoom_from_view: function ( e ) {
			e.preventDefault();
			if ( !this._three || !this._three.controls ) return;
			const distance = this._three.controls.getDistance();
			PC.app.admin.settings_3d.environment = PC.app.admin.settings_3d.environment || {};
			PC.app.admin.settings_3d.environment.orbit_max_distance = distance;
			this.mark_dirty( 'settings_3d' );
			this._three.controls.maxDistance = distance;
			this.apply_preview_settings();
		},
		update_zoom_buttons_state: function () {
			const disabled = !this._three || !this._three.controls;
			this.$( '.pc-3d-set-min-zoom, .pc-3d-set-max-zoom' ).prop( 'disabled', disabled );
		},
		populate_angle_select: function () {
			const $sel = this.$( '.pc-3d-angle-select' );
			if ( !$sel.length ) return;
			$sel.empty().append( '<option value="">— ' + ( ( typeof PC_lang !== 'undefined' && PC_lang.select_angle ) ? PC_lang.select_angle : 'Select angle' ) + ' —</option>' );
			const angles = this.admin && this.admin.angles;
			if ( angles && angles.length ) {
				angles.each( function ( m ) {
					const name = m.get( 'name' ) || ( 'View ' + ( m.get( '_id' ) || m.id || m.cid ) );
					$sel.append( $( '<option></option>' ).val( m.id ).text( name ) );
				} );
			}
		},
		_resolveAngleTarget: function ( angle, root ) {
			if ( !angle || !root ) return null;
			const focusIds = angle.get( 'camera_focus_object_ids' );
			if ( Array.isArray( focusIds ) && focusIds.length > 0 && typeof getBoundingBoxFromObjectIds === 'function' ) {
				const result = getBoundingBoxFromObjectIds( root, focusIds );
				return result ? result.center : null;
			}
			const id = angle.get( 'camera_target_object_id' );
			if ( !id || typeof id !== 'string' ) return null;
			const obj = findObject( root, id.trim() );
			return obj ? getObjectTargetPosition( obj ) : null;
		},
		on_angle_select_change: function () {
			if ( !this._three || !this._three.camera || !this._three.controls ) return;
			const angleId = this.$( '.pc-3d-angle-select' ).val();
			const angles = this.admin && this.admin.angles;
			if ( !angles || !angles.length ) return;
			const angle = angleId ? angles.get( angleId ) : angles.first();
			if ( !angle ) return;
			const pos = angle.get( 'camera_position' );
			let tgt = angle.get( 'camera_target' );
			const targetFromObject = this._resolveAngleTarget( angle, this._three.model_root );
			if ( targetFromObject ) {
				tgt = { x: targetFromObject.x, y: targetFromObject.y, z: targetFromObject.z };
			}
			this._three.controls.target.set( tgt && typeof tgt.x === 'number' ? tgt.x : 0, tgt && typeof tgt.y === 'number' ? tgt.y : 0, tgt && typeof tgt.z === 'number' ? tgt.z : 0 );
			if ( pos && tgt && typeof pos.x === 'number' && typeof pos.y === 'number' && typeof pos.z === 'number' && typeof tgt.x === 'number' && typeof tgt.y === 'number' && typeof tgt.z === 'number' ) {
				this._three.camera.position.set( pos.x, pos.y, pos.z );
				this._three.camera.lookAt( this._three.controls.target );
			}
			this._three.controls.update();
		},
		set_current_view_to_angle: function ( e ) {
			e.preventDefault();
			if ( !this._three || !this._three.controls || !this._three.camera ) return;
			const angleId = this.$( '.pc-3d-angle-select' ).val();
			if ( !angleId ) return;
			const angles = this.admin && this.admin.angles;
			if ( !angles ) return;
			const angle = angles.get( angleId );
			if ( !angle ) return;
			const pos = this._three.camera.position;
			const target = this._three.controls.target;
			angle.set( {
				camera_position: { x: pos.x, y: pos.y, z: pos.z },
				camera_target: { x: target.x, y: target.y, z: target.z }
			} );
			this.mark_dirty( 'angles' );
		},
		import_cameras_from_gltf: function ( e ) {
			e.preventDefault();
			const gltf = this._three && this._three.mainGltf;
			let cameras = [];
			if ( gltf && gltf.cameras && gltf.cameras.length ) {
				cameras = gltf.cameras;
			} else if ( gltf && gltf.scene ) {
				gltf.scene.traverse( ( obj ) => { if ( obj.isCamera ) cameras.push( obj ); } );
			}
			if ( !cameras.length ) {
				alert( ( typeof PC_lang !== 'undefined' && PC_lang.no_cameras_in_gltf ) ? PC_lang.no_cameras_in_gltf : 'No cameras found in the main GLTF file.' );
				return;
			}
			const angles = this.admin && this.admin.angles;
			if ( !angles ) return;
			const dir = new THREE.Vector3();
			const nextOrder = angles.nextOrder ? angles.nextOrder() : ( angles.length ? ( angles.last().get( 'order' ) || angles.length ) + 1 : 1 );
			cameras.forEach( ( cam, i ) => {
				cam.updateMatrixWorld( true );
				dir.set( 0, 0, -1 ).applyQuaternion( cam.quaternion );
				const pos = cam.position;
				const dist = 1;
				const target = { x: pos.x + dir.x * dist, y: pos.y + dir.y * dist, z: pos.z + dir.z * dist };
				const name = ( cam.name && cam.name.trim() ) || ( 'Camera ' + ( i + 1 ) );
				const attrs = {
					name: name,
					order: nextOrder + i,
					camera_position: { x: pos.x, y: pos.y, z: pos.z },
					camera_target: target,
					image: { url: '', id: '' }
				};
				angles.add( attrs );
			} );
			this.mark_dirty( 'angles' );
			this.populate_angle_select();
		},
	} ) );


	/**
	 * Action: open a media modal to select/upload a 3D model for a layer setting.
	 * Expects `context.model` to be the edited layer model.
	 */
	PC.actions.edit_model_upload = function ( $el, context ) {
		if ( !context || !context.model ) return;
		var setting = $el ? $el.data( 'setting' ) : null;
		setting = setting || 'model_upload_3d';
		var selectedId = context.model.get( 'model_upload_3d' );
		PC.threeD.openModelMediaFrame( {
			selectedId: selectedId,
			onSelect: function ( attachment ) {
				var previousUrl = context.model.get( 'model_upload_3d_url' );
				var url = attachment.gltf_url || attachment.url;
				if ( previousUrl && previousUrl !== url && PC.threeD.store && PC.threeD.store.remove ) {
					PC.threeD.store.remove( previousUrl );
				}
				var filename = attachment.gltf_filename || attachment.filename;
				context.model.set( {
					model_upload_3d: attachment.id,
					model_upload_3d_url: url,
					model_upload_3d_filename: filename,
				} );
				PC.app.is_modified.layers = true;
				if ( context.$el && setting ) {
					context.$el.find( '[data-setting="' + setting + '"]' ).val( attachment.id );
				}
			},
		} );
	};

	/**
	 * Action: clear the uploaded 3D model for a layer or choice.
	 */
	$( document ).on( 'click', '.add-on-placeholder .hide-addon-placeholder', function( event ) {
		event.preventDefault();
		const $link = $( event.currentTarget );
		const setting = $link.data( 'setting' ) || 'ar_placeholder';
		const section = $link.data( 'section' ) || 'ar';
		wp.ajax.post( {
			action: 'mkl_pc_hide_addon_setting',
			setting,
			security: PC_lang.user_preferences_nonce,
		} ).done( function() {
			$( '.pc-3d-section-panel[data-section-id="' + section + '"]' ).remove();
			$( '.pc-3d-section-tab[data-section-tab="' + section + '"]' ).remove();
		} );
	} );

	PC.actions.remove_model_upload = function ( $el, context ) {
		if ( !context || !context.model ) return;
		var url = context.model.get( 'model_upload_3d_url' );
		context.model.set( {
			model_upload_3d: null,
			model_upload_3d_url: null,
			model_upload_3d_filename: null,
		} );
		if ( url && PC.threeD.store && PC.threeD.store.remove ) {
			PC.threeD.store.remove( url );
		}
		PC.app.is_modified.layers = true;
		if ( context.$el ) {
			var setting = $el ? $el.data( 'setting' ) : null;
			setting = setting || 'model_upload_3d';
			context.$el.find( '[data-setting="' + setting + '"]' ).val( '' );
		}
		context.render();
	};

} )( jQuery, PC._us || window._ );