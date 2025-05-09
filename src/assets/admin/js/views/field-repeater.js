var PC = PC || {};
PC.views = PC.views || {};

(function( $, _ ){

	function initRepeaters( edit_view ) {
		var $targets = edit_view.$( '.field-repeater' );
		
		if ( ! $targets.length ) return;

		$targets.each( ( index, item ) => {
			const setting = $( item ).data( 'setting' );
			const fields = $( item ).data( 'fields' );
			const Repeater = new PC.views.field_repeater( { el: $( item ), setting, fields, model: edit_view.model } );
			Repeater.$el.appendTo( $( item ) );
		} );
	}

	// Render fields in layer
	wp.hooks.addAction( 'PC.admin.layer_form.render', 'MKL/PC/Field_Repeater', initRepeaters );
	// Render fields in choice
	wp.hooks.addAction( 'PC.admin.choiceDetails.render', 'MKL/PC/Field_Repeater', initRepeaters );

	PC.views.field_repeater = Backbone.View.extend( {
		template: wp.template('mkl-pc-setting--repeater'),
		events: {
			'click .add-option': 'add_option',
		},
		options_els: [],
		initialize: function( options ) {
			this.setting = options.setting;
			this.fields = options.fields;
			var options = this.model.get( this.setting );
			if ( 'object' != typeof options ) options = [];
			this.options = new Backbone.Collection( options, { comparator: 'order' } );
			this.render();
			this.listenTo( this.options, 'add', this.add_one );
			this.listenTo( this.options, 'change destroy', this.save_options );
		},
		get_default_option: function() {
			// Generate the defaults object
			const defaults = Object.keys( this.fields ).reduce( ( acc, slug ) => {
				const field = this.fields[slug];
				acc[slug] = typeof field.default !== 'undefined' ? field.default : '';
				return acc;
			  }, {});
			
			defaults.order = PC.app.get_new_order( this.options )
			return wp.hooks.applyFilters( 'PC.field.repeater.get_default_option', defaults );
		},
		render: function() {
			this.$el.append( this.template() );
			this.options.each( this.add_one.bind( this ) );
		},
		add_option: function() {
			this.options.add( this.get_default_option() );
		},
		add_one: function( model ) {
			var option = new PC.views.field_repeater_option( { fields: this.fields, model: model } );
			this.options_els.push( option );
			option.$el.appendTo( this.$( '.options-list' ) );
		},
		save_options: function() {
			this.options.each( function( model ) {
				if ( ! model.get( 'label' ) && ! model.get( 'value' ) ) this.options.remove( model );
			} );
			this.model.set( this.setting, PC.toJSON( this.options.sort() ) );
		},
	} );

	PC.views.field_repeater_option = Backbone.View.extend( {
		tagName: 'div',
		className: 'field-repeater--option',
		template: wp.template('mkl-pc-setting--repeater-option'),
		events: {
			'click .remove-option': 'remove_option',
			'change input': 'update_value',
			'click .order button': 'reorder_item',
		},
		initialize: function( options ) {
			this.fields = options.fields;
			this.listenTo( this.model.collection, 'manual-reorder', this.set_order );
			this.render();
		},
		render: function() {
			this.$el.append( this.template( { ...this.model.attributes, fields: this.fields } ) );
		},
		remove_option: function() {
			this.model.destroy();
			this.remove();
		},
		update_value: function( e ) {
			this.model.set( e.target.name, e.target.value );
		},
		reorder_item: function( e ) {
			var moved = false;
			if ( $( e.currentTarget ).is( '.up' ) ) {
				var prev = this.$el.prev();
				if ( prev.length ) {
					this.$el.insertBefore( prev );
					moved = true;
				}
			} else if ( $( e.currentTarget ).is( '.down' ) ) {
				var next = this.$el.next();
				if ( next.length ) {
					this.$el.insertAfter( next );
					moved = true;
				}
			} 
			if ( moved ) this.model.collection.trigger( 'manual-reorder' );
		},
		set_order: function() {
			this.model.set( 'order', this.$el.index() );
		}
	} );

})(jQuery, PC._us || window._);