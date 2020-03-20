var PC = PC || {};
// PC.model = PC.model || {};


PC.choices = Backbone.Collection.extend({
	// url: function() { return ajaxurl + '?action='+PC.actionParameter+'&data=choices' },
	model: PC.choice,
	initialize: function() {
	},
	nextOrder: function() {
		if ( !this.length ) {
			return 1;
		}
		return this.last().get('order') + 1;
	},
	comparator: function( choice ) {
	   	return choice.get('order'); 
    },
    deactivateAll: function() {
    	this.each(function( choice ) {
    		choice.set('active', false);
    	});
    },
	resetChoice: function() {
		this.deactivateAll();
		this.first().set( 'active', true );
	},
});

PC.content_list = Backbone.Collection.extend({
	model: PC.content, 
	initialize: function() {
	},
	resetConfig: function() {
		console.log(this);
		this.each( function( layer ) {
			if ( ! layer.get( 'not_a_choice' ) ) {
				layer.get( 'choices' ).resetChoice();
			}
		}.bind( this ) );
	},

})

PC.choice_pictures = Backbone.Collection.extend({
	model: PC.choice_picture, 
}); 
