<?php
namespace MKL\PC;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * The quote request in the configurator: its button, its form, and the per-product setting
 *
 * The button and the form are wp.templates printed with the configurator's own, and placed by
 * assets/js/quote-request.js. Where the button goes depends on the product, so it is decided in the
 * browser from product_info.quote_request:
 * - 'default':    follows the Placement setting (next to Add to cart, or instead of it);
 * - 'quote_only': instead of Add to cart, and the price is hidden;
 * - 'off':        no quote request for this product.
 */
class Quote_UI {

	const PRODUCT_META = MKL_PC_PREFIX . '_quote_request';

	public function __construct() {
		add_filter( 'mkl_product_configurator_get_front_end_data', [ $this, 'add_product_info' ], 20, 2 );
		add_filter( 'mkl_pc/quote_request/can_quote', [ $this, 'can_quote' ], 10, 2 );
		add_filter( 'woocommerce_add_to_cart_validation', [ $this, 'refuse_quote_only_in_cart' ], 20, 2 );
		add_action( 'mkl_pc_frontend_templates_after', [ $this, 'print_templates' ] );
		add_action( 'mkl_pc_admin_general_tab', [ $this, 'product_setting' ] );
		add_action( 'woocommerce_process_product_meta', [ $this, 'save_product_setting' ] );
	}

	/**
	 * A product's quote request mode
	 *
	 * @param int $product_id Product or variation.
	 * @return string default, quote_only or off
	 */
	public static function get_product_mode( $product_id ) {
		$product_id = (int) $product_id;
		if ( 'product_variation' === get_post_type( $product_id ) ) {
			$product_id = (int) wp_get_post_parent_id( $product_id );
		}
		$mode = get_post_meta( $product_id, self::PRODUCT_META, true );
		/**
		 * Filter a product's quote request mode
		 *
		 * @param string $mode       default, quote_only or off
		 * @param int    $product_id
		 */
		$mode = apply_filters( 'mkl_pc/quote_request/product_mode', $mode ? $mode : 'default', $product_id );
		return in_array( $mode, [ 'default', 'quote_only', 'off' ], true ) ? $mode : 'default';
	}

	/**
	 * Tell the configurator the product's mode
	 *
	 * Saved in the configurator's cached data, which is rebuilt when the product is saved. The
	 * site-wide settings are not cached with it: they come with the quote request script.
	 *
	 * @param array       $data
	 * @param \WC_Product $product
	 * @return array
	 */
	public function add_product_info( $data, $product ) {
		if ( isset( $data['product_info'] ) && $product ) {
			$data['product_info']['quote_request'] = self::get_product_mode( $product->get_id() );
		}
		return $data;
	}

	/**
	 * @param boolean $can_quote
	 * @param int     $product_id
	 * @return boolean
	 */
	public function can_quote( $can_quote, $product_id ) {
		return $can_quote && 'off' !== self::get_product_mode( $product_id );
	}

	/**
	 * A quote-only product cannot be bought with the configurator's form either
	 *
	 * @param boolean $passed
	 * @param int     $product_id
	 * @return boolean
	 */
	public function refuse_quote_only_in_cart( $passed, $product_id ) {
		if ( ! $passed || ! mkl_pc( 'quotes' )->is_enabled() || 'quote_only' !== self::get_product_mode( $product_id ) ) return $passed;
		wc_add_notice( __( 'This product is available on request only. Please request a quote.', 'product-configurator-for-woocommerce' ), 'error' );
		return false;
	}

	/**
	 * Button, form and messages
	 *
	 * @return void
	 */
	public function print_templates() {
		if ( ! mkl_pc( 'quotes' )->is_enabled() ) return;
		include __DIR__ . '/views/configurator-templates.php';
	}

	/**
	 * Setting in the product's Configurator tab
	 *
	 * @return void
	 */
	public function product_setting() {
		global $post;
		if ( ! $post ) return;
		$enabled = mkl_pc( 'quotes' )->is_enabled();
		echo '<div class="show_if_simple show_if_variable">';
		woocommerce_wp_select( [
			'id'          => self::PRODUCT_META,
			'value'       => self::get_product_mode( $post->ID ),
			'label'       => __( 'Quote requests', 'product-configurator-for-woocommerce' ),
			'options'     => [
				'default'    => __( 'Follow the configurator settings', 'product-configurator-for-woocommerce' ),
				'quote_only' => __( 'Quote only: no price, no Add to cart', 'product-configurator-for-woocommerce' ),
				'off'        => __( 'No quote requests for this product', 'product-configurator-for-woocommerce' ),
			],
			'desc_tip'    => true,
			'description' => $enabled
				? __( 'Whether customers can request a quote for what they configure.', 'product-configurator-for-woocommerce' )
				: __( 'Quote requests are turned off in the configurator settings, so this has no effect for now.', 'product-configurator-for-woocommerce' ),
		] );
		echo '</div>';
	}

	/**
	 * @param int $post_id
	 * @return void
	 */
	public function save_product_setting( $post_id ) {
		// phpcs:ignore WordPress.Security.NonceVerification.Missing -- WooCommerce verifies the product save nonce before woocommerce_process_product_meta.
		if ( ! isset( $_POST[ self::PRODUCT_META ] ) ) return;
		$mode = sanitize_key( wp_unslash( $_POST[ self::PRODUCT_META ] ) ); // phpcs:ignore WordPress.Security.NonceVerification.Missing
		if ( ! in_array( $mode, [ 'default', 'quote_only', 'off' ], true ) ) return;
		if ( 'default' === $mode ) {
			delete_post_meta( $post_id, self::PRODUCT_META );
		} else {
			update_post_meta( $post_id, self::PRODUCT_META, $mode );
		}
	}
}
