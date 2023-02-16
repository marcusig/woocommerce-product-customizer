var PC = PC || {};
PC.views = PC.views || {};
( function( _ ) {
	PC.views.states = Backbone.View.extend({
		items: [],
		template: wp.template('mkl-pc-menu'),
		initialize: function( params ) {
			this.app = params.parent;
			this.render();
		},
		render: function() {
			this.$el.append( this.template() );
			if ( this.app.states.length ) {
				this.$menu = this.$('.media-menu').html('');
				this.create_menu();
			}
			return this;
		},
		reset_active: function(){

		},
		create_menu: function(  ) {
			var that = this;
			that.items = [];
			this.app.states.orderBy = 'order';
			this.app.states.sort();
			this.app.states.each(function(model, index) {
				var line = '';
				switch(model.get('type')) {
					case 'part': 
						line = new PC.views.menu_item( { model:model, collection: that.app.states, app: that.app, main_view:that } );
						break;
					case 'separator': 
						line = new PC.views.separator();
						break;
				}

				that.items[index] = line;
				that.$menu.append( line.$el );
			});

			var start_item = 0;
			that.items[start_item].$el.trigger('click'); 
		}
	});

	PC.views.menu_item = Backbone.View.extend({
		tagName: 'a',
		className: 'media-menu-item',
		initialize: function(options) {
			this.options = options || {};

			if( this.options.collection ) this.collection = this.options.collection;
			this.render();

			this.listenTo( this.model, 'change:active', this.activate ); 
		},
		events: {
			'click': 'show_this_state'
		},

		activate: function(){
			if(this.model.get('active') === true) {
				this.$el.addClass('active');
			} else {
				this.$el.removeClass('active');
				if( this.state ) this.state.remove();
			}
		},

		show_this_state: function(event){ 
			event.preventDefault();
			// Checks if selected item is not active.
			if(this.model.get('active') === false) {

				this.collection.each(function(model) {
					model.set('active', false);
				});
				if( this.state ) this.state.remove(); 
				this.state = new PC.views.state({model: this.model, options: this.options});
				this.options.main_view.$el.append( this.state.$el );
				this.options.main_view.$menu.removeClass( 'visible' );
			}

		},
		render: function() {
			this.$el.attr('href', '#'); 
			this.$el.html( this.model.get('label') );
			return this;
		}
	});

	PC.views.state = Backbone.View.extend({
		tagName: 'div',
		className: 'modal-frame-target',
		events: {
			'click .pc-main-save': 'save_state', 
			'click .pc-main-save-all': 'save_all', 
			'click .pc-main-cancel': 'cancel', 
			'click .media-frame-menu-toggle': 'show_mobile_menu',
		},
		initialize: function( args ){

			this.options = args.options || {};

			if ( State = PC.views[this.model.get( 'menu_id' )] ) {
				// modal-frame-target //mkl-pc-frame-title
				// Defines which is the target for the main frame .modal-frame-target
				if( this.state ) this.state.remove();
				// this.$el = this.options.app.$('.modal-frame-target');
				// Empties the target
				this.$el.empty(); 
				// Get the Frame's title Template (contains Title + description)
				this.title_template = wp.template('mkl-pc-frame-title'); 
				// Get the Toolbar's template (Bottom toolbar)
				this.toolbar_template = wp.template('mkl-pc-toolbar'); 

				// Instantiates the main view for the current state
				this.state = new State( { app: this.options.app } ); 

				PC.app.state = this.state;

				this.collectionName = this.state.collectionName;
				this.col = this.state.col;
				
				this.model.set('active', true);
				this.render();

				return this;
			} else {
				throw ('There is no View called ' + 'PC.views.' + this.model.get('menu_id') );
			}

		} ,
		render: function() {
			this.$el.append( this.title_template(this.model.attributes) ); 
			this.$el.append( this.state.$el );
			this.$el.append( this.toolbar_template(this.model.attributes) );

			this.state.$toolbar = this.$toolbar = this.$('.media-frame-toolbar');

			this.menu = this.model.get('menu');

			if( this.menu && this.menu.length > 1 ) {
				var menu_target = new PC.views.button_group();
				this.$('.media-toolbar-primary').append( menu_target.render().el ); 
				_.each( this.menu, function( menu_item, ind ) {
					var button = new PC.views.button( menu_item );
					menu_target.$el.append( button.render().el );
				});

			}

			this.state.$save_button = this.$save_button = this.$('.pc-main-save');
			this.state.$save_all_button = this.$save_all_button = this.$('.pc-main-save-all');

			return this;
		},

		save_state: function( event ) {
			if ( PC.app.is_modified[this.collectionName] != true ) {
				return false;
			}



			this.$save_button.addClass('disabled');
			this.$save_all_button.addClass('disabled');
			this.$toolbar.addClass('saving'); 

			PC.app.save( this.collectionName, this.col, {
				// success: 'successfuil'
				success: _.bind(this.state_saved, this),
				error: _.bind(this.error_saving, this),
			} );
			// this.layers.save();
		},

		state_saved: function( has_errors ) { 
			// when the layers are succesfully saved,
			this.$save_button.removeClass('disabled'); 
			this.$save_all_button.removeClass('disabled'); 
			this.$toolbar.removeClass('saving'); 
			this.$el.removeClass('saving'); 
			this.$toolbar.addClass('saved'); 
			this.$el.addClass('saved'); 
			var that = this;
			// show "saved" for 2.5s
			_.delay(function() {
				that.$toolbar.removeClass('saved'); 
				that.$el.removeClass('saved'); 
			}, 2500);
			// reset 'modified'
			if ( ! has_errors ) PC.app.is_modified[this.collectionName] = false;
		},
		error_saving: function(r, s) {
			this.$save_button.removeClass('disabled'); 
			this.$save_all_button.removeClass('disabled'); 
			this.$toolbar.removeClass('saving'); 
			alert(r);
		},
		save_all: function() {
			PC.app.save_all( this );
		},

		cancel: function() {
			PC.app.get_admin().close();
		},
		show_mobile_menu: function( e ) {
			console.log(this, this.options);
			this.options.main_view.$menu.toggleClass('visible');
		}
		// save_state: function() {
		// 	this.state.$el.trigger('save-state');
		// } 
	});

	PC.views.separator = Backbone.View.extend({
		tagName: 'div',
		className: 'separator',
		initialize: function() {
			this.render();
		},
		render: function() {
			return this;
		}
	})

	PC.views.button_group = Backbone.View.extend({
		className: 'button-group media-button-group',
		render: function() {
			return this;
		}
	});

	PC.views.button = Backbone.View.extend({
		tagName: 'button',
		className: 'button media-button button-large',
		initialize: function( options ) {
			this.options = _.defaults( options, { text: ' - ', class:'' } );

			this.render();
		},
		render: function() {
			this.$el.attr('type', 'button');
			this.$el.html( this.options.text );
			this.$el.addClass( this.options.class );
			return this;
		},

	});

	// PC.view.title = Backbone.View.extend({
	// 	template: 'mkl-pc-frame-title'
	// });
} ( PC._us || window._ ) );