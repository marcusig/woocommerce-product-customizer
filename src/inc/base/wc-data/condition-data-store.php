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
class MKL_PC_Condition_Data_Store extends MKL_PC_Layer_Data_Store {

	/**
	 * Object type.
	 *
	 * @var string
	 */
	protected $object_type = 'condition';

	/**
	 * Meta type. This should match up with
	 * the types available at https://developer.wordpress.org/reference/functions/add_metadata/.
	 * WP defines 'post', 'user', 'comment', and 'term'.
	 *
	 * @var string
	 */
	protected $meta_type = 'condition';

	/**
	 * This only needs set if you are using a custom metadata type (for example payment tokens.
	 * This should be the name of the field your table uses for associating meta with objects.
	 * For example, in payment_tokenmeta, this would be payment_token_id.
	 *
	 * @var string
	 */
	protected $object_id_field_for_meta = 'condition_id';

	/**
	 * Create a new order item in the database.
	 *
	 * @since 3.0.0
	 * @param WC_Order_Item $item Order item object.
	 */
	public function create( &$item ) {
		global $wpdb;

		$wpdb->insert(
			$wpdb->prefix . 'mklpc_conditions',
			array(
				'name'            => $item->get_name(),
				'product_id'      => $item->get( 'product_id' ),
				'condition_order' => $item->get( 'order' ),
				'relationship'    => $item->get( 'relationship' ),
				'rules'           => maybe_serialize( $item->get( 'rules' ) ),
				'actions'         => maybe_serialize( $item->get( 'actions' ) ),
				'enabled'         => $item->get( 'enabled' ),
				'reversible'      => $item->get( 'reversible' ),
				'always_check'    => $item->get( 'always_check' ),
				'date_modified'   => current_time( 'mysql' ),
			)
		);
		$item->set_id( $wpdb->insert_id );
		// $this->save_item_data( $item );
		//$item->save_meta_data();
		$item->apply_changes();
		$this->clear_cache( $item );

		do_action( 'mkl_pc_new_condition', $item->get_id(), $item, $item->get( 'product_id') );
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

		if ( array_intersect( array( 
			'name',
			'condition_order',
			'product_id',
			'date_modified',
			'relationship',
			'rules',
			'actions',
			'enabled',
			'reversible',
			'always_check'
		), array_keys( $changes ) ) ) {
			$wpdb->update(
				$wpdb->prefix . 'mklpc_conditions',
				array(
					'name'            => $item->get_name(),
					'product_id'      => $item->get( 'product_id' ),
					'condition_order' => $item->get( 'order' ),
					'relationship'    => $item->get( 'relationship' ),
					'rules'           => $item->get( 'rules' ),
					'actions'         => $item->get( 'actions' ),
					'enabled'         => $item->get( 'enabled' ),
					'reversible'      => $item->get( 'reversible' ),
					'always_check'    => $item->get( 'always_check' ),
					'date_modified'   => current_time( 'mysql' ),
				),
				array( 'condition_id' => $item->get_id() )
			);
		} else {
			// Always update the date_modified
			$wpdb->update(
				$wpdb->prefix . 'mklpc_conditions',
				array(
					'date_modified' => current_time( 'mysql' ),
				),
				array( 'condition_id' => $item->get_id() )
			);

		}

		// $this->save_item_data( $item );
		// $item->save_meta_data();
		$item->apply_changes();
		$this->clear_cache( $item );

		do_action( 'mkl_pc_update_condition', $item->get_id(), $item, $item->get( 'product_id') );
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
			// $wpdb->delete( $wpdb->prefix . 'mklpc_' . $this->object_type . 'meta', array( $this->object_type . '_id' => $item->get_id() ) );
			do_action( 'mklpc_delete_' . $this->object_type, $item->get_id() );
			$this->clear_cache( $item );
		}
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
			'name' => $data->name,
			'product_id' => $data->product_id,
			'date_modified' => $data->date_modified,
			'order' => $data->condition_order,
			'relationship' => $data->relationship,
			'rules' => $data->rules,
			'actions' => $data->actions,
			'enabled' => $data->enabled,
			'reversible' => $data->reversible,
			'always_check' => $data->always_check,
		);
	}
}
