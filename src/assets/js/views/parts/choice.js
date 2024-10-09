/*
	PC.fe.views.choice
	View for a single choice in the side-bar
*/
PC.fe.views.choice = Backbone.View.extend({
	tagName: 'li',
	className: 'choice',
	template: wp.template( 'mkl-pc-configurator-choice-item' ),
	update_tippy_on_price_update: false,
	initialize: function( options ) {
		this.options = options || {};
		this.listenTo( this.model, 'change:active', this.activate );
		wp.hooks.doAction( 'PC.fe.choice.init', this );
		wp.hooks.addAction( 'PC.fe.extra_price.after.get_tax_rates', 'mkl/pc', this.on_price_update.bind( this ) );
		wp.hooks.addAction( 'PC.fe.extra_price.after.update_price', 'mkl/pc', this.on_price_update.bind( this ) );
	},
	events: {
		'mousedown > .choice-item': 'set_choice',
		'keydown > .choice-item': 'set_choice',
		'mouseenter > .choice-item': 'preload_image',
		'focus > .choice-item': 'preload_image',
		'click > button.choice-group-label': 'toggle_group',
	},
	render: function() {
		/**
		 * Called after rendering the choice item in the list
		 */
		wp.hooks.doAction( 'PC.fe.configurator.choice-item.before.render', this );
		
		var data = _.extend({
			thumbnail: this.model.get_image( 'thumbnail' ),
			disable_selection: ! this.model.get( 'available' ) && ! PC.fe.config.enable_selection_when_outofstock
		}, this.options.model.attributes );
		
		this.$el.html( this.template( wp.hooks.applyFilters( 'PC.fe.configurator.choice_data', data ) ) );

		wp.hooks.doAction( 'PC.fe.configurator.choice-item.render.after-template', this );

		if ( this.$( '.out-of-stock' ).length ) {
			this.$el.addClass( 'out-of-stock' );
		}

		if ( 'colors' == this.model.collection.layer.get( 'display_mode' ) && this.$( '.out-of-stock' ).length ) {
			if ( $( '#tmpl-mkl-pc-configurator-color-out-of-stock' ).length ) {
				this.$( '.mkl-pc-thumbnail' ).append( $( '#tmpl-mkl-pc-configurator-color-out-of-stock' ).html() );
			}
		}

		if ( window.tippy ) {
			
			var description = this.get_description();

			/**
			 * Customization of the tooltip can be done by using TippyJS options: atomiks.github.io/tippyjs/v6/
			 */
			var tooltip_options = wp.hooks.applyFilters( 'PC.fe.tooltip.options', {
				content: description,
				allowHTML: true,
				placement: 'top',
				zIndex: 100001,
				appendTo: 'parent',
			},
			this );

			tooltip_options = wp.hooks.applyFilters( 'PC.fe.choice.tooltip.options', tooltip_options, this );

			if ( tooltip_options.content && tooltip_options.content.length && this.$( '.choice-item' ).length ) {
				tippy( this.el, tooltip_options );
			}
		}

		if ( this.model.get( 'is_group' ) ) this.$el.addClass( 'is-group' );
		if ( this.model.get( 'class_name' ) ) this.$el.addClass( this.model.get( 'class_name' ) );
		if ( data.thumbnail || this.model.get( 'color' ) ) this.$el.addClass( 'has-thumbnail' );

		this.activate();
		this.$el.data( 'view', this );

		/**
		 * Called after rendering the choice item in the list
		 */
		wp.hooks.doAction( 'PC.fe.configurator.choice-item.render', this );

		return this.$el;
	}, 
	on_price_update: function() {
		if ( ! this.update_tippy_on_price_update || this.model.get( 'is_group' ) ) return;
		var $ci = this.$( '.choice-item' );
		if ( $ci.length && $ci[0] && $ci[0]._tippy ) {
			$ci[0]._tippy.setContent( this.get_description() );
		}
	},
	get_description: function() {
		if ( 'colors' == this.model.collection.layer.get( 'display_mode' ) && ! this.model.get( 'is_group' ) ) {
			this.update_tippy_on_price_update = true;
			var description = this.$( '.choice-text' ).length ? this.$( '.choice-text' ).html() : this.$( '.choice-name' ).html();
			if ( this.$( '.choice-price' ).length ) {
				description += this.$( '.choice-price' ).html();
				this.$( '.choice-price' ).hide();
			}
			if ( this.$( '.description' ).length ) {
				description += this.$( '.description' ).html();
				this.$( '.description' ).hide();
			}
			if ( this.$( '.out-of-stock' ).length ) {
				description += this.$( '.out-of-stock' )[0].outerHTML;
				// console.log('get desc', this.model.collection.layer.get( 'name' ), this.model.get( 'name' ), this.$( '.out-of-stock' ).length, this.$( '.out-of-stock' )[0].outerHTML );
			}
		} else if ( ! PC.fe.config.choice_description_no_tooltip ) {
			var description = this.$( '.description' ).html();
		}
		// console.log( description );
		return description;
	},
	set_choice: function( event ) {
		if ( this.model.get( 'is_group' ) ) return;

		if ( event.type == 'keydown' ) {
			if ( ! ( event.keyCode == 13 || event.keyCode == 32 ) ) {
				return;
			}
		}

		if ( event.type == 'mousedown' && event.button ) return;

		// console.log( event );
		
		// If the element is disabled, exit.
		if ( $( event.currentTarget ).prop( 'disabled' ) ) return;
		// Activate the clicked item
		this.model.collection.selectChoice( this.model.id );
		var layer = PC.fe.layers.get( this.model.get( 'layerId' ) );
		var close_choices = 
			PC.fe.config.close_choices_when_selecting_choice 
			&& ( $( 'body' ).is('.is-mobile' ) || PC.utils._isMobile() ) 
			|| PC.fe.config.close_choices_when_selecting_choice_desktop
			|| 'dropdown' == layer.get( 'display_mode' )
			|| ( 'full-screen' == layer.get( 'display_mode' ) && 'simple' == layer.get( 'type' ) );

		if ( layer ) {
			// Maybe close the choice list
			if ( wp.hooks.applyFilters( 'PC.fe.close_choices_after_selection', close_choices, this.model ) ) {
				layer.set( 'active', false );
			} else if ( ! layer.get( 'active' ) ) {
				// Maybe set the current layer to active
				var current = layer.collection.filter( function( item ) {
					return item.get( 'active' ) && false !== item.get( 'cshow' ) && 'group' != item.get( 'type' );
				} );
				if ( current.length ) current[0].set( 'active', false );
				layer.set( 'active', true );
			}
		}


		PC.fe.last_clicked = this;
		wp.hooks.doAction( 'PC.fe.choice.set_choice', this.model, this )
	},
	preload_image: function() {
		// console.log('preload image');
		this.model.trigger( 'preload-image' );
		// var src = this.model.get_image();
		// if ( ! src ) return;
		// var img = new Image();
		// img.src = src;
	},
	activate: function() {
		if( this.model.get('active') === true ) {
			this.$el.addClass('active');
			wp.hooks.doAction( 'PC.fe.choice.activate', this );
		} else {
			this.$el.removeClass('active');
			wp.hooks.doAction( 'PC.fe.choice.deactivate', this );
		}
	},
	toggle_group: function() {
		this.$el.toggleClass( 'show-group-content' );
	}
});

PC.fe.views.choiceGroup = PC.fe.views.choice.extend({
	template: wp.template( 'mkl-pc-configurator-choice-group' ),
});
