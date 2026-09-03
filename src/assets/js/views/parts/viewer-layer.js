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
		
		// a11y - hide images from being read
		this.$el.attr( 'aria-hidden', 'true' );

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
		wp.hooks.doAction( 'PC.fe.viewer.layer.render.after', this );
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
		this.empty_img = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';
		this.parent = options.parent || PC.fe;
		this.layer = PC.fe.layers.get( this.model.get( 'layerId' ) );
		this.is_loaded = false;
		this.listenTo( this.model, 'change:active', this.change_layer );
		this.listenTo( this.model, 'preload-image', this.preload_image );
		this.listenTo( PC.fe.layers, 'change:active', this.toggle_current_layer_class );
		this.listenTo( PC.fe.angles, 'change:active', this.change_angle );
		wp.hooks.doAction( 'PC.fe.choice-img.init', this );

		this.render(); 

		return this; 
	},
	render: function( force ) {
			
		var is_active = this.model.get( 'active' );
		var img = this.model.get_image();
		const width = PC.fe.modal.$el.outerWidth();
		if ( width && PC.fe.config.mobile_image_breakpoint && width < PC.fe.config.mobile_image_breakpoint && this.model.get_image( 'image', 'url_mobile' ) ) {
			img = this.model.get_image( 'image', 'url_mobile' );
		}
		if ( width && PC.fe.config.large_image_breakpoint && width >= PC.fe.config.large_image_breakpoint && this.model.get_image( 'image', 'url_large' ) ) {
			img = this.model.get_image( 'image', 'url_large' );
		}
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
		if ( ! img ) img = this.empty_img;

		wp.hooks.doAction( 'PC.fe.viewer.layer.render', this );

		if ( is_active ) {
			if ( ! this.is_loaded ) {
				this.parent.imagesLoading ++;
				// Only a counted image may decrement the counter again - see img_loaded().
				this.counted = true;
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
		
		// a11y - hide images from being read
		if ( ! this.$el.attr( 'data-layer' ) ) {
			this.$el.attr( 'aria-hidden', 'true' );
			this.$el.attr( 'data-layer', this.layer.get( 'admin_label' ) || this.layer.get( 'name' ) );
			this.$el.attr( 'data-choice', this.model.get( 'admin_label' ) || this.model.get( 'name' ) );
			this.$el.attr( 'data-layer_id', this.layer.id );
			this.$el.attr( 'data-choice_id', this.model.id );
		}

		wp.hooks.doAction( 'PC.fe.viewer.layer.render.after', this );
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

		// Only images that were counted when their src was set may count down
		// again. An inactive image also gets a src, but was never added to
		// imagesLoading: decrementing for it drove the counter below zero, so it
		// never came back to 0 and the viewer kept its `is-loading-image` class.
		if ( ! this.counted ) return;
		this.counted = false;

		this.parent.imagesLoading --;
		if( this.parent.imagesLoading == 0 ) {
			this.parent.$el.removeClass('is-loading-image');
			wp.hooks.doAction( 'PC.fe.viewer.layers.preload.complete', this );
		}

	},
	/**
	 * Release a load that will never complete.
	 *
	 * Images are created and destroyed as the selection changes when the viewer
	 * only renders what it shows, so one can be removed while still loading.
	 */
	remove: function() {
		if ( this.counted && this.parent ) {
			this.counted = false;
			this.parent.imagesLoading --;
			if ( 0 >= this.parent.imagesLoading ) {
				this.parent.imagesLoading = 0;
				this.parent.$el.removeClass( 'is-loading-image' );
			}
		}
		return Backbone.View.prototype.remove.apply( this, arguments );
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

/**
	PC.fe.views.viewer_layer_pool
	-> The images of ONE layer in the viewer.

	The viewer's default is an <img> per choice, shown and hidden with a class. On
	a large configuration that means thousands of images in the page to show a
	couple of hundred, and every one of them re-renders when the angle changes.

	This keeps only the images the layer actually shows - one for a simple layer,
	one per selection for a multiple choice layer, none while the layer is hidden
	or has nothing selected - and creates them as the selection changes.

	It owns no element of its own: the images stay direct children of
	.mkl_pc_layers, exactly where they are today, so stylesheets written against
	them keep working. Its own `el` is never inserted anywhere.
*/
PC.fe.views.viewer_layer_pool = Backbone.View.extend({
	initialize: function( options ) {
		this.options = options || {};
		this.parent = options.parent;
		this.layer = options.model;
		this.choices = PC.fe.getLayerContent( this.layer.id );
		this.views = {};
		this.html_views = {};
		this.preloaded = {};

		if ( ! this.choices ) return this;

		this.listenTo( this.choices, 'change:active', this.sync );
		this.listenTo( this.choices, 'change:cshow', this.sync );
		this.listenTo( this.choices, 'preload-image', this.preload );
		// Any layer's visibility can hide this one through a group ancestor, so
		// this listens to the collection rather than to this layer alone.
		this.listenTo( PC.fe.layers, 'change:cshow', this.sync );

		this.sync();

		return this;
	},

	/**
	 * The choices that need an image in the viewer right now.
	 *
	 * @return {Array} choice models
	 */
	get_visible_choices: function() {
		if ( this.parent.is_hidden_by_conditions_layer( this.layer ) ) return [];

		var that = this;
		return this.choices.filter( function( choice ) {
			if ( ! choice.get( 'active' ) ) return false;
			if ( choice.get( 'is_group' ) ) return false;
			if ( that.parent.is_hidden_by_conditions( choice ) ) return false;
			return choice.has_image() || wp.hooks.applyFilters( 'PC.fe.viewer.item.render.empty.images', false, choice );
		} );
	},

	/**
	 * Bring the images in line with what the layer currently shows.
	 */
	sync: function() {
		var wanted = {};
		_.each( this.get_visible_choices(), function( choice ) {
			wanted[ choice.id ] = choice;
		} );

		_.each( _.keys( this.views ), function( id ) {
			if ( wanted[ id ] ) return;
			this.remove_view( id );
		}, this );

		_.each( wanted, function( choice, id ) {
			if ( this.views[ id ] ) return;
			this.add_view( choice );
		}, this );
	},

	add_view: function( choice ) {
		var View = wp.hooks.applyFilters( 'PC.fe.viewer.item.view', PC.fe.views.viewer_layer, choice, this.parent );
		var view = new View( { model: choice, parent: this.parent } );

		this.views[ choice.id ] = view;
		// Keep the viewer's indexes up to date so capture() can find the drawable.
		this.parent.layers[ choice.id ] = view;
		this.parent.layer_views[ this.parent.view_key( choice ) ] = view;

		this.parent.insert_image( view.$el, this.parent.sort_key( choice ) );
		wp.hooks.doAction( 'PC.fe.viewer.item.added', view, this.parent );

		if ( choice.get( 'custom_html' ) ) {
			var html_view = new PC.fe.views.viewer_layer_html( { model: choice, layer: view, parent: this.parent } );
			this.html_views[ choice.id ] = html_view;
			this.parent.insert_image( html_view.$el, this.parent.sort_key( choice, 1 ) );
			wp.hooks.doAction( 'PC.fe.viewer.html_item.added', html_view, this.parent );
		}

		return view;
	},

	remove_view: function( id ) {
		if ( this.views[ id ] ) {
			var key = this.parent.view_key( this.views[ id ].model );
			this.views[ id ].remove();
			delete this.views[ id ];
			if ( this.parent.layer_views ) delete this.parent.layer_views[ key ];
		}
		if ( this.html_views[ id ] ) {
			this.html_views[ id ].remove();
			delete this.html_views[ id ];
		}
	},

	/**
	 * Warm the browser cache for a choice the customer is hovering.
	 *
	 * There is no waiting <img> to point at an unselected choice any more, so the
	 * request is made off-DOM: same effect on the cache, nothing added to the page.
	 *
	 * @param {Backbone.Model} choice
	 */
	preload: function( choice ) {
		if ( ! choice || ! choice.get_image ) return;
		if ( this.views[ choice.id ] ) return;

		var url = choice.get_image();
		if ( ! url || this.preloaded[ url ] ) return;

		this.preloaded[ url ] = true;
		var img = new Image();
		img.src = url;
	},

	remove: function() {
		_.each( _.keys( this.views ), function( id ) {
			this.remove_view( id );
		}, this );
		return Backbone.View.prototype.remove.apply( this, arguments );
	}
});
