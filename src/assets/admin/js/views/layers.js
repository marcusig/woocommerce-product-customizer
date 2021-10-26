var PC = PC || {};
PC.views = PC.views || {};

/**
TODO: 
- Get product / + variation ID
	-> use product ID to store layers + angles
	-> if variable, use variation ID to store content

*/
(function($){
	PC.views.layers = Backbone.View.extend({
		tagName: 'div',
		className: 'state layers-state', 
		template: wp.template('mkl-pc-structure'), 
		orderAttr: 'order', 
		collectionName: 'layers', 
		
		initialize: function( options ) {

			this.options = options || {};
			this.admin = PC.app.get_admin();
			this.product_id = options.app.product.id; 
			this.items = [];

			if( this.admin[this.collectionName] ) { 
				this.col = this.admin[this.collectionName];
				this.render();
			} else {
				
				var loaded_data = this.admin.model.get(this.collectionName); 
				// if the data fetched from the admin view has layers
				if( loaded_data != false ) {
					this.col = this.admin[this.collectionName] = new PC[this.collectionName]( loaded_data );
				} else {
					// else we create an empty collection
					this.col = this.admin[this.collectionName] = new PC[this.collectionName]();
				}

				this.render();

			}
		},
		single_view: function() { return PC.views.layer; },
		events: {
			'click .add-layer': 'create',
			'click .order-toolbar button': 'change_order_type',
			'keypress .structure-toolbar input': 'create',
			// 'remove': 'is_being_removed', 
			'save-state': 'save_layers',

		}, 
		is_being_removed: function() {
		},
		render: function( ) {
			this.col.orderBy = 'order';
			this.col.sort();
			this.$el.append( this.template({ input_placeholder: PC.lang[this.collectionName +'_new_placeholder'], collectionName: this.collectionName }) );
			this.$list = this.$('.layers'); 
			this.$form = this.$('.media-sidebar'); 
			this.$new_input = this.$('.structure-toolbar input'); 
			this.add_all( this.col ); 
			this.listenTo( this.col, 'add', this.add_one );
			this.listenTo( this.col, 'add', this.mark_collection_as_modified );
			this.listenTo( this.col, 'change', this.layers_changed );
			this.listenTo( this.col, 'multiple-selection', this.edit_multiple );
			this.listenTo( this.col, 'simple-selection', this.edit_simple );
			this.listenTo( this.col, 'destroy', this.removed_model );
			return this;
		},
		mark_collection_as_modified: function() {
			PC.app.is_modified[this.collectionName] = true;
		},
		removed_model: function( m ){
			// remove 
			this.admin.remove_relationships( this.collectionName, m );
			this.mark_collection_as_modified();
		},
		change_order_type: function( e ) {
			var $e = $( e.currentTarget );
			var selection = $e.data( 'order_type' );

			// check if it's the first time
			if ( 'image_order' == selection ) {
				var orders = this.col.pluck( 'image_order' );
				if ( orders.length && ! _.max( orders ) ) {
					this.col.each( function( m ) {
						m.set( 'image_order', m.get( 'order' ) );
					} );
				}
			}

			if ( selection && this.orderAttr != selection ) {
				$e.closest( '.button-group' ).find( 'button' ).removeClass( 'button-primary' );
				$e.addClass( 'button-primary' );
				this.orderAttr = selection;
				this.col.orderBy = selection;

				this.col.sort({silent: true});
				this.add_all( this.col );
			}
		},
		add_one: function( layer ) {
			var singleView = this.single_view();
			var new_layer = new singleView({ model: layer, form_target: this.$form, collection: this.col });
			this.items.push(new_layer);
			this.$list.append( new_layer.render().el );
		},

		remove_item: function( item ) {
			item.remove();
		},

		add_all: function( collection ) {
			this.$list.empty();
			_.each( this.items, this.remove_item );
			this.items = [];
			// this.$list.empty();
			collection.each( this.add_one, this ); 

			// .ui-sortable-handle 
			var that = this;
			this.$list.sortable({
					containment:          'parent', 
					items:                '.mkl-list-item',
					placeholder:          'mkl-list-item__placeholder',
					cursor:               'move',
					tolerance:            'pointer',
					axis:                 'y',
					handle:               '.sort',
					scrollSensitivity:    40,
					forcePlaceholderSize: true,
					helper:               'clone',
					opacity:              0.65,
					stop: 				  function(event, s){
						s.item.trigger('drop', s.item.index());
					}
					
			});

		},
		create: function( event ) {
			
			if( event.type == 'keypress' ) {
				if ( event.which !== 13 ) {
					return;
				}
			} 
			if( !this.$new_input.val().trim() ) {
				return;
			}
			// Add the new layer's model to the collection
			this.col.create( this.new_attributes( this.$new_input.val().trim() ) ); 
			

			this.$new_input.val(''); 			
			
		},
		layers_changed: function(e) {
			if ( 1 === _.keys( e.changed ).length && e.changed.hasOwnProperty( 'active' ) ) return;
			// if something has changed in the layers collection
			PC.app.is_modified[this.collectionName] = true; 

		},
		layers_loaded: function( e ) {
			this.render();
		},
		new_attributes: function( name ) {
			return {
				_id: PC.app.get_new_id( this.col ),
				name: name,
				order: this.col.nextOrder(),
				image_order: this.col.nextOrder(),
				active: true,
				// completed: false
			};
		},
		get_col: function() {
			return this.col;
		},
		edit_multiple: function() {
			this.edit_multiple_items = true;
			if ( this.edit_multiple_items_form ) this.edit_multiple_items_form.remove();
			if ( this.col.where( { active: true } ).length ) {
				this.edit_multiple_items_form = new PC.views.multiple_edit_form( { collection: this.col } );
				this.$form.append( this.edit_multiple_items_form.$el );
			}
		},
		edit_simple: function() {
			this.edit_multiple_items = false;
			if ( this.edit_multiple_items_form ) this.edit_multiple_items_form = null;
		}
	} );

	

	// SINGLE LAYER VIEW (List item)
	PC.views.layer = Backbone.View.extend({
		tagName: 'div',
		className: 'layer mkl-list-item',
		template: wp.template('mkl-pc-structure-layer'),
		edit_view: function(){ return PC.views.layer_form; },
		// formTemplate: wp.template('mkl-pc-structure-layer-form'),

		initialize: function( options ) {
			this.options = options || {}; 
			this.form_target = options.form_target; 
			this.listenTo( this.model, 'change:active', this.activate ); 
			this.listenTo( this.model, 'change:name change:admin_label change:image', this.render); 
			this.listenTo( this.model, 'destroy', this.remove ); 
		},
		events: {
			'click > button' : 'edit',
			'drop': 'drop',
			'update-sort': 'update_sort',
		},
		render: function() {
			this.$el.html( this.template( this.model.attributes ) );
			if( this.model.get('active') == true || this.model.get('active') == 'true' ) this.edit();
			return this;
		},
		edit: function( event ) { 
			if ( event && ( event.shiftKey || event.metaKey || event.ctrlKey ) ) {
				// Multiple select
				if ( this.model.get( 'active' ) ) {
					this.model.set( 'active' , false );
				} else {
					this.model.set( 'active' , true );
				}
				this.activate();
				this.form_target.empty();
				this.model.collection.trigger( 'multiple-selection' );

				return;
			}
			this.model.collection.trigger( 'simple-selection' );
			var editView = this.edit_view();
			if( !event ) {
				if( ! this.form ) {
					this.options.collection.each(function(model) {
						model.set('active' , false);
					});
					this.model.set( 'active' , true );
					this.activate();
					this.form = new editView( this.options );
					this.form_target.html( this.form.render().el );
				}
			} else {
				if( this.model.get('active') == false || this.model.get('active') == 'false' ) {
					this.options.collection.each(function(model) {
						model.set('active' , false);
					});
					this.model.set( 'active' , true );

					if( this.form ) this.form.remove();
					this.form = new editView( this.options );
					this.form_target.html( this.form.render().el );
				}
			}
		},
		activate: function(){
			if(this.model.get('active') === true) {
				this.$el.addClass('active');
			} else {
				this.$el.removeClass('active');
			}
		},
		drop: function( event, index ) {
			// Remove the active state after drop
			if( this.model.get('active') === true ) {
				this.model.set('active', false);
			}

			// Update the order for all elements in the list
			this.$el.siblings().addBack().trigger( 'update-sort' );

			// Remove the form view
			if( this.form ) this.form.remove();
		},
		update_sort: function( e ) {
			e.stopPropagation();
			this.model.set( this.model.collection.orderBy, $( e.currentTarget ).index() );
		}
	});

	// LAYER EDITING VIEW
	PC.views.layer_form = Backbone.View.extend({
		tagName: 'div',
		className: 'layer-form',
		template: wp.template('mkl-pc-structure-layer-form'),

		initialize: function( options ) {
			this.listenTo( this.model, 'destroy', this.remove ); 
			this.listenTo( this.model, wp.hooks.applyFilters( 'PC.admin.layer_form.render.on.change.events', 'change:not_a_choice change:type' ), this.render );
		},
		events: {
			// 'click' : 'edit',
			'click .delete-layer': 'delete_layer',
			'click .confirm-delete-layer': 'delete_layer',
			'click .cancel-delete-layer': 'delete_layer',
			'click .duplicate-layer': 'duplicate_layer',
			// instant update of the inputs
			'keyup .setting input': 'form_change',
			'keyup .setting textarea': 'form_change',
			'change .setting select': 'form_change',
			'click [type="checkbox"]': 'form_change',
			'click [type="checkbox"][data-setting="not_a_choice"]': 'on_change_not_a_choice',

			'click .edit-attachment': 'edit_attachment',
			'click .remove-attachment': 'select_attachment',
			'select-media': 'select_attachment',
		},
		render: function() {
			this.$el.html( this.template( this.model.attributes ) );
			this.delete_btns = {
				prompt: this.$('.delete-layer'),
				confirm: this.$('.prompt-delete'),
				// cancel: this.$('.cancel-delete-layer'),
			};
			this.populate_angles_list();
			PC.currentEditedItem = this.model;
			return this;
		},
		on_change_not_a_choice: function( event ) {
			var input = $(event.currentTarget);
			var new_val = input.prop('checked');
			this.model.set( 'not_a_choice', new_val );
		},
		form_change: function( event ) {

			var input = $(event.currentTarget);
			var setting = input.data('setting');

			if ( event.type == 'click' ) {
				// checkbox
				var new_val = input.prop('checked'); 
			} else if ( 'text' === event.currentTarget.type || 'textarea' === event.currentTarget.type ) {
				// text + textarea
				var new_val = input.val().trim();
			} else {
				// Other cases (select...)
				var new_val = input.val();
			}

			if( this.model.get(setting) != new_val ) {
				this.model.set(setting, new_val);
			}

		},
		delete_layer: function( event ) {
			var bt = $(event.currentTarget);
			var action = bt.data('delete');
			switch (action) {
				case 'prompt':
					bt.addClass('hidden');
					this.delete_btns.confirm.removeClass('hidden');
					break;
				case 'confirm':
					this.model.destroy();
					break;
				case 'cancel':
					this.delete_btns.prompt.removeClass('hidden');
					this.delete_btns.confirm.addClass('hidden');
					// this.delete_btns.cancel.addClass('hidden');
					break;

			}
		},
		duplicate_layer: function( event ) {
			// Duplicate the layer
			var cl = this.model.clone();
			cl.set( 'name', cl.get( 'name' ) + ' (Copy)' );
			var new_layer = this.model.collection.create( this.model.collection.create_layer( cl.attributes ) );
			if ( cl.get( 'admin_label' ) ) {
				new_layer.set( 'admin_label', cl.get( 'admin_label' ) + ' (Copy)' );
			}
			
			// Duplicate the layer content
			var product = PC.app.get_product();
			var content = product.get( 'content' );
			if ( content.get( this.model.id ) ) {
				var col = content.get( this.model.id ).get( 'choices' );
				var new_choices = new PC.choices([], { layer: new_layer } );
				content.add( { layerId: new_layer.id, choices: new_choices } );
				col.each( function( model ) {
					var new_choice = model.clone();
					new_choice.set( 'layerId', new_layer.id );
					new_choices.create( new_choice.toJSON() );
				} );
				PC.app.is_modified['content'] = true;
			}
		},
		edit_attachment: function(e) {
			e.preventDefault();

			PC.media.open( {el: this.$el, selection: this.model.get('image').id } );

		},

		select_attachment: function(e, attachment) {
			var url = '';
			var id = null;
			if ( attachment ) {
				url = attachment.get('url');
				id = attachment.id;
			} 
			this.model.set('image', {
				url: url,
				id: id
			});
			this.render();
		},
		populate_angles_list: function() {
			var selected = this.model.get( 'angle_switch' ) || 'no';
			var angles = PC.app.get_collection( 'angles' );
			if ( angles && angles.length ) {
				angles.each( function( model ) {
					this.$( 'select[data-setting="angle_switch"]' ).append('<option '+ ( selected == model.id ? 'selected ' : '' ) + 'value="' + model.id + '">Switch to ' + model.get( 'name' ) + '</option>' );
				}, this );
			}
		}
	});

	PC.views.layer_img = Backbone.View.extend({

	});

	// MULTIPLE EDITING VIEW
	PC.views.multiple_edit_form = Backbone.View.extend({
		tagName: 'div',
		className: 'layer-form',
		template: wp.template('mkl-pc-multiple-edit-form'),

		initialize: function( options ) {
			this.collection = options.collection;
			this.render();
			this.listenTo( this.collection, 'simple-selection', this.remove );
			// this.listenTo( this.model, 'destroy', this.remove ); 
			// this.listenTo( this.model, 'change:not_a_choice change:type', this.render );
		},
		events: {
			// 'click' : 'edit',
			'click .delete-layer': 'delete_items',
			'click .confirm-delete-layer': 'delete_items',
			'click .cancel-delete-layer': 'delete_items',
		},
		render: function() {
			this.$el.html( this.template() );
			this.delete_btns = {
				prompt: this.$('.delete-layer'),
				confirm: this.$('.prompt-delete'),
				// cancel: this.$('.cancel-delete-layer'),
			};
			// this.populate_angles_list();
			return this;
		},
		delete_items: function( event ) {
			var bt = $(event.currentTarget);
			var action = bt.data('delete');
			switch (action) {
				case 'prompt':
					bt.addClass('hidden');
					this.delete_btns.confirm.removeClass('hidden');
					break;
				case 'confirm':
					// this.model.destroy();
					_.each( this.collection.where( { active: true } ), function( model ) {
						model.destroy();
					} );
					this.collection.trigger( 'simple-selection' );
					break;
				case 'cancel':
					this.delete_btns.prompt.removeClass('hidden');
					this.delete_btns.confirm.addClass('hidden');
					// this.delete_btns.cancel.addClass('hidden');
					break;

			}
		},
	});

})(jQuery);