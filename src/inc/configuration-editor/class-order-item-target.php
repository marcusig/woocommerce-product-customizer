<?php
namespace MKL\PC;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Configure order lines from the order screen
 *
 * `order:{id}:item:{item_id}` edits a line, `order:{id}:product:{product_id}` adds one. Works on any order
 * WooCommerce lets the admin edit: quote orders, orders made by quote plugins, orders created in the admin.
 * Order_Item_Configuration writes the line.
 */
class Order_Item_Target implements Configuration_Editor_Target {

	/**
	 * @var Configuration_Editor
	 */
	private $editor;

	public function __construct( Configuration_Editor $editor ) {
		$this->editor = $editor;
		add_action( 'woocommerce_after_order_itemmeta', [ $this, 'edit_item_button' ], 10, 3 );
		add_action( 'woocommerce_order_item_add_action_buttons', [ $this, 'add_item_button' ] );
		add_action( 'admin_enqueue_scripts', [ $this, 'enqueue' ] );
	}

	public function get_type() {
		return 'order';
	}

	public function current_user_can() {
		return current_user_can( 'edit_shop_orders' );
	}

	/**
	 * @param string $target
	 * @return array|\WP_Error order and item (null for a new line), besides what the interface lists.
	 */
	public function resolve( $target ) {
		$not_found = new \WP_Error( 'mkl_pc_editor_target', __( 'This order line cannot be configured.', 'product-configurator-for-woocommerce' ), [ 'status' => 404 ] );
		if ( ! preg_match( '/^order:(\d+):(item|product):(\d+)$/', $target, $match ) || ! function_exists( 'wc_get_order' ) ) return $not_found;

		$order = wc_get_order( (int) $match[1] );
		if ( ! $order || ! $this->user_can_edit( $order ) ) {
			return new \WP_Error( 'mkl_pc_editor_forbidden', __( 'This order cannot be edited.', 'product-configurator-for-woocommerce' ), [ 'status' => rest_authorization_required_code() ] );
		}

		$item = null;
		if ( 'item' === $match[2] ) {
			$item = $order->get_item( (int) $match[3] );
			if ( ! $item instanceof \WC_Order_Item_Product ) return $not_found;
			$product = $item->get_product();
		} else {
			$product = wc_get_product( (int) $match[3] );
		}
		if ( ! $product ) return $not_found;

		$configuration = $item ? $item->get_meta( '_configurator_data_raw' ) : [];
		return [
			'order'         => $order,
			'item'          => $item,
			'product'       => $product,
			'configuration' => $configuration ? $configuration : [],
			'quantity'      => $item ? $item->get_quantity() : 1,
			'save_label'    => $item ? __( 'Save the configuration', 'product-configurator-for-woocommerce' ) : __( 'Add to the order', 'product-configurator-for-woocommerce' ),
		];
	}

	public function save( $resolved, $payload, $args ) {
		$writer = new Order_Item_Configuration();
		$item = $writer->save( $resolved['order'], $resolved['item'] ? $resolved['item'] : $resolved['product'], $payload, $args );
		if ( is_wp_error( $item ) ) return $item;
		return [
			'item_id' => $item->get_id(),
			'total'   => (float) $item->get_total(),
		];
	}

	/**
	 * Whether the current user may configure the lines of an order
	 *
	 * @param \WC_Order $order
	 * @return boolean
	 */
	public function user_can_edit( $order ) {
		if ( ! $this->current_user_can() ) return false;
		/**
		 * Whether an order's lines can be configured from the admin. Default: when WooCommerce lets its items be edited.
		 *
		 * @param boolean   $editable
		 * @param \WC_Order $order
		 */
		return (bool) apply_filters( 'mkl_pc/configuration_editor/order_is_editable', $order->is_editable(), $order );
	}

	/**
	 * "Configure" on each line of a configurable product
	 *
	 * @param int                    $item_id
	 * @param \WC_Order_Item         $item
	 * @param \WC_Product|null|false $product
	 * @return void
	 */
	public function edit_item_button( $item_id, $item, $product ) {
		if ( ! $item instanceof \WC_Order_Item_Product || ! $product ) return;
		$target = 'order:' . $item->get_order_id() . ':item:' . $item_id;
		$resolved = $this->editor->resolve_target( $target );
		if ( is_wp_error( $resolved ) ) return;
		$label = $item->get_meta( '_configurator_data_raw' ) ? __( 'Edit the configuration', 'product-configurator-for-woocommerce' ) : __( 'Configure', 'product-configurator-for-woocommerce' );
		echo '<p class="mkl-pc-configure-item">';
		$this->editor->edit_button( $target, $product, $label, 'button-small' );
		echo '</p>';
	}

	/**
	 * "Add a configured product", next to WooCommerce's "Add product(s)"
	 *
	 * @param \WC_Order $order
	 * @return void
	 */
	public function add_item_button( $order ) {
		if ( ! $this->user_can_edit( $order ) ) return;
		$this->editor->add_button( 'order:' . $order->get_id(), __( 'Add a configured product', 'product-configurator-for-woocommerce' ) );
	}

	/**
	 * @return void
	 */
	public function enqueue() {
		$screen = get_current_screen();
		if ( ! $screen || ! in_array( $screen->id, [ 'shop_order', 'woocommerce_page_wc-orders' ], true ) || ! $this->current_user_can() ) return;
		$this->editor->enqueue_dialog( 'order', [ 'wc-admin-order-meta-boxes' ] );
	}
}
