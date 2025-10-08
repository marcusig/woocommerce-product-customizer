var PC = PC || {};
PC.fe = PC.fe || {}; 


!(function($){

	'use strict';

	var is_variation = false;
	$(document).ready(function() {

		if ( ! $( 'body' ).is( '.is_configurable' ) ) return;
		
		if ( typeof wc_add_to_cart_variation_params !== 'undefined' ) {

			is_variation = true;
			PC.fe.product_type = 'variable';
			var $form = $( '.variations_form' );
			var productData;
			var current_variation;
			var loadedAtStartup = false;

			$form.on( 'hide_variation', function( event ) { 
				//event.preventDefault();
				$( 'body' ).removeClass( 'current-variation-is-configurable' );
				if ( ! $( 'body' ).is( '.enable-add-to-cart' ) ) $( '.variations_button' ).addClass('disabled');
				$( '.configure-product' ).hide(); 
				$( '.configure-product' ).attr( 'disabled', 'disabled' ); 
				PC.fe.close();
			} );


			$form.on( 'show_variation', function( event, variation ) { 
				//event.preventDefault(); 
				current_variation = variation;
				
				var product_id = variation.variation_id; 
				var parent_id = $('input[name="product_id"]').val();

				// Reset the configuration field, to prevent adding the same twice
				$('input[name=pc_configurator_data]').val( '' );

				if ( PC?.productData && PC.productData[ 'prod_' + parent_id ] ) {
					productData = PC.productData[ 'prod_' + parent_id ];
				} else if ( PC?.productData?.product_info ) {
					productData = PC.productData;
				}

				if ( variation.is_configurable ) {
					$( 'body' ).addClass( 'current-variation-is-configurable' );
					if ( PC.fe.opened == true ) {
						if ( ! $( 'body' ).is( '.enable-add-to-cart' ) ) $( '.variations_button' ).removeClass('disabled'); 
						$( '.configure-product' ).hide(); 
					} else {
						if ( ! $( 'body' ).is( '.enable-add-to-cart' ) ) $( '.variations_button' ).addClass('disabled');
						$( '.configure-product' ).show(); 
						$( '.configure-product' ).prop( 'disabled', false ); 
					}
					if ( ! loadedAtStartup && PC.fe.config.open_configurator ) {
						$( '.configure-product-variable' ).trigger( 'click' );
					}
				} else {
					$( 'body' ).removeClass( 'current-variation-is-configurable' );
					$( '.configure-product' ).hide(); 
					if ( ! $( 'body' ).is( '.enable-add-to-cart' ) ) $( '.variations_button' ).removeClass('disabled'); 
					if ( ! $( 'body' ).is( '.enable-add-to-cart' ) ) $( '.variations_button button' ).prop( 'disabled', false ); 
				}
			} );
		}


		$( '.configure-product-variable' ).on( 'click', function( event ) {
			if ( PC.fe.config.current_language && PC.utils && PC.utils.add_language_filters ) {
				PC.fe.lang = PC.fe.config.current_language;
				PC.utils.add_language_filters( PC.fe.lang );
			}
			var product_id = $( 'input[name="variation_id"]' ).val();
			var parent_id = $( 'input[name="product_id"]' ).val();
			if ( ! product_id || ! parent_id ) {
				alert( 'No variation found...' );
				return;
			}
			PC.fe.open( product_id, parent_id, $( event.target ) );
		});

		wp.hooks.addAction( 'PC.fe.init', 'mkl/product_configurator', function( product_id ) {
			if ( 'variable' == PC.fe.product_type || 'variation' == PC.fe.product_type ) { 
					

				// Update the price
				if ( current_variation ) {
					// use the current variation
					PC.fe.currentProductData.product_info.price = current_variation.display_price;
					PC.fe.currentProductData.product_info.regular_price = current_variation.display_regular_price;
					PC.fe.currentProductData.product_info.is_on_sale = current_variation.display_price < current_variation.display_regular_price;	
				} else if ( productData?.product_info?.variations[ product_id ]?.price ) {
					// Fallback to the product_info.variations data, if the variation is accessed directly
					PC.fe.currentProductData.product_info.price = productData.product_info.variations[ product_id ].price;
					PC.fe.currentProductData.product_info.regular_price = productData.product_info.variations[ product_id ].regular_price;
					PC.fe.currentProductData.product_info.is_on_sale = productData.product_info.variations[ product_id ].is_on_sale;
				}

				if ( productData?.product_info?.mode && 'share_all_config' === productData.product_info.mode ) {
					PC.fe.contents = PC.fe.setContent.parse( productData );
					PC.fe.modal.$el.trigger( 'content-is-loaded' );
					return;
				}

				if( product_id && product_id != 0 ) {
					PC.fe.fetchContent( product_id );
				} else {
					PC.fe.modal.$el.trigger( 'content-is-loaded', 'no-content' );
				}

			}

		}, 20 );


	});

})( jQuery );