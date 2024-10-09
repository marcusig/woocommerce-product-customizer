/*
	PC.fe.views.choices 
*/
PC.fe.views.choices = Backbone.View.extend({ 
	tagName: 'ul', 
	className: 'layer_choices', 
	template: wp.template( 'mkl-pc-configurator-choices' ),
	initialize: function( options ) { 
		this.options = options || {}; 
		return this.render();
	},
	events: {
		'click .choices-close': 'close_choices'
	},
	render: function() {
		this.$el.append( this.template( wp.hooks.applyFilters( 'PC.fe.configurator.layer_data', this.model.attributes ) ) ); 
		this.$el.addClass( this.model.get( 'type' ) );
		if ( this.model.get( 'class_name' ) ) this.$el.addClass( this.model.get( 'class_name' ) );
		if ( this.model.get( 'parent' ) ) this.$el.addClass( 'is-child-layer' );
		if ( 'compact-list' != this.model.get( 'display_mode' ) && this.model.get( 'columns' ) ) this.$el.addClass( 'columns-' + this.model.get( 'columns' ) );
		if ( this.model.get( 'color_swatch_size' ) ) this.$el.addClass( 'swatches-size--' + this.model.get( 'color_swatch_size' ) );

		this.$list = this.$el.find('.choices-list ul'); 
		this.add_all( this.options.content ); 
		
		if ( this.options.content && ( ! this.model.get( 'default_selection' ) || 'select_first' == this.model.get( 'default_selection' ) ) && !this.options.content.findWhere( { 'active': true } ) && this.options.content.findWhere( { available: true } ) ) {
			var av = this.options.content.findWhere( { available: true } );
			if ( av ) av.set( 'active', true );
		}
		return this.$el;
	},
	add_all: function( collection ) { 
		// this.$el.empty();
		if ( 'group' == this.model.get( 'type' ) ) return;
		collection.each( this.add_one, this );
	},
	add_one: function( model ) {
		if ( model.get( 'is_group' ) )  {
			var new_choice = new PC.fe.views.choiceGroup( { model: model, multiple: false } ); 
		} else {
			var new_choice = new PC.fe.views.choice( { model: model, multiple: false } ); 
		}

		if ( model.get( 'parent' ) && this.$( 'ul[data-item-id=' + model.get( 'parent' ) + ']' ).length ) {
			this.$( 'ul[data-item-id=' + model.get( 'parent' ) + ']' ).append( new_choice.render() ); 
		} else {
			this.$list.append( new_choice.render() ); 
		}

		/**
		 * 
		 */
		wp.hooks.doAction( 'PC.fe.choices.add_one.after', this, new_choice );
	},
	close_choices: function( event ) {
		event.preventDefault(); 
		this.model.set('active', false);
	}
});
