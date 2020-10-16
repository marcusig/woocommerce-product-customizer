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


!(function($){
	'use strict';

	PC.fe.config = PC.fe.config || PC_config.config;
	PC.fe.config = _.extend( {}, PC.fe.config);
	PC.fe.products_content = PC.fe.products_content || [];

	$(document).ready(function() {
		// adds classes to body
		if( PC.utils._isTouch() ){
			$( 'body' ).addClass( 'is-touch' );
		}
		if( PC.utils._isMobile() ){
			$( 'body' ).addClass( 'is-mobile' );
		}

		PC.fe.product_type = PC.fe.product_type || 'simple';

		function configurator_init( event ) {

			var product_id;
			//get product ID
			if ( $( event.target ).data( 'product_id' ) ) {
				product_id = $( event.target ).data( 'product_id' );
				PC.fe.is_using_shortcode = true;
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
				console.log ('we had an error: ', err);
				PC.fe.close();
			}
		}

		$( '.configure-product-simple' ).on( 'click', configurator_init );
		$( '.mkl-configurator-inline' ).on( 'mkl/pc/inline-init', configurator_init );

		$('form.cart').each(function(index, form) { 

			$(form).find('button').attr('disabled', 'disabled'); 
			$(form).on('submit', function( event ){ 
				$('input[name=pc_configurator_data]').val( PC.fe.save_data.save() ); 
				if( $('input[name=pc_configurator_data]').val() == '' ) {
					event.preventDefault(); 
					console.log('empty data'); 
				}
			});
		});

		wp.hooks.addAction( 'PC.fe.start', 'mkl/product_configurator', function( configurator ){

			$('form.cart').find('button').removeAttr('disabled'); 

			$( 'input[name=quantity]' ).on( 'change',function(e) {
				var q = $(this).val();
				$( 'input[name=quantity]' ).each(function(index, el) {
					$(el).val(q);
				});
			} );
			
		});

		/**
		 * Launch the configurator after click
		 */
		if( PC.fe.config.open_configurator && PC.fe.config.open_configurator == true ) {
			$( '.configure-product-simple' ).trigger( 'click' );
		}

		/**
		 * Launch the configurator inline
		 */
		$( '.mkl-configurator-inline' ).trigger( 'mkl/pc/inline-init' );
	});

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

})(jQuery);

PC.utils = PC.utils || {
	_isTouch: function() {
		// var isTouchDevice = navigator.userAgent.match(/(iPhone|iPod|iPad|Android|playbook|silk|BlackBerry|BB10|Windows Phone|Tizen|Bada|webOS|IEMobile|Opera Mini)/),
			var isTouch = (('ontouchstart' in window) || (navigator.msMaxTouchPoints > 0) || (navigator.maxTouchPoints));
		return isTouch;
	},
	_isMobile: function() {
		var isTouchDevice = navigator.userAgent.match(/(iPhone|iPod|iPad|Android|playbook|silk|BlackBerry|BB10|Windows Phone|Tizen|Bada|webOS|IEMobile|Opera Mini)/);
		return isTouchDevice;
	},
	formatMoney: function ( amount ) {
		if ( 'undefined' === typeof accounting ) return amount;
		return accounting.formatMoney( amount, {
			precision: PC_config.lang.money_precision,
			symbol: PC_config.lang.money_symbol,
			decimal: PC_config.lang.money_decimal,
			thousand: PC_config.lang.money_thousand,
			format: PC_config.lang.money_format
		} );
	}

};