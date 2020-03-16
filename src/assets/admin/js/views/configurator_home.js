var PC = PC || {};
PC.views = PC.views || {};

(function($){

	PC.views.home = Backbone.View.extend({
		tagName: 'div',
		className: 'state home',
		template: wp.template('mkl-pc-home'), 

		initialize: function() {
			console.log('View home');
			this.render();
			console.log( this.$el );

		},
		render: function() {
			console.log('rendering home');
			this.$el.append( this.template() );
			return this.$el;
		},
	});

})(jQuery);