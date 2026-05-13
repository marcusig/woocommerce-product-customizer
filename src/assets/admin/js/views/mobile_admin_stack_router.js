/**
 * Mobile admin stack router — single place for narrow-view “list vs detail” stack
 * metadata, data attributes, and lightweight transitions. Layout still follows
 * existing DOM and :has() rules; this module keeps JS state in sync for hooks
 * and future gestures.
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
				$state.toggleClass( 'show-choices', next_stack !== PC.admin.CONTENT_STACK_LAYERS );
			}

			$shell.attr( 'data-mkl-pc-content-stack', stack );

			return {
				get_stack: function() {
					return stack;
				},
				set_content_stack: set_content_stack,
				destroy: function() {
					$shell.removeAttr( 'data-mkl-pc-content-stack' ).removeClass( 'mkl-pc-mobile-stack--animating' );
					$state.removeClass( 'show-choices' );
					stack = PC.admin.CONTENT_STACK_LAYERS;
				}
			};
		},

		/**
		 * @param {Backbone.View} structure_state_view PC.views.layers / angles instance.
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
			}

			$root.attr( 'data-mkl-pc-structure-stack', stack );

			return {
				get_stack: function() {
					return stack;
				},
				set_structure_stack: set_structure_stack,
				destroy: function() {
					$root.removeAttr( 'data-mkl-pc-structure-stack' ).removeClass( 'mkl-pc-mobile-stack--animating' );
					stack = PC.admin.STRUCTURE_STACK_LIST;
				}
			};
		}
	};
}() );
