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
		this.set_a11y_attributes();
		this.add_all( this.options.content ); 
		
		if ( this.options.content && ( ! this.model.get( 'default_selection' ) || 'select_first' == this.model.get( 'default_selection' ) ) && !this.options.content.findWhere( { 'active': true } ) && this.options.content.findWhere( { available: true } ) ) {
			var av = this.options.content.findWhere( { available: true } );
			if ( av ) av.set( 'active', true );
		}

		this.update_roving_tabindex();
		return this.$el;
	},
	/**
	 * Roving tabindex for simple layers (radiogroup pattern).
	 * Ensures Tab enters the group once; arrow keys move between choices.
	 */
	update_roving_tabindex: function() {
		if ( ! this.$list || ! this.$list.length ) return;
		if ( 'simple' !== ( this.model.get( 'type' ) || 'simple' ) ) return;

		var $items = PC.fe.a11y.filter_focusable( this.$list.find( '.choice-item' ) );
		if ( ! $items.length ) return;

		// Make all items untabbable by default.
		$items.attr( 'tabindex', '-1' );

		// Prefer the checked one, otherwise the first available.
		var $checked = $items.filter( '[aria-checked="true"]' ).first();
		var $target = $checked.length ? $checked : $items.first();
		$target.attr( 'tabindex', '0' );
	},
	set_a11y_attributes: function() {
		if ( ! this.$list || ! this.$list.length ) return;
		var layer_name = this.model.get( 'name' ) || '';
		var layer_type = this.model.get( 'type' ) || 'simple';
		var list_id = 'mkl-pc-choice-list-' + this.model.id;
		this.$list.attr( 'id', list_id );

		if ( 'simple' === layer_type ) {
			this.$list.attr( {
				role: 'radiogroup',
				'aria-label': layer_name
			} );
		} else if ( 'multiple' === layer_type ) {
			this.$list.attr( {
				role: 'group',
				'aria-label': layer_name
			} );
		}
	},
	add_all: function( collection ) { 
		// this.$el.empty();
		if ( 'group' == this.model.get( 'type' ) ) return;
		collection.each( this.add_one, this );
	},
	add_one: function( model ) {
		// Possibility to avoid adding choice
		if ( !wp.hooks.applyFilters( 'PC.fe.choices.add_one', true, model ) ) return;

		if ( model.get( 'is_group' ) )  {
			var new_choice = new PC.fe.views.choiceGroup( { model: model, multiple: false, parent: this } ); 
		} else {
			var new_choice = new PC.fe.views.choice( { model: model, multiple: false, parent: this } ); 
		}

		if ( model.get( 'parent' ) && this.$( 'ul[data-item-id=' + model.get( 'parent' ) + ']' ).length ) {
			this.$( 'ul[data-item-id=' + model.get( 'parent' ) + ']' ).append( new_choice.render() ); 
		} else {
			this.$list.append( new_choice.render() ); 
		}

		/**
		 * Action hook: PC.fe.choices.add_one.after
		 * @param {PC.fe.views.choices} target_view
		 * @param {PC.fe.views.choice} new_choice
		 */
		wp.hooks.doAction( 'PC.fe.choices.add_one.after', this, new_choice );
	},
	close_choices: function( event ) {
		event.preventDefault(); 
		this.model.set('active', false);
		var $layerBtn = $( '#config-layer-' + this.model.id );
		if ( $layerBtn.length ) {
			PC.fe.a11y.focus_without_scroll( $layerBtn );
		}
	}
});
