<?php
namespace MKL\PC;

if ( ! defined( 'ABSPATH' ) ) return;

class Compat_Yith_Raq {
	public function __construct() {}

	public function should_run() {
		return defined( 'YITH_YWRAQ_VERSION' );
	}

	public function run() {

		add_action( 'yith_raq_updated', [ $this, 'yith_raq_updated' ] );
		add_filter( 'ywraq_request_quote_view_item_data', [ $this, 'view_item_data' ], 20, 3 );
		add_filter( 'ywraq_item_data', [ $this, 'item_data' ], 20, 3 );
		add_filter( 'ywraq_product_image', [ $this, 'item_image' ], 20, 2 );
		add_filter( 'mkl_pc_js_config', [ $this, 'config' ] );
		add_action( 'mkl_pc_frontend_configurator_after_add_to_cart', [ $this, 'add_add_to_quote_button' ], 15 );
		add_action( 'mkl_pc_scripts_product_page_after', [ $this, 'enqueue_scripts' ] );
		// add_filter( 'yith_ywraq_product_subtotal_html', [ $this, 'apply_extra_price' ], 20, 3 );
		add_action( 'ywraq_quote_adjust_price', [ $this, 'apply_extra_price' ], 20, 2 );

		add_filter( 'mkl_pc_get_saved_configuration_content', [ $this, 'load_quote_configuration_in_configurator' ] );
		add_action( 'ywraq_request_quote_email_view_item_after_title', [ $this, 'quote_from_cart_compat' ], 20, 3 );
		add_action( 'ywraq_from_cart_to_order_item', [ $this, 'raq_on_create_order' ], 20, 4 );
	}

	public function config( $config ) {
		$config['ywraq_hide_add_to_cart'] = 'yes' === get_option( 'ywraq_hide_add_to_cart' );
		$config['ywraq_hide_price']       = 'yes' === get_option( 'ywraq_hide_price' );
		return $config;
	}

	public function apply_extra_price( $raq, $product ) {
		if ( isset( $raq['pc_layers'] ) && isset( $raq['pc_extra_price'] ) ) {
			$product->set_price( floatval( $product->get_price() ) + floatval( $raq['pc_extra_price'] ) );
		}
	}

	public function enqueue_scripts() {
		// List of dependencies
		$dependencies = [
			'jquery',
			'wp-util',
			'wp-hooks',
			'mkl_pc/js/views/configurator'
		];
		wp_enqueue_script( 
			'mkl_pc/yith/js', 
			trailingslashit( plugin_dir_url( __FILE__ ) ) . 'assets/js/ytih-raq.js', 
			$dependencies, 
			filemtime( trailingslashit( plugin_dir_path ( __FILE__ ) ) . 'assets/js/ytih-raq.js' ), 
			true
		);
	}

	/**
	 * Main action used to add the configuration to the quote
	 *
	 * @return void
	 */
	public function yith_raq_updated() {
		$is_adding_configured_item = isset( $_POST['action'] ) && 'yith_ywraq_action' === $_POST['action'] && isset( $_POST['ywraq_action'] ) && 'add_item' === $_POST['ywraq_action'] && isset(  $_POST['pc_configurator_data'] );
		if ( ! $is_adding_configured_item ) return;
		static $added = false;
		if ( $added ) return;
		$rq = YITH_Request_Quote();
		$item_id = false;
	
		if ( isset( $_REQUEST['variation_id'] ) ) {
			// single product.
			$item_id = md5( $_REQUEST['product_id'] . $_REQUEST['variation_id'] );
		} else {
			$item_id = md5( $_REQUEST['product_id'] );
		}

		if ( isset( $rq->raq_content[ $item_id ] ) ) {
			$raq = $rq->raq_content[ $item_id ];
			$rq->raq_content[ $item_id ][ 'pc_configurator_data_raw' ] = wp_unslash( $_POST['pc_configurator_data'] );

			$data = json_decode( wp_unslash( $_POST['pc_configurator_data'] ) );
			if ( ! $data ) {
				$rq->raq_content[ $item_id ][ 'pc_configurator_data_raw' ] = urldecode( wp_unslash( $_POST['pc_configurator_data'] ) );
				$data = json_decode( $rq->raq_content[ $item_id ][ 'pc_configurator_data_raw' ] );
			}
			if ( $data ) {
				$data = mkl_pc( 'db' )->sanitize( $data );
				$layers = array();
				$product_id = $raq['product_id'];
				$variation_id = isset( $raq['variation_id'] ) ? $raq['variation_id'] : 0;
				$ep = 0;
				if ( is_array( $data ) ) { 
					foreach( $data as $layer_data ) {
						$choice = new \MKL\PC\Choice( $product_id, $variation_id, $layer_data->layer_id, $layer_data->choice_id, $layer_data->angle_id, $layer_data );
						if ( $item_price = $choice->get_choice( 'extra_price' ) ) {
							$ep += $item_price;
						}
						$layers[] = $choice;
						do_action_ref_array( 'mkl_pc/wc_cart_add_item_data/adding_choice', array( $choice, &$data ) );
					}
				}
				$temp_item_data = [];
				if ( $variation_id ) {
					$_product = wc_get_product( $variation_id );
				} else {
					$_product = wc_get_product( $product_id );
				}
				$temp_item_data['configurator_data'] = $layers;
				$temp_item_data = array_merge(
					$temp_item_data,
					array(
						'key'          => $item_id,
						'context'      => 'configuration_to_yithraq',
						'product_id'   => $product_id,
						'variation_id' => $variation_id,
						'variation'    => false,
						'quantity'     => 1,
						'data'         => $_product,
						'data_hash'    => '',
					)
				);
				$d = apply_filters( 'woocommerce_get_item_data', [], $temp_item_data );
				$rq->raq_content[ $item_id ][ 'pc_configurator_data' ] = $d;
				$rq->raq_content[ $item_id ][ 'pc_layers' ] = $layers;
				$rq->raq_content[ $item_id ][ 'configurator_data' ] = $layers;
				$rq->raq_content[ $item_id ][ 'configurator_data_raw' ] = $data;
				$rq->raq_content[ $item_id ][ 'pc_extra_price' ] = $ep;
				if ( ! isset( $rq->raq_content[ $item_id ][ 'variations' ] ) ) $rq->raq_content[ $item_id ][ 'variations' ] = [];
				foreach( $d as $variation ) {					
					$rq->raq_content[ $item_id ][ 'variations' ][$variation['key']] = $variation['value'];
				}
				$added = true;
				$rq->set_session( $rq->raq_content );
			}
			// $rq->update_item( $item_id, 'pc_configurator_data', $_POST['pc_configurator_data'] );
		}
	}

	public function view_item_data( $item_data, $raq, $_product ) {
		if ( isset( $raq[ 'pc_configurator_data' ] ) ) {	
			$item_data = array_merge( $item_data, $raq[ 'pc_configurator_data' ] );
		}
		return $item_data;
	}

	public function item_data( $item_data, $raq, $show_price ) {
		if ( isset( $raq[ 'pc_configurator_data' ] ) ) {	
			$item_data = array_merge( $item_data, $raq[ 'pc_configurator_data' ] );
		}
		return $item_data;
	}

	/**
	 * Replace the image
	 *
	 * @param string $item_image
	 * @param array $raq
	 * @return string
	 */
	public function item_image( $item_image, $raq ) {
		if ( ! mkl_pc( 'settings' )->get( 'show_image_in_cart' ) ) return $item_image;
		if ( isset( $raq['pc_layers'] ) ) {
			$configurator_data = $raq['pc_layers'];
			$choices = array(); 
			usort( $configurator_data, [ $this, '_order_images' ] );
			foreach ( $configurator_data as $layer ) {
				if ( ! $layer  || ! is_callable( [ $layer, 'get_image_id' ] ) ) continue;
				if ( $choice_image = $layer->get_image_id( 'image' ) ) {
					$choices[] = [ 'image' => $choice_image ];
				}
			}

			$configuration = new Configuration( NULL, array( 'product_id' => $raq['product_id'], 'content' => json_encode( $choices ) ) );
			$size = mkl_pc( 'settings' )->get( 'cart_thumbnail_size', 'woocommerce_thumbnail' );
			$img = $configuration->get_image( $size );

			if ( $img ) return $img;
		}		
		return $item_image;
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
	
	/**
	 * Add the Add to quote button
	 */
	public function add_add_to_quote_button() {
		if ( ! function_exists( 'ywraq_get_label' ) ) return;
		$frontend = mkl_pc( 'frontend' )->product;
		?>
		<button type="button" class="<?php echo $frontend->button_class ?> yith-raq add-to-quote">
			<span><?php echo \ywraq_get_label( 'btn_link_text' ); ?></span>
		</button>
		<?php

	}

	/**
	 * Load the configuration saved in the quote item when going back to the configurator
	 *
	 * @param array $config_data
	 * @return array
	 */
	public function load_quote_configuration_in_configurator( $config_data ) {
		if ( $config_data || ! isset( $_REQUEST['load_config_from_cart'], $_REQUEST['context'] ) || 'configuration_to_yithraq' != $_REQUEST['context'] ) return $config_data;
		$rq = YITH_Request_Quote();
		$item_id = $_REQUEST['load_config_from_cart'];
		if ( isset( $rq->raq_content[ $item_id ][ 'pc_configurator_data_raw' ] ) ) {
			$data = json_decode( $rq->raq_content[ $item_id ][ 'pc_configurator_data_raw' ] );
			if ( $data ) return $data;
		}
		return $config_data;
	}

	/**
	 * Ouput configurator data when receiving a quote from Cart
	 *
	 * @param mixed $item
	 * @param array $raq_data
	 * @param mixed $key
	 * @return void
	 */
	public function quote_from_cart_compat( $item, $raq_data, $key ) {
		if ( ! isset( $raq_data['sent_from_cart'] ) || ! $raq_data['sent_from_cart'] ) return;

		/* Added From cart with Order */ 
		if ( is_a( $item, 'WC_Order_Item_Product' ) ) {
			$key = apply_filters( 'mkl_pc/order_created/saved_data/label', mkl_pc( 'settings' )->get_label( 'configuration_cart_meta_label', __( 'Configuration', 'product-configurator-for-woocommerce' ) ), $item );
			if ( $config = $item->get_meta( $key ) ) {
				echo '<div class="configurator-label"><strong>' . wp_kses_post( $key ) . '</strong></div>';
				echo '<small style="line-height: 1em">';
				echo wp_kses_post( $config );
				echo '</small>';
			}

		/* Added From cart without Order */
		} elseif ( is_array( $item ) && isset( $item[ 'configurator_data' ] ) ) {
			$data = mkl_pc( 'frontend' )->cart->wc_cart_get_item_data( [], $item );
			if ( count( $data ) ) {
				$configuration = $data[0];
				echo '<div class="configurator-label"><strong>' . wp_kses_post( $configuration['key'] ) . '</strong></div>';
				echo '<small style="line-height: 1em">';
				echo wp_kses_post( $configuration['value'] );
				echo '</small>';
			}
		}
	}

	/**
	 * Add the configurator data to the order created by YITH
	 *
	 * @param array     $values
	 * @param string    $cart_item_key
	 * @param int       $item_id
	 * @param \WC_Order $order
	 * @return void
	 */
	public function raq_on_create_order( $values, $cart_item_key, $item_id, \WC_Order $order ) {
		$order_item = $order->get_item( $item_id );
		mkl_pc( 'frontend' )->order->save_data( $order_item, $cart_item_key, $values, $order );
		$order_item->save();
	}

}

return new Compat_Yith_Raq();