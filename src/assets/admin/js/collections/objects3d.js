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
			if ( ! this.length ) return 1;
			return parseInt( this.last().get( '_id' ), 10 ) + 1;
		},
		comparator: function( a, b ) {
			return ( a.get( '_id' ) || 0 ) - ( b.get( '_id' ) || 0 );
		},
		sync: function( method, model, options ) {},
		create_object: function( data ) {
			var normalizeFile = function( file ) {
				return {
					attachment_id: ( file && file.attachment_id != null ) ? file.attachment_id : null,
					url: ( file && file.url ) ? file.url : '',
				};
			};
			var _id = ( this.product_id && typeof PC.app.get_new_id === 'function' )
				? PC.app.get_new_id( this )
				: ( this.nextOrder() );
			var attrs = _.extend( {}, data || {} );
			var objectType = attrs.object_type || 'gltf';
			attrs._id = _id;
			attrs.name = attrs.name || '';
			attrs.object_type = objectType;
			if ( attrs.order == null ) {
				attrs.order = this.nextOrder();
			}

			if ( objectType === 'gltf' ) {
				attrs.loading_strategy = attrs.loading_strategy || 'eager';
				if ( attrs.gltf ) {
					attrs.gltf = normalizeFile( attrs.gltf );
				} else if ( attrs.attachment_id != null || attrs.url ) {
					attrs.gltf = normalizeFile( { attachment_id: attrs.attachment_id, url: attrs.url } );
				} else {
					attrs.gltf = normalizeFile();
				}
				delete attrs.attachment_id;
				delete attrs.url;
				delete attrs.filename;
				delete attrs.light_type;
				delete attrs.light_position;
				delete attrs.light_color;
				delete attrs.light_intensity;
				delete attrs.light_target_object_id;
				delete attrs.light_target;
				delete attrs.light_angle;
				delete attrs.penumbra;
				delete attrs.distance;
				delete attrs.decay;
				delete attrs.rect_width;
				delete attrs.rect_height;
				delete attrs.rect_rotation;
				delete attrs.light_ground_color;
				delete attrs.light_cookie;
				delete attrs.env_type;
				delete attrs.env_hdri_file;
				delete attrs.env_cubemap_px;
				delete attrs.env_cubemap_nx;
				delete attrs.env_cubemap_py;
				delete attrs.env_cubemap_ny;
				delete attrs.env_cubemap_pz;
				delete attrs.env_cubemap_nz;
			} else if ( objectType === 'light' ) {
				attrs.light_type = attrs.light_type || 'PointLight';
				attrs.light_position = attrs.light_position || { x: 0, y: 0, z: 0 };
				attrs.light_color = attrs.light_color || '#ffffff';
				attrs.light_intensity = attrs.light_intensity != null ? attrs.light_intensity : 1;
				attrs.light_target_object_id = attrs.light_target_object_id || '';
				attrs.light_target = attrs.light_target || { x: 0, y: 0, z: 0 };
				attrs.light_angle = attrs.light_angle != null ? attrs.light_angle : 0.785398;
				attrs.penumbra = attrs.penumbra != null ? attrs.penumbra : 0;
				attrs.distance = attrs.distance != null ? attrs.distance : 0;
				attrs.decay = attrs.decay != null ? attrs.decay : 2;
				attrs.rect_width = attrs.rect_width != null ? attrs.rect_width : 10;
				attrs.rect_height = attrs.rect_height != null ? attrs.rect_height : 10;
				attrs.rect_rotation = attrs.rect_rotation || { x: 0, y: 0, z: 0 };
				attrs.light_ground_color = attrs.light_ground_color || '#443333';
				attrs.light_cookie = normalizeFile( attrs.light_cookie );
				delete attrs.loading_strategy;
				delete attrs.gltf;
				delete attrs.attachment_id;
				delete attrs.url;
				delete attrs.filename;
				delete attrs.env_type;
				delete attrs.env_hdri_file;
				delete attrs.env_cubemap_px;
				delete attrs.env_cubemap_nx;
				delete attrs.env_cubemap_py;
				delete attrs.env_cubemap_ny;
				delete attrs.env_cubemap_pz;
				delete attrs.env_cubemap_nz;
			} else if ( objectType === 'environment' ) {
				attrs.env_type = attrs.env_type || 'hdri';
				if ( attrs.env_type === 'cubemap' ) {
					attrs.env_cubemap_px = normalizeFile( attrs.env_cubemap_px );
					attrs.env_cubemap_nx = normalizeFile( attrs.env_cubemap_nx );
					attrs.env_cubemap_py = normalizeFile( attrs.env_cubemap_py );
					attrs.env_cubemap_ny = normalizeFile( attrs.env_cubemap_ny );
					attrs.env_cubemap_pz = normalizeFile( attrs.env_cubemap_pz );
					attrs.env_cubemap_nz = normalizeFile( attrs.env_cubemap_nz );
					delete attrs.env_hdri_file;
				} else {
					attrs.env_hdri_file = normalizeFile( attrs.env_hdri_file );
					delete attrs.env_cubemap_px;
					delete attrs.env_cubemap_nx;
					delete attrs.env_cubemap_py;
					delete attrs.env_cubemap_ny;
					delete attrs.env_cubemap_pz;
					delete attrs.env_cubemap_nz;
				}
				delete attrs.loading_strategy;
				delete attrs.gltf;
				delete attrs.attachment_id;
				delete attrs.url;
				delete attrs.filename;
				delete attrs.light_type;
				delete attrs.light_position;
				delete attrs.light_color;
				delete attrs.light_intensity;
				delete attrs.light_target_object_id;
				delete attrs.light_target;
				delete attrs.light_angle;
				delete attrs.penumbra;
				delete attrs.distance;
				delete attrs.decay;
				delete attrs.rect_width;
				delete attrs.rect_height;
				delete attrs.rect_rotation;
				delete attrs.light_ground_color;
				delete attrs.light_cookie;
			}

			return attrs;
		},
	} );
}( PC._us || window._ ) );
