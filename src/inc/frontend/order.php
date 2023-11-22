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
			add_filter( 'woocommerce_order_item_get_formatted_meta_data', array( $this, 'maybe_override_formatted_meta_data' ), 30, 2 );
			add_filter( 'woocommerce_admin_order_item_thumbnail', array( $this, 'order_admin_item_thumbnail' ), 30, 3 );
			add_filter( 'woocommerce_order_item_thumbnail', array( $this, 'order_item_thumbnail' ), 30, 2 );
			add_filter( 'woocommerce_email_order_items_args', array( $this, 'add_image_to_email' ) );
			add_filter( 'woocommerce_email_styles', array( $this, 'add_email_styles' ), 100 );
			// My account
			add_action( 'woocommerce_order_item_meta_end', array( $this, 'add_view_link' ), 20, 3 );
			add_action( 'woocommerce_order_item_meta_end', array( $this, 'add_image_download_link' ), 20, 3 );
		}

		/**
		 * Add styles to the email CSS
		 *
		 * @param string $styles
		 * @return string
		 */
		public function add_email_styles( $styles ) {
			$styles .= 'span.choice-thumb img {
				max-width: 30px;
			}
			table span.choice-thumb.color {
				display: inline-block;
				width: 20px;
				height: 20px;
				vertical-align: middle;
				margin-right: 4px;
				border-radius: 3px;
			}
			';
			return $styles;
		}

		public function add_view_link( $item_id, $item, $order ) {
			$config = wc_get_order_item_meta( $item_id, '_configurator_data_raw', true );
			if ( ! $config ) return;
			$view_link = add_query_arg( array( 'load_config_from_order' => $item_id, 'open_configurator'=> 1 ), get_permalink( $item->get_product_id() ) );
			echo '<div class="configuration-link"><a href="' . esc_url( $view_link ) . '" target="_blank">' . mkl_pc( 'settings' )->get_label( 'view_configuration', __( 'View configuration', 'product-configurator-for-woocommerce' ) ) . '</a></div>';
		}

		public function add_image_download_link( $item_id, $item, $order ) {
			if ( ! mkl_pc( 'settings' )->get( 'show_image_in_cart' ) || apply_filters( 'mkl_pc/do_not_show_image_download_link', false ) ) return;
			
			/**
			 * mkl_pc/customer_can_see_image_download_link - Filters whether the image download link should be added
			 * 
			 * @param bool           $display_link
			 * @param int            $item_id - the order item ID
			 * @param WC_Order_Item  $item    - the order item
			 * @param WC_Order       $order   - the order
			 * @return bool
			 */
			if ( apply_filters( 'mkl_pc/customer_can_see_image_download_link', 'completed' != $order->get_status(), $item_id, $item, $order ) ) return;

			$config_image = $this->get_order_item_image( $item, 'url', 'full' );
			if ( $config_image && 'blank.gif' !== substr( $config_image, -9 ) ) {
				echo '<div class="configuration-image-link"><a href="' . esc_url( $config_image ) . '" target="_blank">' . mkl_pc( 'settings' )->get_label( 'download_config_image', __( 'Download configuration image', 'product-configurator-for-woocommerce' ) ) . '</a></div>';
			}
		}

		public function save_data( $item, $cart_item_key, $values, $order ) {
			if ( isset( $values['configurator_data'] ) ) {
				$configurator_data = $values['configurator_data'];
				// For now, stores the whole _configurator_data object
				$item->add_meta_data( '_configurator_data', $configurator_data, false );
				$item->add_meta_data( '_configurator_data_raw', $values['configurator_data_raw'], false );
				$item->add_meta_data( 
					apply_filters( 'mkl_pc/order_created/saved_data/label', mkl_pc( 'settings' )->get_label( 'configuration_cart_meta_label', __( 'Configuration', 'product-configurator-for-woocommerce' ) ), $item ),
					$this->get_formatted_configurator_data( $configurator_data, $item ), 
					false
				);
				if ( $sku = $this->get_sku( $configurator_data ) ) {
					$item->add_meta_data(
						mkl_pc( 'settings')->get_label( 'sku_label', __( 'SKU', 'product-configurator-for-woocommerce' ) ),
						$sku
					);

				}
				do_action( 'mkl_pc/order_created/after_saved_data', $item, $order, $configurator_data );
			}
		}

		public function get_sku( $configurator_data ) {
			$compound_sku = 'compound' == mkl_pc( 'settings')->get( 'sku_mode' ) && wc_product_sku_enabled();
			$sku = [];
			if ( ! $compound_sku ) return '';

			// stores each couple layer name + choice as a order_item_meta, for automatic extraction
			foreach ( $configurator_data as $layer ) {
				if ( ! is_object($layer) ) continue;
				if ( $layer->get_layer( 'hide_in_cart' ) || $layer->get_choice( 'hide_in_cart' ) ) continue;
				if ( $layer->is_choice() ) {
					if ( $layer->get_choice( 'sku' ) ) {
						$sku[] = $layer->get_choice( 'sku' );
					}
				}
			}

			if ( count( $sku ) ) {
				return implode( mkl_pc( 'settings')->get_label( 'sku_glue', '' ), $sku );
			}

			return '';
		}
		
		// public function formatted_meta_contains_config( $formatted_meta ) {
		// 	if ( empty( $formatted_meta ) ) return false;
		// 	foreach( $formatted_meta as $meta ) {
		// 		if ( strpos( $meta->value, 'order-configuration-details' ) ) {
		// 			return true;
		// 		}
		// 	}
		// 	return false;
		// }

		/**
		 * Get the formated configurator data
		 *
		 * @param array         $formatted_meta
		 * @return array
		 */
		public function get_formatted_configurator_data( $configurator_data, $order_item ) {
			
			global $mkl_pc_get_current_item;
			if ( ! $mkl_pc_get_current_item ) {
				$mkl_pc_get_current_item = 1;
			} else {
				$mkl_pc_get_current_item++;
			}
			static $items_count;
			if ( ! $items_count ) {
				$items_count = 1;
			} else {
				$items_count += 1;
			}

			if ( is_array( $configurator_data ) ) {
				$order_meta_for_configuration = $this->get_configuration_choices_for_display( $configurator_data, $order_item );
				if ( ! empty( $order_meta_for_configuration ) ) {
					return $this->get_choices_html( $order_meta_for_configuration );
				}
			}
			return '';
		}

		/**
		 * Get the formated choices
		 * stores each couple layer name + choice as a order_item_meta, for automatic extraction
		 *
		 * @param array         $configurator_data
		 * @param WC_Order_Item $order_item
		 * @return array
		 */
		public function get_configuration_choices_for_display( $configurator_data, $order_item ) {
			static $items_count;
			if ( ! $items_count ) {
				$items_count = 1;
			} else {
				$items_count += 1;
			}
			$order_meta_for_configuration = [];
			// stores each couple layer name + choice as a order_item_meta, for automatic extraction
			foreach ( $configurator_data as $layer ) {
				if ( is_object($layer) ) {
					if ( $layer->get_layer( 'hide_in_cart' ) || $layer->get_choice( 'hide_in_cart' ) ) continue;
					if ( $layer->is_choice() ) {
						$item_data = Product::set_layer_item_meta( $layer, $order_item->get_product(), $order_item->get_id(), 'order' );
						$order_meta_for_configuration[]	= apply_filters( 'mkl_pc/order_created/save_layer_meta', $item_data, $layer, $order_item, [], $items_count );
						do_action( 'mkl_pc/order_created/after_save_layer_meta', $layer, $order_item, $order_item->get_order() );
					}
				} 
			}
			return $order_meta_for_configuration;
		}

		/**
		 * Maybe override the formated data
		 *
		 * @param array         $formatted_meta
		 * @param \WC_Order_Item $order_item
		 * @return array
		 */
		public function maybe_override_formatted_meta_data( $formatted_meta, $order_item ) {
			foreach( $formatted_meta as $k => $meta ) {
				if ( ! strpos( $meta->value, 'order-configuration-details' ) ) continue;
				global $mkl_pc_get_current_item;
				if ( ! $mkl_pc_get_current_item ) {
					$mkl_pc_get_current_item = 1;
				} else {
					$mkl_pc_get_current_item++;
				}
				$configurator_meta = $order_item->get_meta( '_configurator_data', false );
				if ( empty( $configurator_meta ) ) return $formatted_meta;
				static $items_count;
				if ( ! $items_count ) {
					$items_count = 1;
				} else {
					$items_count += 1;
				}
			
				foreach( $configurator_meta as $meta ) {
					
					$configurator_data = $meta->value;

					if ( is_array( $configurator_data ) ) {

						$order_meta_for_configuration = $this->get_configuration_choices_for_display( $configurator_data, $order_item );

						if ( ! empty( $order_meta_for_configuration ) ) {
							$display_key = apply_filters( 'mkl_pc/order_created/get_data/label', mkl_pc( 'settings' )->get_label( 'configuration_cart_meta_label', __( 'Configuration', 'product-configurator-for-woocommerce' ) ), $order_item, $configurator_data );
							$display_key = apply_filters_deprecated( 'mkl_pc/order_created/saved_data/label', array( $display_key, $order_item, '', [], $order_item->get_order() ), '1.2.35', 'mkl_pc/order_created/get_data/label' );

							$formatted_meta[ $k ]->display_key = apply_filters( 'woocommerce_order_item_display_meta_key', $display_key, $meta, $order_item );
							$formatted_meta[ $k ]->display_value = wpautop( make_clickable( apply_filters( 'woocommerce_order_item_display_meta_value', $this->get_choices_html( $order_meta_for_configuration ), $meta, $order_item ) ) );
						}
					}
				}
			}
			return $formatted_meta;
		}

		public function set_order_item_meta( $layer, $product ) {
			$value = $layer->get_choice( 'name' );
			
			if ( $layer->get_choice( 'show_group_label_in_cart' ) ) {
				$parent_id = $layer->get_choice( 'parent' );
				if ( $parent_id && is_callable( [ $layer, 'get_choice_by_id' ] ) ) {
					$parent = $layer->get_choice_by_id( $parent_id );
					if ( $parent && isset( $parent[ 'name' ] ) ) {
						$value = '<span class="pc-group-name">' . $parent[ 'name' ] . '</span> ' . $value;
					}
				}		
			}
			$meta = array(
				'label' => $layer->get_layer('name'),
				'value' => $value,
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
			
			if ( $config_image = $this->get_order_item_image( $order_item ) ) {				
				if ( $full_size_link = $this->get_order_item_image( $order_item, 'url', 'full' ) ) {
					$config_image = '<a class="configurator-full-size-image" href="' . $full_size_link .'" target="_blank">' . $config_image . '</a>'; 
				}
				return $config_image;
			}

			return $image;
		}

		public function get_choices_html( $choices ) {
			$output = '';
			foreach ( $choices as $choice ) {
				if ( empty( $choice ) ) continue;

				$classes = [];
				if ( isset( $choice['layer'] ) && is_callable( [ $choice['layer'], 'get_layer' ] ) ) {
					$classes[] = $choice['layer']->get_layer( 'type' );
					$classes[] = $choice['layer']->get_layer( 'class_name' );
					$classes[] = $choice['layer']->get_choice( 'class_name' );
					$classes[] = $choice['layer']->get_layer( 'html_id' );
				}
				$classes = Utils::sanitize_html_classes( array_filter( apply_filters( 'mkl_pc_cart_item_choice__classes', $classes, $choice['layer'] ) ) );
				$before = apply_filters( 'mkl_pc_cart_item_choice_before', '<div' . ( $classes ? ' class="' . $classes . '"' : '' ) . '>', $choice );
				$after = apply_filters( 'mkl_pc_cart_item_choice_after', '</div>' );
				$output .= apply_filters( 'mkl_pc_cart_item_choice', $before . '<strong>' . $choice['label'] .'</strong>' . ( $choice['label'] ? '<span class="semicol">:</span> ' : '' ) . $choice['value'] . $after, $choice['label'], $choice['value'], $before, $after );
			}

			return '<div class="order-configuration">' . $output . '</div>';
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
			
			if ( $config_image = $this->get_order_item_image( $order_item ) ) return $config_image;

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

		public function get_order_item_image( $order_item, $return = 'html', $size = false ) {

			if ( ! is_callable( [ $order_item, 'get_product_id' ] ) ) return false; 
			if ( ! mkl_pc_is_configurable( $order_item->get_product_id() ) ) return false; 

			$configurator_data = $order_item->get_meta( '_configurator_data' );

			if ( ! $configurator_data ) return false;

			$choices = array(); 
			usort( $configurator_data, [ $this, '_order_images' ] );
			foreach ( $configurator_data as $layer ) {
				if ( ! $layer ) continue;
				if ( $choice_image = $layer->get_image_id( 'image' ) ) {
					$choices[] = [ 'image' => $choice_image ];
				}
			}

			$configuration = new Configuration( NULL, array( 'product_id' => $order_item['product_id'], 'content' => json_encode( $choices ) ) );
			if ( ! $size ) $size = mkl_pc( 'settings' )->get( 'cart_thumbnail_size', 'woocommerce_thumbnail' );
			$size = apply_filters( 'mkl_pc/order_image_size', $size, $order_item, $configurator_data );
			
			if ( 'url' == $return ) {
				return $configuration->get_image_url( false, $size );
			}

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