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
    }

});

PC.content_list = Backbone.Collection.extend({
	model: PC.content, 
	initialize: function() {

	}
})

PC.choice_pictures = Backbone.Collection.extend({
	model: PC.choice_picture, 
}); 
