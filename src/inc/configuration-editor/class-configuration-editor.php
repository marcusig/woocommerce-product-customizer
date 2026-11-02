<?php
namespace MKL\PC;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Configure products from the admin, for order lines, quote requests...
 *
 * The configurator runs in a frame (Configurator_Frame) opened in a dialog on the admin screen, preloaded
 * with the saved configuration. Its Add to cart is replaced by Save, which posts the configuration to the
 * REST route here; the target writes it where it belongs (Configuration_Editor_Target).
 *
 * A target names what is configured, its type first: `order:{id}:item:{item_id}`, `quote:{id}`... Frame
 * URLs carry a nonce for their target, for the user who opened them.
 */
class Configuration_Editor {

	const QUERY_VAR = 'mkl_pc_edit';

	const NONCE_VAR = 'mkl_pc_edit_nonce';

	/**
	 * @var Configuration_Editor_Target[] Keyed by type.
	 */
	private $targets = [];

	/**
	 * @var array|null|false The target of the current frame request, once read.
	 */
	private $frame_target = null;

	public function __construct() {
		$this->register_target( new Order_Item_Target( $this ) );
		/**
		 * Register more targets, with Configuration_Editor::register_target()
		 *
		 * @param Configuration_Editor $editor
		 */
		do_action( 'mkl_pc/configuration_editor/register_targets', $this );

		add_filter( 'mkl_pc/frame/is_frame_request', [ $this, 'is_editor_request' ], 10, 2 );
		add_action( 'mkl_pc/frame/setup', [ $this, 'setup_frame' ] );
		add_action( 'rest_api_init', [ $this, 'register_routes' ] );
		add_action( 'wp_ajax_mkl_pc_configuration_editor_url', [ $this, 'ajax_editor_url' ] );
		add_action( 'wp_ajax_mkl_pc_search_configurable_products', [ $this, 'ajax_search_products' ] );
	}

	/**
	 * @param Configuration_Editor_Target $target
	 * @return void
	 */
	public function register_target( Configuration_Editor_Target $target ) {
		$this->targets[ $target->get_type() ] = $target;
	}

	/**
	 * @param string $type
	 * @return Configuration_Editor_Target|null
	 */
	public function get_target_type( $type ) {
		return isset( $this->targets[ $type ] ) ? $this->targets[ $type ] : null;
	}

	/**
	 * What a target points at, if the current user may configure it
	 *
	 * @param string $target
	 * @return array|\WP_Error What the target type resolved (see Configuration_Editor_Target::resolve()), plus
	 *                         `target`, `type` and `is_new` (no saved configuration to open).
	 */
	public function resolve_target( $target ) {
		$not_found = new \WP_Error( 'mkl_pc_editor_target', __( 'This cannot be configured.', 'product-configurator-for-woocommerce' ), [ 'status' => 404 ] );
		if ( ! is_string( $target ) || ! preg_match( '/^([a-z_]+):/', $target, $match ) ) return $not_found;
		$type = $this->get_target_type( $match[1] );
		if ( ! $type ) return $not_found;

		$resolved = $type->resolve( $target );
		if ( is_wp_error( $resolved ) ) return $resolved;
		$product = isset( $resolved['product'] ) ? $resolved['product'] : null;
		if ( ! $product instanceof \WC_Product || ! mkl_pc_is_configurable( $product->get_parent_id() ? $product->get_parent_id() : $product->get_id() ) ) return $not_found;

		$resolved = wp_parse_args( $resolved, [
			'configuration' => [],
			'quantity'      => 1,
			'save_label'    => __( 'Save the configuration', 'product-configurator-for-woocommerce' ),
		] );
		$resolved['target'] = $target;
		$resolved['type'] = $type;
		$resolved['is_new'] = empty( $resolved['configuration'] );
		return $resolved;
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
	 * In the frame: the saved configuration, and Save instead of Add to cart
	 *
	 * @return void
	 */
	public function setup_frame() {
		$target = $this->get_frame_target();
		if ( ! $target ) return;

		add_filter( 'mkl_pc_get_saved_configuration_content', [ $this, 'get_saved_configuration' ], 20 );
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
	public function get_saved_configuration( $configuration ) {
		$target = $this->get_frame_target();
		if ( ! $target || $target['is_new'] ) return $configuration;
		return $target['configuration'];
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
			'is_new'        => $target['is_new'],
			'quantity'      => $target['quantity'],
			'save_url'      => esc_url_raw( rest_url( 'mkl_pc/v1/configuration-editor/save' ) ),
			'nonce'         => wp_create_nonce( 'wp_rest' ),
			'capture_image' => '3d' === mkl_pc_get_configurator_type( $product->get_parent_id() ? $product->get_parent_id() : $product->get_id() ),
			'button_class'  => mkl_pc( 'frontend' ) && mkl_pc( 'frontend' )->product ? mkl_pc( 'frontend' )->product->button_class : 'button',
			'lang'          => [
				'save'   => $target['save_label'],
				'cancel' => __( 'Cancel', 'product-configurator-for-woocommerce' ),
				'saving' => __( 'Saving…', 'product-configurator-for-woocommerce' ),
				'failed' => __( 'The configuration could not be saved.', 'product-configurator-for-woocommerce' ),
			],
		] );
	}

	public function register_routes() {
		register_rest_route( 'mkl_pc/v1', '/configuration-editor/save', [
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

		$result = $resolved['type']->save( $resolved, $request->get_param( 'configuration' ), [
			'quantity' => $request->get_param( 'quantity' ),
			'image'    => $request->get_param( 'image' ),
		] );
		return is_wp_error( $result ) ? $result : rest_ensure_response( $result );
	}

	/**
	 * A button opening the configurator for a target
	 *
	 * @param string      $target
	 * @param \WC_Product $product
	 * @param string      $label
	 * @param string      $class   More classes.
	 * @return void
	 */
	public function edit_button( $target, $product, $label, $class = '' ) {
		printf(
			'<button type="button" class="button %s mkl-pc-open-configuration-editor" data-url="%s" data-title="%s">%s</button>',
			esc_attr( $class ),
			esc_url( $this->get_editor_url( $target, $product ) ),
			esc_attr( $product->get_name() ),
			esc_html( $label )
		);
	}

	/**
	 * A button asking for a product, then opening its configurator
	 *
	 * @param string $base  The target without its product, e.g. `order:12`.
	 * @param string $label
	 * @param string $class More classes.
	 * @return void
	 */
	public function add_button( $base, $label, $class = '' ) {
		printf(
			'<button type="button" class="button %s mkl-pc-add-configured-product" data-target="%s">%s</button>',
			esc_attr( $class ),
			esc_attr( $base ),
			esc_html( $label )
		);
	}

	/**
	 * The dialog the configurator opens in, on an admin screen
	 *
	 * @param string   $screen 'order' reloads the order items after a save; other screens listen to
	 *                         `mkl_pc_configuration_saved` on the body.
	 * @param string[] $deps   Scripts it needs on that screen.
	 * @return void
	 */
	public function enqueue_dialog( $screen, $deps = [] ) {
		$file = 'admin/js/configuration-editor-dialog.js';
		wp_enqueue_script( 'mkl_pc/admin/js/configuration_editor_dialog', MKL_PC_ASSETS_URL . $file, array_merge( [ 'jquery' ], $deps ), filemtime( MKL_PC_ASSETS_PATH . $file ), true );
		wp_localize_script( 'mkl_pc/admin/js/configuration_editor_dialog', 'PC_configuration_editor_dialog', [
			'screen'   => $screen,
			'ajax_url' => admin_url( 'admin-ajax.php' ),
			'nonce'    => wp_create_nonce( 'mkl_pc_configuration_editor' ),
			'lang'     => [
				'choose_product' => __( 'Choose a configurable product', 'product-configurator-for-woocommerce' ),
				'search'         => __( 'Search for a configurable product…', 'product-configurator-for-woocommerce' ),
				'searching'      => __( 'Searching…', 'product-configurator-for-woocommerce' ),
				'no_results'     => __( 'No configurable product found.', 'product-configurator-for-woocommerce' ),
				'close'          => __( 'Close', 'product-configurator-for-woocommerce' ),
				'unsaved'        => __( 'Close without saving the configuration?', 'product-configurator-for-woocommerce' ),
			],
		] );
		wp_register_style( 'mkl_pc/admin/css/configuration_editor_dialog', false, [], MKL_PC_VERSION );
		wp_enqueue_style( 'mkl_pc/admin/css/configuration_editor_dialog' );
		wp_add_inline_style( 'mkl_pc/admin/css/configuration_editor_dialog', $this->get_dialog_css() );
	}

	/**
	 * @return string
	 */
	private function get_dialog_css() {
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
	 * The frame URL for a product picked for a target
	 *
	 * @return void
	 */
	public function ajax_editor_url() {
		check_ajax_referer( 'mkl_pc_configuration_editor', 'security' );
		$base = isset( $_POST['target'] ) ? sanitize_text_field( wp_unslash( $_POST['target'] ) ) : '';
		$target = $base . ':product:' . ( isset( $_POST['product_id'] ) ? absint( $_POST['product_id'] ) : 0 );
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
		$allowed = false;
		foreach ( $this->targets as $type ) {
			if ( $type->current_user_can() ) $allowed = true;
		}
		if ( ! $allowed || ! function_exists( 'wc_get_product' ) ) wp_die( -1 );
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
