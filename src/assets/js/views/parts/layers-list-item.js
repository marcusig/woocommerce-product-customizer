/*
	PC.fe.views.layer 
*/
PC.fe.views.layers_list_item = Backbone.View.extend({
	tagName: 'li',
	className: 'layers-list-item',
	template: wp.template( 'mkl-pc-configurator-layer-item' ),
	initialize: function( options ) {
		this.options = options || {};
		this.layer_type = this.model.get( 'type' );
		this.listenTo( this.options.model, 'change:active', this.activate );
		this.listenTo( this.options.model, 'change:hide_in_configurator', this.hide_in_configurator );
		wp.hooks.doAction( 'PC.fe.layers_list_item.init', this );
	},

	events: {
		'click > button.layer-item': 'show_choices', 
	},

	render: function() {

		if ( this.model.get( 'not_a_choice' ) && this.model.get( 'custom_html' ) ) {
			this.$el.addClass( 'not-a-choice custom' );
			this.$el.append( $( this.model.get( 'custom_html' ) ) );
			if ( this.model.get( 'class_name' ) ) this.$el.addClass( this.model.get( 'class_name' ) );
			wp.hooks.doAction( 'PC.fe.layer.render', this );
			wp.hooks.doAction( 'PC.fe.html_layer.render', this );
			return this.$el;
		}

		var data = this.model.attributes;
		var layer_image = this.model.get( 'image' );

		this.$el.append( this.template( wp.hooks.applyFilters( 'PC.fe.configurator.layer_data', data ) ) ); 

		if ( PC.fe.config.show_active_choice_in_layer && ! this.model.get( 'is_step' ) ) {
			var selection = new PC.fe.views.layers_list_item_selection( { model: this.options.model } );
			this.$( '.layer-item .layer-name' ).after( selection.$el );
		}

		// Add classes
		if ( this.model.get( 'class_name' ) ) this.$el.addClass( this.model.get( 'class_name' ) );
		if ( this.model.get( 'display_mode' ) ) this.$el.addClass( 'display-mode-' + this.model.get( 'display_mode' ) );
		if ( this.layer_type ) this.$el.addClass( 'type-' + this.layer_type );
		if ( this.model.get( 'is_step' ) ) this.$el.addClass( 'type-step' );
		if ( layer_image && layer_image.url ) this.$el.addClass( 'has-thumbnail' );

		if ( PC.fe.config.show_active_choice_image_in_layer && ! this.model.get( 'is_step' ) ) {
			var selection = new PC.fe.views.layers_list_item_selection_image( { model: this.options.model, parent: this } );
			this.$( '.layer-item' ).prepend( selection.$el );
		}

		this.hide_in_configurator( this.model, this.model.get( 'hide_in_configurator' ) );

		// Add ID
		if ( this.model.get( 'html_id' ) ) this.el.id = this.model.get( 'html_id' );

		if ( 'dropdown' == this.model.get( 'display_mode' ) && this.model.get( 'class_name' ) && -1 !== this.model.get( 'class_name' ).search( 'dropdown-move-label-outside' ) ) {
			this.$( '.layer-name' ).prependTo( this.$el );
		}

		wp.hooks.doAction( 'PC.fe.layer.beforeRenderChoices', this );
		// Add the choices
		this.add_choices(); 
		wp.hooks.doAction( 'PC.fe.layer.render', this );
		
		// Add display-mode class to the choices element
		if ( this.choices && this.choices.$el && this.model.get( 'display_mode' ) ) this.choices.$el.addClass( 'display-mode-' + this.model.get( 'display_mode' ) );
		return this.$el;
	},
	add_choices: function() {

		if ( ! this.layer_type || 'simple' == this.layer_type || 'group' == this.layer_type ) {
			this.choices = new PC.fe.views.choices({ content: PC.fe.getLayerContent( this.model.id ), model: this.model }); 
		}

		if ( ! this.choices ) {
			console.log( 'Product Configurator: No choice view was rendered.' );
			return;
		}

		var where = PC.fe.config.where;
		if ( this.model.get( 'parent' ) ) {
			var parent = this.model.collection.get( this.model.get( 'parent' ) );
			if ( parent && 'group' === parent.get( 'type' ) && ! parent.get( 'is_step' ) ) {
				where = 'in';
			}
		}

		if ( this.model.get( 'is_step' ) ) {
			where = 'in';
		}

		where = wp.hooks.applyFilters( 'PC.fe.choices.where', where, this );
		if( ! where || 'out' == where ) {
			this.options.parent.after( this.choices.$el );
		} else if( 'in' == where ) {
			this.$el.append( this.choices.$el ); 
		} else if ( $( where ).length ) {
			this.choices.$el.appendTo( $( where ) )
		}
		wp.hooks.doAction( 'PC.fe.add.choices', this.choices.$el, this );
	},
	show_choices: function( event ) {
		if ( event ) {
			// Allow clicking on link tags
			if ( event.target.tagName && 'A' == event.target.tagName || $( event.target ).closest( 'a' ).length ) {
				return;
			}
			event.stopPropagation();
			event.preventDefault();
		}

		if ( this.model.get( 'active' ) == true ) {
			wp.hooks.doAction( 'PC.fe.layer.hide', this );
			if ( wp.hooks.applyFilters( 'PC.fe.layer.self_hide', true, this ) ) {
				this.model.set('active', false);
			}
		} else {
			if ( ! this.model.get( 'parent' ) || ( this.model.get( 'parent' ) && this.model.collection.get( this.model.get( 'parent' ) ) && 'group' !== this.model.collection.get( this.model.get( 'parent' ) ).get( 'type' ) ) ) {
				this.model.collection.each( function( model ) {
					model.set( 'active' , false );
				});
			} else {
				var parent = this.model.collection.get( this.model.get( 'parent' ) );
				if ( PC_config.config.auto_close_siblings_in_groups || parent.get( 'is_step' ) ) {
					// Toggle any siblings
					_.each( this.model.collection.where( { 'parent': this.model.get( 'parent' ) } ), function( model ) {
						model.set( 'active' , false );
					} );
						
				}
				// Toggle any dropdowns
				_.each( this.model.collection.where( { 'display_mode': 'dropdown' } ), function( model ) {
					model.set( 'active' , false );
				} );

			}

			if ( event && 'dropdown' === this.model.get( 'display_mode' ) ) {
				$( document ).on( 'click.mkl-pc', this.dropdown_click_outside.bind( this ) );
			}

			this.model.set( 'active', true ); 
			PC.fe.current_layer = this.model;
			wp.hooks.doAction( 'PC.fe.layer.show', this );
		}
	},
	dropdown_click_outside: function( event ) {
		if ( ! $( event.target ).closest( '.display-mode-dropdown.active' ).length && this.model.get( 'active' ) ) {
			this.show_choices();
		}
	},
	activate: function() {
		if ( this.model.get( 'active' ) ) {
			this.$el.addClass( 'active' ); 
			if ( this.choices ) this.choices.$el.addClass( 'active' );
			wp.hooks.doAction( 'PC.fe.layer.activate', this );
		} else {
			this.$el.removeClass( 'active' );
			if ( this.choices ) this.choices.$el.removeClass( 'active' );
			$( document ).off( 'click.mkl-pc' );
			wp.hooks.doAction( 'PC.fe.layer.deactivate', this );
		}
	},
	hide_in_configurator: function( model, should_hide ) {
		this.$el.toggleClass( 'hide_in_configurator', !! should_hide );
	},
} );
