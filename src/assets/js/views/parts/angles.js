PC.fe.views.angles = Backbone.View.extend({ 
	tagName: 'div', 
	className: 'angles-select',
	template: wp.template( 'mkl-pc-configurator-angles-list' ), 
	initialize: function( options ) { 
		// this.parent = options.parent || PC.fe; 
		this.col = PC.fe.angles; 
		return this; 
	},
	events: {
		'click .change-angle--trigger': 'on_selector_click'
	},
	render: function() { 
		this.$el.append( this.template() );
		this.$list = this.$el.find( 'ul' );
		// a11y - angles are not relevant for voice over 
		this.$el.attr( 'aria-hidden', 'true' );
		this.add_all(); 
		return this.$el; 
	},
	add_all: function() {
		this.col.each( this.add_one, this ); 
		this.col.first().set( 'active', true ); 
	},
	add_one: function( model ) {
		var new_angle = new PC.fe.views.angle( { model: model } ); 
		this.$list.append( new_angle.$el ); 
	},
	on_selector_click: function(e) {
		e.preventDefault();
	}
});

PC.fe.views.angle = Backbone.View.extend({
	tagName: 'li',
	className: 'angle',
	template: wp.template( 'mkl-pc-configurator-angle-item' ), 
	initialize: function( options ) {
		// this.parent = options.parent || PC.fe; 
		this.options = options || {};
		this.render(); 
		this.listenTo( this.model, 'change active', this.activate ); 
		wp.hooks.doAction( 'PC.fe.angle_view.init', this );
		return this;
	},

	events: {
		'click a': 'change_angle'
	},
	render: function() {
		if ( this.model.get( 'class_name' ) ) {
			this.$el.addClass( this.model.get( 'class_name' ) );
		}
		this.$el.append( this.template( wp.hooks.applyFilters( 'PC.fe.configurator.angle_data', this.model.attributes ) ) ); 
		return this.$el; 
	},
	change_angle: function( e ) {
		e.preventDefault();
		this.model.collection.each(function(model) {
			model.set('active' , false); 
		});
		this.model.set('active', true); 
	},
	activate: function() {
		if ( this.model.get( 'active' ) ) {			
			this.$el.addClass( 'active' );
			this.$( 'a' ).attr( 'aria-pressed', 'true' );
		} else {
			this.$( 'a' ).attr( 'aria-pressed', 'false' );
			this.$el.removeClass('active');
		}

		if ( this.model.get( 'class_name' ) ) {
			PC.fe.modal.$el.toggleClass( this.model.get( 'class_name' ), this.model.get( 'active' ) );
		}
	}

});