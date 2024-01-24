
/*
	PC.fe.views.toolbar 
*/
PC.fe.views.toolbar = Backbone.View.extend({
	tagName: 'div', 
	className: 'mkl_pc_toolbar', 
	template: wp.template( 'mkl-pc-configurator-toolbar' ),
	initialize: function( options ) {
		this.parent = options.parent || PC.fe;
		return this; 
	},

	events: {
		'click .cancel': 'close_configurator',
		// 'click .configurator-add-to-cart': 'add_to_cart'
	},

	render: function() {
		this.$el.append( this.template( { name:this.parent.options.title } ) );
		this.$selection = this.$el.find('.choices'); 
		// this.get_cart(); 
		this.layers = new PC.fe.views.layers_list( { parent: this } );
		return this.$el; 
	}, 

	close_configurator: function( event ) {
		this.parent.close(); 
	}
});
