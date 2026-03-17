var PC = PC || {};

( function( _ ) {
	PC.objects3d = Backbone.Collection.extend({
		url: function() {
			var url = ajaxurl + '?action=' + PC.actionParameter + '&data=objects3d';
			if ( this.product_id ) url += '&id=' + this.product_id;
			return url;
		},
		model: PC.Object3D,
		initialize: function( data, options ) {
			if ( options && options.product_id ) {
				this.product_id = options.product_id;
			}
		},
		nextOrder: function() {
			if ( ! this.length ) {
				return 1;
			}

			const orders = this.pluck( 'order' );
			const max = _.max( orders );
			if ( max ) return max + 1;
			return 1;
		},
		comparator: function( layer ) {
			return layer.get('order');
		},
		sync: function( method, model, options ) {},
		_normalize_file: function( file ) {
			return {
				attachment_id: ( file && file.attachment_id != null ) ? file.attachment_id : null,
				url: ( file && file.url ) ? file.url : '',
			};
		},
		_base_object_attrs: function( input, objectType ) {
			var _id = ( this.product_id && typeof PC.app.get_new_id === 'function' )
				? PC.app.get_new_id( this )
				: ( this.nextOrder() );
			return {
				_id: _id,
				name: input.name || '',
				object_type: objectType,
				order: input.order == null ? this.nextOrder() : input.order,
			};
		},
		_extract_custom_attrs: function( input ) {
			var reserved = {
				_id: true,
				name: true,
				object_type: true,
				order: true,
				loading_strategy: true,
				gltf: true,
				attachment_id: true,
				url: true,
				filename: true,
				light_type: true,
				light_position: true,
				light_color: true,
				light_intensity: true,
				cast_shadows: true,
				light_target_object_id: true,
				light_target: true,
				light_angle: true,
				penumbra: true,
				distance: true,
				decay: true,
				rect_width: true,
				rect_height: true,
				rect_rotation: true,
				light_ground_color: true,
				light_cookie: true,
				env_type: true,
				env_hdri_file: true,
				env_cubemap_px: true,
				env_cubemap_nx: true,
				env_cubemap_py: true,
				env_cubemap_ny: true,
				env_cubemap_pz: true,
				env_cubemap_nz: true,
				animation_target_model: true,
				animation_clips: true,
			};
			return Object.keys( input || {} ).reduce( function( out, key ) {
				if ( reserved[ key ] ) return out;
				out[ key ] = input[ key ];
				return out;
			}, {} );
		},
		_build_gltf_attrs: function( input ) {
			var gltfFile;
			if ( input.gltf ) {
				gltfFile = this._normalize_file( input.gltf );
			} else if ( input.attachment_id != null || input.url ) {
				gltfFile = this._normalize_file( { attachment_id: input.attachment_id, url: input.url } );
			} else {
				gltfFile = this._normalize_file();
			}
			return {
				loading_strategy: input.loading_strategy || 'eager',
				gltf: gltfFile,
			};
		},
		_build_light_attrs: function( input ) {
			return {
				light_type: input.light_type || 'PointLight',
				light_position: input.light_position || { x: 0, y: 0, z: 0 },
				light_color: input.light_color || '#ffffff',
				light_intensity: input.light_intensity != null ? input.light_intensity : 1,
				cast_shadows: input.cast_shadows === true,
				light_target_object_id: input.light_target_object_id || '',
				light_target: input.light_target || { x: 0, y: 0, z: 0 },
				light_angle: input.light_angle != null ? input.light_angle : 0.785398,
				penumbra: input.penumbra != null ? input.penumbra : 0,
				distance: input.distance != null ? input.distance : 0,
				decay: input.decay != null ? input.decay : 2,
				rect_width: input.rect_width != null ? input.rect_width : 10,
				rect_height: input.rect_height != null ? input.rect_height : 10,
				rect_rotation: input.rect_rotation || { x: 0, y: 0, z: 0 },
				light_ground_color: input.light_ground_color || '#443333',
				light_cookie: this._normalize_file( input.light_cookie ),
			};
		},
		_build_environment_attrs: function( input ) {
			var envType = input.env_type || 'hdri';
			var attrs = { env_type: envType };
			if ( envType === 'cubemap' ) {
				attrs.env_cubemap_px = this._normalize_file( input.env_cubemap_px );
				attrs.env_cubemap_nx = this._normalize_file( input.env_cubemap_nx );
				attrs.env_cubemap_py = this._normalize_file( input.env_cubemap_py );
				attrs.env_cubemap_ny = this._normalize_file( input.env_cubemap_ny );
				attrs.env_cubemap_pz = this._normalize_file( input.env_cubemap_pz );
				attrs.env_cubemap_nz = this._normalize_file( input.env_cubemap_nz );
			} else {
				attrs.env_hdri_file = this._normalize_file( input.env_hdri_file );
			}
			return attrs;
		},
		_build_animation_attrs: function( input ) {
			return {
				animation_target_model: input.animation_target_model || '',
				animation_clips: Array.isArray( input.animation_clips ) ? input.animation_clips : [],
			};
		},
		create_object: function( data ) {
			var input = _.extend( {}, data || {} );
			var objectType = input.object_type || 'gltf';
			var baseAttrs = this._base_object_attrs( input, objectType );
			var customAttrs = this._extract_custom_attrs( input );
			var typeAttrs;
			if ( objectType === 'light' ) {
				typeAttrs = this._build_light_attrs( input );
			} else if ( objectType === 'environment' ) {
				typeAttrs = this._build_environment_attrs( input );
			} else if ( objectType === 'animation' ) {
				typeAttrs = this._build_animation_attrs( input );
			} else {
				typeAttrs = this._build_gltf_attrs( input );
			}
			return _.extend( {}, baseAttrs, typeAttrs, customAttrs );
		},
	} );
}( PC._us || window._ ) );
