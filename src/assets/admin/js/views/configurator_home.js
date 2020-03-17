var PC = PC || {};
PC.views = PC.views || {};

(function($){

	PC.views.home = Backbone.View.extend({
		tagName: 'div',
		className: 'state home',
		template: wp.template('mkl-pc-home'), 

		initialize: function() {
			this.render();
		},
		render: function() {
			this.$el.append( this.template() );
			return this.$el;
		},
	});

})(jQuery);