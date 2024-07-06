PC.fe.views.summary = Backbone.View.extend( {
	tagName: 'div',
	className: 'mkl_pc_summary',
	template: wp.template( 'mkl-pc-configurator-summary' ),
	layers: [],
	initialize: function() {
		this.render();
		if ( PC.conditionalLogic ) {
			wp.hooks.addAction( 'mkl_checked_conditions', 'mkl/pc/summary', this.render.bind( this ), 1000 );
		} 
		wp.hooks.addAction( 'PC.fe.choice.set_choice', 'mkl/pc/summary', this.render.bind( this ), 1000 );
		wp.hooks.addAction( 'PC.fe.form.item.change', 'mkl/pc/summary', this.render.bind( this ), 1000 );
		return this; 
	},
	render: function() {
		this.clear();
		var choices = PC.fe.save_data.get_choices();
		_.each( choices, function( item ) {
			var layer = PC.fe.layers.get( item.layer_id );
			var choice = PC.fe.get_choice_model( item.layer_id, item.choice_id );
			if ( ! layer ) return;
			if ( 'simple' == layer.get( 'type' ) && layer.get( 'not_a_choice' ) ) return;
			if ( layer.get( 'hide_in_configurator') ) return;
			if ( layer.get( 'hide_in_summary') ) return;
			if ( ! this.layers[ item.layer_id ] ) {
				this.layers[ item.layer_id ] = new PC.fe.views.summary_item_group( { model: layer } );
				if ( layer.get( 'parent' ) && this.$( '[data-layer_id="' + layer.get( 'parent' ) + '"]' ).length ) {
					this.layers[ item.layer_id ].$el.appendTo( this.$( '[data-layer_id="' + layer.get( 'parent' ) + '"]' ) );
				} else {
					this.layers[ item.layer_id ].$el.appendTo( this.$el );
				}
			}

			// if ( ! choice ) console.log( item.layer_id, item.choice_id );
			if ( choice ) {
				if ( 'calculation' == choice.get( 'text_field_type' ) ) return;
				if ( 'form' == layer.get( 'type' ) && ( 'undefined' === typeof choice.get( 'field_value' ) || '' === choice.get( 'field_value' ) ) ) return;
				var view = new PC.fe.views.summary_item( { model: choice } );
				this.layers[ item.layer_id ].$el.append( view.$el );
			}

		}.bind( this ) );

		// Cleanup
		this.$( '.mkl_pc_summary_item_group.group' ).each( function( i, item ) {
			if ( ! $( item ).find( '.mkl_pc_summary_item_group' ).length ) {
				$( item ).remove()
			}
		} );

		return this.$el;
	},
	clear: function() {
		if ( this.layers.length ) {
			_.each( this.layers, function( item, key ) {
				if ( item ) item.remove();
			} );
			this.layers = [];
		}
		this.$el.empty();
	}
} );

PC.fe.views.summary_item_group = Backbone.View.extend( {
	tagName: 'div',
	className: 'mkl_pc_summary_item_group',
	template: wp.template( 'mkl-pc-configurator-summary--item-group' ), 
	initialize: function() {
		this.render();
		return this; 
	},
	render: function() {
		this.$el.html( this.template( wp.hooks.applyFilters( 'PC.fe.configurator.layer_data', this.model.attributes ) ) );
		this.$el.attr( 'data-layer_id', this.model.id );
		this.$el.addClass( this.model.get( 'type' ) );
		if ( this.model.get( 'class_name' ) ) this.$el.addClass( this.model.get( 'class_name' ) );
	}
} );

PC.fe.views.summary_item = Backbone.View.extend( {
	tagName: 'div',
	className: 'mkl_pc_summary_item',
	template: wp.template( 'mkl-pc-configurator-summary--item' ),
	initialize: function() {
		this.render();
		return this; 
	},
	render: function() {
		// Apply PC.fe.configurator.choice_data filter, used for language mostly, at order 2000
		var attributes = JSON.parse( JSON.stringify( wp.hooks.applyFilters( 'PC.fe.configurator.choice_data', this.model.attributes ) ) );
		if ( this.model.get( 'parent' ) ) {
			var parent = this.model.collection.get( this.model.get( 'parent' ) );
			if ( parent && parent.get( 'show_group_label_in_cart' ) ) attributes.parent_name = parent.get_name();
		}
		attributes = wp.hooks.applyFilters( 'PC.fe.summary_item.attributes', attributes, this.model );
		this.$el.html( this.template( attributes, this.model ) );
		if ( 'form' == this.model.collection.layer_type || this.model.get( 'has_text_field' ) ) {
			this.$el.addClass( 'has-form-field field-' + this.model.get( 'text_field_type' ) );
		}
		wp.hooks.doAction( 'PC.fe.configurator.summary-item.render.after-template', this );
	}
} );
