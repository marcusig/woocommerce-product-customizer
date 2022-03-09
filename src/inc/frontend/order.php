<?php
namespace MKL\PC;
/**
 *	
 *	
 * @author   Marc Lacroix
 */


if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly
}

if ( ! class_exists('MKL\PC\Frontend_Order') ) {
	class Frontend_Order {
		public function __construct() {
			$this->_hooks();
		}
		private function _hooks() {
			add_action( 'woocommerce_checkout_create_order_line_item', array( $this, 'save_data' ), 20, 4 );
			add_filter( 'woocommerce_admin_order_item_thumbnail', array( $this, 'order_admin_item_thumbnail' ), 30, 3 );
			add_filter( 'woocommerce_order_item_thumbnail', array( $this, 'order_item_thumbnail' ), 30, 2 );
			add_filter( 'woocommerce_email_order_items_args', array( $this, 'add_image_to_email' ) );
		}

		public function save_data( $item, $cart_item_key, $values, $order ) {
			if ( isset( $values['configurator_data'] ) ) {
				$configurator_data = $values['configurator_data'];
				static $items_count;
				if ( ! $items_count ) {
					$items_count = 1;
				} else {
					$items_count += 1;
				}
				if ( is_array( $configurator_data ) ) {
					$order_meta_for_configuration = [];
					$compound_sku = 'compound' == mkl_pc( 'settings')->get( 'sku_mode' ) && wc_product_sku_enabled();
					$sku = [];
	
					// stores each couple layer name + choice as a order_item_meta, for automatic extraction
					foreach ( $configurator_data as $layer ) {
						if ( is_object($layer) ) {
							if ( $layer->get_layer( 'hide_in_cart' ) || $layer->get_choice( 'hide_in_cart' ) ) continue;
							if ( $layer->is_choice() ) :
								$order_meta_for_configuration[]	= apply_filters( 'mkl_pc/order_created/save_layer_meta', $this->set_order_item_meta( $layer, $values['data'] ), $layer, $item, $values, $items_count );
								if ( $compound_sku && $layer->get_choice( 'sku' ) ) {
									$sku[] = $layer->get_choice( 'sku' );
								}								
								do_action( 'mkl_pc/order_created/after_save_layer_meta', $layer, $item, $order );
							?>
							<?php
							endif;
						} 
					}

					if ( $compound_sku && count( $sku ) ) {
						$item->add_meta_data( 
							mkl_pc( 'settings')->get( 'sku_label', __( 'SKU', 'product-configurator-for-woocommerce' ) ),
							implode( mkl_pc( 'settings')->get( 'sku_glue', '' ), $sku )
						);
					}
	
					if ( ! empty( $order_meta_for_configuration ) ) {
						$item->add_meta_data( apply_filters( 'mkl_pc/order_created/saved_data/label', __( 'Configuration', 'product-configurator-for-woocommerce' ), $item, $cart_item_key, $values, $order ),  $this->get_choices_html( $order_meta_for_configuration ), false );
					}

					do_action( 'mkl_pc/order_created/after_saved_data', $item, $order, $configurator_data );
				}
				
				// stores the whole _configurator_data object
				$item->add_meta_data( '_configurator_data', $configurator_data, false );
			}		
		}

		public function set_order_item_meta( $layer, $product ) {
			$meta = array(
				'label' => $layer->get_layer('name'),
				'value' => $layer->get_choice('name'),
				'layer' => $layer,
			);
			return apply_filters( 'mkl_pc_order_item_meta', $meta, $layer, $product ); 
		}

		/**
		 * Filter the admin order item's image
		 *
		 * @param string $image
		 * @param int    $item_id
		 * @param object $order_item
		 * @return string
		 */
		public function order_admin_item_thumbnail( $image, $item_id, $order_item ) {
			if ( ! mkl_pc( 'settings' )->get( 'show_image_in_cart' ) ) return $image;
			
			if ( $config_image = $this->_get_order_item_image( $order_item ) ) return $config_image;

			return $image;
		}

		public function get_choices_html( $choices ) {
			$output = '';
			foreach ( $choices as $choice ) {
				if ( empty( $choice ) ) continue;
				if ( isset( $choice['layer'] ) && is_callable( [ $choice['layer'], 'get_layer' ] ) ) {
					$classes = Utils::sanitize_html_classes( $choice['layer']->get_layer( 'class_name' ) );
				}

				$before = apply_filters( 'mkl_pc_cart_item_choice_before', '<div' . ( $classes ? ' class="' . $classes . '"' : '' ) . '>', $choice );
				$after = apply_filters( 'mkl_pc_cart_item_choice_after', '</div>' );
				$output .= apply_filters( 'mkl_pc_cart_item_choice', $before . '<strong>' . $choice['label'] .'</strong>' . ( $choice['label'] ? '<span class="semicol">:</span> ' : '' ) . $choice['value'] . $after, $choice['label'], $choice['value'], $before, $after );
			}

			return '<div class="order-configuration-details">' . $output . '</div>';

		}

		/**
		 * Filter the order email item's image
		 *
		 * @param string $image
		 * @param object $order_item
		 * @return string
		 */
		public function order_item_thumbnail( $image, $order_item ) {
			if ( ! mkl_pc( 'settings' )->get( 'show_image_in_cart' ) ) return $image;
			
			if ( $config_image = $this->_get_order_item_image( $order_item ) ) return $config_image;

			return $image;
		}

		/**
		 * Add the product image to the email
		 *
		 * @param array $args
		 * @return array
		 */
		public function add_image_to_email( $args ) {
			if ( ! mkl_pc( 'settings' )->get( 'force_image_in_email' ) ) return $args;
			$args['show_image'] = true;
			$args['image_size'] = array( 100, 100 );
			return $args;
		}

		private function _get_order_item_image( $order_item ) {

			if ( ! is_callable( [ $order_item, 'get_product_id' ] ) ) return false; 
			if ( ! mkl_pc_is_configurable( $order_item->get_product_id() ) ) return false; 

			$configurator_data = $order_item->get_meta( '_configurator_data' );

			if ( ! $configurator_data ) return false;

			$choices = array(); 
			usort( $configurator_data, [ $this, '_order_images' ] );
			foreach ( $configurator_data as $layer ) {
				$choice_images = $layer->get_choice( 'images' );
				if ( $choice_images && isset( $choice_images[0] ) && $choice_images[0]["image"]['id'] ) {
					$choices[] = [ 'image' => $choice_images[0]["image"]['id'] ];
				}
			}

			$configuration = new Configuration( NULL, array( 'product_id' => $order_item['product_id'], 'content' => json_encode( $choices ) ) );
			$size = mkl_pc( 'settings' )->get( 'cart_thumbnail_size', 'woocommerce_thumbnail' );
			$img = $configuration->get_image( $size, [], false );

			if ( $img ) return $img;

			return false;
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
	}
}