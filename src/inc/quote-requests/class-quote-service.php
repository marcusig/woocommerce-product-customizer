<?php
namespace MKL\PC;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Turns submitted data into a sent quote request
 *
 * Every entry point goes through here: the REST API (used by the configurator's own form and by
 * headless clients), and any integration calling mkl_pc_create_quote_request(). It is split in two
 * so callers can check a one-time token between them: prepare() validates and has no side effect,
 * submit() stores, writes the image and sends the emails.
 */
class Quote_Service {

	/**
	 * Validate submitted data and build the request. Nothing is written or sent.
	 *
	 * @param array $args {
	 *     @type int          $product_id    Product or variation id (as the configurator posts it).
	 *     @type int          $variation_id  Optional, when product_id is the parent.
	 *     @type int          $quantity      Default 1.
	 *     @type string|array $configuration Configurator payload (JSON string, or its decoded array).
	 *     @type array        $fields        Form values keyed by field id.
	 *     @type string       $image         Optional PNG data URL of the viewer (3D configurators).
	 *     @type string       $lang          Optional language code.
	 * }
	 * @return Quote_Request|\WP_Error
	 */
	public function prepare( $args ) {
		$args = wp_parse_args( $args, [
			'product_id'    => 0,
			'variation_id'  => 0,
			'quantity'      => 1,
			'configuration' => '',
			'fields'        => [],
			'image'         => '',
			'lang'          => '',
		] );

		if ( ! mkl_pc( 'quotes' )->is_enabled() ) {
			return new \WP_Error( 'mkl_pc_quote_disabled', __( 'Quote requests are not available.', 'product-configurator-for-woocommerce' ), [ 'status' => 403 ] );
		}

		$ids = $this->resolve_product( (int) $args['product_id'], (int) $args['variation_id'] );
		if ( is_wp_error( $ids ) ) return $ids;

		$raw = $args['configuration'];
		if ( is_array( $raw ) ) {
			$raw = wp_json_encode( $raw );
		}
		$data = Utils::decode_configurator_payload( $raw );
		if ( null === $data ) {
			return new \WP_Error( 'mkl_pc_quote_invalid_configuration', __( 'The configuration data could not be read.', 'product-configurator-for-woocommerce' ), [ 'status' => 400 ] );
		}
		if ( ! empty( $data ) ) {
			$data = Plugin::instance()->db->sanitize( $data );
		}
		if ( empty( $data ) || ! is_array( $data ) ) {
			return new \WP_Error( 'mkl_pc_quote_empty_configuration', __( 'The configuration is empty.', 'product-configurator-for-woocommerce' ), [ 'status' => 400 ] );
		}

		$context = [
			'product_id'      => $ids['product_id'],
			'configurator_id' => $ids['product_id'],
		];
		$fields = mkl_pc( 'quotes' )->fields;
		$values = $fields->validate( $args['fields'], $context );
		if ( is_wp_error( $values ) ) return $values;

		$request = new Quote_Request();
		$request->configurator_id   = $ids['product_id'];
		$request->product_id        = $ids['product_id'];
		$request->variation_id      = $ids['variation_id'];
		$request->quantity          = max( 1, absint( $args['quantity'] ) );
		$request->configuration_raw = wp_json_encode( $data );
		$request->configuration     = new Configuration( null, [
			'product_id'   => $ids['product_id'],
			'variation_id' => $ids['variation_id'],
			'content'      => $data,
		] );
		$request->fields            = $values;
		$request->field_definitions = $fields->get_fields( $context );
		$request->lang              = sanitize_key( $args['lang'] );
		$request->user_id           = get_current_user_id();
		$request->price             = $this->get_price( $request );
		$request->meta['image_data_url'] = is_string( $args['image'] ) ? $args['image'] : '';

		/**
		 * Validate a quote request before it is sent. Add errors to refuse it.
		 *
		 * @param \WP_Error     $errors
		 * @param Quote_Request $request
		 * @param array         $args    Submitted data.
		 */
		$errors = apply_filters( 'mkl_pc/quote_request/validate', new \WP_Error(), $request, $args );
		if ( is_wp_error( $errors ) && $errors->has_errors() ) {
			$errors->add_data( [ 'status' => 400 ] );
			return $errors;
		}

		return $request;
	}

	/**
	 * Store and send a prepared request
	 *
	 * @param Quote_Request $request
	 * @return Quote_Request|\WP_Error
	 */
	public function submit( Quote_Request $request ) {
		$store = mkl_pc( 'quotes' )->get_store();
		$request->store     = $store->get_id();
		$request->created   = time();
		$request->reference = $this->generate_reference();

		$this->attach_image( $request, $store->get_files_folder() );
		unset( $request->meta['image_data_url'] );

		$saved = $store->save( $request );
		if ( is_wp_error( $saved ) ) {
			$this->delete_owned_image( $request );
			return $saved;
		}

		/**
		 * Fires once a quote request is stored, before its emails are sent.
		 *
		 * Add-ons that add files (a PDF, uploads) do it here, so the emails can attach them.
		 *
		 * @param Quote_Request $request
		 */
		do_action( 'mkl_pc/quote_request/stored', $request );

		$mailer = mkl_pc( 'mailer' );
		$admin_sent = $mailer->send( 'mkl_pc_quote_request_admin', $request );
		$mailer->send( 'mkl_pc_quote_request_customer', $request );

		if ( ! $admin_sent && ! $store->is_persistent() ) {
			$this->delete_owned_image( $request );
			return new \WP_Error( 'mkl_pc_quote_not_sent', __( 'Your request could not be sent. Please try again later.', 'product-configurator-for-woocommerce' ), [ 'status' => 500 ] );
		}

		/**
		 * Fires after a quote request was stored and its emails sent.
		 *
		 * @param Quote_Request $request
		 */
		do_action( 'mkl_pc/quote_request/created', $request );

		return $request;
	}

	/**
	 * Find the product and variation from what the configurator posts, if it can be quoted
	 *
	 * @param int $product_id
	 * @param int $variation_id
	 * @return array|\WP_Error product_id / variation_id
	 */
	public function resolve_product( $product_id, $variation_id = 0 ) {
		$not_found = new \WP_Error( 'mkl_pc_quote_invalid_product', __( 'This product cannot be quoted.', 'product-configurator-for-woocommerce' ), [ 'status' => 404 ] );
		if ( ! $product_id ) return $not_found;

		if ( function_exists( 'wc_get_product' ) ) {
			$product = wc_get_product( $variation_id ? $variation_id : $product_id );
			if ( ! $product ) return $not_found;
			if ( $product->is_type( 'variation' ) ) {
				$variation_id = $product->get_id();
				$product_id   = $product->get_parent_id();
			} else {
				$variation_id = 0;
				$product_id   = $product->get_id();
			}
			if ( 'publish' !== get_post_status( $product_id ) && ! current_user_can( 'edit_post', $product_id ) ) return $not_found;
		}

		if ( ! mkl_pc_is_configurable( $product_id ) ) return $not_found;

		/**
		 * Whether a product can be quoted
		 *
		 * @param boolean $can_quote
		 * @param int     $product_id
		 * @param int     $variation_id
		 */
		if ( ! apply_filters( 'mkl_pc/quote_request/can_quote', true, $product_id, $variation_id ) ) return $not_found;

		return [
			'product_id'   => $product_id,
			'variation_id' => $variation_id,
		];
	}

	/**
	 * Price snapshot, when there is a price source
	 *
	 * @param Quote_Request $request
	 * @return array|null
	 */
	private function get_price( Quote_Request $request ) {
		if ( ! function_exists( 'wc_get_product' ) ) return null;
		$price = $request->configuration->get_configured_price( [ 'quantity' => $request->quantity ] );
		if ( is_wp_error( $price ) || ! is_array( $price ) ) return null;
		$price['line_total'] = (float) $price['total'] * $request->quantity;
		return $price;
	}

	/**
	 * Short reference, e.g. Q-20261030-7F3K
	 *
	 * @return string
	 */
	private function generate_reference() {
		$chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
		$suffix = '';
		for ( $i = 0; $i < 4; $i++ ) {
			$suffix .= $chars[ wp_rand( 0, strlen( $chars ) - 1 ) ];
		}
		/**
		 * Filter a quote request reference
		 *
		 * @param string $reference
		 */
		return apply_filters( 'mkl_pc/quote_request/reference', 'Q-' . wp_date( 'Ymd' ) . '-' . $suffix );
	}

	/**
	 * Give the request its picture
	 *
	 * 3D: the viewer's capture, checked the same way as for the cart and moved into the store's
	 * folder. 2D: the merged image the server makes for the cart, from the layer images.
	 *
	 * @param Quote_Request $request
	 * @param string        $folder  Folder under mkl-pc-config-images for files the request owns.
	 * @return void
	 */
	private function attach_image( Quote_Request $request, $folder ) {
		if ( 'none' === mkl_pc( 'quotes' )->get_image_mode() ) return;

		if ( '3d' === mkl_pc_get_configurator_type( $request->product_id ) ) {
			$data_url = $request->meta['image_data_url'];
			$cart = mkl_pc( 'frontend' ) ? mkl_pc( 'frontend' )->cart : null;
			if ( ! $data_url || ! $cart ) return;
			$temp = $cart->save_3d_screenshot_to_temp( $data_url );
			if ( ! $temp ) return;
			$base_dir = wp_upload_dir()['basedir'] . '/mkl-pc-config-images';
			$target_dir = $base_dir . '/' . $folder;
			if ( ! file_exists( $target_dir ) ) {
				wp_mkdir_p( $target_dir );
			}
			$file_name = 'quote-' . sanitize_file_name( strtolower( $request->reference ) ) . '-' . wp_generate_uuid4() . '.png';
			if ( ! Utils::fs_move( $base_dir . '/' . $temp, $target_dir . '/' . $file_name, true ) ) {
				wp_delete_file( $base_dir . '/' . $temp );
				return;
			}
			$request->image_path = $target_dir . '/' . $file_name;
			$request->image_url  = wp_upload_dir()['baseurl'] . '/mkl-pc-config-images/' . $folder . '/' . $file_name;
			$request->meta['owns_image'] = true;
			return;
		}

		$configuration = $request->configuration;
		$file = $configuration->get_image_file();
		if ( $file ) {
			$request->image_path = $file;
			$request->image_url  = $configuration->get_image_file_url();
			return;
		}
		$single = $configuration->content_has_single_image( 'id' );
		if ( $single && ( $path = get_attached_file( $single ) ) && is_file( $path ) ) {
			$request->image_path = $path;
			$request->image_url  = wp_get_attachment_url( $single );
		}
	}

	/**
	 * Remove the image written for a request that was not sent
	 *
	 * Only the 3D capture belongs to the request: a 2D merged image is shared by every identical
	 * configuration.
	 *
	 * @param Quote_Request $request
	 * @return void
	 */
	private function delete_owned_image( Quote_Request $request ) {
		if ( empty( $request->meta['owns_image'] ) || ! $request->image_path ) return;
		wp_delete_file( $request->image_path );
		$request->image_path = '';
		$request->image_url  = '';
	}
}
