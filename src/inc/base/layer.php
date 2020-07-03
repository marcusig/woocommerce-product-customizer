<?php
namespace MKL\PC;

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly
}


class Layer { 
	private $ID;
	private $product_id = 0;
	private $label = '';
	private $description = '';
	private $has_choices = true;
	private $image = '';
	private $order = 0;
	private $type = 'simple';

	public function __construct( $args = array() ) {
		$defaults = array();
		wp_parse_args( $args, $defaults );
	}
}
