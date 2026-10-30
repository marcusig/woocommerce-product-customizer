<?php
namespace MKL\PC;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

require_once __DIR__ . '/class-quote-request.php';
require_once __DIR__ . '/class-quote-fields.php';
require_once __DIR__ . '/class-quote-service.php';
require_once __DIR__ . '/class-quote-rest.php';
require_once __DIR__ . '/stores/interface-quote-store.php';
require_once __DIR__ . '/stores/class-email-only-store.php';
require_once __DIR__ . '/stores/class-cpt-store.php';
require_once __DIR__ . '/stores/class-woo-order-store.php';
require_once __DIR__ . '/class-quote-privacy.php';

/**
 * Native quote requests: a customer asks for a quote on what they configured
 *
 * Available as mkl_pc( 'quotes' ). The pieces:
 * - Quote_Fields: the form, as a schema;
 * - Quote_Service: validates, stores and sends a request;
 * - Quote_Store: what happens to it (emailed only, also kept as a mkl_pc_quote post, or also created
 *   as a WooCommerce order);
 * - Quote_REST: the API the configurator's form and headless clients use.
 */
class Quote_Requests {

	const TOKEN_PURPOSE = 'quote_request_send';

	/**
	 * @var Quote_Fields
	 */
	public $fields;

	/**
	 * @var Quote_Service
	 */
	public $service;

	/**
	 * @var Quote_REST
	 */
	public $rest;

	/**
	 * @var CPT_Store
	 */
	public $cpt_store;

	/**
	 * @var Woo_Order_Store
	 */
	public $woo_order_store;

	/**
	 * @var Quote_Privacy
	 */
	public $privacy;

	/**
	 * @var Quote_Store[]|null
	 */
	private $stores = null;

	public function __construct() {
		$this->fields    = new Quote_Fields();
		$this->service   = new Quote_Service();
		$this->rest      = new Quote_REST();
		$this->cpt_store = new CPT_Store();
		$this->woo_order_store = new Woo_Order_Store();
		$this->privacy   = new Quote_Privacy();

		if ( is_admin() ) {
			require_once __DIR__ . '/admin/class-quote-requests-admin.php';
			new Quote_Requests_Admin( $this->cpt_store );
		}

		$mailer = mkl_pc( 'mailer' );
		$mailer->register( 'mkl_pc_quote_request_admin', '\MKL\PC\Quote_Request_Admin_Email', __DIR__ . '/emails/class-quote-request-admin-email.php' );
		$mailer->register( 'mkl_pc_quote_request_customer', '\MKL\PC\Quote_Request_Customer_Email', __DIR__ . '/emails/class-quote-request-customer-email.php' );

		add_filter( 'mkl_pc_frontend_action_token_purposes', [ $this, 'add_token_purpose' ] );
		add_filter( 'mkl_pc_rate_limit_rule', [ $this, 'rate_limit_rule' ], 10, 2 );
		add_action( 'mkl_pc_scripts_product_page_after', [ $this, 'enqueue_scripts' ] );
		add_action( 'mkl_pc/register_settings', [ $this, 'register_settings' ], 30 );
		add_action( 'admin_notices', [ $this, 'store_unavailable_notice' ] );
	}

	/**
	 * Whether quote requests are on
	 *
	 * @return boolean
	 */
	public function is_enabled() {
		/**
		 * Whether native quote requests are enabled
		 *
		 * @param boolean $enabled
		 */
		return (bool) apply_filters( 'mkl_pc/quote_request/enabled', (bool) mkl_pc( 'settings' )->get( 'quote_request_enabled' ) );
	}

	/**
	 * What to do with the configuration image: attach (shown and attached), inline (shown), none
	 *
	 * @return string
	 */
	public function get_image_mode() {
		$mode = mkl_pc( 'settings' )->get( 'quote_request_image', 'attach', true );
		return in_array( $mode, [ 'attach', 'inline', 'none' ], true ) ? $mode : 'attach';
	}

	/**
	 * Whether prices are shown in the request emails
	 *
	 * @return boolean
	 */
	public function show_prices() {
		return function_exists( 'wc_price' ) && (bool) mkl_pc( 'settings' )->get( 'quote_request_show_prices' );
	}

	/**
	 * Every store, keyed by id
	 *
	 * @return Quote_Store[]
	 */
	public function get_stores() {
		if ( null === $this->stores ) {
			$email = new Email_Only_Store();
			/**
			 * Filter the places a quote request can be kept
			 *
			 * @param Quote_Store[] $stores Keyed by id.
			 */
			$stores = apply_filters( 'mkl_pc/quote_request/stores', [
				$email->get_id()                 => $email,
				$this->cpt_store->get_id()       => $this->cpt_store,
				$this->woo_order_store->get_id() => $this->woo_order_store,
			] );
			$this->stores = array_filter( (array) $stores, function( $store ) {
				return $store instanceof Quote_Store;
			} );
		}
		return $this->stores;
	}

	/**
	 * The store chosen in the settings
	 *
	 * When it cannot be used (WooCommerce orders without WooCommerce), requests are kept as posts
	 * rather than only emailed: the merchant chose to keep them.
	 *
	 * @return Quote_Store
	 */
	public function get_store() {
		$stores = $this->get_stores();
		$id = $this->get_store_setting();
		if ( isset( $stores[ $id ] ) && $stores[ $id ]->is_available() ) {
			return $stores[ $id ];
		}
		if ( 'email' !== $id && $this->cpt_store->is_available() ) {
			return $this->cpt_store;
		}
		return isset( $stores['email'] ) ? $stores['email'] : new Email_Only_Store();
	}

	/**
	 * Tell the merchant their requests are not going where they asked
	 *
	 * @return void
	 */
	public function store_unavailable_notice() {
		if ( ! $this->is_enabled() || ! current_user_can( mkl_pc_get_admin_menu_capability() ) ) return;
		$screen = get_current_screen();
		if ( ! $screen || ! ( mkl_pc_is_settings_page() || 'dashboard' === $screen->id || CPT_Store::POST_TYPE === $screen->post_type ) ) return;
		$setting = $this->get_store_setting();
		$store = $this->get_store();
		if ( $setting === $store->get_id() ) return;
		$stores = $this->get_stores();
		echo '<div class="notice notice-warning"><p>' . esc_html( sprintf(
			/* translators: 1: chosen option, 2: option used instead */
			__( 'Quote requests are set to be "%1$s", which this site cannot do at the moment. They are "%2$s" instead.', 'product-configurator-for-woocommerce' ),
			isset( $stores[ $setting ] ) ? $stores[ $setting ]->get_label() : $setting,
			$store->get_label()
		) ) . '</p></div>';
	}

	/**
	 * The store chosen in the settings, whether or not it can be used
	 *
	 * @return string
	 */
	public function get_store_setting() {
		return (string) mkl_pc( 'settings' )->get( 'quote_request_storage', 'email', true );
	}

	/**
	 * @param string[] $purposes
	 * @return string[]
	 */
	public function add_token_purpose( $purposes ) {
		$purposes[] = self::TOKEN_PURPOSE;
		return $purposes;
	}

	/**
	 * At most 10 requests an hour from one visitor
	 *
	 * @param array  $rule
	 * @param string $action
	 * @return array
	 */
	public function rate_limit_rule( $rule, $action ) {
		if ( self::TOKEN_PURPOSE === $action ) {
			return [ 'max' => 10, 'window' => HOUR_IN_SECONDS ];
		}
		return $rule;
	}

	/**
	 * Load PC.fe.quote after the configurator's script, when quote requests are on
	 *
	 * The fields themselves come from the schema endpoint: they can depend on the product.
	 *
	 * @return void
	 */
	public function enqueue_scripts() {
		if ( ! $this->is_enabled() ) return;

		$file = 'js/quote-request' . ( defined( 'SCRIPT_DEBUG' ) && SCRIPT_DEBUG ? '' : '.min' ) . '.js';
		wp_enqueue_script(
			'mkl_pc/js/quote_request',
			MKL_PC_ASSETS_URL . $file,
			[ 'jquery', 'wp-hooks', 'mkl_pc/js/product_configurator' ],
			filemtime( MKL_PC_ASSETS_PATH . $file ),
			true
		);
		wp_localize_script( 'mkl_pc/js/quote_request', 'PC_quote_request', [
			'schema_url'    => esc_url_raw( rest_url( 'mkl_pc/v1/quote-requests/schema' ) ),
			'submit_url'    => esc_url_raw( rest_url( 'mkl_pc/v1/quote-requests' ) ),
			'token_purpose' => self::TOKEN_PURPOSE,
			'lang'          => [
				/* translators: %s: field label */
				'field_too_long'        => __( '%s is too long', 'product-configurator-for-woocommerce' ),
				/* translators: %s: field label */
				'field_invalid'         => __( '%s is not valid', 'product-configurator-for-woocommerce' ),
				'configuration_invalid' => __( 'Please check your configuration.', 'product-configurator-for-woocommerce' ),
				'fields_invalid'        => __( 'Some fields need your attention.', 'product-configurator-for-woocommerce' ),
			],
		] );
	}

	/**
	 * Settings section
	 *
	 * @param Admin_Settings $settings_page
	 * @return void
	 */
	public function register_settings( $settings_page ) {
		if ( ! $settings_page || ! is_callable( [ $settings_page, 'callback_select' ] ) ) return;

		$emails_url = admin_url( 'admin.php?page=wc-settings&tab=email' );
		add_settings_section(
			'quote_requests',
			__( 'Quote requests', 'product-configurator-for-woocommerce' ),
			function() use ( $emails_url ) {
				echo '<p>' . wp_kses_post( sprintf(
					/* translators: %s: link to the WooCommerce email settings */
					__( 'Let customers request a quote for what they configured. The emails sent to you and to the customer are set up in <a href="%s">WooCommerce &gt; Settings &gt; Emails</a>.', 'product-configurator-for-woocommerce' ),
					esc_url( $emails_url )
				) ) . '</p>';
			},
			'mlk_pc_settings'
		);

		add_settings_field(
			'quote_request_enabled',
			__( 'Enable quote requests', 'product-configurator-for-woocommerce' ),
			[ $settings_page, 'callback_checkbox' ],
			'mlk_pc_settings',
			'quote_requests',
			[ 'setting_name' => 'quote_request_enabled' ]
		);

		$options = [];
		foreach ( $this->get_stores() as $store ) {
			if ( $store->is_available() ) $options[ $store->get_id() ] = $store->get_label();
		}
		add_settings_field(
			'quote_request_storage',
			__( 'Quote requests are', 'product-configurator-for-woocommerce' ),
			[ $settings_page, 'callback_select' ],
			'mlk_pc_settings',
			'quote_requests',
			[
				'setting_name' => 'quote_request_storage',
				'options'      => $options,
				'default'      => 'email',
			]
		);

		add_settings_field(
			'quote_request_image',
			__( 'Configuration image', 'product-configurator-for-woocommerce' ),
			[ $settings_page, 'callback_select' ],
			'mlk_pc_settings',
			'quote_requests',
			[
				'setting_name' => 'quote_request_image',
				'options'      => [
					'attach' => __( 'Show in the emails and attach it', 'product-configurator-for-woocommerce' ),
					'inline' => __( 'Show in the emails', 'product-configurator-for-woocommerce' ),
					'none'   => __( 'Do not include it', 'product-configurator-for-woocommerce' ),
				],
				'default'      => 'attach',
			]
		);

		add_settings_field(
			'quote_request_show_prices',
			__( 'Show prices in quote request emails', 'product-configurator-for-woocommerce' ),
			[ $settings_page, 'callback_checkbox' ],
			'mlk_pc_settings',
			'quote_requests',
			[
				'setting_name' => 'quote_request_show_prices',
			]
		);

		add_settings_field(
			'quote_request_retention',
			__( 'Keep stored quote requests for', 'product-configurator-for-woocommerce' ),
			[ $settings_page, 'callback_select' ],
			'mlk_pc_settings',
			'quote_requests',
			[
				'setting_name' => 'quote_request_retention',
				'options'      => [
					'0'   => __( 'Until deleted', 'product-configurator-for-woocommerce' ),
					'90'  => __( '3 months', 'product-configurator-for-woocommerce' ),
					'180' => __( '6 months', 'product-configurator-for-woocommerce' ),
					'365' => __( 'One year', 'product-configurator-for-woocommerce' ),
					'730' => __( 'Two years', 'product-configurator-for-woocommerce' ),
				],
				'default'      => '0',
				'description'  => __( 'Requests kept in Product Configurator > Quote requests are deleted, with their images, once they are this old.', 'product-configurator-for-woocommerce' ),
			]
		);
	}
}
