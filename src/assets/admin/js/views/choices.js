var PC = PC || {};
PC.views = PC.views || {};

(function($, _){
	'use strict';
	// PC.views.choices = PC.views.layers.extend({
	// 	collectionName: 'choices', 
	// });

	PC.views.choices = Backbone.View.extend({
		// className: 'choices-list',
		tagName: 'div',
		className: 'mkl-choice-list-inner',
		template: wp.template('mkl-pc-choices'),
		collectionName:'content',
		initialize: function( options ) {
			this.options = options || {};

			if ( !this.options.state ) {
				return false;
			}

			this.items = [];
			this.product = PC.app.get_product(); 
			this.content = this.product.get('content');
			if ( this.content.get( this.model.id ) ) {
				this.col = this.content.get( this.model.id ).get('choices');
			} else {
				this.content.add( { layerId: this.model.id, choices: new PC.choices([], { layer: PC.app.admin.layers.get( this.model.id ) } ) } );
				this.col = this.content.get( this.model.id );
			}
			this.state = this.options.state; 
			this.listenTo( this.col, 'add', this.add_one );
			this.listenTo( this.col, 'add', this.mark_collection_as_modified);
			this.listenTo( this.col, 'remove', this.remove_one);
			this.listenTo( this.col, 'change', this.choices_changed);
			this.listenTo( this.col, 'change:is_group', this.render);
			this.listenTo( this.col, 'multiple-selection', this.edit_multiple );
			this.listenTo( this.col, 'changed-order', this.update_sorting );
			this.listenTo( this.col, 'duplicated-item', this.duplicated_item );
			this.listenTo( this.col, 'simple-selection', this.edit_simple );
			this.listenTo( PC.app.admin, 'pasted-data', this.on_paste );
			
			// Initialize editing state - restore from global collection if layer is global
			if ( typeof this.editing_choices === 'undefined' ) {
				if ( this.model && this.model.get( 'is_global' ) && this.model.get( 'global_id' ) ) {
					this.editing_choices = PC.app.get_global_layers().is_editing_choices( this.model.get( 'global_id' ) );
				} else {
					this.editing_choices = false;
				}
			}
			this.render(); 
		},
		events: {
			'click .active-layer': 'hide_choices',
			'click .add-layer': 'create',
			// 'click .paste-items': 'paste_items',
			'keypress .structure-toolbar--choices h4 input': 'create',
			'input .mkl-pc-list-filter-input': 'on_list_filter',
			'remove': 'cleanup_on_remove', 
		},
		remove_item: function( item ) {
			item.remove();
		},
		cleanup_on_remove: function() {
			// Deactivate choice
			this.col.each( function( item ) {
				item.set( 'active', false );
			} );
			if ( this.edit_multiple_items_form ) {
				this.edit_multiple_items_form.remove();
				this.edit_multiple_items_form = null;
			}
			_.each( this.items, function( iv ) {
				if ( iv.form ) {
					iv.form.remove();
					iv.form = null;
				}
			} );
			// Drop choice / multi-edit forms from the sidebar panel (keep empty-state placeholders)
			if ( this.$form && this.$form.length ) {
				this.$form.children().not( '.mkl-pc-content-placeholder' ).remove();
			}
			// Remove views
			this.remove_views();
			this.stopListening();

		},
		duplicated_item: function() {
			this.render();
			this.update_sorting();
		},
		has_clipboard_data: function() {
			return !! PC.clipboard_data;
		},
		render: function() {
			// Ensure edit state is synced with global collection for global layers
			if ( this.model && this.model.get( 'is_global' ) && this.model.get( 'global_id' ) ) {
				var global_id = this.model.get( 'global_id' );
				this.editing_choices = PC.app.get_global_layers().is_editing_choices( global_id );
			}
			this.$el.empty();
			this.$el.html( this.template( _.extend( { has_clipboard_data: this.has_clipboard_data(), is_editing_choices: this.editing_choices }, this.model.attributes ) ) );
			this.remove_views();

			this.$active_layer = this.$('.active-layer');
			var al_button = wp.template('mkl-pc-content-layer-back-link');
			this.$active_layer.html( al_button( this.model.attributes ) );
			this.$new_input = this.$('.structure-toolbar--choices h4 input'); 
			this.$list_filter = this.$('.structure-toolbar--choices .mkl-pc-list-filter-input'); 
			this.$list = this.$('.choices');
			this.$form = this.state.$('.choice-details'); 
			this.add_all();
			this.update_groups();
			this.setup_sortable();
			// Always update lock state if layer is global - this ensures edit mode persists
			if ( this.model.get( 'is_global' ) ) {
				this.update_lock_state();
			} else {
				// Leaving a locked global layer leaves is-layer-locked on the content root; clear it for local layers
				this.$el.removeClass( 'is-layer-locked' );
				if ( this.state && this.state.$el ) {
					this.state.$el.removeClass( 'is-layer-locked' );
				}
			}
			// Ensure parent view has correct classes for button visibility
			this.state.$el.toggleClass( 'is-global-layer', this.model.get( 'is_global' ) );
			if ( this.state && this.state.update_global_actions_visibility ) {
				this.state.update_global_actions_visibility();
			}
			return this;
		},
		update_lock_state: function() {
			// Disable sortable when locked
			if ( this.$list && this.$list.sortable( 'instance' ) ) {
				this.$list.sortable( 'option', 'disabled', ! this.editing_choices );
			}
			this.$el.toggleClass( 'is-layer-locked', ! this.editing_choices );
			this.state.$el.toggleClass( 'is-layer-locked', ! this.editing_choices );
			// Update global lock state on parent view
			if ( this.state && this.state.update_global_actions_visibility ) {
				this.state.update_global_actions_visibility();
			}
		},

		choices_changed: function( model ) {
			var changed = model.changedAttributes && model.changedAttributes();
			if ( ! changed || _.isEmpty( _.omit( changed, 'active' ) ) ) {
				return;
			}
			if ( -1 == PC.app.modified_choices.indexOf( model.get( 'layerId' ) + '_' + model.id ) ) {
				PC.app.modified_choices.push( model.get( 'layerId' ) + '_' + model.id );
			}
			this.mark_collection_as_modified();
		},

		mark_collection_as_modified: function() {
			PC.app.is_modified[this.collectionName] = true;
			if ( this.collectionName === 'content' && this.model ) {
				var layerId = this.model.get && this.model.get( 'layerId' ) || this.model.id;
				if ( layerId ) {
					PC.app.modified_content_layer_ids = PC.app.modified_content_layer_ids || {};
					PC.app.modified_content_layer_ids[ layerId ] = true;
				}
			}
			if ( PC.app.syncSidebarSaveButtonState ) {
				PC.app.syncSidebarSaveButtonState();
			}
		},

		add_one: function( model ) {
			var new_choice = new PC.views.choice({ model: model, state: this.state, collection: this.col, form_target: this.$form });
			this.items.push( new_choice );
			this.$list.append( new_choice.render().el );
		},
		update_groups: function() {
			_.each( this.items, function( view ) {
				if ( view.model.get( 'parent' ) ) {
					var target = this.$( '.choices[data-item-id=' + view.model.get( 'parent' ) + ']');
					if ( target.length ) {
						target.append( view.$el );
					}
				}				
			}.bind( this ) );
		},
		remove_one: function( model ) {
			this.mark_collection_as_modified();
			// var new_choice = new PC.views.choice({ model: model, state: this.state, collection: this.col, form_target: this.$form });
			// this.items.push( new_choice );
			// this.$list.append( new_choice.render().el );
		},

		add_all: function(){
			this.col.each( this.add_one, this );
			this.apply_list_filter();
		},

		on_list_filter: function( e ) {
			if ( typeof PC.applyAdminListFilter !== 'function' ) return;
			PC.applyAdminListFilter( this.$list, $( e.target ).val(), {} );
		},
		apply_list_filter: function() {
			if ( typeof PC.applyAdminListFilter !== 'function' || ! this.$list || ! this.$list.length ) return;
			var val = this.$list_filter && this.$list_filter.length ? this.$list_filter.val() : '';
			PC.applyAdminListFilter( this.$list, val, {} );
		},

		setup_sortable: function() {
			this.$('.choices').sortable({
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
					this.update_sorting();
				}.bind( this ),
			});

			// Respect current lock state
			if ( this.model.get( 'is_global' ) && this.$list && this.$list.sortable( 'instance' ) ) {
				this.$list.sortable( 'option', 'disabled', ! this.editing_choices );
			}
		},
		update_sorting: function() {
			this.$( '.choices .mkl-list-item' ).each( function( i, listItem ) {
				var parent = false;
				if ( $( listItem ).closest( '.group-list' ).length ) {
					parent = $( listItem ).closest( '.group-list' ).data( 'itemId' );
				}
				$( listItem ).trigger( 'update_order', [i, parent] );
			} );

			this.col.sort( { silent: true } );
			if ( this.$list.sortable( 'instance' ) ) this.$list.sortable( 'refresh' );
			this.apply_list_filter();
		},

		hide_choices: function( e ) {
			e.preventDefault();
			if ( this.state.layers && this.state.layers.$el ) {
				this.state.layers.$el.children( 'li' ).removeClass( 'active' );
				this.state.layers.$el.find( 'button.layer' ).attr( 'aria-pressed', 'false' );
			}
			// Preserve edit state in global collection before closing (for when user comes back)
			if ( this.model && this.model.get( 'is_global' ) && this.model.get( 'global_id' ) ) {
				var global_id = this.model.get( 'global_id' );
				PC.app.get_global_layers().set_editing_choices( global_id, this.editing_choices );
			}
			this.state.$el.removeClass( 'show-choices' );
			if ( this.edit_multiple_items_form ) {
				this.edit_multiple_items_form.remove();
				this.edit_multiple_items_form = null;
			}
			_.each( this.items, function( iv ) {
				if ( iv.form ) {
					iv.form.remove();
					iv.form = null;
				}
			} );
			this.remove_views();
			// Remove the element from DOM before clearing
			if ( this.$el && this.$el.parent().length ) {
				this.$el.remove();
			}
			this.$el.empty();
			if ( this.$form && this.$form.length ) {
				this.$form.children().not( '.mkl-pc-content-placeholder' ).remove();
				this.$form.empty();
			}
			if ( this.state ) {
				this.state.active_layer = null;
				// Remove classes when closing layer (buttons will be hidden)
				this.state.$el.removeClass( 'is-global-layer is-global-locked is-layer-locked' );
				if ( this.state.update_global_actions_visibility ) {
					this.state.update_global_actions_visibility();
				}
			}
		},

		remove_views: function() {
			_.each( this.items, this.remove_item );
			this.items = [];
		},

		create: function( e ) {
			if( e.type == 'keypress' ) {
				if ( e.which !== 13 ) {
					return;
				}
			}
			if ( this.model.get( 'is_global' ) && ! this.editing_choices ) return; // Locked

			if( !this.$new_input.val().trim() ) {
				return;
			}

			if ( this.model.get( 'not_a_choice' ) && this.col.length ) {
				alert( 'The layer is set as Not a choice, so only one item can be added.' );
				return;
			}
			// Add the new layer's model to the collection
			var new_item = this.col.add( this.new_attributes( this.$new_input.val().trim() ) ); 
			PC.app.modified_choices.push( new_item.get( 'layerId' ) + '_' + new_item.id );

			this.$new_input.val('');
			this.apply_list_filter();
		},
		on_edit_choices: function( e ) {
			if ( e ) e.preventDefault();
			this.editing_choices = true;
			// Store in global collection
			if ( this.model && this.model.get( 'is_global' ) && this.model.get( 'global_id' ) ) {
				PC.app.get_global_layers().set_editing_choices( this.model.get( 'global_id' ), true );
			}
			this.render();
			// Trigger event for choiceDetails views to update lock state
			this.$el.trigger( 'choices-edit-mode-changed' );
			wp.hooks.doAction( 'PC.admin.choices.editModeChanged', this.model, this );
			if ( this.state && this.state.update_global_actions_visibility ) {
				this.state.update_global_actions_visibility();
			}
		},
		on_cancel_edit_choices: function( e ) {
			if ( e ) e.preventDefault();
			var self = this;
			var global_id = this.model && this.model.get( 'global_id' );
			
			// Clear edit state first
			this.editing_choices = false;
			if ( this.model && this.model.get( 'is_global' ) && global_id ) {
				PC.app.get_global_layers().set_editing_choices( global_id, false );
			}
			
			// Trigger event for choiceDetails views to update lock state
			this.$el.trigger( 'choices-edit-mode-changed' );
			wp.hooks.doAction( 'PC.admin.choices.editModeChanged', this.model, this );
			
			// Re-fetch from server/source to discard local edits
			this.refresh_from_server().always( function() {
				self.render();
				if ( self.state && self.state.update_global_actions_visibility ) {
					self.state.update_global_actions_visibility();
				}
			} );
		},
		refresh_from_server: function() {
			var d = jQuery.Deferred();
			var self = this;
			
			// Safety check: Do not refresh if in edit mode (prevents losing unsaved changes)
			var is_editing = false;
			if ( this.model && this.model.get( 'is_global' ) && this.model.get( 'global_id' ) && PC.app.get_global_layers ) {
				is_editing = PC.app.get_global_layers().is_editing_choices( this.model.get( 'global_id' ) );
			} else {
				is_editing = this.editing_choices;
			}
			
			if ( is_editing ) {
				d.resolve();
				return d.promise();
			}
			
			// Allow external implementations to hook fetch
			var handled = false;
			try {
				wp.hooks.doAction( 'PC.admin.choices.fetch', this.model, this, function() {
					handled = true;
					d.resolve();
				} );
			} catch(e) {}

			if ( handled ) return d.promise();

			// Fetch choices - only for global layers to ensure data is not stale
			var is_global = this.model && this.model.get( 'is_global' );
			var global_id = this.model && this.model.get( 'global_id' );
			
			if ( is_global && global_id && PC.app.get_global_layers ) {
				// Fetch using global_layers collection
				PC.app.get_global_layers().fetch_global_choices( global_id, this.model.id, {
					success: function( choices, response ) {
						if ( choices && Array.isArray( choices ) ) {
							self.col.reset( choices );
							PC.app.is_modified[self.collectionName] = false;
							self.render();
						}
						d.resolve();
					},
					error: function( model, error ) {
						console.error( 'Error fetching global choices:', error );
						d.resolve(); // Resolve anyway to not block UI
					}
				} );
			} else {
				// Local layers don't need refresh - data is already loaded
				d.resolve();
			}
			return d.promise();
		},

		// paste_items: function( e ) {
		// 	var $target = $( e.currentTarget );
		// 	if ( PC.clipboard_data ) {
		// 		var data = JSON.parse( PC.clipboard_data );
		// 		if ( ! data ) {
		// 			alert( 'data is not JSON object' );
		// 			return;
		// 		}


		// 		var parents = [];
		// 		_.each( data, function( item ) {
		// 			var original_id = item._id;
		// 			item._id = PC.app.get_new_id( this.col );
		// 			item.layerId = this.model.id;
		// 			item.order = this.col.nextOrder();
		// 			if ( item.parent ) {
		// 				var t = _.findWhere( parents, { original_id: item.parent } );
		// 				if ( t ) {
		// 					item.parent = t.new_id;
		// 				}
		// 			}
		// 			var new_item = this.col.add( JSON.parse( JSON.stringify( item ) ) );
		// 			if ( item.is_group ) {
		// 				parents.push( { original_id: original_id, new_id: new_item.id } );
		// 			}
		// 			PC.app.modified_choices.push( new_item.get( 'layerId' ) + '_' + new_item.id );

		// 		}.bind( this ) );

		// 		if ( parents.length ) this.duplicated_item();
		// 	}
		// },

		new_attributes: function( name ) {
			return {
				_id: PC.app.get_new_id( this.col ),
				name: name,
				order: this.col.nextOrder(),
				active: true,
				layerId: this.model.id,
				// completed: false
			};
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
		},
		on_paste( json ) {
			if (!json || json.type !== 'choices' || !json.models) return;

			const id_map = []; // { original_id, new_id }
			const new_choices = [];
			
			// Step 1: Create all layers and store ID mapping
			_.each( json.models, ( item ) => {
				const original_id = item._id;
				item._id = PC.app.get_new_id( this.col );
				item.layerId = this.model.id;
				item.order = this.col.nextOrder();

				const new_choice = this.col.create( item );
				PC.app.modified_choices.push( new_choice.get( 'layerId' ) + '_' + new_choice.id );
				if ( 1 === json.models.length ) this.model.set( 'active', false );
				id_map[original_id] = new_choice.id;
				new_choices.push( new_choice );
			} );

			// Step 2: Fix parenting
			let parents = 0;
			new_choices.forEach( choice => {
				const original_parent_id = choice.get( 'parent' );
				if ( !original_parent_id ) return;

				if ( id_map[ original_parent_id ] ) {
					// ✅ Update to new ID if parent was also pasted
					choice.set( 'parent', id_map[ original_parent_id ] );
					parents++;
				} else {
					// ❌ Remove parent if parent not included
					choice.unset( 'parent' );
				}
			} );

			// If we pasted groups, re-render the list
			if ( parents ) this.duplicated_item();
		}
	});

	PC.views.choiceLabel = Backbone.View.extend( {
		tagName: 'span',
		className: 'choice-label-container',
		template: wp.template('mkl-pc-content-choice-list-item--label'),
		initialize: function() {
			this.render();
		},
		render: function() {
			this.$el.html( this.template( this.model.attributes ) );
		}
	} );
	
	PC.views.choice = PC.views.layer.extend( {
		edit_view: function(){ return PC.views.choiceDetails; },
		events: {
			'click .mkl-pc-admin-list-row__hit' : 'edit',
			'drop': 'drop',
			'update_order': 'update_order',
		},
		template: wp.template( 'mkl-pc-content-choice-list-item' ),
		initialize: function( options ) {
			this.options = options || {}; 
			this.form_target = options.form_target; 
			this.listenTo( this.model, 'change:active', this.activate ); 
			this.listenTo( this.model, 'change:name change:admin_label', this.update_label ); 
			this.listenTo( this.model, 'destroy', this.remove ); 
		},		
		render: function() {
			this.$el.addClass( 'choice' );
			this.$el.toggleClass( 'is-group', !! this.model.get( 'is_group' ) );
			this.$el.data( 'view', this );
			this.$el.html( this.template( this.model.attributes ) );
			if ( ! this.label ) {
				this.label = new PC.views.choiceLabel( { model: this.model } );
				this.$( '.mkl-pc-admin-list-row__body' ).append( this.label.$el );
			}
			if ( this.model.get( 'active' ) == true || this.model.get( 'active' ) == 'true' ) this.edit();
			return this;
		},
		update_label: function() {
			this.label.render();
		},
		update_order: function( event, index, parent ) {
			event.stopPropagation();
			if ( parent && parent == this.model.id ) return;
			this.model.set( { order: index, parent: parent } );
		},
		drop: function( event, index, a ) {
			// prevent this from happening twice
			if ( this.dropped && this.dropped == event.timeStamp ) return;
			this.dropped = event.timeStamp;

			// Remove the active state after drop
			if( this.model.get('active') === true ) {
				this.model.set('active', false);
			}

			var has_group = this.$el.closest( '.group-list' ).length;

			if ( ! has_group && event.target == this.el ) {
				// triggers the re-order event
				$( event.target ).trigger( 'update-sort', [this.model, index, 0] );
			} else if ( event.target == this.el ) {
				$( event.target ).trigger( 'update-sort', [this.model, index, 1] );
			}

			// Remove the form view
			if( this.form ) this.form.remove();
		},
	} );

	/**
	 * Edit view
	 */
	PC.views.choiceDetails = Backbone.View.extend({ 
		tagName: 'div', 
		className: 'choice-form', 
		template: wp.template('mkl-pc-content-choice-form'),
		collectionName: 'content',
		initialize: function( options ) {
			this.admin = PC.app.get_admin(); 
			this.toggled_status.init();
			this.angles = this.admin.angles; 
			this.layer = PC.app.admin.layers.get( this.model.get( 'layerId' ) );
			this.state = options.state; // Reference to parent choices view
			this.listenTo( this.model, 'destroy', this.remove );
			this.listenTo( this.model, wp.hooks.applyFilters( 'PC.admin.choice_form.render.on.change.events', 'change:is_group' ), this.render );
			
			// Listen for edit mode changes from parent state view
			if ( this.state ) {
				// Custom event from parent when edit mode changes
				$( this.state.$el ).on( 'choices-edit-mode-changed', this.update_lock_state.bind( this ) );
			}
			
			// Also listen to global layers edit state changes via hook
			wp.hooks.addAction( 'PC.admin.choices.editModeChanged', 'PC/choiceDetails/updateLock', this.update_lock_state.bind( this ) );
			
			PC.currentEditedItem = this.model;
			wp.hooks.doAction( 'PC.admin.choiceDetails.init', this );
		},
		events: {
			// 'click' : 'edit',
			'click .delete-item': 'delete_choice',
			'click .confirm-delete': 'delete_choice',
			'click .cancel-delete': 'delete_choice',
			'click .duplicate-item': 'duplicate_choice',
			'click .copy-item': 'copy_choice',
			// instant update of the inputs
			'keyup .setting input': 'form_change',
			'input .setting input': 'form_change',
			'change .setting input[type=date]': 'form_change',
			'keyup .setting textarea': 'form_change',
			'change .setting select': 'form_change',
			'click [type="checkbox"]': 'form_change',
			'click .mkl-pc--action': 'trigger_custom_action',
			'click button.components-panel__body-toggle': 'toggle_section',
			'click .hide-addon-placeholder' : 'hide_addon',
			'focus input.color-hex': 'toggle_iris',
			'remove': 'on_remove'
		},
		on_remove: function ( e ) {
			this.$( '.wp-picker-container.wp-picker-active input.color-hex' ).wpColorPicker( 'close' );
			// Clean up event listeners
			if ( this.state && this.state.$el ) {
				$( this.state.$el ).off( 'choices-edit-mode-changed', this.update_lock_state );
			}
			wp.hooks.removeAction( 'PC.admin.choices.editModeChanged', 'PC/choiceDetails/updateLock' );
		},
		render: function() {
			var args;
			    

			if ( this.layer ) {
				args = { 
					not_a_choice: this.layer.get( 'not_a_choice' ),
					layer_type: this.layer.get( 'type' ),
					layer: this.layer.attributes,
				};
			} else {
				args = {};
			}
			var data = _.extend( {}, _.defaults( args, this.model.attributes ), { toggled_status: this.toggled_status.statuses } );
			this.$el.html( this.template( data ) );
			this.$pictures = this.$('.views');

			if ( this.model.get( 'is_group' ) )  {
				this.add_angle( this.angles.first() );
			} else {
				this.angles.each(this.add_angle, this);
			}

			this.delete_btns = {
				prompt: this.$('.delete-item'),
				confirm: this.$('.prompt-delete'),
			};

			this.populate_angles_list();
			
			this.$( 'input.color-hex' ).wpColorPicker( {
				change: function( event, ui ) {
					// Update value manually (optional, just in case)
					const $input = $( event.target );
					$input.val( ui.color.toString() );

					// Trigger native input event
					$input.trigger( 'input' );
				},
				clear: function( a, b ) {
					const $input = $( this ).closest( '.wp-picker-container' ).find( 'input[type="text"]' );

					$input.val( '' );         // Clear value explicitly (just in case)
					$input.trigger( 'input' ); // Trigger input event
				}
			});

			// Hide empty groups
			this.$( '.section-fields:empty' ).closest( '.setting-section' ).hide();
			
			// Update lock state after render
			this.update_lock_state();
			
			wp.hooks.doAction( 'PC.admin.choiceDetails.render', this );

			return this;
		},
		form_change: function( event ) {
			var input = $(event.currentTarget);
			var setting = input.data('setting');
			
			if ( ( 'keyup' === event.type || 'input' === event.type ) && 'checkbox' === event.currentTarget.type ) return;

			if ( 'click' === event.type ) {
				// checkbox
				var new_val = input.prop( 'checked' );

				// Reset is_default in the other choices
				if ( 'is_default' == setting && new_val && 'simple' == this.layer.get( 'type' ) ) {
					this.model.collection.invoke( 'set', { is_default: false } );
				}

			} else if ( 'text' === event.currentTarget.type || 'textarea' === event.currentTarget.type ) {
				// text + textarea
				var new_val = input.val().trim();
			} else {
				// Other cases (select...)
				var new_val = input.val();
			}

			if ( this.model.get( setting ) != new_val ) {
				this.model.set(setting, new_val);
			} 

		},
		form_changed: function() {
			// this.model.save();
		},
		delete_choice: function( event ) {
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
		duplicate_choice: function() {
			var new_choice = this.model.clone();
			new_choice.set( '_id', PC.app.get_new_id( this.model.collection ) );
			new_choice.set( 'name', new_choice.get( 'name' ) + ' (Copy)' );
			if ( new_choice.get( 'admin_label' ) ) {
				new_choice.set( 'admin_label', new_choice.get( 'admin_label' ) + ' (Copy)' );
			}
			this.model.collection.create( PC.toJSON( new_choice ) );
			PC.app.modified_choices.push( new_choice.get( 'layerId' ) + '_' + new_choice.id );
			this.model.set( 'active', false );
			this.model.collection.trigger( 'duplicated-item' );
		},
		copy_choice: function() {
			PC.copy_items( this );
		},		
		add_angle: function( angle ) {
			// this.model
			var data = {
				angle: angle,
				choice: this.model,
			};
			
			if( !this.model.get('images') ) this.model.set('images', new PC.choice_pictures() );
				
			var images = this.model.get( 'images' );
			
			var imageModel = images.get(angle.id) || null;

			data.model = imageModel; // can be null
			var angle_view = new PC.views.choice_picture(data);
			this.$pictures.append(angle_view.render().el);

			/**
			 * PC.admin.choiceDetails.add_angle action, triggered when adding the angle images to the choice details
			 *
			 * @param Backbone.Model angle - The angle
			 * @param Backbone.View  angle_view - The single angle view
			 * @param Backbone.View  choiceDetails
			 */
			wp.hooks.doAction( 'PC.admin.choiceDetails.add_angle', angle, angle_view, this );
		},
		trigger_custom_action: function( event ) {
			var el = $(event.currentTarget);
			var action = el.data( 'action' );
			if ( action in PC.actions ) {
				PC.actions[action](el, this);
			}
		},
		populate_angles_list: function() {
			var angles = PC.app.get_collection( 'angles' );
			if ( angles && angles.length ) {
				this.$( 'select[data-setting="angle_switch"], .angle-list' ).each( function( ind, el ) {
					var setting = $( el ).data( 'setting' );
					var prefix = $( el ).data( 'label_prefix' );

					var def = $( el ).val();
					var selected = this.model.get( setting ) || def;
					angles.each( function( model ) {
						$( el ).append('<option '+ ( selected == model.id ? 'selected ' : '' ) + 'value="' + model.id + '">' + ( prefix ? prefix + ' ' : '' ) + model.get( 'name' ) + '</option>' );
					}, this );
				}.bind( this ) )
			}
		},
		toggled_status: {
			init: function() {
				this.statuses = JSON.parse( localStorage.getItem( 'choice_toggle_status' ) ) || {};
			},
			set: function( key, value ) {
				this.statuses[key] = value;
				localStorage.setItem( 'choice_toggle_status', JSON.stringify( this.statuses ) );
			},
			get: function( key ) {
				if ( this.statuses.hasOwnProperty( key ) ) return this.statuses[key];
				return 'opened'
			}
		},		
		toggle_section: function( e ) {
			var $el = $( e.currentTarget ).closest( '.setting-section' );
			var section = $el.data( 'section' );
			$el.toggleClass( 'is-opened' );
			this.toggled_status.set( section, $el.is( '.is-opened' ) ? 'opened' : 'closed' );
		},
		hide_addon: function( e ) {
			e.preventDefault();
			var $setting = $( e.currentTarget ).closest( '.setting' );
			var $section = $setting.closest( '.setting-section' );
			var regex = /setting-id-(.+)/i;
			var matches = regex.exec( $setting[0].className );
			if ( ! matches ) return;
			var setting_name = matches[1];
			
			// hide item
			$section.remove();

			// Save in local storage
			localStorage.setItem( 'mkl_pc_settings_hide__' + setting_name, true );

			// Save in user settings, for next session
			wp.ajax.post( {
				action: 'mkl_pc_hide_addon_setting',
				setting: setting_name,
				security: PC_lang.user_preferences_nonce
			} );
		},
		toggle_iris: function ( e ) {
			const $input = $( e.target );
			const $parent = $input.closest( '.wp-picker-container' );
			const $button = $parent.find( 'button.wp-color-result' );

			if ( ! $parent.is( '.wp-picker-active' ) ) {
				$button.trigger( 'click' );
			}
		},
		update_lock_state: function() {
			if ( ! this.$el || ! this.$el.length ) return;
			
			// Local layers are always editable. Only global layers respect lock/edit mode.
			var is_editing = true;
			if ( this.layer && this.layer.get( 'is_global' ) && this.layer.get( 'global_id' ) ) {
				var global_id = this.layer.get( 'global_id' );
				is_editing = PC.app.get_global_layers() ? PC.app.get_global_layers().is_editing_choices( global_id ) : false;
			}
			
			// Disable inputs when locked (locked = not editing)
			var inputs = this.$( '.setting input, .setting textarea, .setting select, .setting [type="checkbox"], .setting [type="radio"], .setting button' );
			inputs.prop( 'disabled', ! is_editing );
		}
	});

	
	/**
	 * Pictures
	 */
	PC.views.choice_picture = Backbone.View.extend({
		template: wp.template('mkl-pc-content-choice-pictures'),
		className: 'view',
		collectionName: 'content',
		initialize: function( options ) {
			this.options = options || {};
			if ( this.model ) this.listenTo(this.model, 'change', this.has_changed);
		},
		events: {
			'click .edit-attachment': 'edit_attachment',
			'click .remove-attachment': 'remove_attachment',
			'select-media': 'select_attachment',

		},
		has_changed: function() {
			PC.app.is_modified[this.collectionName] = true;
			if ( this.model && this.model.get( 'layerId' ) ) {
				PC.app.modified_content_layer_ids = PC.app.modified_content_layer_ids || {};
				PC.app.modified_content_layer_ids[ this.model.get( 'layerId' ) ] = true;
			}
			if ( PC.app.syncSidebarSaveButtonState ) {
				PC.app.syncSidebarSaveButtonState();
			}
		},
		edit_attachment: function(e) {
			e.preventDefault();
			this.editing = $(e.currentTarget).closest( '.picture' ).data( 'edit' ); 
			var media_options = {};
			media_options.el = this.$el;
			if( this.model && this.model.get( this.editing ).id )
				media_options.selection = this.model.get( this.editing ).id;

			PC.media.open( media_options ); 
		},

		select_attachment: function(e, attachment) {
			if( !this.editing ) return false;
			// If no model exists yet, create it now and add to collection
			if ( !this.model ) {
				this.model = new PC.choice_picture({
					angleId: this.options.angle.id,
				});
				this.options.choice.get('images').add(this.model);

				// Listen for changes now that it's created
				this.listenTo( this.model, 'change', this.has_changed );
			}
			this.model.set(this.editing, {
				url: attachment.get('url'),
				id: attachment.id,
				dimensions: {
					height: attachment.get( 'height' ), 
					width: attachment.get( 'width' ),
				}
			});

			if ( 'thumbnail' == this.editing && !this.options.angle.get( 'has_thumbnails' ) ) {
				this.options.angle.collection.invoke( 'set', { has_thumbnails: false } );
				this.options.angle.set( 'has_thumbnails', true );
			}
			
			this.render();
		},	
		remove_attachment: function( e ) {
			var editing = $( e.currentTarget ).closest( '.picture' ).data( 'edit' );
			this.model.set( editing, {
				url: '',
				id: null,
				dimensions: {
					height: 0,
					width: 0,
				}
			});
			this.render();
		},
		render: function() {
			this.$el.empty();

			var data = _.defaults({}, this.model ? this.model.attributes : { image: { url: '' }, thumbnail: { url: '' }});
			data.is_group = this.options.choice.get( 'is_group' );
			data.angle_name = this.options.angle.get('name');
			data.angle = this.options.angle.toJSON();
			this.$el.append( this.template( data ) );
			return this;
		},
	});

	// PC.views.choice_pictures = Backbone.View.extend({
	// 	initialize: function() {
	// 		this.admin = PC.app.get_admin(); 
	// 		this.angles = this.admin.angles; 
	// 	},
	// 	events: {
	// 		'click .edit-attachment': 'edit_attachment',
	// 		'select-media': 'select_attachment',

	// 	},
	// 	render: function() {

	// 	},
	// 	edit_attachment: function(e) {
	// 		e.preventDefault();

	// 		PC.media.open( this.$el );

	// 	},

	// 	select_attachment: function(e, attachment) {			
	// 		this.model.set('image', {
	// 			url: attachment.get('url'),
	// 			id: attachment.id
	// 		});
			
	// 		this.render();
	// 	},	
	// });





})(jQuery, PC._us || window._);