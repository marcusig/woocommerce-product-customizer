<?php
namespace MKL\PC;

if ( ! defined( 'ABSPATH' ) ) die();

class Compat_Yith_Raq {
	public function __construct() {}

	public function should_run() {
		return defined( 'YITH_YWRAQ_VERSION' );
	}

	public function run() {

		add_filter( 'woocommerce_locate_template', [ $this, 'locate_yith_template' ], 20, 4 );
		add_action( 'yith_raq_updated', [ $this, 'yith_raq_updated' ] );
		add_filter( 'ywraq_ajax_add_item_is_valid', [ $this, 'validate_add_to_quote' ], 20, 2 );
		// Promote on the request email, the one step every mode reaches: YITH Premium fires
		// ywraq_process only when it also creates an order, so an email-only shop never gets there.
		// Free sends through send_raq_mail, Premium through send_raq_customer_mail. Priority 1 puts
		// this before WC_Emails composes the message, so the attachment and the image URL carry the
		// promoted path, and while the list still exists - it is cleared once the mail is away.
		add_action( 'send_raq_mail', [ $this, 'promote_quote_screenshots' ], 1, 1 );
		add_action( 'send_raq_customer_mail', [ $this, 'promote_quote_screenshots' ], 1, 1 );
		// Order mode: after Premium's create_order() on the same hook (priority 10). Anything it turned
		// into an order has already had its picture moved to orders/, so this is a no-op for those.
		add_action( 'ywraq_process', [ $this, 'promote_quote_screenshots' ], 20, 1 );
		add_filter( 'woocommerce_email_attachments', [ $this, 'attach_quote_images' ], 20, 4 );
		// Registered from here, so the settings appear only on a shop that actually has YITH.
		add_action( 'mkl_pc/register_settings', [ $this, 'register_settings' ], 20, 1 );
		add_filter( 'ywraq_request_quote_view_item_data', [ $this, 'view_item_data' ], 20, 3 );
		add_filter( 'ywraq_item_data', [ $this, 'item_data' ], 20, 3 );
		add_filter( 'ywraq_product_image', [ $this, 'item_image' ], 20, 2 );
		add_filter( 'mkl_pc_js_config', [ $this, 'config' ] );
		add_action( 'mkl_pc_frontend_configurator_after_add_to_cart', [ $this, 'add_add_to_quote_button' ], 15 );
		add_action( 'wp_ajax_pc_add_to_quote', [ $this, 'ajax_add_to_quote' ] );
		add_action( 'wp_ajax_nopriv_pc_add_to_quote', [ $this, 'ajax_add_to_quote' ] );
		add_filter( 'ywraq_force_start_session', [ $this, 'start_session_for_add_to_quote' ] );
		add_action( 'mkl_pc_frontend_templates_after', [ $this, 'print_quote_templates' ] );
		add_action( 'mkl_pc_scripts_product_page_after', [ $this, 'enqueue_scripts' ] );
		// add_filter( 'yith_ywraq_product_subtotal_html', [ $this, 'apply_extra_price' ], 20, 3 );
		add_action( 'ywraq_quote_adjust_price', [ $this, 'apply_extra_price' ], 20, 2 );

		add_filter( 'mkl_pc_get_saved_configuration_content', [ $this, 'load_quote_configuration_in_configurator' ] );
		add_action( 'ywraq_request_quote_email_view_item_after_title', [ $this, 'quote_from_cart_compat' ], 20, 3 );
		add_action( 'ywraq_from_cart_to_order_item', [ $this, 'raq_on_create_order' ], 20, 4 );
		add_filter( 'ywraq_order_cart_item_data', [ $this, 'order_cart_item_data' ], 20, 3 );
	}

	public function config( $config ) {
		$config['ywraq_hide_add_to_cart'] = 'yes' === get_option( 'ywraq_hide_add_to_cart' );
		$config['ywraq_hide_price']       = 'yes' === get_option( 'ywraq_hide_price' );
		// Shown when the quote request itself fails (network, bad response).
		$config['ywraq_error_message']    = $this->ajax_error_message();
		// The count is only known in the browser, so both forms go there.
		$config['ywraq_count_label']      = array(
			/* translators: %s: number of items (1) in the quote request */
			'one'   => __( '%s item in your quote request', 'product-configurator-for-woocommerce' ),
			/* translators: %s: number of items (2 or more) in the quote request */
			'other' => __( '%s items in your quote request', 'product-configurator-for-woocommerce' ),
		);
		return $config;
	}

	/**
	 * Override YITH Request a Quote templates with configurator-compatible versions.
	 *
	 * @param string $template      Located template path.
	 * @param string $template_name Template name (e.g. request-quote-view.php, emails/request-quote.php).
	 * @param string $template_path Theme template path.
	 * @param string $default_path  Plugin default path (YITH_YWRAQ_TEMPLATE_PATH when loading YITH templates).
	 * @return string
	 */
	public function locate_yith_template( $template, $template_name, $template_path, $default_path ) {
		if ( ! defined( 'YITH_YWRAQ_TEMPLATE_PATH' ) ) {
			return $template;
		}

		if ( defined( 'YITH_YWRAQ_PREMIUM' ) ) return $template;
		$yith_path = trailingslashit( YITH_YWRAQ_TEMPLATE_PATH );
		if ( trailingslashit( $default_path ) !== $yith_path ) {
			return $template;
		}

		$overrides = [
			'request-quote-view.php'       => 'request-quote-view.php',
			'emails/request-quote.php'     => 'emails/request-quote.php',
			'emails/plain/request-quote.php' => 'emails/plain/request-quote.php',
		];
		if ( ! isset( $overrides[ $template_name ] ) ) {
			return $template;
		}
		$our_file = dirname( __FILE__ ) . '/yith-free-templates/' . $overrides[ $template_name ];
		if ( is_readable( $our_file ) ) {
			return $our_file;
		}
		return $template;
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
	 * Attach the configuration to a quote item added by YITH's own button.
	 *
	 * The path the configurator used before it had its own request (ajax_add_to_quote()): the product
	 * form is filled in and YITH's button clicked, so YITH posts the form and this runs once the item is
	 * in the list. Still reached when the shopper uses YITH's button on the product page directly.
	 *
	 * @return void
	 */
	public function yith_raq_updated() {
		$action       = isset( $_POST['action'] ) ? sanitize_key( wp_unslash( $_POST['action'] ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Missing -- YITH verifies its own add-to-quote nonce before this hook.
		$ywraq_action = isset( $_POST['ywraq_action'] ) ? sanitize_key( wp_unslash( $_POST['ywraq_action'] ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Missing -- Same YITH quote nonce as above.
		$is_adding_configured_item = ( 'yith_ywraq_action' === $action ) && ( 'add_item' === $ywraq_action ) && isset( $_POST['pc_configurator_data'] );
		if ( ! $is_adding_configured_item ) return;
		// attach_configuration() saves the session, which fires this hook again.
		static $added = false;
		if ( $added ) return;
		$rq = YITH_Request_Quote();

		$product_id   = isset( $_REQUEST['product_id'] ) ? absint( wp_unslash( $_REQUEST['product_id'] ) ) : 0; // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Same YITH quote nonce as yith_raq_updated().
		$variation_id = isset( $_REQUEST['variation_id'] ) ? absint( wp_unslash( $_REQUEST['variation_id'] ) ) : 0; // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Same YITH quote nonce as yith_raq_updated().

		$item_id = $variation_id ? md5( $product_id . $variation_id ) : md5( $product_id );
		if ( ! isset( $rq->raq_content[ $item_id ] ) ) return;

		$raw_configurator_data = wp_unslash( $_POST['pc_configurator_data'] ); // phpcs:ignore WordPress.Security.NonceVerification.Missing, WordPress.Security.ValidatedSanitizedInput.InputNotSanitized -- YITH quote nonce; JSON is decoded then sanitized in attach_configuration().
		// Not sanitize_text_field()ed: that strips the percent-encoded octets Premium posts;
		// save_3d_screenshot_to_temp() validates the data URL itself.
		$screenshot = isset( $_POST['pc_3d_screenshot'] ) ? wp_unslash( $_POST['pc_3d_screenshot'] ) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Missing, WordPress.Security.ValidatedSanitizedInput.InputNotSanitized -- Validated as a PNG data URL in save_3d_screenshot_to_temp().

		$added = true;
		if ( ! $this->attach_configuration( $item_id, $raw_configurator_data, $screenshot ) ) {
			$added = false;
		}
	}

	/**
	 * Add a configured product to the quote list, without YITH's markup on the page.
	 *
	 * The configurator's own request, the quote counterpart of pc_add_to_cart: the item goes in through
	 * YITH_Request_Quote::add_item(), which both Free and Premium expose, so it works wherever the
	 * configurator is (a shortcode on any page) and the answer comes back to the configurator instead of
	 * to YITH's button. No nonce, like pc_add_to_cart: the quote list lives in the visitor's own session,
	 * and a cached page would carry a stale one.
	 *
	 * Responds with `result` - `added`, `updated` (the product was already in the list, and its
	 * configuration was replaced by this one) or `error` - plus `message`, `list_url`, `count` and
	 * `redirect` (YITH's "go to the list after adding" setting).
	 *
	 * @return void
	 */
	public function ajax_add_to_quote() {
		// phpcs:disable WordPress.Security.NonceVerification.Missing -- See the docblock: same model as pc_add_to_cart.
		$requested_id = isset( $_POST['product_id'] ) ? absint( wp_unslash( $_POST['product_id'] ) ) : 0;
		$product      = $requested_id ? wc_get_product( $requested_id ) : false;
		$raw_data     = isset( $_POST['pc_configurator_data'] ) ? wp_unslash( $_POST['pc_configurator_data'] ) : ''; // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized -- JSON, decoded then sanitized in attach_configuration().
		$screenshot   = isset( $_POST['pc_3d_screenshot'] ) ? wp_unslash( $_POST['pc_3d_screenshot'] ) : ''; // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized -- Validated as a PNG data URL in save_3d_screenshot_to_temp().
		$raw_quantity = isset( $_POST['quantity'] ) ? sanitize_text_field( wp_unslash( $_POST['quantity'] ) ) : '';
		// phpcs:enable WordPress.Security.NonceVerification.Missing

		$error = $this->ajax_error_message();
		if ( ! $product || 'publish' !== get_post_status( $product->get_id() ) || ! is_string( $raw_data ) ) {
			wp_send_json( array( 'result' => 'error', 'message' => $error ) );
		}

		$variation_id = 0;
		$product_id   = $product->get_id();
		$variation    = array();
		if ( $product->is_type( 'variation' ) ) {
			$variation_id = $product_id;
			$product_id   = $product->get_parent_id();
			$variation    = $product->get_variation_attributes();
			// An "any" attribute is empty on the variation; the shopper's choice is in the product form.
			foreach ( $variation as $name => $value ) {
				if ( '' === $value && isset( $_POST[ $name ] ) ) { // phpcs:ignore WordPress.Security.NonceVerification.Missing -- Same as above.
					$variation[ $name ] = sanitize_text_field( wp_unslash( $_POST[ $name ] ) ); // phpcs:ignore WordPress.Security.NonceVerification.Missing -- Same as above.
				}
			}
		}

		$parent = $variation_id ? wc_get_product( $product_id ) : $product;
		if ( ! $parent || ! $this->can_quote_product( $parent ) ) {
			wp_send_json( array( 'result' => 'error', 'message' => $error ) );
		}

		$configurable = mkl_pc_is_configurable( $product_id ) || ( $variation_id && mkl_pc_is_configurable( $variation_id ) );
		if ( $configurable && ! $this->is_valid_payload( $raw_data ) ) {
			wp_send_json( array( 'result' => 'error', 'message' => $error ) );
		}

		// YITH's own checks (Free refuses products a guest cannot see), and anyone else's.
		// validate_add_to_quote() runs here too and checks the payload once more.
		if ( ! apply_filters( 'ywraq_ajax_add_item_is_valid', true, $product_id ) ) {
			wp_send_json( array( 'result' => 'error', 'message' => $error ) );
		}

		$quantity = ( '' === $raw_quantity || '0' === $raw_quantity ) ? 1 : wc_stock_amount( $raw_quantity );
		$item     = array_merge(
			array(
				'product_id' => $product_id,
				'quantity'   => max( 1, $quantity ),
			),
			$variation
		);
		// Both versions tell a simple product from a variation by the key being there at all.
		if ( $variation_id ) {
			$item['variation_id'] = $variation_id;
		}

		$rq          = YITH_Request_Quote();
		$keys_before = is_array( $rq->raq_content ) ? array_keys( $rq->raq_content ) : array();
		$result      = $rq->add_item( $item );
		$item_key    = $this->find_item_key( $product_id, $variation_id, $keys_before );

		if ( ( 'true' !== $result && 'exists' !== $result ) || ! $item_key ) {
			wp_send_json( array( 'result' => 'error', 'message' => $error ) );
		}

		if ( $configurable && ! $this->attach_configuration( $item_key, $raw_data, $screenshot ) ) {
			// Only an item this request put in; one that was already there keeps what it had.
			if ( 'true' === $result ) {
				$rq->remove_item( $item_key );
			}
			wp_send_json( array( 'result' => 'error', 'message' => $error ) );
		}

		// As YITH's own add does: marks the visitor as having something in progress, so page caches
		// stop serving them the anonymous page.
		if ( ! isset( $_COOKIE['woocommerce_items_in_cart'] ) ) {
			do_action( 'woocommerce_set_cart_cookies', true );
		}

		if ( 'true' === $result ) {
			$message = $this->get_yith_label( 'product_added', __( 'Product added to the list!', 'yith-woocommerce-request-a-quote' ) );
		} else {
			$message = mkl_pc( 'settings' )->get_label( 'quote_item_updated', __( 'This product was already in your quote request: its configuration has been updated.', 'product-configurator-for-woocommerce' ) );
		}

		wp_send_json(
			apply_filters(
				'mkl_pc/yith-raq/add_to_quote_response',
				array(
					'result'       => 'true' === $result ? 'added' : 'updated',
					'message'      => $message,
					'item_key'     => $item_key,
					'product_name' => $product->get_name(),
					'image_url'    => $this->get_item_image_url( $item_key ),
					'list_url'     => $rq->get_raq_page_url(),
					'count'        => count( $rq->raq_content ),
					'redirect'     => 'yes' === get_option( 'ywraq_after_click_action', 'no' ),
				),
				$item_key,
				$rq->raq_content
			)
		);
	}

	/**
	 * Give a guest a quote session on the configurator's add to quote.
	 *
	 * Premium starts its session only when the request carries its own `ywraq_action=add_item`
	 * (or the visitor already has a list), so without this a first add from pc_add_to_quote went
	 * into a list that was never saved. Free always starts one.
	 *
	 * @param bool $force Whether YITH should start the session.
	 * @return bool
	 */
	public function start_session_for_add_to_quote( $force ) {
		if ( $force || ! wp_doing_ajax() ) return $force;
		return isset( $_REQUEST['action'] ) && 'pc_add_to_quote' === $_REQUEST['action']; // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Only decides whether a session starts.
	}

	/**
	 * The picture stored on a quote item, for the confirmation in the configurator.
	 *
	 * Only the 3D capture: a 2D image would have to be merged on the spot, which is too slow for an
	 * answer the shopper is waiting on.
	 *
	 * @param string $item_key Quote item key.
	 * @return string URL, or ''.
	 */
	private function get_item_image_url( $item_key ) {
		$content = YITH_Request_Quote()->raq_content;
		if ( empty( $content[ $item_key ]['configurator_3d_screenshot_path'] ) ) return '';
		$url = mkl_pc( 'frontend' )->cart->get_3d_screenshot_url( $content[ $item_key ]['configurator_3d_screenshot_path'] );
		return $url ? $url : '';
	}

	/**
	 * A YITH label, with a fallback.
	 *
	 * Premium reads `get_option( 'ywraq_show_<key>' ) ?? default`, and get_option() returns false,
	 * not null, for an option never saved - so an untouched label comes back empty.
	 *
	 * @param string $key      Label key.
	 * @param string $fallback Text when YITH has none.
	 * @return string
	 */
	private function get_yith_label( $key, $fallback ) {
		$label = function_exists( 'ywraq_get_label' ) ? ywraq_get_label( $key ) : '';
		return ( is_string( $label ) && '' !== trim( $label ) ) ? $label : $fallback;
	}

	/**
	 * Templates for the quote confirmation, shown in the configurator's add to cart modal.
	 *
	 * @return void
	 */
	public function print_quote_templates() {
		$settings = mkl_pc( 'settings' );
		?>
		<script type="text/html" id="tmpl-mkl-pc-atq-adding" data-wg-notranslate>
			<div class="adding-to-cart--adding adding-to-quote--adding">
				<div class="header"><?php echo esc_html( $settings->get_label( 'adding_to_quote', __( 'Adding to your quote request', 'product-configurator-for-woocommerce' ) ) ); ?></div>
				<div class="spinner"></div>
			</div>
		</script>

		<script type="text/html" id="tmpl-mkl-pc-atq-added" data-wg-notranslate>
			<div class="adding-to-cart--added adding-to-quote--added has-box" role="status">
				<div class="header">
					<svg viewBox="0 0 300 300" aria-hidden="true"><circle cx="150" cy="150" r="116.61"/><polyline points="73.61 150 129.81 206.19 223.76 112.24"/></svg>
					<div class="title">
						<# if ( 'updated' === data.result ) { #>
							<?php echo esc_html( $settings->get_label( 'quote_updated_title', __( 'Quote request updated', 'product-configurator-for-woocommerce' ) ) ); ?>
						<# } else { #>
							<?php echo esc_html( $settings->get_label( 'quote_added_title', __( 'Added to your quote request', 'product-configurator-for-woocommerce' ) ) ); ?>
						<# } #>
					</div>
				</div>
				<div class="adding-to-quote--item">
					<# if ( data.image_url ) { #>
						<img class="adding-to-quote--image" src="{{ data.image_url }}" alt="">
					<# } #>
					<div class="adding-to-quote--details">
						<# if ( data.product_name ) { #><div class="adding-to-quote--name">{{ data.product_name }}</div><# } #>
						<# if ( 'updated' === data.result ) { #>
							<?php // "Added" is already the title; the update is the case that needs explaining. ?>
							<div class="messages">{{{ data.message }}}</div>
						<# } #>
					</div>
				</div>
				<div class="adding-to-cart--adding-cta">
					<button type="button" class="button continue-shopping keep-configuring"><?php echo esc_html( $settings->get_label( 'keep_configuring', __( 'Keep configuring', 'product-configurator-for-woocommerce' ) ) ); ?></button>
					<# if ( data.list_url ) { #>
						<span class="or"><?php esc_html_e( 'or', 'product-configurator-for-woocommerce' ); ?></span>
						<a href="{{ data.list_url }}" class="button view-quote-list"><?php echo esc_html( $this->get_yith_label( 'browse_list', __( 'Browse the list', 'yith-woocommerce-request-a-quote' ) ) ); ?><# if ( data.count ) { #> ({{ data.count }})<# } #></a>
					<# } #>
				</div>
				<?php do_action( 'tmpl-mkl-pc-atq-added' ); ?>
			</div>
		</script>

		<script type="text/html" id="tmpl-mkl-pc-atq-redirect" data-wg-notranslate>
			<div class="adding-to-cart--added-with-redirection adding-to-quote--redirect has-box" role="status">
				<div class="header"><?php echo esc_html_x( 'Done!', 'Part of message displayed when the product is successfully added to the quote request', 'product-configurator-for-woocommerce' ); ?></div>
				<p>{{{ data.message }}}</p>
				<div class="spinner"></div>
			</div>
		</script>
		<?php
	}

	/**
	 * The quote item a product went into, whichever key YITH gave it.
	 *
	 * Premium lets the key be filtered (ywraq_quote_item_id), so it is not always md5 of the ids: a
	 * new item is the key that was not there before, and one already in the list is found by its ids.
	 *
	 * @param int   $product_id   Parent product.
	 * @param int   $variation_id Variation, or 0.
	 * @param array $keys_before  List keys before the add.
	 * @return string|false
	 */
	private function find_item_key( $product_id, $variation_id, $keys_before ) {
		$content = YITH_Request_Quote()->raq_content;
		if ( ! is_array( $content ) ) return false;

		$new_keys = array_diff( array_keys( $content ), $keys_before );
		if ( 1 === count( $new_keys ) ) {
			return reset( $new_keys );
		}

		foreach ( $content as $key => $item ) {
			if ( ! is_array( $item ) || ! isset( $item['product_id'] ) || (int) $item['product_id'] !== (int) $product_id ) continue;
			$item_variation = isset( $item['variation_id'] ) ? (int) $item['variation_id'] : 0;
			if ( $item_variation === (int) $variation_id ) return $key;
		}
		return false;
	}

	/**
	 * Whether YITH would show its quote button for this product on its own page.
	 *
	 * Both versions decide from filters that read the global product: the "show on single page"
	 * option and exclusion list, and in Premium the user roles and the out-of-stock rules. Asking them
	 * keeps the configurator's button in step with YITH's without YITH's button being on the page.
	 *
	 * @param \WC_Product $quote_product Parent product.
	 * @return bool
	 */
	public function can_quote_product( $quote_product ) {
		if ( ! $quote_product || ! is_a( $quote_product, 'WC_Product' ) ) return false;

		global $product;
		$previous = $product;
		$product  = $quote_product; // phpcs:ignore WordPress.WP.GlobalVariablesOverride.Prohibited -- YITH's filters read the global product.

		$show = apply_filters( 'yith_ywraq-show_btn_single_page', 'yes' ); // phpcs:ignore WordPress.NamingConventions.ValidHookName.UseUnderscores -- YITH's hook name.
		$show = ( true === $show || 'yes' === $show || '1' === $show || 1 === $show );
		if ( $show ) {
			$show = (bool) apply_filters( 'yith_ywraq_before_print_button', true, $quote_product );
		}

		$product = $previous; // phpcs:ignore WordPress.WP.GlobalVariablesOverride.Prohibited -- Restoring what was borrowed above.

		/**
		 * Filter whether the configurator offers "Add to quote" for a product.
		 *
		 * @param bool        $show    Whether the button shows.
		 * @param \WC_Product $product Product.
		 */
		return (bool) apply_filters( 'mkl_pc/yith-raq/can_quote_product', $show, $quote_product );
	}

	/**
	 * Whether a posted configuration can be read, the rule the cart uses.
	 *
	 * @param string $raw_configurator_data Posted payload.
	 * @return bool
	 */
	private function is_valid_payload( $raw_configurator_data ) {
		if ( ! is_string( $raw_configurator_data ) || '' === $raw_configurator_data ) {
			return (bool) mkl_pc( 'settings' )->get( 'enable_default_add_to_cart' );
		}
		return null !== mkl_pc( 'frontend' )->cart->decode_configurator_payload( $raw_configurator_data );
	}

	/**
	 * YITH's generic "could not add" message.
	 *
	 * @return string
	 */
	private function ajax_error_message() {
		return apply_filters( 'yith_ywraq_error_adding_to_list_message', __( 'Error occurred while adding product to Request a Quote list.', 'yith-woocommerce-request-a-quote' ) );
	}

	/**
	 * Store a configuration on a quote item: the raw payload, the layers, the display data, the
	 * extra price and, for 3D, the viewer's picture.
	 *
	 * Replaces whatever configuration the item had.
	 *
	 * @param string $item_id               Quote item key.
	 * @param string $raw_configurator_data Posted payload, JSON or URL-encoded JSON.
	 * @param string $screenshot            PNG data URL from the viewer, or ''.
	 * @return bool False when the item is missing or the payload cannot be read.
	 */
	public function attach_configuration( $item_id, $raw_configurator_data, $screenshot = '' ) {
		$rq = YITH_Request_Quote();
		if ( ! isset( $rq->raq_content[ $item_id ] ) || ! is_string( $raw_configurator_data ) ) {
			return false;
		}
		$raq = $rq->raq_content[ $item_id ];

		// Same decoding as the cart, including the URL-encoded payloads YITH Premium posts.
		$data = mkl_pc( 'frontend' )->cart->decode_configurator_payload( $raw_configurator_data );
		if ( null === $data ) {
			return false;
		}
		$data = mkl_pc( 'db' )->sanitize( $data );
		// Stored normalized, so every later reader (reopening the configurator, the order
		// copy) decodes plain JSON rather than whatever encoding the browser posted.
		$rq->raq_content[ $item_id ][ 'pc_configurator_data_raw' ] = wp_json_encode( $data );

		// A 3D configuration has no layer images to merge, so the quote shows the picture the
		// viewer took, as the cart does. Stored under the key the order code reads, so accepting
		// the quote carries it over.
		if ( mkl_pc( 'settings' )->get( 'show_image_in_cart' ) && is_string( $screenshot ) && '' !== $screenshot ) {
			$screenshot_path = mkl_pc( 'frontend' )->cart->save_3d_screenshot_to_temp( $screenshot );
			if ( $screenshot_path ) {
				$rq->raq_content[ $item_id ][ 'configurator_3d_screenshot_path' ] = $screenshot_path;
			}
		}
		$layers = array();
		$product_id = $raq['product_id'];
		$variation_id = isset( $raq['variation_id'] ) ? $raq['variation_id'] : 0;
		$ep = 0;
		if ( is_array( $data ) ) { 
			foreach( $data as $layer_data ) {
				// A payload is only an array of choices by convention; anything else in it is not one.
				if ( ! is_object( $layer_data ) || ! isset( $layer_data->layer_id, $layer_data->choice_id ) ) {
					continue;
				}
				$angle_id = isset( $layer_data->angle_id ) ? $layer_data->angle_id : 0;
				$choice = new \MKL\PC\Choice( $product_id, $variation_id, $layer_data->layer_id, $layer_data->choice_id, $angle_id, $layer_data );
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
		// YITH Free HTML email only outputs item meta when `variations` is set.
		// Simple products have no variation attributes; use an empty array as a flag only.
		// Do not copy configurator display data into `variations` — variable products already
		// use that array for WC attributes, and duplicating config there causes double output.
		if ( empty( $variation_id ) && ! isset( $rq->raq_content[ $item_id ]['variations'] ) ) {
			$rq->raq_content[ $item_id ]['variations'] = array();
		}
		do_action_ref_array( 'mkl_pc/yith-raq/added_product', array( &$rq->raq_content, $item_id, $layers ) );
		$rq->set_session( $rq->raq_content );
		return true;
	}

	/**
	 * Refuse an add to quote whose configuration is missing or unreadable, the rule the cart uses.
	 *
	 * Both YITH versions run this filter before adding the item. yith_raq_updated() only fires
	 * afterwards, where the item can no longer be refused, so a broken payload used to leave an
	 * unconfigured item in the quote with no error.
	 *
	 * @param bool $is_valid   Whether YITH may add the item.
	 * @param int  $product_id Product being added.
	 * @return bool
	 */
	public function validate_add_to_quote( $is_valid, $product_id ) {
		if ( ! $is_valid ) {
			return $is_valid;
		}
		$variation_id = isset( $_POST['variation_id'] ) ? absint( wp_unslash( $_POST['variation_id'] ) ) : 0; // phpcs:ignore WordPress.Security.NonceVerification.Missing -- YITH verifies its own add-to-quote nonce before this filter.
		if ( ! mkl_pc_is_configurable( $product_id ) && ! ( $variation_id && mkl_pc_is_configurable( $variation_id ) ) ) {
			return $is_valid;
		}

		$raw_configurator_data = isset( $_POST['pc_configurator_data'] ) ? wp_unslash( $_POST['pc_configurator_data'] ) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Missing, WordPress.Security.ValidatedSanitizedInput.InputNotSanitized -- Same YITH nonce; JSON is decoded then sanitized in yith_raq_updated().
		if ( ! is_string( $raw_configurator_data ) || '' === $raw_configurator_data ) {
			return (bool) mkl_pc( 'settings' )->get( 'enable_default_add_to_cart' );
		}

		return null !== mkl_pc( 'frontend' )->cart->decode_configurator_payload( $raw_configurator_data );
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
	/**
	 * Settings that only mean anything with a quote plugin installed.
	 *
	 * @param \MKL\PC\Admin_Settings $settings_page Page registering the fields.
	 * @return void
	 */
	public function register_settings( $settings_page ) {
		if ( ! $settings_page || ! is_callable( array( $settings_page, 'callback_select' ) ) ) {
			return;
		}

		add_settings_field(
			'quote_image_retention',
			__( 'Keep 3D quote images for', 'product-configurator-for-woocommerce' ),
			array( $settings_page, 'callback_select' ),
			'mlk_pc_settings',
			'general_settings',
			array(
				'options' => array(
					'7'     => __( '7 days', 'product-configurator-for-woocommerce' ),
					'30'    => __( '30 days', 'product-configurator-for-woocommerce' ),
					'90'    => __( '90 days', 'product-configurator-for-woocommerce' ),
					'365'   => __( 'One year', 'product-configurator-for-woocommerce' ),
					'never' => __( 'Forever', 'product-configurator-for-woocommerce' ),
				),
				'default' => '30',
				'setting_name' => 'quote_image_retention',
				'description' => __( 'A quote sent by email keeps the 3D configuration image for this long. Images for carts and quotes still being put together follow the WooCommerce session lifetime instead.', 'product-configurator-for-woocommerce' ),
			)
		);

		add_settings_field(
			'attach_config_image_to_quote_email',
			__( 'Attach the configuration image to quote request emails', 'product-configurator-for-woocommerce' ),
			array( $settings_page, 'callback_checkbox' ),
			'mlk_pc_settings',
			'general_settings',
			array(
				'setting_name' => 'attach_config_image_to_quote_email',
				'description' => __( 'The image travels with the email, so it stays readable however long the request takes to answer. 3D configurators only: a 2D configuration has no image file to attach.', 'product-configurator-for-woocommerce' ),
			)
		);
	}

	/**
	 * Keep the picture of a sent quote alive past the session that made it.
	 *
	 * Hooked to the request email (and to ywraq_process for order mode), so it runs whichever way the
	 * shop is set up, while the list is still there. Safe to run more than once: a picture already
	 * moved - to orders/ by Frontend_Order::save_data(), or to quotes/ by an earlier call - has no
	 * cart-temp source left, and move_3d_screenshot_to_quotes() returns false for it.
	 *
	 * @param array $args Quote request arguments, including raq_content.
	 * @return void
	 */
	public function promote_quote_screenshots( $args ) {
		unset( $args );
		$rq = YITH_Request_Quote();
		if ( ! $rq || empty( $rq->raq_content ) || ! is_array( $rq->raq_content ) ) {
			return;
		}

		$raq_content = $rq->raq_content;
		$moved       = false;
		foreach ( $raq_content as $item_key => $item ) {
			if ( ! is_array( $item ) || empty( $item['configurator_3d_screenshot_path'] ) ) {
				continue;
			}
			$new_path = mkl_pc( 'frontend' )->cart->move_3d_screenshot_to_quotes( $item['configurator_3d_screenshot_path'], $item_key );
			if ( $new_path ) {
				$raq_content[ $item_key ]['configurator_3d_screenshot_path'] = $new_path;
				$moved = true;
			}
		}

		if ( $moved ) {
			// The email re-reads the live list, so both the object and the session have to know.
			$rq->raq_content = $raq_content;
			$rq->set_session( $raq_content );
		}
	}

	/**
	 * Attach the configuration pictures to the request email, when the shop asks for it.
	 *
	 * The list is cleared once the mail is sent, so an attachment is what the merchant keeps -
	 * it survives whatever the quote retention setting later sweeps.
	 *
	 * @param array    $attachments Absolute file paths.
	 * @param string   $email_id    Email being sent.
	 * @param mixed    $object      Email object (unused: YITH keeps the quote on the email itself).
	 * @param WC_Email $email       Email instance.
	 * @return array
	 */
	public function attach_quote_images( $attachments, $email_id, $object = null, $email = null ) {
		unset( $object );
		if ( ! in_array( $email_id, array( 'ywraq_email', 'ywraq_email_customer' ), true ) ) {
			return $attachments;
		}
		if ( ! mkl_pc( 'settings' )->get( 'attach_config_image_to_quote_email' ) ) {
			return $attachments;
		}
		// The email holds a snapshot of the list taken before this request's hooks ran, so its paths
		// can already be stale: promote_quote_screenshots() moves the file into quotes/ moments
		// earlier, and YITH Premium's trigger() keeps that snapshot instead of re-reading the list.
		// Prefer the live list, which has the promoted paths; fall back to the snapshot.
		$items = array();
		if ( function_exists( 'YITH_Request_Quote' ) ) {
			$rq = YITH_Request_Quote();
			if ( $rq && ! empty( $rq->raq_content ) && is_array( $rq->raq_content ) ) {
				$items = $rq->raq_content;
			}
		}
		if ( empty( $items ) && $email && ! empty( $email->raq['raq_content'] ) && is_array( $email->raq['raq_content'] ) ) {
			$items = $email->raq['raq_content'];
		}
		if ( empty( $items ) ) {
			return $attachments;
		}

		$base_dir = wp_upload_dir()['basedir'] . '/mkl-pc-config-images';
		foreach ( $items as $item ) {
			if ( ! is_array( $item ) || empty( $item['configurator_3d_screenshot_path'] ) ) {
				continue;
			}
			$relative = trim( (string) $item['configurator_3d_screenshot_path'], '/' );
			if ( false !== strpos( $relative, '..' ) ) {
				continue;
			}
			$path = $base_dir . '/' . $relative;
			if ( is_file( $path ) && ! in_array( $path, $attachments, true ) ) {
				$attachments[] = $path;
			}
		}

		return $attachments;
	}

	public function item_image( $item_image, $raq ) {
		if ( ! mkl_pc( 'settings' )->get( 'show_image_in_cart' ) ) return $item_image;

		// Prefer the viewer's picture: a 3D configuration has no layer images to merge below.
		if ( ! empty( $raq['configurator_3d_screenshot_path'] ) && is_string( $raq['configurator_3d_screenshot_path'] ) ) {
			$screenshot_url = mkl_pc( 'frontend' )->cart->get_3d_screenshot_url( $raq['configurator_3d_screenshot_path'] );
			if ( $screenshot_url ) {
				return '<img src="' . esc_url( $screenshot_url ) . '" alt="" class="attachment-woocommerce_thumbnail" />';
			}
		}
		if ( isset( $raq['pc_layers'] ) ) {
			$configurator_data = $raq['pc_layers'];
			$choices = array(); 
			$configurator_data = \MKL\PC\Utils::sort_layers_for_merging( $configurator_data );
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
	
	/**
	 * Add the Add to quote button
	 */
	public function add_add_to_quote_button() {
		if ( ! function_exists( 'ywraq_get_label' ) ) return;

		// The same product configurator_form() prints the form for, a shortcode's included.
		global $product, $mkl_product;
		$quote_product = $product;
		if ( ! is_a( $quote_product, 'WC_Product' ) && is_a( $mkl_product, 'WC_Product' ) ) {
			$quote_product = $mkl_product;
		}
		if ( ! is_a( $quote_product, 'WC_Product' ) ) {
			$quote_product = wc_get_product();
		}
		// With no product to ask about, the button stays: ajax_add_to_quote() checks again anyway.
		if ( is_a( $quote_product, 'WC_Product' ) && ! $this->can_quote_product( $quote_product ) ) return;

		$frontend = mkl_pc( 'frontend' )->product;
		?>
		<button type="button" class="<?php echo esc_attr( $frontend->button_class ); ?> yith-raq add-to-quote">
			<span><?php echo esc_html( \ywraq_get_label( 'btn_link_text' ) ); ?></span>
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
		$context = isset( $_REQUEST['context'] ) ? sanitize_key( wp_unslash( $_REQUEST['context'] ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Query flags to preload a quote configuration in the configurator.
		if ( $config_data || ! isset( $_REQUEST['load_config_from_cart'], $_REQUEST['context'] ) || 'configuration_to_yithraq' !== $context ) return $config_data; // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Same as above.
		$rq = YITH_Request_Quote();
		$item_id = sanitize_text_field( wp_unslash( $_REQUEST['load_config_from_cart'] ) );
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

	/**
	 * Restore configurator data when YITH copies quote order items back to the cart.
	 *
	 * Runs before woocommerce_add_to_cart_validation during quote acceptance.
	 *
	 * @param array                $cart_item_data Cart item data.
	 * @param \WC_Order_Item|false $item           Order line item.
	 * @param \WC_Order            $order          Quote order.
	 * @return array
	 */
	public function order_cart_item_data( $cart_item_data, $item, $order ) {
		return mkl_pc( 'frontend' )->cart->restore_configuration_cart_item_data_from_order_item( $cart_item_data, $item );
	}

}

return new Compat_Yith_Raq();