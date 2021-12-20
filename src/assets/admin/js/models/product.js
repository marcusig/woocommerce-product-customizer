var PC = PC || {};

(function($){

	PC.product = Backbone.Model.extend({
		url: function() { 
			var action = PC.actionParameter,
				data = 'content';
			return ajaxurl + '?action='+action+'&data='+data+'&id='+this.id
		},

		idAttribute: 'product_id',
		defaults: {
			product_type:'simple', 
			modified: false, 
		}, 
		initialize: function( attributes ) {
			this.admin = PC.app.get_admin();
			this.layers = this.admin.layers;

			// this.listenTo( this.layers, 'destroy', this.removed_model);
		},
		removed_model: function( model ) {
			
		},
		parse: function( response ) {
			var content = new PC.content_list();
			if( ! response instanceof Object ) {
				return content;
			} else if( undefined == response.content || response.content == false || response.content == 'false' ) {
				return content;
			}

			// content.add( response.content ); 
			$.each( response.content, function(key, value) {
				if( value.choices && value.choices.length > 0 ) {
					value.choices = new PC.choices(value.choices, { layer: PC.app.admin.layers.get( value.layerId ) } );
					content.add( value );
				}
			});
			return { content: content };
		}
	});

})(jQuery);