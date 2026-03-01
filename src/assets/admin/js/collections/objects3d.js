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
			var _id = ( this.product_id && typeof PC.app.get_new_id === 'function' )
				? PC.app.get_new_id( this )
				: ( this.nextOrder() );
			return _.extend( data || {}, {
				_id: _id,
				name: ( data && data.name ) || '',
				attachment_id: ( data && data.attachment_id ) != null ? data.attachment_id : null,
				url: ( data && data.url ) || '',
				filename: ( data && data.filename ) || '',
				object_type: ( data && data.object_type ) || 'gltf',
				loading_strategy: ( data && data.loading_strategy ) || 'eager',
			} );
		},
	} );
}( PC._us || window._ ) );
