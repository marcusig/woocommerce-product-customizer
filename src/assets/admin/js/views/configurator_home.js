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

	PC.views.conditional_placeholder = Backbone.View.extend({
		tagName: 'div',
		className: 'state conditional_placeholder',
		template: wp.template('mkl-pc-conditional-placeholder'), 
		events: {
			'click .hide-notice': 'hide_placeholder'
		},
		initialize: function() {
			this.render();
		},
		render: function() {
			this.$el.append( this.template() );
			return this.$el;
		},
		hide_placeholder: function( e ) {
			e.preventDefault();
			
			wp.ajax.post( {
				action: 'mkl_pc_hide_addon_setting',
				setting: 'conditional_placeholder',
				security: PC_lang.user_preferences_nonce
			} ).done( function( response ) {
				console.log( response );
			} );
		}
	});

})(jQuery);