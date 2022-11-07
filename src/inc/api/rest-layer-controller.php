<?php

namespace MKL\PC;

/**
 * Product functions
 *
 *
 * @author   Marc Lacroix
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly
}

class Rest_Layer_Controller extends Rest_Base_Controller {
	/**
	 * Endpoint namespace.
	 *
	 * @var string
	 */
	protected $namespace = 'mklpc/v1';

	/**
	 * Route base.
	 *
	 * @var string
	 */
	protected $rest_base = 'configuration/(?P<product_id>[\d]+)/layers';
	// protected $rest_base = 'orders/(?P<order_id>[\d]+)/notes';

	/**
	 * Post type.
	 *
	 * @var string
	 */
	protected $post_type = 'product';
	
	/**
	 * Object type.
	 *
	 * @var string
	 */
	protected $object_type = 'layer';
	
	/**
	 * Register the routes for order notes.
	 */
	public function register_routes() {
		register_rest_route( $this->namespace, '/' . $this->rest_base, array(
			'args' => array(
				'product_id'  => array(
					'description' => __( 'The product ID.', 'woocommerce' ),
					'type'        => 'integer',
				),
			),
			array(
				'methods'             => \WP_REST_Server::READABLE,
				'callback'            => array( $this, 'get_items' ),
				'permission_callback' => array( $this, 'get_items_permissions_check' ),
				'args'                => $this->get_collection_params(),
			),
			array(
				'methods'             => \WP_REST_Server::CREATABLE,
				'callback'            => array( $this, 'create_item' ),
				'permission_callback' => array( $this, 'create_item_permissions_check' ),
				'args'                => array_merge( $this->get_endpoint_args_for_item_schema( \WP_REST_Server::CREATABLE ), array(
					'name' => array(
						'type'        => 'string',
						'description' => __( 'Layer name.', 'woocommerce' ),
						'required'    => true,
					),
				) ),
			),
			'schema' => array( $this, 'get_public_item_schema' ),
		) );

		register_rest_route( $this->namespace, '/' . $this->rest_base . '/(?P<id>[\d]+)', array(
			'args' => array(
				'id' => array(
					'description' => __( 'Unique identifier for the resource.', 'woocommerce' ),
					'type'        => 'integer',
				),
				'product_id'  => array(
					'description' => __( 'The product ID.', 'woocommerce' ),
					'type'        => 'integer',
				),
			),
			array(
				'methods'             => \WP_REST_Server::READABLE,
				'callback'            => array( $this, 'get_item' ),
				'permission_callback' => array( $this, 'get_item_permissions_check' ),
				'args'                => array(
					'context' => $this->get_context_param( array( 'default' => 'view' ) ),
				),
			),
			array(
				'methods'         => \WP_REST_Server::EDITABLE,
				'callback'        => array( $this, 'update_item' ),
				'permission_callback' => array( $this, 'update_item_permissions_check' ),
				'args'            => $this->get_endpoint_args_for_item_schema( \WP_REST_Server::EDITABLE ),
			),
			array(
				'methods'             => \WP_REST_Server::DELETABLE,
				'callback'            => array( $this, 'delete_item' ),
				'permission_callback' => array( $this, 'delete_item_permissions_check' ),
				'args'                => array(
					'force' => array(
						'default'     => false,
						'type'        => 'boolean',
						'description' => __( 'Required to be true, as resource does not support trashing.', 'woocommerce' ),
					),
				),
			),
			'schema' => array( $this, 'get_public_item_schema' ),
		) );
	}

	/**
	 * Get a single order note.
	 *
	 * @param WP_REST_Request $request Full details about the request.
	 * @return WP_Error|WP_REST_Response
	 */
	public function create_item( $request ) {
		$id    = isset( $request['id'] ) ? absint( $request['id'] ) : 0;
		$product = wc_get_product( (int) $request['product_id'] );
		$object = $this->prepare_object_for_database( $request, true );
		$id = $object->save();
		$object->save_meta_data();

		// if ( ! $product || ! is_a( $product, 'WC_Product' ) ) {
		// 	return new \WP_Error( 'woocommerce_rest_order_invalid_id', __( 'Invalid product ID.', 'woocommerce' ), array( 'status' => 404 ) );
		// }

		// $layer = $this->get_object( $id );

		// if ( empty( $id ) || empty( $layer ) ) {
		// 	return new \WP_Error( 'woocommerce_rest_invalid_id', __( 'Invalid resource ID.', 'woocommerce' ), array( 'status' => 404 ) );
		// }

		// $layer = $this->prepare_item_for_response( $layer, $request );
		// $response = rest_ensure_response( $layer );

		$object = $this->prepare_item_for_response( $this->get_object( $id ), $request );
		$response = rest_ensure_response( $object );

		return $response;
	}

	/**
	 * Update a single term from a taxonomy.
	 *
	 * @param WP_REST_Request $request Full details about the request.
	 * @return WP_REST_Request|WP_Error
	 */
	public function update_item( $request ) {
		$object = $this->get_object( (int) $request['id'] );

		if ( ! $object || 0 === $object->get_id() ) {
			return new \WP_Error( "woocommerce_rest_{$this->post_type}_invalid_id", __( 'Invalid ID.', 'woocommerce' ), array( 'status' => 400 ) );
		}

		
		$object = $this->prepare_object_for_database( $request, false );
		
		if ( is_wp_error( $object ) ) {
			return $object;
		}

		$object->save();
		$object->save_meta_data();

		$request->set_param( 'context', 'edit' );
		$response = $this->prepare_item_for_response( $object, $request );
		return rest_ensure_response( $response );
	}

	protected function prepare_object_for_database( $request, $creating = false ) {
		$id    = isset( $request['id'] ) ? absint( $request['id'] ) : 0;
		$layer = $this->get_object( $id );

		$available_props = $this->get_item_fields();
		$available_settings = array_merge( $available_props, array_keys( mkl_pc()->admin->layer_settings->get_settings_list() ) );
		$posted_data = $request->get_params();
		$props = [];
		foreach( $available_settings as $setting ) {
			if ( ! isset( $posted_data[$setting] ) ) continue;
			if ( in_array(  $setting, $available_props ) ) {
				$props[$setting] = $posted_data[$setting];
			} else {
				$layer->update_meta_data( $setting, $posted_data[$setting], true );
			}
		}

		$props = array_merge(
			$props,
			[
				'product_id' => $creating ? absint( $request['product_id'] ) : $layer->get( 'product_id' ) ,
				// 'order'      => $posted_data['order'],
			]
		);

		$layer->set_props( $props );
		// $layer->save_meta_data();
		return $layer;
	}

	public function get_item_schema() {
		$schema = array(
			'$schema'    => 'http://json-schema.org/draft-04/schema#',
			'title'      => 'product_attribute',
			'type'       => 'object',
			'properties' => array(
			),
		);
		// $
	}

	/**
	 * Get the built in fields, saved in the main table. Other fields will be saved as meta
	 *
	 * @return array
	 */
	public function get_item_fields() {
		$fields = array(
			// 'layer_id',
			'type',
			'name',
			'parent',
			'global',
			'order',
			// 'product_id',
			// 'date_modified',
		);
		return $fields;
	}

	/**
	 * Get a single order note.
	 *
	 * @param WP_REST_Request $request Full details about the request.
	 * @return WP_Error|WP_REST_Response
	 */
	public function get_item( $request ) {
		$id = (int) $request['id'];
		$product = wc_get_product( (int) $request['product_id'] );

		if ( ! $product || ! is_a( $product, 'WC_Product' ) ) {
			return new \WP_Error( 'woocommerce_rest_order_invalid_id', __( 'Invalid product ID.', 'woocommerce' ), array( 'status' => 404 ) );
		}

		$layer = $this->get_object( $id );

		if ( empty( $id ) || empty( $layer ) ) {
			return new \WP_Error( 'woocommerce_rest_invalid_id', __( 'Invalid resource ID.', 'woocommerce' ), array( 'status' => 404 ) );
		}

		$layer = $this->prepare_item_for_response( $layer, $request );
		$response = rest_ensure_response( $layer );

		return $response;
	}

	/**
	 * Get object. Return false if object is not of required type.
	 *
	 * @since  3.0.0
	 * @param  int $id Object ID.
	 * @return WC_Data|bool
	 */
	protected function get_object( $id ) {
		try {
			$layer = new Layer_Data( $id );
		} catch ( \Exception $e ) {
			return false;
		}
		return $layer;
	}

	/**
	 * Get Objects
	 *
	 * @param [type] $request
	 * @return void
	 */
	protected function get_objects( $request ) {
		global $wpdb;
		$product_id = (int) $request['product_id'];
		$data = $wpdb->get_col( $wpdb->prepare( "SELECT layer_id FROM {$wpdb->prefix}mklpc_layers WHERE product_id = %d;", $product_id ) );
		// wp_cache_set( 'item-' . $item->get_id(), $data, 'mklpc-layers' );

		return array(
			'objects' => array_filter( array_map( array( $this, 'get_object' ), $data ) ),
		);
	}


}