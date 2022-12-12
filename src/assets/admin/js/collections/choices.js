var PC = PC || {};
// PC.model = PC.model || {};


PC.choices = Backbone.Collection.extend({
	url: function() { 
		var base = PC_lang.rest_url + PC_lang.rest_base + PC.app.get_product().id + '/' + this.layer.id + '/choices';
		base += '?_wpnonce=' + PC_lang.rest_nonce;
		return base;
	},
	// url: function() { return ajaxurl + '?action='+PC.actionParameter+'&data=choices' },
	model: PC.choice,
	initialize: function( models, options ) {
		this.layer = options.layer;
		if ( ! this.layer ) return;
		this.layer_type = this.layer.get( 'type' );
		// if ( ! models || ! models.length ) {
		// 	console.log( 'should fetch data' );
		// 	this.fetch();
		// }
		return this;
	},
	nextOrder: function() {
		if ( ! this.length ) {
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
		if ( ! this.layer_type || 'simple' === this.layer_type ) {
			if ( ! this.layer.get( 'default_selection' ) || 'select_first' == this.layer.get( 'default_selection' ) ) {
				var default_selection = this.findWhere( { is_default: true } );
				if ( default_selection ) {
					default_selection.set( 'active', true );
					var item = default_selection;
				} else {
					var first_available_choice = this.findWhere( { available: true } );
					if ( first_available_choice ) first_available_choice.set( 'active', true );
					var item = first_available_choice;
				}

				// If the item is hidden using conditional logic, select the next available item
				if ( item && false === item.get( 'cshow' ) ) {
					
				}
			}
		} else if ( 'multiple' === this.layer_type ) {
			var default_selection = this.where( { is_default: true, available: true } );
			PC._us.each( default_selection, function( item ) {
				item.set( 'active', true );
			} );
		}
	},
	selectChoice: function ( choice_id, activate ) {
		var choice = this.get( choice_id );
		var is_active = choice.get('active');
		// Simple layers
		if ( 'simple' === this.layer_type || ! this.layer_type ) {
			// The choice can be deselected if a choice is required
			if ( is_active && ! activate && wp.hooks.applyFilters( 'PC.choices.canDeselectSimpleChoice', this.layer.get( 'can_deselect' ), this ) ) {
				choice.set( 'active', false );
			} else {
				// Already active, do nothing
				if ( is_active ) return;
				// Deactivate every other choice
				this.deactivateAll();
				// Set this choice to active
				choice.set( 'active', true );
			}
		} else if ( 'multiple' === this.layer_type ) {
			// Multiple choice: toggle the current state
			if ( ! is_active && ( activate || 'undefined' == typeof activate ) ) {
				if ( wp.hooks.applyFilters( 'PC.choices.canSelectChoice', true, choice, this ) ) {
					choice.set( 'active', true );
				} else {
					console.log('Collections > choices > selectChoice - The choice (multiple) can not be selected');
					return;
				}
			} else {
				if ( ! activate ) choice.set( 'active', false );
			}


		}
		wp.hooks.doAction( 'PC.fe.choice.change', choice );
	},
	getType: function() {
		return this.layer_type;
	},
	sync: PC.sync,
});

PC.content_list = Backbone.Collection.extend({
	model: PC.content, 
	initialize: function() {
	},
	resetConfig: function() {
		this.each( function( layer ) {
			var layer_model = PC.fe.layers.get( layer.get( 'layerId' ) );
			if ( ! layer_model.get( 'not_a_choice' ) ) {
				layer.get( 'choices' ).resetChoice();
			}
		}.bind( this ) );
	},
})

PC.choice_pictures = Backbone.Collection.extend({
	model: PC.choice_picture, 
}); 
