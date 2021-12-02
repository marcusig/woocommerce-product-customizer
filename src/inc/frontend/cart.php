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
			// add_filter( 'woocommerce_add_cart_item', array( $this, 'woocommerce_add_cart_item' ), 10, 3 ); 
			add_filter( 'woocommerce_get_item_data', array( $this, 'wc_cart_get_item_data' ), 10, 2 ); 
			add_filter( 'woocommerce_cart_item_thumbnail', array( $this, 'cart_item_thumbnail' ), 30, 3 );
			add_filter( 'woocommerce_cart_item_permalink', array( $this, 'cart_item_permalink' ), 30, 3 );
			// add_action( 'woocommerce_after_cart_item_name', array( $this, 'add_edit_link' ), 20, 2 );
			// add_filter( 'woocommerce_add_cart_item', array( $this, 'wc_add_cart_item'), 10, 2 ); 
			// add_action( 'woocommerce_before_calculate_totals', array( &$this, 'pc_price_change' ) ); 
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
						$layers = array();
						if ( is_array( $data ) ) { 
							foreach( $data as $layer_data ) {
								$layers[] = new Choice( $product_id, $variation_id, $layer_data->layer_id, $layer_data->choice_id, $layer_data->angle_id, $layer_data );
							}
						}
						$cart_item_data['configurator_data'] = $layers; 
						$cart_item_data['configurator_data_raw'] = $data;
					}
				} 
			} 
			return $cart_item_data; 
		}

		public function wc_cart_get_item_data( $data, $cart_item ) { 

			if ( mkl_pc_is_configurable( $cart_item['product_id'] ) && isset( $cart_item['configurator_data'] ) ) { 

				$configurator_data = $cart_item['configurator_data'];
				$choices = array(); 
				$compound_sku = 'compound' == mkl_pc( 'settings')->get( 'sku_mode' ) && wc_product_sku_enabled() && mkl_pc( 'settings')->get( 'show_sku_in_cart' );
				$sku = [];

				foreach ($configurator_data as $layer) {
					if ( $layer->is_choice() ) { 
						$choice_images = $layer->get_choice( 'images' );
						$choice_image = '';
						if ( ! empty( $choice_images ) && $choice_images[0]["thumbnail"]['id'] != '' ) {
							$choice_image = '<span class="choice-thumb"><img src="' . wp_get_attachment_url( $choice_images[0]["thumbnail"]['id'] ) . '" alt=""></span> ';
						}
						$item_data = Product::set_layer_item_meta( $layer, $cart_item['data'] );
						$layer_name = $item_data['label'];//apply_filters( 'mkl_pc_cart_get_item_data_layer_name', $layer->get_layer( 'name' ), $layer );
						$choices[] = apply_filters( 'mkl_pc/wc_cart_get_item_data/choice', [ 'name' => $layer_name, 'value' => $choice_image . $item_data['value'] ], $layer, $cart_item );

						if ( $compound_sku && $layer->get_choice( 'sku' ) ) {
							$sku[] = $layer->get_choice( 'sku' );
						}
						//apply_filters( 'mkl_pc_cart_get_item_data_choice_name', $choice_image . ' ' . $layer->get_choice( 'name' ), $layer ); 
					}
				}

				if ( $compound_sku && count( $sku ) ) {
					$data[] = array(
						'key' => mkl_pc( 'settings')->get( 'sku_label', __( 'SKU', 'product-configurator-for-woocommerce' ) ),
						'value' => implode( mkl_pc( 'settings')->get( 'sku_glue', '' ), $sku )
					);
				}

				$value = $this->get_choices_html( $choices );

				/**
				 * Filter mkl_pc_user_can_edit_item_from_cart. Whether or not to display the edit link in the cart
				 * @return boolean
				 */
				if ( apply_filters( 'mkl_pc_user_can_edit_item_from_cart', true ) && $edit_link = $this->get_edit_link( $cart_item ) ) {
					$value .= '<div class="mkl-pc-edit-link--container">' . $edit_link . '</div>';
				}

				$data[] = array( 
					'key' => __( 'Configuration', 'product-configurator-for-woocommerce' ),
					'value' => $value
				);				

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
				$configurator_data = $cart_item['configurator_data'];
				$choices = array(); 
				usort( $configurator_data, [ $this, '_order_images' ] );
				foreach ( $configurator_data as $layer ) {
					$choice_images = $layer->get_choice( 'images' );
					if( $choice_images[0]["image"]['id'] ) {
						$choices[] = [ 'image' => $choice_images[0]["image"]['id'] ];
					}
				}

				$configuration = new Configuration( NULL, array( 'product_id' => $cart_item['product_id'], 'content' => json_encode( $choices ) ) );
				$size = mkl_pc( 'settings' )->get( 'cart_thumbnail_size', 'woocommerce_thumbnail' );
				$img = $configuration->get_image( $size );

				if ( $img ) return $img;
			}

			return $image;
		}

		/**
		 * Order images
		 *
		 * @param object $choice_a
		 * @param object $choice_b
		 * @return integer
		 */
		private function _order_images( $choice_a, $choice_b ) {
			$a = $choice_a->get_layer( 'image_order' );
			$b = $choice_b->get_layer( 'image_order' );
			// fallback to normal sort
			if ( false === $a ) {
				$a = $choice_a->get_layer( 'order' );
				$b = $choice_b->get_layer( 'order' );
			}
			return ($a > $b) ? +1 : -1;
		}

		public function get_choices_html( $choices ) {
			$output = '';
			$before = apply_filters( 'mkl_pc_cart_item_choice_before', '<div>' );
			$after = apply_filters( 'mkl_pc_cart_item_choice_after', '</div>' );
			foreach ( $choices as $choice ) {
				$output .= apply_filters( 'mkl_pc_cart_item_choice', $before . '<strong>' . $choice['name'] .'</strong><span class="semicol">:</span> ' . $choice['value'] . $after, $choice['name'], $choice['value'], $before, $after );
			}

			return $output;

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
				$product_permalink = add_query_arg( [ 'edit_config_from_cart' => 1 ], $product_permalink );
				return '<a href="' . esc_url( $product_permalink ) . '" class="mkl-pc--edit-configuration">' . apply_filters( 'mkl_pc_edit_configuration_label', __( 'Edit configuration', '' ) ) . '</a>';
			}

			return '';
		}

		// public function wc_add_cart_item( $data, $cart_item_key ) {

		// 	return $data;

		// }

		// public function pc_price_change( $cart_object ) {
		//     foreach ( $cart_object->cart_contents as $key => $value ) {
		//         if( mkl_pc_is_configurable($value['product_id']) ) {

		//         }
		//     }
		// }

	}
}
