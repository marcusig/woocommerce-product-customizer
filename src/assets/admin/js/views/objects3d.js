/**
 * 3D Objects state view: list and form for managing the 3d_objects collection.
 */
var PC = PC || {};
PC.views = PC.views || {};

( function( $, _ ) {
	var EMPTY_FILE = { attachment_id: null, url: '' };

	function sanitizeLabelFromFilename( filename, fallback ) {
		var raw = filename || '';
		var cleaned = raw.replace( /\.[^.]+$/, '' ).replace( /[_-]+/g, ' ' ).trim();
		return cleaned || fallback;
	}

	PC.views.objects3d = PC.views.layers.extend({
		collectionName: 'objects3d',
		events: ( function() {
			var parent = PC.views.layers.prototype.events || {};
			return _.extend( {}, parent, {
				'click .pc-3d-add-toggle': 'toggle_add_menu',
				'click .pc-3d-add-tile': 'create_from_tile',
			} );
		} )(),
		single_view: function() { return PC.views.object3d_item; },
		new_attributes: function( name ) {
			return {
				_id: PC.app.get_new_id( this.col ),
				name: name,
				order: this.col.nextOrder(),
				active: true,
			};
		},
		toggle_add_menu: function( event ) {
			event.preventDefault();
			this.$( '.pc-3d-add-menu' ).toggleClass( 'hidden' );
		},
		create_from_tile: function( event ) {
			event.preventDefault();
			event.stopPropagation();
			var $tile = $( event.currentTarget );
			var kind = $tile.data( 'add-kind' );
			this.$( '.pc-3d-add-menu' ).addClass( 'hidden' );

			if ( kind === 'object' ) {
				this.create_object_from_media();
				return;
			}
			if ( kind === 'light' ) {
				this.create_light_type( $tile.data( 'light-type' ) );
				return;
			}
			if ( kind === 'environment' ) {
				var envType = $tile.data( 'env-type' );
				if ( envType === 'hdri' ) {
					this.create_environment_hdri();
				} else if ( envType === 'cubemap' ) {
					this.create_environment_cubemap();
				}
			}
		},
		_add_object_and_focus: function( attrs ) {
			if ( ! this.col || ! this.col.create_object ) return null;
			var objectData = this.col.create_object( attrs || {} );
			var model = this.col.add( objectData );
			if ( ! model ) return null;

			this.col.each( function( m ) {
				if ( m !== model && m.get( 'active' ) ) {
					m.set( 'active', false );
				}
			} );
			model.set( 'active', true );

			setTimeout( function() {
				var itemView = _.find( this.items, function( it ) { return it.model === model; } );
				if ( itemView && typeof itemView.edit === 'function' ) {
					itemView.edit();
				}
			}.bind( this ), 0 );
			return model;
		},
		create_object_from_media: function() {
			if ( ! PC.threeD || ! PC.threeD.openModelMediaFrame ) return;
			PC.threeD.openModelMediaFrame( {
				title: ( window.PC_lang && window.PC_lang.media_title_file ) ? window.PC_lang.media_title_file : 'Select 3D model',
				buttonText: ( window.PC_lang && window.PC_lang.media_select_button_file ) ? window.PC_lang.media_select_button_file : 'Use this model',
				onSelect: function( attachment ) {
					if ( ! attachment ) return;
					var url = attachment.gltf_url || attachment.url || '';
					var filename = attachment.gltf_filename || attachment.filename || '';
					this._add_object_and_focus( {
						object_type: 'gltf',
						name: sanitizeLabelFromFilename( filename, 'Object' ),
						gltf: {
							attachment_id: attachment.id,
							url: url,
						},
					} );
				}.bind( this )
			} );
		},
		create_light_type: function( lightType ) {
			var labels = {
				AmbientLight: 'Ambient',
				DirectionalLight: 'Directional',
				PointLight: 'Point',
				SpotLight: 'Spot',
				RectAreaLight: 'Rect Area',
				HemisphereLight: 'Hemisphere',
			};
			var type = lightType || 'PointLight';
			this._add_object_and_focus( {
				object_type: 'light',
				name: labels[ type ] || 'Light',
				light_type: type,
				light_color: '#ffffff',
				light_intensity: 1,
				light_position: { x: 0, y: 0, z: 0 },
				light_target: { x: 0, y: 0, z: 0 },
				light_target_object_id: '',
				light_angle: 0.785398,
				penumbra: 0,
				distance: 0,
				decay: 2,
				rect_width: 10,
				rect_height: 10,
				rect_rotation: { x: 0, y: 0, z: 0 },
				light_ground_color: '#443333',
				light_cookie: _.clone( EMPTY_FILE ),
			} );
		},
		create_environment_hdri: function() {
			if ( ! window.wp || ! window.wp.media ) return;
			var frame = window.wp.media( {
				title: 'Select HDR/EXR file',
				button: { text: 'Use this file' },
				multiple: false,
			} );
			frame.on( 'select', function() {
				var att = frame.state().get( 'selection' ).first();
				att = att ? att.toJSON() : null;
				if ( ! att ) return;
				var filename = att.gltf_filename || att.filename || '';
				this._add_object_and_focus( {
					object_type: 'environment',
					env_type: 'hdri',
					name: sanitizeLabelFromFilename( filename, 'HDRi' ),
					env_hdri_file: { attachment_id: att.id, url: att.url || '' },
				} );
			}.bind( this ) );
			frame.open();
		},
		create_environment_cubemap: function() {
			if ( ! window.wp || ! window.wp.media ) return;
			var frame = window.wp.media( {
				title: 'Select cubemap images',
				button: { text: 'Use selected files' },
				multiple: true,
				library: { type: 'image' },
			} );
			frame.on( 'select', function() {
				var files = frame.state().get( 'selection' );
				if ( ! files || ! files.length ) return;

				var mapped = {
					px: _.clone( EMPTY_FILE ),
					nx: _.clone( EMPTY_FILE ),
					py: _.clone( EMPTY_FILE ),
					ny: _.clone( EMPTY_FILE ),
					pz: _.clone( EMPTY_FILE ),
					nz: _.clone( EMPTY_FILE ),
				};
				var firstFilename = '';
				var order = [ 'px', 'nx', 'py', 'ny', 'pz', 'nz' ];
				files.each( function( m ) {
					var att = m.toJSON();
					var filename = ( att.gltf_filename || att.filename || '' );
					if ( ! firstFilename && filename ) firstFilename = filename;
					var faceKey = this._detect_cubemap_face( filename );
					var targetKey = null;
					if ( faceKey && mapped[ faceKey ] && ! mapped[ faceKey ].url ) {
						targetKey = faceKey;
					} else {
						for ( var i = 0; i < order.length; i++ ) {
							var key = order[ i ];
							if ( mapped[ key ] && ! mapped[ key ].url ) {
								targetKey = key;
								break;
							}
						}
					}
					if ( targetKey ) {
						mapped[ targetKey ] = {
							attachment_id: att.id,
							url: att.url || '',
						};
					}
				}.bind( this ) );

				this._add_object_and_focus( {
					object_type: 'environment',
					env_type: 'cubemap',
					name: sanitizeLabelFromFilename( firstFilename, 'Cubemap' ),
					env_cubemap_px: mapped.px,
					env_cubemap_nx: mapped.nx,
					env_cubemap_py: mapped.py,
					env_cubemap_ny: mapped.ny,
					env_cubemap_pz: mapped.pz,
					env_cubemap_nz: mapped.nz,
				} );
			}.bind( this ) );
			frame.open();
		},
		_detect_cubemap_face: function( filename ) {
			var name = ( filename || '' ).toLowerCase();
			if ( /(^|[_\-. ])(px|\+x|right)([_\-. ]|$)/.test( name ) ) return 'px';
			if ( /(^|[_\-. ])(nx|-x|left)([_\-. ]|$)/.test( name ) ) return 'nx';
			if ( /(^|[_\-. ])(py|\+y|top|up)([_\-. ]|$)/.test( name ) ) return 'py';
			if ( /(^|[_\-. ])(ny|-y|bottom|down)([_\-. ]|$)/.test( name ) ) return 'ny';
			if ( /(^|[_\-. ])(pz|\+z|front|forward)([_\-. ]|$)/.test( name ) ) return 'pz';
			if ( /(^|[_\-. ])(nz|-z|back|rear)([_\-. ]|$)/.test( name ) ) return 'nz';
			return null;
		},
	} );

	PC.views.object3d_item = PC.views.layer.extend({
		edit_view: function() { return PC.views.object3d_form; },
		className: function() {
			console.log(this.model.get('object_type'), 'mm');
			const objectType = this.model.get('object_type');
			// return 'layer mkl-list-item 3d-object';
			return 'layer mkl-list-item object3d' + ( objectType ? ' object3d--' + objectType : '' );
		},
	} );

	PC.views.object3d_form = PC.views.layer_form.extend({
		collectionName: 'objects3d',
		template: wp.template('mkl-pc-structure-object3d-form'),
		events: ( function() {
			var parent = PC.views.layer_form.prototype.events || {};
			return _.extend( {}, parent, {
				'remove': 'on_remove',
			} );
		} )(),
		
		initialize: function( options ) {
			if ( this.pre_init ) this.pre_init( options );
			this.toggled_status.init();
			this.collection = this.model.collection;
			this._lastLightType = undefined;
			this._lastLightTargetObjectId = undefined;
			this.listenTo( this.model, 'destroy', this.remove );
			this.listenTo( this.model, 'change:object_type', this._ensure_light_defaults );
			this.listenTo( this.model, 'change:object_type', this._ensure_environment_defaults );
			this.listenTo( this.model, 'change:object_type', this.render );
			this.listenTo( this.model, 'change:light_type', this._maybeRenderForLightDataVisibility );
			this.listenTo( this.model, 'change:env_type', this._maybeRenderForEnvironmentDataVisibility );
			// When a 3D model file is changed, optionally import lights from GLTF (handled via change event, not file field JS).
			this.listenTo( this.model, 'change:gltf', this._maybe_import_lights_from_gltf );
		},
		_lastEnvType: undefined,
		_maybeRenderForEnvironmentDataVisibility: function() {
			var type = this.model.get( 'env_type' );
			if ( this._lastEnvType !== type ) {
				this._lastEnvType = type;
				this.render();
			}
		},
		_maybe_import_lights_from_gltf: function() {
			var objType = this.model.get( 'object_type' );
			if ( objType !== 'gltf' ) return;
			var gltf = this.model.get( 'gltf' );
			var url = ( gltf && gltf.url ) ? gltf.url : '';
			if ( ! url || ! window.PC || ! window.PC.threeD || ! window.PC.threeD.store || typeof window.PC.threeD.store.get !== 'function' || ! window.PC.threeD.getLightsFromSceneForImport ) {
				return;
			}
			window.PC.threeD.store.get( url, function ( err, data ) {
				if ( err || ! data || ! data.gltf || ! data.gltf.scene ) return;
				var lights = window.PC.threeD.getLightsFromSceneForImport( data.gltf.scene );
				if ( ! lights.length ) return;
				var n = lights.length;
				var msg = ( typeof PC_lang !== 'undefined' && PC_lang.import_lights_from_gltf )
					? PC_lang.import_lights_from_gltf.replace( '%d', String( n ) )
					: 'This model contains ' + n + ' light(s). Import them as 3D Objects?';
				if ( ! window.confirm( msg ) ) return;
				var col = this.model && this.model.collection;
				if ( ! col || ! col.create_object ) return;
				lights.forEach( function ( light ) {
					var attrs = col.create_object( {
						object_type: 'light',
						name: light.name,
						light_position: light.position,
						light_type: light.type,
						light_color: light.color,
						light_intensity: light.intensity,
						light_target: light.target,
					} );
					col.add( attrs );
				} );
				if ( window.PC.app && window.PC.app.is_modified ) window.PC.app.is_modified.objects3d = true;
			}.bind( this ) );
		},
		_ensure_environment_defaults: function() {
			if ( this.model.get( 'object_type' ) === 'environment' && this.model.get( 'env_type' ) == null ) {
				this.model.set( 'env_type', 'hdri' );
			}
			if ( this.model.get( 'object_type' ) === 'environment' && ! this.model.get( 'env_hdri_file' ) ) {
				this.model.set( 'env_hdri_file', _.clone( EMPTY_FILE ) );
			}
			if ( this.model.get( 'object_type' ) === 'environment' ) {
				[ 'env_cubemap_px', 'env_cubemap_nx', 'env_cubemap_py', 'env_cubemap_ny', 'env_cubemap_pz', 'env_cubemap_nz' ].forEach( function( key ) {
					if ( ! this.model.get( key ) ) {
						this.model.set( key, _.clone( EMPTY_FILE ) );
					}
				}.bind( this ) );
			}
		},
		_maybeRenderForLightDataVisibility: function() {
			var type = this.model.get( 'light_type' );
			var targetId = this.model.get( 'light_target_object_id' );
			var typeChanged = this._lastLightType !== type;
			var targetIdChanged = this._lastLightTargetObjectId !== targetId;
			this._lastLightType = type;
			this._lastLightTargetObjectId = targetId;
			if ( typeChanged || targetIdChanged ) {
				this.render();
			}
		},
		_ensure_light_defaults: function() {
			if ( this.model.get( 'object_type' ) === 'light' && this.model.get( 'light_type' ) == null ) {
				this.model.set( 'light_type', 'PointLight' );
			}
		},
		render: function() {
			this._ensure_light_defaults();
			this._ensure_environment_defaults();
			this._lastLightType = this.model.get( 'light_type' );
			this._lastLightTargetObjectId = this.model.get( 'light_target_object_id' );
			var type = this.model.get( 'env_type' );
			this._lastEnvType = type;
			var ret = PC.views.layer_form.prototype.render.apply( this, arguments );
			if ( $.fn && $.fn.wpColorPicker ) {
				this.$( 'input.color-hex' ).each( function() {
					var $input = $( this );
					if ( $input.closest( '.wp-picker-container' ).length ) {
						return;
					}
					$input.wpColorPicker( {
						change: function( event, ui ) {
							var $currentInput = $( event.target );
							$currentInput.val( ui.color.toString() );
							$currentInput.trigger( 'input' );
						},
						clear: function() {
							var $currentInput = $( this ).closest( '.wp-picker-container' ).find( 'input[type="text"]' );
							$currentInput.val( '' );
							$currentInput.trigger( 'input' );
						}
					} );
				} );
			}
			return ret;
		},
		on_remove: function ( e ) {
			if ( $.fn && $.fn.wpColorPicker ) {
				this.$( '.wp-picker-container.wp-picker-active input.color-hex' ).wpColorPicker( 'close' );
			}
		},
		form_change: function( event ) {
			var input = $( event.currentTarget );
			var setting = input.data( 'setting' );
			if ( ! setting ) {
				return PC.views.layer_form.prototype.form_change.call( this, event );
			}
			// Euler/vector3: one setting path, three inputs with data-component; set whole object.
			var component = input.data( 'component' );
			if ( component && input.closest( '.mkl-pc-setting--euler' ).length ) {
				var $wrapper = input.closest( '.mkl-pc-setting--euler' );
				setting = $wrapper.attr( 'data-setting' );
				if ( setting ) {
					var x = parseFloat( $wrapper.find( '[data-component="x"]' ).val() ) || 0;
					var y = parseFloat( $wrapper.find( '[data-component="y"]' ).val() ) || 0;
					var z = parseFloat( $wrapper.find( '[data-component="z"]' ).val() ) || 0;
					this.model.set( setting, { x: x, y: y, z: z } );
				}
				return;
			}
			return PC.views.layer_form.prototype.form_change.call( this, event );
		},
		open_light_cookie_media: function() {
			this._selecting_light_cookie = true;
			var cookie = this.model.get( 'light_cookie' );
			var cookieId = ( cookie && cookie.attachment_id != null ) ? cookie.attachment_id : null;
			if ( typeof PC.media !== 'undefined' && PC.media.open ) {
				PC.media.open( { el: this.$el, selection: cookieId } );
			}
		},
		remove_light_cookie: function() {
			this.model.set( 'light_cookie', { attachment_id: null, url: '' } );
		},
	} );

}( jQuery, PC._us || window._ ) );
