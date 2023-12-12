/*
	PC.fe.views.layers 
*/
PC.fe.views.layers_list = Backbone.View.extend({
	// template: wp.template( 'mkl-pc-configurator-viewer' ),
	tagName: 'ul',
	className: 'layers',
	initialize: function( options ) {
		this.options = options || {}; 
		this.render();
		this.listenTo( PC.fe.layers, 'change active', this.activate );
	},
	events: {
	}, 
	render: function() {
		this.options.parent.$selection.append( this.$el );
		this.add_all( PC.fe.layers );
		return this.$el;
	},
	add_all: function( collection ) { 
		this.$el.empty();
		this.items = [];
		collection.orderBy = 'order';
		collection.sort();
		if ( PC_config.config.use_steps ) PC.fe.steps.setup_steps();
		collection.each( this.add_one, this );
		wp.hooks.doAction( 'PC.fe.layers_list.layers.added', this );
	},
	add_one: function( model ) {
		var new_layer;

		if ( 'summary' == model.get( 'type' ) ) {
			new_layer = new PC.fe.views.summary( { model: model, parent: this.$el } ); 
		} else if ( ! model.attributes.not_a_choice ) {
			var choices = PC.fe.getLayerContent( model.id ); 
			if ( choices.length || 'group' == model.get( 'type' ) ) {
				new_layer = new PC.fe.views.layers_list_item( { model: model, parent: this.$el } ); 
			}
		} else {
			if ( model.get( 'custom_html' ) ) {
				new_layer = new PC.fe.views.layers_list_item( { model: model, parent: this.$el } );
			}
		}

		if ( ! new_layer ) return;

		var parent_id = model.get( 'parent' );
		var parent = parent_id ? model.collection.get( model.get( 'parent' ) ) : false;
		if ( parent && 'group' == parent.get( 'type' ) && this.options.parent.$( 'ul[data-layer-id=' + model.get( 'parent' ) + ']' ).length ) {
			this.options.parent.$( 'ul[data-layer-id=' + model.get( 'parent' ) + ']' ).append( new_layer.render() ); 
		} else {
			this.$el.append( new_layer.render() );
		}

		// add to a new collection to be used to render the viewer
		this.items.push( new_layer );
	},
	activate: function( model ) {
		if ( model.get( 'active' ) == false ) {
			if ( model.collection.findWhere( { 'active': true } ) ) {
				this.$el.addClass( 'opened' );
				wp.hooks.doAction( 'PC.fe.layers_list.open', this, model );
			} else {
				this.$el.removeClass( 'opened' );
				wp.hooks.doAction( 'PC.fe.layers_list.close', this, model );
			}
		} else {
			this.$el.addClass( 'opened' );
			wp.hooks.doAction( 'PC.fe.layers_list.open', this, model );
		}
	},

});