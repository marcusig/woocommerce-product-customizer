( function( $ ) {
	if ( ! window.wp || ! wp.hooks ) return;

	var from_spy = false;
	var spy_locked = false;
	var spy_lock_token = 0;
	var scroll_frame = 0;
	var scroll_handler = null;
	var bound_container = null;

	wp.hooks.addAction( 'PC.fe.before_open', 'MKL/PC/Themes/ev', function() {
		if ( PC.fe && PC.fe.config ) {
			PC.fe.config.show_layer_description = true;
		}
	} );

	wp.hooks.addFilter( 'PC.fe.choices.where', 'MKL/PC/Themes/ev', function() {
		return 'in';
	} );

	wp.hooks.addFilter( 'PC.fe.layer.self_hide', 'MKL/PC/Themes/ev', function( allow, view ) {
		if ( view && view.model && 'dropdown' === view.model.get( 'display_mode' ) ) {
			return allow;
		}
		return false;
	} );

	wp.hooks.addFilter( 'PC.fe.close_choices_after_selection', 'MKL/PC/Themes/ev', function() {
		return false;
	} );

	wp.hooks.addFilter( 'mkl_pc_conditionals.toggle_choices', 'MKL/PC/Themes/ev', function() {
		return false;
	} );

	wp.hooks.addAction( 'PC.fe.start', 'MKL/PC/Themes/ev', function( view ) {
		if ( ! view || ! view.$el ) return;
		view.$el.addClass( 'ev' );
		if ( view.footer && view.toolbar && view.toolbar.$selection ) {
			view.footer.$el.insertAfter( view.toolbar.$selection );
		}
		bind_scroll_activation( view );
	}, 30 );

	wp.hooks.addAction( 'PC.fe.layers_list.layers.added', 'MKL/PC/Themes/ev', function() {
		schedule_update();
	} );

	wp.hooks.addAction( 'PC.fe.layers_list.layers.added.deferred', 'MKL/PC/Themes/ev', function() {
		schedule_update();
	} );

	wp.hooks.addAction( 'PC.fe.layer.render', 'MKL/PC/Themes/ev', function( layer ) {
		bind_dropdown( layer );
	} );

	wp.hooks.addAction( 'PC.fe.layer.activate', 'MKL/PC/Themes/ev', function( view ) {
		if ( view && view.popper ) {
			window.requestAnimationFrame( function() {
				view.popper.update();
			} );
		}
		if ( from_spy || spy_locked || ! view || ! view.el ) return;
		if ( view.model && 'dropdown' === view.model.get( 'display_mode' ) ) return;
		scroll_layer_to_line( view.el );
	} );

	wp.hooks.addAction( 'PC.fe.layer.deactivate', 'MKL/PC/Themes/ev', function( view ) {
		if ( view && view.popper ) view.popper.update();
	} );

	wp.hooks.addAction( 'PC.fe.choice.set_choice', 'MKL/PC/Themes/ev', function( model, choice_view, details ) {
		if ( ! details || 'user' !== details.origin || ! model || ! PC.fe.layers ) return;
		var layer = PC.fe.layers.get( model.get( 'layerId' ) );
		if ( ! layer ) return;
		activate_model( layer );
	} );

	/**
	 * Watch the scrollport and mark the layer that has reached the activation line.
	 *
	 * @param {Backbone.View} view Configurator view.
	 */
	function bind_scroll_activation( view ) {
		if ( scroll_handler ) {
			window.removeEventListener( 'scroll', scroll_handler );
			window.removeEventListener( 'resize', scroll_handler );
			if ( bound_container ) {
				bound_container.removeEventListener( 'scroll', scroll_handler );
			}
		}

		scroll_handler = function() {
			if ( spy_locked ) return;
			schedule_update();
		};

		window.addEventListener( 'scroll', scroll_handler, { passive: true } );
		window.addEventListener( 'resize', scroll_handler );
		bound_container = view.$( '.mkl_pc_container' ).get( 0 ) || null;
		if ( bound_container ) {
			bound_container.addEventListener( 'scroll', scroll_handler, { passive: true } );
		}
		schedule_update();
	}

	function schedule_update() {
		if ( scroll_frame ) return;
		scroll_frame = window.requestAnimationFrame( function() {
			scroll_frame = 0;
			update_active_layer();
		} );
	}

	function update_active_layer() {
		if ( spy_locked || ! PC.fe || ! PC.fe.modal ) return;
		if ( document.querySelector( '.mkl_pc.ev li.layers-list-item.display-mode-dropdown.active' ) ) return;
		var active_element = document.activeElement;
		if ( active_element && /^(INPUT|TEXTAREA|SELECT)$/.test( active_element.tagName ) ) return;

		var item = layer_at_line();
		if ( ! item ) return;
		var layer_view = $( item ).data( 'view' );
		if ( ! layer_view || ! layer_view.model ) return;

		from_spy = true;
		activate_model( layer_view.model );
		from_spy = false;
	}

	/**
	 * The last visible layer whose top has crossed the activation line.
	 *
	 * @return {HTMLElement|null}
	 */
	function layer_at_line() {
		var root = scroll_root();
		var line = activation_line( root );
		var items = document.querySelectorAll( '.mkl_pc.ev .layers-list-item' );
		var chosen = null;
		var first_visible = null;

		for ( var index = 0; index < items.length; index++ ) {
			var item = items[ index ];
			if ( ! is_layer_eligible( item ) ) continue;
			if ( ! first_visible ) first_visible = item;
			if ( item.getBoundingClientRect().top <= line ) {
				chosen = item;
			}
		}

		return chosen || first_visible;
	}

	function is_layer_eligible( item ) {
		if ( item.classList.contains( 'hide_in_configurator' ) ) return false;
		if ( item.classList.contains( 'not-a-choice' ) ) return false;
		if ( item.classList.contains( 'type-summary' ) ) return false;
		if ( item.offsetHeight < 1 ) return false;
		var layer_view = $( item ).data( 'view' );
		if ( ! layer_view || ! layer_view.model ) return false;
		if ( layer_view.model.get( 'is_step' ) ) return false;
		if ( layer_view.model.get( 'not_a_choice' ) ) return false;
		if ( 'dropdown' === layer_view.model.get( 'display_mode' ) ) return false;
		return true;
	}

	/**
	 * Place a dropdown layer's choices above or below its button.
	 *
	 * @param {Backbone.View} layer Layer view.
	 */
	function bind_dropdown( layer ) {
		if ( ! layer || ! layer.model || 'dropdown' !== layer.model.get( 'display_mode' ) ) return;
		if ( layer.popper || ! window.Popper ) return;

		var reference = layer.$( '> button.layer-item' ).get( 0 );
		var menu = layer.$( '> .layer_choices' ).get( 0 );
		if ( ! reference || ! menu ) return;

		var boundary = document.querySelector( '.mkl_pc.ev .mkl_pc_container' ) || 'clippingParents';

		layer.popper = window.Popper.createPopper( reference, menu, {
			placement: 'bottom-start',
			modifiers: [
				{
					name: 'offset',
					options: { offset: [ 0, 4 ] }
				},
				{
					name: 'flip',
					options: {
						fallbackPlacements: [ 'top-start' ],
						boundary: boundary
					}
				},
				{
					name: 'preventOverflow',
					options: {
						boundary: boundary,
						padding: 8
					}
				},
				{
					name: 'eventListeners',
					options: {
						scroll: true,
						resize: true
					}
				}
			]
		} );
	}

	/**
	 * @param {Window|HTMLElement} root
	 * @return {number}
	 */
	function activation_line( root ) {
		var root_top = root === window ? 0 : root.getBoundingClientRect().top;
		var root_height = root === window ? window.innerHeight : root.clientHeight;
		var desktop = window.matchMedia( '(min-width: 960px)' ).matches;
		if ( desktop ) {
			var header = document.querySelector( '.mkl_pc.ev .mkl_pc_toolbar > header' );
			if ( header ) {
				return Math.max( header.getBoundingClientRect().bottom + 28, root_top + 72 );
			}
			return root_top + 96;
		}
		var viewer = document.querySelector( '.mkl_pc.ev .mkl_pc_viewer' );
		if ( viewer ) {
			return Math.min( viewer.getBoundingClientRect().bottom + 12, root_top + ( root_height * 0.75 ) );
		}
		return root_top + ( root_height * 0.42 );
	}

	/**
	 * @return {Window|HTMLElement}
	 */
	function scroll_root() {
		if ( PC.fe.inline ) return window;
		var container = document.querySelector( '.mkl_pc.ev .mkl_pc_container' );
		return container || window;
	}

	/**
	 * Bring a layer's title up to the activation line after a click.
	 *
	 * @param {HTMLElement} element
	 */
	function scroll_layer_to_line( element ) {
		var root = scroll_root();
		var delta = element.getBoundingClientRect().top - activation_line( root );
		if ( Math.abs( delta ) < 12 ) return;

		spy_locked = true;
		var token = ++spy_lock_token;
		var behavior = window.matchMedia( '(prefers-reduced-motion: reduce)' ).matches ? 'auto' : 'smooth';
		if ( root === window ) {
			window.scrollBy( { top: delta, behavior: behavior } );
		} else {
			root.scrollBy( { top: delta, behavior: behavior } );
		}

		var release = function() {
			if ( token !== spy_lock_token ) return;
			spy_locked = false;
			if ( root !== window ) {
				root.removeEventListener( 'scrollend', release );
			} else {
				window.removeEventListener( 'scrollend', release );
			}
		};

		if ( root === window ) {
			window.addEventListener( 'scrollend', release );
		} else {
			root.addEventListener( 'scrollend', release );
		}
		window.setTimeout( release, 700 );
	}

	/**
	 * Mark one layer active without toggling it off.
	 *
	 * @param {Backbone.Model} model
	 */
	function activate_model( model ) {
		if ( ! model || model.get( 'active' ) || model.get( 'not_a_choice' ) || model.get( 'is_step' ) ) return;
		model.collection.each( function( other ) {
			if ( other !== model && other.get( 'active' ) ) {
				other.set( 'active', false );
			}
		} );
		model.set( 'active', true );
		PC.fe.current_layer = model;
	}
}( jQuery ) );
