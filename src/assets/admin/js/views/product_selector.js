var PC = PC || {};
PC.views = PC.views || {};
PC.actions = PC.actions || {};

(function($){

	PC.actions.select_product = function( $el, context ) {
		var selector = new PC.views.product_selector( $el, context );
		selector.$el.appendTo( 'body' );
	}

	PC.views.product_selector = Backbone.View.extend({
		tagName: 'div', 
		className: 'mkl-pc-product-selector--container', 
		template: wp.template('mkl-pc-product-selector'),
		events: {
			'click .button.select': 'select',
			'click .button.cancel': 'close',
			'select2:select .wc-product-search': 'on_select_product',
		},
		initialize: function( t, c ) {
			this.originals = {
				'target': t, 
				'context': c
			};
			this.render();
			setTimeout(
				function() {
					$( document.body ).trigger( 'wc-enhanced-select-init' );
				},
				50
			);
			return this;
		},
		render: function() {
			this.$el.html( this.template( {} ) );
		},
		select: function( e ) {
			this.originals.target.trigger( 'product_selected', { text: this.selected_text, id: this.selected } );
			this.close();
		},
		close: function( e ) {
			this.remove();
		},
		on_select_product: function( e ) {
			var selected = e.params.data.id;
			if ( selected ) {
				this.selected_text = e.params.data.text;
				this.selected = selected;
				this.$el.find( '.button.select' ).prop( 'disabled', false );
			}
		}
	});
})(jQuery);