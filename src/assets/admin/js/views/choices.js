var PC = PC || {};
PC.views = PC.views || {};

(function($){
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
			this.listenTo( this.col, 'add', this.add_one);
			this.listenTo( this.col, 'add', this.mark_collection_as_modified);
			this.listenTo( this.col, 'remove', this.remove_one);
			this.listenTo( this.col, 'change', this.choices_changed);
			this.listenTo( this.col, 'change:is_group', this.render);
			this.render(); 
		},

		events: {
			'click .active-layer': 'hide_choices',
			'click .add-layer': 'create',
			'keypress .structure-toolbar input': 'create',
		},

		remove_item: function( item ) {
			item.remove();
		},

		render: function() {
			this.$el.empty();
			this.$el.html( this.template( this.model.attributes ) );

			this.$active_layer = this.$('.active-layer');
			var al_button = wp.template('mkl-pc-content-layer-back-link');
			this.$active_layer.html( al_button( this.model.attributes ) );
			this.$new_input = this.$('.structure-toolbar input'); 
			this.$list = this.$('.choices');
			this.$form = this.state.$('.choice-details'); 
			this.add_all( this.col );
			this.setup_sortable();
			return this;
		},

		choices_changed: function(e,f) {
			if ( 1 === _.keys( e.changed ).length && e.changed.hasOwnProperty( 'active' ) ) return;
			PC.app.is_modified[this.collectionName] = true;
		},

		mark_collection_as_modified: function() {
			PC.app.is_modified[this.collectionName] = true;
		},

		add_one: function( model ) {
			var new_choice = new PC.views.choice({ model: model, state: this.state, collection: this.col, form_target: this.$form });
			this.items.push( new_choice );
			if ( model.get( 'parent' ) ) {
				var target = this.$( '.choices[data-item-id=' + model.get( 'parent' ) + ']');
				if ( target.length ) {
					target.append( new_choice.render().el );
				} else {
					this.$list.append( new_choice.render().el );
				}
			} else {
				this.$list.append( new_choice.render().el );
			}
		},

		remove_one: function( model ) {
			this.mark_collection_as_modified();
			// var new_choice = new PC.views.choice({ model: model, state: this.state, collection: this.col, form_target: this.$form });
			// this.items.push( new_choice );
			// this.$list.append( new_choice.render().el );
		},

		add_all: function( collection ){
			collection.each( this.add_one, this );
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
				$( listItem ).trigger( 'sort', [i, parent] );
			} );

			this.col.sort( { silent: true } );
			if ( this.$list.sortable( 'instance' ) ) this.$list.sortable( 'refresh' );
		},

		hide_choices: function( e ) {
			e.preventDefault();
			this.state.$el.removeClass( 'show-choices' );

			_.each( this.items, this.remove_item );
			this.items = [];

			this.$el.empty();
			this.$form.empty();
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
			this.col.add( this.new_attributes( this.$new_input.val().trim() ) ); 
			

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
	});

	PC.views.choice = PC.views.layer.extend( {
		edit_view: function(){ return PC.views.choiceDetails; },
		events: {
			'click > button' : 'edit',
			'drop': 'drop',
			'sort': 'sort',
		},
		template: wp.template('mkl-pc-content-choice-list-item'),
		sort: function( event, index, parent ) {
			if ( parent && this.model.get( 'is_group' ) ) return;
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

	PC.views.choiceDetails = Backbone.View.extend({ 
		tagName: 'div', 
		className: 'choice-form', 
		template: wp.template('mkl-pc-content-choice-form'),
		collectionName: 'content',
		initialize: function( options ) {
			this.admin = PC.app.get_admin(); 
			this.angles = this.admin.angles; 

			this.listenTo(this.model, 'destroy', this.remove);
			this.listenTo(this.model, 'change:is_group', this.render);

			wp.hooks.doAction( 'PC.admin.choiceDetails.init', this );
		},
		events: {
			// 'click' : 'edit',
			'click .delete-layer': 'delete_choice',
			'click .confirm-delete-layer': 'delete_choice',
			'click .cancel-delete-layer': 'delete_choice',
			// instant update of the inputs
			'keyup .setting input': 'form_change',
			'keyup .setting textarea': 'form_change',
			'change .setting select': 'form_change',
			'click [type="checkbox"]': 'form_change',
			'click .mkl-pc--action': 'trigger_custom_action',
		},
		render: function() {
			var args,
			    layer = PC.app.admin.layers.get( this.model.get( 'layerId' ) );

			if ( layer ) {
				args = { 
					not_a_choice: layer.get( 'not_a_choice' ),
					layer_type: layer.get( 'type' ),
				};
			} else {
				args = {};
			}
			this.$el.html( this.template( _.defaults( args, this.model.attributes ) ) );
			this.$pictures = this.$('.views');

			if ( this.model.get( 'is_group' ) )  {
				this.add_angle( this.angles.first() );
			} else {
				this.angles.each(this.add_angle, this);
			}

			this.delete_btns = {
				prompt: this.$('.delete-layer'),
				confirm: this.$('.prompt-delete'),
			};

			this.populate_angles_list();

			wp.hooks.doAction( 'PC.admin.choiceDetails.render', this );

			return this;
		},
		form_change: function( event ) {

			var input = $(event.currentTarget);
			var setting = input.data('setting');
			
			if( event.type == 'click' ) {
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
			// data.
			var part = new PC.views.choice_picture(data);

			this.$pictures.append( part.render().el );
		},
		trigger_custom_action: function( event ) {
			var el = $(event.currentTarget);
			var action = el.data( 'action' );
			if ( action in PC.actions ) {
				PC.actions[action](el, this);
			}
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

			var data = _.defaults(this.model.attributes);
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





})(jQuery);