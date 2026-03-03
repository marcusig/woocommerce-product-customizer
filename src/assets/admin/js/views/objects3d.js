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
			this.listenTo( this.model, 'change:light_data', this._maybeRenderForLightDataVisibility );
			this.listenTo( this.model, 'change:environment_data', this._maybeRenderForEnvironmentDataVisibility );
			// When a 3D model file is changed, optionally import lights from GLTF (handled via change event, not file field JS).
			this.listenTo( this.model, 'change:attachment_id', this._maybe_import_lights_from_gltf );
		},
		_lastEnvType: undefined,
		_maybeRenderForEnvironmentDataVisibility: function() {
			var ed = this.model.get( 'environment_data' );
			var envType = ed && ed.env_type;
			if ( this._lastEnvType !== envType ) {
				this._lastEnvType = envType;
				this.render();
			}
		},
		_maybe_import_lights_from_gltf: function() {
			var objType = this.model.get( 'object_type' );
			if ( objType !== 'gltf' ) return;
			var url = this.model.get( 'url' );
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
						light_data: {
							type: light.type,
							color: light.color,
							intensity: light.intensity,
							position: light.position,
							target: light.target,
						},
					} );
					col.add( attrs );
				} );
				if ( window.PC.app && window.PC.app.is_modified ) window.PC.app.is_modified.objects3d = true;
			}.bind( this ) );
		},
		_ensure_environment_data_default: function() {
			if ( this.model.get( 'object_type' ) === 'environment' && this.model.get( 'environment_data' ) == null ) {
				this.model.set( 'environment_data', {
					env_type: 'hdri',
					url: {},
					faces: { px: {}, nx: {}, py: {}, ny: {}, pz: {}, nz: {} }
				} );
			}
		},
		_maybeRenderForLightDataVisibility: function() {
			var ld = this.model.get( 'light_data' );
			var type = ld && ld.type;
			var targetId = ld && ld.target_object_id;
			var typeChanged = this._lastLightType !== type;
			var targetIdChanged = this._lastLightTargetObjectId !== targetId;
			this._lastLightType = type;
			this._lastLightTargetObjectId = targetId;
			if ( typeChanged || targetIdChanged ) {
				this.render();
			}
		},
		_ensure_light_data_default: function() {
			if ( this.model.get( 'object_type' ) === 'light' && this.model.get( 'light_data' ) == null ) {
				this.model.set( 'light_data', { type: 'PointLight', intensity: 1 } );
			}
		},
		render: function() {
			this._ensure_light_data_default();
			this._ensure_environment_data_default();
			var ld = this.model.get( 'light_data' );
			this._lastLightType = ld && ld.type;
			this._lastLightTargetObjectId = ld && ld.target_object_id;
			var ed = this.model.get( 'environment_data' );
			this._lastEnvType = ed && ed.env_type;
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
			if ( setting.indexOf( 'environment_data.' ) === 0 ) {
				this.current_focus = setting;
				var raw = input.val != null ? input.val() : ( input.prop && input.prop( 'checked' ) );
				if ( event.currentTarget.type === 'checkbox' ) {
					if ( event.type === 'click' ) raw = input.prop( 'checked' );
					else return;
				}
				var path = setting.split( '.' ).slice( 1 );
				var envData = this.model.get( 'environment_data' );
				envData = envData ? _.extend( {}, envData ) : { env_type: 'hdri', url: {}, faces: {} };
				if ( ! envData.faces ) envData.faces = {};
				this._setByPath( envData, path, raw );
				this.model.set( 'environment_data', envData );
				return;
			}
			if ( setting.indexOf( 'light_data.' ) !== 0 ) {
				return PC.views.layer_form.prototype.form_change.call( this, event );
			}
			this.current_focus = setting;
			var raw = input.val != null ? input.val() : ( input.prop && input.prop( 'checked' ) );
			if ( event.currentTarget.type === 'checkbox' ) {
				if ( event.type === 'click' ) raw = input.prop( 'checked' );
				else return;
			}
			var path = setting.split( '.' ).slice( 1 );
			var numKeys = [ 'position.x', 'position.y', 'position.z', 'target.x', 'target.y', 'target.z', 'intensity', 'angle', 'penumbra', 'distance', 'decay', 'width', 'height' ];
			var pathStr = path.join( '.' );
			if ( numKeys.indexOf( pathStr ) !== -1 && raw !== '' && ! isNaN( parseFloat( raw ) ) ) {
				raw = parseFloat( raw );
			}
			var lightData = this.model.get( 'light_data' );
			lightData = lightData ? _.extend( {}, lightData ) : {};
			this._setByPath( lightData, path, raw );
			this.model.set( 'light_data', lightData );
		},
		_setByPath: function( obj, path, value ) {
			for ( var i = 0; i < path.length - 1; i++ ) {
				var key = path[i];
				if ( ! ( key in obj ) || typeof obj[key] !== 'object' || obj[key] === null ) {
					obj[key] = {};
				}
				obj = obj[key];
			}
			obj[ path[ path.length - 1 ] ] = value;
		},
		open_light_cookie_media: function() {
			this._selecting_light_cookie = true;
			var ld = this.model.get( 'light_data' );
			var cookieId = ( ld && ld.cookie && ld.cookie.id ) ? ld.cookie.id : null;
			if ( typeof PC.media !== 'undefined' && PC.media.open ) {
				PC.media.open( { el: this.$el, selection: cookieId } );
			}
		},
		remove_light_cookie: function() {
			var lightData = this.model.get( 'light_data' );
			if ( ! lightData ) return;
			lightData = _.extend( {}, lightData );
			delete lightData.cookie;
			this.model.set( 'light_data', lightData );
		},
	} );

}( jQuery, PC._us || window._ ) );
