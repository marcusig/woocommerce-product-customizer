<?php
namespace MKL\PC;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Write a configuration to an order line, replacing the one it had
 *
 * The line gets what checkout gives it (Frontend_Order::save_data()), after what the previous
 * configuration left is removed: the payloads, the per-layer or combined meta, the SKU and the 3D capture.
 * Its price is the configured price, which the admin can still change on the order as usual.
 */
class Order_Item_Configuration {

	/**
	 * @param \WC_Order                           $order
	 * @param \WC_Order_Item_Product|\WC_Product  $item_or_product A line to edit, or the product of a new line.
	 * @param string|array                        $payload         The configurator's payload.
	 * @param array                               $args            quantity, image (3D capture, data URL).
	 * @return \WC_Order_Item_Product|\WP_Error
	 */
	public function save( $order, $item_or_product, $payload, $args = [] ) {
		$args = wp_parse_args( $args, [ 'quantity' => 1, 'image' => '' ] );
		$is_new = $item_or_product instanceof \WC_Product;
		$item = $is_new ? new \WC_Order_Item_Product() : $item_or_product;
		$product = $is_new ? $item_or_product : $item->get_product();
		if ( ! $product ) {
			return new \WP_Error( 'mkl_pc_editor_product', __( 'The product of this line no longer exists.', 'product-configurator-for-woocommerce' ), [ 'status' => 400 ] );
		}
		$product_id = $product->get_parent_id() ? $product->get_parent_id() : $product->get_id();

		$raw = is_array( $payload ) ? wp_json_encode( $payload ) : (string) $payload;
		$data = Utils::decode_configurator_payload( $raw );
		if ( ! empty( $data ) ) {
			$data = mkl_pc( 'db' )->sanitize( $data );
		}
		if ( empty( $data ) || ! is_array( $data ) ) {
			return new \WP_Error( 'mkl_pc_editor_configuration', __( 'The configuration data could not be read.', 'product-configurator-for-woocommerce' ), [ 'status' => 400 ] );
		}

		$quantity = max( 1, (float) $args['quantity'] );
		$configuration = new Configuration( null, [
			'product_id'   => $product_id,
			'variation_id' => $product->get_parent_id() ? $product->get_id() : 0,
			'content'      => $data,
		] );

		$old_total = $is_new ? null : (float) $item->get_total();
		$old_data = $is_new ? null : $item->get_meta( '_configurator_data' );
		if ( ! $is_new ) {
			$this->clear( $item );
		} else {
			$item->set_product( $product );
		}

		$line_total = $this->get_line_total( $product, $configuration, $quantity );
		$item->set_quantity( $quantity );
		$item->set_subtotal( $line_total );
		$item->set_total( $line_total );

		$values = [
			'configurator_data'        => $configuration->get_layers(),
			'configurator_data_raw'    => $configuration->content,
			'pc_configurator_data_raw' => wp_json_encode( $data ),
		];
		if ( '3d' === mkl_pc_get_configurator_type( $product_id ) && $args['image'] ) {
			$temp = mkl_pc( 'frontend' )->cart->save_3d_screenshot_to_temp( $args['image'] );
			if ( $temp ) $values['configurator_3d_screenshot_path'] = $temp;
		}
		// Names the 3D capture's file in the orders folder.
		$item_key = 'edit-' . substr( md5( wp_generate_uuid4() ), 0, 16 );
		mkl_pc( 'frontend' )->order->save_data( $item, $item_key, $values, $order );

		if ( $is_new ) {
			$order->add_item( $item );
		}
		$item->save();

		// Stock already taken for this line follows its new quantity, as when the admin edits a line.
		if ( ! $is_new && function_exists( 'wc_maybe_adjust_line_item_product_stock' ) ) {
			wc_maybe_adjust_line_item_product_stock( $item );
		}

		/**
		 * Fires once an order line got a configuration from the admin, before the order totals are recalculated
		 *
		 * @param \WC_Order_Item_Product $item
		 * @param \WC_Order              $order
		 * @param array|null             $old_data The line's previous configuration (choices), null for a new line.
		 */
		do_action( 'mkl_pc/configuration_editor/item_saved', $item, $order, $old_data );

		$order->calculate_totals( true );
		$this->add_note( $order, $item, $old_total );
		$order->save();

		return $item;
	}

	/**
	 * What the previous configuration left on the line
	 *
	 * The combined meta and the SKU are stored under their labels; those set now are the ones found. A
	 * line saved under a label that was changed since keeps that row.
	 *
	 * @param \WC_Order_Item_Product $item
	 * @return void
	 */
	public function clear( $item ) {
		$keys = [ '_configurator_data', '_configurator_data_raw', '_pc_configurator_data_raw', '_configurator_individual_meta' ];
		foreach ( (array) $item->get_meta( '_configurator_individual_meta' ) as $pair ) {
			if ( is_array( $pair ) && ! empty( $pair['key'] ) ) $keys[] = $pair['key'];
		}
		$keys[] = apply_filters( 'mkl_pc/order_created/saved_data/label', esc_html( mkl_pc( 'settings' )->get_label( 'configuration_cart_meta_label', esc_html_x( 'Configuration', 'Label for the configuration meta data', 'product-configurator-for-woocommerce' ) ) ), $item );
		$keys[] = esc_html( mkl_pc( 'settings' )->get_label( 'sku_label', esc_html_x( 'SKU', 'Label for the SKU meta data', 'product-configurator-for-woocommerce' ) ) );

		$this->delete_capture( (string) $item->get_meta( '_configurator_3d_screenshot_path' ) );
		$keys[] = '_configurator_3d_screenshot_path';

		/**
		 * Meta keys removed from a line before it gets a new configuration
		 *
		 * Add-ons that add meta on `mkl_pc/order_created/after_saved_data` list theirs here.
		 *
		 * @param string[]               $keys
		 * @param \WC_Order_Item_Product $item
		 */
		$keys = apply_filters( 'mkl_pc/configuration_editor/clear_meta_keys', $keys, $item );
		foreach ( array_unique( $keys ) as $key ) {
			$item->delete_meta_data( $key );
		}
	}

	/**
	 * Delete the line's previous 3D capture, which only it uses
	 *
	 * @param string $relative Path under mkl-pc-config-images.
	 * @return void
	 */
	private function delete_capture( $relative ) {
		if ( ! $relative || false !== strpos( $relative, '..' ) || 0 !== strpos( $relative, 'orders/' ) ) return;
		$path = wp_upload_dir()['basedir'] . '/mkl-pc-config-images/' . $relative;
		if ( is_file( $path ) ) wp_delete_file( $path );
	}

	/**
	 * The configured price for the quantity, without tax, as WooCommerce stores line totals
	 *
	 * @param \WC_Product   $product
	 * @param Configuration $configuration
	 * @param float         $quantity
	 * @return float
	 */
	public function get_line_total( $product, $configuration, $quantity ) {
		$args = [ 'qty' => $quantity ];
		$price = $configuration->get_configured_price( [ 'quantity' => $quantity ] );
		if ( is_array( $price ) && isset( $price['total'] ) ) {
			$args['price'] = (float) $price['total'];
		}
		return (float) wc_get_price_excluding_tax( $product, $args );
	}

	/**
	 * @param \WC_Order              $order
	 * @param \WC_Order_Item_Product $item
	 * @param float|null             $old_total
	 * @return void
	 */
	private function add_note( $order, $item, $old_total ) {
		$user = wp_get_current_user();
		$by = $user && $user->exists() ? $user->display_name : '';
		$new_total = wc_price( $item->get_total(), [ 'currency' => $order->get_currency() ] );
		if ( null === $old_total ) {
			/* translators: 1: product name, 2: line total, 3: user name */
			$note = sprintf( __( 'Configured product added: %1$s (%2$s), by %3$s.', 'product-configurator-for-woocommerce' ), $item->get_name(), $new_total, $by );
		} else {
			/* translators: 1: product name, 2: previous line total, 3: new line total, 4: user name */
			$note = sprintf( __( 'Configuration of %1$s edited by %4$s. Line total: %2$s → %3$s.', 'product-configurator-for-woocommerce' ), $item->get_name(), wc_price( $old_total, [ 'currency' => $order->get_currency() ] ), $new_total, $by );
		}
		$order->add_order_note( html_entity_decode( wp_strip_all_tags( $note ), ENT_QUOTES, get_bloginfo( 'charset' ) ) );
	}
}
