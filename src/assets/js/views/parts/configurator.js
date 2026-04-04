/*
	PC.fe.views.configurator 
	-> MAIN WINDOW
*/
PC.fe.views.configurator = Backbone.View.extend({
	tagName: 'div',
	className: 'mkl_pc',
	template: wp.template( 'mkl-pc-configurator' ), 
	initialize: function( options ) {
		this.options = options;
		this.product_id = options.product_id;
		this.parent_id = options.parent_id;
		wp.hooks.doAction( 'PC.fe.init.modal', this ); 
		
		if ( this.parent_id && 'async' !== PC.fe.config.data_mode ) {
			this.options = PC.productData['prod_' + this.parent_id].product_info; 
		} else {
			this.options = PC.productData['prod_' + this.product_id].product_info; 
		}

		try {
			this.render();
		} catch (err) {
			console.log ('There was an error when rendering the configurator: ', err);
		}
		return this; 
	},
	events: {
		'content-is-loaded': 'start',
		'click .close-mkl-pc': 'close',
	},
	focusable_selector: 'a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]):not([tabindex="-1"]), [tabindex]:not([tabindex="-1"])',
	render: function() {
		if ( PC.fe.a11y.modal_focusable_selector ) {
			this.focusable_selector = PC.fe.a11y.modal_focusable_selector;
		}
		if( PC.fe.inline == true && $(PC.fe.inlineTarget).length > 0 ) {
			$(PC.fe.inlineTarget).empty().append(this.$el);
		} else if ( PC.fe.config.inline == true && $(PC.fe.config.inlineTarget).length > 0 ) {
			$(PC.fe.config.inlineTarget).append(this.$el);
			PC.fe.inline = true;
		} else {
			$('body').append(this.$el);
			PC.fe.inline = false;
		}

		if ( PC.fe.config.choice_description_no_tooltip ) {
			this.$el.addClass( 'no-tooltip' );
		}

		this.$el.append( this.template( { bg_image: wp.hooks.applyFilters( 'PC.fe.config.bg_image', PC.fe.config.bg_image, this ) } ) ); 
		this.$main_window = this.$el.find( '.mkl_pc_container' );

		if ( ! PC.fe.inline ) {
			this.$main_window.attr( {
				role: 'dialog',
				'aria-modal': 'true'
			} );
			this.$main_window.removeAttr( 'aria-label' );
		} else {
			var inlineRegionLabel = ( typeof PC_config !== 'undefined' && PC_config.lang && PC_config.lang.inline_region_aria_label ) ? PC_config.lang.inline_region_aria_label : 'Product configurator';
			this.$main_window.attr( {
				role: 'region',
				'aria-label': inlineRegionLabel
			} );
			this.$main_window.removeAttr( 'aria-modal aria-labelledby' );
		}
		if ( ! this.$main_window.find( '.mkl-pc-live-region' ).length ) {
			this.$main_window.append( '<div class="mkl-pc-live-region screen-reader-text" aria-live="polite" aria-atomic="true"></div>' );
		}
		return this.$el; 
	},
	open: function() {
		this.$el.show(); 

		setTimeout( _.bind( this.$el.addClass, this.$el, 'opened' ), 10 );

		this.previously_focused_el = document.activeElement;
		this.trigger_el = PC.fe.trigger_el;

		// Set focus on the first layer
		if ( wp.hooks.applyFilters( 'PC.fe.setup_keyboard_navigation', true ) ) {
			$( document ).on( 'keydown.mkl-pc-modal', this.handle_configurator_keydown.bind( this ) );
			if ( !PC.fe.inline ) {
				this.apply_initial_focus();
				setTimeout( this.apply_initial_focus.bind( this ), 500 );
			}
		}
		wp.hooks.doAction( 'PC.fe.open', this ); 
	},
	close: function() {
		PC.fe.opened = false; 
		// Remove classes
		this.$el.removeClass( 'opened' ); 
		$('body').removeClass('configurator_is_opened');

		// Empty the form fields to prevent adding the configuration to the cart by mistake (only if the configurator doesn't automatically close, as that would empty the field)
		if ( ! PC.fe.config.close_configurator_on_add_to_cart ) $( 'input[name=pc_configurator_data]' ).val( '' );
		$( document ).off( 'keydown.mkl-pc-modal' );

		wp.hooks.doAction( 'PC.fe.close', this ); 

		setTimeout( _.bind( this.$el.hide, this.$el ), 500 );
		if ( ! PC.fe.inline ) this.restore_focus();
	},

	start: function( e, arg ) {
		if ( this.toolbar ) this.toolbar.remove();
		if ( this.viewer ) this.viewer.remove();
		if ( this.footer ) this.footer.remove();
		const Viewer_View = wp.hooks.applyFilters( 'PC.fe.viewer.main_view', PC.fe.views.viewer );
		this.viewer = new Viewer_View( { parent: this } );
		this.$main_window.append( this.viewer.render() );
		
		if ( ! PC.fe.angles.length || ! PC.fe.layers.length || ! PC.fe.contents.content.length ) {
			var message = $( '<div class="error configurator-error" />' ).text( 'The product configuration seems incomplete. Please make sure Layers, angles and content are set.' );
			if ( ! PC.fe.config.inline ) {
				$( PC.fe.trigger_el ).after( message );
				this.close();
				PC.fe.active_product = false;
			} else {
				$( PC.fe.trigger_el ).append( message );
			}
			return;
		}

		if ( arg == 'no-content' ) {
			this.toolbar = new PC.fe.views.empty_viewer();
			this.viewer.$el.append( this.toolbar.render() );
		} else {
			this.toolbar = new PC.fe.views.toolbar( { parent: this } );
			this.footer = new PC.fe.views.footer( { parent: this } );

			this.$main_window.append( this.toolbar.render() ); 
			this.$main_window.append( this.footer.render() );
		}

		this.refresh_main_window_accessibility();

		// this.summary = new PC.fe.views.summary();
		// this.$main_window.append( this.summary.$el );

		var images = this.viewer.$el.find( 'img' ),
			imagesLoaded = 0,
			that = this;
		
		/*
		$(PC.fe).trigger( 'start.loadingimages', that ); 
		wp.hooks.doAction( 'PC.fe.start.loadingimages', that ); 
		console.log('start loading images.'); 
		this.viewer.$el.addClass('is-loading-image'); 
		images.each(function(index, el) {
			$(el).on('load', function( e ){
				imagesLoaded++; 
				if( imagesLoaded == images.length ) {
					console.log('remove loading class images');	
					that.viewer.$el.removeClass('is-loading-image');
				}					
			});
		});
		*/
		$( PC.fe ).trigger( 'start', this );
		wp.hooks.doAction( 'PC.fe.start', this ); 
		this.open();
	},
	resetConfig: function() {
		// Reset the configuration
		PC.fe.contents.content.resetConfig();

		// Maybe load the initial preset
		if ( PC.fe.initial_preset ) {
			PC.fe.setConfig( PC.fe.initial_preset );
		}
		
		// Maybe reset the view
		if ( 1 < PC.fe.angles.length ) {
			PC.fe.angles.each( function( model ) {
				model.set('active' , false); 
			} );
			PC.fe.angles.first().set( 'active', true ); 
		}

		// Trigger an action after reseting
		wp.hooks.doAction( 'PC.fe.reset_configurator' );
	},
	refresh_main_window_accessibility: function() {
		if ( ! this.$main_window || ! this.$main_window.length ) return;
		var $label = this.$el.find( '.mkl_pc_toolbar header .product-name, .product-name' ).first();
		if ( ! $label.length ) return;
		if ( ! $label.attr( 'id' ) ) {
			$label.attr( 'id', 'mkl-pc-dialog-title-' + this.product_id );
		}
		this.$main_window.attr( 'aria-labelledby', $label.attr( 'id' ) );
		var $description = this.$el.find( '.mkl_pc_toolbar #mkl-pc-dialog-instructions-' + this.product_id ).first();
		if ( $description.length ) {
			this.$main_window.attr( 'aria-describedby', $description.attr( 'id' ) );
		} else {
			this.$main_window.removeAttr( 'aria-describedby' );
		}
		if ( ! PC.fe.inline ) this.$main_window.removeAttr( 'aria-label' );
	},
	restore_focus: function() {
		if ( this.trigger_el && $( this.trigger_el ).length ) {
			PC.fe.a11y.focus_without_scroll( $( this.trigger_el ) );
			return;
		}
		if ( this.previously_focused_el && document.contains( this.previously_focused_el ) ) {
			PC.fe.a11y.focus_without_scroll( $( this.previously_focused_el ) );
		}
	},
	get_initial_focus_target: function() {
		var $scope = this.$main_window && this.$main_window.length ? this.$main_window : this.$el;
		if ( ! $scope || ! $scope.length ) return $();

		// 1) Toolbar header (tabindex -1 — valid programmatic focus target).
		var $header = $scope.find( '.mkl_pc_toolbar > header' ).first();
		if ( $header.length && $header.is( ':visible' ) ) {
			return $header;
		}

		// 2) First visible layer row: primary layer button, then choices in that layer, then nested layer buttons.
		var $first_visible_layer = $scope.find( '.layers .layers-list-item:visible:not(.hide_in_configurator)' ).first();
		if ( $first_visible_layer.length ) {
			var $first_layer_button = $first_visible_layer.find( '> button.layer-item:visible:not(:disabled)' ).first();
			if ( $first_layer_button.length && PC.fe.a11y.is_focusable_enabled( $first_layer_button ) ) {
				return $first_layer_button;
			}

			var first_layer_id = $first_visible_layer.attr( 'data-layer' );
			if ( first_layer_id ) {
				var $layerChoices = $scope.find( '#mkl-pc-layer-choices-' + first_layer_id );
				var $first_input = PC.fe.a11y.filter_focusable( $layerChoices.find( '.choice-item-input' ) ).first();
				if ( $first_input.length ) return $first_input;
				var $first_choice = PC.fe.a11y.filter_focusable( $layerChoices.find( '.choice-item' ) ).first();
				if ( $first_choice.length ) return $first_choice;
			}

			var $nested_layer_button = $first_visible_layer.find( 'button.layer-item:visible:not(:disabled)' ).first();
			if ( $nested_layer_button.length && PC.fe.a11y.is_focusable_enabled( $nested_layer_button ) ) {
				return $nested_layer_button;
			}
		}

		var $layer_button = $scope.find( '.layers .layers-list-item:visible:not(.hide_in_configurator) > button.layer-item:visible:not(:disabled)' ).first();
		if ( $layer_button.length && PC.fe.a11y.is_focusable_enabled( $layer_button ) ) return $layer_button;

		// 3) First choice in any open choices panel (inputs preferred for form-like layers).
		var $choice_input = PC.fe.a11y.filter_focusable( $scope.find( '.layer_choices:visible .choice-item-input' ) ).first();
		if ( $choice_input.length ) return $choice_input;
		var $choice_button = PC.fe.a11y.filter_focusable( $scope.find( '.layer_choices:visible .choice-item' ) ).first();
		if ( $choice_button.length ) return $choice_button;

		// 4) First generic focusable in the modal.
		var $focusable = PC.fe.a11y.filter_focusable( $scope.find( this.focusable_selector ) ).first();
		if ( $focusable.length ) return $focusable;

		return this.$main_window && this.$main_window.length ? this.$main_window : $();
	},
	
	apply_initial_focus: function() {
		if ( PC.fe.inline ) return;
		var $target = this.get_initial_focus_target();
		if ( $target && $target.length ) {
			PC.fe.a11y.focus_without_scroll( $target );
		}
	},

	/**
	 * Visible, enabled focusables (delegates to PC.fe.a11y.filter_focusable).
	 */
	filter_modal_focusable: function( $collection ) {
		return PC.fe.a11y.filter_focusable( $collection );
	},
	
	/**
	 * Tab order for drawer-style choices: all focusables inside .choices-list, then .choices-close.
	 */
	get_drawer_choices_tab_cycle: function( $layerChoices ) {
		var $listFocusable = this.filter_modal_focusable( $layerChoices.find( '.choices-list' ).first().find( this.focusable_selector ) );
		var $close = $layerChoices.find( '.choices-close' ).filter( ':visible' );
		var cycle = [];
		$listFocusable.each( function() {
			cycle.push( this );
		} );
		if ( $close.length ) {
			cycle.push( $close[0] );
		}
		return cycle;
	},
	handle_configurator_keydown: function( event ) {
		if ( ! this.$el.is( ':visible' ) ) return;
		if ( 'Escape' === event.key ) {
			// Nested SYD/Share modals handle Escape themselves.
			if ( $( 'body' ).hasClass( 'syd-modal-opened' ) || $( 'body' ).hasClass( 'syd-share-modal-opened' ) ) {
				return;
			}
			if ( $( 'body' ).hasClass( 'mkl-pc-showing-advanced-description' ) || $( '.mkl-pc-advanced-description--container' ).length ) {
				return;
			}
			var $activeLayer = this.$main_window.find( '.layers .layers-list-item.active:visible:not(.hide_in_configurator)' ).first();
			if ( $activeLayer.length ) {
				var activeLayerView = $activeLayer.data( 'view' );
				if ( activeLayerView && activeLayerView.choices_location && 'in' !== activeLayerView.choices_location ) {
					var $focusTarget = activeLayerView.$( '> button.layer-item:visible:not(:disabled)' ).first();
					if ( ! $focusTarget.length ) {
						$focusTarget = this.$main_window;
					}
					activeLayerView.show_choices( null );
					event.preventDefault();
					setTimeout( function() {
						PC.fe.a11y.focus_without_scroll( $focusTarget );
					}, 0 );
					return;
				}
			}
			if ( PC.fe.inline ) return;
			event.preventDefault();
			this.close();
			return;
		}
		if ( 'Tab' !== event.key ) return;

		var activeEl = document.activeElement;
		var $layerChoices = $( activeEl ).closest( '.layer_choices.active' );
		if ( $layerChoices.length ) {
			var choicesId = $layerChoices.attr( 'id' ) || '';
			var layerIdMatch = choicesId.match( /^mkl-pc-layer-choices-(.+)$/ );
			var layerView = null;
			if ( layerIdMatch ) {
				var $layerLi = this.$main_window.find( '.layers .layers-list-item[data-layer="' + layerIdMatch[1] + '"]' ).first();
				layerView = $layerLi.data( 'view' );
			}
			if ( layerView && layerView.choices_location && 'in' !== layerView.choices_location ) {
				var cycle = this.get_drawer_choices_tab_cycle( $layerChoices );
				if ( cycle.length ) {
					var idx = cycle.indexOf( activeEl );
					if ( idx !== -1 ) {
						event.preventDefault();
						var next;
						if ( event.shiftKey ) {
							next = idx === 0 ? cycle[ cycle.length - 1 ] : cycle[ idx - 1 ];
						} else {
							next = idx === cycle.length - 1 ? cycle[0] : cycle[ idx + 1 ];
						}
						PC.fe.a11y.focus_without_scroll( $( next ) );
						return;
					}
				}
			}
		}

		if ( PC.fe.inline ) return;

		// Focus cycling
		var $focusable = PC.fe.a11y.filter_focusable( this.$main_window.find( this.focusable_selector ) );
		if ( ! $focusable.length ) return;
		var first = $focusable[0];
		var last = $focusable[ $focusable.length - 1 ];
		if ( event.shiftKey && document.activeElement === first ) {
			event.preventDefault();
			PC.fe.a11y.focus_without_scroll( $( last ) );
		} else if ( ! event.shiftKey && document.activeElement === last ) {
			event.preventDefault();
			PC.fe.a11y.focus_without_scroll( $( first ) );
		}
	}
});

PC.fe.views.empty_viewer = Backbone.View.extend({
	tagName: 'div', 
	className: 'nothing-selected',
	template: wp.template( 'mkl-pc-configurator-empty-viewer' ), 
	initialize: function( options ) { 
		return this; 
	},
	render: function() { 
		this.$el.append( this.template() );
		return this.$el; 
	},
});
