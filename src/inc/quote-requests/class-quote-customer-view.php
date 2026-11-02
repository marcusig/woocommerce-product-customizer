<?php
namespace MKL\PC;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Where customers see the quote requests kept as posts, without WooCommerce or an account
 *
 * A page holding the [mkl_pc_quotes] shortcode (the "Customer page" setting, created when first needed)
 * shows:
 * - one request, to whoever has its link: the customer emails carry it, with the request's secret key;
 * - the requests linked to the signed-in customer's account;
 * - to a visitor, a form that emails the links of the requests sent with an address ("Find my requests").
 *   It answers the same whether there are requests or not, so nobody learns which addresses sent some.
 * Other places (WooCommerce's My account) show the same templates through render_list() / render_request().
 *
 * The page is personal: never cached, never indexed. Templates can be overridden in
 * yourtheme/product-configurator/quotes/.
 */
class Quote_Customer_View {

	const SHORTCODE = 'mkl_pc_quotes';

	const REFERENCE_VAR = 'quote_request';

	const KEY_VAR = 'key';

	const LOOKUP_ACTION = 'mkl_pc_quote_lookup';

	/**
	 * Requests whose links one address can be sent in an hour, whoever asks.
	 */
	const LOOKUP_PER_EMAIL = 3;

	/**
	 * @var array|null What the lookup form's submission gave: status (sent, invalid, limited), email.
	 */
	private $lookup = null;

	/**
	 * @var CPT_Store
	 */
	private $store;

	public function __construct( CPT_Store $store ) {
		$this->store = $store;
		add_shortcode( self::SHORTCODE, [ $this, 'shortcode' ] );
		add_action( 'template_redirect', [ $this, 'no_cache' ] );
		add_action( 'template_redirect', [ $this, 'handle_lookup' ], 20 );
		// In the head on the customer page; elsewhere (My account) when the view renders.
		add_action( 'wp_enqueue_scripts', function() {
			if ( $this->is_customer_page() ) $this->enqueue();
		} );
		add_filter( 'wp_robots', [ $this, 'no_robots' ] );
	}

	/**
	 * The customer page
	 *
	 * @param boolean $create Make it when there is none.
	 * @return int 0 without one.
	 */
	public function get_page_id( $create = false ) {
		$page_id = (int) mkl_pc( 'settings' )->get( 'quote_request_page' );
		if ( $page_id && 'publish' === get_post_status( $page_id ) ) return $page_id;
		if ( ! $create ) return 0;

		$page_id = wp_insert_post( [
			'post_type'    => 'page',
			'post_status'  => 'publish',
			'post_title'   => __( 'Quote request', 'product-configurator-for-woocommerce' ),
			'post_content' => '<!-- wp:shortcode -->[' . self::SHORTCODE . ']<!-- /wp:shortcode -->',
			'post_author'  => 0,
		] );
		if ( ! $page_id || is_wp_error( $page_id ) ) return 0;
		mkl_pc( 'settings' )->set( 'quote_request_page', $page_id );
		return (int) $page_id;
	}

	/**
	 * The link to one request, for its customer
	 *
	 * @param Quote_Request $request
	 * @return string
	 */
	public function get_request_url( Quote_Request $request ) {
		$page_id = $this->get_page_id( true );
		$key = $this->store->get_access_key( $request );
		if ( ! $page_id || ! $key || ! $request->reference ) return '';
		return add_query_arg( [
			self::REFERENCE_VAR => rawurlencode( $request->reference ),
			self::KEY_VAR       => $key,
		], get_permalink( $page_id ) );
	}

	/**
	 * Whether the current visitor may see a request
	 *
	 * With its key, or as the account it is linked to. Merchants who can edit it see it too.
	 *
	 * @param Quote_Request $request
	 * @param string        $key
	 * @return boolean
	 */
	public function can_view( Quote_Request $request, $key = '' ) {
		if ( '' !== $key && '' !== $request->access_key && hash_equals( $request->access_key, (string) $key ) ) return true;
		if ( $request->user_id && get_current_user_id() === $request->user_id ) return true;
		return current_user_can( 'edit_post', $request->id );
	}

	/**
	 * @return boolean
	 */
	public function is_customer_page() {
		$page_id = $this->get_page_id();
		return $page_id && is_page( $page_id );
	}

	/**
	 * Requests are personal: caches must not keep the page
	 *
	 * @return void
	 */
	public function no_cache() {
		if ( ! $this->is_customer_page() ) return;
		nocache_headers();
		if ( ! defined( 'DONOTCACHEPAGE' ) ) define( 'DONOTCACHEPAGE', true );
	}

	/**
	 * @param array $robots
	 * @return array
	 */
	public function no_robots( $robots ) {
		return $this->is_customer_page() ? wp_robots_no_robots( $robots ) : $robots;
	}

	/**
	 * [mkl_pc_quotes]: the request of the link, or the signed-in customer's requests
	 *
	 * @return string
	 */
	public function shortcode() {
		// phpcs:disable WordPress.Security.NonceVerification.Recommended -- The key is the authorization.
		$reference = isset( $_GET[ self::REFERENCE_VAR ] ) ? sanitize_text_field( wp_unslash( $_GET[ self::REFERENCE_VAR ] ) ) : '';
		$key = isset( $_GET[ self::KEY_VAR ] ) ? sanitize_text_field( wp_unslash( $_GET[ self::KEY_VAR ] ) ) : '';
		// phpcs:enable
		$this->enqueue();

		if ( '' !== $reference ) {
			$request = $this->store->get_by_reference( $reference );
			if ( ! $request || ! $this->can_view( $request, $key ) ) {
				return $this->render( 'quotes/quote-not-found.php', [ 'list_url' => is_user_logged_in() ? get_permalink( $this->get_page_id() ) : '' ] );
			}
			return $this->render_request( $request, is_user_logged_in() && $request->user_id === get_current_user_id() ? get_permalink( $this->get_page_id() ) : '', $key );
		}

		return $this->render_list( get_current_user_id(), function( $request ) {
			return add_query_arg( self::REFERENCE_VAR, rawurlencode( $request->reference ), get_permalink( $this->get_page_id() ) );
		} );
	}

	/**
	 * A customer's requests
	 *
	 * @param int      $user_id  0 for a visitor: they are told to use the link of their email, or to sign in.
	 * @param callable $url_for  The link to a request in this list.
	 * @return string
	 */
	public function render_list( $user_id, $url_for ) {
		return $this->render( 'quotes/quotes.php', [
			'requests'    => $this->store->get_user_requests( $user_id ),
			'signed_in'   => (bool) $user_id,
			'login_url'   => wp_login_url( get_permalink() ),
			'url_for'     => $url_for,
			'lookup_form' => $user_id ? '' : $this->render( 'quotes/quote-lookup.php', [ 'lookup' => $this->lookup, 'button_class' => $this->get_button_class() ] ),
			'view'        => $this,
		] );
	}

	/**
	 * One request
	 *
	 * @param Quote_Request $request
	 * @param string        $back_url The list it was opened from, or ''.
	 * @param string        $key      The request's key, when the visitor came with its link.
	 * @return string
	 */
	public function render_request( Quote_Request $request, $back_url = '', $key = '' ) {
		$sent = (int) get_post_meta( $request->id, '_mkl_pc_quote_sent', true );
		$price = null;
		$price_label = '';
		if ( function_exists( 'wc_price' ) ) {
			if ( $sent && null !== $request->get_line_price() ) {
				$price = $request->get_line_price();
				$price_label = __( 'Price', 'product-configurator-for-woocommerce' );
			} elseif ( mkl_pc( 'quotes' )->show_prices() && is_array( $request->price ) && isset( $request->price['line_total'] ) ) {
				$price = (float) $request->price['line_total'];
				$price_label = __( 'Estimated price', 'product-configurator-for-woocommerce' );
			}
		}
		return $this->render( 'quotes/quote.php', [
			'request'      => $request,
			'status'       => $this->get_status_label( $request ),
			'sent'         => $sent,
			'sent_message' => $sent ? (string) get_post_meta( $request->id, '_mkl_pc_quote_sent_message', true ) : '',
			'price'        => $price,
			'price_label'  => $price_label,
			'show_image'   => 'none' !== mkl_pc( 'quotes' )->get_image_mode(),
			'back_url'     => $back_url,
			'answer_form'  => mkl_pc( 'quotes' )->customer_actions->render( $request, $key, $this ),
			'view'         => $this,
		] );
	}

	/**
	 * "Find my requests": email the links of the requests sent with an address
	 *
	 * Whatever was found, the visitor reads the same answer. A visitor asks a few times an hour, and an
	 * address gets a few emails an hour, whoever asks.
	 *
	 * @return void
	 */
	public function handle_lookup() {
		if ( 'POST' !== ( isset( $_SERVER['REQUEST_METHOD'] ) ? $_SERVER['REQUEST_METHOD'] : '' ) || ! isset( $_POST[ self::LOOKUP_ACTION ] ) || ! $this->is_customer_page() ) return; // phpcs:ignore WordPress.Security.ValidatedSanitizedInput, WordPress.Security.NonceVerification.Missing -- Checked below.
		$email = isset( $_POST['email'] ) ? sanitize_email( wp_unslash( $_POST['email'] ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Missing -- Checked below.
		$this->lookup = [ 'status' => 'sent', 'email' => $email ];

		if ( ! isset( $_POST['_wpnonce'] ) || ! wp_verify_nonce( sanitize_key( wp_unslash( $_POST['_wpnonce'] ) ), self::LOOKUP_ACTION ) ) {
			$this->lookup['status'] = 'expired';
			return;
		}
		// Filled by bots only: they read the usual answer.
		if ( ! empty( $_POST['website'] ) ) return;
		if ( ! is_email( $email ) ) {
			$this->lookup['status'] = 'invalid';
			return;
		}
		$security = mkl_pc( 'frontend_security' );
		if ( $security && is_wp_error( $security->enforce_rate_limit( self::LOOKUP_ACTION ) ) ) {
			$this->lookup['status'] = 'limited';
			return;
		}

		$throttle = 'mkl_pc_quote_lookup_' . md5( strtolower( $email ) );
		$sent = (int) get_transient( $throttle );
		if ( $sent >= self::LOOKUP_PER_EMAIL ) return;

		$requests = array_values( array_filter( array_map( [ $this->store, 'load' ], $this->store->get_request_ids_by_email( [ $email ] ) ) ) );
		if ( ! $requests ) return;
		set_transient( $throttle, $sent + 1, HOUR_IN_SECONDS );
		mkl_pc( 'mailer' )->send( 'mkl_pc_quote_request_lookup', $email, [ 'requests' => $requests ] );
	}

	/**
	 * The configurator's button classes (setting), which themes style
	 *
	 * @return string
	 */
	public function get_button_class() {
		$classes = mkl_pc( 'settings' )->get( 'mkl_pc__button_classes' );
		return $classes ? Utils::sanitize_html_classes( $classes ) : 'primary button btn btn-primary wp-element-button';
	}

	/**
	 * A request's status, as the customer reads it
	 *
	 * @param Quote_Request $request
	 * @return string
	 */
	public function get_status_label( Quote_Request $request ) {
		$labels = [
			'mkl_quote_new'      => _x( 'Received', 'Quote request status, for the customer', 'product-configurator-for-woocommerce' ),
			'mkl_quote_progress' => _x( 'In progress', 'Quote request status, for the customer', 'product-configurator-for-woocommerce' ),
			'mkl_quote_answered' => _x( 'Answered', 'Quote request status, for the customer', 'product-configurator-for-woocommerce' ),
			'mkl_quote_accepted' => _x( 'Accepted', 'Quote request status, for the customer', 'product-configurator-for-woocommerce' ),
			'mkl_quote_declined' => _x( 'Declined', 'Quote request status, for the customer', 'product-configurator-for-woocommerce' ),
			'mkl_quote_closed'   => _x( 'Closed', 'Quote request status, for the customer', 'product-configurator-for-woocommerce' ),
		];
		/**
		 * The statuses of quote requests, as customers read them
		 *
		 * @param array         $labels  Keyed by post status.
		 * @param Quote_Request $request
		 */
		$labels = apply_filters( 'mkl_pc/quote_request/customer_status_labels', $labels, $request );
		return isset( $labels[ $request->status ] ) ? $labels[ $request->status ] : '';
	}

	/**
	 * A template, from the theme (yourtheme/product-configurator/...) or the plugin
	 *
	 * @param string $template Path under inc/templates.
	 * @param array  $args
	 * @return string
	 */
	public function render( $template, $args = [] ) {
		$file = locate_template( 'product-configurator/' . $template );
		if ( ! $file ) $file = MKL_PC_INCLUDE_PATH . 'templates/' . $template;
		/**
		 * The file of a customer quote template
		 *
		 * @param string $file
		 * @param string $template
		 * @param array  $args
		 */
		$file = apply_filters( 'mkl_pc/quote_request/customer_template', $file, $template, $args );
		if ( ! is_file( $file ) ) return '';
		ob_start();
		( function() use ( $file, $args ) {
			extract( $args, EXTR_SKIP ); // phpcs:ignore WordPress.PHP.DontExtract.extract_extract -- Template variables.
			include $file;
		} )();
		return ob_get_clean();
	}

	/**
	 * A few styles, which themes can override
	 *
	 * @return void
	 */
	public function enqueue() {
		if ( wp_style_is( 'mkl_pc/css/quotes', 'enqueued' ) ) return;
		wp_register_style( 'mkl_pc/css/quotes', false, [], MKL_PC_VERSION );
		wp_enqueue_style( 'mkl_pc/css/quotes' );
		wp_add_inline_style( 'mkl_pc/css/quotes', '
.mkl-pc-quotes__table { width: 100%; border-collapse: collapse; }
.mkl-pc-quotes__table th, .mkl-pc-quotes__table td { padding: .6em .5em; text-align: left; border-bottom: 1px solid rgba(0,0,0,.1); }
.mkl-pc-quote__meta { opacity: .75; }
.mkl-pc-quote__status { display: inline-block; padding: .1em .6em; border-radius: 1em; background: rgba(0,0,0,.06); font-size: .9em; white-space: nowrap; }
.mkl-pc-quote__summary { display: flex; flex-wrap: wrap; gap: 1.5em; align-items: flex-start; margin: 1.5em 0; }
.mkl-pc-quote__image img { width: 200px; max-width: 100%; height: auto; display: block; }
.mkl-pc-quote__configuration { flex: 1 1 260px; }
.mkl-pc-quote__price { font-size: 1.15em; margin-top: 1em; }
.mkl-pc-quote__message { padding: 1em 1.2em; margin: 1.5em 0; border-left: 3px solid currentColor; background: rgba(0,0,0,.03); }
.mkl-pc-quote__message p:last-child { margin-bottom: 0; }
.mkl-pc-quote-lookup { margin-top: 2em; max-width: 36em; }
.mkl-pc-quote-lookup label { display: block; margin-bottom: .35em; font-weight: 600; }
.mkl-pc-quote-lookup__row { display: flex; flex-wrap: wrap; gap: .5em; align-items: stretch; }
.mkl-pc-quote-lookup__row input[type=email] { flex: 1 1 16em; box-sizing: border-box; min-height: 44px; margin: 0; padding: 10px 12px; border: 1px solid rgba(0,0,0,.22); border-radius: 8px; background: #fff; box-shadow: none; color: inherit; font: inherit; line-height: 1.4; }
.mkl-pc-quote-lookup__row input[type=email]:hover { border-color: rgba(0,0,0,.4); }
.mkl-pc-quote-lookup__row input[type=email]:focus { border-color: var(--mkl_pc_color-primary, #2a2a2a); outline: 2px solid var(--mkl_pc_color-primary, #2a2a2a); outline-offset: -1px; }
.mkl-pc-quote-lookup__row input[aria-invalid=true] { border-color: #b32d2e; }
.mkl-pc-quote-lookup__row button { min-height: 44px; margin: 0; }
.mkl-pc-quote-lookup__website { position: absolute; left: -9999px; }
.mkl-pc-quote-lookup__notice { padding: .8em 1em; margin: 1em 0; background: rgba(0,0,0,.04); }
.mkl-pc-quote-lookup__notice.is-error { border-left: 3px solid #b32d2e; }
.mkl-pc-quote-answer { margin: 2em 0; max-width: 36em; }
.mkl-pc-quote-answer form { margin: 0 0 1em; }
.mkl-pc-quote-answer__more { margin: 1em 0; }
.mkl-pc-quote-answer__more summary { cursor: pointer; font-weight: 600; }
.mkl-pc-quote-answer__more form { margin-top: .75em; }
.mkl-pc-quote-answer label { display: block; margin-bottom: .35em; }
.mkl-pc-quote-answer textarea { display: block; width: 100%; box-sizing: border-box; margin: 0 0 .75em; padding: 10px 12px; border: 1px solid rgba(0,0,0,.22); border-radius: 8px; background: #fff; color: inherit; font: inherit; line-height: 1.4; }
.mkl-pc-quote-answer textarea:focus { border-color: var(--mkl_pc_color-primary, #2a2a2a); outline: 2px solid var(--mkl_pc_color-primary, #2a2a2a); outline-offset: -1px; }
.mkl-pc-quote-answer textarea[aria-invalid=true] { border-color: #b32d2e; }
.mkl-pc-quote-answer button, .mkl-pc-quote-answer .button { min-height: 44px; margin: 0; }
.mkl-pc-quote-answer__notice { padding: .8em 1em; margin: 0 0 1em; background: rgba(0,0,0,.04); }
.mkl-pc-quote-answer__notice.is-error { border-left: 3px solid #b32d2e; }' );
	}
}
