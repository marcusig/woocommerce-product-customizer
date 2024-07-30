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

			this.render(); 
		},
		events: {
			'click .active-layer': 'hide_choices',
			'click .add-layer': 'create',
			'keypress .structure-toolbar input': 'create',
			'remove': 'cleanup_on_remove', 
		},
		remove_item: function( item ) {
			item.remove();
		},
		cleanup_on_remove: function() {
			this.remove_views();	
		},
		duplicated_item: function() {
			this.render();
			this.update_sorting();
		},
		render: function() {
			this.$el.empty();
			this.$el.html( this.template( this.model.attributes ) );
			this.remove_views();

			this.$active_layer = this.$('.active-layer');
			var al_button = wp.template('mkl-pc-content-layer-back-link');
			this.$active_layer.html( al_button( this.model.attributes ) );
			this.$new_input = this.$('.structure-toolbar input'); 
			this.$list = this.$('.choices');
			this.$form = this.state.$('.choice-details'); 
			this.add_all();
			this.update_groups();
			this.setup_sortable();
			return this;
		},

		choices_changed: function(e,f) {
			if ( 1 === _.keys( e.changed ).length && e.changed.hasOwnProperty( 'active' ) ) return;
			// console.log( e );
			if ( -1 == PC.app.modified_choices.indexOf( e.get( 'layerId' ) + '_' + e.id ) ) {
				PC.app.modified_choices.push( e.get( 'layerId' ) + '_' + e.id );
			}
			PC.app.is_modified[this.collectionName] = true;
		},

		mark_collection_as_modified: function() {
			PC.app.is_modified[this.collectionName] = true;
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
		},

		hide_choices: function( e ) {
			e.preventDefault();
			this.state.$el.removeClass( 'show-choices' );
			this.remove_views();
			this.$el.empty();
			this.$form.empty();
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
		},

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
		}		
	});

	PC.views.choiceLabel = Backbone.View.extend( {
		tagName: 'span',
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
			'click > button' : 'edit',
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
				this.$( 'h3' ).append( this.label.$el );
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
			this.listenTo( this.model, 'destroy', this.remove );
			this.listenTo( this.model, wp.hooks.applyFilters( 'PC.admin.choice_form.render.on.change.events', 'change:is_group' ), this.render );
			PC.currentEditedItem = this.model;
			wp.hooks.doAction( 'PC.admin.choiceDetails.init', this );
		},
		events: {
			// 'click' : 'edit',
			'click .delete-item': 'delete_choice',
			'click .confirm-delete': 'delete_choice',
			'click .cancel-delete': 'delete_choice',
			'click .duplicate-item': 'duplicate_choice',
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

			// Hide empty groups
			this.$( '.section-fields:empty' ).closest( '.setting-section' ).hide();
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
		add_angle: function( angle ) {
			// this.model
			var data = {
				angle: angle,
				choice: this.model,
			};
			
			if( !this.model.get('images') )
				this.model.set('images', new PC.choice_pictures() );
				
			var images = this.model.get('images');
			if( !images.get(angle.id) ){
				images.add({
					angleId: angle.id,
				});
			} 

			data.model = images.get(angle.id);
			var angle_view = new PC.views.choice_picture(data);

			this.$pictures.append( angle_view.render().el );

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
			this.listenTo(this.model, 'change', this.has_changed);
		},
		events: {
			'click .edit-attachment': 'edit_attachment',
			'click .remove-attachment': 'remove_attachment',
			'select-media': 'select_attachment',

		},
		has_changed: function() {
			PC.app.is_modified[this.collectionName] = true;
		},
		edit_attachment: function(e) {
			e.preventDefault();
			this.editing = $(e.currentTarget).closest( '.picture' ).data( 'edit' ); 
			var media_options = {};
			media_options.el = this.$el;
			if( this.model.get( this.editing ).id )
				media_options.selection = this.model.get( this.editing ).id;

			PC.media.open( media_options ); 
		},

		select_attachment: function(e, attachment) {
			if( !this.editing )
				return false;
			this.model.set(this.editing, {
				url: attachment.get('url'),
				id: attachment.id,
				dimensions: {
					height: attachment.get( 'height' ), 
					width: attachment.get( 'width' ),
				}
			});
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

			var data = _.defaults( {}, this.model.attributes);
			data.is_group = this.options.choice.get( 'is_group' );
			data.angle_name = this.options.angle.get('name');
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