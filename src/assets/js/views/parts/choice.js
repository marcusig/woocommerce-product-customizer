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
		'keydown > button.choice-group-label': 'toggle_group_with_keyboard',
	},
	render: function() {
		/**
		 * Called after rendering the choice item in the list
		 */
		wp.hooks.doAction( 'PC.fe.configurator.choice-item.before.render', this );
		
		var data = _.extend( {
			thumbnail: this.model.get_image( 'thumbnail' ),
			disable_selection: ! this.model.get( 'available' ) && ! PC.fe.config.enable_selection_when_outofstock
		}, wp.hooks.applyFilters( 'PC.fe.configurator.choice_data', this.model.attributes ) );
		
		// Render the template
		this.$el.html( this.template( wp.hooks.applyFilters( 'PC.fe.configurator.template_choice_data', data ) ) );
		this.$( '> .choice-item' ).attr( 'aria-disabled', data.disable_selection ? 'true' : 'false' );

		wp.hooks.doAction( 'PC.fe.configurator.choice-item.render.after-template', this );

		if ( this.$( '.out-of-stock' ).length ) {
			this.$el.addClass( 'out-of-stock' );
		}

		if ( 'colors' == this.model.collection.layer.get( 'display_mode' ) && this.$( '.out-of-stock' ).length ) {
			if ( $( '#tmpl-mkl-pc-configurator-color-out-of-stock' ).length ) {
				this.$( '.mkl-pc-thumbnail' ).append( $( '#tmpl-mkl-pc-configurator-color-out-of-stock' ).html() );
			}
		}

		var $choiceItem = this.$( '> .choice-item' );
		var description = this.get_description();
		var description_screen_reader = this.get_description( false );
		this.set_choice_sr_text( description_screen_reader );

		if ( window.tippy ) {

			/**
			 * Customization of the tooltip can be done by using TippyJS options: atomiks.github.io/tippyjs/v6/
			 */
			var tooltip_options = wp.hooks.applyFilters( 'PC.fe.tooltip.options', {
				interactive: false,
				content: description,
				allowHTML: true,
				placement: 'top',
				zIndex: 100001,
				appendTo: 'parent',
				trigger: 'mouseenter focus',
				onCreate: function( instance ) {
					if ( instance && instance.popper ) {
						instance.popper.setAttribute( 'aria-hidden', 'true' );
					}
				},
			},
			this );

			tooltip_options = wp.hooks.applyFilters( 'PC.fe.choice.tooltip.options', tooltip_options, this );

			if ( tooltip_options.content && tooltip_options.content.length && $choiceItem.length ) {
				tippy( $choiceItem[0], tooltip_options );
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
	get_description: function( html = true) {
		var description = [];
		if ( wp.hooks.applyFilters( 'PC.fe.tooltip.add_all_text', 'colors' == this.model.collection.layer.get( 'display_mode' ) && ! this.model.get( 'is_group' ) ) ) {
			this.update_tippy_on_price_update = true;
			if ( this.$( '.choice-text' ).length ) {
				description.push( html ? this.$( '.choice-text' ).html() : this.$( '.choice-text' ).text() );
			} else if ( this.$( '.choice-name' ).length ) {
				description.push( html ? this.$( '.choice-name' ).html() : this.$( '.choice-name' ).text() );
			}
			if ( this.$( '.choice-price' ).length ) {
				description.push( html ? this.$( '.choice-price' ).html() : this.$( '.choice-price' ).text() );
				this.$( '.choice-price' ).hide();
			}
			if ( this.$( '.description' ).length ) {
				description.push( html ? this.$( '.description' ).html() : this.$( '.description' ).text() );
				this.$( '.description' ).hide();
			}
			if ( this.$( '.out-of-stock' ).length ) {
				description.push( html ? this.$( '.out-of-stock' )[0].outerHTML : this.$( '.out-of-stock' )[0].outerText );
				// console.log('get desc', this.model.collection.layer.get( 'name' ), this.model.get( 'name' ), this.$( '.out-of-stock' ).length, this.$( '.out-of-stock' )[0].outerHTML );
			}
		} else if ( ! PC.fe.config.choice_description_no_tooltip ) {
			description.push( html ? this.$( '.description' ).html() : this.$( '.description' ).text() );
		}
		// console.log( description );
		if ( html ) {
			return description.join( ' ' );
		} else {
			return description.join( ', ' );
		}
	},
	set_choice_sr_text: function( description ) {
		var $choice_item = this.$( '> .choice-item' );
		if ( ! $choice_item.length ) return;
		var details = '';
		if ( description ) {
			details = description.replace( /\s+/g, ' ' ).replace( /\s*,\s*/g, ', ' ).trim();
		}
		// var text = details ? ( name ? name + '. ' + details : details ) : name;
		if ( details ) {
			$choice_item.attr( 'aria-label', details );
		}
	},
	set_choice: function( event ) {
		if ( this.model.get( 'is_group' ) ) return;

		if ( event.type == 'keydown' ) {
			if ( event.keyCode >= 37 && event.keyCode <= 40 ) {
				event.preventDefault();
				this.navigate_choices( event.keyCode );
				return;
			}
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
		var auto_close = layer.get( 'auto_close' );
		var close_choices = 
			( PC.fe.config.close_choices_when_selecting_choice && ( $( 'body' ).is('.is-mobile' ) || PC.utils._isMobile() ) )
			|| PC.fe.config.close_choices_when_selecting_choice_desktop
			|| 'dropdown' == layer.get( 'display_mode' )
			|| ( 'full-screen' == layer.get( 'display_mode' ) && 'simple' == layer.get( 'type' ) )
			|| 'yes' === auto_close;

		// If the layer contains the class no-auto-close, do not toggle
		if ( 'no' === auto_close ) close_choices = false;

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
		this.set_choice_a11y_attrs();
		if( this.model.get('active') === true ) {
			this.$el.addClass( 'active' );
			this.$( '> button.choice-item' ).attr( 'aria-checked', 'true' );
			wp.hooks.doAction( 'PC.fe.choice.activate', this );
		} else {
			this.$el.removeClass( 'active' );
			this.$( '> button.choice-item' ).attr( 'aria-checked', 'false' );
			wp.hooks.doAction( 'PC.fe.choice.deactivate', this );
		}
		if ( this.options.parent && this.options.parent.update_roving_tabindex ) {
			this.options.parent.update_roving_tabindex();
		}
	},
	toggle_group: function() {
		this.$el.toggleClass( 'show-group-content' );
		this.$( '> .choice-group-label' ).attr( 'aria-expanded', this.$el.is( '.show-group-content' ) ? 'true' : 'false' );
	},
	toggle_group_with_keyboard: function( event ) {
		if ( ! ( event.keyCode === 13 || event.keyCode === 32 ) ) return;
		event.preventDefault();
		this.toggle_group();
	},
	get_layer_type: function() {
		if ( this.model.collection && this.model.collection.layer ) {
			return this.model.collection.layer.get( 'type' ) || 'simple';
		}
		return 'simple';
	},
	/**
	 * Native <button> + radiogroup roving tabindex (choices.js); no duplicate native inputs in default templates.
	 */
	set_choice_a11y_attrs: function() {
		var $choice_item = this.$( '> button.choice-item' );
		if ( ! $choice_item.length ) return;
		var role = 'multiple' === this.get_layer_type() ? 'checkbox' : 'radio';
		$choice_item.attr( 'role', role );
	},
	navigate_choices: function( key_code ) {
		if ( ! this.options.parent || ! this.options.parent.$list ) return;
		var $items = PC.fe.a11y.filter_focusable( this.options.parent.$list.find( '.choice-item' ) );
		if ( ! $items.length ) return;
		var current_index = $items.index( this.$( '> .choice-item' ) );
		if ( -1 === current_index ) return;
		var direction = ( key_code === 37 || key_code === 38 ) ? -1 : 1;
		var next_index = ( current_index + direction + $items.length ) % $items.length;
		var $next = $items.eq( next_index );
		if ( ! $next.length ) return;
		PC.fe.a11y.focus_without_scroll( $next );

		if ( 'multiple' !== this.get_layer_type() ) {
			var next_view = $next.closest( 'li.choice' ).data( 'view' );
			if ( next_view && next_view.model ) {
				next_view.model.collection.selectChoice( next_view.model.id, true );
			}
		}
	}
});

PC.fe.views.choiceGroup = PC.fe.views.choice.extend({
	template: wp.template( 'mkl-pc-configurator-choice-group' ),
});
