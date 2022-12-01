<?php
namespace MKL\PC;

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly
}


class Condition_Data extends \WC_Data {

	/**
	 * Order Data array. This is the core order data exposed in APIs since 3.0.0.
	 *
	 * @since 3.0.0
	 * @var array
	 */
	protected $data = array(
		'name'            => '',
		'product_id'      => 0,
		'condition_order' => 0,
		'relationship'    => 'AND',
		'rules'           => '',
		'actions'         => '',
		'enabled'         => true,
		'reversible'      => false,
		'always_check'    => false,
		'date_modified'   => '',
	);

	/**
	 * Stores meta in cache for future reads.
	 * A group must be set to to enable caching.
	 *
	 * @var string
	 */
	protected $cache_group = 'pc_conditions';

	/**
	 * Meta type. This should match up with
	 * the types available at https://developer.wordpress.org/reference/functions/add_metadata/.
	 * WP defines 'post', 'user', 'comment', and 'term'.
	 *
	 * @var string
	 */
	protected $meta_type = 'pc_condition';

	/**
	 * This is the name of this object type.
	 *
	 * @var string
	 */
	protected $object_type = 'condition';


	/**
	 * Constructor.
	 *
	 * @param int|object|array $item ID to load from the DB, or Choice object.
	 */
	public function __construct( $item = 0 ) {
		parent::__construct( $item );

		if ( $item instanceof Condition_Data ) {
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
		return 'condition';
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

	public function get( $prop, $context = 'view' ) {
		return $this->get_prop( $prop, $context );
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
	
	public function set_rules( $rules ) {
		$this->set_prop( 'rules', $this->db->sanitize( $rules, 'rules' ) );
	}

	public function set_actions( $actions ) {
		$this->set_prop( 'actions', $this->db->sanitize( $actions, 'actions' ) );
	}

	public function set_relationship( $relationship ) {
		$this->set_prop( 'relationship', $this->db->sanitize( $relationship, 'relationship' ) );
	}

	public function set_enabled( $enabled ) {
		$this->set_prop( 'enabled', (bool) $enabled );
	}

	public function set_reversible( $reversible ) {
		$this->set_prop( 'reversible', (bool) $reversible );
	}
	
	public function set_always_check( $always_check ) {
		$this->set_prop( 'always_check', (bool) $always_check );
	}

	public function set_date_modified( $date_modified ) {
		$this->set_date_prop( 'date_modified', $date_modified );
	}

	public function set_order( $order ) {
		$this->set_prop( 'order', (int) $order);
	}
}
