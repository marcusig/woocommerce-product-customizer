/*
	PC.fe.views.layers 
*/
PC.fe.views.layers_list = Backbone.View.extend({
	// template: wp.template( 'mkl-pc-configurator-viewer' ),
	tagName: 'ul',
	className: 'layers',
	initialize: function( options ) {
		this.options = options || {}; 
		this.items = [];
		// Layer id -> rendered view, and layer id -> position in the sorted
		// collection. See insert() for why the position has to be remembered.
		this.views = {};
		this.order_index = {};
		this.has_deferred_layers = false;
		this.render();
		this.listenTo( PC.fe.layers, 'change active', this.activate );
		// A layer whose render was skipped has to be built the first time
		// conditional logic reveals it.
		this.listenTo( PC.fe.layers, 'change:cshow', this.build_revealed_layers );
	},
	events: {
	}, 
	render: function() {
		this.options.parent.$selection.append( this.$el );
		if ( PC_config.lang.layers_aria_label ) {
			this.$el.attr( 'aria-label', PC_config.lang.layers_aria_label );
		}
		this.add_all( PC.fe.layers );
		return this.$el;
	},

	/**
	 * Whether layers that conditional logic hides should be left unrendered until
	 * they are first shown.
	 *
	 * On large configurations most layers are hidden when the configurator opens,
	 * so building their markup only to hide it immediately afterwards is the
	 * single biggest cost of opening. This is only correct because the first
	 * conditions run happens before any view is built - see
	 * PC.fe.prepare_initial_state().
	 *
	 * Off unless something turns it on: the conditional logic add-on sets
	 * `defer_hidden_layers` from its own setting, which is on for new stores and
	 * off for existing ones - a store may have styling that counts on every layer
	 * being in the page (sibling combinators, :nth-child), or a customisation that
	 * expects 'PC.fe.layers_list_item.init' to fire for every layer as the
	 * configurator opens.
	 *
	 * Force it either way with:
	 *   wp.hooks.addFilter( 'PC.fe.defer_hidden_layers', 'my-theme', function() { return true; } );
	 *
	 * @return {Boolean}
	 */
	defer_hidden_layers: function() {
		var enabled = !! PC_config.config.defer_hidden_layers;
		return !! wp.hooks.applyFilters( 'PC.fe.defer_hidden_layers', enabled, this );
	},

	/**
	 * Whether conditional logic currently hides this layer, on its own account or
	 * through an ancestor. Read from the models, so the answer does not depend on
	 * markup that may not exist yet.
	 *
	 * @param {Backbone.Model} model
	 * @return {Boolean}
	 */
	is_hidden_by_conditions: function( model ) {
		if ( false === model.get( 'cshow' ) ) return true;
		if ( PC.conditionalLogic && PC.conditionalLogic.parent_is_hidden ) {
			return !! PC.conditionalLogic.parent_is_hidden( model );
		}
		return false;
	},

	add_all: function( collection ) { 
		this.$el.empty();
		this.items = [];
		this.views = {};
		this.order_index = {};
		this.has_deferred_layers = false;
		collection.orderBy = 'order';
		collection.sort();
		if ( PC_config.config.use_steps ) PC.fe.steps.setup_steps();

		// Remember where each layer sits in the sorted collection. Other views
		// re-sort the same collection (the viewer orders it by image_order), so a
		// layer built later cannot ask the collection where it belongs: it asks
		// this instead.
		collection.each( function( model, index ) {
			this.order_index[ model.id ] = index;
		}, this );

		var defer = this.defer_hidden_layers();
		collection.each( function( model ) {
			if ( defer && this.is_hidden_by_conditions( model ) ) {
				this.has_deferred_layers = true;
				return;
			}
			this.add_one( model );
		}, this );

		wp.hooks.doAction( 'PC.fe.layers_list.layers.added', this );
	},

	/**
	 * Build the layers that were skipped and are now visible.
	 *
	 * Revealing a group also reveals its children, whose own `cshow` never
	 * changed, so this walks every layer rather than reacting to the one model
	 * that changed. Layers are walked in list order so a group is always built
	 * before the children that go inside it.
	 */
	build_revealed_layers: function() {
		if ( ! this.has_deferred_layers ) return;

		var that = this;
		var pending = _.sortBy( PC.fe.layers.filter( function( model ) {
			return ! that.views[ model.id ];
		} ), function( model ) {
			var index = that.order_index[ model.id ];
			return ( 'undefined' === typeof index ) ? Number.MAX_VALUE : index;
		} );

		var built = [];
		var still_deferred = false;

		_.each( pending, function( model ) {
			if ( that.is_hidden_by_conditions( model ) ) {
				still_deferred = true;
				return;
			}
			var view = that.add_one( model );
			if ( view ) built.push( view );
		} );

		this.has_deferred_layers = still_deferred;

		if ( built.length ) {
			/**
			 * Layers that were not rendered when the configurator opened have just
			 * been added to the list.
			 *
			 * @param {PC.fe.views.layers_list} list
			 * @param {Array} views The layer views that were just built.
			 */
			wp.hooks.doAction( 'PC.fe.layers_list.layers.added.deferred', this, built );
		}
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

		if ( ! new_layer ) return false;

		this.insert( model, new_layer );

		// add to a new collection to be used to render the viewer
		this.items.push( new_layer );
		this.views[ model.id ] = new_layer;

		return new_layer;
	},

	/**
	 * The list a layer's item belongs in: the nested list of its group parent when
	 * it has one, the main list otherwise.
	 *
	 * @param {Backbone.Model} model
	 * @return {jQuery}
	 */
	get_container: function( model ) {
		var parent_id = model.get( 'parent' );
		var parent = parent_id ? model.collection.get( parent_id ) : false;
		if ( parent && 'group' == parent.get( 'type' ) ) {
			var $group_list = this.options.parent.$( 'ul[data-layer-id=' + parent_id + ']' );
			if ( $group_list.length ) return $group_list;
		}
		return this.$el;
	},

	/**
	 * Put a layer where it belongs in the list rather than at the end.
	 *
	 * add_all() walks the collection in order, so appending would be enough for
	 * the opening pass - but a deferred layer is built whenever conditional logic
	 * reveals it, long after the layers around it. Its place comes from the order
	 * recorded in add_all(), resolved against the siblings that are actually
	 * present: the item goes before the first sibling that comes after it, and at
	 * the end when there is none.
	 *
	 * @param {Backbone.Model} model
	 * @param {Backbone.View} view
	 */
	insert: function( model, view ) {
		var $container = this.get_container( model );

		view.render();
		// Every item carries its layer id, whatever view rendered it, so the next
		// one can find its place among them.
		view.$el.attr( 'data-layer', model.id );

		var index = this.order_index[ model.id ];
		if ( 'undefined' !== typeof index ) {
			var that = this;
			var $before = null;

			$container.children( '[data-layer]' ).each( function() {
				var sibling_index = that.order_index[ $( this ).attr( 'data-layer' ) ];
				if ( 'undefined' === typeof sibling_index ) return;
				if ( sibling_index > index ) {
					$before = $( this );
					return false;
				}
			} );

			if ( $before ) {
				$before.before( view.$el );
				return;
			}
		}

		$container.append( view.$el );
	},

	activate: function( model ) {
		if ( model.get( 'active' ) == false ) {
			if ( model.collection.findWhere( { 'active': true } ) ) {
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
