PC.fe.views.layers_list_item_selection = Backbone.View.extend({
	tagName: 'span',
	className: 'selected-choice',
	initialize: function() {
		this.choices = PC.fe.getLayerContent( this.model.id );
		if ( ! this.choices && 'group' !== this.model.get( 'type' ) ) return;
		this.listenTo( this.model, 'change:cshow', this.render );
		this.listenTo( this.choices, 'change:active change:cshow', this.render );
		if ( 'group' == this.model.get( 'type' ) && PC.fe.layers ) {
			this.children_layers = PC.fe.layers.where( { 'parent': this.model.id  } );
			if ( this.children_layers.length ) {
				_.each( this.children_layers, function( l ) {
					var c_choices = PC.fe.getLayerContent( l.id );
					this.listenTo( c_choices, 'change:active change:cshow', this.render );
					this.listenTo( l, 'change:cshow', this.render );
				}.bind( this ) );
			}
		}
		this.render();
	},
	render: function( changed_model ) {
		var choices_names = [];
		if ( this.choices ) {
			var active_choices = this.choices.where( { active: true } );
				_.each( active_choices, function( item ) {
				var name = item.get_name();
				if ( item.get( 'parent' ) && item.collection.get( item.get( 'parent' ) ) ) {
					var parent = item.collection.get( item.get( 'parent' ) );
					if ( parent.get( 'show_group_label_in_cart' ) ) {
						name = parent.get_name() + ' - ' + name;
					}
				}
				if ( this.should_display( item ) ) choices_names.push( wp.hooks.applyFilters( 'PC.fe.selected_choice.name', name, item ) );
			}.bind( this ) );
		}

		if ( this.children_layers && this.children_layers.length ) {
			_.each( this.children_layers, function( l ) {
				var c_choices = PC.fe.getLayerContent( l.id );
				if ( c_choices ) {
					var active_child_choices = c_choices.where( { active: true } );
					_.each( active_child_choices, function( item ) {
						var name = item.get_name();
						if ( item.get( 'parent' ) && item.collection.get( item.get( 'parent' ) ) ) {
							var parent = item.collection.get( item.get( 'parent' ) );
							if ( parent.get( 'show_group_label_in_cart' ) ) {
								name = parent.get_name() + ' - ' + name;
							}
						}
						if ( this.should_display( item ) ) {
							choices_names.push( 
								/**
								 * Filter PC.fe.selected_choice.name - Filters the selected choice name
								 * @param string name - The name
								 * @param object item - Choice model
								 * @return string
								 */
								wp.hooks.applyFilters( 'PC.fe.selected_choice.name', name, item ) 
							);
						}
					}.bind( this ) );
				}
			}.bind( this ) );
		}

		this.$el.html( choices_names.join( ', ' ) );
		wp.hooks.doAction( 'PC.fe.set.selected_choice', choices_names, this );
	},
	should_display: function( model ) {
		if ( PC.hasOwnProperty( 'conditionalLogic' ) && PC.conditionalLogic.item_is_hidden && PC.conditionalLogic.item_is_hidden( model ) ) return false;
		return true;
	}
} );

PC.fe.views.layers_list_item_selection_image = Backbone.View.extend({
	tagName: 'i',
	className: 'selected-choice-image',
	initialize: function( options ) {
		this.choices = PC.fe.getLayerContent( this.model.id );
		this.parent = options.parent;
		if ( ! this.choices ) return;
		this.listenTo( this.choices, 'change:active', this.render );
		this.has_thumbnail = this.parent.$el.is( '.has-thumbnail' );
		this.render();
	},
	render: function( choice_model, activated ) {
		var active_choices = this.choices.where( { active: true } );
		var html_content = '';
		_.each( active_choices, function( item ) {
			var image = item.get_image( 'thumbnail' );
			if ( image ) {
				html_content += '<img src="' + image + '">';
			}
		} );
		if ( ! this.has_thumbnail ) {
			this.parent.$el.toggleClass( 'has-thumbnail', !! html_content );
		}
		this.$el.html( html_content );
	}		
} );