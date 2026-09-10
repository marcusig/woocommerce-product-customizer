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
		// Whatever the outcome, anything waiting on this image now has its answer.
		this.settle();
		// An active choice with nothing to show at this angle is still handed a
		// src - the transparent placeholder - and this is the only load it will
		// ever report. It stays "not loaded", so a later angle gets it its real
		// image, but it does have to be counted off: it was counted when the
		// placeholder was set, and the viewer would otherwise be loading for good.
		if (this.empty_img == this.$el.prop('src')) return this.release();
		this.is_loaded = true;

		if ( 'load' == e.type ) wp.hooks.doAction( 'PC.fe.viewer.layer.preload.complete', this );

		this.release();
	},
	/**
	 * Count this image off the viewer's tally of images being loaded.
	 *
	 * Only images that were counted when their src was set may count down again.
	 * An inactive image also gets a src, but was never added to imagesLoading:
	 * decrementing for it drove the counter below zero, so it never came back to
	 * 0 and the viewer kept its `is-loading-image` class.
	 */
	release: function() {
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
		this.is_removed = true;
		// An image removed before it loaded is never going to appear: release
		// anything that was waiting for it, or the wait only ends on its timeout.
		this.settle();
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
	/**
	 * Call back once this image has finished loading - or once it is settled that
	 * it never will (it failed, or it was removed while still on its way).
	 *
	 * This is how the image being replaced knows when it may leave the screen;
	 * see viewer_layer_pool.wait_for().
	 *
	 * @param {Function} callback Receives this view.
	 */
	on_settled: function( callback ) {
		if ( this.is_loaded || this.is_removed ) return callback( this );
		this.settle_callbacks = this.settle_callbacks || [];
		this.settle_callbacks.push( callback );
	},

	settle: function() {
		if ( ! this.settle_callbacks ) return;
		var callbacks = this.settle_callbacks;
		this.settle_callbacks = null;
		_.each( callbacks, function( callback ) {
			callback( this );
		}, this );
	},

	/**
	 * Keep showing this image after its choice has been deselected.
	 *
	 * The view stops following its model - the model is inactive now, and
	 * rendering that would blank the image, which is the very thing the caller is
	 * holding it for - and it is put back in the state it was in when it was the
	 * selected choice.
	 *
	 * That last part is not belt and braces: a model's own listeners run before
	 * the ones its collection proxies, so this view has already reacted to the
	 * deselection and dropped its `active` class by the time the pool gets to
	 * call this. Nothing has been painted in between - it is all one turn - so
	 * putting the class back leaves no trace, and the image is never taken off
	 * the screen. It keeps the picture it has until remove() is called.
	 */
	retire: function() {
		this.is_retired = true;
		this.stopListening();
		// It is on its way out, so it is no longer a landmark for insert_image():
		// where it sits is decided by the image that replaces it.
		this.$el.removeAttr( 'data-mkl-sorted' );
		this.$el.removeClass( 'loading' ).addClass( 'active retired' );
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
	/**
	 * Keep this HTML on screen until the image it belongs with leaves.
	 * See viewer_layer.retire().
	 */
	retire: function() {
		this.is_retired = true;
		this.stopListening();
		this.$el.removeAttr( 'data-mkl-sorted' );
		this.$el.addClass( 'active retired' ).show();
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
		// Images that are no longer selected but are still on screen, waiting for
		// what replaces them - see hold() and sweep().
		this.held = [];
		this.incoming = [];
		this.waits = [];
		this.sweep_scheduled = false;

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
	 *
	 * Adding happens here and now; removing is decided at the end of the turn, by
	 * sweep(). A choice change reaches this in two steps - the old choice goes
	 * inactive, then the new one goes active - and acting on the first would empty
	 * the layer before the second says what to put in its place.
	 */
	sync: function() {
		var wanted = {};
		_.each( this.get_visible_choices(), function( choice ) {
			wanted[ choice.id ] = choice;
		} );

		_.each( _.keys( this.views ), function( id ) {
			if ( wanted[ id ] ) return;
			this.hold( id );
		}, this );

		_.each( wanted, function( choice, id ) {
			if ( this.views[ id ] ) return;
			this.incoming.push( this.add_view( choice ) );
		}, this );

		this.schedule_sweep();
	},

	/**
	 * Take an image out of the layer, but leave it on the screen.
	 *
	 * It has to stop following its model right now, in this pass: the choice is
	 * already inactive, and the view's own listener has already run and taken the
	 * image out of sight - retire() puts it back. From here on it is a picture
	 * with nothing behind it, held by sweep() until its replacement takes over.
	 *
	 * @param {String|Number} id Choice id.
	 */
	hold: function( id ) {
		var view = this.views[ id ];
		var html_view = this.html_views[ id ];
		delete this.views[ id ];
		delete this.html_views[ id ];
		if ( ! view ) {
			if ( html_view ) html_view.remove();
			return;
		}
		if ( this.parent.layer_views ) delete this.parent.layer_views[ this.parent.view_key( view.model ) ];

		/**
		 * Whether an image stays up until the one replacing it has loaded.
		 *
		 * @param {Boolean} hold
		 * @param {Backbone.View} view
		 */
		var keep = wp.hooks.applyFilters( 'PC.fe.viewer.hold_previous_image', true, view, this );

		// Nothing to hold on to: a view that is not one of ours to freeze, or an
		// image that never made it to the screen in the first place.
		if ( ! keep || ! view.is_loaded || ! view.retire ) {
			view.remove();
			if ( html_view ) html_view.remove();
			return;
		}

		view.retire();
		this.held.push( view );
		if ( html_view && html_view.retire ) {
			html_view.retire();
			this.held.push( html_view );
		} else if ( html_view ) {
			html_view.remove();
		}
	},

	/**
	 * Decide what leaves the screen, once the whole selection change has been
	 * seen. Runs before the browser paints, so a layer that is simply going away
	 * does not linger for a frame.
	 */
	schedule_sweep: function() {
		if ( this.sweep_scheduled ) return;
		this.sweep_scheduled = true;
		var that = this;
		var run = function() { that.sweep(); };
		if ( 'undefined' !== typeof Promise ) Promise.resolve().then( run );
		else _.defer( run );
	},

	/**
	 * Send the images that were held on their way.
	 *
	 * They leave at once if nothing is on its way in - a choice deselected, a
	 * layer hidden by conditional logic. Otherwise they stay up until the images
	 * added in the same change have loaded.
	 */
	sweep: function() {
		this.sweep_scheduled = false;

		var that = this;
		var incoming = _.filter( this.incoming, function( view ) {
			// Still ours, and still not on screen: those are the ones worth waiting
			// for. One that loaded within the turn is already showing.
			return view && ! view.is_loaded && that.views[ view.model.id ] === view;
		} );
		this.incoming = [];

		var held = this.held;
		this.held = [];
		if ( ! held.length ) return;

		if ( ! incoming.length ) return this.drop( held );

		this.wait_for( incoming, held );
	},

	/**
	 * Hold `held` on screen until `incoming` has loaded.
	 *
	 * The images being loaded are transparent until they are ready - every theme
	 * hides `img.loading` - so what the customer sees for the length of the
	 * request is the picture they had, rather than the background.
	 *
	 * @param {Array} incoming Views still loading.
	 * @param {Array} held     Views to remove once they have.
	 */
	wait_for: function( incoming, held ) {
		var that = this;
		var wait = { held: held, pending: incoming.length, done: false, timer: null };
		this.waits.push( wait );

		// Underneath the images that replace them, so the new picture fades in over
		// the old one instead of over the background.
		_.each( held, function( view ) {
			incoming[ 0 ].$el.before( view.$el );
		} );

		// However the loading turns out, these images do leave: a request that
		// never completes must not strand a deselected choice on screen.
		wait.timer = setTimeout( function() {
			that.end_wait( wait );
		}, wp.hooks.applyFilters( 'PC.fe.viewer.swap_timeout', 5000, this ) );

		var settled = function( view ) {
			if ( 0 < --wait.pending ) return;
			// Let the new image finish fading in before taking the old one away.
			setTimeout( function() { that.end_wait( wait ); }, that.fade_duration( view ) );
		};

		_.each( incoming, function( view ) {
			if ( view.on_settled ) return view.on_settled( settled );
			settled( view );
		} );
	},

	end_wait: function( wait ) {
		if ( wait.done ) return;
		wait.done = true;
		if ( wait.timer ) clearTimeout( wait.timer );
		this.waits = _.without( this.waits, wait );
		this.drop( wait.held );
	},

	drop: function( views ) {
		_.each( views, function( view ) {
			view.remove();
		} );
	},

	/**
	 * How long the stylesheet takes to fade an image in, in milliseconds.
	 *
	 * Read off the element rather than assumed: every theme fades the viewer's
	 * images, but how long for is the theme's - or the store's - business.
	 *
	 * @param {Backbone.View} view
	 * @return {Number}
	 */
	fade_duration: function( view ) {
		if ( ! view || ! view.el || ! window.getComputedStyle ) return 0;
		var declared = window.getComputedStyle( view.el ).transitionDuration || '';
		var longest = 0;
		_.each( declared.split( ',' ), function( part ) {
			part = part.replace( /\s/g, '' );
			var value = parseFloat( part );
			if ( isNaN( value ) ) return;
			longest = Math.max( longest, -1 === part.indexOf( 'ms' ) ? value * 1000 : value );
		} );
		return longest;
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
		_.each( this.waits.slice(), function( wait ) {
			this.end_wait( wait );
		}, this );
		this.drop( this.held );
		this.held = [];
		this.incoming = [];
		_.each( _.keys( this.views ), function( id ) {
			this.remove_view( id );
		}, this );
		return Backbone.View.prototype.remove.apply( this, arguments );
	}
});
