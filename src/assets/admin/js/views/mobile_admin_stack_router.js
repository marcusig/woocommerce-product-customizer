/**
 * Mobile admin stack router — single place for narrow-view “list vs detail” stack
 * metadata, data attributes, and column `.current` markers for slide transitions.
 */
var PC = PC || {};
PC.admin = PC.admin || {};

( function() {
	'use strict';

	PC.admin.CONTENT_STACK_LAYERS = 'layers';
	PC.admin.CONTENT_STACK_CHOICES = 'choices';
	PC.admin.CONTENT_STACK_CHOICE_DETAIL = 'choice_detail';
	PC.admin.STRUCTURE_STACK_LIST = 'list';
	PC.admin.STRUCTURE_STACK_DETAIL = 'detail';

	function prefers_reduced_motion() {
		return typeof window.matchMedia === 'function' &&
			window.matchMedia( '(prefers-reduced-motion: reduce)' ).matches;
	}

	function pulse_animating_class( $el ) {
		if ( ! $el || ! $el.length || prefers_reduced_motion() ) {
			return;
		}
		$el.addClass( 'mkl-pc-mobile-stack--animating' );
		window.setTimeout( function() {
			$el.removeClass( 'mkl-pc-mobile-stack--animating' );
		}, 200 );
	}

	function get_column_track_columns( $host ) {
		var $track = $host.children( '.mkl-pc-admin-layout__column-track' ).first();
		if ( ! $track.length ) {
			return null;
		}
		var $columns = $track.children( '.mkl-pc-admin-layout__column' );
		return $columns.length ? $columns : null;
	}

	function sync_structure_layout_columns( $root ) {
		if ( ! $root || ! $root.length ) {
			return;
		}
		var $columns = get_column_track_columns( $root );
		if ( ! $columns ) {
			return;
		}
		var stack = $root.attr( 'data-mkl-pc-structure-stack' ) || PC.admin.STRUCTURE_STACK_LIST;
		$columns.removeClass( 'current' );
		if ( stack === PC.admin.STRUCTURE_STACK_DETAIL ) {
			$columns.filter( '.mkl-pc-admin-layout__column--detail' ).addClass( 'current' );
		} else {
			$columns.filter( '.mkl-pc-admin-layout__column--list' ).addClass( 'current' );
		}
	}

	function sync_content_layout_columns( $shell ) {
		if ( ! $shell || ! $shell.length ) {
			return;
		}
		var $columns = get_column_track_columns( $shell );
		if ( ! $columns ) {
			return;
		}
		var stack = $shell.attr( 'data-mkl-pc-content-stack' ) || PC.admin.CONTENT_STACK_LAYERS;
		$columns.removeClass( 'current' );
		if ( stack === PC.admin.CONTENT_STACK_CHOICES ) {
			$columns.filter( '.mkl-pc-admin-layout__column--choices' ).addClass( 'current' );
		} else if ( stack === PC.admin.CONTENT_STACK_CHOICE_DETAIL ) {
			$columns.filter( '.mkl-pc-admin-layout__column--detail' ).addClass( 'current' );
		} else {
			$columns.filter( '.mkl-pc-admin-layout__column--layers' ).addClass( 'current' );
		}
	}

	PC.admin.mobile_stack_router = {

		/**
		 * @param {Backbone.View} content_state_view PC.views.content instance.
		 * @return {{ get_stack: Function, set_content_stack: Function, destroy: Function }|null}
		 */
		install_content_router: function( content_state_view ) {
			var $state = content_state_view.$el;
			var $shell = content_state_view.$( '.mkl-pc-admin-ui__content.content' ).first();
			if ( ! $shell.length ) {
				return null;
			}
			var stack = PC.admin.CONTENT_STACK_LAYERS;

			function set_content_stack( next_stack ) {
				if ( next_stack === stack ) {
					return;
				}
				pulse_animating_class( $shell );
				stack = next_stack;
				$shell.attr( 'data-mkl-pc-content-stack', next_stack );
				sync_content_layout_columns( $shell );
				$state.toggleClass( 'show-choices', next_stack !== PC.admin.CONTENT_STACK_LAYERS );
			}

			$shell.attr( 'data-mkl-pc-content-stack', stack );
			sync_content_layout_columns( $shell );
			$state.toggleClass( 'show-choices', stack !== PC.admin.CONTENT_STACK_LAYERS );

			return {
				get_stack: function() {
					return stack;
				},
				set_content_stack: set_content_stack,
				destroy: function() {
					$shell.find( '.mkl-pc-admin-layout__column' ).removeClass( 'current' );
					$shell.removeAttr( 'data-mkl-pc-content-stack' ).removeClass( 'mkl-pc-mobile-stack--animating' );
					$state.removeClass( 'show-choices' );
					stack = PC.admin.CONTENT_STACK_LAYERS;
				}
			};
		},

		/**
		 * @param {Backbone.View} structure_state_view PC.views.layers / angles / conditional instance.
		 * @return {{ get_stack: Function, set_structure_stack: Function, destroy: Function }|null}
		 */
		install_structure_router: function( structure_state_view ) {
			var $root = structure_state_view.$( '.mkl-pc-admin-ui__content.structure' ).first();
			if ( ! $root.length ) {
				return null;
			}
			var stack = PC.admin.STRUCTURE_STACK_LIST;

			function set_structure_stack( next_stack ) {
				if ( next_stack === stack ) {
					return;
				}
				pulse_animating_class( $root );
				stack = next_stack;
				$root.attr( 'data-mkl-pc-structure-stack', next_stack );
				sync_structure_layout_columns( $root );
			}

			$root.attr( 'data-mkl-pc-structure-stack', stack );
			sync_structure_layout_columns( $root );

			return {
				get_stack: function() {
					return stack;
				},
				set_structure_stack: set_structure_stack,
				destroy: function() {
					$root.find( '.mkl-pc-admin-layout__column' ).removeClass( 'current' );
					$root.removeAttr( 'data-mkl-pc-structure-stack' ).removeClass( 'mkl-pc-mobile-stack--animating' );
					stack = PC.admin.STRUCTURE_STACK_LIST;
				}
			};
		}
	};
}() );
