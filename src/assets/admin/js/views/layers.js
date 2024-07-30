var PC = PC || {};
PC.views = PC.views || {};

/**
TODO: 
- Get product / + variation ID
	-> use product ID to store layers + angles
	-> if variable, use variation ID to store content

*/
(function( $, _ ){
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
			
			PC.selection.reset();

			if( this.admin[this.collectionName] ) { 
				this.col = this.admin[this.collectionName];
			} else {
				var loaded_data = this.admin.model.get(this.collectionName); 
				// if the data fetched from the admin view has layers
				if( loaded_data != false ) {
					this.col = this.admin[this.collectionName] = new PC[this.collectionName]( loaded_data );
				} else {
					// else we create an empty collection
					this.col = this.admin[this.collectionName] = new PC[this.collectionName]();
				}
			}

			this.listenTo( this.col, 'add', this.add_one );
			this.listenTo( this.col, 'add', this.mark_collection_as_modified );
			this.listenTo( this.col, 'change', this.layers_changed );
			this.listenTo( this.col, 'change:type', this.add_all );
			this.listenTo( this.col, 'multiple-selection', this.edit_multiple );
			this.listenTo( this.col, 'simple-selection', this.edit_simple );
			this.listenTo( this.col, 'changed-order', this.update_sorting );
			this.listenTo( this.col, 'destroy', this.removed_model );

			this.render();
		},
		single_view: function() { return PC.views.layer; },
		events: {
			'click .add-layer': 'create',
			'click .order-toolbar button': 'change_order_type',
			'keypress .structure-toolbar input': 'create',
			'remove': 'cleanup_on_remove', 
			'save-state': 'save_layers',

		}, 
		cleanup_on_remove: function() {
			_.each( this.items, this.remove_item );
		},
		render: function( ) {
			this.col.orderBy = 'order';
			this.col.sort();
			this.$el.append( this.template({ input_placeholder: PC.lang[this.collectionName +'_new_placeholder'], collectionName: this.collectionName }) );
			this.$list = this.$('.layers'); 
			this.$form = this.$('.pc-sidebar'); 
			this.$new_input = this.$('.structure-toolbar input'); 
			this.floating_add = new PC.views.floating_add_button( { el: this.$( '.floating-add' ).first(), list: this.$list, parent: this } );
			this.add_all(); 
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
				this.add_all();
			}
		},
		add_one: function( layer ) {
			// Skip groups when reordering images
			//if ( 'image_order' == this.orderAttr && 'group' == layer.get( 'type' ) ) return;

			var singleView = this.single_view();
			var new_layer = new singleView({ model: layer, form_target: this.$form, collection: this.col, orderAttr: this.orderAttr });
			this.items.push( new_layer );
			this.$list.append( new_layer.render().el );
		},

		remove_item: function( item ) {
			item.remove();
		},

		add_all: function() {
			var collection = this.col;
			this.$list.empty();
			_.each( this.items, this.remove_item );
			this.items = [];
			// this.$list.empty();
			collection.each( this.add_one, this ); 

			// .ui-sortable-handle 
			var that = this;

			// Setup the groups
			if ( 'order' == this.orderAttr ) {
				_.each( this.items, function( view ) {
					if ( view.model.get( 'parent' ) ) {
						var target = this.$( '.layers[data-item-id=' + view.model.get( 'parent' ) + ']');
						if ( target.length ) {
							target.append( view.$el );
						}
					}				
				}.bind( this ) );
			}

			this.$( '.layers' ).sortable( {
				// containment:          'parent', 
				items:                '.mkl-list-item',
				placeholder:          'mkl-list-item__placeholder',
				// tolerance:            'pointer',
				cursor:               'move',
				axis:                 'y',
				handle:               '.sort',
				// scrollSensitivity:    40,
				forcePlaceholderSize: true,
				helper:               'clone',
				opacity:              0.65,
				connectWith: '.sortable-list',
				stop: function(event, s) {
					if ( 'order' == this.orderAttr ) {
						this.update_sorting();
					} else {
						s.item.trigger('drop', s.item.index());
					}
				}.bind( this )
				
			} );
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
			if ( this.edit_multiple_items_form ) this.edit_multiple_items_form.remove();
			if ( this.col.where( { active: true } ).length ) {
				this.edit_multiple_items_form = new PC.views.multiple_edit_form( { collection: this.col, view: this } );
				this.$form.append( this.edit_multiple_items_form.$el );
			}
		},
		edit_simple: function() {
			if ( this.edit_multiple_items_form ) this.edit_multiple_items_form = null;
			PC.selection.reset();
		},
		update_sorting: function() {
			this.$( '.layers .mkl-list-item' ).each( function( i, listItem ) {
				var parent = false;
				if ( $( listItem ).closest( '.group-list' ).length ) {
					parent = $( listItem ).closest( '.group-list' ).data( 'itemId' );
				}
				$( listItem ).trigger( 'update_order', [i, parent] );
			} );

			this.col.sort( { silent: true } );
			if ( this.$list.sortable( 'instance' ) ) this.$list.sortable( 'refresh' );
		},
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
			this.listenTo( this.model, 'change:name change:admin_label change:image', this.update_label );
			this.listenTo( this.model, 'destroy', this.remove ); 
		},
		events: {
			'click > button' : 'edit',
			'drop': 'drop',
			'update-sort': 'update_sort',
			'update_order': 'update_order',
		},
		render: function() {
			this.$el.data( 'view', this );
			this.$el.html( this.template( _.extend( {}, this.model.attributes, { orderAttr: this.options.orderAttr } ) ) );
			if ( ! this.label ) {
				this.label = new PC.views.layerLabel( { model: this.model } );
				this.$( 'h3' ).append( this.label.$el );
			}
			if ( this.model.get( 'active' ) == true || this.model.get( 'active' ) == 'true' ) this.edit();
			return this;
		},
		update_label: function() {
			this.label.render();
		},
		edit: function( event ) {
			if ( PC.selection.adding_group ) return;
			if ( event && ( event.shiftKey || event.metaKey || event.ctrlKey ) ) {

				// Multiple select
				if ( this.model.get( 'active' ) ) {
					this.model.set( 'active' , false );
				} else {
					this.model.set( 'active' , true );
				}

				if ( PC.selection.is_multiple() ) {
					// Shift, select items between
					if ( event && event.shiftKey && this.model.collection.last_clicked && this.model.collection.last_clicked != this ) {
						var last_clicked = this.model.collection.last_clicked.model;
						if ( this.model.collection.last_clicked.model.get( 'order' ) < this.model.get( 'order' ) ) {
							var start = this.model.collection.indexOf( this.model.collection.last_clicked.model );
							var end = this.model.collection.indexOf( this.model );
						} else {
							var end = this.model.collection.indexOf( this.model.collection.last_clicked.model );
							var start = this.model.collection.indexOf( this.model );
						}
						var slice = this.model.collection.slice( start, end );
						_.each( slice, function( item ) {
							// Only select from the same parent
							if ( last_clicked.get( 'parent' ) != item.get( 'parent' ) ) {
								var parent = item.collection.get( item.get( 'parent' ) );
								if ( parent && ( 'group' === parent.get( 'type' ) || parent.get( 'is_group' ) ) ) return;
							}
							item.set( 'active', item.collection.last_clicked.model.get( 'active' ) );
						}.bind( this ) );
					}
					this.form_target.empty();
					this.model.collection.last_clicked = this;
					this.model.collection.trigger( 'multiple-selection' );
					return;
				} else {
					this.activate();
				}
			}

			this.model.collection.trigger( 'simple-selection' );

			var editView = this.edit_view();
			if( ! event ) {
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
				if( this.model.get( 'active' ) == false || this.model.get('active') == 'false' || this.model.collection.where( { active: true } ).length > 1 ) {
					this.options.collection.each(function(model) {
						model.set('active' , false);
					});
					this.model.set( 'active' , true );

					if( this.form ) this.form.remove();
					this.form = new editView( this.options );
					this.form_target.html( this.form.render().el );
				}
			}
			this.model.collection.last_clicked = this;
		},
		activate: function(){
			if (this.model.get('active') === true) {
				this.$el.addClass('active');
			} else {
				this.$el.removeClass('active');
			}
			PC.selection.select( this );
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
		},
		update_order: function( event, index, parent ) {
			event.stopPropagation();
			if ( parent && parent == this.model.id ) return;
			this.model.set( { order: index, parent: parent } );
		},
		
	});

	PC.views.layerLabel = Backbone.View.extend( {
		tagName: 'span',
		template: wp.template('mkl-pc-content-layer-list-item--label'),
		initialize: function() {
			this.render();
		},
		render: function() {
			this.$el.html( this.template( this.model.attributes ) );
		}
	} );

	// LAYER EDITING VIEW
	PC.views.layer_form = Backbone.View.extend( {
		tagName: 'div',
		className: 'layer-form',
		template: wp.template('mkl-pc-structure-layer-form'),
		toggled_status: {
			init: function() {
				this.statuses = JSON.parse( localStorage.getItem( 'layers_toggle_status' ) ) || {};
			},
			set: function( key, value ) {
				this.statuses[key] = value;
				localStorage.setItem( 'layers_toggle_status', JSON.stringify( this.statuses ) );
			},
			get: function( key ) {
				if ( this.statuses.hasOwnProperty( key ) ) return this.statuses[key];
				return 'opened'
			}
		},
		initialize: function( options ) {
			if ( this.pre_init ) this.pre_init( options );
			this.toggled_status.init();
			this.listenTo( this.model, 'destroy', this.remove ); 
			this.listenTo( this.model, wp.hooks.applyFilters( 'PC.admin.layer_form.render.on.change.events', 'change:not_a_choice change:type change:required change:display_mode' ), this.render );
		},
		events: {
			// 'click' : 'edit',
			'click .delete-item': 'delete_layer',
			'click .confirm-delete': 'delete_layer',
			'click .cancel-delete': 'delete_layer',
			'click .duplicate-item': 'duplicate_layer',
			// instant update of the inputs
			'keyup .setting input': 'form_change',
			'keyup .setting textarea': 'form_change',
			'change .setting select': 'form_change',
			'change .setting [type="radio"]': 'form_change',
			'click [type="checkbox"]': 'form_change',
			'click [type="checkbox"][data-setting="not_a_choice"]': 'on_change_not_a_choice',

			'click .edit-attachment': 'edit_attachment',
			'click .remove-attachment': 'select_attachment',
			'select-media': 'select_attachment',
			'click .mkl-pc--action': 'trigger_custom_action',
			'click button.components-panel__body-toggle': 'toggle_section',
		},
		render: function() {
			var data = this.model.attributes;
			
			if ( 
				'group' == this.model.get( 'type' ) 
				&& ( 
					! this.model.get( 'parent' )
					|| ! this.model.collection.get( this.model.get( 'parent' ) )
				) 
			) {
				data = _.extend( {}, data, { maybe_step: true } );
			}

			data = _.extend( {}, data, { toggled_status: this.toggled_status.statuses } );
			this.$el.html( this.template( data ) );
			this.delete_btns = {
				prompt: this.$('.delete-item'),
				confirm: this.$('.prompt-delete'),
				// cancel: this.$('.cancel-delete-layer'),
			};
			// Hide empty groups
			this.$( '.section-fields:empty' ).closest( '.setting-section' ).hide();
			this.populate_angles_list();
			PC.currentEditedItem = this.model;
			if ( this.current_focus ) {
				var focus_to = this.$( '[data-setting="'+ this.current_focus + '"]' );
				if ( 1 === focus_to.length ) focus_to.trigger( 'focus' );
				if ( 1 < focus_to.length ) {
					focus_to = this.$( '[data-setting="'+ this.current_focus + '"]:checked' );
					if ( 1 === focus_to.length ) focus_to.trigger( 'focus' );
				}
			}
			wp.hooks.doAction( 'PC.admin.layer_form.render', this );
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
			this.current_focus = setting;
			if ( 'checkbox' === event.currentTarget.type ) {
				// checkbox
				if ( 'click' === event.type ) {
					var new_val = input.prop('checked'); 
				} else {
					return;
				}
			} else if ( 'text' === event.currentTarget.type || 'textarea' === event.currentTarget.type ) {
				// text + textarea
				var new_val = input.val().trim();
			} else {
				// Other cases (select...)
				var new_val = input.val();
			}

			if ( 'type' == setting && 'group' == new_val ) {
				var content = PC.app.get_layer_content( this.model.id );
				if ( content && content.length ) {
					if ( ! confirm( PC_lang.group_with_content_warning ) ) {
						event.preventDefault();
						input.val( this.model.get( setting ) );
						return false;
					}
				}
			}
			if ( this.model.get(setting) != new_val ) {
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
					// Do not allow deleting the last Angle
					if ( this.collectionName && 'angles' === this.collectionName && 1 === this.model.collection.length ) {
						alert( PC_lang.angles_no_delete_message );
						return;
					}
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
			var new_layer = this.model.collection.create( this.model.collection.create_layer( PC.toJSON( cl ) ) );
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
					var new_item = new_choices.create( PC.toJSON( new_choice ) );
					PC.app.modified_choices.push( new_item.get( 'layerId' ) + '_' + new_item.id );
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
		},
		trigger_custom_action: function( event ) {
			var el = $( event.currentTarget );
			var action = el.data( 'action' );
			if ( action in PC.actions ) {
				PC.actions[action](el, this);
			}
		},
		toggle_section: function( e ) {
			var $el = $( e.currentTarget ).closest( '.setting-section' );
			var section = $el.data( 'section' );
			$el.toggleClass( 'is-opened' );
			this.toggled_status.set( section, $el.is( '.is-opened' ) ? 'opened' : 'closed' );
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
			this.edited_list_view = options.view;
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
			'click .order .up': 'move_items',
			'click .order .down': 'move_items',
			'click .group button': 'group_items',
		},
		render: function() {
			this.$el.html( this.template( { render_group: ! ( this.collection instanceof PC.angles ) } ) );
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
					PC.selection.reset();
					this.collection.trigger( 'simple-selection' );
					break;
				case 'cancel':
					this.delete_btns.prompt.removeClass('hidden');
					this.delete_btns.confirm.addClass('hidden');
					// this.delete_btns.cancel.addClass('hidden');
					break;

			}
		},
		move_items: function( event ) {
			var bt = $( event.currentTarget );
			var direction = bt.is( '.up' ) ? -1 : 1;

			var last_in_list = PC.selection.last().get( 'view' );
			var next = last_in_list.$el.next();
			var first_in_list = PC.selection.first().get( 'view' );
			var previous = first_in_list.$el.prev();


			var order = this.collection.orderBy || 'order';

			// Move down
			if ( 1 == direction ) {
				// There is no next sibling, so bail.
				if ( ! next.length ) return;
				next.insertBefore( first_in_list.$el );

				// Update the next item order
				var next_view = next.data( 'view' );
				next_view.model.set( order, first_in_list.model.get( order ) );

				// Update items in the selection
				PC.selection.each( function( item ) {
					item.get( 'view' ).model.set( order, item.get( 'view' ).model.get( order ) + 1 );
				} );

			// Move up
			} else {
				// There is no previous sibling, so bail.
				if ( ! previous.length ) return;
				previous.insertAfter( last_in_list.$el );

				// Update the previous item order
				var previous_view = previous.data( 'view' );

				previous_view.model.set( order, last_in_list.model.get( order ) );

				// Update items in the selection
				PC.selection.each( function( item ) {
					item.get( 'view' ).model.set( order, item.get( 'view' ).model.get( order ) - 1 );
				} );

			}

			this.collection.sort();

		},
		group_items: function( event ) {
			// Get the new group name; bail if empty
			var input = this.$( '.group input' );
			if ( ! input.val().trim() ) return;
			PC.selection.adding_group = true;

			var selection = this.collection.where( { active: true } );
			
			// Get the order of the first item, which we'll use for the group
			var order = selection[0].get( 'order' );
			// Get the attributes for the new model
			var attrs = PC.app.new_attributes( this.collection, { name: input.val().trim() } );
			attrs.order = order;
			if ( this.collection instanceof PC.layers ) {
				// attrs.type = 'group';
			} else if ( this.collection instanceof PC.choices ) {
				// attrs.is_group = true;
				attrs.layerId = this.collection.layer.id;
			}

			// Create the new group
			var new_group = this.collection.add( attrs );

			// Add the selection to the group
			PC.selection.each( function( item ) {
				item.get( 'view' ).model.set( 'parent', new_group.id );
			}.bind( this ) );

			PC.selection.adding_group = false;
			PC.selection.reset();
			this.collection.trigger( 'simple-selection' );

			var group_view = this.edited_list_view.items[this.edited_list_view.items.length - 1];
			
			new_group.set( 'active', true );
			group_view.edit();

			// Finaly, change the type of the new element, which will trigger a render of the list.
			if ( this.collection instanceof PC.layers ) {
				new_group.set( 'type', 'group' );
			} else if ( this.collection instanceof PC.choices ) {
				new_group.set( 'is_group', true );
			}
			this.collection.trigger( 'changed-order' );
		}
	});

	PC.views.floating_add_button = Backbone.View.extend( {
		initialize: function( options ) {
			this.list = options.list;
			this.parent = options.parent;
			this.$el.on( 'mouseenter', function() {
				this.active = true;
			}.bind( this ) );
			this.$el.on( 'mouseleave', function() {
				this.active = false;
			}.bind( this ) );
			this.render();
		},
		render: function() {
			this.list.on( 'mouseenter', function( e ) {
				this.list.on( 'mousemove', this.calculate_position.bind( this ) );
			}.bind( this ) );

			this.list.on( 'mouseleave', function( e ) {
				this.list.off( 'mousemove', this.calculate_position );
				setTimeout( function() {
					if ( ! this.active ) this.$el.removeClass( 'showing' );
				}.bind( this ), 60 );
			}.bind( this ) );

			this.list.on( 'scroll', function( e ) {
				this.$el.removeClass( 'showing' );
			}.bind( this ) );
		},
		calculate_position: _.debounce( function( e ) {
			var $el = $( e.target ).closest( '.mkl-list-item' );
			if ( ! $el.length ) return;
			var item_dimensions = $el[0].getBoundingClientRect();
			var list_position = this.list[0].getBoundingClientRect();
			var pos = item_dimensions.y - list_position.y + this.list.position().top;
			this.list_item = $el;
			if ( e.clientY < item_dimensions.y + 20 ) {
				this.$el.css( {
					'transform': 'translateY(' + pos + 'px)',
					'width': item_dimensions.width,
					'left': item_dimensions.x - list_position.x
				} );
				this.where = 'before';
				this.$el.addClass( 'showing' );
			} else if ( e.clientY > ( item_dimensions.y + item_dimensions.height - 20 ) ) {
				this.where = 'after';
				this.$el.css( {
					'transform': 'translateY(' + ( pos + item_dimensions.height ) + 'px)',
					'width': item_dimensions.width,
					'left': item_dimensions.x - list_position.x
				} );

				this.$el.addClass( 'showing' );
				this.$el.css( 'width', item_dimensions.width );
			} else {
				if ( ! this.active ) this.$el.removeClass( 'showing' );
			}
		}, 100 ),
		events: {
			'click .mkl-floating-add-item': 'create',
		},
		create: function() {
			var item_view = this.list_item.data( 'view' );
			var order = item_view.model.get( 'order' );
			var attrs = PC.app.new_attributes( item_view.collection, { name: 'New item' } );
			if ( item_view.model.get( 'parent' ) ) attrs.parent = item_view.model.get( 'parent' );
			if ( 'before' === this.where ) order = order - 0.5;
			if ( 'after' === this.where ) order = order + 0.5;
			attrs.order = order;

			if ( item_view.collection instanceof PC.choices ) {
				// attrs.is_group = true;
				attrs.layerId = item_view.collection.layer.id;
			}

			// Create the new item
			var new_item = item_view.collection.add( attrs );
			var new_item_el = this.list.find( '.mkl-list-item' ).last();
			if ( new_item_el.data( 'view' ).model === new_item ) {
				if ( 'before' === this.where ) {
					new_item_el.insertBefore( this.list_item );
				} else {
					new_item_el.insertAfter( this.list_item );
				}
				new_item_el.addClass( 'just-added' );
				setTimeout( function() {
					new_item_el.removeClass( 'just-added' );
				}, 300 );
			}
		},
		show: function( $el ) {

		}
	} );

})(jQuery, PC._us || window._);