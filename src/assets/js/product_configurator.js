var PC = PC || {};
PC.fe = PC.fe || {};
PC.fe.models = PC.fe.models || {};

// Backbone.emulateHTTP = true;
PC.actionParameter = 'pc_get_data';
Backbone.Model.prototype.toJSON = function() {
	var json = _.clone(this.attributes);
	for(var attr in json) {
		if((json[attr] instanceof Backbone.Model) || (json[attr] instanceof Backbone.Collection)) {
			json[attr] = json[attr].toJSON(); 
		}
	}
	return json;
};

!( function( $ ) {
	'use strict';

	PC.fe.config = PC.fe.config || PC_config.config;
	PC.fe.config = _.extend( {}, PC.fe.config);
	PC.fe.products_content = PC.fe.products_content || [];

	$( function() {
		// adds classes to body
		if( PC.utils._isTouch() ){
			$( 'body' ).addClass( 'is-touch' );
		}

		if( PC.utils._isMobile() ){
			$( 'body' ).addClass( 'is-mobile' );
		}

		// keyboard-navigation

		$( 'body' ).on( 'keydown', function( e ) {
			if ( $( this ).hasClass( 'keyboard-navigation' ) ) return;
			if ( 'Tab' == e.key && ! e.ctrlKey ) {
				$( this ).addClass( 'keyboard-navigation' );
			}
		} );

		$( 'body' ).on( 'click', function( e ) {
			if ( ! $( this ).hasClass( 'keyboard-navigation' ) ) return;
			$( this ).removeClass( 'keyboard-navigation' );
		} );

		PC.fe.product_type = PC.fe.product_type || 'simple';

		function configurator_init( event ) {

			event.preventDefault();

			if ( PC.fe.config.current_language ) {
				PC.fe.lang = PC.fe.config.current_language;
				add_language_filters( PC.fe.lang );
			}
			var product_id;
			var $target = $( event.target );
			if ( ! $target.is( '.configure-product' ) ) {
				$target = $target.closest( '.configure-product' );
			}

			if ( $target.data( 'product_id' ) ) {
				product_id = $target.data( 'product_id' );
				if ( $target.is( '.is-shortcode' ) ) {
					PC.fe.is_using_shortcode = true;
				} else {
					PC.fe.is_using_shortcode = false;
				}
			} else if ( $('*[name="add-to-cart"]').length ) {
				PC.fe.is_using_shortcode = false;
				product_id = $('*[name="add-to-cart"]').val();
			}
			
			if ( ! product_id ) {
				console.log ( 'No product ID was found' );
				return;
			}

			if ( 'mkl/pc/inline-init' == event.type ) {
				PC.fe.inline = true;
				PC.fe.inlineTarget = event.target;
			}

			// Open configurator
			try {
				PC.fe.open( product_id ); 
			} catch (err) {
				console.error('we had an error: ', err);
				PC.fe.close();
			}
		}

		$( 'body' ).on( 'click', '.configure-product-simple', configurator_init );
		$( 'body' ).on( 'mkl/pc/inline-init', '.mkl-configurator-inline', configurator_init );

		$('form.cart').each(function(index, form) { 

			if ( ! $( 'body' ).is('.enable-add-to-cart' ) ) $(form).find('button[name="add-to-cart"]').prop('disabled', 'disabled'); 
			$(form).on('submit', function( event ){ 
				$('input[name=pc_configurator_data]').val( PC.fe.save_data.save() ); 
				if( $('input[name=pc_configurator_data]').val() == '' ) {
					event.preventDefault(); 
					console.log('empty data'); 
				}
			});
		});

		/**
		 * Automaticly switch angles
		 */
		function auto_angle_switch( view ) {
			if ( view.model.get( 'angle_switch' ) && 'no' != view.model.get( 'angle_switch' ) )  {
				var new_angle = PC.fe.angles.get( view.model.get( 'angle_switch' ) );
				if ( new_angle && ! new_angle.get( 'active' ) ) {
					new_angle.collection.each(function(model) {
						model.set('active', false); 
					});		
					new_angle.set( 'active', true );
				}
		 	}
		}

		wp.hooks.addAction( 'PC.fe.layer.activate', 'mkl/product_configurator', auto_angle_switch, 20 );
		wp.hooks.addAction( 'PC.fe.choice.activate', 'mkl/product_configurator', auto_angle_switch, 20 );

		wp.hooks.addAction( 'PC.fe.start', 'mkl/product_configurator', function( configurator ){

			$( 'form.cart' ).find('button').prop( 'disabled', false ); 

			$( document ).on( 'change', 'form.cart input[name=quantity]', function(e) {
				var q = $(this).val();
				$( 'form.cart input[name=quantity]' ).each( function( index, el ) {
					$( el ).val( q );
				});
			} );

			// Reset config
			if ( wp.hooks.applyFilters( 'PC.fe.reset.on.start', true ) ) PC.fe.contents.content.resetConfig();

			if ( PC_config.config.load_config_content && Array.isArray( PC_config.config.load_config_content ) ) {
				PC.fe.setConfig( PC_config.config.load_config_content );
			}
		}, 20 );

		/**
		 * Launch the configurator inline
		 */
		$( '.mkl-configurator-inline' ).trigger( 'mkl/pc/inline-init' );

		/**
		 * Launch the configurator after click
		 */
		if( PC.fe.config.open_configurator && true == PC.fe.config.open_configurator && ! $( '.mkl-configurator-inline' ).length ) {
			$( '.configure-product-simple' ).trigger( 'click' );
		}
	});

	/**
	 * Add the language filters
	 *
	 * @param {string} lang 
	 */
	function add_language_filters( lang ) {
		var maybe_change_name_and_description = function( attributes ) {
			if ( attributes['name_' + lang] && '' != attributes['name_' + lang].trim() ) attributes.name = attributes['name_' + lang];
			if ( attributes['description_' + lang] && '' != attributes['description_' + lang].trim() ) attributes.description = attributes['description_' + lang];
			return attributes;
		}

		wp.hooks.addFilter( 'PC.fe.configurator.layer_data', 'mkl/product_configurator', maybe_change_name_and_description, 10 );
		wp.hooks.addFilter( 'PC.fe.configurator.choice_data', 'mkl/product_configurator', maybe_change_name_and_description, 10 );
		wp.hooks.addFilter( 'PC.fe.configurator.angle_data', 'mkl/product_configurator', maybe_change_name_and_description, 10 );
	}


	PC.fe.init = function( product_id, parent_id ) {
		if ( PC.fe.is_using_shortcode ) {
			this.options = {};
		}

		if ( parent_id ) {
			this.currentProductData = PC.productData['prod_' + parent_id];
			this.layers = new PC.layers( PC.productData['prod_' + parent_id].layers );
			this.angles = new PC.angles( PC.productData['prod_' + parent_id].angles );
		} else {
			this.currentProductData = PC.productData['prod_' + product_id];
			this.layers = new PC.layers( PC.productData['prod_' + product_id].layers ); 
			this.angles = new PC.angles( PC.productData['prod_' + product_id].angles ); 
		}

		PC.fe.product_type = this.currentProductData.product_info.product_type;

		if ( ( 'simple' === PC.fe.product_type && PC.productData['prod_' + product_id] ) || ( 'variation' === PC.fe.product_type && PC.productData['prod_' + product_id] ) ) {
			this.contents = PC.fe.setContent.parse( PC.productData['prod_' + product_id] ); 
			this.modal.$el.trigger( 'content-is-loaded' ); 
		} 

		$( document.body ).trigger( 'mkl-pc-init', product_id, parent_id );
		wp.hooks.doAction( 'PC.fe.init', product_id, parent_id );

	};

	PC.fe.open = function( product_id, parent_id ) {

		PC.fe.opened = true;
		$('body').addClass('configurator_is_opened');
		if( PC.fe.inline ) $('body').addClass('configurator_is_inline');

		// variations: if product_id is different from active, we remove the modal to create a new one.
		if( product_id == PC.fe.active_product ) {
			this.modal.open(); 
			return;
		}

		if( product_id != PC.fe.active_product && this.modal && PC.fe.inline != true ) {
			this.modal.remove();
			this.modal = null;
			wp.hooks.doAction( 'PC.fe.reset_product' );
		}

		PC.fe.active_product = product_id; 
		PC.fe.parent_product = parent_id ? parent_id : product_id;

		this.modal = this.modal || new PC.fe.views.configurator( product_id, parent_id ); 

		PC.fe.init( product_id, parent_id ); 

		// if( !this.layers && !variation ) {
		// 	return;
		// }
		// if( ( variation && !PC.fe.variations_content ) || ( variation && !PC.fe.variations_content[product_id] ) ) {
		// 	PC.fe.init( product_id, variation );
		// 	return;
		// }
		
		/*
		check if product_id is different from before
		*/

	};

	PC.fe.close = function() {
		if( this.modal ) 
			this.modal.close();
	}

	PC.fe.setContent = {
		url: function() { 
			var action = PC.actionParameter,
				data = 'content';
			return ajaxurl + '?action='+action+'&data='+data+'&id='+this.id
		},

		idAttribute: 'product_id',
		defaults: {
			product_type:'simple', 
			modified: false, 
		}, 
		parse: function( response ) {
			// var response = null;
			var content = new PC.content_list();
			if( ! response instanceof Object ) {
				return content;
			} else if( undefined == response.content || response.content == false || response.content == 'false' ) {
				return content;
			}

			// content.add( response.content );
			$.each( response.content, function(key, value) {
				var ob = _.clone( value );
				if ( ob.choices && ob.choices.length > 0 && PC.fe.layers.get( ob.layerId ) ) {
					ob.choices = new PC.choices( ob.choices, { layer: PC.fe.layers.get( ob.layerId ) } );
					content.add( ob );
				}
				// content.add({ key = new PC.choices(value);
			});
			// this.set('content', content);
			return { content: content };
			// this.set()
		}
	}; 

	PC.fe.getLayerContent = function( id ) {
		if ( PC.fe.contents.content.get( id ) ) 
			return PC.fe.contents.content.get( id ).attributes.choices; 
		return false;
	};

	PC.fe.fetchContent = function( product_id ) {
		if ( ! PC.fe.products_content[product_id] ) { 

			this.modal.$el.show();
			this.modal.$el.addClass( 'loading' );

			$.ajax({
				url:     wp.ajax.settings.url, 
				type: 'POST',
				dataType: 'json',
				data:{
					action: PC.actionParameter,
					data: 'content', 
					id: product_id,
				},
				context: this,
			})
			.done(function( response ) {
				this.modal.$el.removeClass('loading');
				if ( _.isObject( response ) && response.content ) {
					this.contents = PC.fe.setContent.parse( response ); 
					PC.fe.products_content[product_id] = this.contents;
					this.modal.$el.trigger( 'content-is-loaded' );
					$( PC.fe ).trigger( 'variation_content_loaded', { response: response, product_id: product_id } );
					wp.hooks.doAction( 'variation_content_loaded', { response: response, product_id: product_id } );
				} else {
					alert( 'Couldn\'t load Data for this product.' );
					if( PC.fe.inline != true ) {
						this.modal.remove(); 
					}
				}
			})
			.fail(function() {
				console.log("error");
				this.modal.$el.addClass( 'loading' );
			});
		} else {
			this.contents = PC.fe.products_content[product_id];
			this.modal.$el.trigger('content-is-loaded', 'an argument');
		}		
	}
	
	PC.fe.fetchedContent = function( model, response, options ){
		console.log('fetched content'); 
	}

	PC.fe.setConfig = function( config_items ) {
		// First reset all to the default choice,
		// in case some of the layers in the saved config are missing / extra
		PC.fe.contents.content.resetConfig();

		$.each( config_items, function(index, config_item) {
			// layerContents is a Backbone.Collection
			try {
				PC.fe.getLayerContent( config_item.layer_id ).selectChoice( config_item.choice_id );
			} catch ( err ) {
				console.log('Product configurator - setConfig: Could not set this layer:', config_item.layer_id, err);
			}
		});

		wp.hooks.doAction( 'PC.fe.setConfig', config_items );
	};

	/*
	// product is configurable == true
		// PRODUCT IS SIMPLE 
			-> SERVE Structure and CONTENT
		// Product is VARIABLE
			-> SERVE Structure
			-> on SELECT VARIATION 
				-> Enable Configure button

			-> Configure button .onClick 
				-> GET Content 


	// OPEN CUSTOMIZER 
		// getData
			-> if SIMPLE 
			jSON to COLLECTIONS ANGLES/LAYERS/CONTENT
			-> if VARIATION
			GET VARIATION CONTENT
			jSON to COLLECTIONS ANGLES/LAYERS/CONTENT

		// VIEWS: 
			CUSTOMIZER
				TOOLBAR
					HEADER
						TITLE
					LIST
						LAYERS
							LAYER
						CHOICES
							HEADER (CLOSE + LAYER)
							CHOICE

				VIEWER
					BG
					LAYER IMAGE



	*/

	// Compatibility with Yith Added to cart popup (Premium)
	$( document ).on( 'yith_wacp_adding_cart_single', function() {
		if ( PC && PC.fe && PC.fe.modal ) {
			PC.fe.modal.$el.addClass( 'adding-to-cart' );
		}
	} );
	// 
	$( document ).on( 'yith_wacp_popup_after_opening', function() {
		if ( PC && PC.fe && PC.fe.modal ) {
			PC.fe.modal.$el.removeClass( 'adding-to-cart' );
		}
	} );

})(jQuery);

PC.utils = PC.utils || {
	_isTouch: function() {
		// var isTouchDevice = navigator.userAgent.match(/(iPhone|iPod|iPad|Android|playbook|silk|BlackBerry|BB10|Windows Phone|Tizen|Bada|webOS|IEMobile|Opera Mini)/),
			var isTouch = (('ontouchstart' in window) || (navigator.msMaxTouchPoints > 0) || (navigator.maxTouchPoints));
		return isTouch;
	},
	_isMobile: function() {
		var isTouchDevice = navigator.userAgent.match(/(iPhone|iPod|iPad|Android|playbook|silk|BlackBerry|BB10|Windows Phone|Tizen|Bada|webOS|IEMobile|Opera Mini)/);
		return !! isTouchDevice;
	},
	formatMoney: function ( amount ) {
		amount = this.maybeConvertAmountToCurrency( amount );
		if ( 'undefined' === typeof accounting ) return amount;
		return accounting.formatMoney( amount, {
			precision: PC_config.lang.money_precision,
			symbol: PC_config.lang.money_symbol,
			decimal: PC_config.lang.money_decimal,
			thousand: PC_config.lang.money_thousand,
			format: PC_config.lang.money_format
		} );
	},
	maybeConvertAmountToCurrency: function( amount ) {
		// WOOCS
		if ( 'undefined' != typeof woocs_current_currency && 'undefined' != woocs_current_currency['rate'] ) {
			return amount * woocs_current_currency['rate'];
		}

		// WCML
		if ( 'undefined' != typeof PC.fe.config.wcml_rate && parseFloat( PC.fe.config.wcml_rate ) ) {
			return amount * parseFloat( PC.fe.config.wcml_rate );
		}
		
		// Aelia CS
		if ( 'undefined' != typeof wc_aelia_currency_switcher_params && 'undefined' != wc_aelia_currency_switcher_params.current_exchange_rate_from_base && 0 < parseFloat( wc_aelia_currency_switcher_params.current_exchange_rate_from_base ) ) {
			return amount * parseFloat( wc_aelia_currency_switcher_params.current_exchange_rate_from_base );
		}

		// Price Based on Country
		if ( 'undefined' != typeof PC.fe.config.wcpbc_rate && parseFloat( PC.fe.config.wcpbc_rate ) ) {
			return amount * parseFloat( PC.fe.config.wcpbc_rate );
		}

		return amount;
	}

};