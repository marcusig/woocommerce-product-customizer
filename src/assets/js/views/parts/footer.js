/*
	PC.fe.views.footer 
*/
PC.fe.views.footer = Backbone.View.extend({
	tagName: 'footer', 
	className: 'mkl_pc_footer', 
	template: wp.template( 'mkl-pc-configurator-footer' ),
	initialize: function( options ) {
		this.parent = options.parent || PC.fe;
		return this; 
	},

	events: {
		'click .reset-configuration': 'reset_configurator',
	},

	render: function() {
		this.$el.append( this.template( {
			name: PC.fe.currentProductData.product_info.title,
			show_form: parseInt( PC.fe.config.show_form ) || ! $( 'form.cart' ).length || PC.fe.currentProductData.product_info.force_form,
			is_in_stock: parseInt( PC.fe.currentProductData.product_info.is_in_stock ),
			product_id: parseInt( PC.fe.active_product ),
			show_qty: parseInt( PC.fe.currentProductData.product_info.show_qty ),
			formated_price: this.get_price(),
			formated_regular_price: ( PC.fe.currentProductData.product_info.is_on_sale && PC.fe.currentProductData.product_info.regular_price ) ? PC.utils.formatMoney( parseFloat( PC.fe.currentProductData.product_info.regular_price ) ) : false,
		} ) );
		this.form = new PC.fe.views.form( { el: this.$( '.form' ) } );
		return this.$el; 
	},

	reset_configurator: function( event ) {
		PC.fe.modal.resetConfig();
		PC.fe.save_data.reset_errors();
	},

	get_price: function() {
		if ( ! PC.fe.currentProductData.product_info.price ) return false;
		return PC.utils.formatMoney( parseFloat( PC.fe.currentProductData.product_info.price ) );
	}
});
