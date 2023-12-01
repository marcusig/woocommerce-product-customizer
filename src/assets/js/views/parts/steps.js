PC.fe.steps = {
	current_step: 0,
	initiated: false,
	previous_button: null,
	next_button: null,
	previous_step: function() {
		if ( 0 == this.current_step ) return;
		var steps = this.get_steps();
		steps[this.current_step].set( 'active', false );
		steps[this.current_step - 1].set( 'active', true );
		this.current_step--;
		this.display_step(); 
	},
	next_step: function() {
		var steps = this.get_steps();
		if ( ! PC.fe.save_data.is_layer_valid( steps[this.current_step] ) ){
			alert( 'Please complete step one before proceeding' );
			return;
		}
		if ( this.current_step == steps.length - 1 ) return;
		steps[this.current_step].set( 'active', false );
		steps[this.current_step + 1].set( 'active', true );
		this.current_step++;
		this.display_step();
	},
	display_step: function() {
		var steps = this.get_steps();
		PC.fe.modal.$el.toggleClass( 'last-step', !! ( this.current_step == steps.length - 1 ) );
		var is_first_step = 0 == this.current_step;
		PC.fe.modal.$el.toggleClass( 'first-step', is_first_step );
		if ( is_first_step ) {
			this.previous_button.$( 'button' ).prop( 'disabled', true );
		} else {
			this.previous_button.$( 'button' ).prop( 'disabled', false );
		}
		wp.hooks.doAction( 'PC.fe.steps.display_step' );
	},
	get_steps: function() {
		return PC.fe.layers.filter( function( model ) {
			// Conditional choice: don't count if hidden
			if ( PC.fe.steps.initiated ) {
				if ( false === model.get( 'cshow' ) ) return false;
				return model.get( 'is_step' );
			}

			// A valid step is visible, has a type of Group, and doesn't have a parent (only root elements can be steps ) 
			return 'group' == model.get( 'type' ) && ( ! model.get( 'parent' ) || ( model.get( 'parent' ) && ! PC.fe.layers.get( model.get( 'parent' ) ) ) );
		} );
	},
	setup_steps: function() {
		if ( ! this.steps_possible() ) {
			PC.fe.use_steps = false;
			return;
		}
		PC.fe.use_steps = true;
		_.each( this.get_steps(), function( step ) {
			step.set( 'is_step', true );
		} );
		PC.fe.modal.$el.addClass( 'has-steps' );
		this.initiated = true;
		// add buttons
		wp.hooks.addAction( 'PC.fe.start', 'mkl/product_configurator/steps', function( modal ) {
			this.get_steps()[this.current_step].set( 'active', true );
			this.previous_button = new this.view_prev();
			this.next_button = new this.view_next();
			var $nav = $( '<nav class="mkl-pc--steps" />' );
			$nav.append( this.previous_button.$el );
			$nav.append( this.next_button.$el );

			var nav_position = wp.hooks.applyFilters( 'PC.fe.steps_position', null, $nav );
			if ( ! nav_position ) modal.footer.$( '.footer__section-right' ).prepend( $nav );
			this.display_step();
		}.bind( this ), 20 );

	},
	steps_possible: function() {
		var steps = this.get_steps();
		var all_root_layers = PC.fe.layers.filter( function( model ) {
			// Conditional choice: don't count if hidden
			if ( false === model.get( 'cshow' ) ) return false;
			// A valid step is visible, has a type of Group, and doesn't have a parent (only root elements can be steps ) 
			return ( ! model.get( 'parent' ) || ( model.get( 'parent' ) && ! PC.fe.layers.get( model.get( 'parent' ) ) ) );
		} );
		return steps.length && steps.length == all_root_layers.length;
	},
	view_prev: Backbone.View.extend( {
		template: wp.template( 'mkl-pc-configurator-step--previous' ),
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
