PC.fe.views.viewer_static_layer = Backbone.View.extend({
	tagName: wp.hooks.applyFilters( 'PC.fe.viewer.item.tag', 'img' ),
	events: {
		'load': 'loaded',
		'error': 'loaded',
		'abort': 'loaded',
		'stalled': 'loaded',
	},
	initialize: function( options ) { 
		this.listenTo( PC.fe.angles, 'change active', this.render );

		this.parent = options.parent || PC.fe;
		wp.hooks.doAction( 'PC.fe.choice-img.init', this );

		this.render(); 

		return this; 
	},
	loaded: function(event) {
		this.$el.removeClass( 'loading' );
		wp.hooks.doAction( 'PC.fe.viewer.layer.preload.complete', this );
		this.parent.imagesLoading --;
		if( this.parent.imagesLoading == 0 ) {
			this.parent.$el.removeClass('is-loading-image');
			wp.hooks.doAction( 'PC.fe.viewer.layers.preload.complete', this );
		}
	},
	render: function() {
		var img = this.model.get_image();
		// Default to a transparent image
		if ( ! img ) img = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';

		wp.hooks.doAction( 'PC.fe.viewer.static_layer.render', this );

		var classes = [ 'active', 'static', 'loading' ];
		
		classes.push( this.model.collection.getType() );
		
		var layer_class = PC.fe.layers.get( this.model.get( 'layerId' ) ).get( 'class_name' );
		if ( layer_class ) classes.push( layer_class );
		if ( this.model.get( 'class_name' ) ) classes.push( this.model.get( 'class_name' ) );
		
		/**
		 * Filter the classes applied to the image
		 */
		classes = wp.hooks.applyFilters( 'PC.fe.viewer.static_layer.classes', classes, this );
		this.$el.addClass( classes.join( ' ' ) );
		if ( img ) {
			this.el.src = img;
			this.parent.imagesLoading ++;
			this.parent.$el.addClass('is-loading-image');
		}
		this.$el.data( 'dimensions', this.model.get_image( 'image', 'dimensions' ) );

		return this.$el; 
	}		
});

PC.fe.views.viewer_layer = Backbone.View.extend({ 
	tagName: 'img', 
	events: {
		'load': 'img_loaded',
		'error': 'img_loaded',
		'abort': 'img_loaded',
		'stalled': 'img_loaded',
	},
	initialize: function( options ) { 
		var that = this;
		this.empty_img = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';
		this.parent = options.parent || PC.fe;
		this.is_loaded = false;
		this.listenTo( this.model, 'change:active', this.change_layer );
		this.listenTo( this.model, 'preload-image', this.preload_image );
		this.listenTo( PC.fe.layers, 'change:active', this.toggle_current_layer_class );
		this.listenTo( PC.fe.angles, 'change:active', this.change_angle );
		wp.hooks.doAction( 'PC.fe.choice-img.init', this );
		var is_active = this.model.get( 'active' );

		this.render(); 

		return this; 
	},
	render: function( force ) {
			
		var is_active = this.model.get( 'active' );
		var img = this.model.get_image();
		var classes = [];
		
		classes.push( this.model.collection.getType() );
		
		var layer_class = PC.fe.layers.get( this.model.get( 'layerId' ) ).get( 'class_name' );
		if ( layer_class ) classes.push( layer_class );
		if ( this.model.get( 'class_name' ) ) classes.push( this.model.get( 'class_name' ) );
		/**
		 * Filter the classes applied to the image
		 */
		classes = wp.hooks.applyFilters( 'PC.fe.viewer.layer.classes', classes, this );
		// Add the classes
		this.$el.addClass( classes.join( ' ' ) );
		// Default to a transparent image
		if ( ! img ) img = this.empty_img;

		wp.hooks.doAction( 'PC.fe.viewer.layer.render', this );

		if ( is_active ) {
			if ( ! this.is_loaded ) {
				this.parent.imagesLoading ++;
				this.parent.$el.addClass('is-loading-image');
				this.$el.addClass( 'loading' );
				this.el.src = img
			} 
			this.$el.addClass( 'active' );
		} else {
			if ( ! this.is_loaded ) {
				this.$el.addClass( 'loading' );
				if ( 'lazy' == PC.fe.config.image_loading_mode && ! force ) {
					this.el.src = this.empty_img;
				} else {
					this.el.src = img;	
				}
			}
			this.$el.removeClass( 'active' );
		}

		this.$el.data( 'dimensions', this.model.get_image( 'image', 'dimensions' ) );

		return this.$el; 
	},
	// get_image_url: function( choice_id, image ) {
	// 	image = image || 'image'; 
	// 	var active_angle = PC.fe.angles.findWhere( { active: true } );
	// 	var angle_id = active_angle.id; 

	// 	return this.choices.get( choice_id ).attributes.images.get( angle_id ).attributes[image].url; 
	// },
	change_layer: function( model ) {
		this.render();
	},
	change_angle: function( model ) {
		if ( model.get( 'active' ) ) {
			this.is_loaded = false;
			this.render();
		}
	},
	img_loaded: function( e ) {
		this.$el.removeClass( 'loading' );
		if (this.empty_img == this.$el.prop('src')) return;
		this.is_loaded = true;

		if ( 'load' == e.type ) wp.hooks.doAction( 'PC.fe.viewer.layer.preload.complete', this );

		this.parent.imagesLoading --;
		if( this.parent.imagesLoading == 0 ) {
			this.parent.$el.removeClass('is-loading-image');
			wp.hooks.doAction( 'PC.fe.viewer.layers.preload.complete', this );
		}

	},
	toggle_current_layer_class: function( layer, new_val ) {
		if ( layer.id !== this.model.get( 'layerId' ) ) return;
		this.$el.toggleClass( 'current_layer', layer.id == this.model.get( 'layerId' ) && new_val );
	},
	preload_image: function( e ) {
		if ( this.model.get( 'active' ) ) return;
		if ( ! this.model.get_image() || this.el.src == this.model.get_image() ) return;
		
		this.render( true );
		// if ( ! src ) return;
		// var img = new Image();
		// img.src = src;
	}
}); 

PC.fe.views.viewer_layer_html = Backbone.View.extend({ 
	tagName: 'div',
	className: 'custom-html',
	initialize: function( options ) {
		var that = this;
		this.parent = options.parent || PC.fe;
		this.layer = PC.fe.layers.get( this.model.get( 'layerId' ) )
		this.listenTo( this.model, 'change:active', this.change_layer );
		this.listenTo( this.model, 'change:cshow', this.conditional_display );
		this.listenTo( this.layer, 'change:cshow', this.conditional_display );
		this.listenTo( PC.fe.layers, 'change:active', this.toggle_current_layer_class );
		// this.listenTo( PC.fe.angles, 'change:active', this.change_angle );
		wp.hooks.doAction( 'PC.fe.choice-custom-html.init', this );

		this.render(); 

		return this; 
	},
	render: function() {
			
		var is_active = this.model.get( 'active' );
		var classes = [];
		
		classes.push( this.model.collection.getType() );
		
		var layer_class = this.layer.get( 'class_name' );
		if ( layer_class ) classes.push( layer_class );
		if ( this.model.get( 'class_name' ) ) classes.push( this.model.get( 'class_name' ) );
		/**
		 * Filter the classes applied to the image
		 */
		classes = wp.hooks.applyFilters( 'PC.fe.viewer.layer.classes', classes, this );
		// Add the classes
		this.$el.addClass( classes.join( ' ' ) );
		// Default to a transparent image

		wp.hooks.doAction( 'PC.fe.viewer.layer.render', this );

		if ( is_active ) {
			this.$el.addClass( 'active' );
		} else {
			this.$el.removeClass( 'active' );
		}

		this.$el.html( this.model.get( 'custom_html' ) );

		return this.$el; 
	},
	change_layer: function( model ) {
		this.$el.toggleClass( 'active', this.model.get( 'active' ) );
		this.conditional_display();
		// this.render();
	},
	toggle_current_layer_class: function( layer, new_val ) {
		if ( layer.id !== this.model.get( 'layerId' ) ) return;
		this.$el.toggleClass( 'current_layer', layer.id == this.model.get( 'layerId' ) && new_val );
	},
	conditional_display: function() {
		var model_cshow = false !== this.model.get( 'cshow' );
		var layer_cshow = false !== this.layer.get( 'cshow' );
		this.$el.toggle( this.model.get( 'active' ) && model_cshow && layer_cshow );
	}
});
