PC.fe.steps = {
	current_step: null,
	initiated: false,
	previous_button: null,
	next_button: null,
	steps: null,
	previous_step: function() {
		var current_index = this.get_index( this.current_step );
		if ( 0 === current_index ) return;
		var steps = this.get_steps();
		// steps[this.current_step].set( 'active', false );
		this.deactivate_all_layers();
		steps[current_index - 1].set( 'active', true );
		this.current_step = steps[current_index - 1];
		this.display_step();
	},
	next_step: function() {
		var steps = this.get_steps();
		var current_index = this.get_index( this.current_step );
		
		if ( current_index == steps.length - 1 ) return;

		if ( ! PC.fe.save_data.is_layer_valid( this.current_step ) ) {
			var errors = wp.hooks.applyFilters( 'PC.fe.validate_configuration', PC.fe.errors );
			if ( errors.length ) {
				// show errors and prevent adding to cart
				console.log( 'Validation errors:', errors );
				var messages = [];
				_.each( errors, function( error ) {
					if ( error.choice ) {
						error.choice.set( 'has_error', error );
					}
					if ( error.layer ) {
						error.layer.set( 'has_error', error );
					}
					messages.push( error.message );
				} );
				alert( messages.join( "\n" ) );
				return false;
			}
		}

		this.deactivate_all_layers();

		// steps[this.current_step].set( 'active', false );
		this.current_step = steps[current_index + 1];
		this.current_step.set( 'active', true );
		this.display_step();
	},
	display_step: function() {
		var steps = this.get_steps();
		var current_index = this.get_index( this.current_step );

		PC.fe.modal.$el.toggleClass( 'last-step', !! ( current_index == steps.length - 1 ) );

		var is_first_step = 0 == current_index;

		PC.fe.modal.$el.toggleClass( 'first-step', is_first_step );

		if ( is_first_step ) {
			this.previous_button.$( 'button' ).prop( 'disabled', true );
		} else {
			this.previous_button.$( 'button' ).prop( 'disabled', false );
		}
		
		if ( PC_config.config.open_first_layer && PC.fe.modal.$el.is( '.float, .wsb' ) ) {
			setTimeout( function() {
				var $first = PC.fe.modal.$( '.type-step.active button.layer-item:visible' ).first();
				if ( ! $first.parent().is( '.display-mode-dropdown' ) ) $first.trigger( 'click' );
			}, 50 );
		}
		wp.hooks.doAction( 'PC.fe.steps.display_step' );
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
	setup_steps: function() {
		if ( ! this.steps_possible() ) {
			PC.fe.use_steps = false;
			return;
		}

		PC.fe.use_steps = true;

		this.get_steps();

		PC.fe.modal.$el.addClass( 'has-steps' );

		// add buttons
		wp.hooks.addAction( 'PC.fe.start', 'mkl/product_configurator/steps', function( modal ) {
			this.current_step = this.get_steps()[0];
			this.current_step.set( 'active', true );
			this.previous_button = new this.view_prev();
			this.next_button = new this.view_next();
			var $nav = $( '<nav class="mkl-pc--steps" />' );
			$nav.append( this.previous_button.$el );
			$nav.append( this.next_button.$el );

			var nav_position = wp.hooks.applyFilters( 'PC.fe.steps_position', null, $nav );
			if ( ! nav_position ) modal.footer.$( '.pc_configurator_form' ).before( $nav );
			this.display_step();
		}.bind( this ), 20 );

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
	view_prev: Backbone.View.extend( {
		template: wp.template( 'mkl-pc-configurator-step--previous' ),
		className: 'step-container--previous',
		events: {
			'click button.step-previous ': 'previous'
		},
		initialize: function() {
			this.render();
		},
		render: function() {
			this.$el.html( this.template() );
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
			this.render();
		},
		render: function() {
			this.$el.html( this.template() );
		},
		next: function( e ) {
			e.preventDefault();
			PC.fe.steps.next_step();
		}
	} ),
};
