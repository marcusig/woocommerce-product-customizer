/**
 * Narrow-view gestures: dismiss the mobile drawer, edge-swipe to open it from the modal’s
 * left edge, and edge-swipe “back” on stacked columns.
 *
 * Uses Pointer Events when available so responsive desktop / emulators (mouse drags) work;
 * falls back to Touch Events on older engines.
 */
var PC = PC || {};
PC.admin = PC.admin || {};

( function( $ ) {
	'use strict';

	var active_pointer = null;
	var listening = false;
	var min_horizontal = 56;
	var swipe_ratio = 1.25;
	/** Narrow band from the modal’s physical left for edge-open menu (avoids column back). */
	var menu_open_edge_min_px = 16;
	var menu_open_edge_max_px = 36;
	var menu_open_edge_width_ratio = 0.055;
	/**
	 * Column stack “back” swipe: strip from the column’s left edge, biased slightly toward center
	 * (fraction of column width, clamped).
	 */
	var column_back_edge_min_px = 52;
	var column_back_edge_max_px = 88;
	var column_back_edge_width_ratio = 0.28;
	/** Looser swipe for “open menu” only (easier on real devices). */
	var open_menu_min_horizontal = 40;
	var open_menu_swipe_ratio = 1.15;

	function is_narrow_breakpoint() {
		return typeof window.matchMedia === 'function' &&
			window.matchMedia( '(max-width: 900px)' ).matches;
	}

	function get_editor_states_view() {
		try {
			if ( ! window.PC || ! PC.app || typeof PC.app.get_admin !== 'function' ) {
				return null;
			}
			var admin = PC.app.get_admin();
			if ( ! admin || typeof admin.get_current_modal !== 'function' || ! admin.current_product ) {
				return null;
			}
			var editor = admin.get_current_modal();
			return editor && editor.statesView ? editor.statesView : null;
		} catch ( err ) {
			return null;
		}
	}

	function get_configurator_modal_root() {
		return document.querySelector( '.mkl-pc-admin-ui.pc-modal' );
	}

	function is_target_inside_modal( target, modal ) {
		return modal && target && typeof modal.contains === 'function' && modal.contains( target );
	}

	function get_modal_left_menu_open_cutoff_x( modal ) {
		if ( ! modal ) {
			return 0;
		}
		var rect = modal.getBoundingClientRect();
		var band = Math.max(
			menu_open_edge_min_px,
			Math.min( menu_open_edge_max_px, rect.width * menu_open_edge_width_ratio )
		);
		return rect.left + band;
	}

	function is_start_in_modal_left_edge_for_menu_open( start_x, start_target ) {
		var modal = get_configurator_modal_root();
		if ( ! is_target_inside_modal( start_target, modal ) ) {
			return false;
		}
		return start_x <= get_modal_left_menu_open_cutoff_x( modal );
	}

	function get_menu_open_back_exclusion_cutoff_x() {
		return get_modal_left_menu_open_cutoff_x( get_configurator_modal_root() );
	}

	function is_horizontal_swipe( delta_x, delta_y ) {
		return Math.abs( delta_x ) >= min_horizontal &&
			Math.abs( delta_x ) >= Math.abs( delta_y ) * swipe_ratio;
	}

	function is_open_menu_horizontal_swipe( delta_x, delta_y ) {
		return Math.abs( delta_x ) >= open_menu_min_horizontal &&
			Math.abs( delta_x ) >= Math.abs( delta_y ) * open_menu_swipe_ratio;
	}

	function resolve_states_nav_menu( states_view ) {
		if ( ! states_view ) {
			return null;
		}
		if ( states_view.$menu && states_view.$menu.length ) {
			return states_view.$menu;
		}
		var $nav = states_view.$( '.mkl-pc-admin-ui__nav' ).first();
		if ( $nav.length ) {
			states_view.$menu = $nav;
		}
		return states_view.$menu || null;
	}

	function get_open_menu_zone( start_el ) {
		var $t = $( start_el );
		if ( $t.closest( '.mkl-pc-admin-ui__sidebar-mobile-scrim' ).length ) {
			return 'scrim';
		}
		var $sidebar = $t.closest( '.mkl-pc-admin-ui__sidebar' );
		if ( $sidebar.length && $sidebar.hasClass( 'mkl-pc-admin-ui__sidebar--open' ) ) {
			return 'drawer';
		}
		var $nav = $t.closest( '.mkl-pc-admin-ui__nav' );
		if ( $nav.length && $nav.hasClass( 'visible' ) ) {
			return 'drawer';
		}
		return null;
	}

	function is_mobile_menu_closed( states_view ) {
		if ( ! states_view ) {
			return false;
		}
		var $menu = resolve_states_nav_menu( states_view );
		if ( ! $menu || ! $menu.length ) {
			return false;
		}
		var $sidebar = states_view.$( '.mkl-pc-admin-ui__sidebar' );
		return ! $menu.hasClass( 'visible' ) &&
			! $sidebar.hasClass( 'mkl-pc-admin-ui__sidebar--open' );
	}

	function try_open_mobile_menu_from_edge( start_el, start_x, delta_x, delta_y ) {
		if ( delta_x <= 0 || ! is_open_menu_horizontal_swipe( delta_x, delta_y ) ) {
			return false;
		}
		if ( ! is_start_in_modal_left_edge_for_menu_open( start_x, start_el ) ) {
			return false;
		}
		if ( $( start_el ).closest( 'input, textarea, select, [contenteditable="true"]' ).length ) {
			return false;
		}
		var states_view = get_editor_states_view();
		if ( ! states_view || ! is_mobile_menu_closed( states_view ) ) {
			return false;
		}
		var $menu = resolve_states_nav_menu( states_view );
		if ( ! $menu || ! $menu.length ) {
			return false;
		}
		$menu.addClass( 'visible' );
		states_view.$( '.mkl-pc-admin-ui__sidebar' ).addClass( 'mkl-pc-admin-ui__sidebar--open' );
		states_view.$( '.mkl-pc-admin-ui__menu-toggle' ).attr( 'aria-expanded', 'true' );
		return true;
	}

	function try_close_mobile_menu( start_el, delta_x, delta_y ) {
		var zone = get_open_menu_zone( start_el );
		if ( ! zone ) {
			return false;
		}
		if ( ! is_horizontal_swipe( delta_x, delta_y ) ) {
			return false;
		}
		if ( zone === 'drawer' && delta_x >= 0 ) {
			return false;
		}
		var states_view = get_editor_states_view();
		if ( ! states_view || typeof states_view.close_mobile_sidebar !== 'function' ) {
			return false;
		}
		states_view.close_mobile_sidebar();
		return true;
	}

	function client_in_column_back_strip( client_x, column_el ) {
		var rect = column_el.getBoundingClientRect();
		var strip = Math.max(
			column_back_edge_min_px,
			Math.min( column_back_edge_max_px, rect.width * column_back_edge_width_ratio )
		);
		return client_x <= rect.left + strip;
	}

	function try_mobile_stack_back( start_el, start_x, delta_x, delta_y ) {
		if ( delta_x <= 0 || ! is_horizontal_swipe( delta_x, delta_y ) ) {
			return false;
		}
		if ( start_x <= get_menu_open_back_exclusion_cutoff_x() ) {
			return false;
		}
		if ( $( start_el ).closest( 'input, textarea, select, [contenteditable="true"]' ).length ) {
			return false;
		}
		var $column = $( start_el ).closest( '.mkl-pc-admin-layout__column.current' );
		if ( ! $column.length ) {
			return false;
		}
		if ( ! client_in_column_back_strip( start_x, $column[ 0 ] ) ) {
			return false;
		}
		var $modal = $( get_configurator_modal_root() || [] );
		if ( ! $modal.length ) {
			return false;
		}
		var $content = $modal.find( '.mkl-pc-admin-ui__content.content' ).first();
		if ( $content.length && PC.admin ) {
			var content_stack = $content.attr( 'data-mkl-pc-content-stack' ) || '';
			if ( $column.hasClass( 'mkl-pc-admin-layout__column--detail' ) &&
				content_stack === PC.admin.CONTENT_STACK_CHOICE_DETAIL ) {
				var $back_to_choices = $content.find( '.mkl-pc-mobile-back-to-choices-list' ).first();
				if ( $back_to_choices.length ) {
					$back_to_choices.trigger( 'click' );
					return true;
				}
			}
			if ( $column.hasClass( 'mkl-pc-admin-layout__column--choices' ) &&
				content_stack === PC.admin.CONTENT_STACK_CHOICES ) {
				var $back_to_layers = $content.find( '.mkl-pc-mobile-back-to-layers' ).first();
				if ( $back_to_layers.length ) {
					$back_to_layers.trigger( 'click' );
					return true;
				}
			}
		}
		var $structure = $modal.find( '.mkl-pc-admin-ui__content.structure' ).first();
		if ( $structure.length && PC.admin.STRUCTURE_STACK_DETAIL &&
			$structure.attr( 'data-mkl-pc-structure-stack' ) === PC.admin.STRUCTURE_STACK_DETAIL ) {
			if ( $column.hasClass( 'mkl-pc-admin-layout__column--detail' ) ) {
				var $back_to_list = $structure.find( '.mkl-pc-mobile-back-to-structure-list' ).first();
				if ( $back_to_list.length ) {
					$back_to_list.trigger( 'click' );
					return true;
				}
			}
		}
		return false;
	}

	function dispatch_gestures( start_x, start_y, end_x, end_y, start_el ) {
		var delta_x = end_x - start_x;
		var delta_y = end_y - start_y;
		if ( try_close_mobile_menu( start_el, delta_x, delta_y ) ) {
			return;
		}
		if ( try_open_mobile_menu_from_edge( start_el, start_x, delta_x, delta_y ) ) {
			return;
		}
		try_mobile_stack_back( start_el, start_x, delta_x, delta_y );
	}

	function on_pointer_down( event ) {
		if ( ! is_narrow_breakpoint() ) {
			active_pointer = null;
			return;
		}
		if ( event.pointerType === 'mouse' && event.button !== 0 ) {
			return;
		}
		if ( active_pointer !== null ) {
			return;
		}
		active_pointer = {
			id: event.pointerId,
			x: event.clientX,
			y: event.clientY,
			target: event.target
		};
	}

	function on_pointer_up( event ) {
		if ( ! active_pointer || event.pointerId !== active_pointer.id ) {
			return;
		}
		if ( ! is_narrow_breakpoint() ) {
			active_pointer = null;
			return;
		}
		var start_x = active_pointer.x;
		var start_y = active_pointer.y;
		var start_el = active_pointer.target;
		active_pointer = null;
		dispatch_gestures( start_x, start_y, event.clientX, event.clientY, start_el );
	}

	function on_pointer_cancel( event ) {
		if ( active_pointer && event.pointerId === active_pointer.id ) {
			active_pointer = null;
		}
	}

	function on_touch_start( event ) {
		if ( ! is_narrow_breakpoint() ) {
			active_pointer = null;
			return;
		}
		if ( event.touches.length !== 1 ) {
			return;
		}
		var t = event.touches[ 0 ];
		active_pointer = {
			id: -1,
			x: t.clientX,
			y: t.clientY,
			target: event.target
		};
	}

	function on_touch_end( event ) {
		if ( ! active_pointer || active_pointer.id !== -1 ) {
			return;
		}
		if ( ! is_narrow_breakpoint() ) {
			active_pointer = null;
			return;
		}
		if ( event.changedTouches.length !== 1 ) {
			active_pointer = null;
			return;
		}
		var t = event.changedTouches[ 0 ];
		var start_x = active_pointer.x;
		var start_y = active_pointer.y;
		var start_el = active_pointer.target;
		active_pointer = null;
		dispatch_gestures( start_x, start_y, t.clientX, t.clientY, start_el );
	}

	function on_touch_cancel() {
		if ( active_pointer && active_pointer.id === -1 ) {
			active_pointer = null;
		}
	}

	PC.admin.mobile_admin_gestures = {
		ensure_document_listeners: function() {
			if ( listening ) {
				return;
			}
			listening = true;
			var opts = { passive: true, capture: true };
			if ( typeof window.PointerEvent === 'function' ) {
				document.addEventListener( 'pointerdown', on_pointer_down, opts );
				document.addEventListener( 'pointerup', on_pointer_up, opts );
				document.addEventListener( 'pointercancel', on_pointer_cancel, opts );
			} else {
				document.addEventListener( 'touchstart', on_touch_start, opts );
				document.addEventListener( 'touchend', on_touch_end, opts );
				document.addEventListener( 'touchcancel', on_touch_cancel, opts );
			}
		}
	};

	if ( typeof document !== 'undefined' && PC.admin.mobile_admin_gestures ) {
		PC.admin.mobile_admin_gestures.ensure_document_listeners();
	}
}( window.jQuery ) );
