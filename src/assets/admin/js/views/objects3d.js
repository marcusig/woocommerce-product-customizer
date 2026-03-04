/**
 * 3D Objects state view: list and form for managing the 3d_objects collection.
 */
var PC = PC || {};
PC.views = PC.views || {};

( function( $, _ ) {

	PC.views.objects3d = PC.views.layers.extend({
		collectionName: 'objects3d',
		single_view: function() { return PC.views.object3d_item; },
		new_attributes: function( name ) {
			return {
				_id: PC.app.get_new_id( this.col ),
				name: name,
				order: this.col.nextOrder(),
				active: true,
			};
		},
	} );

	PC.views.object3d_item = PC.views.layer.extend({
		edit_view: function() { return PC.views.object3d_form; },
	} );

	PC.views.object3d_form = PC.views.layer_form.extend({
		collectionName: 'objects3d',
		template: wp.template('mkl-pc-structure-object3d-form'),
		events: ( function() {
			var parent = PC.views.layer_form.prototype.events || {};
			return _.extend( {}, parent, {
				'change .object3d-label': 'change_label',
				'change .object3d-type': 'change_type',
				'change .object3d-loading': 'change_loading',
				'click .object3d-upload': 'open_upload',
				'click .object3d-clear-file': 'clear_file',
				'focus input.color-hex': 'toggle_iris',
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
			this.listenTo( this.model, 'change:object_type', this._ensure_light_data_default );
			this.listenTo( this.model, 'change:object_type', this._ensure_environment_data_default );
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
		_ensure_environment_data_default: function() {
			if ( this.model.get( 'object_type' ) === 'environment' && this.model.get( 'env_type' ) == null ) {
				var emptyFile = { attachment_id: null, url: '' };
				this.model.set( 'env_type', 'hdri' );
				// this.model.set( 'env_hdri_file', _.clone( emptyFile ) );
				// this.model.set( 'env_cubemap_px', _.clone( emptyFile ) );
				// this.model.set( 'env_cubemap_nx', _.clone( emptyFile ) );
				// this.model.set( 'env_cubemap_py', _.clone( emptyFile ) );
				// this.model.set( 'env_cubemap_ny', _.clone( emptyFile ) );
				// this.model.set( 'env_cubemap_pz', _.clone( emptyFile ) );
				// this.model.set( 'env_cubemap_nz', _.clone( emptyFile ) );
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
		_ensure_light_data_default: function() {
			if ( this.model.get( 'object_type' ) === 'light' && this.model.get( 'light_type' ) == null ) {
				this.model.set( 'light_type', 'PointLight' );
			}
		},
		render: function() {
			this._ensure_light_data_default();
			this._ensure_environment_data_default();
			this._lastLightType = this.model.get( 'light_type' );
			this._lastLightTargetObjectId = this.model.get( 'light_target_object_id' );
			var type = this.model.get( 'env_type' );
			this._lastEnvType = type;
			this.$( 'input.color-hex' ).wpColorPicker( {
				change: function( event, ui ) {
					// Update value manually (optional, just in case)
					const $input = $( event.target );
					$input.val( ui.color.toString() );

					// Trigger native input event
					$input.trigger( 'input' );
				},
				clear: function( a, b ) {
					const $input = $( this ).closest( '.wp-picker-container' ).find( 'input[type="text"]' );

					$input.val( '' );         // Clear value explicitly (just in case)
					$input.trigger( 'input' ); // Trigger input event
				}
			});
			var ret = PC.views.layer_form.prototype.render.apply( this, arguments );
			return ret;
		},
		on_remove: function ( e ) {
			this.$( '.wp-picker-container.wp-picker-active input.color-hex' ).wpColorPicker( 'close' );
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
