<?php
namespace MKL\PC;
/**
 *	Hooks
 *	
 * @author   Marc Lacroix
 */


if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly
}

if ( ! class_exists('MKL\PC\Frontend_Cart') ) {
	class Frontend_Cart {
		public function __construct() {
			$this->_hooks();
		}

		private function _hooks() {
			add_filter( 'woocommerce_add_cart_item_data', array( $this, 'wc_cart_add_item_data' ), 10, 3 ); 

			add_filter( 'woocommerce_add_cart_item', array( $this, 'add_weight_to_product' ), 10 );
			add_filter( 'woocommerce_get_cart_item_from_session', array( $this, 'add_weight_to_product' ), 20 );
			add_filter( 'woocommerce_product_get_weight', array( $this, 'get_weight' ), 20, 2 );
			
			add_filter( 'woocommerce_order_again_cart_item_data', array( $this, 'wc_order_again_cart_item_data' ), 10, 3 ); 
			// add_filter( 'woocommerce_add_cart_item', array( $this, 'woocommerce_add_cart_item' ), 10, 3 ); 
			add_filter( 'woocommerce_get_item_data', array( $this, 'wc_cart_get_item_data' ), 10, 2 ); 

			add_filter( 'woocommerce_cart_item_thumbnail', array( $this, 'cart_item_thumbnail' ), 30, 3 );
			add_filter( 'woocommerce_get_cart_contents', array( $this, 'block_cart_item_thumbnail' ), 120 );
			add_filter( 'wp_get_attachment_image_src', array( $this, 'wp_get_attachment_image_src' ), 120, 3 );

			add_filter( 'woocommerce_cart_item_permalink', array( $this, 'cart_item_permalink' ), 30, 3 );
			add_filter( 'woocommerce_cart_item_name', array( $this, 'add_image_to_review_order_checkout' ), 100, 3 );

			// add_action( 'woocommerce_after_cart_item_name', array( $this, 'add_edit_link' ), 20, 2 );
			// add_filter( 'woocommerce_add_cart_item', array( $this, 'wc_add_cart_item'), 10, 2 ); 
			// add_action( 'woocommerce_before_calculate_totals', array( &$this, 'pc_price_change' ) ); 
			// Addify Ad to quote
			add_filter( 'addify_add_quote_item_data', array( $this, 'addify_add_quote_item_data' ), 20, 5 );

			// Attach short description filter.
			add_filter( 'rest_request_after_callbacks', array( $this, 'filter_cart_item_data' ), 10, 3 );
		}

		/**
		 * Addify quote
		 *
		 * @param array $quote_item_data
		 * @param integer $product_id
		 * @param integer $variation_id
		 * @param integer $quantity
		 * @param array $form_data
		 * @return array
		 */
		public function addify_add_quote_item_data( $quote_item_data, $product_id, $variation_id, $quantity, $form_data ) {
			if ( ! mkl_pc_is_configurable( $product_id ) || ! isset( $form_data['pc_configurator_data'] ) || '' == $form_data['pc_configurator_data'] ) return $quote_item_data;
			if ( $data = json_decode( stripcslashes( $form_data['pc_configurator_data'] ) ) ) {
				$data = Plugin::instance()->db->sanitize( $data );
				$layers = array();
				if ( is_array( $data ) ) { 
					foreach( $data as $layer_data ) {
						$layers[] = new Choice( $product_id, $variation_id, $layer_data->layer_id, $layer_data->choice_id, $layer_data->angle_id, $layer_data );
					}
				}
				$quote_item_data['configurator_data'] = $layers; 
				$quote_item_data['configurator_data_raw'] = $data;
			}

			// if ( $data = json_decode( stripcslashes( $form_data['pc_configurator_data'] ) ) ) {
			// 	$data = Plugin::instance()->db->sanitize( $data );
			// 	$quote_item_data['configurator_data'] = $form_data['pc_configurator_data']; 
			// }

			// 	$cart_item_data['configurator_data_raw'] = $data;
			// }
			return $quote_item_data;
		}
		
		// Filter data that's saved in the cart, and add the configurator data
		public function wc_cart_add_item_data( $cart_item_data, $product_id, $variation_id ) {
			if ( mkl_pc_is_configurable( $product_id ) ) {

				if ( isset( $_POST['pc_configurator_data'] ) && '' != $_POST['pc_configurator_data'] ) { 

					/**
					 * Editing the cart: Delete and replace the item from the cart
					 */
					if ( isset( $_POST['pc_cart_item_key'] ) ) {
						$cart = WC()->cart;
						if ( $cart->get_cart_item( $_POST['pc_cart_item_key'] ) );
						$cart->remove_cart_item( $_POST['pc_cart_item_key'] );
					}


					if ( $data = json_decode( stripcslashes( $_POST['pc_configurator_data'] ) ) ) {
						$data = Plugin::instance()->db->sanitize( $data );
						$item_weight = 0;
						$layers = array();
						if ( is_array( $data ) ) { 
							foreach( $data as $layer_data ) {
								$choice = new Choice( $product_id, $variation_id, $layer_data->layer_id, $layer_data->choice_id, $layer_data->angle_id, $layer_data );
								$layers[] = $choice;
								if ( $weight = $choice->get_choice( 'weight' ) ) {
									$item_weight += apply_filters( 'mkl_pc/wc_cart_add_item_data/choice_weight', floatval( $weight ), $choice );
								}
								do_action_ref_array( 'mkl_pc/wc_cart_add_item_data/adding_choice', array( $choice, &$data ) );
							}
						}

						if ( $item_weight ) {
							$cart_item_data['configuration_weight'] = $item_weight; 
						}
						$cart_item_data['configurator_data'] = $layers; 
						$cart_item_data['configurator_data_raw'] = $data;
					}
				} 
			} 
			return $cart_item_data; 
		}

		/**
		 * Add the configuration data when Ordering again
		*/
		public function wc_order_again_cart_item_data( $data, $item, $order ) {
			$conf_data = $item->get_meta( '_configurator_data' );
			$raw_conf_data = $item->get_meta( '_configurator_data_raw' );
			if ( $conf_data && $raw_conf_data ) {
				$data['configurator_data'] = $conf_data;
				$data['configurator_data_raw'] = $raw_conf_data;
			}
			return $data;
		}

		public function wc_cart_get_item_data( $data, $cart_item ) { 

			if ( mkl_pc_is_configurable( $cart_item['product_id'] ) && isset( $cart_item['configurator_data'] ) ) { 

				$configurator_data = $cart_item['configurator_data'];
				$choices = array();
				$sku_mode = apply_filters( 'mkl_pc/sku_mode', mkl_pc( 'settings')->get( 'sku_mode' ), $cart_item['data'] );
				$compound_sku = 'compound' == $sku_mode && wc_product_sku_enabled() && mkl_pc( 'settings')->get( 'show_sku_in_cart' );
				$sku = [];
				$edit_link = '';

				/**
				 * Filter mkl_pc_user_can_edit_item_from_cart. Whether or not to display the edit link in the cart
				 * @return boolean
				 */
				if ( apply_filters( 'mkl_pc_user_can_edit_item_from_cart', true ) ) {
					$edit_link = $this->get_edit_link( $cart_item );
				}

				foreach ($configurator_data as $layer) {
					if ( $layer && $layer->is_choice() ) { 
						if ( $layer->get_layer( 'hide_in_cart' ) || $layer->get_choice( 'hide_in_cart' ) ) continue;
						$choice_images = $layer->get_choice( 'images' );
						$choice_image = '';
						if ( apply_filters( 'mkl_pc/wc_cart_get_item_data/display_choice_image', true ) && ! empty( $choice_images ) && $choice_images[0]["thumbnail"]['id'] != '' ) {
							$choice_image = '<span class="choice-thumb"><img src="' . wp_get_attachment_url( $choice_images[0]["thumbnail"]['id'] ) . '" alt=""></span> ';
						}
						$item_data = Product::set_layer_item_meta( $layer, $cart_item['data'], $cart_item[ 'key' ], 'cart' );
						if ( empty( $item_data[ 'label' ] ) && empty( $item_data['value'] ) ) continue;
						$layer_name = $item_data['label'];//apply_filters( 'mkl_pc_cart_get_item_data_layer_name', $layer->get_layer( 'name' ), $layer );
						$choices[] = apply_filters( 'mkl_pc/wc_cart_get_item_data/choice', [ 'name' => $layer_name, 'value' => '<span class="mkl_pc-choice-value">' . $choice_image . $item_data['value'] . '</span>', 'layer' => $layer ], $layer, $cart_item );

						if ( $compound_sku && ! is_null( $layer->get_choice( 'sku' ) ) ) {
							$sku[] = $layer->get_choice( 'sku' );
						}
						//apply_filters( 'mkl_pc_cart_get_item_data_choice_name', $choice_image . ' ' . $layer->get_choice( 'name' ), $layer ); 
					}
				}

				if ( $compound_sku && count( $sku ) ) {
					$data[] = array(
						'className' => 'configuration-sku',
						'key' => mkl_pc( 'settings')->get_label( 'sku_label', __( 'SKU', 'product-configurator-for-woocommerce' ) ),
						'value' => implode( mkl_pc( 'settings')->get_label( 'sku_glue', '' ), $sku )
					);
				}

				if ( 'block' == $this->_get_cart_item_context() ) {
					$value = '&nbsp;';
				} else {
					$value = $this->get_choices_html( $choices );
					if ( $edit_link ) {
						$value .= '<div class="mkl-pc-edit-link--container">' . $edit_link . '</div>';
					}
				}

				$data[] = array(
					'className' => 'mkl-configuration',
					'key' => mkl_pc( 'settings' )->get_label( 'configuration_cart_meta_label', __( 'Configuration', 'product-configurator-for-woocommerce' ) ),
					'value' => $value
				);

				if ( 'block' == $this->_get_cart_item_context() ) {

					$data = array_merge( $data, array_map( function( $item ) {
						if ( isset( $item['choice'] ) ) unset( $item['choice'] );
						return $item;
					}, $this->get_choices_data( $choices ) ) );

					/**
					 * Filter mkl_pc_user_can_edit_item_from_cart. Whether or not to display the edit link in the cart
					 * @return boolean
					 */
					// Links aren't supported yet
					// if ( ! is_admin() && apply_filters( 'mkl_pc_user_can_edit_item_from_cart', true ) && $edit_link ) {
					// 	$data[] = [
					// 		'className' => 'mkl-configuration--edit-link',
					// 		'key' => '',
					// 		'name' => '',
					// 		'value' => '<div class="mkl-pc-edit-link--container">' . $edit_link . '</div>',
					// 	];
					// }
				}
			}

			return $data; 
		}

		/**
		 * Filter the cart item's permalink
		 *
		 * @param string $permalink
		 * @param array  $cart_item
		 * @param string $cart_item_key
		 * @return string
		 */
		public function cart_item_permalink( $permalink, $cart_item, $cart_item_key ) {
			/**
			 * Filter mkl_pc_user_can_edit_item_from_cart. Whether or not to display the edit link in the cart
			 * @return boolean
			 */
			if ( ! apply_filters( 'mkl_pc_user_can_edit_item_from_cart', true ) ) return $permalink;
			
			if ( mkl_pc_is_configurable( $cart_item['product_id'] ) && isset( $cart_item['configurator_data'] ) ) {
				return $permalink ? add_query_arg( [ 'load_config_from_cart' => $cart_item_key, 'open_configurator' => 1 ], $permalink ) : $permalink;
			} else {
				return $permalink;
			}
		}

		/**
		 * Filter the cart item's image
		 *
		 * @param string $image
		 * @param array  $cart_item
		 * @param string $cart_item_key
		 * @return string
		 */
		public function cart_item_thumbnail( $image, $cart_item, $cart_item_key ) {
			if ( ! mkl_pc( 'settings' )->get( 'show_image_in_cart' ) ) return $image;
			if ( mkl_pc_is_configurable( $cart_item['product_id'] ) && isset( $cart_item['configurator_data'] ) ) { 
				$configuration = $this->_get_configuration_for_cart_item( $cart_item );
				$size = mkl_pc( 'settings' )->get( 'cart_thumbnail_size', 'woocommerce_thumbnail' );
				$img = $configuration->get_image( $size );

				if ( $img ) return $img;
			}

			return $image;
		}

		/**
		 * Filter the cart content in order to replace the thumbnail.
		 *
		 * @param [type] $cart_content
		 * @return void
		 */
		public function block_cart_item_thumbnail( $cart_content ) {
			static $ran_filter;
			if ( $ran_filter ) return $cart_content;
			$ran_filter = true;

			if ( ! mkl_pc( 'settings' )->get( 'show_image_in_cart' ) ) return $cart_content;
			$size = mkl_pc( 'settings' )->get( 'cart_thumbnail_size', 'woocommerce_thumbnail' );
			foreach ( $cart_content as $key => $cart_item ) {
				if ( mkl_pc_is_configurable( $cart_item['product_id'] ) && isset( $cart_item['configurator_data'] ) ) {
					$configuration = $this->_get_configuration_for_cart_item( $cart_item );
					$img_url = $configuration->get_image_url( false, $size );

					if ( ! $img_url || ! is_string( $img_url ) ) continue;

					if ( 'save_to_disk' === mkl_pc( 'settings' )->get( 'save_images', 'save_to_disk' ) ) {
						$attachment_id = Utils::get_image_id( $img_url );

						// If we have an attachment ID, set the ID and move to the next item
						if ( $attachment_id ) {
							$cart_content[ $key ]['data']->set_image_id( $attachment_id );
							continue;
						}
					}

					if ( str_contains( $cart_content[ $key ]['data']->get_image_id(), '-replace-with-' ) ) continue;
					$cart_content[ $key ]['data']->set_image_id( $cart_content[ $key ]['data']->get_image_id() . '-replace-with-' . $img_url );
				}
			}
		
			return $cart_content;
		}

		/**
		 * Replace the image
		 *
		 * @param string $image
		 * @param mixed $attachment_id
		 * @param [type] $size
		 * @return string
		 */
		public function wp_get_attachment_image_src( $image, $attachment_id, $size ) {
			if ( is_string( $attachment_id ) && str_contains( $attachment_id, '-replace-with-' ) ) {
				$pos = strpos( $attachment_id, '-replace-with-' );
				$url = substr( $attachment_id, $pos + 14 );
				$parts = parse_url( $url );
				$query = [];
				if ( isset( $parts['query'] ) ) {
					parse_str( $parts['query'], $query );
				}
				return [
					$url,
					$query['width'] ?? 300,
					$query['height'] ?? 300,
					false
				];
			}
			return $image;
		}

		/**
		 * Add image to the checkout page
		 *
		 * @param string $name
		 * @param array  $cart_item
		 * @param string $cart_item_key
		 * @return string
		 */
		public function add_image_to_review_order_checkout( $name, $cart_item, $cart_item_key ) {
			if ( ! is_checkout() ) return $name;
			if ( ! mkl_pc( 'settings' )->get( 'force_image_in_checkout' ) ) return $name;
			$product   = $cart_item['data'];
			$thumbnail = apply_filters( 'woocommerce_cart_item_thumbnail', $product->get_image(), $cart_item, $cart_item_key );
			return $thumbnail . $name;
		}

		/**
		 * Order images
		 *
		 * @param object $choice_a
		 * @param object $choice_b
		 * @return integer
		 */
		private function _order_images( $choice_a, $choice_b ) {
			if ( ! $choice_a || ! $choice_b ) return 0;
			$a = $choice_a->get_layer( 'image_order' );
			$b = $choice_b->get_layer( 'image_order' );
			// fallback to normal sort
			if ( false === $a ) {
				$a = $choice_a->get_layer( 'order' );
				$b = $choice_b->get_layer( 'order' );
			}
			return ($a > $b) ? +1 : -1;
		}

		/**+
		 * Get the choices HTML to be displayed
		 */
		public function get_choices_html( $choices ) {
			$data = $this->get_choices_data( $choices );
			$output = '';
			foreach ( $data as $choice ) {
				$classes = $choice[ 'className' ];
				$before = apply_filters( 'mkl_pc_cart_item_choice_before', '<div' . ( $classes ? ' class="' . esc_attr( $classes ) . '"' : '' ) . '>', $choice['choice'] );
				$after = apply_filters( 'mkl_pc_cart_item_choice_after', '</div>', $choice['choice'] );
				$output .= apply_filters( 'mkl_pc_cart_item_choice', $before . '<strong>' . stripslashes( $choice['key'] ) .'</strong><span class="semicol">:</span> ' . stripslashes( $choice['value'] ) . $after, $choice['key'], $choice['value'], $before, $after );
			}

			return $output;
		}

		/**+
		 * Get the choices Data
		 */
		public function get_choices_data( $choices ) {
			$data = [];
			foreach ( $choices as $choice ) {
				$classes = [];
				if ( isset( $choice['layer'] ) && is_callable( [ $choice['layer'], 'get_layer' ] ) ) {
					$classes[] = $choice['layer']->get_layer( 'type' );
					$classes[] = $choice['layer']->get_layer( 'class_name' );
					$classes[] = $choice['layer']->get_choice( 'class_name' );
					$classes[] = $choice['layer']->get_layer( 'html_id' );
					// $classes = Utils::sanitize_html_classes( $choice['layer']->get_layer( 'type' ) . ' ' . $choice['layer']->get_layer( 'class_name' ) );
				}
				$classes = Utils::sanitize_html_classes( array_filter( apply_filters( 'mkl_pc_cart_item_choice__classes', $classes, $choice['layer'] ) ) );
				$item = apply_filters( 'mkl_pc_cart_item_choice_data', [
					'className' => $classes,
					'key' => $choice['name'],
					'name' => $choice['name'],
					'value' => $choice['value'],
					'choice' => $choice
				], $choice );

				// if ( WC()->is_rest_api_request() ) {
				// 	unset( $item[ 'choice' ] );
				// }
				$data[] = $item;
			}

			return $data;
		}

		/**
		 * Add edit link to the cart item
		 *
		 * @param array  $cart_item
		 * @param string $cart_item_key
		 * @return void
		 */
		public function get_edit_link( $cart_item ) {
			$cart_item_key = isset( $cart_item['key'] ) ? $cart_item['key'] : '';
			$_product   = apply_filters( 'woocommerce_cart_item_product', $cart_item['data'], $cart_item, $cart_item_key );
			$product_id = apply_filters( 'woocommerce_cart_item_product_id', $cart_item['product_id'], $cart_item, $cart_item_key );

			if ( ! mkl_pc_is_configurable( $product_id ) || ! isset( $cart_item['configurator_data'] ) ) return '';

			if ( $_product && $_product->exists() && $cart_item['quantity'] > 0 && apply_filters( 'woocommerce_cart_item_visible', true, $cart_item, $cart_item_key ) ) {
				$product_permalink = apply_filters( 'woocommerce_cart_item_permalink', $_product->is_visible() ? $_product->get_permalink( $cart_item ) : '', $cart_item, $cart_item_key );
				if ( ! $product_permalink ) return;
				if ( isset( $cart_item['context'] ) ) $product_permalink = add_query_arg( [ 'context' => esc_attr( $cart_item['context'] ) ], $product_permalink );
				$product_permalink = add_query_arg( [ 'edit_config_from_cart' => 1 ], $product_permalink );
				return '<a href="' . esc_url( $product_permalink ) . '" class="mkl-pc--edit-configuration">' . apply_filters( 'mkl_pc_edit_configuration_label', mkl_pc( 'settings' )->get_label( 'edit_configuration_label', __( 'Edit configuration', 'product-configurator-for-woocommerce' ) ) ) . '</a>';
			}

			return '';
		}

		/**
		 * Add the weight from the cart item to the product, to be used when `$product->get_weight()` is called
		 *
		 * @param array $cart_item
		 * @return array
		 */
		public function add_weight_to_product( $cart_item ) {
			if ( isset( $cart_item['data'] ) && isset( $cart_item['configuration_weight'] ) ) {
				$cart_item['data']->update_meta_data( 'configuration_weight', $cart_item['configuration_weight'] );
			}
			return $cart_item;
		}

		/**
		 * Maybe add the extra weight to the original item
		 *
		 * @param float      $weight
		 * @param WC_Product $product
		 * @return float
		 */
		public function get_weight( $weight, $product ) {
			if ( $extra_weight = $product->get_meta( 'configuration_weight', true ) ) {
				return floatval( $weight ) + floatval( $extra_weight );
			}
			return $weight;
		}


		private function _get_cart_item_context() {
			if ( ( is_cart() || is_checkout() ) && has_blocks() && ( has_block( 'woocommerce/cart' ) || has_block( 'woocommerce/checkout' ) ) ) {
				return 'block';
			}

			$trace = debug_backtrace( DEBUG_BACKTRACE_IGNORE_ARGS, 10 );
			foreach( $trace as $call ) {
				// [class] => Automattic\WooCommerce\StoreApi\Schemas\V1\CartItemSchema
				if ( isset( $call['class'] ) && false !== strpos( $call['class'], 'CartItemSchema' ) ) {
					return 'block';
				}
			}
			return 'default';
		}

		/**
		 * Get the configuration object for a given cart_item
		 *
		 * @param array $cart_item
		 * @return Configuration
		 */
		private function _get_configuration_for_cart_item( $cart_item ) {
			$configurator_data = $cart_item['configurator_data'];
			$choices = array(); 
			usort( $configurator_data, [ $this, '_order_images' ] );
			foreach ( $configurator_data as $layer ) {
				if ( ! $layer ) continue;
				if ( $choice_image = $layer->get_image_id( 'image' ) ) {
					$choices[] = [ 'image' => $choice_image ];
				}
			}

			return new Configuration( NULL, array( 'product_id' => $cart_item['product_id'], 'content' => json_encode( $choices ) ) );
		}

		// public function pc_price_change( $cart_object ) {
		//     foreach ( $cart_object->cart_contents as $key => $value ) {
		//         if( mkl_pc_is_configurable($value['product_id']) ) {

		//         }
		//     }
		// }

		/**
		 * Filter store API responses to add edit link
		 * 
		 * Props to Kathy D who shared this on Slack. Hopefully WooCommerce soon has a proper method to add this type of thing.
		 *
		 * @param  $response  WP_REST_Response
		 * @param  $server    WP_REST_Server
		 * @param  $request   WP_REST_Request
		 * @return WP_REST_Response
		 */
		public function filter_cart_item_data( $response, $server, $request ) {

			if ( is_wp_error( $response ) ) {
				return $response;
			}

			if ( strpos( $request->get_route(), 'wc/store' ) === false ) {
				return $response;
			}

			$data = $response->get_data();

			if ( empty( $data['items'] ) ) {
				return $response;
			}

			$cart = WC()->cart->get_cart();

			foreach ( $data['items'] as &$item_data ) {

				$cart_item_key = $item_data['key'];
				$cart_item     = isset( $cart[ $cart_item_key ] ) ? $cart[ $cart_item_key ] : null;

				if ( is_null( $cart_item ) ) {
					continue;
				}

				$this->filter_container_cart_item_short_description( $item_data, $cart_item );

			}

			$response->set_data( $data );

			return $response;
		}


		/**
		 * Filter container cart item permalink to support cart editing.
		 *
		 *
		 * @param array  $item_data
		 * @param array  $cart_item
		 */
		public function filter_container_cart_item_short_description( &$item_data, $cart_item ) {

				$_product = $cart_item['data'];

				$trimmed_short_description = '';

				if ( ! $item_data['permalink'] || ! strpos( $item_data['permalink'], 'load_config_from_cart' ) ) return;

				if ( $item_data['short_description'] ) {
					$trimmed_short_description = '<p class="wc-block-components-product-metadata__description-text">' . wp_trim_words( $item_data['short_description'], 12 ) . '</p>';
				}

				$edit_in_cart_link = $item_data['permalink'];
				$my_button         = '<p class="wc-block-cart-item__edit"><a class="wc-block-components-button mkl-pc-edit-link" href="' . esc_url( $edit_in_cart_link ) . '"><span class="wc-block-components-button__text">' . esc_html__( 'Edit configuration', 'product-configurator-for-woocommerce' ) . '</span></a></p>';
				
				$item_data['short_description'] = $trimmed_short_description . $my_button;
		}
	}
}
