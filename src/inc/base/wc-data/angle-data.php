<?php
namespace MKL\PC;

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly
}


class Angle_Data extends Layer_Data {

	/**
	 * Order Data array. This is the core order data exposed in APIs since 3.0.0.
	 *
	 * @since 3.0.0
	 * @var array
	 */
	protected $data = array(
		'product_id'    => 0,
		'name'          => '',
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
	protected $cache_group = 'pc_angles';

	/**
	 * Meta type. This should match up with
	 * the types available at https://developer.wordpress.org/reference/functions/add_metadata/.
	 * WP defines 'post', 'user', 'comment', and 'term'.
	 *
	 * @var string
	 */
	protected $meta_type = 'pc_angle';

	/**
	 * This is the name of this object type.
	 *
	 * @var string
	 */
	protected $object_type = 'angle';


	/**
	 * Constructor.
	 *
	 * @param int|object|array $item ID to load from the DB, or Choice object.
	 */
	public function __construct( $item = 0 ) {
		parent::__construct( $item );

		if ( $item instanceof Angle_Data ) {
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
		return 'angle';
	}
}
