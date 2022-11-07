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
class MKL_PC_Choice_Data_Store extends MKL_PC_Layer_Data_Store {

	/**
	 * Object type.
	 *
	 * @var string
	 */
	protected $object_type = 'choice';

	/**
	 * Meta type. This should match up with
	 * the types available at https://developer.wordpress.org/reference/functions/add_metadata/.
	 * WP defines 'post', 'user', 'comment', and 'term'.
	 *
	 * @var string
	 */
	protected $meta_type = 'choice';

	/**
	 * This only needs set if you are using a custom metadata type (for example payment tokens.
	 * This should be the name of the field your table uses for associating meta with objects.
	 * For example, in payment_tokenmeta, this would be payment_token_id.
	 *
	 * @var string
	 */
	protected $object_id_field_for_meta = 'choice_id';

	/**
	 * Create a new order item in the database.
	 *
	 * @since 3.0.0
	 * @param WC_Order_Item $item Order item object.
	 */
	public function create( &$item ) {
		global $wpdb;

		$wpdb->insert(
			$wpdb->prefix . 'mklpc_choices',
			array(
				'name'          => $item->get_name(),
				'layer_id'      => $item->get( 'layer_id' ),
				'parent'        => $item->get( 'parent' ),
				'choice_order'  => $item->get( 'order' ),
				'status'        => $item->get_status(),
				'date_modified' => current_time( 'mysql' ),
			)
		);
		$item->set_id( $wpdb->insert_id );
		// $this->save_item_data( $item );
		$item->save_meta_data();
		$item->apply_changes();
		$this->clear_cache( $item );

		do_action( 'mkl_pc_new_choice', $item->get_id(), $item, $item->get( 'product_id') );
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

		if ( array_intersect( array( 'name', 'layer_id', 'parent', 'choice_order', 'status', 'date_modified' ), array_keys( $changes ) ) ) {
			$wpdb->update(
				$wpdb->prefix . 'mklpc_choices',
				array(
					'name'          => $item->get_name(),
					'layer_id'      => $item->get( 'layer_id' ),
					'parent'        => $item->get( 'parent' ),
					'choice_order'  => $item->get( 'order' ),
					'status'        => $item->get_status(),
					'date_modified' => current_time( 'mysql' ),
				),
				array( 'choice_id' => $item->get_id() )
			);
		} else {
			// Always update the date_modified
			$wpdb->update(
				$wpdb->prefix . 'mklpc_choices',
				array(
					'date_modified' => current_time( 'mysql' ),
				),
				array( 'choice_id' => $item->get_id() )
			);

		}

		// $this->save_item_data( $item );
		$item->save_meta_data();
		$item->apply_changes();
		$this->clear_cache( $item );

		do_action( 'mkl_pc_update_choice', $item->get_id(), $item, $item->get( 'layer_id') );
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
			'layer_id' => $data->layer_id,
			'name' => $data->name,
			'parent' => $data->parent,
			'date_modified' => $data->date_modified,
			'order' => $data->choice_order,
			'status' => $data->status,
		);
	}
}
