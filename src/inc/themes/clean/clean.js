(function($) {
	if ( ! wp || ! wp.hooks ) return;

	wp.hooks.addAction( 'PC.fe.start', 'MKL/PC/Themes/clean', function( view ) {
		view.$el.addClass( 'clean' );
		if ( window.tippy && PC.utils._isMobile() ) {

			var btns = view.$( '.reset-configuration, .save-your-design, .save-your-design--pdf, .share-your-design' );
			btns.each( function( index, btn ) {
				/**
				 * 
				 * Customization of the tooltip can be done by using TippyJS options: atomiks.github.io/tippyjs/v6/
				 */
				var tooltip_options = {
					content: $( btn ).find( 'span' ).html(),
					allowHTML: true,
					placement: 'top',
					zIndex: 100001
				};
			
				if ( tooltip_options.content && tooltip_options.content.length ) {
					$( btn ).addClass( 'icon-only' );
					tippy( btn, tooltip_options );
				}
			} );

		}
	}, 20 );

	wp.hooks.addAction( 'PC.fe.before_open', 'MKL/PC/Themes/clean', function() {
		PC.fe.config.show_layer_description_in_title = true;
	} );

	wp.hooks.addAction( 'PC.fe.layers_list.open', 'MKL/PC/Themes/clean', function( view, model ) {
		PC.fe.modal.$el.addClass( 'showing-choices' );
	} );

	wp.hooks.addAction( 'PC.fe.layers_list.close', 'MKL/PC/Themes/clean', function( view, model ) {
		PC.fe.modal.$el.removeClass( 'showing-choices' );
	} );

	wp.hooks.addFilter( 'PC.fe.choices.where', 'MKL/PC/Themes/clean', function( where, original_view ) {
		if ( original_view && original_view.model ) {
			if ( 'dropdown' == original_view.model.get( 'display_mode' ) && ! PC.utils._isMobile() && ! original_view.model.get( 'parent' ) ) {
				return 'in';
			}
			// var parent = original_view.model.collection.get( original_view.model.get( 'parent' ) );
			// if ( parent && 'group' === parent.get( 'type' ) && ! parent.get( 'is_step' ) ) {
			// 	return 'in';
			// }
			if (  original_view.model.get( 'is_step' ) ) {
				return 'in';
			}
		}


		return PC.fe.modal.toolbar.el;
	} );

	wp.hooks.addAction( 'PC.fe.layers_list.open', 'MKL/PC/Themes/clean', function( view, model ) {
		if ( 'dropdown' == model.get( 'display_mode' ) ) {
			view.$el.removeClass( 'opened' );
		}
	} );

})( jQuery );