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
				this.content.add( { layerId: this.model.id, choices: new PC.choices([], { layer: PC.app.get_product( this.model.id ) } ) } );
				this.col = this.content.get( this.model.id );
			}
			this.state = this.options.state; 
			this.render(); 
		},

		events: {
			'click .active-layer': 'hide_choices',
			'click .add-layer': 'create',
			'keypress .structure-toolbar input': 'create',
			'update-sort': 'update_sort',
		},

		remove_item: function( item ) {
			item.remove();
		},

		render: function() {
			this.$el.empty();
			this.$el.html( this.template({ input_placeholder: PC.lang.choice_new_placeholder }) );

			this.$active_layer = this.$('.active-layer');
			var al_button = wp.template('mkl-pc-content-layer-back-link');
			this.$active_layer.html( al_button( this.model.attributes ) );
			this.$new_input = this.$('.structure-toolbar input'); 
			this.$list = this.$('.choices'); 
			this.$form = this.state.$('.choice-details'); 
			this.add_all( this.col ); 
			this.listenTo( this.col, 'add', this.add_one);
			this.listenTo( this.col, 'add', this.mark_collection_as_modified);
			this.listenTo( this.col, 'remove', this.remove_one);
			this.listenTo( this.col, 'change', this.choices_changed);
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
			this.$list.append( new_choice.render().el );
		},

		remove_one: function( model ) {
			this.mark_collection_as_modified();
			// var new_choice = new PC.views.choice({ model: model, state: this.state, collection: this.col, form_target: this.$form });
			// this.items.push( new_choice );
			// this.$list.append( new_choice.render().el );
		},

		add_all: function( collection ){
			// this.$list.empty();

			collection.each( this.add_one, this );
			// .ui-sortable-handle 
			var that = this;
			if ( ! this.$list.sortable( 'instance' ) ) {
				this.$list.sortable({
					containment:          'parent',
					items:                '.mkl-list-item',
					placeholder:          'mkl-list-item__placeholder',
					tolerance:            'pointer',
					cursor:               'move',
					axis:                 'y',
					handle:               '.sort',
					scrollSensitivity:    40,
					forcePlaceholderSize: true,
					helper:               'clone',
					opacity:              0.65,
					stop: 				  function(event, s) {
						s.item.trigger( 'drop', s.item.index() );
					}
				});
			} else {
				this.$list.sortable( 'refresh' );
			}
		},

		update_sort: function( event, changed_model, position ) {

			// this.col.remove(changed_model);

			this.col.each(function (model, index) {
				var ordinal = index; 
				if (index >= position) { 
					ordinal += 1;
				}

				model.set('order', ordinal); 
	        });
			changed_model.set('order', position);
			
			// this.col.add( changed_model, { at: position } );
			this.col.sort( { silent: true } );
			if ( this.$list.sortable( 'instance' ) ) this.$list.sortable( 'refresh' );
			// this.render();
			// this.add_all( this.col );
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
			if( event.type == 'keypress' ) {
				if ( event.which !== 13 ) {
					return;
				}
			}
			if( !this.$new_input.val().trim() ) {
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
		template: wp.template('mkl-pc-content-choice-list-item'),
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
		},
		events: {
			// 'click' : 'edit',
			'click .delete-layer': 'delete_choice',
			'click .confirm-delete-layer': 'delete_choice',
			'click .cancel-delete-layer': 'delete_choice',
			// instant update of the inputs
			'keyup .setting input': 'form_change',
			'keyup .setting textarea': 'form_change',
			'change .setting input': 'form_changed',
			'change .setting textarea': 'form_changed',
			'change .setting select': 'form_changed',

			'click [type="checkbox"]': 'form_change',

		},
		render: function() {
			this.$el.html( this.template( this.model.attributes ) );
			this.$pictures = this.$('.views');

			this.angles.each(this.add_angle, this);

			this.delete_btns = {
				prompt: this.$('.delete-layer'),
				confirm: this.$('.prompt-delete'),
			};
			return this;
		},
		form_change: function( event ) {

			var input = $(event.currentTarget);
			var setting = input.data('setting');
			
			if( event.type == 'click' ) {
				// checkbox
				var new_val = input.prop('checked'); 
			} else {
				// text + textarea
				var new_val = input.val().trim();
				
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