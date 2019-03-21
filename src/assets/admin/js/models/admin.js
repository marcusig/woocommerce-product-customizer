PC.admin = Backbone.Model.extend({ 
	url: function( action, data ) { 
		if ( !action ) action = PC.actionParameter;
		if ( !data ) data = 'init';
		return ajaxurl + '?action='+action+'&data='+data+'&id='+this.id
	},

	defaults: {
		layers: false, 
		angles: false, 
		nonces: false, 
	},
	initialize: function() {

		return this;
	},

});