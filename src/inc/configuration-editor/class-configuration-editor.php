<?php
namespace MKL\PC;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Configure order lines from the admin
 *
 * The configurator runs in a frame (Configurator_Frame) opened from the order screen, preloaded with the
 * line's configuration. Its Add to cart is replaced by Save, which posts the configuration to the REST
 * route here; Order_Item_Configuration writes it to the line. Works on any order WooCommerce lets the
 * admin edit: quote orders, orders made by quote plugins, orders created in the admin.
 *
 * A target names what is configured: `order:{id}:item:{item_id}` edits a line, `order:{id}:product:{product_id}`
 * adds one. Frame URLs carry a nonce for their target, for the user who opened them.
 */
class Configuration_Editor {

	const QUERY_VAR = 'mkl_pc_edit';

	const NONCE_VAR = 'mkl_pc_edit_nonce';

	/**
	 * @var array|null|false The target of the current frame request, once read.
	 */
	private $frame_target = null;

	public function __construct() {
		add_filter( 'mkl_pc/frame/is_frame_request', [ $this, 'is_editor_request' ], 10, 2 );
		add_action( 'mkl_pc/frame/setup', [ $this, 'setup_frame' ] );
		add_action( 'rest_api_init', [ $this, 'register_routes' ] );
		add_action( 'woocommerce_after_order_itemmeta', [ $this, 'edit_item_button' ], 10, 3 );
		add_action( 'woocommerce_order_item_add_action_buttons', [ $this, 'add_item_button' ] );
		add_action( 'admin_enqueue_scripts', [ $this, 'enqueue_order_screen' ] );
		add_action( 'wp_ajax_mkl_pc_configuration_editor_url', [ $this, 'ajax_editor_url' ] );
		add_action( 'wp_ajax_mkl_pc_search_configurable_products', [ $this, 'ajax_search_products' ] );
	}

	/**
	 * Read a target string
	 *
	 * @param string $target
	 * @return array|false order_id, and item_id or product_id.
	 */
	public function parse_target( $target ) {
		if ( ! is_string( $target ) || ! preg_match( '/^order:(\d+):(item|product):(\d+)$/', $target, $match ) ) return false;
		return [
			'order_id'   => (int) $match[1],
			'item_id'    => 'item' === $match[2] ? (int) $match[3] : 0,
			'product_id' => 'product' === $match[2] ? (int) $match[3] : 0,
		];
	}

	/**
	 * What a target points at, if the current user may configure it
	 *
	 * @param string $target
	 * @return array|\WP_Error order, item (null for a new line), product.
	 */
	public function resolve_target( $target ) {
		$parsed = $this->parse_target( $target );
		$not_found = new \WP_Error( 'mkl_pc_editor_target', __( 'This order line cannot be configured.', 'product-configurator-for-woocommerce' ), [ 'status' => 404 ] );
		if ( ! $parsed || ! function_exists( 'wc_get_order' ) ) return $not_found;

		$order = wc_get_order( $parsed['order_id'] );
		if ( ! $order || ! $this->user_can_edit( $order ) ) {
			return new \WP_Error( 'mkl_pc_editor_forbidden', __( 'This order cannot be edited.', 'product-configurator-for-woocommerce' ), [ 'status' => rest_authorization_required_code() ] );
		}

		$item = null;
		if ( $parsed['item_id'] ) {
			$item = $order->get_item( $parsed['item_id'] );
			if ( ! $item instanceof \WC_Order_Item_Product ) return $not_found;
			$product = $item->get_product();
		} else {
			$product = wc_get_product( $parsed['product_id'] );
		}
		if ( ! $product || ! mkl_pc_is_configurable( $product->get_parent_id() ? $product->get_parent_id() : $product->get_id() ) ) return $not_found;

		return [
			'order'   => $order,
			'item'    => $item,
			'product' => $product,
		];
	}

	/**
	 * Whether the current user may configure the lines of an order
	 *
	 * @param \WC_Order $order
	 * @return boolean
	 */
	public function user_can_edit( $order ) {
		if ( ! current_user_can( 'edit_shop_orders' ) ) return false;
		/**
		 * Whether an order's lines can be configured from the admin. Default: when WooCommerce lets its items be edited.
		 *
		 * @param boolean   $editable
		 * @param \WC_Order $order
		 */
		return (bool) apply_filters( 'mkl_pc/configuration_editor/order_is_editable', $order->is_editable(), $order );
	}

	/**
	 * Link to the configurator for a target, for the current user
	 *
	 * @param string      $target
	 * @param \WC_Product $product
	 * @return string
	 */
	public function get_editor_url( $target, $product ) {
		return add_query_arg( [
			self::QUERY_VAR => rawurlencode( $target ),
			self::NONCE_VAR => wp_create_nonce( 'mkl_pc_edit_' . $target ),
		], $product->get_permalink() );
	}

	/**
	 * The target of the current frame request, checked
	 *
	 * @return array|false
	 */
	public function get_frame_target() {
		if ( null !== $this->frame_target ) return $this->frame_target;
		$this->frame_target = false;
		// phpcs:disable WordPress.Security.NonceVerification.Recommended -- Verified just below.
		if ( empty( $_GET[ self::QUERY_VAR ] ) || empty( $_GET[ self::NONCE_VAR ] ) ) return false;
		$target = sanitize_text_field( wp_unslash( $_GET[ self::QUERY_VAR ] ) );
		$nonce  = sanitize_text_field( wp_unslash( $_GET[ self::NONCE_VAR ] ) );
		// phpcs:enable
		if ( ! wp_verify_nonce( $nonce, 'mkl_pc_edit_' . $target ) ) return false;
		$resolved = $this->resolve_target( $target );
		if ( is_wp_error( $resolved ) ) return false;
		$resolved['target'] = $target;
		return $this->frame_target = $resolved;
	}

	/**
	 * @param boolean $is_frame
	 * @param int     $product_id The page's product.
	 * @return boolean
	 */
	public function is_editor_request( $is_frame, $product_id ) {
		$target = $this->get_frame_target();
		if ( ! $target ) return $is_frame;
		$product = $target['product'];
		return ( $product->get_parent_id() ? $product->get_parent_id() : $product->get_id() ) === (int) $product_id ? true : $is_frame;
	}

	/**
	 * In the frame: the line's configuration, and Save instead of Add to cart
	 *
	 * @return void
	 */
	public function setup_frame() {
		$target = $this->get_frame_target();
		if ( ! $target ) return;

		add_filter( 'mkl_pc_get_saved_configuration_content', [ $this, 'get_item_configuration' ], 20 );
		add_filter( 'body_class', function( $classes ) {
			$classes[] = 'mkl-pc-configuration-editor';
			return $classes;
		} );
		add_action( 'wp_enqueue_scripts', [ $this, 'enqueue_frame' ], 110 );
	}

	/**
	 * @return string
	 */
	private function get_frame_css() {
		return '
.mkl-pc-configuration-editor .mkl-pc-editor-actions { display: contents; }
.mkl-pc-configuration-editor .mkl-pc-editor-cancel { background: transparent !important; color: inherit !important; box-shadow: inset 0 0 0 1px currentColor !important; }
.mkl-pc-configuration-editor .mkl-pc-editor-save[disabled] { opacity: .6; cursor: progress; }
.mkl-pc-configuration-editor .mkl-pc-editor-error:not(:empty) { flex-basis: 100%; margin-top: 8px; color: #b32d2e; text-align: right; }';
	}

	/**
	 * @param array $configuration
	 * @return array
	 */
	public function get_item_configuration( $configuration ) {
		$target = $this->get_frame_target();
		if ( ! $target || ! $target['item'] ) return $configuration;
		$saved = $target['item']->get_meta( '_configurator_data_raw' );
		return $saved ? $saved : $configuration;
	}

	public function enqueue_frame() {
		if ( ! wp_script_is( 'mkl_pc/js/product_configurator', 'enqueued' ) ) return;
		$target = $this->get_frame_target();
		$file = 'js/configuration-editor' . ( defined( 'SCRIPT_DEBUG' ) && SCRIPT_DEBUG ? '' : '.min' ) . '.js';
		wp_enqueue_script( 'mkl_pc/js/configuration_editor', MKL_PC_ASSETS_URL . $file, [ 'jquery', 'wp-hooks', 'mkl_pc/js/product_configurator' ], filemtime( MKL_PC_ASSETS_PATH . $file ), true );
		$product = $target['product'];
		wp_register_style( 'mkl_pc/css/configuration_editor', false, [], MKL_PC_VERSION );
		wp_enqueue_style( 'mkl_pc/css/configuration_editor' );
		wp_add_inline_style( 'mkl_pc/css/configuration_editor', $this->get_frame_css() );
		wp_localize_script( 'mkl_pc/js/configuration_editor', 'PC_configuration_editor', [
			'target'        => $target['target'],
			'is_new'        => ! $target['item'],
			'quantity'      => $target['item'] ? $target['item']->get_quantity() : 1,
			'save_url'      => esc_url_raw( rest_url( 'mkl_pc/v1/configuration-editor/order-items' ) ),
			'nonce'         => wp_create_nonce( 'wp_rest' ),
			'capture_image' => '3d' === mkl_pc_get_configurator_type( $product->get_parent_id() ? $product->get_parent_id() : $product->get_id() ),
			'button_class'  => mkl_pc( 'frontend' ) && mkl_pc( 'frontend' )->product ? mkl_pc( 'frontend' )->product->button_class : 'button',
			'lang'          => [
				'save'   => $target['item'] ? __( 'Save the configuration', 'product-configurator-for-woocommerce' ) : __( 'Add to the order', 'product-configurator-for-woocommerce' ),
				'cancel' => __( 'Cancel', 'product-configurator-for-woocommerce' ),
				'saving' => __( 'Saving…', 'product-configurator-for-woocommerce' ),
				'failed' => __( 'The configuration could not be saved.', 'product-configurator-for-woocommerce' ),
			],
		] );
	}

	public function register_routes() {
		register_rest_route( 'mkl_pc/v1', '/configuration-editor/order-items', [
			'methods'             => \WP_REST_Server::CREATABLE,
			'callback'            => [ $this, 'rest_save' ],
			'permission_callback' => function( $request ) {
				$resolved = $this->resolve_target( (string) $request->get_param( 'target' ) );
				return is_wp_error( $resolved ) ? $resolved : true;
			},
			'args'                => [
				'target'        => [ 'type' => 'string', 'required' => true ],
				'configuration' => [ 'required' => true ],
				'quantity'      => [ 'type' => 'number', 'default' => 1 ],
				'image'         => [ 'type' => 'string', 'default' => '' ],
			],
		] );
	}

	/**
	 * @param \WP_REST_Request $request
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function rest_save( $request ) {
		$resolved = $this->resolve_target( (string) $request->get_param( 'target' ) );
		if ( is_wp_error( $resolved ) ) return $resolved;

		// REST requests have no cart. Add-ons format the choices' prices from it (with or without tax), as at checkout.
		if ( function_exists( 'wc_load_cart' ) && ! WC()->cart ) {
			wc_load_cart();
		}

		$writer = new Order_Item_Configuration();
		$item = $writer->save( $resolved['order'], $resolved['item'] ? $resolved['item'] : $resolved['product'], $request->get_param( 'configuration' ), [
			'quantity' => $request->get_param( 'quantity' ),
			'image'    => $request->get_param( 'image' ),
		] );
		if ( is_wp_error( $item ) ) return $item;

		return rest_ensure_response( [
			'item_id' => $item->get_id(),
			'total'   => (float) $item->get_total(),
		] );
	}

	/**
	 * Order screen: "Configure" on each line of a configurable product
	 *
	 * @param int                    $item_id
	 * @param \WC_Order_Item         $item
	 * @param \WC_Product|null|false $product
	 * @return void
	 */
	public function edit_item_button( $item_id, $item, $product ) {
		if ( ! $item instanceof \WC_Order_Item_Product || ! $product ) return;
		$target = 'order:' . $item->get_order_id() . ':item:' . $item_id;
		$resolved = $this->resolve_target( $target );
		if ( is_wp_error( $resolved ) ) return;
		$label = $item->get_meta( '_configurator_data_raw' ) ? __( 'Edit the configuration', 'product-configurator-for-woocommerce' ) : __( 'Configure', 'product-configurator-for-woocommerce' );
		printf(
			'<p class="mkl-pc-configure-item"><button type="button" class="button button-small mkl-pc-open-configuration-editor" data-url="%s" data-title="%s">%s</button></p>',
			esc_url( $this->get_editor_url( $target, $product ) ),
			esc_attr( $product->get_name() ),
			esc_html( $label )
		);
	}

	/**
	 * Order screen: "Add a configured product", next to WooCommerce's "Add product(s)"
	 *
	 * @param \WC_Order $order
	 * @return void
	 */
	public function add_item_button( $order ) {
		if ( ! $this->user_can_edit( $order ) ) return;
		printf(
			'<button type="button" class="button mkl-pc-add-configured-product" data-order="%d">%s</button>',
			(int) $order->get_id(),
			esc_html__( 'Add a configured product', 'product-configurator-for-woocommerce' )
		);
	}

	/**
	 * @param string $hook
	 * @return void
	 */
	public function enqueue_order_screen( $hook ) {
		$screen = get_current_screen();
		if ( ! $screen || ! in_array( $screen->id, [ 'shop_order', 'woocommerce_page_wc-orders' ], true ) ) return;
		if ( ! current_user_can( 'edit_shop_orders' ) ) return;
		$file = 'admin/js/order-configuration-editor.js';
		wp_enqueue_script( 'mkl_pc/admin/js/order_configuration_editor', MKL_PC_ASSETS_URL . $file, [ 'jquery', 'wc-admin-order-meta-boxes' ], filemtime( MKL_PC_ASSETS_PATH . $file ), true );
		wp_localize_script( 'mkl_pc/admin/js/order_configuration_editor', 'PC_order_configuration_editor', [
			'ajax_url' => admin_url( 'admin-ajax.php' ),
			'nonce'    => wp_create_nonce( 'mkl_pc_configuration_editor' ),
			'lang'     => [
				'choose_product' => __( 'Add a configured product', 'product-configurator-for-woocommerce' ),
				'search'         => __( 'Search for a configurable product…', 'product-configurator-for-woocommerce' ),
				'searching'      => __( 'Searching…', 'product-configurator-for-woocommerce' ),
				'no_results'     => __( 'No configurable product found.', 'product-configurator-for-woocommerce' ),
				'close'          => __( 'Close', 'product-configurator-for-woocommerce' ),
				'unsaved'        => __( 'Close without saving the configuration?', 'product-configurator-for-woocommerce' ),
			],
		] );
		wp_register_style( 'mkl_pc/admin/css/order_configuration_editor', false, [], MKL_PC_VERSION );
		wp_enqueue_style( 'mkl_pc/admin/css/order_configuration_editor' );
		wp_add_inline_style( 'mkl_pc/admin/css/order_configuration_editor', $this->get_order_screen_css() );
	}

	/**
	 * @return string
	 */
	private function get_order_screen_css() {
		return '
.mkl-pc-configure-item { margin: 6px 0 0; }
.mkl-pc-editor-dialog { width: calc(100vw - 48px); max-width: 1400px; height: calc(100vh - 48px); padding: 0; border: 0; border-radius: 8px; box-shadow: 0 24px 64px rgba(0,0,0,.3); overflow: hidden; }
.mkl-pc-editor-dialog.is-picker { height: fit-content; max-width: 520px; }
.mkl-pc-editor-dialog::backdrop { background: rgba(0,0,0,.55); }
.mkl-pc-editor-dialog__inner { display: flex; flex-direction: column; height: 100%; }
.mkl-pc-editor-dialog__head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 16px; border-bottom: 1px solid #dcdcde; }
.mkl-pc-editor-dialog__head h2 { margin: 0; font-size: 16px; }
.mkl-pc-editor-dialog__body { flex: 1 1 auto; min-height: 0; position: relative; }
.mkl-pc-editor-dialog.is-picker .mkl-pc-editor-dialog__body { padding: 16px; }
.mkl-pc-editor-dialog__body iframe { display: block; width: 100%; height: 100%; border: 0; }
.mkl-pc-editor-dialog__results { margin: 8px 0 0; max-height: 50vh; overflow-y: auto; }
.mkl-pc-editor-dialog__results li { margin: 0; border-bottom: 1px solid #f0f0f1; }
.mkl-pc-editor-dialog__results button.button-link { display: block; width: 100%; padding: 8px 4px; text-align: left; text-decoration: none; }
.mkl-pc-editor-dialog__results button.button-link:hover { background: #f6f7f7; }
.mkl-pc-editor-dialog__status:empty { display: none; }
.mkl-pc-editor-dialog__status { margin: 8px 0 0; color: #646970; }
@media (max-width: 782px) { .mkl-pc-editor-dialog { width: 100vw; height: 100vh; max-width: none; max-height: none; border-radius: 0; } }';
	}

	/**
	 * The frame URL for a new line of a product
	 *
	 * @return void
	 */
	public function ajax_editor_url() {
		check_ajax_referer( 'mkl_pc_configuration_editor', 'security' );
		$target = sprintf( 'order:%d:product:%d', isset( $_POST['order_id'] ) ? absint( $_POST['order_id'] ) : 0, isset( $_POST['product_id'] ) ? absint( $_POST['product_id'] ) : 0 );
		$resolved = $this->resolve_target( $target );
		if ( is_wp_error( $resolved ) ) wp_send_json_error( [ 'message' => $resolved->get_error_message() ] );
		wp_send_json_success( [
			'url'   => $this->get_editor_url( $target, $resolved['product'] ),
			'title' => $resolved['product']->get_name(),
		] );
	}

	/**
	 * Configurable products matching a search, for the product picker
	 *
	 * @return void
	 */
	public function ajax_search_products() {
		check_ajax_referer( 'mkl_pc_configuration_editor', 'security' );
		if ( ! current_user_can( 'edit_shop_orders' ) ) wp_die( -1 );
		$term = isset( $_GET['term'] ) ? wc_clean( wp_unslash( $_GET['term'] ) ) : '';
		$ids = \WC_Data_Store::load( 'product' )->search_products( $term, '', false, false, 50 );
		$found = [];
		foreach ( $ids as $id ) {
			if ( ! $id || ! mkl_pc_is_configurable( $id ) ) continue;
			$product = wc_get_product( $id );
			if ( ! $product || ! $product->is_type( 'simple' ) ) continue;
			$found[ $id ] = rawurldecode( wp_strip_all_tags( $product->get_formatted_name() ) );
		}
		wp_send_json( $found );
	}
}
