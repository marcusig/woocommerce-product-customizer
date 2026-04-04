	PC.fe.a11y = PC.fe.a11y || {};

	if ( ! PC.fe.a11y.focus_without_scroll ) {
		PC.fe.a11y.focus_without_scroll = function( $target ) {
			if ( ! $target || ! $target.length ) return;
			var el = $target.get( 0 );
			if ( ! el || ! el.focus ) return;
			try {
				el.focus( { preventScroll: true } );
			} catch ( error ) {
				el.focus();
			}
		};
	}

	/**
	 * Modal / toolbar focusable selector (excludes tabindex="-1", e.g. inner choice buttons).
	 */
	PC.fe.a11y.modal_focusable_selector = 'a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]):not([tabindex="-1"]), [tabindex]:not([tabindex="-1"])';

	/**
	 * Narrow selector for first focus inside a choices panel (inputs + non-skipped buttons).
	 */
	PC.fe.a11y.choices_panel_focusable_selector = 'input, select, textarea, button:not([disabled]):not([tabindex="-1"]), [tabindex]:not([tabindex="-1"])';

	PC.fe.a11y.is_focusable_enabled = function( el ) {
		var $el = $( el );
		if ( ! $el.length ) return false;
		if ( $el.is( ':disabled' ) ) return false;
		if ( 'true' === $el.attr( 'aria-disabled' ) ) return false;
		if ( $el.is( 'input[type="hidden"]' ) ) return false;
		return true;
	};

	PC.fe.a11y.filter_focusable = function( $collection ) {
		return $collection.filter( ':visible' ).filter( function() {
			return PC.fe.a11y.is_focusable_enabled( this );
		} );
	};

	/**
	 * Focus first visible enabled control in $scope matching selector (default: choices panel set).
	 */
	PC.fe.a11y.focus_first_in_scope = function( $scope, selector ) {
		if ( ! $scope || ! $scope.length ) return $();
		selector = selector || PC.fe.a11y.choices_panel_focusable_selector;
		var $target = PC.fe.a11y.filter_focusable( $scope.find( selector ) ).first();
		if ( $target.length ) {
			PC.fe.a11y.focus_without_scroll( $target );
		}
		return $target;
	};

	/**
	 * Run focusFn after .layer_choices transition when active, else after a short delay.
	 */
	PC.fe.a11y.focus_after_panel_transition = function( $panel, focusFn, options ) {
		options = options || {};
		var timeoutMs = options.timeoutMs !== undefined ? options.timeoutMs : 350;
		var delayIfInactive = options.delayIfInactive !== undefined ? options.delayIfInactive : 50;
		var namespace = options.namespace || 'mklPcFocus';
		if ( ! $panel || ! $panel.length || ! $panel.hasClass( 'active' ) ) {
			setTimeout( focusFn, delayIfInactive );
			return;
		}
		var done = false;
		var cleanup = function() {
			$panel.off( 'transitionend.' + namespace );
		};
		var finish = function() {
			if ( done ) return;
			done = true;
			cleanup();
			focusFn();
		};
		$panel.on( 'transitionend.' + namespace, function( event ) {
			if ( event && event.target !== $panel.get( 0 ) ) return;
			finish();
		} );
		setTimeout( function() {
			cleanup();
			finish();
		}, timeoutMs );
	};

	if ( ! PC.fe.goto ) {
		/**
		 * Navigate to a layer / choice, opening its parent hierarchy if needed.
		 * Intended for validation, summary navigation, etc.
		 */
		PC.fe.goto = function( item, options ) {
			options = options || {};
			var modal = PC.fe.modal || {};

			var $container = options.$container || ( modal.$main_window && modal.$main_window.length ? modal.$main_window : $() );
			if ( ! $container.length ) $container = $( '.mkl_pc.opened .mkl_pc_container' ).first();
			if ( ! $container.length ) $container = $( '.mkl_pc .mkl_pc_container:visible' ).first();

			var layerId = null;
			if ( item ) {
				// Choice model
				if ( item.get && item.get( 'layerId' ) !== undefined && item.get( 'layerId' ) !== null ) {
					layerId = item.get( 'layerId' );
				// Layer model
				} else if ( item.id !== undefined && item.get && item.get( 'type' ) !== undefined ) {
					layerId = item.id;
				// Plain object
				} else if ( item.layerId !== undefined && item.layerId !== null ) {
					layerId = item.layerId;
				} else if ( item._id !== undefined && item._id !== null ) {
					layerId = item._id;
				}
			}

			var layers = options.layers || PC.fe.layers;
			if ( ! layers || ! layerId ) {
				if ( options.focusEl && options.focusEl.length ) {
					setTimeout( function() { PC.fe.a11y.focus_without_scroll( options.focusEl ); }, 500 );
				}
				return false;
			}

			var layer = layers.get ? layers.get( layerId ) : null;
			if ( ! layer ) {
				if ( options.focusEl && options.focusEl.length ) {
					setTimeout( function() { PC.fe.a11y.focus_without_scroll( options.focusEl ); }, 500 );
				}
				return false;
			}

			// Build hierarchy from root -> leaf
			var hierarchy = [];
			var cursor = layer;
			var guard = 0;
			while ( cursor && guard++ < 50 ) {
				hierarchy.unshift( cursor.id );
				var parentId = cursor.get ? cursor.get( 'parent' ) : null;
				if ( ! parentId ) break;
				cursor = ( cursor.collection && cursor.collection.get ) ? cursor.collection.get( parentId ) : ( layers.get ? layers.get( parentId ) : null );
			}

			// Activate each layer in order
			_.each( hierarchy, function( id ) {
				var layer_model = layers.get ? layers.get( id ) : null;
				var is_active = layer_model && layer_model.get ? ( true === layer_model.get( 'active' ) ) : false;
				var $li = $container.find( '.layers-list-item[data-layer="' + id + '"]' ).first();
				if ( ! $li.length && modal.$el && modal.$el.length ) {
					$li = modal.$el.find( '.layers-list-item[data-layer="' + id + '"]' ).first();
				}
				if ( $li.length ) {
					if ( ! is_active && $li.hasClass( 'active' ) ) is_active = true;
					if ( is_active ) return;
					var view = $li.data( 'view' );
					if ( view && view.show_choices ) {
						view.show_choices( null, true );
					} else {
						// Avoid toggling closed: only click if not active
						$li.find( '> button.layer-item' ).first().trigger( 'click' );
					}
				}
			} );

			// Focus after UI settles (panel transitions can otherwise force scrolling).
			var $focusTarget = $();
			if ( options.focusEl && options.focusEl.length ) {
				$focusTarget = options.focusEl.first();
			} else if ( options.focusChoice && item && item.get && $container.length && PC.fe.validation.get_choice_target ) {
				$focusTarget = PC.fe.validation.get_choice_target( $container, item );
			}
			if ( $focusTarget && $focusTarget.length ) {
				var $panel = $focusTarget.closest( '.layer_choices' );
				PC.fe.a11y.focus_after_panel_transition( $panel, function() {
					PC.fe.a11y.focus_without_scroll( $focusTarget );
				}, {
					namespace: 'mklPcGotoFocus',
					timeoutMs: 350,
					delayIfInactive: 50,
				} );
			}

			return true;
		};
	}

	if ( ! PC.fe.a11y.announce ) {
		PC.fe.a11y._announce_state = PC.fe.a11y._announce_state || { last_message: '', last_ts: 0 };
		PC.fe.a11y.announce = function( message, options ) {
			if ( ! message ) return;
			options = options || {};
			var dedupe_window = typeof options.dedupe_window === 'number' ? options.dedupe_window : 700;
			var normalized = String( message ).replace( /\s+/g, ' ' ).trim();
			if ( ! normalized ) return;
			var now = Date.now();
			if ( PC.fe.a11y._announce_state.last_message === normalized && ( now - PC.fe.a11y._announce_state.last_ts ) < dedupe_window ) {
				return;
			}
			var $region = $( '.mkl-pc-live-region' ).first();
			if ( ! $region.length ) return;
			PC.fe.a11y._announce_state.last_message = normalized;
			PC.fe.a11y._announce_state.last_ts = now;
			$region.text( '' );
			setTimeout( function() {
				$region.text( normalized );
			}, 15 );
		};
	}
