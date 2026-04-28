var PC = PC || {};
PC.views = PC.views || {};

(function($, _){

	PC.views.content = Backbone.View.extend({
		tagName: 'div',
		className: 'state content-state',
		template: wp.template( 'mkl-pc-content' ),
		events: {
			// 'save-state': 'save_content',
		},
		collectionName: 'content',
		initialize: function( options ) {
			this.options = options || {};
			this.main_view = this.options.main_view;
			this.admin = PC.app.get_admin();
			this.product = PC.app.get_product();

			PC.selection.reset();

			if( !this.product.get('content') ) {
				this.product.set('content', new PC.content_list() );
			}

			this.col = this.product.get('content');

			this.render();
		},
		remove: function() {
			if ( this.main_view && this.main_view.$el && this.main_view.$el.length ) {
				this.main_view.$el.removeClass( 'mkl-pc-admin-ui--content-mode' );
				this.main_view.$( '.mkl-pc-admin-ui__sidebar-layers-list' ).empty();
				this.main_view.$( '.mkl-pc-admin-ui__sidebar-layers' ).attr( 'hidden', 'hidden' ).attr( 'aria-hidden', 'true' );
			}
			return Backbone.View.prototype.remove.call( this );
		},
		render: function() {
			if( !this.admin.layers || !this.admin.angles || this.admin.layers.length < 1 || this.admin.angles.length < 1) {
				var content = wp.template('mkl-pc-content-no-data');
				this.$el.append( content() );
			} else {
				if ( this.main_view && this.main_view.$el && this.main_view.$el.length ) {
					this.main_view.$el.addClass( 'mkl-pc-admin-ui--content-mode' );
					this.$list = this.main_view.$( '.mkl-pc-admin-ui__sidebar-layers-list' );
					this.main_view.$( '.mkl-pc-admin-ui__sidebar-layers' ).removeAttr( 'hidden' ).attr( 'aria-hidden', 'false' );
				} else {
					this.$list = $();
				}
				this.$el.append( this.template() );
				this.$choices = this.$('.content-choices-list');
				this.$form = this.$('.content-choice');
				if ( this.$list && this.$list.length ) {
					this.layers = new PC.views.content_layers( { list_el: this.$list, edit_el: this.$form, state: this } );
					this.$list.append( this.layers.el );
					var self = this;
					window.requestAnimationFrame( function() {
						self.focusSidebarLayerButton();
					} );
				}
			}
		},
		/** Move keyboard focus into the sidebar layer list (opened layer row, otherwise first layer). */
		focusSidebarLayerButton: function() {
			if ( ! this.$list || ! this.$list.length ) return;
			var $btn = this.$list.find( 'li.active button.layer' );
			if ( ! $btn.length ) {
				$btn = this.$list.find( 'button.layer' ).first();
			}
			if ( $btn.length ) {
				$btn.trigger( 'focus' );
			}
		},
		get_col: function() {
			return this.col;
		},

		
	});

	PC.views.content_layers = Backbone.View.extend({

		tagName: 'ul',
		className: 'layers',
		initialize: function( options ) {
			this.options = options || {}; 
			this.product = PC.app.get_product(); 
			
			this.render(); 
			return this; 
		},
		render: function() {
			this.$el.empty(); 
			PC.app.admin.layers.each( this.add_one, this ); 
		},

		add_one: function( model ) {
			if ( 'group' == model.get( 'type' ) || 'summary' == model.get( 'type' ) ) return;

			var options = _.defaults( this.options );
			var content = this.product.get('content');
			options.model = model;
			var layer = new PC.views.content_layer( options );
			this.$el.append( layer.el );
		}
	});

	PC.views.content_layer = Backbone.View.extend({
		tagName: 'li',
		template: wp.template('mkl-pc-content-layer'),
		events: {
			'click button.layer' : 'toggleLayer',
		}, 
		initialize: function( options ) {
			this.options = options || {}; 
			if ( !this.options.state )
				return false;

			this.product = PC.app.get_product(); 
			this.state = this.options.state;
			// get previously saved choices
			var product_choices = this.product.get('content'); 

			if ( ! product_choices.get( this.model.id ) ) {
				// product_choices.add({layerId: this.model.id, choices: new PC.choices( [], { layer: PC.app.get_product( this.model.id ) } ) });
				product_choices.add({layerId: this.model.id, choices: new PC.choices( [], { layer: PC.app.admin.layers.get( this.model.id ) } ) });
			}

			this.choices = product_choices.get( this.model.id ).get( 'choices' );
			this.listenTo( this.choices, 'add', this.udpate_number );
			this.listenTo( this.choices, 'remove', this.udpate_number );
			this.render();
		},
		render: function() {
			var n_choices = this.choices.length;
			var data = _.defaults(this.model.attributes);
			data.choices_number = n_choices;
			this.$el.empty();
			this.$el.append( this.template( data ) );
			if ( this.model.get( 'active' ) ) {
				this.$( 'button.layer' ).trigger( 'click' );
			}
		},
		udpate_number: function() {
			this.$( '.number-of-choices' ).text( this.choices.length );
		},
		toggleLayer: function(e) {
			e.preventDefault();
			if ( this.state.layers && this.state.layers.$el ) {
				this.state.layers.$el.children( 'li' ).removeClass( 'active' );
				this.state.layers.$el.find( 'button.layer' ).attr( 'aria-pressed', 'false' );
			}
			// Remove existing active layer
			if ( this.state.active_layer ) this.state.active_layer.remove();
			// Reset the selection collection, to prevent cross-layer issues
			PC.selection.reset();
			// Setup the new view
			this.state.active_layer = new PC.views.choices({ model: this.model, state: this.state });
			this.state.$choices.append( this.state.active_layer.$el );
			this.state.$el.addClass('show-choices');
			this.$el.addClass( 'active' );
			this.$( 'button.layer' ).attr( 'aria-pressed', 'true' );
		}
	});



})(jQuery, PC._us || window._ );