<?php
namespace MKL\PC;

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly
}

class Choice { 

	private $layer; 
	private $choices; 
	private $selected_choice; 

	public $is_choice = true; 
	public $layer_id; 
	public $choice_id;  
	public $angle_id; 
	public $product_id; 
	public $variation_id; 
	private $db = null;

	public function __construct( $product_id, $variation_id, $layer_id, $choice_id, $angle_id ) { 

		if( !intval( $product_id ) || !intval( $layer_id ) || !intval( $choice_id ) || !intval( $angle_id ) )
			return false;
		$this->db = Plugin::instance()->db;
		$this->product_id = (int) $product_id; 
		$this->variation_id = (int) $variation_id; 
		$this->layer_id = 	(int) $layer_id; 
		$this->choice_id = 	(int) $choice_id; 
		$this->angle_id = 	(int) $angle_id; 

		$this->set_layer(); 
		
		$this->set_selected_choice();
	}


	public function get( $val ) {
		return $this->$val;
	}

	private function set_layer() {
		
		// get all layers
		$layers = $this->db->get( 'layers', $this->product_id );
		$this->layer = Utils::get_array_item( $layers, '_id', $this->layer_id ); 

		// have to do benchmark here: 
		// either use above functions either database

	}

	private function set_selected_choice(  ) {
		
		
		if( $this->variation_id ) {
			$content = $this->db->get( 'content', $this->variation_id ); 
		} else {
			$content = $this->db->get( 'content', $this->product_id ); 
		}

		$this->choices = Utils::get_array_item( $content, 'layerId', $this->layer_id ); 
		$this->choice = Utils::get_array_item( $this->choices['choices'], '_id', $this->choice_id ); 
		$this->images = Utils::get_array_item( $this->choice['images'], 'angleId', $this->angle_id ); 

		if( count( $this->choices ) < 2 || $this->layer['not_a_choice'] === true || $this->layer['not_a_choice'] === 'true'  ) {
			$this->is_choice = false;
		}
	}

	public function get_layer( $item ) {
		return isset( $this->layer[ $item ] ) ? $this->layer[ $item ] : null;
	}
	public function get_choice( $item ) {

		return isset( $this->choice[ $item ] ) ? $this->choice[ $item ] : null;
	}

	public function get_image( $type = 'image' ) {
		return $this->images[ $type ];
	}

	public function get_image_url( $type ){
		$image = $this->get_image( $type );
		return $image ? $image['url'] : '';
	}
	public function get_image_id( $type ){
		$image = $this->get_image( $type );
		return $image ? $image['id'] : '';
	}


}