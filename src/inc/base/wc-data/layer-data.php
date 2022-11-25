<?php
namespace MKL\PC;

use Exception;
use MKL\PC\Layer_Data as PCLayer_Data;

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly
}


class Layer_Data extends \WC_Data {

	/**
	 * Order Data array. This is the core order data exposed in APIs
	 *
	 * @since 3.0.0
	 * @var array
	 */
	protected $data = array(
		'product_id'    => 0,
		'type'          => 'simple',
		'global'        => 0,
		'name'          => '',
		'display_mode'  => 'default',
		'admin_label'   => '',
		'parent'        => 0,
		'date_modified' => 0,
		'class_name'    => '',
		'order'         => 0,
		'status'        => 'published',
	);

	/**
	 * Stores meta in cache for future reads.
	 * A group must be set to to enable caching.
	 *
	 * @var string
	 */
	protected $cache_group = 'pc_layers';

	/**
	 * Meta type. This should match up with
	 * the types available at https://developer.wordpress.org/reference/functions/add_metadata/.
	 * WP defines 'post', 'user', 'comment', and 'term'.
	 *
	 * @var string
	 */
	protected $meta_type = 'pc_layer';

	/**
	 * This is the name of this object type.
	 *
	 * @var string
	 */
	protected $object_type = 'layer';

	/**
	 * Constructor.
	 *
	 * @param int|object|array $item ID to load from the DB, or Layer object.
	 */
	public function __construct( $item = 0 ) {
		parent::__construct( $item );
		$this->db = mkl_pc()->db;
		if ( $item instanceof Layer_Data ) {
			$this->set_id( $item->get_id() );
		} elseif ( is_numeric( $item ) && $item > 0 ) {
			$this->set_id( $item );
		} else {
			$this->set_object_read( true );
		}

		$this->data_store = \WC_Data_Store::load( 'pc-' . $this->get_object_type() );
		if ( $this->get_id() > 0 ) {
			$this->data_store->read( $this );
		}
	}

	/**
	 * Get item type. Can be overridden by child classes.
	 *
	 * @return string
	 */
	public function get_object_type() {
		return 'layer';
	}

	/**
	 * Get product ID
	 *
	 * @param  string $context What the value is for. Valid values are 'view' and 'edit'.
	 * @return string
	 */
	public function get_product_id( $context = 'view' ) {
		return $this->get_prop( 'product_id', $context );
	}

	/**
	 * Get order item name.
	 *
	 * @param  string $context What the value is for. Valid values are 'view' and 'edit'.
	 * @return string
	 */
	public function get_name( $context = 'view' ) {
		return $this->get_prop( 'name', $context );
	}

	/**
	 * Get order item name.
	 *
	 * @param  string $context What the value is for. Valid values are 'view' and 'edit'.
	 * @return string
	 */
	public function get_type( $context = 'view' ) {
		return $this->get_prop( 'type', $context );
	}

	/**
	 * Get order item name.
	 *
	 * @param  string $context What the value is for. Valid values are 'view' and 'edit'.
	 * @return string
	 */
	public function get_status( $context = 'view' ) {
		return $this->get_prop( 'status', $context );
	}

	public function get( $prop, $context = 'view' ) {
		return $this->get_prop( $prop, $context );
	}

	public function get_meta_type() {
		return $this->meta_type;
	}

	/**
	 * SETTERS
	 */

	public function set_product_id( $product_id ) {
		$this->set_prop( 'product_id', (int) $product_id);
	}
	
	public function set_name( $name ) {
		$this->set_prop( 'name', $this->db->sanitize( $name, 'name' ) );
	}

	public function set_status( $status ) {
		$this->set_prop( 'status', $this->db->sanitize( $status, 'status' ) );
	}

	public function set_type( $type ) {
		$this->set_prop( 'type', $this->db->sanitize( $type, 'type' ) );
	}

	public function set_parent( $parent ) {
		$this->set_prop( 'parent', (int) $parent);
	}

	public function set_date_modified( $date_modified ) {
		$this->set_date_prop( 'date_modified', $date_modified );
	}
	
	public function set_global( $global ) {
		$this->set_prop( 'global', (int) $global );
	}

	public function set_order( $order ) {
		$this->set_prop( 'order', (int) $order);
	}

}
