PC.fe.steps = {
	current_step: null,
	initiated: false,
	previous_button: null,
	next_button: null,
	steps: null,
	$nav: null,
	initialized: false,
	setup_steps: function() {
		if ( ! this.steps_possible() ) {
			PC.fe.use_steps = false;
			this.clean_existing_steps();
			return;
		}

		PC.fe.use_steps = true;

		/* Maybe reset elements */
		this.clean_existing_steps();

		this.get_steps();

		PC.fe.modal.$el.addClass( 'has-steps' );

		// add buttons
		if ( this.initialized ) return;

		wp.hooks.addAction( 'PC.fe.start', 'mkl/product_configurator/steps', function( modal ) {
			if  ( ! PC.fe.use_steps || ! this.steps ) return;
			this.current_step = this.get_steps()[0];
			this.current_step.set( 'active', true );
			this.previous_button = new this.view_prev();
			this.next_button = new this.view_next();
			this.$nav = $( '<nav class="mkl-pc--steps" />' );
			this.$nav.append( this.previous_button.$el );
			this.$nav.append( this.next_button.$el );

			var nav_position = wp.hooks.applyFilters( 'PC.fe.steps_position', null, this.$nav );
			if ( ! nav_position ) modal.footer.$( '.pc_configurator_form' ).before( this.$nav );

			if ( wp.hooks.applyFilters( 'PC.fe.steps.display_breadcrumb', true ) ) {
				this.breadcrumb = new PC.fe.views.stepsProgress();
				var breadcrumb_position = wp.hooks.applyFilters( 'PC.fe.breadcrumb_position', null, this.breadcrumb );
				if ( ! breadcrumb_position ) modal.toolbar.$( 'section.choices' ).before( this.breadcrumb.$el );
			}

			this.$live = $( '<div class="mkl-pc-current-step-name screen-reader-text" aria-live="polite" aria-atomic="true"></div>' );
			modal.toolbar.$( 'section.choices' ).before( this.$live );

			this.display_step();
		}.bind( this ), 20 );

		wp.hooks.addAction( 'PC.fe.reset_configurator', 'mkl/product_configurator/steps', function() {
			this.display_step( 0 );
		}.bind( this ) );

		this.initialized = true;
	},
	update_live_region: function() {
		if ( ! this.current_step ) return;
		const current_step = this.get_index( this.current_step );
		const total_steps = PC.fe.steps.steps.length;
		const step_number = current_step + 1;
		const step_name = this.current_step.get( 'name' );
		const step_label = PC_config.lang.steps_progress_current_step.replace( '%1$s', step_number ).replace( '%2$s', total_steps ).replace( '%3$s', step_name );
		this.$live.text( step_label );
	},
	clean_existing_steps: function() {
		if ( this.steps ) this.steps = null;
		PC.fe.modal.$el.removeClass( 'has-steps' );
		PC.fe.modal.$el.removeClass( 'last-step' );
		PC.fe.modal.$el.removeClass( 'first-step' );
		if ( this.previous_button ) {
			this.$nav.remove();
			this.$nav = null;
			this.previous_button.remove();
			this.previous_button = null;
			this.next_button.remove();
			this.next_button = null;
		}

		if ( this.breadcrumb ) {
			this.breadcrumb.remove();
			this.breadcrumb = null;
		}
	},
	steps_possible: function() {
		var steps = PC.fe.layers.filter( function( model ) {
			// A valid step is visible, has a type of Group, and doesn't have a parent (only root elements can be steps ) 
			return 'group' == model.get( 'type' ) && ( ! model.get( 'parent' ) || ( model.get( 'parent' ) && ! PC.fe.layers.get( model.get( 'parent' ) ) ) );
		} );

		var all_root_layers = PC.fe.layers.filter( function( model ) {
			// A valid step is visible, has a type of Group, and doesn't have a parent (only root elements can be steps ) 
			return ( ! model.get( 'parent' ) || ( model.get( 'parent' ) && ! PC.fe.layers.get( model.get( 'parent' ) ) ) );
		} );

		// ALL root layers must be groups for the steps to work.
		return steps.length && steps.length == all_root_layers.length;
	},	
	previous_step: function() {
		var current_index = this.get_index( this.current_step );
		if ( 0 === current_index ) return;
		var steps = this.get_steps();
		// steps[this.current_step].set( 'active', false );
		this.display_step( current_index - 1 );
	},
	next_step: function() {
		var steps = this.get_steps();
		var current_index = this.get_index( this.current_step );
		
		if ( current_index == steps.length - 1 ) return;

		var urlParams = new URLSearchParams( location.search );
		var proceed = urlParams.has( 'pc-presets-admin' );

		PC.fe.clear_validation_errors();

		var validated_layer = PC.fe.save_data.is_layer_valid( this.current_step );
		var errors = wp.hooks.applyFilters( 'PC.fe.validate_configuration', PC.fe.errors );
		validated_layer = validated_layer && ! errors.length;
		if ( ! proceed && ! validated_layer ) {
			if ( errors.length ) {
				if ( PC.fe.show_validation_errors ) {
					PC.fe.show_validation_errors( errors );
				}
				return false;
			}
		}

		this.display_step( current_index + 1 );
	},
	display_step: function( ind ) {
		PC.fe.save_data.reset_errors();
		var steps = this.get_steps();
		var current_index = this.get_index( this.current_step );

		// Change step
		if ( 'undefined' != typeof ind && current_index != ind && steps[ind] ) {
			this.deactivate_all_layers();
			this.current_step = steps[ind];
			this.current_step.set( 'active', true );
			current_index = ind;
		}

		PC.fe.modal.$el.toggleClass( 'last-step', !! ( current_index == steps.length - 1 ) );

		PC.fe.modal.$el.toggleClass( 'first-step', 0 == current_index );
		
		if ( PC_config.config.open_first_layer && PC.fe.modal.$el.is( '.float, .wsb' ) ) {
			setTimeout( function() {
				var $first = PC.fe.modal.$( '.type-step.active button.layer-item:visible' ).first();
				if ( ! $first.parent().is( '.display-mode-dropdown' ) ) $first.trigger( 'click' );
			}, 50 );
		}

		this.update_live_region();

		wp.hooks.doAction( 'PC.fe.steps.display_step', this );
	},
	get_steps: function() {
		if ( ! this.steps ) {
			// Create the collection
			var col = Backbone.Collection.extend( { model: PC.layer } );
			this.steps = new col();

			// Populate with the layers
			PC.fe.layers.each( function( layer ) {
				if ( 'group' == layer.get( 'type' ) && ( ! layer.get( 'parent' ) || ( layer.get( 'parent' ) && ! PC.fe.layers.get( layer.get( 'parent' ) ) ) ) ) {
					layer.set( 'is_step', true );
					this.steps.add( layer );
				}
			}.bind( this ) );
		}

		return this.steps.filter( function( model ) {
			return ! ( false === model.get( 'cshow' ) );
		} );
	},
	get_index: function( step ) {
		// Because of conditional logic, the index of an item can change.
		return _.indexOf( this.get_steps(), step );
	},
	deactivate_all_layers: function() {
		PC.fe.layers.each( function( model ) {
			model.set( 'active' , false );
		});
	},
	view_prev: Backbone.View.extend( {
		template: wp.template( 'mkl-pc-configurator-step--previous' ),
		className: 'step-container--previous',
		events: {
			'click button.step-previous ': 'previous'
		},
		initialize: function() {
			wp.hooks.addAction( 'PC.fe.steps.display_step', 'mkl/pc/steps', this.render.bind( this ) );
			if ( 'undefiled' != typeof PC.conditionalLogic ) this.listenTo( PC.fe.steps.steps, 'change:cshow', this.render );
			this.render();
		},
		render: function() {
			// Render once, then update state in place (preserves focus).
			if ( ! this.$( 'button.step-previous' ).length ) {
				this.$el.html( this.template({}) );
			}
			var current_index = PC.fe.steps.get_index( PC.fe.steps.current_step );
			if ( 0 == current_index ) {
				this.$( 'button.step-previous' ).prop( 'disabled', true );
			} else {
				this.$( 'button.step-previous' ).prop( 'disabled', false );
			}
	
		},
		previous: function( e ) {
			e.preventDefault();
			PC.fe.steps.previous_step();
		}
	} ),
	view_next: Backbone.View.extend( {
		template: wp.template( 'mkl-pc-configurator-step--next' ),
		className: 'step-container--next',
		events: {
			'click button.step-next ': 'next'
		},
		initialize: function() {
			wp.hooks.addAction( 'PC.fe.steps.display_step', 'mkl/pc/steps', this.render.bind( this ) );
			if ( 'undefiled' != typeof PC.conditionalLogic ) {
				this.listenTo( PC.fe.steps.steps, 'change:cshow', this.render );
			}
			this.render();
		},
		render: function() {
			// Render once, then update label/state in place (preserves focus).
			if ( ! this.$( 'button.step-next' ).length ) {
				this.$el.html( this.template({ label: '' }) );
			}

			var label = '';
			if ( PC.fe.config.steps_use_layer_name ) {
				var steps = PC.fe.steps.get_steps();
				var current_index = PC.fe.steps.get_index( PC.fe.steps.current_step );
				if ( current_index < steps.length - 1 ) {
					var next_step = steps[current_index + 1];
					label = next_step.get( 'next_step_button_label' ) || next_step.get( 'name' );
				}
			} 
			if ( label ) {
				this.$( 'button.step-next > span:not(.screen-reader-text)' ).first().text( label );
			}
		},
		next: function( e ) {
			e.preventDefault();
			PC.fe.steps.next_step();
		}
	} ),
};
