<?php
/**
 * Class Abstract_WC_Order_Item_Type_Data_Store file.
 *
 * @package WooCommerce\DataStores
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * WC Order Item Data Store
 *
 * @version  3.0.0
 */
class MKL_PC_Layer_Data_Store extends WC_Data_Store_WP implements WC_Object_Data_Store_Interface {

	/**
	 * Object type.
	 *
	 * @var string
	 */
	protected $object_type = 'layer';

	/**
	 * Meta type. This should match up with
	 * the types available at https://developer.wordpress.org/reference/functions/add_metadata/.
	 * WP defines 'post', 'user', 'comment', and 'term'.
	 *
	 * @var string
	 */
	protected $meta_type = 'layer';

	/**
	 * This only needs set if you are using a custom metadata type (for example payment tokens.
	 * This should be the name of the field your table uses for associating meta with objects.
	 * For example, in payment_tokenmeta, this would be payment_token_id.
	 *
	 * @var string
	 */
	protected $object_id_field_for_meta = 'layer_id';

	/**
	 * Create a new order item in the database.
	 *
	 * @since 3.0.0
	 * @param WC_Order_Item $item Order item object.
	 */
	public function create( &$item ) {
		global $wpdb;

		$wpdb->insert(
			$wpdb->prefix . 'mklpc_layers',
			array(
				'name'          => $item->get_name(),
				'type'          => $item->get_type(),
				'product_id'    => $item->get( 'product_id' ),
				'parent'        => $item->get( 'parent' ),
				'layer_order'   => $item->get( 'order' ),
				'global'        => $item->get( 'global' ),
				'status'        => $item->get_status(),
				'date_modified' => current_time( 'mysql' ),
			)
		);
		$item->set_id( $wpdb->insert_id );
		// $this->save_item_data( $item );
		$item->save_meta_data();
		$item->apply_changes();
		$this->clear_cache( $item );

		do_action( 'mkl_pc_new_' . $this->object_type, $item->get_id(), $item, $item->get( 'product_id') );
	}

	/**
	 * Update a order item in the database.
	 *
	 * @since 3.0.0
	 * @param WC_Order_Item $item Order item object.
	 */
	public function update( &$item ) {
		global $wpdb;

		$changes = $item->get_changes();

		if ( array_intersect( array( 'name', 'type', 'product_id', 'parent', 'layer_order', 'global', 'status', 'date_modified' ), array_keys( $changes ) ) ) {
			$wpdb->update(
				$wpdb->prefix . 'mklpc_layers',
				array(
					'name'          => $item->get_name(),
					'type'          => $item->get_type(),
					'product_id'    => $item->get( 'product_id' ),
					'parent'        => $item->get( 'parent' ),
					'layer_order'   => $item->get( 'order' ),
					'global'        => $item->get( 'global' ),
					'status'        => $item->get_status(),
					'date_modified' => current_time( 'mysql' ),
				),
				array( $this->object_type . '_id' => $item->get_id() )
			);
		} else {
			// Always update the date_modified
			$wpdb->update(
				$wpdb->prefix . 'mklpc_layers',
				array(
					'date_modified' => current_time( 'mysql' ),
				),
				array( 'layer_id' => $item->get_id() )
			);

		}

		// $this->save_item_data( $item );
		$item->save_meta_data();
		$item->apply_changes();
		$this->clear_cache( $item );

		do_action( 'mkl_pc_update_layer', $item->get_id(), $item, $item->get( 'product_id') );
	}

	/**
	 * Remove an order item from the database.
	 *
	 * @since 3.0.0
	 * @param WC_Order_Item $item Order item object.
	 * @param array         $args Array of args to pass to the delete method.
	 */
	public function delete( &$item, $args = array() ) {
		if ( $item->get_id() ) {
			global $wpdb;
			do_action( 'mklpc_before_delete_' . $this->object_type, $item->get_id() );
			$wpdb->delete( $wpdb->prefix . 'mklpc_' . $this->object_type . 's', array( $this->object_type . '_id' => $item->get_id() ) );
			$wpdb->delete( $wpdb->prefix . 'mklpc_' . $this->object_type . 'meta', array( $this->object_type . '_id' => $item->get_id() ) );
			do_action( 'mklpc_delete_' . $this->object_type, $item->get_id() );
			$this->clear_cache( $item );
		}
	}

	/**
	 * Read a order item from the database.
	 *
	 * @since 3.0.0
	 *
	 * @param Layer_Data $item Layer item object.
	 *
	 * @throws Exception If invalid item.
	 */
	public function read( &$item ) {
		global $wpdb;

		$item->set_defaults();

		// Get from cache if available.
		$data = wp_cache_get( 'item-' . $item->get_id(), 'mklpc-' . $this->object_type );

		if ( false === $data ) {
			$data = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$wpdb->prefix}mklpc_{$this->object_type}s WHERE {$this->object_type}_id = %d LIMIT 1;", $item->get_id() ) );
			wp_cache_set( 'item-' . $item->get_id(), $data, 'mklpc-' . $this->object_type );
		}

		if ( ! $data ) {
			throw new Exception(sprintf( __( 'Invalid %s item.', 'woocommerce' ), $this->object_type ) );
		}

		$item->set_props(
			$this->get_object_props_for_reading( $item, $data )
		);

		$item->read_meta_data();
		$item->set_object_read( true );
	}

	/**
	 * Get the object props. 
	 * To be overriden by any child class, when necessary
	 *
	 * @return array
	 */
	protected function get_object_props_for_reading( $item, $data ) {
		return array(
			'id' => $item->get_id(),
			'type' => $data->type,
			'name' => $data->name,
			'parent' => $data->parent,
			'product_id' => $data->product_id,
			'date_modified' => $data->date_modified,
			'global' => $data->global,
			'order' => $data->layer_order,
			'status' => $data->status,
		);
	}

	/**
	 * Saves an item's data to the database / item meta.
	 * Ran after both create and update, so $item->get_id() will be set.
	 *
	 * @since 3.0.0
	 * @param WC_Order_Item $item Order item object.
	 */
	public function save_item_data( &$item ) {
		$id                = $item->get_id();
		$changes           = $item->get_changes();

		// foreach ( $props_to_update as $meta_key => $prop ) {
		// 	update_metadata( 'order_item', $id, $meta_key, $item->{"get_$prop"}( 'edit' ) );
		// }
	}

	/**
	 * Clear meta cache.
	 *
	 * @param WC_Order_Item $item Order item object.
	 */
	public function clear_cache( &$item ) {
		wp_cache_delete( 'item-' . $item->get_id(), 'mklpc-' . $this->object_type );
		// wp_cache_delete( 'order-items-' . $item->get_order_id(), 'orders' );
		wp_cache_delete( $item->get_id(), $this->meta_type . '_meta' );
	}

	/**
	 * Deletes meta based on meta ID.
	 *
	 * @param  WC_Data  $object WC_Data object.
	 * @param  stdClass $meta (containing at least ->id).
	 */
	public function delete_meta( &$object, $meta ) {
		global $wpdb;

		if ( ! isset( $meta->id ) ) {
			return false;
		}

		$db_info = $this->get_db_info();
		$meta_id = absint( $meta->id );

		return (bool) $wpdb->delete( $db_info['table'], array( $db_info['meta_id_field'] => $meta_id ) );
	}

	/**
	 * Add new piece of meta.
	 *
	 * @param  WC_Data  $object WC_Data object.
	 * @param  stdClass $meta (containing ->key and ->value).
	 * @return int meta ID
	 */
	public function add_meta( &$object, $meta ) {
		global $wpdb;

		$db_info = $this->get_db_info();

		$object_id  = $object->get_id();
		$meta_key   = wp_unslash( wp_slash( $meta->key ) );
		$meta_value = maybe_serialize( is_string( $meta->value ) ? wp_unslash( wp_slash( $meta->value ) ) : $meta->value );

		// phpcs:disable WordPress.DB.SlowDBQuery.slow_db_query_meta_value,WordPress.DB.SlowDBQuery.slow_db_query_meta_key
		$result = $wpdb->insert(
			$db_info['table'],
			array(
				$db_info['object_id_field'] => $object_id,
				'meta_key'                  => $meta_key,
				'meta_value'                => $meta_value,
			)
		);
		// phpcs:enable WordPress.DB.SlowDBQuery.slow_db_query_meta_value,WordPress.DB.SlowDBQuery.slow_db_query_meta_key

		return $result ? (int) $wpdb->insert_id : false;
	}

	/**
	 * Update meta.
	 *
	 * @param  WC_Data  $object WC_Data object.
	 * @param  stdClass $meta (containing ->id, ->key and ->value).
	 */
	public function update_meta( &$object, $meta ) {
		global $wpdb;

		if ( ! isset( $meta->id ) || empty( $meta->key ) ) {
			return false;
		}

		// phpcs:disable WordPress.DB.SlowDBQuery.slow_db_query_meta_value,WordPress.DB.SlowDBQuery.slow_db_query_meta_key
		$data = array(
			'meta_key'   => $meta->key,
			'meta_value' => maybe_serialize( $meta->value ),
		);
		// phpcs:enable WordPress.DB.SlowDBQuery.slow_db_query_meta_value,WordPress.DB.SlowDBQuery.slow_db_query_meta_key

		$db_info = $this->get_db_info();

		$result = $wpdb->update(
			$db_info['table'],
			$data,
			array( $db_info['meta_id_field'] => $meta->id ),
			'%s',
			'%d'
		);

		return 1 === $result;
	}

	/**
	 * Table structure is slightly different between meta types, this function will return what we need to know.
	 *
	 * @since  3.0.0
	 * @return array Array elements: table, object_id_field, meta_id_field
	 */
	protected function get_db_info() {
		global $wpdb;

		$meta_id_field = 'meta_id'; // for some reason users calls this umeta_id so we need to track this as well.
		$table         = $wpdb->prefix . 'mklpc_';

		$table          .= $this->meta_type . 'meta';
		$object_id_field = $this->meta_type . '_id';

		// Figure out our field names.
		// if ( 'user' === $this->meta_type ) {
		// 	$meta_id_field = 'umeta_id';
		// 	$table         = $wpdb->usermeta;
		// }

		if ( ! empty( $this->object_id_field_for_meta ) ) {
			$object_id_field = $this->object_id_field_for_meta;
		}

		return array(
			'table'           => $table,
			'object_id_field' => $object_id_field,
			'meta_id_field'   => $meta_id_field,
		);
	}

	public function get_object_id_field_for_meta() {
		return $this->object_id_field_for_meta;
	}
}
