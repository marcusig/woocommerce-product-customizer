<?php
namespace MKL\PC;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * WooCommerce My account: a "Quote requests" tab, with the customer's requests kept as posts
 *
 * The same view as the customer page (Quote_Customer_View): the list, and one request at
 * my-account/quote-requests/{reference}/. Not `quotes`, which quote plugins (YITH) use.
 * Quotes kept as WooCommerce orders are under Orders.
 */
class Quote_Account_Tab {

	/**
	 * @var Quote_Customer_View
	 */
	private $view;

	/**
	 * @var CPT_Store
	 */
	private $store;

	public function __construct( Quote_Customer_View $view, CPT_Store $store ) {
		$this->view = $view;
		$this->store = $store;
		add_filter( 'woocommerce_get_query_vars', [ $this, 'query_vars' ] );
		add_action( 'wp_loaded', [ $this, 'maybe_flush_rewrite_rules' ] );
		add_filter( 'woocommerce_account_menu_items', [ $this, 'menu_items' ] );
		add_action( 'woocommerce_account_' . $this->get_endpoint() . '_endpoint', [ $this, 'render' ] );
		add_filter( 'woocommerce_endpoint_' . $this->get_endpoint() . '_title', [ $this, 'title' ], 10, 2 );
	}

	/**
	 * @return string
	 */
	public function get_endpoint() {
		/**
		 * The My account endpoint of quote requests
		 *
		 * @param string $endpoint
		 */
		return (string) apply_filters( 'mkl_pc/quote_request/account_endpoint', 'quote-requests' );
	}

	/**
	 * @param array $vars
	 * @return array
	 */
	public function query_vars( $vars ) {
		$vars[ $this->get_endpoint() ] = $this->get_endpoint();
		return $vars;
	}

	/**
	 * The endpoint's rewrite rule, once: WooCommerce registers it, but rules are only rebuilt on a flush
	 *
	 * @return void
	 */
	public function maybe_flush_rewrite_rules() {
		$rules = get_option( 'rewrite_rules' );
		// Plain permalinks have no rules, and use the query var.
		if ( ! is_array( $rules ) || empty( $rules ) ) return;
		$endpoint = preg_quote( $this->get_endpoint(), '#' );
		foreach ( array_keys( $rules ) as $rule ) {
			if ( preg_match( '#(^|/)' . $endpoint . '\(#', $rule ) ) return;
		}
		flush_rewrite_rules( false );
	}

	/**
	 * Whether the tab is shown: when requests are kept as posts, or the customer has some from before
	 *
	 * @return boolean
	 */
	public function is_shown() {
		$quotes = mkl_pc( 'quotes' );
		$shown = ( $quotes->is_enabled() && 'cpt' === $quotes->get_store()->get_id() ) || $this->store->count_user_requests( get_current_user_id() ) > 0;
		/**
		 * Whether My account shows the Quote requests tab
		 *
		 * @param boolean $shown
		 */
		return (bool) apply_filters( 'mkl_pc/quote_request/show_account_tab', $shown );
	}

	/**
	 * After Orders
	 *
	 * @param array $items
	 * @return array
	 */
	public function menu_items( $items ) {
		if ( ! is_user_logged_in() || ! $this->is_shown() ) return $items;
		$label = __( 'Quote requests', 'product-configurator-for-woocommerce' );
		$new = [];
		foreach ( $items as $key => $item ) {
			$new[ $key ] = $item;
			if ( 'orders' === $key ) $new[ $this->get_endpoint() ] = $label;
		}
		if ( ! isset( $new[ $this->get_endpoint() ] ) ) {
			$new = array_slice( $items, 0, 1, true ) + [ $this->get_endpoint() => $label ] + array_slice( $items, 1, null, true );
		}
		return $new;
	}

	/**
	 * The list, or one request
	 *
	 * @param string $reference The endpoint's value.
	 * @return void
	 */
	public function render( $reference = '' ) {
		$this->view->enqueue();
		$list_url = wc_get_account_endpoint_url( $this->get_endpoint() );
		if ( '' !== (string) $reference ) {
			$request = $this->store->get_by_reference( rawurldecode( (string) $reference ) );
			// Signed in, the account is the access: no key.
			if ( ! $request || ! $request->user_id || get_current_user_id() !== $request->user_id ) {
				echo $this->view->render( 'quotes/quote-not-found.php', [ 'list_url' => $list_url ] ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Escaped in the template.
				return;
			}
			echo $this->view->render_request( $request, $list_url ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Escaped in the template.
			return;
		}
		echo $this->view->render_list( get_current_user_id(), [ $this, 'get_request_url' ] ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Escaped in the template.
	}

	/**
	 * A request in the tab, with pretty or plain permalinks
	 *
	 * @param Quote_Request $request
	 * @return string
	 */
	public function get_request_url( Quote_Request $request ) {
		return wc_get_endpoint_url( $this->get_endpoint(), rawurlencode( $request->reference ), wc_get_page_permalink( 'myaccount' ) );
	}

	/**
	 * @param string $title
	 * @param string $endpoint
	 * @return string
	 */
	public function title( $title, $endpoint = '' ) {
		global $wp;
		$reference = isset( $wp->query_vars[ $this->get_endpoint() ] ) ? sanitize_text_field( $wp->query_vars[ $this->get_endpoint() ] ) : '';
		/* translators: %s: quote request reference */
		return '' !== $reference ? sprintf( __( 'Quote request %s', 'product-configurator-for-woocommerce' ), rawurldecode( $reference ) ) : __( 'Quote requests', 'product-configurator-for-woocommerce' );
	}
}
