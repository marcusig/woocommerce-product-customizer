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

class Rest_Base_Controller extends \WP_REST_Controller {
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
	protected $rest_base = '';

	/**
	 * Post type.
	 *
	 * @var string
	 */
	protected $post_type = 'product';
	
	/**
	 * Used to cache computed return fields.
	 *
	 * @var null|array
	 */
	private $_fields = null;

	/**
	 * Used to verify if cached fields are for correct request object.
	 *
	 * @var null|WP_REST_Request
	 */
	private $_request = null;

	/**
	 * Check if a given request has access to read items.
	 *
	 * @param  WP_REST_Request $request Full details about the request.
	 * @return WP_Error|boolean
	 */
	public function get_items_permissions_check( $request ) {
		if ( ! current_user_can( 'manage_woocommerce' ) ) {
			return new \WP_Error( 'woocommerce_rest_cannot_view', __( 'Sorry, you cannot list resources.', 'woocommerce' ), array( 'status' => rest_authorization_required_code() ) );
		}

		return true;
	}

	/**
	 * Check if a given request has access to create an item.
	 *
	 * @param  WP_REST_Request $request Full details about the request.
	 * @return WP_Error|boolean
	 */
	public function create_item_permissions_check( $request ) {
		return true;
		if ( ! current_user_can( 'manage_woocommerce' ) ) {
			return new \WP_Error( 'woocommerce_rest_cannot_create', __( 'Sorry, you are not allowed to create resources.', 'woocommerce' ), array( 'status' => rest_authorization_required_code() ) );
		}

		return true;
	}

	/**
	 * Check if a given request has access to read an item.
	 *
	 * @param  WP_REST_Request $request Full details about the request.
	 * @return WP_Error|boolean
	 */
	public function get_item_permissions_check( $request ) {
		// $post = get_post( (int) $request['product_id'] );
		if ( ! current_user_can( 'edit_posts' ) ) {
			return new \WP_Error( 'woocommerce_rest_cannot_view', __( 'Sorry, you cannot view this resource.', 'woocommerce' ), array( 'status' => rest_authorization_required_code() ) );
		}

		return true;
	}

	/**
	 * Check if a given request has access to update an item.
	 *
	 * @param  WP_REST_Request $request Full details about the request.
	 * @return WP_Error|boolean
	 */
	public function update_item_permissions_check( $request ) {
		return true;

		if ( ! current_user_can( 'manage_woocommerce' ) ) {
			return new \WP_Error( 'woocommerce_rest_cannot_edit', __( 'Sorry, you are not allowed to edit this resource.', 'woocommerce' ), array( 'status' => rest_authorization_required_code() ) );
		}

		return true;
	}

	/**
	 * Check if a given request has access to delete an item.
	 *
	 * @param  WP_REST_Request $request Full details about the request.
	 * @return bool|WP_Error
	 */
	public function delete_item_permissions_check( $request ) {
		return true;
		$post = get_post( (int) $request['product_id'] );

		if ( ! current_user_can( 'manage_woocommerce' ) ) {
			return new \WP_Error( 'woocommerce_rest_cannot_delete', __( 'Sorry, you are not allowed to delete this resource.', 'woocommerce' ), array( 'status' => rest_authorization_required_code() ) );
		}

		return true;
	}

	/**
	 * Check if a given request has access batch create, update and delete items.
	 *
	 * @param  WP_REST_Request $request Full details about the request.
	 *
	 * @return boolean|WP_Error
	 */
	public function batch_items_permissions_check( $request ) {
		if ( ! current_user_can( 'manage_woocommerce' ) ) {
			return new \WP_Error( 'woocommerce_rest_cannot_batch', __( 'Sorry, you are not allowed to batch manipulate this resource.', 'woocommerce' ), array( 'status' => rest_authorization_required_code() ) );
		}

		return true;
	}

	public function prepare_item_for_response( $object, $request ) {
		$data = $object->get_data();
		$meta_data = $data['meta_data'];
		foreach( $meta_data as $meta ) {
			$raw_meta = $meta->get_data();
			$data[$raw_meta['key']] = $raw_meta['value'];
		}
		unset( $data[ 'meta_data' ] );
		// unset( $data[ '_id' ] );
		// $data['meta_data'] = $this->get_meta_data_for_response( $request, $data['meta_data'] );
		// $data = [
		// 	'id' => 1
		// ];
		return $data;
	}

	/**
	 * Get all the items
	 *
	 * @param [type] $request
	 * @return void
	 */
	public function get_items( $request ) {
		$query_results = $this->get_objects( $request );

		$objects = array();
		foreach ( $query_results['objects'] as $object ) {
			// if ( ! wc_rest_check_post_permissions( $this->post_type, 'read', $object->get_id() ) ) {
			// 	continue;
			// }

			$data      = $this->prepare_item_for_response( $object, $request );
			$objects[] = $this->prepare_response_for_collection( $data );
		}
		$response = rest_ensure_response( $objects );
		return $response;
	}

	/**
	 * Delete a single item.
	 *
	 * @param WP_REST_Request $request Full details about the request.
	 * @return WP_REST_Response|WP_Error
	 */
	public function delete_item( $request ) {
		$force  = (bool) $request['force'];
		$object = $this->get_object( (int) $request['id'] );
		$result = false;
		if ( ! $object || 0 === $object->get_id() ) {
			return new \WP_Error( "woocommerce_rest_{$this->object_type}_invalid_id", __( 'Invalid ID.', 'woocommerce' ), array( 'status' => 404 ) );
		}

		// check parent
		if ( isset( $request['product_id'] ) ) {
			if ( $object->get_product_id() !== (int) $request['product_id'] ) {
				return new \WP_Error( "woocommerce_rest_{$this->object_type}_invalid_id", __( 'Parent ID mismatch.', 'woocommerce' ), array( 'status' => 404 ) );
			}
		}

		if ( isset( $request['layer_id'] ) ) {
			if ( $object->get_layer_id() !== (int) $request['layer_id'] ) {
				return new \WP_Error( "woocommerce_rest_{$this->object_type}_invalid_id", __( 'Parent ID mismatch.', 'woocommerce' ), array( 'status' => 404 ) );
			}
		}

		$supports_trash = false;

		/**
		 * Filter whether an object is trashable.
		 *
		 * Return false to disable trash support for the object.
		 *
		 * @param boolean $supports_trash Whether the object type support trashing.
		 * @param WC_Data $object         The object being considered for trashing support.
		 */
		$supports_trash = apply_filters( "woocommerce_rest_{$this->object_type}_object_trashable", $supports_trash, $object );

		if ( ! wc_rest_check_post_permissions( $this->post_type, 'delete', $object->get_id() ) ) {
			/* translators: %s: post type */
			// return new \WP_Error( "woocommerce_rest_user_cannot_delete_{$this->object_type}", sprintf( __( 'Sorry, you are not allowed to delete %s.', 'woocommerce' ), $this->post_type ), array( 'status' => rest_authorization_required_code() ) );
		}

		$request->set_param( 'context', 'edit' );
		$response = $this->prepare_item_for_response( $object, $request );

		// If we're forcing, then delete permanently.
		if ( $force ) {
			$object->delete( true );
			$result = 0 === $object->get_id();
		} else {
			// If we don't support trashing for this type, error out.
			if ( ! $supports_trash ) {
				/* translators: %s: post type */
				return new \WP_Error( 'woocommerce_rest_trash_not_supported', sprintf( __( 'The %s does not support trashing.', 'woocommerce' ), $this->object_type ), array( 'status' => 501 ) );
			}

			// Otherwise, only trash if we haven't already.
			if ( is_callable( array( $object, 'get_status' ) ) ) {
				if ( 'trash' === $object->get_status() ) {
					/* translators: %s: post type */
					return new \WP_Error( 'woocommerce_rest_already_trashed', sprintf( __( 'The %s has already been deleted.', 'woocommerce' ), $this->object_type ), array( 'status' => 410 ) );
				}

				$object->delete();
				$result = 'trash' === $object->get_status();
			}
		}

		if ( ! $result ) {
			/* translators: %s: post type */
			return new \WP_Error( 'woocommerce_rest_cannot_delete', sprintf( __( 'The %s cannot be deleted.', 'woocommerce' ), $this->object_type ), array( 'status' => 500 ) );
		}

		/**
		 * Fires after a single object is deleted or trashed via the REST API.
		 *
		 * @param WC_Data          $object   The deleted or trashed object.
		 * @param WP_REST_Response $response The response data.
		 * @param WP_REST_Request  $request  The request sent to the API.
		 */
		do_action( "woocommerce_rest_delete_{$this->object_type}_object", $object, $response, $request );

		return rest_ensure_response( $response );
	}

	/**
	 * Delete a single item.
	 *
	 * @param WP_REST_Request $request Full details about the request.
	 * @return WP_REST_Response|WP_Error
	 */
	public function batch_items( $request ) {
		/**
		 * REST Server
		 *
		 * @var WP_REST_Server $wp_rest_server
		 */
		global $wp_rest_server;
		// Get the request params.
		$items    = array_filter( $request->get_params() );
		$query    = $request->get_query_params();
		$response = array();
		
		if ( ! empty( $items['delete'] ) ) {
			foreach ( $items['delete'] as $id ) {
				$id = (int) $id;

				if ( 0 === $id ) {
					continue;
				}

				$_item = new \WP_REST_Request( 'DELETE', $request->get_route() );
				$params = array(
					'id'    => $id,
					'force' => true,
				);

				if ( isset( $request['product_id'] ) ) {
					$params['product_id'] = $request['product_id'];
				}

				if ( isset( $request['layer_id'] ) ) {
					$params['layer_id'] = $request['layer_id'];
				}

				$_item->set_query_params(
					$params
				);

				$_response = $this->delete_item( $_item );

				if ( is_wp_error( $_response ) ) {
					$response['delete'][] = array(
						'id'    => $id,
						'error' => array(
							'code'    => $_response->get_error_code(),
							'message' => $_response->get_error_message(),
							'data'    => $_response->get_error_data(),
						),
					);
				} else {
					$response['delete'][] = $wp_rest_server->response_to_data( $_response, '' );
				}
			}
		}
		/**
		 * Fires after a single object is deleted or trashed via the REST API.
		 *
		 * @param WC_Data          $object   The deleted or trashed object.
		 * @param WP_REST_Response $response The response data.
		 * @param WP_REST_Request  $request  The request sent to the API.
		 */
		do_action( "woocommerce_rest_delete_{$this->object_type}_object", $object, $response, $request );

		return $response;
	}

	/**
	 * Delete a single item.
	 *
	 * @param WP_REST_Request $request Full details about the request.
	 * @return WP_REST_Response|WP_Error
	 */
	public function batch_items( $request ) {
		/**
		 * REST Server
		 *
		 * @var WP_REST_Server $wp_rest_server
		 */
		global $wp_rest_server;
		// Get the request params.
		$items    = array_filter( $request->get_params() );
		$query    = $request->get_query_params();
		$response = array();
		
		if ( ! empty( $items['delete'] ) ) {
			foreach ( $items['delete'] as $id ) {
				$id = (int) $id;

				if ( 0 === $id ) {
					continue;
				}

				$_item = new \WP_REST_Request( 'DELETE', $request->get_route() );
				$_item->set_query_params(
					array(
						'id'    => $id,
						'force' => true,
					)
				);
				$_response = $this->delete_item( $_item );

				if ( is_wp_error( $_response ) ) {
					$response['delete'][] = array(
						'id'    => $id,
						'error' => array(
							'code'    => $_response->get_error_code(),
							'message' => $_response->get_error_message(),
							'data'    => $_response->get_error_data(),
						),
					);
				} else {
					$response['delete'][] = $wp_rest_server->response_to_data( $_response, '' );
				}
			}
		}
		/**
		 * Fires after a single object is deleted or trashed via the REST API.
		 *
		 * @param WC_Data          $object   The deleted or trashed object.
		 * @param WP_REST_Response $response The response data.
		 * @param WP_REST_Request  $request  The request sent to the API.
		 */
		do_action( "woocommerce_rest_delete_{$this->object_type}_object", $object, $response, $request );

		return $response;
	}	
}