<?php
namespace MKL\PC;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Quote requests created as WooCommerce orders, with the "Quote request" status
 *
 * The line item is built the way checkout builds one (Frontend_Order::save_data()), so the order
 * shows the configuration, its image and its language like any configured order. The merchant
 * adjusts it - quote orders stay editable - and sends it to the customer with the "Send the quote"
 * order action, which makes it a pending order and emails the payment link.
 *
 * A quote order never reduces stock, is left out of Analytics, and is not cancelled as unpaid.
 */
class Woo_Order_Store implements Quote_Store {

	const STATUS = 'mkl-quote';

	const CREATED_VIA = 'mkl_pc_quote_request';

	public function __construct() {
		add_action( 'init', [ $this, 'register_status' ] );
		add_filter( 'wc_order_statuses', [ $this, 'add_status' ] );
		add_filter( 'wc_order_is_editable', [ $this, 'is_editable' ], 10, 2 );
		add_filter( 'woocommerce_analytics_excluded_order_statuses', [ $this, 'exclude_from_analytics' ] );
		add_filter( 'woocommerce_order_actions', [ $this, 'order_actions' ], 10, 2 );
		add_action( 'woocommerce_order_action_mkl_pc_send_quote', [ $this, 'send_quote' ] );
		add_action( 'woocommerce_admin_order_data_after_billing_address', [ $this, 'show_request_details' ] );
		add_action( 'mkl_pc/admin/quote_request/status_box', [ $this, 'create_order_button' ] );
		add_action( 'admin_post_mkl_pc_quote_create_order', [ $this, 'create_order_from_post' ] );
	}

	public function get_id() {
		return 'woo_order';
	}

	public function get_label() {
		return __( 'Sent by email and created as WooCommerce orders with the "Quote request" status', 'product-configurator-for-woocommerce' );
	}

	public function is_available() {
		return function_exists( 'wc_create_order' );
	}

	public function is_persistent() {
		return true;
	}

	/**
	 * The capture waits in cart-temp, and moves to orders/ with the order item
	 *
	 * @return string
	 */
	public function get_files_folder() {
		return 'cart-temp';
	}

	public function save( Quote_Request $request ) {
		$order = $this->create_order( $request );
		if ( is_wp_error( $order ) ) return $order;
		$request->id = $order->get_id();
		return true;
	}

	public function get_admin_url( Quote_Request $request ) {
		if ( ! $request->id ) return '';
		$order = wc_get_order( $request->id );
		return $order ? $order->get_edit_order_url() : '';
	}

	/**
	 * Create the order for a request
	 *
	 * @param Quote_Request $request
	 * @return \WC_Order|\WP_Error
	 */
	public function create_order( Quote_Request $request ) {
		$product = $request->get_product();
		if ( ! $product ) {
			return new \WP_Error( 'mkl_pc_quote_invalid_product', __( 'This product cannot be quoted.', 'product-configurator-for-woocommerce' ), [ 'status' => 404 ] );
		}
		if ( ! $request->configuration ) {
			return new \WP_Error( 'mkl_pc_quote_invalid_configuration', __( 'The configuration data could not be read.', 'product-configurator-for-woocommerce' ), [ 'status' => 400 ] );
		}

		$order = wc_create_order( [
			'status'      => self::STATUS,
			'customer_id' => $request->user_id,
			'created_via' => self::CREATED_VIA,
		] );
		if ( is_wp_error( $order ) ) return $order;

		try {
			$this->set_customer( $order, $request );

			$item = new \WC_Order_Item_Product();
			$item->set_product( $product );
			$item->set_quantity( $request->quantity );
			$line_total = $this->get_line_total( $product, $request );
			$item->set_subtotal( $line_total );
			$item->set_total( $line_total );

			$item_key = 'quote-' . strtolower( $request->reference );
			$layers = $request->configuration->get_layers();
			mkl_pc( 'frontend' )->order->save_data( $item, $item_key, [
				'configurator_data'        => $layers,
				'configurator_data_raw'    => $request->configuration->content,
				'pc_configurator_data_raw' => $request->configuration_raw,
			], $order );

			$image = $this->move_image_to_order( $request, $order, $item_key );
			if ( $image ) {
				$item->add_meta_data( '_configurator_3d_screenshot_path', $image, true );
			}

			$order->add_item( $item );
			$order->update_meta_data( '_mkl_pc_quote_reference', $request->reference );
			$order->update_meta_data( '_mkl_pc_quote_fields', $request->fields );
			$order->update_meta_data( '_mkl_pc_quote_field_definitions', $this->get_definitions( $request ) );
			if ( $request->lang ) {
				$order->update_meta_data( '_mkl_pc_quote_lang', $request->lang );
			}
			if ( 'cpt' === $request->store && $request->id ) {
				$order->update_meta_data( '_mkl_pc_quote_request_id', $request->id );
			}
			$order->calculate_totals( true );
			$order->save();

			/* translators: %s: quote request reference */
			$order->add_order_note( sprintf( __( 'Quote request %s received from the configurator.', 'product-configurator-for-woocommerce' ), $request->reference ) );
		} catch ( \Exception $e ) {
			$order->delete( true );
			return new \WP_Error( 'mkl_pc_quote_order_failed', $e->getMessage(), [ 'status' => 500 ] );
		}

		/**
		 * Fires once a quote request was created as an order
		 *
		 * @param \WC_Order     $order
		 * @param Quote_Request $request
		 */
		do_action( 'mkl_pc/quote_request/order_created', $order, $request );

		return $order;
	}

	/**
	 * Billing details and note from the fields that map to them
	 *
	 * @param \WC_Order     $order
	 * @param Quote_Request $request
	 * @return void
	 */
	private function set_customer( $order, Quote_Request $request ) {
		foreach ( $request->field_definitions as $field_id => $field ) {
			$value = $request->get_field( $field_id );
			if ( empty( $field['maps_to'] ) || '' === $value || is_bool( $value ) ) continue;
			switch ( $field['maps_to'] ) {
				case 'full_name':
					$parts = preg_split( '/\s+/', trim( $value ), 2 );
					$order->set_billing_first_name( $parts[0] );
					$order->set_billing_last_name( isset( $parts[1] ) ? $parts[1] : '' );
					break;
				case 'customer_note':
					$order->set_customer_note( $value );
					break;
				default:
					$setter = 'set_' . $field['maps_to'];
					if ( 0 === strpos( $field['maps_to'], 'billing_' ) && is_callable( [ $order, $setter ] ) ) {
						$order->$setter( $value );
					}
			}
		}
	}

	/**
	 * Line total before tax, from the price when the request was made
	 *
	 * @param \WC_Product   $product
	 * @param Quote_Request $request
	 * @return float
	 */
	private function get_line_total( $product, Quote_Request $request ) {
		$args = [ 'qty' => $request->quantity ];
		if ( is_array( $request->price ) && isset( $request->price['total'] ) ) {
			$args['price'] = (float) $request->price['total'];
		}
		return (float) wc_get_price_excluding_tax( $product, $args );
	}

	/**
	 * Put the 3D capture where order images live
	 *
	 * A capture waiting in cart-temp is moved; one kept by a stored request is copied, since the
	 * request still shows it.
	 *
	 * @param Quote_Request $request
	 * @param \WC_Order     $order
	 * @param string        $item_key
	 * @return string|false Path relative to mkl-pc-config-images.
	 */
	private function move_image_to_order( Quote_Request $request, $order, $item_key ) {
		if ( empty( $request->meta['owns_image'] ) || ! $request->image_path || ! is_file( $request->image_path ) ) return false;
		$base_dir = wp_upload_dir()['basedir'] . '/mkl-pc-config-images';
		$orders_dir = $base_dir . '/orders';
		if ( ! file_exists( $orders_dir ) ) {
			wp_mkdir_p( $orders_dir );
		}
		$name = 'order-' . $order->get_id() . '-' . sanitize_file_name( substr( $item_key, 0, 32 ) ) . '.png';
		$is_temp = 0 === strpos( $request->image_path, $base_dir . '/cart-temp/' );
		$done = $is_temp ? Utils::fs_move( $request->image_path, $orders_dir . '/' . $name, true ) : Utils::fs_copy( $request->image_path, $orders_dir . '/' . $name, true );
		if ( ! $done ) return false;
		if ( $is_temp ) {
			$request->image_path = $orders_dir . '/' . $name;
			$request->image_url  = wp_upload_dir()['baseurl'] . '/mkl-pc-config-images/orders/' . $name;
		}
		return 'orders/' . $name;
	}

	/**
	 * Field labels at the time of the request, to show the values that are not billing details
	 *
	 * @param Quote_Request $request
	 * @return array
	 */
	private function get_definitions( Quote_Request $request ) {
		$definitions = [];
		foreach ( $request->field_definitions as $field_id => $field ) {
			$definitions[ $field_id ] = [
				'label'   => $field['label'],
				'type'    => $field['type'],
				'options' => isset( $field['options'] ) ? $field['options'] : [],
				'maps_to' => isset( $field['maps_to'] ) ? $field['maps_to'] : '',
			];
		}
		return $definitions;
	}

	/**
	 * @return void
	 */
	public function register_status() {
		register_post_status( 'wc-' . self::STATUS, [
			'label'                     => _x( 'Quote request', 'Order status', 'product-configurator-for-woocommerce' ),
			'public'                    => false,
			'exclude_from_search'       => false,
			'show_in_admin_all_list'    => true,
			'show_in_admin_status_list' => true,
			/* translators: %s: number of orders */
			'label_count'               => _n_noop( 'Quote request <span class="count">(%s)</span>', 'Quote requests <span class="count">(%s)</span>', 'product-configurator-for-woocommerce' ),
		] );
	}

	/**
	 * @param array $statuses
	 * @return array
	 */
	public function add_status( $statuses ) {
		$new = [];
		foreach ( $statuses as $key => $label ) {
			$new[ $key ] = $label;
			if ( 'wc-pending' === $key ) {
				$new[ 'wc-' . self::STATUS ] = _x( 'Quote request', 'Order status', 'product-configurator-for-woocommerce' );
			}
		}
		if ( ! isset( $new[ 'wc-' . self::STATUS ] ) ) {
			$new[ 'wc-' . self::STATUS ] = _x( 'Quote request', 'Order status', 'product-configurator-for-woocommerce' );
		}
		return $new;
	}

	/**
	 * The merchant prices the quote before sending it
	 *
	 * @param boolean   $editable
	 * @param \WC_Order $order
	 * @return boolean
	 */
	public function is_editable( $editable, $order ) {
		return $editable || ( $order && $order->has_status( self::STATUS ) );
	}

	/**
	 * @param array $statuses
	 * @return array
	 */
	public function exclude_from_analytics( $statuses ) {
		$statuses[] = self::STATUS;
		return array_unique( $statuses );
	}

	/**
	 * @param array          $actions
	 * @param \WC_Order|null $order
	 * @return array
	 */
	public function order_actions( $actions, $order = null ) {
		if ( $order && $order->has_status( self::STATUS ) ) {
			$actions['mkl_pc_send_quote'] = __( 'Send the quote to the customer (pending payment)', 'product-configurator-for-woocommerce' );
		}
		return $actions;
	}

	/**
	 * Make the quote a pending order and email the customer its payment link
	 *
	 * @param \WC_Order $order
	 * @return void
	 */
	public function send_quote( $order ) {
		if ( ! $order->has_status( self::STATUS ) ) return;
		$order->update_status( 'pending', __( 'Quote sent to the customer.', 'product-configurator-for-woocommerce' ) );
		WC()->payment_gateways();
		WC()->mailer()->customer_invoice( $order );
		$order->add_order_note( __( 'Quote and payment link emailed to the customer.', 'product-configurator-for-woocommerce' ), false, true );
	}

	/**
	 * Form values that are not billing details, on the order screen
	 *
	 * @param \WC_Order $order
	 * @return void
	 */
	public function show_request_details( $order ) {
		$reference = $order->get_meta( '_mkl_pc_quote_reference' );
		if ( ! $reference ) return;
		$fields = (array) $order->get_meta( '_mkl_pc_quote_fields' );
		$definitions = (array) $order->get_meta( '_mkl_pc_quote_field_definitions' );
		$request_id = (int) $order->get_meta( '_mkl_pc_quote_request_id' );

		$request = new Quote_Request();
		$request->fields = $fields;
		foreach ( $definitions as $field_id => $field ) {
			if ( empty( $field['maps_to'] ) ) $request->field_definitions[ $field_id ] = $field;
		}
		?>
		<div class="mkl-pc-quote-request-details">
			<p>
				<strong><?php esc_html_e( 'Quote request:', 'product-configurator-for-woocommerce' ); ?></strong>
				<?php if ( $request_id && get_post( $request_id ) ) : ?>
					<a href="<?php echo esc_url( admin_url( 'post.php?post=' . $request_id . '&action=edit' ) ); ?>"><?php echo esc_html( $reference ); ?></a>
				<?php else : ?>
					<?php echo esc_html( $reference ); ?>
				<?php endif; ?>
			</p>
			<?php foreach ( $request->get_field_rows() as $row ) : ?>
				<p><strong><?php echo esc_html( wp_strip_all_tags( $row['label'] ) ); ?>:</strong> <?php echo wp_kses_post( nl2br( esc_html( $row['value'] ) ) ); ?></p>
			<?php endforeach; ?>
		</div>
		<?php
	}

	/**
	 * On a request kept as a post: link to its order, or create one
	 *
	 * @param \WP_Post $post
	 * @return void
	 */
	public function create_order_button( $post ) {
		if ( ! $this->is_available() || ! current_user_can( 'edit_shop_orders' ) ) return;
		$order_id = (int) get_post_meta( $post->ID, '_mkl_pc_quote_order_id', true );
		$order = $order_id ? wc_get_order( $order_id ) : null;
		echo '<p>';
		if ( $order ) {
			printf(
				/* translators: %s: link to the order */
				esc_html__( 'Order: %s', 'product-configurator-for-woocommerce' ),
				'<a href="' . esc_url( $order->get_edit_order_url() ) . '">#' . esc_html( $order->get_order_number() ) . '</a>'
			);
		} else {
			$url = wp_nonce_url( admin_url( 'admin-post.php?action=mkl_pc_quote_create_order&post=' . $post->ID ), 'mkl_pc_quote_create_order_' . $post->ID );
			printf( '<a class="button" href="%s">%s</a>', esc_url( $url ), esc_html__( 'Create an order from this request', 'product-configurator-for-woocommerce' ) );
		}
		echo '</p>';
	}

	/**
	 * admin-post handler for the button above
	 *
	 * @return void
	 */
	public function create_order_from_post() {
		$post_id = isset( $_GET['post'] ) ? absint( $_GET['post'] ) : 0;
		check_admin_referer( 'mkl_pc_quote_create_order_' . $post_id );
		if ( ! current_user_can( 'edit_post', $post_id ) || ! current_user_can( 'edit_shop_orders' ) ) {
			wp_die( esc_html__( 'You are not allowed to do this.', 'product-configurator-for-woocommerce' ), 403 );
		}
		$order = $this->create_order_from_request_post( $post_id );
		if ( is_wp_error( $order ) ) {
			wp_die( esc_html( $order->get_error_message() ) );
		}
		wp_safe_redirect( $order->get_edit_order_url() );
		exit;
	}

	/**
	 * Create the order for a request kept as a post, once
	 *
	 * @param int $post_id
	 * @return \WC_Order|\WP_Error
	 */
	public function create_order_from_request_post( $post_id ) {
		$existing = (int) get_post_meta( $post_id, '_mkl_pc_quote_order_id', true );
		if ( $existing && ( $order = wc_get_order( $existing ) ) ) return $order;

		$request = mkl_pc( 'quotes' )->cpt_store->load( $post_id );
		if ( ! $request ) {
			return new \WP_Error( 'mkl_pc_quote_not_found', __( 'Quote request not found.', 'product-configurator-for-woocommerce' ) );
		}
		$order = $this->create_order( $request );
		if ( is_wp_error( $order ) ) return $order;
		update_post_meta( $post_id, '_mkl_pc_quote_order_id', $order->get_id() );
		return $order;
	}
}
