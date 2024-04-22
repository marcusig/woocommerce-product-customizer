PC.fe.views.stepsProgress = Backbone.View.extend( {
	className: 'steps-progress--container',
	initialize: function() {
		this.render();
		return this; 
	},
	events: {
		// 'click .configurator-add-to-cart': 'add_to_cart',
		// 'click .configurator-previous-step': 'previous_step',
		// 'click .configurator-next-step': 'next_step',
		// 'click .add-to-quote': 'add_to_quote'
	},
	render: function() {
		this.$ol = $( '<ol class="steps-progress" />' );
		PC.fe.steps.steps.each( this.add_step.bind( this ) );
		this.$marker = $( '<li class="steps-progress--item steps-progress--active-marker" />' );
		this.$ol.append( this.$marker );
		this.$ol.appendTo( this.$el );
	},
	add_step: function( step ) {
		var item = new PC.fe.views.stepsProgressItem( { model: step } );
		item.$el.appendTo( this.$ol );
	}
} );

PC.fe.views.stepsProgressItem = Backbone.View.extend( {
	className: 'steps-progress--item',
	tagName: 'li',
	template: wp.template( 'mkl-pc-configurator-steps-progress--item' ),
	initialize: function() {
		this.listenTo( this.model, 'change:active change:cshow', this.render );
		this.render();
		return this; 
	},
	events: {
		'click a.step-link': 'on_click',
		// 'click .configurator-previous-step': 'previous_step',
		// 'click .configurator-next-step': 'next_step',
		// 'click .add-to-quote': 'add_to_quote'
	},
	render: function() {
		this.$el.toggleClass( 'active', this.model.get( 'active' ) );
		this.$el.toggleClass( 'hidden', false === this.model.get( 'cshow' ) );
		this.$el.html( this.template( this.model.attributes ) );
		if ( this.model.get( 'active' ) ) {
			setTimeout( function() {
				var $item = this.$el, 
					$container = $item.closest( '.steps-progress' ),
					width = $container.outerWidth(),
					position = $container.scrollLeft() + $item.position().left - width / 2 + $item.outerWidth() / 2;

				$container.animate( {
					scrollLeft: position
				}, 320)

				$container.css( {
					'--mkl_pc-steps-marker-width': $item.width() + "px",
					'--mkl_pc-steps-marker-pos': $item.get(0).offsetLeft + "px"
				} );
			}.bind( this ), 10 );
		}

	},
	on_click: function( e ) {
		e.preventDefault();
		if ( this.model.get( 'active' ) ) return;
		var current_index = PC.fe.steps.get_index( PC.fe.steps.current_step );
		if ( PC.fe.steps.get_index( this.model ) < current_index || PC.fe.config.steps_progress_enable_click_all ) {
			PC.fe.steps.display_step( PC.fe.steps.get_index( this.model ) );
		}
	}
} );


// $(".js-tab-link").off("click").on("click", (function() {
// 	var t = $(this)
// 	  , e = t.closest(".js-tab-nav")
// 	  , n = e.outerWidth()
// 	  , i = e.scrollLeft() + t.position().left - n / 2 + t.outerWidth() / 2;
// 	e.animate({
// 		scrollLeft: i
// 	}, r.size.isMobile() ? 320 : 640)
// }