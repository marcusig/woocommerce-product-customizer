import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { FakeShadow } from './3d-fake-shadow.js';
import GLTFMaterialsVariantsExtension from '../../../js/vendor/KHR_materials_variants.js';

PC = window.PC || {};
PC.views = PC.views || {};

(function($, _){

	// -------------------------------------------------------------------------
	// Shared helpers (DRY) for 3D model media selection
	// -------------------------------------------------------------------------
	PC.threeD = PC.threeD || {};

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
	PC.threeD.openModelMediaFrame = function( opts = {} ) {
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
				type: [ 'model/gltf-binary', 'model/gltf+json', 'application/zip' ],
			},
		} );

		// Maybe select existing item
		frame.on( 'open', function() {
			const selection = frame.state().get( 'selection' );
			if ( selectedId ) {
				const attachment = wp.media.attachment( selectedId );
				selection.add( attachment ? [ attachment ] : [] );
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

	/** Cached DRACOLoader instance for admin (one per page, same as frontend). */
	var _adminDracoLoader = null;

	/**
	 * Build a plain object tree (no Three.js refs) from a scene root for caching.
	 * @param {THREE.Object3D} root
	 * @returns {Array<{ id: string, name: string, type: string, depth: number }>}
	 */
	function buildObjectTreeFromScene( root ) {
		var list = [];
		var skipTypes = [ 'Scene', 'Camera', 'Light', 'AmbientLight', 'DirectionalLight', 'PointLight', 'SpotLight', 'RectAreaLight' ];
		var isSkip = function( obj ) { return obj && skipTypes.indexOf( obj.type ) !== -1; };
		var add = function( obj, depth ) {
			if ( ! obj || isSkip( obj ) ) return;
			var name = obj.name || obj.type || ( 'Object_' + ( obj.uuid || '' ).slice( 0, 8 ) );
			var id = obj.name || obj.uuid;
			list.push( { id: id, name: name, type: obj.type || '', depth: depth } );
			if ( obj.children && obj.children.length ) {
				obj.children.forEach( function( ch ) { add( ch, depth + 1 ); } );
			}
		};
		if ( root && root.children ) {
			root.children.forEach( function( ch ) { add( ch, 0 ); } );
		}
		return list;
	}

	/**
	 * Global 3D data store: one load per URL, cache holds gltf + variants + materialNames + objectTree.
	 * Consumers (choices, layers, 3D settings, object selector, preview) use store.get(); remove/replace flows call store.remove().
	 */
	PC.threeD.store = ( function() {
		var _cache = {};

		function get( url, callback ) {
			if ( ! url || typeof callback !== 'function' ) return;
			if ( _cache[ url ] !== undefined ) {
				return callback( null, _cache[ url ] );
			}
			var loader = PC.threeD.getGltfLoader();
			loader.load(
				url,
				function( gltf ) {
					var variants = ( gltf.userData && gltf.userData.variants && gltf.userData.variants.length )
						? gltf.userData.variants.slice()
						: [];
					var materialNames = [];
					var seen = {};
					if ( gltf.scene && gltf.scene.traverse ) {
						gltf.scene.traverse( function( obj ) {
							if ( ! obj.material ) return;
							var materials = Array.isArray( obj.material ) ? obj.material : [ obj.material ];
							materials.forEach( function( mat ) {
								if ( ! mat ) return;
								var name = ( mat.name && String( mat.name ).trim() ) ? mat.name : mat.uuid;
								if ( ! seen[ name ] ) {
									seen[ name ] = true;
									materialNames.push( name );
								}
							} );
						} );
					}
					var objectTree = buildObjectTreeFromScene( gltf.scene );
					var data = { gltf: gltf, variants: variants, materialNames: materialNames, objectTree: objectTree };
					_cache[ url ] = data;
					callback( null, data );
				},
				undefined,
				function( err ) {
					callback( err || new Error( 'Failed to load model' ), null );
				}
			);
		}

		function remove( url ) {
			if ( ! url ) return;
			var entry = _cache[ url ];
			if ( entry && entry.gltf && entry.gltf.scene ) {
				entry.gltf.scene.traverse( function( obj ) {
					if ( obj.geometry ) obj.geometry.dispose();
					if ( obj.material ) {
						var mats = Array.isArray( obj.material ) ? obj.material : [ obj.material ];
						mats.forEach( function( m ) {
							if ( m && m.dispose ) m.dispose();
							if ( m && m.map && m.map.dispose ) m.map.dispose();
						} );
					}
				} );
			}
			delete _cache[ url ];
		}

		return { get: get, remove: remove };
	} )();

	/**
	 * Get 3D loader config (Draco/Meshopt) from PC_lang (admin) or PC_config.config (frontend).
	 * @returns {{ fe_3d_use_draco_loader: boolean, fe_3d_use_meshopt_loader: boolean, fe_3d_draco_decoder_path: string }}
	 */
	function getAdmin3dConfig() {
		const lang = window.PC_lang || {};
		const config = ( window.PC_config && window.PC_config.config ) || {};
		return {
			fe_3d_use_draco_loader: !! ( lang.fe_3d_use_draco_loader || config.fe_3d_use_draco_loader ),
			fe_3d_use_meshopt_loader: !! ( lang.fe_3d_use_meshopt_loader || config.fe_3d_use_meshopt_loader ),
			fe_3d_draco_decoder_path: lang.fe_3d_draco_decoder_path || config.fe_3d_draco_decoder_path || ( ( window.PC_config && window.PC_config.assets_url ) ? window.PC_config.assets_url + 'js/vendor/draco/gltf/' : '' ),
		};
	}

	/**
	 * Create a GLTFLoader with the same Draco and Meshopt support as the frontend.
	 * @returns {GLTFLoader}
	 */
	PC.threeD.getGltfLoader = function() {
		const loader = new GLTFLoader();
		const config = getAdmin3dConfig();
		if ( config.fe_3d_use_draco_loader && typeof window.DRACOLoader !== 'undefined' ) {
			if ( ! _adminDracoLoader ) {
				_adminDracoLoader = new window.DRACOLoader();
				if ( config.fe_3d_draco_decoder_path ) {
					_adminDracoLoader.setDecoderPath( config.fe_3d_draco_decoder_path );
				}
			}
			loader.setDRACOLoader( _adminDracoLoader );
		}
		if ( config.fe_3d_use_meshopt_loader && typeof window.MeshoptDecoder !== 'undefined' ) {
			loader.setMeshoptDecoder( window.MeshoptDecoder );
		}
		loader.register( function( parser ) { return new GLTFMaterialsVariantsExtension( parser ); } );
		return loader;
	};

	/**
	 * Load a GLTF from URL and return material variant names (KHR_materials_variants).
	 * Uses the global store (single load per URL).
	 * @param {string} url - GLTF/GLB URL
	 * @param {Function} callback - ( err, variantNames[] ) variantNames is empty if no extension
	 */
	PC.threeD.getMaterialVariantsFromUrl = function( url, callback ) {
		if ( ! url || typeof callback !== 'function' ) return;
		PC.threeD.store.get( url, function( err, data ) {
			callback( err, data ? data.variants : [] );
		} );
	};

	/**
	 * Load a GLTF from URL and return unique material names from the scene.
	 * Uses the global store (single load per URL).
	 * @param {string} url - GLTF/GLB URL
	 * @param {Function} callback - ( err, materialNames[] )
	 */
	PC.threeD.getMaterialNamesFromUrl = function( url, callback ) {
		if ( ! url || typeof callback !== 'function' ) return;
		PC.threeD.store.get( url, function( err, data ) {
			callback( err, data ? data.materialNames : [] );
		} );
	};

	/**
	 * Resolve the 3D model URL for a choice (main, layer model, or uploaded). Async if attachment must be fetched.
	 * @param {Backbone.Model} choiceModel - The choice model
	 * @param {Backbone.Model|null} layerModel - The layer model
	 * @param {Function} callback - ( url ) called with string URL or null
	 */
	PC.threeD.resolveChoiceModelUrl = function( choiceModel, layerModel, callback ) {
		if ( ! choiceModel || typeof callback !== 'function' ) {
			if ( typeof callback === 'function' ) callback( null );
			return;
		}
		var source = choiceModel.get( 'object_selection_3d' ) || 'main_model';
		var mainUrl = ( PC.app.admin.settings_3d && PC.app.admin.settings_3d.url ) ? PC.app.admin.settings_3d.url : null;

		function resolveAttachmentUrl( attId, done ) {
			if ( ! attId ) return done( null );
			var att = wp.media.attachment( attId );
			att.fetch().done( function() {
				var j = att.toJSON();
				done( j.gltf_url || j.url || null );
			} ).fail( function() { done( null ); } );
		}

		if ( source === 'main_model' ) {
			return callback( mainUrl );
		}
		if ( source === 'layer_model' && layerModel ) {
			var layerSource = layerModel.get( 'object_selection_3d' ) || 'main_model';
			if ( layerSource === 'main_model' ) return callback( mainUrl );
			if ( layerSource === 'upload_model' ) {
				var layerAttId = layerModel.get( 'model_upload_3d' );
				return resolveAttachmentUrl( layerAttId, callback );
			}
			return callback( mainUrl );
		}
		if ( source === 'upload_model' ) {
			return resolveAttachmentUrl( choiceModel.get( 'model_upload_3d' ), callback );
		}
		callback( mainUrl );
	};

	/**
	 * Single light item in the 3D settings lights list.
	 * Manages its own change events and updates PC.app.admin.settings_3d.lighting.lights[index].
	 */
	PC.views.light_item_3d = Backbone.View.extend({
		className: 'pc-3d-light-item-wrapper',
		template: wp.template('mkl-pc-3d-light-item'),
		events: {
			'change .pc-3d-light-enabled': 'on_change',
			'change .pc-3d-light-type': 'on_type_change',
			'change .pc-3d-light-color': 'on_change',
			'change .pc-3d-light-intensity': 'on_change',
		},
		initialize: function(options) {
			this.options = options || {};
			this.index = this.options.index;
			this.parent_view = this.options.parent_view;
		},
		render: function() {
			const light = this.options.light || {};

			this.$el.html(this.template({
				label: light.name || 'Light ' + (this.index + 1),
				type: light.type || 'PointLight',
				color: light.color || '#ffffff',
				intensity: light.intensity != null ? light.intensity : 1,
				enabled: light.enabled !== false,
			}));
			return this;
		},
		get_light_data: function() {
			return PC.app.admin.settings_3d.lighting.lights[this.index] || {};
		},
		set_light_key: function(key, value) {
			const lights = PC.app.admin.settings_3d.lighting.lights;
			if (!lights[this.index]) lights[this.index] = {};
			lights[this.index][key] = value;
			PC.app.is_modified.settings_3d = true;
		},
		on_change: function(e) {
			const el = $(e.currentTarget);
			const key = el.data('key');
			let val = el.val();
			if (el.attr('type') === 'checkbox') val = el.is(':checked');
			else if (el.attr('type') === 'number') val = parseFloat(val) || 0;
			this.set_light_key(key, val);
			if (this.parent_view && this.parent_view.apply_preview_settings) {
				this.parent_view.apply_preview_settings();
			}
		},
		on_type_change: function(e) {
			const val = $(e.currentTarget).val();
			this.set_light_key('type', val);
			this.render();
			if (this.parent_view && this.parent_view.apply_preview_settings) {
				this.parent_view.apply_preview_settings();
			}
		},
	});

	PC.views.settings_3D = Backbone.View.extend({
		tagName: 'div',
		className: 'state settings-3d-state',
		template: wp.template( 'mkl-pc-3d-models' ),
		events: {
			'click .select-gltf': 'select_gltf',
			'click .remove-gltf': 'remove_gltf',
			'click .pc-3d-reset-settings': 'on_reset_settings',
			'click .pc-3d-tab': 'on_tab_click',
			'click .pc-3d-select-hdr': 'select_hdr',
			'click .pc-3d-set-min-zoom': 'set_min_zoom_from_view',
			'click .pc-3d-set-max-zoom': 'set_max_zoom_from_view',
			'click .pc-3d-set-view-to-angle': 'set_current_view_to_angle',
			'click .pc-3d-import-gltf-cameras': 'import_cameras_from_gltf',
			'change .pc-3d-angle-select': 'on_angle_select_change',
			'change .pc-3d-env-mode': 'on_env_mode_change',
			'change .pc-3d-bg-mode': 'on_bg_mode_change',
			'change .pc-3d-env-preset, .pc-3d-env-intensity, .pc-3d-env-rotation, .pc-3d-orbit-min-polar, .pc-3d-orbit-max-polar, .pc-3d-orbit-min-azimuth, .pc-3d-orbit-max-azimuth, .pc-3d-orbit-zoom-limits-enabled, .pc-3d-bg-color, .pc-3d-ground-enabled, .pc-3d-ground-size, .pc-3d-shadow-opacity, .pc-3d-shadow-blur': 'on_setting_change',
			'input .pc-3d-env-intensity, .pc-3d-env-rotation, .pc-3d-shadow-opacity, .pc-3d-shadow-blur, .pc-3d-exposure, .pc-3d-global-intensity': 'on_slider_input',
			'change .pc-3d-tone-mapping, .pc-3d-exposure, .pc-3d-color-space, .pc-3d-alpha, .pc-3d-global-intensity, .pc-3d-default-light-enabled': 'on_setting_change',
		},
		collectionName: 'settings_3d',
		initialize: function( options ) {
			this.options = options || {};
			this.admin = PC.app.get_admin();
			this.product = PC.app.get_product();
			this.col = this.admin.settings_3d;

			PC.selection.reset();

			this._three = this._three || {};
			this.render();
		},
		save: function( e, f ) {
            console.log( 'h', this.collectionName, PC.app.is_modified[ this.collectionName ], this.col );
            
			if ( ! PC.app.is_modified[ this.collectionName ] ) return;
			const state = PC.app.state;
			if ( state && state.$save_button ) state.$save_button.addClass( 'disabled' );
			if ( state && state.$save_all_button ) state.$save_all_button.addClass( 'disabled' );
			if ( state && state.$toolbar ) state.$toolbar.addClass( 'saving' );
			PC.app.save( this.collectionName, this.col, {
				success: () => { if ( state && state.state_saved ) state.state_saved(); },
				error: ( r, s ) => { if ( state && state.error_saving ) state.error_saving( r, s ); },
			} );
		},
		render: function() {
			const s = PC.app.admin.settings_3d;
			this.ensure_settings_defaults(s);
			this.$el.empty();
			this.$el.append( this.template( s ) );
			this.toggle_env_and_bg_visibility();
			this.bind_value_displays();
			this.update_zoom_buttons_state();
			this.populate_angle_select();
			// Only load preview if a file was selected
			if (s.url) {
				this.render_preview(s.url);
			} else {
				this._three = this._three || {};
			}
		},
		ensure_settings_defaults: function(s) {
			if (!s.environment) s.environment = { mode: 'preset', preset: 'outdoor', custom_hdr_url: '', intensity: 1, rotation: 0, orbit_min_polar_angle: 0, orbit_max_polar_angle: 90, orbit_min_azimuth_angle: -180, orbit_max_azimuth_angle: 180, orbit_min_distance: null, orbit_max_distance: null, orbit_zoom_limits_enabled: true };
			if (!s.background) s.background = { mode: 'environment', color: '#ffffff' };
			if (!s.ground) s.ground = { enabled: true, size: 10, shadow_opacity: 0.5, shadow_blur: 0 };
			if (!s.renderer) s.renderer = { tone_mapping: 'linear', exposure: 1, output_color_space: 'srgb', alpha: false };
			if (!s.lighting) s.lighting = { global_intensity: 1, lights: [] };
		},
		on_reset_settings: function(e) {
			e.preventDefault();
			const msg = (typeof PC_lang !== 'undefined' && PC_lang.reset_settings_3d_confirm) ? PC_lang.reset_settings_3d_confirm : 'This will restore all 3D viewer settings to their defaults. Your selected 3D file will be kept. Continue?';
			if (!confirm(msg)) return;
			const defaults = (typeof PC_lang !== 'undefined' && PC_lang.default_settings_3d) ? PC_lang.default_settings_3d : {};
			const current = PC.app.admin.settings_3d || {};
			const gltf_data = {
				url: current.url,
				filename: current.filename,
				attachment_id: current.attachment_id,
			};
			const admin = PC.app.get_admin();
			admin.settings_3d = Object.assign({}, defaults, gltf_data);
			this.col = admin.settings_3d;
			PC.app.is_modified.settings_3d = true;
			this.render();
			if (this.apply_preview_settings) this.apply_preview_settings();
		},
		on_tab_click: function(e) {
			const tab = $(e.currentTarget).data('tab');
			if (!tab) return;
			this.$('.pc-3d-tab').removeClass('active').attr('aria-selected', 'false');
			this.$('.pc-3d-tab[data-tab="' + tab + '"]').addClass('active').attr('aria-selected', 'true');
			this.$('.pc-3d-tab-panel').removeClass('active').attr('hidden', 'hidden');
			this.$('#pc-3d-tab-' + tab).addClass('active').removeAttr('hidden');
		},
		toggle_env_and_bg_visibility: function() {
			const env_mode = (PC.app.admin.settings_3d.environment && PC.app.admin.settings_3d.environment.mode) || 'preset';
			this.$('.pc-3d-env-preset-row').toggle(env_mode === 'preset');
			this.$('.pc-3d-env-custom-row').toggle(env_mode === 'custom');
			const bg_mode = (PC.app.admin.settings_3d.background && PC.app.admin.settings_3d.background.mode) || 'environment';
			this.$('.pc-3d-bg-color-row').toggle(bg_mode === 'solid');
		},
		bind_value_displays: function() {
			const sync = (sel, val_sel) => {
				const input_el = this.$(sel);
				const value_el = this.$(val_sel);
				if (input_el.length && value_el.length) value_el.text(input_el.val());
			};
			sync('.pc-3d-env-intensity', '.pc-3d-env-intensity-value');
			sync('.pc-3d-env-rotation', '.pc-3d-env-rotation-value');
			sync('.pc-3d-shadow-opacity', '.pc-3d-shadow-opacity-value');
			sync('.pc-3d-shadow-blur', '.pc-3d-shadow-blur-value');
			sync('.pc-3d-exposure', '.pc-3d-exposure-value');
			sync('.pc-3d-global-intensity', '.pc-3d-global-intensity-value');
		},
		set_nested: function(obj, path, value) {
			const parts = path.split('.');
			let o = obj;
			for (let i = 0; i < parts.length - 1; i++) {
				const k = parts[i];
				if (!o[k]) o[k] = {};
				o = o[k];
			}
			o[parts[parts.length - 1]] = value;
		},
		on_env_mode_change: function() {
			const val = this.$('.pc-3d-env-mode').val();
			PC.app.admin.settings_3d.environment = PC.app.admin.settings_3d.environment || {};
			PC.app.admin.settings_3d.environment.mode = val;
			PC.app.is_modified.settings_3d = true;
			this.toggle_env_and_bg_visibility();
			this.apply_preview_settings();
		},
		on_bg_mode_change: function() {
			const val = this.$('.pc-3d-bg-mode').val();
			PC.app.admin.settings_3d.background = PC.app.admin.settings_3d.background || {};
			PC.app.admin.settings_3d.background.mode = val;
			PC.app.is_modified.settings_3d = true;
			this.toggle_env_and_bg_visibility();
			this.apply_preview_settings();
		},
		on_slider_input: function(e) {
			const el = $(e.currentTarget);
			const key = el.data('key');
			const val = el.attr('type') === 'range' ? parseFloat(el.val()) : el.val();
			if (key) {
				this.set_nested(PC.app.admin.settings_3d, key, val);
				PC.app.is_modified.settings_3d = true;
			}
			const val_sel = el.attr('type') === 'range' && el.next('.pc-3d-value-display').length ? el.next('.pc-3d-value-display') : null;
			if (val_sel && val_sel.length) val_sel.text(val);
			this.apply_preview_settings();
		},
		on_setting_change: function(e) {
			const el = $(e.currentTarget);
			const key = el.data('key');
			let val = el.val();
			if (el.attr('type') === 'checkbox') val = el.is(':checked');
			else if (el.attr('type') === 'number') val = parseFloat(val) || 0;
			else if (el.attr('type') === 'range') val = parseFloat(val);
			if (key) {
				this.set_nested(PC.app.admin.settings_3d, key, val);
				PC.app.is_modified.settings_3d = true;
			}
			this.apply_preview_settings();
		},
		set_min_zoom_from_view: function(e) {
			e.preventDefault();
			if (!this._three || !this._three.controls) return;
			const distance = this._three.controls.getDistance();
			PC.app.admin.settings_3d.environment = PC.app.admin.settings_3d.environment || {};
			PC.app.admin.settings_3d.environment.orbit_min_distance = distance;
			PC.app.is_modified.settings_3d = true;
			this._three.controls.minDistance = distance;
			this.apply_preview_settings();
		},
		set_max_zoom_from_view: function(e) {
			e.preventDefault();
			if (!this._three || !this._three.controls) return;
			const distance = this._three.controls.getDistance();
			PC.app.admin.settings_3d.environment = PC.app.admin.settings_3d.environment || {};
			PC.app.admin.settings_3d.environment.orbit_max_distance = distance;
			PC.app.is_modified.settings_3d = true;
			this._three.controls.maxDistance = distance;
			this.apply_preview_settings();
		},
		update_zoom_buttons_state: function() {
			const disabled = !this._three || !this._three.controls;
			this.$('.pc-3d-set-min-zoom, .pc-3d-set-max-zoom').prop('disabled', disabled);
		},
		populate_angle_select: function() {
			const $sel = this.$('.pc-3d-angle-select');
			if (!$sel.length) return;
			$sel.empty().append('<option value="">— ' + ( (typeof PC_lang !== 'undefined' && PC_lang.select_angle) ? PC_lang.select_angle : 'Select angle' ) + ' —</option>');
			const angles = this.admin && this.admin.angles;
			if (angles && angles.length) {
				angles.each(function(m) {
					const name = m.get('name') || ('Angle ' + (m.get('_id') || m.id || m.cid));
					$sel.append($('<option></option>').val(m.id).text(name));
				});
			}
		},
		on_angle_select_change: function() {
			if (!this._three || !this._three.camera || !this._three.controls) return;
			const angleId = this.$('.pc-3d-angle-select').val();
			if (!angleId) return;
			const angles = this.admin && this.admin.angles;
			if (!angles) return;
			const angle = angles.get(angleId);
			if (!angle) return;
			const pos = angle.get('camera_position');
			const tgt = angle.get('camera_target');
			if (pos && tgt && typeof pos.x === 'number' && typeof pos.y === 'number' && typeof pos.z === 'number' && typeof tgt.x === 'number' && typeof tgt.y === 'number' && typeof tgt.z === 'number') {
				this._three.camera.position.set(pos.x, pos.y, pos.z);
				this._three.controls.target.set(tgt.x, tgt.y, tgt.z);
				this._three.camera.lookAt(tgt.x, tgt.y, tgt.z);
			}
		},
		set_current_view_to_angle: function(e) {
			e.preventDefault();
			if (!this._three || !this._three.controls || !this._three.camera) return;
			const angleId = this.$('.pc-3d-angle-select').val();
			if (!angleId) return;
			const angles = this.admin && this.admin.angles;
			if (!angles) return;
			const angle = angles.get(angleId);
			if (!angle) return;
			const pos = this._three.camera.position;
			const target = this._three.controls.target;
			angle.set({
				camera_position: { x: pos.x, y: pos.y, z: pos.z },
				camera_target: { x: target.x, y: target.y, z: target.z }
			});
			PC.app.is_modified.angles = true;
		},
		import_cameras_from_gltf: function(e) {
			e.preventDefault();
			const gltf = this._three && this._three.mainGltf;
			let cameras = [];
			if (gltf && gltf.cameras && gltf.cameras.length) {
				cameras = gltf.cameras;
			} else if (gltf && gltf.scene) {
				gltf.scene.traverse((obj) => { if (obj.isCamera) cameras.push(obj); });
			}
			if (!cameras.length) {
				alert((typeof PC_lang !== 'undefined' && PC_lang.no_cameras_in_gltf) ? PC_lang.no_cameras_in_gltf : 'No cameras found in the main GLTF file.');
				return;
			}
			const angles = this.admin && this.admin.angles;
			if (!angles) return;
			const dir = new THREE.Vector3();
			const nextOrder = angles.nextOrder ? angles.nextOrder() : (angles.length ? (angles.last().get('order') || angles.length) + 1 : 1);
			cameras.forEach((cam, i) => {
				cam.updateMatrixWorld(true);
				dir.set(0, 0, -1).applyQuaternion(cam.quaternion);
				const pos = cam.position;
				const dist = 1;
				const target = { x: pos.x + dir.x * dist, y: pos.y + dir.y * dist, z: pos.z + dir.z * dist };
				const name = (cam.name && cam.name.trim()) || ('Camera ' + (i + 1));
				const attrs = {
					name: name,
					order: nextOrder + i,
					camera_position: { x: pos.x, y: pos.y, z: pos.z },
					camera_target: target,
					image: { url: '', id: '' }
				};
				angles.add(attrs);
			});
			PC.app.is_modified.angles = true;
			this.populate_angle_select();
		},
		select_hdr: function(e) {
			e.preventDefault();
			const frame = wp.media({
				title: 'Upload HDR',
				button: { text: 'Use this file' },
				multiple: false,
				library: {},
			});
			frame.on('select', () => {
				const attachment = frame.state().get('selection').first().toJSON();
				const url = attachment.url;
				PC.app.admin.settings_3d.environment = PC.app.admin.settings_3d.environment || {};
				PC.app.admin.settings_3d.environment.custom_hdr_url = url;
				this.$('.pc-3d-env-custom-hdr-url').val(url);
				PC.app.is_modified.settings_3d = true;
				this.apply_preview_settings();
			});
			frame.open();
		},
		_create_light_from_settings: function(settings, gi) {
			const color = new THREE.Color(settings.color || '#ffffff');
			const base = (settings.intensity != null) ? settings.intensity : 1;
			const intensity = base * gi;
			const type = settings.type || 'PointLight';
			let light;
			if (type === 'DirectionalLight') {
				light = new THREE.DirectionalLight(color, intensity);
			} else if (type === 'SpotLight') {
				light = new THREE.SpotLight(color, intensity);
			} else {
				light = new THREE.PointLight(color, intensity);
			}
			light.userData.baseIntensity = base;
			return light;
		},
		apply_preview_settings: function() {
			if (!this._three || !this._three.scene || !this._three.renderer) return;
			const s = PC.app.admin.settings_3d;
			const scene = this._three.scene;
			const renderer = this._three.renderer;

			// Renderer: tone mapping, exposure, alpha, color space
			const r = s.renderer || {};
			const bg = s.background || {};
			renderer.toneMapping = r.tone_mapping === 'aces' ? THREE.ACESFilmicToneMapping : r.tone_mapping === 'linear' ? THREE.LinearToneMapping : THREE.NoToneMapping;
			renderer.toneMappingExposure = typeof r.exposure === 'number' ? r.exposure : 1;
			renderer.outputColorSpace = r.output_color_space === 'linear' ? THREE.LinearSRGBColorSpace : THREE.SRGBColorSpace;
			// Transparent background or explicit alpha: clear with alpha 0 so canvas is see-through
			renderer.setClearAlpha((bg.mode === 'transparent' || r.alpha) ? 0 : 1);

			// Background
			if (bg.mode === 'transparent') {
				scene.background = null;
			} else if (bg.mode === 'solid' && bg.color) {
				scene.background = new THREE.Color(bg.color);
			}
			// environment mode background is applied via scene.environment (below)

			// Environment: reload map when preset or custom URL changes, then set intensity/rotation
			const env = s.environment || {};
			const hdr_base = (typeof PC_lang !== 'undefined' && PC_lang.hdr_base_url) ? PC_lang.hdr_base_url : '';
			const preset_file = (env.preset === 'studio') ? 'studio_small_08_1k.hdr' : 'royal_esplanade_1k.hdr';
			const desired_url = env.mode === 'custom' && env.custom_hdr_url ? env.custom_hdr_url : hdr_base + preset_file;
			if (this._three.current_env_url !== desired_url) {
				this._three.current_env_url = desired_url;
				new HDRLoader().load(desired_url, (texture) => {
					texture.mapping = THREE.EquirectangularReflectionMapping;
					scene.environment = texture;
					this.apply_preview_settings();
				}, undefined, () => { this._three.current_env_url = null; });
			}
			if (typeof scene.environmentIntensity !== 'undefined') {
				scene.environmentIntensity = (env.intensity != null) ? env.intensity : 1;
			}
			if (typeof scene.environmentRotation !== 'undefined' && env.rotation != null) {
				scene.environmentRotation = new THREE.Euler(0, env.rotation * Math.PI / 180, 0);
			}

			// OrbitControls polar, azimuth, and zoom (distance) limits
			if (this._three.controls) {
				const min_polar = (env.orbit_min_polar_angle != null) ? env.orbit_min_polar_angle : 0;
				const max_polar = (env.orbit_max_polar_angle != null) ? env.orbit_max_polar_angle : 90;
				this._three.controls.minPolarAngle = (min_polar * Math.PI) / 180;
				this._three.controls.maxPolarAngle = (max_polar * Math.PI) / 180;
				const min_azimuth = (env.orbit_min_azimuth_angle != null) ? env.orbit_min_azimuth_angle : -180;
				const max_azimuth = (env.orbit_max_azimuth_angle != null) ? env.orbit_max_azimuth_angle : 180;
				this._three.controls.minAzimuthAngle = (min_azimuth * Math.PI) / 180;
				this._three.controls.maxAzimuthAngle = (max_azimuth * Math.PI) / 180;
				// Apply zoom limits in preview only when toggle is on; otherwise no limits so user can move freely
				const zoomLimitsEnabled = env.orbit_zoom_limits_enabled !== false;
				const minDist = zoomLimitsEnabled && (typeof env.orbit_min_distance === 'number' && env.orbit_min_distance > 0) ? env.orbit_min_distance : 0;
				const maxDist = zoomLimitsEnabled && (typeof env.orbit_max_distance === 'number' && env.orbit_max_distance > 0) ? env.orbit_max_distance : Infinity;
				this._three.controls.minDistance = minDist;
				this._three.controls.maxDistance = maxDist;
			}
			this.update_zoom_buttons_state();

			// Fake shadow (planar) – updated in fake_shadow.update() when model_root exists
			const g = s.ground || {};
			if (this._three.fake_shadow && this._three.model_root) {
				this._three.fake_shadow.update(this._three.model_root, g);
			}

			// Global light intensity and per-light settings
			const gi = (s.lighting && s.lighting.global_intensity != null) ? s.lighting.global_intensity : 1;
			const lights_list = (s.lighting && s.lighting.lights) || [];
			const scene_lights = [];
			scene.traverse((obj) => {
				if (!obj.isLight || obj.userData?.isDefaultLight === true) return;
				scene_lights.push({ obj, settings: lights_list[scene_lights.length] });
			});

			scene_lights.forEach(({ obj, settings }) => {
				let target = obj;
				if (settings) {
					const desired_type = settings.type || 'PointLight';
					const type_matches =
						(desired_type === 'PointLight' && obj.isPointLight) ||
						(desired_type === 'DirectionalLight' && obj.isDirectionalLight) ||
						(desired_type === 'SpotLight' && obj.isSpotLight);
					if (!type_matches) {
						const parent = obj.parent;
						const idx = parent.children.indexOf(obj);
						const new_light = this._create_light_from_settings(settings, gi);
						new_light.position.copy(obj.position);
						new_light.quaternion.copy(obj.quaternion);
						if (obj.target && new_light.target) {
							new_light.target.position.copy(obj.target.position);
							if (obj.target.parent) obj.target.parent.add(new_light.target);
							else parent.add(new_light.target);
						}
						parent.remove(obj);
						parent.children.splice(idx, 0, new_light);
						new_light.parent = parent;
						target = new_light;
					}
					target.visible = settings.enabled !== false;
					if (target.visible) {
						if (settings.color) target.color.set(settings.color);
						target.userData.baseIntensity = (settings.intensity != null) ? settings.intensity : 1;
						target.intensity = target.userData.baseIntensity * gi;
					}
				} else {
					target.intensity = (target.userData?.baseIntensity ?? target.intensity) * gi;
				}
			});
			if (this._three.default_light) {
				const lighting = s.lighting || {};
				const enabled = lighting.default_light_enabled !== false;
				this._three.default_light.visible = enabled;
				if (enabled) {
					this._three.default_light.intensity = (this._three.default_light.userData?.baseIntensity ?? 1.2) * gi;
				}
			}
		},
        on_window_resize: function() {

        },
        maybe_cleanup: function() {
            if (this._three?.fake_shadow) {
                this._three.fake_shadow.dispose();
                this._three.fake_shadow = null;
            }
            if (this._three?.renderer) {
                cancelAnimationFrame(this._three.animation_id); // stop previous loop

                // Dispose renderer
                this._three.renderer.dispose();
                if (this._three.renderer.domElement?.parentNode) {
                    this._three.renderer.domElement.parentNode.removeChild(this._three.renderer.domElement);
                }

                if (this._three.on_resize) {
                    window.removeEventListener('resize', this._three.on_resize);
                }

                // Dispose controls
                if (this._three.controls) this._three.controls.dispose();

                // Optionally, traverse the scene and dispose geometries/materials
                if (this._three.scene) {
                    this._three.scene.traverse((obj) => {
                        if (obj.geometry) obj.geometry.dispose();
                        if (obj.material) {
                            if (Array.isArray(obj.material)) {
                                obj.material.forEach(m => m.dispose());
                            } else {
                                obj.material.dispose();
                            }
                        }
                    });
                }
            }
        },
		/**
		 * Collect layer entries that have an uploaded 3D model (for preview and tree).
		 * @returns {Array<{ url: string, label: string }>}
		 */
		get_layer_model_entries: function() {
			const entries = [];
			const layers = PC.app.admin && PC.app.admin.layers;
			if ( ! layers ) return entries;
			layers.each( function( layer ) {
				if ( layer.get( 'object_selection_3d' ) !== 'upload_model' ) return;
				const url = layer.get( 'model_upload_3d_url' );
				if ( ! layer.get( 'model_upload_3d' ) || ! url ) return;
				const label = layer.get( 'admin_label' ) || layer.get( 'name' ) || ( 'Layer ' + layer.id );
				entries.push( { url: url, label: label } );
			} );
			return entries;
		},

		_setPreviewLoadingStep: function(stepId, label) {
			const container = this.$('.pc-3d-preview--canvas-container')[0];
			if (!container) return;
			let overlay = container.querySelector('.pc-3d-preview-loading');
			if (!overlay) return;
			const list = overlay.querySelector('.pc-3d-preview-loading-steps');
			if (!list) return;
			let li = list.querySelector('[data-step-id="' + stepId + '"]');
			if (li) {
				li.querySelector('.pc-3d-preview-loading-label').textContent = label;
				return;
			}
			li = document.createElement('li');
			li.setAttribute('data-step-id', stepId);
			li.className = 'pc-3d-preview-loading-step';
			li.innerHTML = '<span class="spinner is-active" aria-hidden="true"></span> <span class="pc-3d-preview-loading-label">' + (label || stepId) + '</span>';
			list.appendChild(li);
		},
		_removePreviewLoadingStep: function(stepId) {
			const container = this.$('.pc-3d-preview--canvas-container')[0];
			if (!container) return;
			const li = container.querySelector('.pc-3d-preview-loading [data-step-id="' + stepId + '"]');
			if (li) li.remove();
		},
		_hidePreviewLoading: function() {
			const container = this.$('.pc-3d-preview--canvas-container')[0];
			if (!container) return;
			const overlay = container.querySelector('.pc-3d-preview-loading');
			if (overlay) overlay.classList.add('is-hidden');
		},
		render_tree_loading: function() {
			const tree_el = this.$('.pc-3d-tree');
			if (!tree_el.length) return;
			tree_el.empty().append(
				'<div class="pc-3d-tree-loading"><span class="spinner is-active" aria-hidden="true"></span> ' +
				( (typeof PC_lang !== 'undefined' && PC_lang.loading_scene_structure) ? PC_lang.loading_scene_structure : 'Loading scene structure…' ) +
				'</div>'
			);
		},
		render_tree_message: function(message) {
			const tree_el = this.$('.pc-3d-tree');
			if (!tree_el.length) return;
			tree_el.empty().append('<p class="pc-3d-tree-message description">' + (message || '') + '</p>');
		},

		render_preview: function(url) {
            const container = this.$('.pc-3d-preview--canvas-container')[0];
            if (!container) return;

            this.maybe_cleanup();
            container.innerHTML = '';

			// Loading overlay: list of current steps (HDR, main, layers)
			const loadingOverlay = document.createElement('div');
			loadingOverlay.className = 'pc-3d-preview-loading';
			loadingOverlay.setAttribute('aria-live', 'polite');
			loadingOverlay.innerHTML = '<ul class="pc-3d-preview-loading-steps" role="list"></ul>';
			container.appendChild(loadingOverlay);

			this.render_tree_loading();

            const s = PC.app.admin.settings_3d;
            const r = s.renderer || {};
            const bg = s.background || {};
            // Enable alpha channel when transparent background or renderer alpha option is on (needed for see-through)
            const useAlpha = !!(r.alpha || bg.mode === 'transparent');
            const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: useAlpha });
            renderer.shadowMap.enabled = false;
            renderer.setSize(container.clientWidth, container.clientHeight);
            renderer.setPixelRatio(window.devicePixelRatio);
            renderer.toneMapping = r.tone_mapping === 'aces' ? THREE.ACESFilmicToneMapping : r.tone_mapping === 'linear' ? THREE.LinearToneMapping : THREE.NoToneMapping;
            renderer.toneMappingExposure = typeof r.exposure === 'number' ? r.exposure : 1;
            renderer.outputColorSpace = r.output_color_space === 'linear' ? THREE.LinearSRGBColorSpace : THREE.SRGBColorSpace;
            renderer.setClearAlpha((bg.mode === 'transparent' || r.alpha) ? 0 : 1);
            container.appendChild(renderer.domElement);

            const scene = new THREE.Scene();
            const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
            camera.position.set(0, 1, 3);

            const default_light = new THREE.DirectionalLight(0xffffff, 1.2);
            default_light.position.set(5, 10, 7.5);
            default_light.userData = { baseIntensity: 1.2, isDefaultLight: true };
            scene.add(default_light);
            scene.add(default_light.target);

            this._three = { scene, camera, renderer, controls: null, animation_id: null, on_resize: null, fake_shadow: null, model_root: null, scene_roots: [], current_env_url: null, default_light };
            window.pc_three = this._three;

            const env = s.environment || {};
            const hdr_base = (typeof PC_lang !== 'undefined' && PC_lang.hdr_base_url) ? PC_lang.hdr_base_url : '';
            const preset_file = (env.preset === 'studio') ? 'studio_small_08_1k.hdr' : 'royal_esplanade_1k.hdr';
            const initial_env_url = env.mode === 'custom' && env.custom_hdr_url ? env.custom_hdr_url : hdr_base + preset_file;

			const layerEntries = this.get_layer_model_entries();
			const hdrLabel = (typeof PC_lang !== 'undefined' && PC_lang.loading_hdr) ? PC_lang.loading_hdr : 'HDR environment';
			const mainLabel = (typeof PC_lang !== 'undefined' && PC_lang.loading_main_model) ? PC_lang.loading_main_model : 'Main model';
			this._setPreviewLoadingStep('hdr', hdrLabel);
			this._setPreviewLoadingStep('main', mainLabel);
			layerEntries.forEach((le, i) => {
				this._setPreviewLoadingStep('layer-' + i, (typeof PC_lang !== 'undefined' && PC_lang.loading_layer) ? PC_lang.loading_layer.replace('%s', le.label) : ('Layer: ' + le.label));
			});

			new HDRLoader().load(initial_env_url, (texture) => {
                texture.mapping = THREE.EquirectangularReflectionMapping;
                scene.environment = texture;
                this._three.current_env_url = initial_env_url;
				this._removePreviewLoadingStep('hdr');
                this.apply_preview_settings();
            }, undefined, () => {
				this._removePreviewLoadingStep('hdr');
			});

            if (bg.mode === 'transparent') scene.background = null;
            else if (bg.mode === 'solid' && bg.color) scene.background = new THREE.Color(bg.color);

            const controls = new OrbitControls(camera, renderer.domElement);
            const env_for_orbit = s.environment || {};
            const min_polar = (env_for_orbit.orbit_min_polar_angle != null) ? env_for_orbit.orbit_min_polar_angle : 0;
            const max_polar = (env_for_orbit.orbit_max_polar_angle != null) ? env_for_orbit.orbit_max_polar_angle : 90;
            const min_azimuth = (env_for_orbit.orbit_min_azimuth_angle != null) ? env_for_orbit.orbit_min_azimuth_angle : -180;
            const max_azimuth = (env_for_orbit.orbit_max_azimuth_angle != null) ? env_for_orbit.orbit_max_azimuth_angle : 180;
            controls.minPolarAngle = (min_polar * Math.PI) / 180;
            controls.maxPolarAngle = (max_polar * Math.PI) / 180;
            controls.minAzimuthAngle = (min_azimuth * Math.PI) / 180;
            controls.maxAzimuthAngle = (max_azimuth * Math.PI) / 180;
            // Apply zoom limits in preview only when toggle is on
            const zoomLimitsEnabled = env_for_orbit.orbit_zoom_limits_enabled !== false;
            const minDist = zoomLimitsEnabled && (typeof env_for_orbit.orbit_min_distance === 'number' && env_for_orbit.orbit_min_distance > 0) ? env_for_orbit.orbit_min_distance : 0;
            const maxDist = zoomLimitsEnabled && (typeof env_for_orbit.orbit_max_distance === 'number' && env_for_orbit.orbit_max_distance > 0) ? env_for_orbit.orbit_max_distance : Infinity;
            controls.minDistance = minDist;
            controls.maxDistance = maxDist;
            this._three.controls = controls;

            const on_resize = () => {
                camera.aspect = container.clientWidth / container.clientHeight;
                camera.updateProjectionMatrix();
                renderer.setSize(container.clientWidth, container.clientHeight);
                renderer.setPixelRatio(window.devicePixelRatio);
            };
            this._three.on_resize = on_resize;
            window.addEventListener('resize', on_resize);

            const rootGroup = new THREE.Group();
            rootGroup.name = 'ConfiguratorRoot';

            // Always run model load in next tick so the animation loop is started first (fixes preview not loading when store returns cached data synchronously)
            var viewRef = this;
            var runPreviewLoad = function() {
                PC.threeD.store.get( url, function( err, data ) {
                    if ( err || ! data ) {
                        viewRef._hidePreviewLoading();
                        var msg = ( typeof PC_lang !== 'undefined' && PC_lang.failed_load_main_model ) ? PC_lang.failed_load_main_model : 'Failed to load main model.';
                        viewRef.render_tree_message( msg );
                        return;
                    }
                    if ( ! viewRef._three || ! viewRef._three.scene ) return;
                    viewRef._removePreviewLoadingStep( 'main' );
                    var gltf = data.gltf;
                    viewRef._three.mainGltf = gltf;
                    // Clone so the preview always has its own scene graph (cached gltf.scene may be attached elsewhere from a previous view)
                    var mainScene = gltf.scene.clone( true );
                    mainScene.name = mainScene.name || 'Main';
                    rootGroup.add( mainScene );

                    var scene_roots = [ { object: mainScene, label: 'Main' } ];

                    var onAllLoaded = function() {
                        if ( ! viewRef._three || ! viewRef._three.scene ) return;
                        viewRef._hidePreviewLoading();
                        if ( viewRef._three.fake_shadow ) {
                            viewRef._three.fake_shadow.dispose();
                            viewRef._three.fake_shadow = null;
                        }
                        viewRef._three.scene.add( rootGroup );
                        viewRef._three.model_root = rootGroup;
                        viewRef._three.scene_roots = scene_roots;
                        viewRef._three.fake_shadow = new FakeShadow( viewRef._three.scene );
                        viewRef.render_tree( viewRef._three.scene_roots );
                        viewRef.extract_lights_from_scene( rootGroup );

                        var box = new THREE.Box3().setFromObject( rootGroup );
                        var size = box.getSize( new THREE.Vector3() ).length();
                        var center = box.getCenter( new THREE.Vector3() );
                        var firstAngle = viewRef.admin && viewRef.admin.angles && viewRef.admin.angles.length ? viewRef.admin.angles.first() : null;
                        var pos = firstAngle && firstAngle.get( 'camera_position' );
                        var tgt = firstAngle && firstAngle.get( 'camera_target' );
                        if ( pos && tgt && typeof pos.x === 'number' && typeof pos.y === 'number' && typeof pos.z === 'number' && typeof tgt.x === 'number' && typeof tgt.y === 'number' && typeof tgt.z === 'number' ) {
                            camera.position.set( pos.x, pos.y, pos.z );
                            controls.target.set( tgt.x, tgt.y, tgt.z );
                            camera.lookAt( tgt.x, tgt.y, tgt.z );
                        } else {
                            controls.target.copy( center );
                            camera.position.copy( center ).add( new THREE.Vector3( size / 2, size / 2, size / 2 ) );
                            camera.lookAt( center );
                        }
                        on_resize();
                        viewRef.apply_preview_settings();
                    };

                    if ( layerEntries.length === 0 ) {
                        onAllLoaded();
                        return;
                    }

                    var pending = layerEntries.length;
                    layerEntries.forEach( function( le, i ) {
                        PC.threeD.store.get( le.url, function( errLayer, dataLayer ) {
                            if ( ! viewRef._three ) return;
                            viewRef._removePreviewLoadingStep( 'layer-' + i );
                            if ( errLayer || ! dataLayer ) {
                                pending--;
                                if ( pending === 0 ) onAllLoaded();
                                return;
                            }
                            // Clone so the preview always has its own scene graph
                            var layerScene = dataLayer.gltf.scene.clone( true );
                            layerScene.name = layerScene.name || le.label;
                            rootGroup.add( layerScene );
                            scene_roots.push( { object: layerScene, label: le.label } );
                            pending--;
                            if ( pending === 0 ) onAllLoaded();
                        } );
                    } );
                } );
            };
            setTimeout( runPreviewLoad, 0 );

            const animate = () => {
                this._three.animation_id = requestAnimationFrame(animate);
                controls.update();
                const g = PC.app.admin.settings_3d.ground || {};
                if (this._three.fake_shadow && g.enabled !== false) {
                    this._three.fake_shadow.render(renderer, scene);
                }
                renderer.render(scene, camera);
            };
            animate();
        },
        extract_lights_from_scene: function(root) {
            PC.app.admin.settings_3d.lighting = PC.app.admin.settings_3d.lighting || {};
            PC.app.admin.settings_3d.lighting.lights = [];

            const lights = [];
            root.traverse((obj) => {
                if (!obj.isLight) return;
                const type = obj.type;
                const hex = (obj.color && obj.color.getHex) ? obj.color.getHex() : 0xffffff;
                const color = '#' + ('000000' + hex.toString(16)).slice(-6);
                lights.push({ name: obj.name || type, type, color, intensity: obj.intensity, enabled: true, cast_shadow: true });
                obj.userData = obj.userData || {};
                obj.userData.baseIntensity = obj.intensity;
            });
            PC.app.admin.settings_3d.lighting.lights = lights;
            this.render_lights_list();
        },
        render_lights_list: function() {
            const list_el = this.$('.pc-3d-lights-list');
            if (this._light_item_views) {
                this._light_item_views.forEach((view) => { view.remove(); });
                this._light_item_views = [];
            }
            list_el.empty();

            const lights = (PC.app.admin.settings_3d.lighting && PC.app.admin.settings_3d.lighting.lights) || [];
            if (!lights.length) {
                list_el.append('<p class="description">No lights in model.</p>');
                return;
            }

            lights.forEach((light, i) => {
                const view = new PC.views.light_item_3d({
                    parent_view: this,
                    index: i,
                    light: light,
                });
                view.render();
                list_el.append(view.el);
                this._light_item_views = this._light_item_views || [];
                this._light_item_views.push(view);
            });
        },
        /**
         * Build tree UI from scene roots (main + layer models). Each item has a visibility toggle.
         * @param {Array<{ object: THREE.Object3D, label: string }>} scene_roots
         */
        render_tree: function(scene_roots) {
            const tree_el = this.$('.pc-3d-tree').empty();
            if (!scene_roots || !scene_roots.length) {
                const msg = (typeof PC_lang !== 'undefined' && PC_lang.no_objects_in_scene) ? PC_lang.no_objects_in_scene : 'No objects in scene.';
                tree_el.append('<p class="pc-3d-tree-message description">' + msg + '</p>');
                return;
            }

            const build_list = (obj) => {
				const hasChildren = obj.children && obj.children.length;
				const li_el = $('<li class="pc-3d-tree-item' + (hasChildren ? ' pc-3d-tree-item--has-children' : '') + '">');

				let toggle = null;
				if (hasChildren) {
					toggle = $('<button type="button" class="pc-3d-tree-toggle" aria-label="Toggle children" aria-expanded="true"></button>');
					toggle.on('click', function() {
						const $li = $(this).closest('.pc-3d-tree-item--has-children');
						const isCollapsed = $li.toggleClass('is-collapsed').hasClass('is-collapsed');
						$li.children('ul').toggle(!isCollapsed);
						$(this).attr('aria-expanded', !isCollapsed);
					});
					li_el.append(toggle);
				}

                const cb = $('<input type="checkbox" class="pc-3d-tree-visible" title="Show/hide in preview">')
                    .prop('checked', obj.visible !== false)
                    .data('object3d', obj);
                cb.on('change', function() {
                    const o = $(this).data('object3d');
                    if (o) o.visible = this.checked;
                });
                const label = (obj.name || '') + ' [' + (obj.type || '') + ']';
                li_el.append(cb).append(' ').append($('<span class="pc-3d-tree-label">').text(label));
				if (hasChildren) {
                    const ul_el = $('<ul>');
                    obj.children.forEach((child) => ul_el.append(build_list(child)));
                    li_el.append(ul_el);
                }
                return li_el;
            };

			const ul_el = $('<ul class="pc-3d-tree-list">');
			scene_roots.forEach(({ object, label }) => {
				const hasChildren = object.children && object.children.length;
				const li_el = $('<li class="pc-3d-tree-item pc-3d-tree-item--root' + (hasChildren ? ' pc-3d-tree-item--has-children' : '') + '">');

				let toggle = null;
				if (hasChildren) {
					toggle = $('<button type="button" class="pc-3d-tree-toggle" aria-label="Toggle children" aria-expanded="true"></button>');
					toggle.on('click', function() {
						const $li = $(this).closest('.pc-3d-tree-item--has-children');
						const isCollapsed = $li.toggleClass('is-collapsed').hasClass('is-collapsed');
						$li.children('ul').toggle(!isCollapsed);
						$(this).attr('aria-expanded', !isCollapsed);
					});
					li_el.append(toggle);
				}

				const cb = $('<input type="checkbox" class="pc-3d-tree-visible" title="Show/hide in preview">')
					.prop('checked', object.visible !== false)
					.data('object3d', object);
				cb.on('change', function() {
					const o = $(this).data('object3d');
					if (o) o.visible = this.checked;
				});
				const displayLabel = label || (object.name || '') + ' [' + (object.type || '') + ']';
				li_el.append(cb).append(' ').append($('<span class="pc-3d-tree-label">').text(displayLabel));
				if (hasChildren) {
					const child_ul = $('<ul>');
					object.children.forEach((child) => child_ul.append(build_list(child)));
					li_el.append(child_ul);
				}
				ul_el.append(li_el);
			});
			tree_el.append(ul_el);
        },
        select_gltf( e ) {
            e.preventDefault();
			PC.threeD.openModelMediaFrame( {
				selectedId: PC.app.admin.settings_3d.attachment_id,
				onSelect: ( attachment ) => {
					var previousUrl = PC.app.admin.settings_3d && PC.app.admin.settings_3d.url ? PC.app.admin.settings_3d.url : null;
					if ( previousUrl && PC.threeD.store && PC.threeD.store.remove ) {
						PC.threeD.store.remove( previousUrl );
					}
					PC.app.admin.settings_3d.url = attachment.gltf_url || attachment.url;
					PC.app.admin.settings_3d.filename = attachment.gltf_filename || attachment.filename;
					PC.app.admin.settings_3d.attachment_id = attachment.id;
					PC.app.is_modified.settings_3d = true;
					this.render();
				},
			} );
        },
        remove_gltf: function( e ) {
            e.preventDefault();
            var previousUrl = PC.app.admin.settings_3d && PC.app.admin.settings_3d.url ? PC.app.admin.settings_3d.url : null;
            if ( previousUrl && PC.threeD.store && PC.threeD.store.remove ) {
                PC.threeD.store.remove( previousUrl );
            }
            PC.app.admin.settings_3d.url = null;
            PC.app.admin.settings_3d.filename = null;
            PC.app.admin.settings_3d.attachment_id = null;
            PC.app.is_modified.settings_3d = true;
            this.render();
        },
        on_remove: function() {
            if (this._three) {
                cancelAnimationFrame(this._three.animation_id);
                window.removeEventListener('resize', this._three.on_resize);
                this._three.renderer.dispose();
                if (this._three.renderer.domElement?.parentNode) {
                    this._three.renderer.domElement.parentNode.removeChild(this._three.renderer.domElement);
                }
                this._three.controls.dispose();
            }
            // Backbone.View.prototype.remove.call(this);
        }
    });

	// -------------------------------------------------------------------------
	// 3D Object selector modal (PC.actions.select_3d_object)
	// Opens in a modal; pass modelUrl or attachmentId to browse that file's tree.
	// Excludes lights, cameras, and the scene root from the tree.
	// -------------------------------------------------------------------------
	PC.actions = PC.actions || {};
	PC.actions.select_3d_object = function( $el, context ) {
		const opts = { target: $el, context };
		if ( $el && $el.data( 'model-url' ) ) opts.modelUrl = $el.data( 'model-url' );
		if ( $el && $el.data( 'attachment-id' ) != null ) opts.attachmentId = $el.data( 'attachment-id' );
		opts.setting = $el?.data( 'setting' ) || 'object_id_3d';
		opts.applySelection = function( selection ) {
			const id = selection?.id;
			if ( id == null ) return;

			// 1) Update model if available (common case: layer/choice forms)
			if ( context && context.model && typeof context.model.set === 'function' ) {
				context.model.set( opts.setting, id );
				// Mark the appropriate collection as modified when we can infer it
				if ( context.collectionName && PC.app && PC.app.is_modified ) {
					PC.app.is_modified[ context.collectionName ] = true;
				} else if ( PC.app && PC.app.is_modified ) {
					// Default to layers, since this action is primarily used there
					PC.app.is_modified.layers = true;
				}
			}

			// 2) Update the DOM input immediately (no need for extra listeners)
			const $root = context?.$el && context.$el.length ? context.$el : $( document );
			const $input = $root.find( '[data-setting="' + opts.setting + '"]' ).first();
			if ( $input && $input.length ) $input.val( id );
		};
		const view = new PC.views.object_selector_3d( opts );
		view.$el.appendTo( 'body' );
		view.render();
	};

	/**
	 * Action: open a media modal to select/upload a 3D model for a layer setting.
	 * Expects `context.model` to be the edited layer model.
	 */
	PC.actions.edit_model_upload = function( $el, context ) {
		if ( ! context || ! context.model ) return;
		var setting = $el ? $el.data( 'setting' ) : null;
		setting = setting || 'model_upload_3d';
		var selectedId = context.model.get( 'model_upload_3d' );
		PC.threeD.openModelMediaFrame( {
			selectedId: selectedId,
			onSelect: function( attachment ) {
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
	PC.actions.remove_model_upload = function( $el, context ) {
		if ( ! context || ! context.model ) return;
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

	PC.views.object_selector_3d = Backbone.View.extend({
		tagName: 'div',
		className: 'mkl-pc-3d-object-selector--container',
		template: wp.template( 'mkl-pc-3d-object-selector' ),
		events: {
			'click .button.select': 'select',
			'click .button.cancel': 'close',
			'input .mkl-pc-3d-object-selector--filter-input': 'on_filter_input',
			'click .mkl-pc-3d-object-selector--tree [data-object-id]': 'on_tree_item_click',
		},
		initialize: function( options ) {
			this.options = options || {};
			this.originals = {
				target: this.options.target,
				context: this.options.context,
			};
			this.modelUrl = this.options.modelUrl || null;
			this.attachmentId = this.options.attachmentId != null ? this.options.attachmentId : null;
			this.treeNodes = [];
			this.selectedId = null;
			this.selectedName = null;
			this.setting = this.options.setting || null;
			this.applySelection = typeof this.options.applySelection === 'function' ? this.options.applySelection : null;
			this._loader = PC.threeD.getGltfLoader();
		},
		render: function() {
			this.$el.html( this.template( {} ) );
			this.$tree = this.$( '.mkl-pc-3d-object-selector--tree' );
			this.$filterInput = this.$( '.mkl-pc-3d-object-selector--filter-input' );
			this.$selectBtn = this.$( '.button.select' );
			this.resolveAndLoad();
			return this;
		},
		resolveAndLoad: function() {
			let url = this.modelUrl;
			if ( url ) {
				this.loadModel( url );
				return;
			}
			if ( this.attachmentId ) {
				const attachment = wp.media.attachment( this.attachmentId );
				attachment.fetch().done( () => {
					const att = attachment.toJSON();
					url = att.gltf_url || att.url;
					if ( url ) this.loadModel( url );
					else this.showError( 'Could not get model URL from attachment.' );
				} ).fail( () => this.showError( 'Failed to load attachment.' ) );
				return;
			}
			// Resolve from context (layer form or choice form): main, layer, or uploaded model
			if ( this.originals.context && this.originals.context.model ) {
				const model = this.originals.context.model;
				const source = model.get( 'object_selection_3d' ) || 'main_model';
				if ( source === 'main_model' ) {
					url = PC.app.admin.settings_3d && PC.app.admin.settings_3d.url ? PC.app.admin.settings_3d.url : null;
					if ( url ) this.loadModel( url );
					else this.showError( 'No main model set. Configure the 3D model in the 3D tab first.' );
					return;
				}
				if ( source === 'layer_model' && this.originals.context.layer ) {
					const layerModel = this.originals.context.layer;
					if ( typeof PC.threeD.resolveChoiceModelUrl === 'function' ) {
						PC.threeD.resolveChoiceModelUrl( model, layerModel, ( resolvedUrl ) => {
							if ( resolvedUrl ) this.loadModel( resolvedUrl );
							else this.showError( 'No 3D file from layer. Set the layer\'s model (main or upload) first.' );
						} );
						return;
					}
				}
				if ( source === 'upload_model' ) {
					const attId = model.get( 'model_upload_3d' );
					if ( attId ) {
						this.attachmentId = attId;
						this.resolveAndLoad();
						return;
					}
					this.showError( 'No uploaded model. Use "Model upload" above to select a file.' );
					return;
				}
			}
			this.showError( 'No 3D file to browse. Pass modelUrl or set main/uploaded model.' );
		},
		showError: function( message ) {
			this.$tree.closest( '.mkl-pc-3d-object-selector--tree-container' ).html( '<p class="description">' + ( message || 'No objects to list.' ) + '</p>' );
		},
		loadModel: function( url ) {
			var view = this;
			PC.threeD.store.get( url, function( err, data ) {
				if ( err || ! data ) {
					view.showError( 'Failed to load the 3D model.' );
					return;
				}
				view.treeNodes = data.objectTree || [];
				view.renderTree( view.treeNodes );
			} );
		},
		renderTree: function( nodes ) {
			const filter = ( this.$filterInput && this.$filterInput.val() ) ? this.$filterInput.val().toLowerCase() : '';
			const filtered = filter ? nodes.filter( ( n ) => ( n.name && n.name.toLowerCase().indexOf( filter ) !== -1 ) || ( n.id && String( n.id ).toLowerCase().indexOf( filter ) !== -1 ) ) : nodes;
			this.$tree.empty();
			filtered.forEach( ( node ) => {
				const indent = ( node.depth || 0 ) * 16;
				const display = ( node.name || node.id || '' ) + ' [' + ( node.type || '' ) + ']';
				const $li = $( '<li class="mkl-pc-3d-object-selector--item" data-object-id="' + ( node.id || '' ).replace( /"/g, '&quot;' ) + '" data-object-name="' + ( node.name || '' ).replace( /"/g, '&quot;' ) + '" style="padding-left:' + indent + 'px;">' ).text( display );
				this.$tree.append( $li );
			} );
		},
		on_filter_input: function() {
			this.renderTree( this.treeNodes );
		},
		on_tree_item_click: function( e ) {
			const $item = $( e.currentTarget );
			this.selectedId = $item.data( 'object-id' );
			this.selectedName = $item.data( 'object-name' ) || this.selectedId;
			this.$( '.mkl-pc-3d-object-selector--item' ).removeClass( 'selected' );
			$item.addClass( 'selected' );
			this.$selectBtn.prop( 'disabled', false );
		},
		select: function() {
			if ( this.selectedId != null ) {
				const payload = { id: this.selectedId, name: this.selectedName, setting: this.setting };
				if ( this.applySelection ) {
					this.applySelection( payload );
				} else if ( this.originals.context && this.originals.context.$el ) {
					// Backwards-compatible fallback
					this.originals.context.$el.trigger( 'object_selected', payload );
				}
			}
			this.close();
		},
		close: function() {
			this.remove();
		},
	});

})(jQuery, PC._us || window._ );