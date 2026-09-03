	$( function() {
		// adds classes to body
		if( PC.utils._isTouch() ){
			$( 'body' ).addClass( 'is-touch' );
		}

		if( PC.utils._isMobile() ){
			$( 'body' ).addClass( 'is-mobile' );
		}

		// Check if the open_configurator is in the URL
		if ( ! PC.fe.config.open_configurator ) {
			var urlParams = new URLSearchParams( location.search );
			if ( urlParams.has( 'open_configurator' ) ) PC.fe.config.open_configurator = true;
		}

		// keyboard-navigation

		$( 'body' ).on( 'keydown', function( e ) {
			if ( $( this ).hasClass( 'keyboard-navigation' ) ) return;
			if ( 'Tab' == e.key && ! e.ctrlKey ) {
				$( this ).addClass( 'keyboard-navigation' );
				PC.fe.keyboard_navigation = true;
			}
		} );

		$( 'body' ).on( 'pointerdown mousedown touchstart', function() {
			if ( !$( this ).hasClass( 'keyboard-navigation' ) ) return;
			$( this ).removeClass( 'keyboard-navigation' );
			PC.fe.keyboard_navigation = false;
		});

		PC.fe.product_type = PC.fe.product_type || 'simple';

		function configurator_init( event ) {

			event.preventDefault();

			if ( PC.fe.config.current_language ) {
				PC.fe.lang = PC.fe.config.current_language;
				PC.utils.add_language_filters( PC.fe.lang );
			}
			var product_id, price;
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

			var reset = false;
			if ( $target.data( 'preset' ) ) {
				if ( ! PC.fe.initial_preset || PC.fe.initial_preset && PC.fe.initial_preset != $target.data( 'preset' ) ) {
					reset = true;
				}
				PC.fe.initial_preset = $target.data( 'preset' );
			}

			if ( $target.data( 'view' ) ) {
				PC.fe.initial_view = $target.data( 'view' );
			}

			if ( 'mkl/pc/inline-init' == event.type ) {
				PC.fe.inline = true;
				PC.fe.inlineTarget = event.target;
			}

			// Open configurator
			try {
				PC.fe.open( product_id, product_id, $target, reset );
			} catch ( err ) {
				console.error( 'we had an error: ', err );
				console.trace( err );
				// PC.fe.close();
			}
		}

		$( 'body' ).on( 'click', '.configure-product-redq_rental', configurator_init );
		$( 'body' ).on( 'click', '.configure-product-simple', configurator_init );
		$( 'body' ).on( 'mkl/pc/inline-init', '.mkl-configurator-inline', configurator_init );

		$('form.cart').each(function(index, form) { 

			if ( $( 'body' ).is( '.is_configurable' ) && ! $( 'body' ).is( '.enable-add-to-cart' ) ) $( form ).find( 'button[name="add-to-cart"]' ).prop( 'disabled', 'disabled' ); 
			$( form ).on( 'submit', function( event ) {
				$( 'input[name=pc_configurator_data]' ).val( PC.fe.save_data.save() ); 
				if( $( 'input[name=pc_configurator_data]' ).val() == '' ) {
					event.preventDefault(); 
					console.log('empty data'); 
				}
			} );
		} );

		/**
		 * Automaticly switch angles
		 */
		function auto_angle_switch( view ) {
			if ( view.model.get( 'angle_switch' ) && 'no' != view.model.get( 'angle_switch' ) )  {
				if ( false === view.model.get( 'cshow' ) ) return;
				var new_angle = PC.fe.angles.get( view.model.get( 'angle_switch' ) );
				if ( new_angle && ! new_angle.get( 'active' ) ) {
					new_angle.collection.each( function( model ) {
						model.set( 'active', false ); 
					});		
					new_angle.set( 'active', true );
				}
		 	}
		}

		wp.hooks.addAction( 'PC.fe.start', 'mkl/product_configurator', function( configurator ) {

			$( 'form.cart button[name="add-to-cart"]' ).prop( 'disabled', false );

			// Register every quantity input as a view of PC.fe.get_qty(). This
			// replaces a document-delegated mirror that copied one input's value
			// into the others: it was re-bound on every start and never removed,
			// and because .val() fires no change event, a change on the product
			// form never reached product_info.qty. bind_qty_input is idempotent.
			PC.fe.bind_qty_input( $( 'form.cart input[name=quantity], .mkl_pc input[name=quantity]' ) );

			// Blocksy buttons compat
			if ( 'object' === typeof ctFrontend && ctFrontend.hasOwnProperty( 'handleEntryPoints' ) && ctFrontend.hasOwnProperty( 'allFrontendEntryPoints' ) ) ctFrontend.handleEntryPoints( ctFrontend.allFrontendEntryPoints );

			// Savoy compatibility
			if ( $.nmThemeInstance && $.nmThemeInstance.quantityInputsBindButtons ) $.nmThemeInstance.quantityInputsBindButtons( $('.mkl_pc') );

			if ( 'function' === typeof avadaAddQuantityBoxes ) avadaAddQuantityBoxes();
			// The configuration is reset before the views are built now - see
			// PC.fe.prepare_initial_state(). Resetting again here would undo the
			// configuration just loaded from the cart or from a saved design.

			// Swipe (DOM: skip when headless or when the layers element is missing)
			if ( ! PC.fe.is_headless() && PC_config.config.swipe_to_change_view && 1 < PC.fe.angles.length ) {
				var $layers = $( '.mkl_pc_layers' );
				if ( $layers.length && $.fn.swipe ) {
					var swipeOptions = {
						triggerOnTouchEnd: true,
						swipeStatus: function( event, phase, direction, distance ) {
							var current_angle = PC.fe.angles.findWhere( { active: true } );
							var current_index = PC.fe.angles.indexOf( current_angle );
							var new_angle = false;
							var previous_angle = 0 <= ( current_index - 1 ) ? PC.fe.angles.at( current_index - 1) : false;
							var next_angle = PC.fe.angles.at( current_index + 1);
							
							if ( 'end' == phase ) {
								if ( 'right' == direction && previous_angle ) {
									new_angle = previous_angle;
								}

								if ( 'left' == direction && next_angle ) {
									new_angle = next_angle;
								}

								if ( current_angle && new_angle ) {
									current_angle.set( 'active', false );
									new_angle.set( 'active', true );
								}
							}
						},
						allowPageScroll: "vertical",
						threshold: 75
					};
					$layers.swipe( swipeOptions );
				}
			}

		}, 20 );


		// The saved configuration used to be applied here, 300ms after everything
		// had rendered. It is applied before the views are built now - see the
		// 'PC.fe.prepare_config' handler further down. What is left is the opening
		// angle, which is a view concern.
		wp.hooks.addAction( 'PC.fe.start', 'mkl/product_configurator', function( configurator ) {
			setTimeout( function() {
				var view_identifier = PC.fe.initial_view || false;
				if ( window.location.hash ) {
					var hash_match = window.location.hash.match(/view=([^,]+)/)
					if ( hash_match && hash_match.length > 1 ) {
						view_identifier = hash_match[1];
					}
				}
				if ( view_identifier ) {
					if ( isNaN( view_identifier ) ) {
						var new_angle = PC.fe.angles.findWhere( { name: view_identifier } );
					} else {
						var new_angle = PC.fe.angles.get( parseInt( view_identifier ) );
					}

					if ( new_angle && ! new_angle.get( 'active' ) ) {
						new_angle.collection.each( function( model ) {
							model.set( 'active', false ); 
						});		
						new_angle.set( 'active', true );
					}
				}
			}, 300 );
		}, 50 );

		wp.hooks.addAction( 'PC.fe.start', 'mkl/product_configurator', function( configurator ) {
			setTimeout( function() {
				wp.hooks.addAction( 'PC.fe.layer.activate', 'mkl/product_configurator', auto_angle_switch, 20 );
				wp.hooks.addAction( 'PC.fe.choice.activate', 'mkl/product_configurator', auto_angle_switch, 20 );
			}, 310 );
		}, 55 );
		
		/* Display mode Full Screen - on activate layer */
		wp.hooks.addAction( 'PC.fe.layer.activate', 'mkl/product_configurator', function( view ) {
			if ( 'full-screen' === view.model.get( 'display_mode' ) ) {
				$( 'body' ).addClass( 'pc-full-screenlayer--opened' );
			}
		} );

		/* Display mode Full Screen - on deactivate layer */
		wp.hooks.addAction( 'PC.fe.layer.deactivate', 'mkl/product_configurator', function( view ) {
			if ( 'full-screen' === view.model.get( 'display_mode' ) ) {
				$( 'body' ).removeClass( 'pc-full-screenlayer--opened' );
			}
		} );

		if ( PC_config.config.open_first_layer ) {
			wp.hooks.addAction( 'PC.fe.start', 'mkl/product_configurator', function( configurator ) {
				if ( PC.fe.is_headless() ) return;
				var $first = configurator.$( '.layer-item:visible' ).first();
				if ( $first.parent().is( '.display-mode-dropdown' ) ) return;
				$first.trigger( 'click' );
			}, 60 );
		}


		/**
		 * Launch the configurator inline
		 */
		$( '.mkl-configurator-inline' ).trigger( 'mkl/pc/inline-init' );

		/**
		 * Launch the configurator after click
		 */
		if ( PC.fe.config.open_configurator && true == PC.fe.config.open_configurator && ! $( '.mkl-configurator-inline' ).length ) {
			$( '.configure-product-simple' ).first().trigger( 'click' );
		}

		// WooCommerce Currency Switcher (Curcy) - cache compat
		jQuery(document.body).on('wmc_cache_compatible_finish', function( event, data ) {
			if ( data.format ) {
				// Override loaded format
				_.each( data.format, ( item, key ) => {
					PC_config.lang[key] = item;
				} )
			}

			// Override currency rate
			if ( data.rate ) {
				PC.fe.config.wcpbc_rate = PC_config.config.wcpbc_rate = data.rate;
			}

			// Trigger events to re-render price elements
			wp.hooks.doAction( 'PC.fe.extra_price.after.get_tax_rates' );
			if ( PC.fe && PC.fe.modal ) {
				PC.fe.modal.trigger( 'PC.fe.extra_price.update_taxes' );
			}
		} );

	} );

	/**
	 * Whether engine mode is on (do not auto-mount viewer / toolbar / footer).
	 * Filter `PC.fe.headless` — default is `!! PC.fe.headless`.
	 *
	 * @return {boolean}
	 */
	PC.fe.is_headless = function() {
		return !! wp.hooks.applyFilters( 'PC.fe.headless', !! PC.fe.headless );
	};

	/**
	 * Assign the session/controller. `PC.fe.ui` is an alias of `PC.fe.modal`.
	 *
	 * @param {Object} modal
	 * @return {Object}
	 */
	PC.fe.set_modal = function( modal ) {
		PC.fe.modal = modal;
		PC.fe.ui = modal;
		return modal;
	};

	/**
	 * Load configurator JSON for a product if it is not already in PC.productData.
	 *
	 * @param {number} product_id
	 * @param {Object}  [options]
	 * @param {boolean} [options.omitImages] Pass omit_images=1 on the fetch (PHP strips URLs after cache).
	 * @param {jQuery}  [options.$element]   Button to toggle the loading-data class.
	 * @return {Promise<Object>}
	 */
	PC.fe.ensureProductData = function( product_id, options ) {
		options = options || {};
		var key = 'prod_' + product_id;
		PC.productData = window.PC.productData || PC.productData || {};

		if ( PC.productData[ key ] && ! options.omitImages ) {
			return Promise.resolve( PC.productData[ key ] );
		}

		if ( options.$element ) {
			options.$element.addClass( 'loading-data' );
		}

		wp.hooks.doAction( 'mkl_pc.product_data.loading', product_id );

		// Prefer the cached JSON file, carried as a data attribute on the trigger
		// element (see get_configurator_element_attributes in frontend-woocommerce.php -
		// same mechanism as data-price/data-regular_price). This avoids rebuilding the
		// payload from postmeta chunks on every open. Reading it off the element rather
		// than a page-wide JS global means it works the same whether there is one
		// trigger or several (e.g. multiple [mkl_configurator_button] shortcodes for
		// different products on one page).
		//
		// Not usable for omitImages: the cached file is the full payload, image URLs
		// included, so an engine-only consumer that asked for them to be stripped has to
		// go through the ajax endpoint that does the stripping.
		var data_url = ( ! options.omitImages && options.$element ) ? options.$element.data( 'config_data_url' ) : null;

		if ( ! data_url ) {
			data_url = PC_config.ajaxurl + '?action=pc_get_data&data=init&fe=1&id=' + product_id;
			if ( PC_config.update_nonce ) {
				data_url += '&nonce=' + encodeURIComponent( PC_config.update_nonce );
			}
			if ( options.omitImages ) {
				data_url += '&omit_images=1';
			}
		}

		return fetch( data_url ).then( function( response ) {
			return response.json();
		} ).then( function( data ) {
			PC.productData = window.PC.productData || {};
			PC.productData[ key ] = data;

			if ( options.$element ) {
				options.$element.removeClass( 'loading-data' );
			}

			wp.hooks.doAction( 'mkl_pc.product_data.loaded', product_id );
			return data;
		} ).catch( function( error ) {
			if ( options.$element ) {
				options.$element.removeClass( 'loading-data' );
			}
			console.error( 'Product configurator: could not load data', error );
			throw error;
		} );
	};

	/**
	 * Detached session/controller used in engine mode. Not inserted into `body`.
	 *
	 * @param {number} product_id
	 * @param {number} parent_id
	 * @return {Backbone.View}
	 */
	PC.fe.create_stub_modal = function( product_id, parent_id ) {
		parent_id = parent_id || product_id;
		if ( PC.fe.views && PC.fe.views.stub_configurator ) {
			return new PC.fe.views.stub_configurator( {
				product_id: product_id,
				parent_id: parent_id
			} );
		}

		// Fallback if views have not loaded: jQuery-only stub with the same surface.
		var $el = $( '<div class="mkl_pc mkl_pc--headless" />' );
		var $main_window = $( '<div class="mkl_pc_container" />' );
		$el.append( $main_window );
		var data_key = 'prod_' + ( ( 'async' !== PC.fe.config.data_mode && parent_id ) ? parent_id : product_id );
		var product_info = ( PC.productData && PC.productData[ data_key ] && PC.productData[ data_key ].product_info ) || {};
		return {
			$el: $el,
			$main_window: $main_window,
			product_id: product_id,
			parent_id: parent_id,
			options: product_info,
			viewer: null,
			toolbar: null,
			footer: null,
			$: function( selector ) {
				return $el.find( selector );
			},
			trigger: function() {
				$el.trigger.apply( $el, arguments );
				return this;
			},
			on: function() {
				$el.on.apply( $el, arguments );
				return this;
			},
			off: function() {
				$el.off.apply( $el, arguments );
				return this;
			},
			open: function() {},
			close: function() {},
			remove: function() {
				$el.remove();
			},
			resetConfig: PC.fe.reset_configuration
		};
	};

	/**
	 * Bring the models to their opening state, before any view is built.
	 *
	 * The order is the point: default selections first, then the configuration
	 * being edited (a cart line item, a saved design or a preset), then
	 * conditional logic - which add-ons hook onto 'PC.fe.prepare_config'. By the
	 * time the toolbar and the viewer are mounted every `cshow` is final, so they
	 * can build only what is actually visible.
	 *
	 * This used to run the other way round: everything rendered, then
	 * 'PC.fe.start' reset the configuration (priority 20) and ran conditions (30),
	 * and the saved configuration landed 300ms later (50). Layers were therefore
	 * rendered in full and hidden again immediately afterwards.
	 *
	 * @param {Backbone.View} configurator The modal, or the stub in engine mode.
	 */
	PC.fe.prepare_initial_state = function( configurator ) {
		if ( ! PC.fe.contents || ! PC.fe.contents.content ) return;

		wp.hooks.doAction( 'PC.fe.prepare_config.before', configurator );

		if ( wp.hooks.applyFilters( 'PC.fe.reset.on.start', true ) ) PC.fe.contents.content.resetConfig();

		/**
		 * Set the configuration up before it is rendered. Anything that changes what
		 * is selected belongs here rather than on 'PC.fe.start'.
		 *
		 * @param {Backbone.View} configurator
		 */
		wp.hooks.doAction( 'PC.fe.prepare_config', configurator );
	};

	// Apply the configuration being edited, so conditional logic sees the real
	// selections rather than the defaults.
	wp.hooks.addAction( 'PC.fe.prepare_config', 'mkl/product_configurator', function() {
		if ( PC_config.config.load_config_content && Array.isArray( PC_config.config.load_config_content ) ) {
			PC.fe.setConfig( PC_config.config.load_config_content );
		} else if ( PC.fe.initial_preset ) {
			PC.fe.setConfig( PC.fe.initial_preset );
		}
	}, 20 );

	/**
	 * Reset choices / optional preset / active angle. Shared by the real modal and the stub.
	 */
	PC.fe.reset_configuration = function() {
		if ( PC.fe.contents && PC.fe.contents.content ) {
			PC.fe.contents.content.resetConfig();
		}

		if ( PC.fe.initial_preset ) {
			PC.fe.setConfig( PC.fe.initial_preset );
		}

		if ( PC.fe.angles && 1 < PC.fe.angles.length ) {
			PC.fe.angles.each( function( model ) {
				model.set( 'active', false );
			} );
			PC.fe.angles.first().set( 'active', true );
		}

		wp.hooks.doAction( 'PC.fe.reset_configurator' );
	};

	/**
	 * Boot layers, choices, and addons without building the configurator UI.
	 *
	 * Resolves after collections exist and `PC.fe.start` has fired. Does not insert
	 * `.mkl_pc` into the document, does not add `configurator_is_opened` on body,
	 * and does not call `modal.open()`.
	 *
	 * `headless` / `initEngine` means do not auto-mount viewer/toolbar/footer.
	 * After this promise, `PC.fe.mountViewer( el )` (or `PC.fe.open()`) can still
	 * construct the UI.
	 *
	 * Headless consumers that change form fields without views must
	 * `choice.set( 'field_value', value )` and
	 * `wp.hooks.doAction( 'PC.fe.form.item.change', choice, fakeEvent )`
	 * so Extra Price radio/select extra prices update.
	 *
	 * @param {number}        product_id
	 * @param {number|Object} [parent_id] Parent product id, or options if the parent is omitted.
	 * @param {Object}        [options]
	 * @param {jQuery}        [options.$element]  Trigger used for data-price / data-price_tiers.
	 *                                            Without it, `product_info.price` from `pc_get_data` is kept.
	 * @param {boolean}       [options.omitImages] Fetch pc_get_data with omit_images=1.
	 * @return {Promise}
	 */
	PC.fe.initEngine = function( product_id, parent_id, options ) {
		if ( parent_id && parent_id.jquery ) {
			options = $.extend( { $element: parent_id }, options || {} );
			parent_id = product_id;
		} else if ( parent_id && 'object' === typeof parent_id ) {
			options = parent_id;
			parent_id = product_id;
		}
		options = options || {};
		parent_id = parent_id || product_id;

		PC.fe.headless = true;

		return PC.fe.ensureProductData( product_id, {
			omitImages: !! options.omitImages,
			$element: options.$element
		} ).then( function() {
			if ( product_id != PC.fe.active_product && PC.fe.modal ) {
				PC.fe.modal.remove();
				PC.fe.set_modal( null );
				wp.hooks.doAction( 'PC.fe.reset_product' );
			}

			PC.fe.active_product = product_id;
			PC.fe.parent_product = parent_id;

			if ( ! PC.fe.modal ) {
				PC.fe.set_modal( PC.fe.create_stub_modal( product_id, parent_id ) );
			} else {
				PC.fe.ui = PC.fe.modal;
			}

			PC.fe.init( product_id, parent_id, options.$element );
			return PC.fe;
		} );
	};

	/**
	 * Replace a headless stub with the real configurator view (same product).
	 *
	 * @param {number} product_id
	 * @param {number} parent_id
	 * @param {jQuery} $element
	 * @param {boolean} reset
	 */
	PC.fe.upgrade_headless_to_ui = function( product_id, parent_id, $element, reset ) {
		PC.fe.headless = false;
		PC.fe.opened = true;
		wp.hooks.doAction( 'PC.fe.before_open' );
		$( 'body' ).addClass( 'configurator_is_opened' );
		if ( PC.fe.inline ) $( 'body' ).addClass( 'configurator_is_inline' );

		if ( PC.fe.modal ) {
			PC.fe.modal.remove();
			PC.fe.set_modal( null );
		}

		PC.fe.set_modal( new PC.fe.views.configurator( { product_id: product_id, parent_id: parent_id } ) );
		PC.fe.trigger_el = $element;

		if ( $element && PC.fe.currentProductData && PC.fe.currentProductData.product_info ) {
			PC.fe.currentProductData.product_info.price = $element.data( 'price' ) || 0;
			PC.fe.currentProductData.product_info.price_tiers = $element.data( 'price_tiers' );
			PC.fe.currentProductData.product_info.regular_price = $element.data( 'regular_price' );
			PC.fe.currentProductData.product_info.is_on_sale = ( 1 == $element.data( 'is_on_sale' ) );
		}

		if ( reset ) {
			PC.fe.reset_configuration();
		}

		// Collections already exist. Skip reset-on-start so lite/engine state is kept.
		wp.hooks.addFilter( 'PC.fe.reset.on.start', 'mkl/product_configurator/upgrade', function() {
			return false;
		} );
		PC.fe.modal.$el.trigger( 'content-is-loaded' );
		wp.hooks.removeFilter( 'PC.fe.reset.on.start', 'mkl/product_configurator/upgrade' );
	};

	PC.fe.init = function( product_id, parent_id, $element ) {
		if ( PC.fe.is_using_shortcode ) {
			this.options = {};
		}

		PC.fe.trigger_el = $element;

		var data_key = ( parent_id && 'async' !== PC.fe.config.data_mode ) ? 'prod_' + parent_id : 'prod_' + product_id;
		var product_data = PC.productData && PC.productData[ data_key ];
		if ( ! product_data || ! product_data.product_info ) {
			console.error( 'Product configurator: missing product data for', product_id );
			return;
		}

		this.currentProductData = product_data;
		this.layers = new PC.layers( product_data.layers );
		this.angles = new PC.angles( product_data.angles, { parse: true } );

		if ( $( $element ).data( 'force_form' ) ) PC.fe.currentProductData.product_info.force_form = true;

		PC.fe.product_type = this.currentProductData.product_info.product_type;
		if ( $element ) {
			this.currentProductData.product_info.price = $element.data( 'price' ) || 0;
			this.currentProductData.product_info.price_tiers = $element.data( 'price_tiers' );
			this.currentProductData.product_info.regular_price = $element.data( 'regular_price' );
			this.currentProductData.product_info.is_on_sale = ( 1 == $element.data( 'is_on_sale' ) );
		} else if ( 'undefined' === typeof this.currentProductData.product_info.price ) {
			// Headless / initEngine: keep Woo price from pc_get_data. Do not zero it.
			this.currentProductData.product_info.price = 0;
		}

		// Seed the quantity from the product form, so opening the configurator
		// keeps whatever the customer already typed there. Silent: nothing is
		// listening yet, and this is the starting value rather than a change.
		// (This used to read the configurator's own input, which does not exist
		// yet at this point, so it always fell back to 1.)
		var $page_qty = $( 'form.cart input[name=quantity]' ).first();
		PC.fe.set_qty( $page_qty.length ? $page_qty.val() : this.currentProductData.product_info.qty, { silent: true } );

		if ( ( 'simple' === PC.fe.product_type && PC.productData['prod_' + product_id] ) || ( 'variation' === PC.fe.product_type && PC.productData['prod_' + product_id] ) ) {
			this.contents = PC.fe.setContent.parse( PC.productData['prod_' + product_id] );
			if ( PC.fe.is_headless() ) {
				// Engine mode: collections are ready. Fire start on the stub; do not build UI.
				PC.fe.prepare_initial_state( this.modal );
				$( PC.fe ).trigger( 'start', this.modal );
				wp.hooks.doAction( 'PC.fe.start', this.modal );
			} else if ( this.modal && this.modal.$el ) {
				this.modal.$el.trigger( 'content-is-loaded' );
			}
		} 

		$( document.body ).trigger( 'mkl-pc-init', product_id, parent_id );
		wp.hooks.doAction( 'PC.fe.init', product_id, parent_id );

	};

	PC.fe.open = function( product_id, parent_id, $element, reset ) {

		parent_id = parent_id ? parent_id : product_id;

		if ( product_id == PC.fe.active_product && PC.fe.headless ) {
			PC.fe.upgrade_headless_to_ui( product_id, parent_id, $element, reset );
			return;
		}

		PC.fe.opened = true;
		wp.hooks.doAction( 'PC.fe.before_open' );
		$('body').addClass('configurator_is_opened');
		if( PC.fe.inline ) $('body').addClass('configurator_is_inline');

		// variations: if product_id is different from active, we remove the modal to create a new one.
		if( product_id == PC.fe.active_product ) {
			this.modal.open(); 
			if ( reset && PC.fe.modal ) {
				PC.fe.modal.resetConfig();
			}
			return;
		}

		if ( product_id != PC.fe.active_product && this.modal ) {
			this.modal.remove();
			PC.fe.set_modal( null );
			wp.hooks.doAction( 'PC.fe.reset_product' );
		}

		PC.fe.active_product = product_id; 
		PC.fe.parent_product = parent_id;

		var boot_ui = function() {
			PC.fe.headless = false;
			PC.fe.set_modal( PC.fe.modal || new PC.fe.views.configurator( { product_id: product_id, parent_id: parent_id } ) );
			PC.fe.init( product_id, parent_id, $element );
		};

		if ( PC.productData && PC.productData['prod_'+parent_id] ) {
			boot_ui();
			return;
		}

		PC.fe.config.data_mode = 'async';
		PC.fe.ensureProductData( product_id, { $element: $element } ).then( function( data ) {
			if ( ! data || ! data.layers || ! data.layers.length || ! data.content || ! data.content.length ) {
				console.log( data );
				if ( $element ) {
					$element.after( $( '<div>Error - the configurator data is incomplete. See browser console for data details</div>' ) );
				}
			}
			boot_ui();
		} );

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
			
			wp.hooks.doAction( 'PC.fe.setContent.parse.before', response );

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

	PC.fe.getLayerContent = PC.fe.get_layer_content = function( id ) {
		if ( PC.fe?.contents?.content.get( id ) ) 
			return PC.fe.contents.content.get( id ).attributes.choices; 
		return false;
	};

	PC.fe.get_choice_model = function( layerId, choiceId ) {
		var content = PC.fe.get_layer_content( layerId );
		if ( ! content || ! choiceId ) return false;
		return content.get( choiceId );
	};

	PC.fe.fetchContent = function( product_id ) {
		if ( ! PC.fe.products_content[product_id] ) { 

			this.modal.$el.show();
			this.modal.$el.addClass( 'loading' );

			var request_data = {
				action: PC.actionParameter,
				data: 'content',
				id: product_id,
			};
			if ( PC_config.update_nonce ) {
				request_data.nonce = PC_config.update_nonce;
			}
			$.ajax({
				url:     wp.ajax.settings.url, 
				type: 'POST',
				dataType: 'json',
				data: request_data,
				context: this,
			})
			.done(function( response ) {
				this.modal.$el.removeClass('loading');
				if ( _.isObject( response ) && response.content ) {
					this.contents = PC.fe.setContent.parse( response ); 
					PC.fe.products_content[product_id] = this.contents;
					// Add conditions to the data
					if ( response.conditions ) {
						PC.productData['prod_' + product_id] = PC.productData['prod_' + product_id] || {};
						PC.productData['prod_' + product_id].conditions = response.conditions;
					}
					$( PC.fe ).trigger( 'variation_content_loaded', { response: response, product_id: product_id } );
					wp.hooks.doAction( 'variation_content_loaded', { response: response, product_id: product_id } );
					this.modal.$el.trigger( 'content-is-loaded' );
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
	 * QUANTITY
	 * ========
	 *
	 * There can be several quantity inputs on a page: WooCommerce's own on the
	 * product form, the one in the configurator, and whatever a theme adds. They
	 * used to be kept in step by copying the value from one input into the
	 * others, which meant the inputs agreed with each other but not necessarily
	 * with product_info.qty - a change made on the product form updated both
	 * boxes without updating the value the price tiers and the extra price
	 * add-on read.
	 *
	 * So the inputs no longer talk to each other. Each one is a view of a single
	 * value: it writes through set_qty() when the customer edits it, and redraws
	 * itself when the value changes, wherever the change came from. Anything
	 * without an input at all - the headless engine, another viewer - just calls
	 * set_qty().
	 */

	/** @type {Array} Inputs registered with PC.fe.bind_qty_input. */
	PC.fe.qty_inputs = [];

	/**
	 * The current quantity, as a number.
	 *
	 * @return {number}
	 */
	PC.fe.get_qty = function() {
		var info = PC.fe.currentProductData && PC.fe.currentProductData.product_info;
		var qty = info ? parseFloat( info.qty ) : NaN;
		return isNaN( qty ) ? 1 : qty;
	};

	/**
	 * Set the quantity, clamped to what the product allows.
	 *
	 * @param {number|string} value
	 * @param {Object} [options] source: the input being edited, which is left
	 *                           alone while it redraws the others; silent: do not
	 *                           fire PC.fe.qty_changed.
	 * @return {number} The value actually stored.
	 */
	PC.fe.set_qty = function( value, options ) {
		options = options || {};
		var info = PC.fe.currentProductData && PC.fe.currentProductData.product_info;
		if ( ! info ) return 1;

		var previous = PC.fe.get_qty();
		var qty = parseFloat( value );
		if ( isNaN( qty ) ) qty = previous;

		// Clamped once here, rather than trusting each input's own min/max: the
		// product form's input is rendered by WooCommerce and the configurator
		// never set bounds on it.
		if ( false === info.show_qty ) {
			qty = 1; // Sold individually.
		} else {
			var min = parseFloat( info.qty_min_value );
			var max = parseFloat( info.qty_max_value );
			if ( ! isNaN( min ) && qty < min ) qty = min;
			if ( ! isNaN( max ) && max && qty > max ) qty = max;
			if ( qty < 1 ) qty = 1;
		}

		/**
		 * Filter the quantity before it is stored.
		 *
		 * @param {number} qty
		 * @param {number|string} value The requested value.
		 * @param {Object} options
		 */
		qty = wp.hooks.applyFilters( 'PC.fe.set_qty', qty, value, options );

		info.qty = qty;
		PC.fe.render_qty_inputs();

		if ( ! options.silent && qty !== previous ) {
			wp.hooks.doAction( 'PC.fe.qty_changed', qty, options );
		}

		return qty;
	};

	/**
	 * Write the current quantity into every registered input.
	 *
	 * The input that was just edited is written to as well, so that a value the
	 * product would not accept is corrected in front of the customer instead of
	 * leaving the box showing something the configurator is not using. This is
	 * safe because inputs report on `change`, once editing is finished, not on
	 * every keystroke.
	 */
	PC.fe.render_qty_inputs = function() {
		var qty = PC.fe.get_qty();
		// Drop inputs that went away with a closed configurator.
		PC.fe.qty_inputs = _.filter( PC.fe.qty_inputs, function( el ) {
			return $.contains( document.documentElement, el );
		} );
		_.each( PC.fe.qty_inputs, function( el ) {
			if ( el.value != qty ) el.value = qty;
		} );
	};

	/**
	 * Make an input a view of the quantity: it reports edits, and redraws when
	 * the value changes elsewhere. Idempotent - an input is only bound once.
	 *
	 * @param {Element|jQuery} el
	 */
	PC.fe.bind_qty_input = function( el ) {
		$( el ).each( function() {
			if ( -1 !== _.indexOf( PC.fe.qty_inputs, this ) ) return;
			PC.fe.qty_inputs.push( this );
			$( this ).on( 'change.mkl-pc-qty', function( event ) {
				PC.fe.set_qty( event.target.value, { source: event.target } );
			} );
		} );
		PC.fe.render_qty_inputs();
	};

	// Keep the displayed price in step with the quantity when the Extra price
	// add-on is not installed. This used to live in the form's own change
	// handler, so it only ran for the configurator's input.
	wp.hooks.addAction( 'PC.fe.qty_changed', 'mkl/product_configurator', function() {
		if ( 'undefined' !== typeof pc_get_extra_price ) return;
		var info = PC.fe.currentProductData && PC.fe.currentProductData.product_info;
		if ( ! info || ! info.price_tiers ) return;

		$( '.pc-total-price' ).html( PC.utils.formatMoney( PC.fe.get_product_price() ) );

		if ( info.regular_price && info.is_on_sale && $( '.pc-total--regular-price' ).length ) {
			$( '.pc-total--regular-price' ).html( PC.utils.formatMoney( parseFloat( info.regular_price ) ) );
		}
	} );

	/**
	 * Select a choice and say who did it.
	 *
	 * The entry point for any input surface that is not the sidebar list - a 3D
	 * hotspot, a canvas viewer, the headless engine, third-party code. It makes
	 * the selection and then announces it on `PC.fe.choice.set_choice`, which is
	 * what conditional logic listens to, so a pick behaves the same wherever it
	 * came from.
	 *
	 * `origin` is the important part. Use 'user' when a person chose (that is
	 * what makes a `clicked` rule match, and what lets the open / sync
	 * conditional actions run); use 'restore', 'api' or 'conditional' when the
	 * selection is programmatic, so those actions do not move the interface
	 * under the customer.
	 *
	 * @param {number} layer_id
	 * @param {number} choice_id
	 * @param {boolean} [activate=true]
	 * @param {Object} [options] { origin: 'user'|'restore'|'conditional'|'api', view }
	 * @return {Backbone.Model|false} The choice, or false when it was not found.
	 */
	PC.fe.select_choice = function( layer_id, choice_id, activate, options ) {
		options = options || {};
		var content = PC.fe.getLayerContent( layer_id );
		if ( ! content || ! content.get ) return false;
		var choice = content.get( choice_id );
		if ( ! choice ) return false;

		content.selectChoice( choice_id, 'undefined' === typeof activate ? true : activate );

		wp.hooks.doAction(
			'PC.fe.choice.set_choice',
			choice,
			options.view || null,
			{ origin: options.origin || 'user' }
		);

		return choice;
	};

	PC.fe.setConfig = function( config_items ) {
		
		PC.fe.is_setting_config = true;

		wp.hooks.doAction( 'PC.fe.setConfig.before', config_items );
		// First reset all to the default choice,
		// in case some of the layers in the saved config are missing / extra
		PC.fe.contents.content.resetConfig();

		$.each( config_items, function( index, config_item ) {
			// layerContents is a Backbone.Collection
			try {
				var layer = PC.fe.layers.get( config_item.layer_id );
				if ( layer && 'group' == layer.get( 'type' ) ) return;
				if ( PC.fe.getLayerContent( config_item.layer_id ) && PC.fe.getLayerContent( config_item.layer_id ).selectChoice ) {
					PC.fe.getLayerContent( config_item.layer_id ).selectChoice( config_item.choice_id, true );
				}
				wp.hooks.doAction( 'PC.fe.setConfig.setItem', config_item, PC.fe.getLayerContent( config_item.layer_id ) );
			} catch ( err ) {
				console.log('Product configurator - setConfig: Could not set this layer:', config_item.layer_id, config_item, err);
			}
		} );

		wp.hooks.doAction( 'PC.fe.setConfig', config_items );

		PC.fe.is_setting_config = false;
	};

	PC.fe.get_product_price = function() {
		if ( !PC.fe?.currentProductData ) return 0;
		const { product_info } = PC.fe.currentProductData;
		const qty = product_info.qty;
		let price = parseFloat( product_info?.price );
		
		if ( product_info?.price_tiers && Array.isArray( product_info.price_tiers ) ) {
			const tier = product_info.price_tiers.find( ( item ) => qty >= parseInt( item.start ) );

			if ( tier ) {
				// Percentage or fixed price
				if ( tier.type.includes( 'percent' ) ) {
					price = price - ( parseFloat( tier.price ) * parseFloat( price ) / 100 );
				} else {
					price = parseFloat( tier.price || 0 );
				}
			}
		}
		return price || 0;
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
