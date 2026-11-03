<?php
namespace MKL\PC;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Configure quote requests kept as posts, from their screen
 *
 * `quote:{id}` edits the request's configuration; `quote:{id}:product:{product_id}` configures a product
 * from scratch, for a request created in the admin or to change the product. Quote_Service writes it.
 */
class Quote_Request_Target implements Configuration_Editor_Target {

	/**
	 * @var CPT_Store
	 */
	private $store;

	public function __construct( CPT_Store $store ) {
		$this->store = $store;
	}

	public function get_type() {
		return 'quote';
	}

	public function current_user_can() {
		$type = get_post_type_object( CPT_Store::POST_TYPE );
		return $type && current_user_can( $type->cap->edit_posts );
	}

	/**
	 * @param string $target
	 * @return array|\WP_Error request, besides what the interface lists.
	 */
	public function resolve( $target ) {
		$not_found = new \WP_Error( 'mkl_pc_editor_target', __( 'This quote request cannot be configured.', 'product-configurator-for-woocommerce' ), [ 'status' => 404 ] );
		if ( ! preg_match( '/^quote:(\d+)(?::product:(\d+))?$/', $target, $match ) || ! function_exists( 'wc_get_product' ) ) return $not_found;

		$post = get_post( (int) $match[1] );
		if ( ! $post || CPT_Store::POST_TYPE !== $post->post_type ) return $not_found;
		if ( ! current_user_can( 'edit_post', $post->ID ) ) {
			return new \WP_Error( 'mkl_pc_editor_forbidden', __( 'This quote request cannot be edited.', 'product-configurator-for-woocommerce' ), [ 'status' => rest_authorization_required_code() ] );
		}
		$request = $this->store->load( $post->ID );
		if ( ! $request ) return $not_found;

		$configuration = [];
		if ( ! empty( $match[2] ) ) {
			$product = wc_get_product( (int) $match[2] );
		} else {
			$product = $request->get_product();
			$configuration = Utils::decode_configurator_payload( $request->configuration_raw );
		}
		if ( ! $product ) return $not_found;

		return [
			'request'       => $request,
			'product'       => $product,
			'configuration' => is_array( $configuration ) ? $configuration : [],
			'quantity'      => $request->quantity,
			'save_label'    => empty( $configuration ) ? __( 'Add to the request', 'product-configurator-for-woocommerce' ) : __( 'Save the configuration', 'product-configurator-for-woocommerce' ),
		];
	}

	public function save( $resolved, $payload, $args ) {
		$request = $resolved['request'];
		$had_configuration = '' !== $request->configuration_raw;
		$old_name = $had_configuration ? $request->get_product_name() : '';
		$old_price = $this->get_configured_price( $request );

		$request = mkl_pc( 'quotes' )->service->update_configuration( $request, $resolved['product'], $payload, $args );
		if ( is_wp_error( $request ) ) return $request;

		$this->store->log( $request->id, $this->get_log_message( $request, $old_name, $old_price ) );
		return [
			'request_id' => $request->id,
			'reference'  => $request->reference,
		];
	}

	/**
	 * The configured line total, whatever price the merchant quoted
	 *
	 * @param Quote_Request $request
	 * @return float|null
	 */
	private function get_configured_price( Quote_Request $request ) {
		return is_array( $request->price ) && isset( $request->price['line_total'] ) ? (float) $request->price['line_total'] : null;
	}

	/**
	 * @param Quote_Request $request
	 * @param string        $old_name  Product configured before, '' when there was none.
	 * @param float|null    $old_price
	 * @return string
	 */
	private function get_log_message( Quote_Request $request, $old_name, $old_price ) {
		$name = $request->get_product_name();
		$price = $this->get_configured_price( $request );
		$format = function( $amount ) {
			return null === $amount || ! function_exists( 'wc_price' ) ? '' : html_entity_decode( wp_strip_all_tags( wc_price( $amount ) ), ENT_QUOTES, get_bloginfo( 'charset' ) );
		};
		if ( ! $old_name ) {
			/* translators: %s: product name */
			$message = sprintf( __( 'Configured product added: %s.', 'product-configurator-for-woocommerce' ), $name );
		} elseif ( $old_name !== $name ) {
			/* translators: 1: previous product name, 2: new product name */
			$message = sprintf( __( 'Product changed: %1$s → %2$s.', 'product-configurator-for-woocommerce' ), $old_name, $name );
		} else {
			/* translators: %s: product name */
			$message = sprintf( __( 'Configuration of %s edited.', 'product-configurator-for-woocommerce' ), $name );
		}
		if ( null !== $price && $old_price !== $price ) {
			$message .= ' ' . ( null === $old_price
				/* translators: %s: price */
				? sprintf( __( 'Configured price: %s.', 'product-configurator-for-woocommerce' ), $format( $price ) )
				/* translators: 1: previous price, 2: new price */
				: sprintf( __( 'Configured price: %1$s → %2$s.', 'product-configurator-for-woocommerce' ), $format( $old_price ), $format( $price ) ) );
		}
		return $message;
	}
}
