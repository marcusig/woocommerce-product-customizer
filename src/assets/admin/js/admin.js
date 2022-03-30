// MKL.admin.pc_product =

var PC = PC || {};
!(function($) {
	var configurable_product = {

		init: function (){
			configurable_product.set_configurable('init');
			$('input.is_configurable').on( 'change', function( event ) {
				configurable_product.set_configurable( this.checked );
			} );
			this.views.init();
			this.layers_editor.init();

		},
		structure: {
			show: function() {
				$('.show_if_is_configurable').show();
			},
			hide: function() {
				$('.show_if_is_configurable').hide();
			}

		},
		views: {
			init: function() {				
				this.change_product_type();
			},
			change_product_type: function() {
				$( 'select#product-type' ).on( 'change', function () {
					// Get value
					var select_val = $( this ).val();
					if ( $.inArray(select_val, ['variable','simple']) != -1 ) {
						PC.product_type = select_val;
					}
				} );

			}
		}, 

		set_configurable: function(action) {
			if( action == 'init') {
				action = $('input.is_configurable').is(':checked');
			}
			if( action === true ) {
				this.structure.show()
			} else {
				this.structure.hide()
			}

		},

		layers_editor: {
			active_sub: null,
			init: function() {
				_this = this;
				this.tabs = $('.wc-pc-tabs > li');
				this.sub_menus = [];
				this.sub_menus_container = $('#pc_tabs_submenu');
				this.image_selector_container = $('#pc_img_selectors');
				this.tabs.each(function(index, el) {
					var $el = $(el);
					var sub = $el.find('ul').detach();

					_this.sub_menus_container.append( sub );

					$el.data('sub', sub );

					$el.data('index', index );
					$el.find('> a').click(function(event) {
						event.preventDefault();
						$(this).data('el', $el);
						_this.change_element( sub );
						if( _this.active_sub ) _this.active_sub.removeClass('active');
						_this.active_sub = $(this).data('el');
						$(this).data('el').addClass('active');
					});

					sub.find('>li').each(function(index2, el_sub) {
						var selector = $(el_sub).find('.image-selectors').detach();
						_this.image_selector_container.append( selector );
						$(el_sub).data('selector', selector);
						$(el_sub).find('>a').click(function(event) {
							event.preventDefault();
							_this.change_choice( $(el_sub).data('selector') );
						});
					}); 

				});
				this.subs = this.sub_menus_container.find('> ul');
				this.selectors = this.image_selector_container.find('.image-selectors');
			},
			change_element: function( sub ) {
				this.subs.hide();
				this.selectors.hide();
				$(sub).show();
			},
			change_choice: function( selector ) {
				this.selectors.hide();
				$(selector).show();
			}

		}

	}
	$(document).ready(function() {

		configurable_product.init();

		// $( '#woocommerce-product-data' ).on( 'woocommerce_variations_loaded', function() {
		// 	console.log('variations_loaded');
		// 	$('.woocommerce_variation .start-configuration').on('click', function(event){
		// 		event.preventDefault();
		// 		// this.
		// 		var product_id = $(this).data('product-id');
		// 		var parent_id = $(this).data('parent-id');
		// 		PC.app.start({
		// 			product_id:product_id, 
		// 			product_type: 'variation', 
		// 			parent_id: parent_id 
		// 		});
		// 	});
		// });

		$('.start-configuration').on('click', function(event){
			event.preventDefault();
			var product_id = $(this).data('product-id');
			PC.app.start( {
				product_id : product_id,
				product_type : 'simple'
			} );
		});

	});

})(jQuery);