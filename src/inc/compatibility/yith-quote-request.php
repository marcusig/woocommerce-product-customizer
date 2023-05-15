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
		add_filter( 'mkl_pc_js_config', [ $this, 'config' ] );
		add_action( 'mkl_pc_frontend_configurator_after_add_to_cart', [ $this, 'add_add_to_quote_button' ], 15 );
	}

	public function config( $config ) {
		if ( get_option( 'ywraq_hide_add_to_cart' ) === 'yes' ) {
			$config['ywraq_hide_add_to_cart'] = true;
		}
		return $config;
	}

	public function yith_raq_updated() {
		$is_adding_configured_item = isset( $_POST['action'] ) && 'yith_ywraq_action' == $_POST['action'] && isset( $_POST['ywraq_action'] ) && 'add_item' == $_POST['ywraq_action'] && isset(  $_POST['pc_configurator_data'] );
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
			$rq->raq_content[ $item_id ][ 'pc_configurator_data_raw' ] = $_POST['pc_configurator_data'];

			$data = json_decode( stripcslashes( $_POST['pc_configurator_data'] ) );
			if ( ! $data ) {
				$rq->raq_content[ $item_id ][ 'pc_configurator_data_raw' ] = urldecode( $_POST['pc_configurator_data'] );
				$data = json_decode( stripcslashes( urldecode( $_POST['pc_configurator_data'] ) ) );
			}
			if ( $data ) {
				$data = mkl_pc( 'db' )->sanitize( $data );
				$layers = array();
				$product_id = $raq['product_id'];
				$variation_id = isset( $raq['variation_id'] ) ? $raq['variation_id'] : 0;
				if ( is_array( $data ) ) { 
					foreach( $data as $layer_data ) {
						$choice = new \MKL\PC\Choice( $product_id, $variation_id, $layer_data->layer_id, $layer_data->choice_id, $layer_data->angle_id, $layer_data );
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
						'key'          => 'configuration_to_yithraq',
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
				if ( ! isset( $rq->raq_content[ $item_id ][ 'variations' ] ) ) $rq->raq_content[ $item_id ][ 'variations' ] = [];
				$rq->raq_content[ $item_id ][ 'variations' ] = array_merge( $rq->raq_content[ $item_id ][ 'variations' ], $d );
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
}

return new Compat_Yith_Raq();