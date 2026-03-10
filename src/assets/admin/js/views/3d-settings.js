/* global PC_lang, __webpack_public_path__ */

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

function ensureThreeDepsLoaded() {
	if ( threeDepsPromise ) return threeDepsPromise;

	threeDepsPromise = ( async () => {
		const [
			threeModule,
			controlsModule,
			fakeShadowModule,
			postprocessingModule,
			sceneUtilsModule,
			rectAreaLightHelperModule
		] = await Promise.all( [
			import( 'three' ),
			import( 'three/addons/controls/OrbitControls.js' ),
			import( '../../../js/source/3d-viewer/3d-fake-shadow.js' ),
			import( '../../../js/source/3d-viewer/3d-postprocessing.js' ),
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
		OrbitControls = controlsModule.OrbitControls;
		loadEnvMap = sceneUtilsModule.loadEnvMap;
		FakeShadow = fakeShadowModule.FakeShadow;
		createPostprocessingLayer = postprocessingModule.createPostprocessingLayer;
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

		return {
			THREE,
			OrbitControls,
			loadEnvMap,
			FakeShadow,
			createPostprocessingLayer,
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

	PC.views.settings_3D = Backbone.View.extend( {
		tagName: 'div',
		className: 'state settings-3d-state',
		template: wp.template( 'mkl-pc-3d-models' ),
		events: {
			'click .pc-3d-reset-settings': 'on_reset_settings',
			'click .pc-3d-tab': 'on_tab_click',
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
			'remove': 'on_remove',
		},
		on_remove: function () {
			this.maybe_cleanup();
		},
		collectionName: 'settings_3d',
		initialize: function ( options ) {
			this.options = options || {};
			this.admin = PC.app.get_admin();
			this.product = PC.app.get_product();
			this.col = this.admin.settings_3d;

			PC.selection.reset();

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
			PC.app.is_modified.settings_3d = true;
			this.render();
			if ( this.apply_preview_settings ) this.apply_preview_settings();
		},
		on_tab_click: function ( e ) {
			const tab = $( e.currentTarget ).data( 'tab' );
			if ( !tab ) return;
			this.$( '.pc-3d-tab' ).removeClass( 'active' ).attr( 'aria-selected', 'false' );
			this.$( '.pc-3d-tab[data-tab="' + tab + '"]' ).addClass( 'active' ).attr( 'aria-selected', 'true' );
			this.$( '.pc-3d-tab-panel' ).removeClass( 'active' ).attr( 'hidden', 'hidden' );
			this.$( '#pc-3d-tab-' + tab ).addClass( 'active' ).removeAttr( 'hidden' );
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
			PC.app.is_modified.settings_3d = true;
			this.apply_preview_settings();
		},
		/**
		 * Resolve environment map URL for preview: preset → hdr_base + file; object → env object's HDRi URL if any.
		 * @param {Object} env - settings_3d.environment
		 * @returns {string|null} URL to load with HDR/EXR loader, or null to skip load
		 */
		get_env_url_for_preview: function ( env ) {
			if ( !env ) return null;
			const hdr_base = ( typeof PC_lang !== 'undefined' && PC_lang.hdr_base_url ) ? PC_lang.hdr_base_url : '';
			const preset_file = ( env.preset === 'studio' ) ? 'studio_small_08_1k.hdr' : 'royal_esplanade_1k.hdr';
			if ( env.mode === 'preset' ) return hdr_base + preset_file;
			if ( env.mode === 'object' && env.object_id ) {
				const col = PC.app.get_collection ? PC.app.get_collection( 'objects3d' ) : null;
				if ( col ) {
					const m = col.get( env.object_id ) || col.find( function ( mod ) { return mod.get( '_id' ) === env.object_id; } );
					if ( m ) {
						const type = m.get( 'env_type' );
						if ( type === 'hdri' ) {
							const file_data = m.get( 'env_hdri_file' );
							return file_data && file_data.url ? file_data.url : null;
						}
						if ( type === 'cubemap' ) {
							const file_data = [
								m.get( 'env_cubemap_px' ) && m.get( 'env_cubemap_px' ).url,
								m.get( 'env_cubemap_nx' ) && m.get( 'env_cubemap_nx' ).url,
								m.get( 'env_cubemap_py' ) && m.get( 'env_cubemap_py' ).url,
								m.get( 'env_cubemap_ny' ) && m.get( 'env_cubemap_ny' ).url,
								m.get( 'env_cubemap_pz' ) && m.get( 'env_cubemap_pz' ).url,
								m.get( 'env_cubemap_nz' ) && m.get( 'env_cubemap_nz' ).url,
							];
							return file_data.filter( ( url ) => url !== null );
						}
						return null;
					}
				}
			}
			return hdr_base + preset_file;
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
			PC.app.is_modified.settings_3d = true;
			this.toggle_env_and_bg_visibility();
			this.apply_preview_settings();
		},
		on_slider_input: function ( e ) {
			const el = $( e.currentTarget );
			const key = el.data( 'key' );
			const val = el.attr( 'type' ) === 'range' ? parseFloat( el.val() ) : el.val();
			if ( key ) {
				this.set_nested( PC.app.admin.settings_3d, key, val );
				PC.app.is_modified.settings_3d = true;
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
				PC.app.is_modified.settings_3d = true;
			}
			this.apply_preview_settings();
		},
		set_min_zoom_from_view: function ( e ) {
			e.preventDefault();
			if ( !this._three || !this._three.controls ) return;
			const distance = this._three.controls.getDistance();
			PC.app.admin.settings_3d.environment = PC.app.admin.settings_3d.environment || {};
			PC.app.admin.settings_3d.environment.orbit_min_distance = distance;
			PC.app.is_modified.settings_3d = true;
			this._three.controls.minDistance = distance;
			this.apply_preview_settings();
		},
		set_max_zoom_from_view: function ( e ) {
			e.preventDefault();
			if ( !this._three || !this._three.controls ) return;
			const distance = this._three.controls.getDistance();
			PC.app.admin.settings_3d.environment = PC.app.admin.settings_3d.environment || {};
			PC.app.admin.settings_3d.environment.orbit_max_distance = distance;
			PC.app.is_modified.settings_3d = true;
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
			console.log( 'focusIds', focusIds );
			if ( Array.isArray( focusIds ) && focusIds.length > 0 && typeof getBoundingBoxFromObjectIds === 'function' ) {
				const result = getBoundingBoxFromObjectIds( root, focusIds );
				console.log( 'result', result );
				return result ? result.center : null;
			}
			const id = angle.get( 'camera_target_object_id' );
			if ( !id || typeof id !== 'string' ) return null;
			const obj = findObject( root, id.trim() );
			console.log( 'obj', obj );
			console.log( 'getObjectTargetPosition( obj )', getObjectTargetPosition( obj ) );
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
			PC.app.is_modified.angles = true;
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
			PC.app.is_modified.angles = true;
			this.populate_angle_select();
		},
		apply_preview_settings: function () {
			if ( !this._three || !this._three.scene || !this._three.renderer ) return;
			const s = PC.app.admin.settings_3d;
			const scene = this._three.scene;
			const renderer = this._three.renderer;

			// Renderer: tone mapping, exposure, alpha (color space always sRGB)
			const r = s.renderer || {};
			const bg = s.background || {};
			renderer.toneMapping = r.tone_mapping === 'aces' ? THREE.ACESFilmicToneMapping : r.tone_mapping === 'linear' ? THREE.LinearToneMapping : THREE.NoToneMapping;
			renderer.toneMappingExposure = typeof r.exposure === 'number' ? r.exposure : 1;
			renderer.outputColorSpace = THREE.SRGBColorSpace;
			// Transparent background or explicit alpha: clear with alpha 0 so canvas is see-through
			renderer.setClearAlpha( ( bg.mode === 'transparent' || r.alpha ) ? 0 : 1 );

			// Background
			if ( bg.mode === 'transparent' ) {
				scene.background = null;
			} else if ( bg.mode === 'solid' && bg.color ) {
				scene.background = new THREE.Color( bg.color );
			} else if ( bg.mode === 'environment' && scene.environment ) {
				scene.background = scene.environment;
			}
			// environment mode background is applied via scene.environment (below)

			// Environment: reload map when preset or object URL changes, then set intensity/rotation
			const env = s.environment || {};
			const desired_url = this.get_env_url_for_preview( env );
			const desired_key = Array.isArray( desired_url ) ? desired_url.join( '|' ) : desired_url || null;
			if ( desired_key && this._three.current_env_key !== desired_key ) {
				this._three.current_env_key = desired_key;
				loadEnvMap( desired_url, ( texture ) => {
					scene.environment = texture;
					// apply intensity/rotation once texture is loaded
					if ( typeof scene.environmentIntensity !== 'undefined' ) {
						scene.environmentIntensity = ( env.intensity != null ) ? env.intensity : 1;
					}
					if ( typeof scene.environmentRotation !== 'undefined' && env.rotation != null ) {
						scene.environmentRotation = new THREE.Euler( 0, env.rotation * Math.PI / 180, 0 );
						if ( typeof scene.backgroundRotation !== 'undefined' && bg.mode === 'environment' ) {
							scene.backgroundRotation = new THREE.Euler( 0, env.rotation * Math.PI / 180, 0 );
						}
					}
				}, undefined, () => { this._three.current_env_key = null; } );
			} else {
				// No reload, but still keep intensity/rotation in sync
				if ( typeof scene.environmentIntensity !== 'undefined' ) {
					scene.environmentIntensity = ( env.intensity != null ) ? env.intensity : 1;
				}
				if ( typeof scene.environmentRotation !== 'undefined' && env.rotation != null ) {
					scene.environmentRotation = new THREE.Euler( 0, env.rotation * Math.PI / 180, 0 );
					if ( typeof scene.backgroundRotation !== 'undefined' && bg.mode === 'environment' ) {
						scene.backgroundRotation = new THREE.Euler( 0, env.rotation * Math.PI / 180, 0 );
					}
				}
			}

			// OrbitControls polar, azimuth, and zoom (distance) limits
			if ( this._three.controls ) {
				const min_polar = ( env.orbit_min_polar_angle != null ) ? env.orbit_min_polar_angle : 0;
				const max_polar = ( env.orbit_max_polar_angle != null ) ? env.orbit_max_polar_angle : 90;
				this._three.controls.minPolarAngle = ( min_polar * Math.PI ) / 180;
				this._three.controls.maxPolarAngle = ( max_polar * Math.PI ) / 180;
				const min_azimuth = ( env.orbit_min_azimuth_angle != null ) ? env.orbit_min_azimuth_angle : -180;
				const max_azimuth = ( env.orbit_max_azimuth_angle != null ) ? env.orbit_max_azimuth_angle : 180;
				this._three.controls.minAzimuthAngle = ( min_azimuth * Math.PI ) / 180;
				this._three.controls.maxAzimuthAngle = ( max_azimuth * Math.PI ) / 180;
				// Apply zoom limits in preview only when toggle is on; otherwise no limits so user can move freely
				const zoomLimitsEnabled = env.orbit_zoom_limits_enabled !== false;
				const minDist = zoomLimitsEnabled && ( typeof env.orbit_min_distance === 'number' && env.orbit_min_distance > 0 ) ? env.orbit_min_distance : 0;
				const maxDist = zoomLimitsEnabled && ( typeof env.orbit_max_distance === 'number' && env.orbit_max_distance > 0 ) ? env.orbit_max_distance : Infinity;
				this._three.controls.minDistance = minDist;
				this._three.controls.maxDistance = maxDist;
			}
			this.update_zoom_buttons_state();

			// Fake shadow (planar) – updated in fake_shadow.update() when model_root exists
			const g = s.ground || {};
			if ( this._three.fake_shadow && this._three.model_root ) {
				this._three.fake_shadow.update( this._three.model_root, g );
			}

			// Global light intensity (used by objects3d lights when applied in scene)
			const gi = 1;
			scene.traverse( ( obj ) => {
				if ( ! obj.isLight ) return;
				const base = obj.userData?.baseIntensity ?? obj.intensity;
				obj.intensity = base * gi;
			} );

			// Postprocessing: build or clear composer from settings (order: SSAO → SSR → Bloom → SMAA); loads passes async
			this.setup_preview_postprocessing();
		},
		setup_preview_postprocessing: async function () {
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

			if ( this._three.postprocessingLayer ) {
				this._three.postprocessingLayer.dispose();
				this._three.postprocessingLayer = null;
				this._three.composer = null;
			}

			const flags = { ssao: !!pp.ssao, ssr: !!pp.ssr, bloom: !!pp.bloom, smaa: !!pp.smaa };
			const layer = await createPostprocessingLayer( renderer, scene, camera, {
				width: w,
				height: h,
				flags,
				bloomStrength: pp.bloom_strength,
				bloomRadius: pp.bloom_radius,
				bloomThreshold: pp.bloom_threshold,
			} );
			if ( layer ) {
				this._three.postprocessingLayer = layer;
				this._three.composer = layer.composer;
			}
		},
		on_window_resize: function () {

		},
		maybe_cleanup: function () {
			if ( this._three?.fake_shadow ) {
				this._three.fake_shadow.dispose();
				this._three.fake_shadow = null;
			}
			if ( this._three?.light_helpers && this._three.light_helpers.length ) {
				this._three.light_helpers.forEach( function ( h ) {
					if ( h.dispose ) h.dispose();
				} );
				this._three.light_helpers = [];
			}
			if ( this._three?.renderer ) {
				cancelAnimationFrame( this._three.animation_id ); // stop previous loop

				if ( this._three.postprocessingLayer ) {
					this._three.postprocessingLayer.dispose();
					this._three.postprocessingLayer = null;
					this._three.composer = null;
				}
				// Dispose renderer
				this._three.renderer.dispose();
				if ( this._three.renderer.domElement?.parentNode ) {
					this._three.renderer.domElement.parentNode.removeChild( this._three.renderer.domElement );
				}

				if ( this._three.on_resize ) {
					window.removeEventListener( 'resize', this._three.on_resize );
				}

				// Dispose controls
				if ( this._three.controls ) this._three.controls.dispose();

				// Optionally, traverse the scene and dispose geometries/materials
				if ( this._three.scene ) {
					this._three.scene.traverse( ( obj ) => {
						if ( obj.geometry ) obj.geometry.dispose();
						if ( obj.material ) {
							if ( Array.isArray( obj.material ) ) {
								obj.material.forEach( m => m.dispose() );
							} else {
								obj.material.dispose();
							}
						}
					} );
				}
				if ( this._three.material_registry && this._three.material_registry.clear ) {
					this._three.material_registry.clear();
				}
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

			const depsReady = this._threeDepsPromise || ensureThreeDepsLoaded();
			depsReady.then( () => {
				const s = PC.app.admin.settings_3d;
				const r = s.renderer || {};
				const bg = s.background || {};
				// Enable alpha channel when transparent background or renderer alpha option is on (needed for see-through)
				const useAlpha = !!( r.alpha || bg.mode === 'transparent' );
				const renderer = new THREE.WebGLRenderer( { antialias: true, alpha: useAlpha } );
				const shadowsEnabled = !!( s && s.enable_shadows );
				renderer.shadowMap.enabled = shadowsEnabled;
				if ( shadowsEnabled ) renderer.shadowMap.type = THREE.PCFSoftShadowMap;
				renderer.setSize( container.clientWidth, container.clientHeight );
				renderer.setPixelRatio( window.devicePixelRatio );
				renderer.toneMapping = r.tone_mapping ? r.tone_mapping : THREE.ACESFilmicToneMapping;
				renderer.toneMappingExposure = typeof r.exposure === 'number' ? r.exposure : 1;
				renderer.outputColorSpace = THREE.SRGBColorSpace;
				renderer.setClearAlpha( ( bg.mode === 'transparent' || r.alpha ) ? 0 : 1 );
				container.appendChild( renderer.domElement );

				const scene = new THREE.Scene();
				const camera = new THREE.PerspectiveCamera( 45, container.clientWidth / container.clientHeight, 0.1, 1000 );
				camera.position.set( 0, 1, 3 );

				this._three = { scene, camera, renderer, controls: null, animation_id: null, on_resize: null, fake_shadow: null, model_root: null, scene_roots: [], current_env_url: null, postprocessingLayer: null, composer: null, material_registry: new Map() };
				window.pc_three = this._three;

				const env = s.environment || {};
				const initial_env_url = this.get_env_url_for_preview( env );

				const modelEntries = this.get_model_entries();
				const hdrLabel = ( typeof PC_lang !== 'undefined' && PC_lang.loading_hdr ) ? PC_lang.loading_hdr : 'HDR environment';
				this._setPreviewLoadingStep( 'hdr', hdrLabel );

				modelEntries.forEach( ( me, i ) => {
					const label = this._get_model_entry_label( me );
					this._setPreviewLoadingStep( 'model-' + i, ( typeof PC_lang !== 'undefined' && PC_lang.loading_model ) ? PC_lang.loading_model.replace( '%s', label ) : ( 'Model: ' + label ) );
				} );

				if ( !initial_env_url ) {
					this._removePreviewLoadingStep( 'hdr' );
					this.apply_preview_settings();
				} else {
					loadEnvMap( initial_env_url, ( texture ) => {
						scene.environment = texture;
						this._three.current_env_url = initial_env_url;
						this._removePreviewLoadingStep( 'hdr' );
						this.apply_preview_settings();
					}, undefined, () => {
						this._removePreviewLoadingStep( 'hdr' );
					} );
				}

				if ( bg.mode === 'transparent' ) scene.background = null;
				else if ( bg.mode === 'solid' && bg.color ) scene.background = new THREE.Color( bg.color );

				const controls = new OrbitControls( camera, renderer.domElement );
				controls.enableDamping = true;
				controls.dampingFactor = 0.1;
				controls.screenSpacePanning = false;

				const env_for_orbit = s.environment || {};
				const min_polar = ( env_for_orbit.orbit_min_polar_angle != null ) ? env_for_orbit.orbit_min_polar_angle : 0;
				const max_polar = ( env_for_orbit.orbit_max_polar_angle != null ) ? env_for_orbit.orbit_max_polar_angle : 90;
				const min_azimuth = ( env_for_orbit.orbit_min_azimuth_angle != null ) ? env_for_orbit.orbit_min_azimuth_angle : -180;
				const max_azimuth = ( env_for_orbit.orbit_max_azimuth_angle != null ) ? env_for_orbit.orbit_max_azimuth_angle : 180;
				controls.minPolarAngle = ( min_polar * Math.PI ) / 180;
				controls.maxPolarAngle = ( max_polar * Math.PI ) / 180;
				controls.minAzimuthAngle = ( min_azimuth * Math.PI ) / 180;
				controls.maxAzimuthAngle = ( max_azimuth * Math.PI ) / 180;
				// Apply zoom limits in preview only when toggle is on
				const zoomLimitsEnabled = env_for_orbit.orbit_zoom_limits_enabled !== false;
				const minDist = zoomLimitsEnabled && ( typeof env_for_orbit.orbit_min_distance === 'number' && env_for_orbit.orbit_min_distance > 0 ) ? env_for_orbit.orbit_min_distance : 0;
				const maxDist = zoomLimitsEnabled && ( typeof env_for_orbit.orbit_max_distance === 'number' && env_for_orbit.orbit_max_distance > 0 ) ? env_for_orbit.orbit_max_distance : Infinity;
				controls.minDistance = minDist;
				controls.maxDistance = maxDist;
				this._three.controls = controls;
				this._three.bypassPostprocessing = false;
				controls.addEventListener( 'start', () => { this._three.bypassPostprocessing = true; } );
				controls.addEventListener( 'end', () => { this._three.bypassPostprocessing = false; } );

				const on_resize = () => {
					const w = container.clientWidth;
					const h = container.clientHeight;
					const pr = window.devicePixelRatio;
					camera.aspect = w / h;
					camera.updateProjectionMatrix();
					renderer.setSize( w, h );
					renderer.setPixelRatio( pr );
					if ( this._three.postprocessingLayer ) {
						this._three.postprocessingLayer.setSize( w, h );
						this._three.postprocessingLayer.setPixelRatio( pr );
					}
				};

				this._three.on_resize = on_resize;
				window.addEventListener( 'resize', on_resize );

				const rootGroup = new THREE.Group();
				rootGroup.name = 'ConfiguratorRoot';

				// Always run model load in next tick so the animation loop is started first (fixes preview not loading when store returns cached data synchronously)
				var viewRef = this;
				var scene_roots = [];

				var onAllLoaded = function () {
					if ( !viewRef._three || !viewRef._three.scene ) return;
					viewRef._hidePreviewLoading();
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
					const defaultHidden = ( typeof PC_lang !== 'undefined' && PC_lang.default_hidden_object_names ) ? PC_lang.default_hidden_object_names : null;
					const customHidden = ( viewRef.admin && viewRef.admin.settings_3d && viewRef.admin.settings_3d.hidden_object_names ) || '';
					hideObjectsByName( rootGroup, getHiddenObjectNamesList( defaultHidden, customHidden ) );
					viewRef._three.fake_shadow = new FakeShadow( viewRef._three.scene );
					viewRef.render_tree( viewRef._three.scene_roots );
					var s = PC.app.admin.settings_3d;
					var gi = 1;
					var objects3dCol = PC.app.get_collection( 'objects3d' );
					viewRef._three.light_helpers = viewRef._three.light_helpers || [];
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
							var supportsShadows = !!( light.isDirectionalLight || light.isSpotLight || light.isPointLight );
							light.castShadow = !!( shadowsEnabled && supportsShadows && obj.get( 'cast_shadows' ) === true );
							if ( light.castShadow && light.shadow ) {
								light.shadow.mapSize.width = 1024;
								light.shadow.mapSize.height = 1024;
								if ( light.isDirectionalLight || light.isSpotLight ) {
									light.shadow.bias = -0.0001;
									light.shadow.normalBias = 0.02;
								} else if ( light.isPointLight ) {
									light.shadow.bias = -0.0005;
								}
							}
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
							var helper = null;
							if ( THREE.PointLightHelper && light.isPointLight ) {
								helper = new THREE.PointLightHelper( light, 0.5 );
							} else if ( THREE.DirectionalLightHelper && light.isDirectionalLight ) {
								helper = new THREE.DirectionalLightHelper( light, 1 );
							} else if ( THREE.SpotLightHelper && light.isSpotLight ) {
								helper = new THREE.SpotLightHelper( light );
							} else if ( RectAreaLightHelper && light.isRectAreaLight ) {
								helper = new RectAreaLightHelper( light );
							}
							
							if ( helper ) {
								if ( light.isRectAreaLight ) {
									light.add( helper );
								} else {
									viewRef._three.scene.add( helper );
								}
								viewRef._three.light_helpers.push( helper );
							}
						} );
					}

					var box = new THREE.Box3().setFromObject( rootGroup );
					if ( !box.isEmpty() ) {
						var size = box.getSize( new THREE.Vector3() ).length();
						var center = box.getCenter( new THREE.Vector3() );
						var angles = viewRef.admin && viewRef.admin.angles;
						var selectedId = viewRef.$( '.pc-3d-angle-select' ).val();
						var angle = ( selectedId && angles ) ? angles.get( selectedId ) : null;
						if ( !angle && angles && angles.length ) angle = angles.first();
						var pos = angle && angle.get( 'camera_position' );
						var tgt = angle && angle.get( 'camera_target' );
						var targetFromObject = angle && rootGroup ? viewRef._resolveAngleTarget( angle, rootGroup ) : null;
						var orbitTarget = center.clone();
						if ( targetFromObject ) {
							orbitTarget.copy( targetFromObject );
							tgt = { x: targetFromObject.x, y: targetFromObject.y, z: targetFromObject.z };
						} else if ( tgt && typeof tgt.x === 'number' && typeof tgt.y === 'number' && typeof tgt.z === 'number' ) {
							orbitTarget.set( tgt.x, tgt.y, tgt.z );
						}
						controls.target.copy( orbitTarget );
						if ( pos && tgt && typeof pos.x === 'number' && typeof pos.y === 'number' && typeof pos.z === 'number' && typeof tgt.x === 'number' && typeof tgt.y === 'number' && typeof tgt.z === 'number' ) {
							camera.position.set( pos.x, pos.y, pos.z );
							camera.lookAt( orbitTarget.x, orbitTarget.y, orbitTarget.z );
						} else {
							camera.position.copy( center ).add( new THREE.Vector3( size / 2, size / 2, size / 2 ) );
							camera.lookAt( orbitTarget.x, orbitTarget.y, orbitTarget.z );
						}
						controls.update();
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
						if ( ! gltf || ! gltf.url ) {
							pending--;
							if ( pending === 0 ) onAllLoaded();
							return;
						}
						const url = gltf.url;
						PC.threeD.store.get( url, function ( errModel, dataModel ) {
							if ( ! viewRef._three ) return;
							viewRef._removePreviewLoadingStep( 'model-' + i );
							if ( errModel || ! dataModel ) {
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
							var label = viewRef._get_model_entry_label( me );
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

				const animate = () => {
					this._three.animation_id = requestAnimationFrame( animate );
					if ( document.hidden ) return;
					controls.update();
					if ( this._three.light_helpers && this._three.light_helpers.length ) {
						this._three.light_helpers.forEach( function ( h ) {
							if ( h.update ) h.update();
						} );
					}
					const g = PC.app.admin.settings_3d.ground || {};
					if ( this._three.fake_shadow && g.enabled !== false ) {
						this._three.fake_shadow.render( renderer, scene );
					}
					if ( this._three.postprocessingLayer ) {
						this._three.postprocessingLayer.render( this._three.bypassPostprocessing );
					}
					if ( !this._three.postprocessingLayer || this._three.bypassPostprocessing ) {
						renderer.render( scene, camera );
					}
				};
				animate();
			} );
		},
		/**
		 * Build tree UI from scene roots (layer models). Each item has a visibility toggle.
		 * @param {Array<{ object: THREE.Object3D, label: string }>} scene_roots
		 */
		render_tree: function ( scene_roots ) {
			const tree_el = this.$( '.pc-3d-tree' ).empty();
			if ( !scene_roots || !scene_roots.length ) {
				const msg = ( typeof PC_lang !== 'undefined' && PC_lang.no_objects_in_scene ) ? PC_lang.no_objects_in_scene : 'No objects in scene.';
				tree_el.append( '<p class="pc-3d-tree-message description">' + msg + '</p>' );
				return;
			}

			const build_list = ( obj ) => {
				const hasChildren = obj.children && obj.children.length;
				const li_el = $( '<li class="pc-3d-tree-item' + ( hasChildren ? ' pc-3d-tree-item--has-children' : '' ) + '">' );

				let toggle = null;
				if ( hasChildren ) {
					toggle = $( '<button type="button" class="pc-3d-tree-toggle" aria-label="Toggle children" aria-expanded="true"></button>' );
					toggle.on( 'click', function () {
						const $li = $( this ).closest( '.pc-3d-tree-item--has-children' );
						const isCollapsed = $li.toggleClass( 'is-collapsed' ).hasClass( 'is-collapsed' );
						$li.children( 'ul' ).toggle( !isCollapsed );
						$( this ).attr( 'aria-expanded', !isCollapsed );
					} );
					li_el.append( toggle );
				}

				const cb = $( '<input type="checkbox" class="pc-3d-tree-visible" title="Show/hide in preview">' )
					.prop( 'checked', obj.visible !== false )
					.data( 'object3d', obj );
				cb.on( 'change', function () {
					const o = $( this ).data( 'object3d' );
					if ( o ) o.visible = this.checked;
				} );
				const label = ( obj.name || '' ) + ' [' + ( obj.type || '' ) + ']';
				li_el.append( cb ).append( ' ' ).append( $( '<span class="pc-3d-tree-label">' ).text( label ) );
				if ( hasChildren ) {
					const ul_el = $( '<ul>' );
					obj.children.forEach( ( child ) => ul_el.append( build_list( child ) ) );
					li_el.append( ul_el );
				}
				return li_el;
			};

			const ul_el = $( '<ul class="pc-3d-tree-list">' );
			scene_roots.forEach( ( { object, label } ) => {
				const hasChildren = object.children && object.children.length;
				const li_el = $( '<li class="pc-3d-tree-item pc-3d-tree-item--root' + ( hasChildren ? ' pc-3d-tree-item--has-children' : '' ) + '">' );

				let toggle = null;
				if ( hasChildren ) {
					toggle = $( '<button type="button" class="pc-3d-tree-toggle" aria-label="Toggle children" aria-expanded="true"></button>' );
					toggle.on( 'click', function () {
						const $li = $( this ).closest( '.pc-3d-tree-item--has-children' );
						const isCollapsed = $li.toggleClass( 'is-collapsed' ).hasClass( 'is-collapsed' );
						$li.children( 'ul' ).toggle( !isCollapsed );
						$( this ).attr( 'aria-expanded', !isCollapsed );
					} );
					li_el.append( toggle );
				}

				const cb = $( '<input type="checkbox" class="pc-3d-tree-visible" title="Show/hide in preview">' )
					.prop( 'checked', object.visible !== false )
					.data( 'object3d', object );
				cb.on( 'change', function () {
					const o = $( this ).data( 'object3d' );
					if ( o ) o.visible = this.checked;
				} );
				const displayLabel = label || ( object.name || '' ) + ' [' + ( object.type || '' ) + ']';
				li_el.append( cb ).append( ' ' ).append( $( '<span class="pc-3d-tree-label">' ).text( displayLabel ) );
				if ( hasChildren ) {
					const child_ul = $( '<ul>' );
					object.children.forEach( ( child ) => child_ul.append( build_list( child ) ) );
					li_el.append( child_ul );
				}
				ul_el.append( li_el );
			} );
			tree_el.append( ul_el );
		},
	} );

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