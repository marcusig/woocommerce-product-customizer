jQuery(function($) {

	var configurator;
	var Nav = Backbone.View.extend({
		tagName: 'div',
		className: 'dm2-nav',
		template: wp.template( 'mkl-pc-dm2-nav' ),
		events: {
			'click .mkl-pc-prev': 'previous',
			'click .mkl-pc-next': 'next',
			'click .mkl-pc-add-to-cart--trigger': 'add_to_cart',
		},
		initialize: function( options ) {
			this.layers = options.layers;
			this.summary = options.summary;
			this.current = 0;
			this.rendered = false;
			this.render();
		},
		render: function() {
			if ( ! this.rendered ) {
				this.rendered = true;
				this.$nav = $( '<nav></nav>' );
				this.$el.append( this.$nav );
			}
			var next_item_name = '';
			$( this.layers[this.current] ).trigger( 'click' );
			if ( this.layers[this.current + 1] ) {
				var id = $( this.layers[this.current + 1] ).data( 'layer-id' );
				if ( id ) {
					next_item_name = PC.fe.layers.get( id ).get( 'name' );
				}
			} else {
				next_item_name = 'Summary'
			}
			this.$nav.html( this.template( { next_item_name: next_item_name, current: this.current, is_summary: this.current == this.layers.length } ) );
		},
		previous: function() {
			this.current --; 
			if ( this.current < 0 ) this.current = 0;
			this.summary.activate( false );
			this.render();
		},
		next: function( event ) {
			if ( $( event.currentTarget ).is( '.mkl-pc-add-to-cart--trigger' ) ) return;
			this.current ++; 
			if ( this.current > this.layers.length ) this.current = this.layers.length;
			if ( this.current == this.layers.length ) {
				// Deactivate the previous one
				$( this.layers[this.current - 1] ).trigger( 'click' );
				this.summary.render();
				this.summary.activate( true );
			}
			this.render();
		},
		add_to_cart: function() {
			configurator.$( '.configurator-add-to-cart' ).trigger( 'click' );
		}
	});

	// PC.fe.save_data
	var Summary = Backbone.View.extend({
		tagName: 'div',
		className: 'mkl-pc-dm2-summary layer_choices',
		template: wp.template( 'mkl-pc-dm2-summary' ),
		events: {
			'refresh': 'render'
		},
		initialize: function() {
			this.layerTemplate = wp.template( 'mkl-pc-dm2-summary-layer' );
			this.render();
		},
		render: function() {
			// PC.fe.save_data.get_choices();
			this.$el.html( this.template( { choices: PC.fe.save_data.get_choices() } ) );

			// PC.fe.layers.each( function( layer ) {
			// 	if ( layer.get( 'not_a_choice' ) ) return;
			// 	var items = this.col.where( { 'layer_id': layer.id } );
			// 	this.$el.append( this.layerTemplate( { name: layer.get( 'name' ), choices: items } ) );
			// }, this );
		
		},
		activate: function( shouldActivate ) {
			this.$el.toggleClass( 'active', shouldActivate );
		}
	});

	wp.hooks.addFilter( 'PC.fe.tooltip.options', 'MKL/PC/Themes/dark-mode-2', function( options ) {
		options.theme = 'invert';
		return options;
	}, 20);

	// wp.hooks.addFilter( 'PC.fe.choices.where', 'MKL/PC/Themes/float', function( where ) {
	// 	if ( ! PC.utils._isMobile() ) return where;
	// 	return 'in';
	// } );
	wp.hooks.addAction( 'PC.fe.add.choices', 'MKL/PC/Themes/dark-mode-2', function( $el, view ) {
		// Add the description to the choices name
		if ( view.model.get( 'description' ) ) {
			$el.find( '.layer-choices-title' ).append( $('<span class="description" />' ).html( view.model.get( 'description' ) ) );
		}
	} );

	wp.hooks.addAction( 'PC.fe.start', 'MKL/PC/Themes/dark-mode-2', function( view ) {
		configurator = view;
		if ( PC.utils._isMobile() ) {
			// Move header
			view.$( '.mkl_pc_toolbar > header' ).insertBefore( view.$( '.mkl_pc_toolbar' ) );
		}

		view.$el.addClass( pc_stepper_config.color_mode );
		view.$el.addClass( pc_stepper_config.list_mode );
		view.$el.addClass( pc_stepper_config.layout );

		var sum = new Summary();
		var n = new Nav( { layers: view.$( '.mkl_pc_toolbar button.layer-item' ), summary: sum } );
		view.$( '.mkl_pc_toolbar' ).append( n.$el );
		view.$( '.mkl_pc_toolbar section.choices' ).prepend( sum.$el );
		// Setup slider
		var shouldAnimate;

		// view.$( '.mkl_pc_toolbar section.choices' ).flexslider( {
		// 	allowOneSlide: false,
		// 	animation: 'slide',
		// 	animationLoop: false,
		// 	animationSpeed: 500,
		// 	controlNav: false,
		// 	directionNav: true,
		// 	rtl: false,
		// 	slideshow: false,
		// 	smoothHeight: false,
		// 	selector: '.layers > li',
			
		// 	before: function( slider ) {
		// 		console.log(slider);
		// 		if ( slider.currentSlide != slider.animatingTo ) {
		// 			slider.newSlides.eq(slider.animatingTo).find( '> button' ).trigger( 'click' );
		// 		}
		// 	}
		// } );

		

	}, 20 );
});