<?php
namespace MKL\PC;

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly
}

#[\AllowDynamicProperties]
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
	public $content_id; // The product ID used to store the content
	public $layer_data; 
	public $choice;
	public $images;
	public $thumbnail;
	public $option_label;
	public $field_value;

	public function __wakeup() {
		do_action( 'mkl_pc/choice/wakeup', $this );
		// $this->set_selected_choice();
	}

	public function __sleep() {
		do_action( 'mkl_pc/choice/sleep', $this );
		return apply_filters( 'mkl_pc_choice_sleep_properties', [
			'product_id',
			'variation_id',
			'layer_id',
			'choice_id',
			'angle_id',
			'layer_data',
			'content_id'
		], $this );
	}

	/**
	 * Clone - Refresh data from database
	 */
	public function __clone() {
		$this->set_layer(); 
		$this->set_selected_choice();
	}

	public function maybe_set_things_up() {
		$setup = false;
		if ( null === $this->layer ) {
			$this->set_layer(); 
			$setup = true;
		}
		if ( null === $this->choice ) {
			$this->set_selected_choice();
			$setup = true;
		}
		if ( $setup ) do_action( 'mkl_pc/choice/init', $this, $this->layer_data );
	}

	public function __construct( $product_id, $variation_id, $layer_id, $choice_id, $angle_id, $layer_data = false ) { 

		if ( !intval( $product_id ) || !intval( $layer_id ) || !intval( $angle_id ) ) return false;
		$this->product_id   = (int) $product_id;
		$this->variation_id = (int) $variation_id;
		$this->layer_id 	= (int) $layer_id;
		$this->choice_id 	= (int) $choice_id;
		$this->angle_id 	= (int) $angle_id;
		$this->layer_data   = $layer_data;

		$this->set_layer(); 
		
		$this->set_selected_choice();

		do_action( 'mkl_pc/choice/init', $this, $layer_data );
	}


	public function get( $val ) {
		return isset( $this->$val ) ? $this->$val : false;
	}

	private function set_layer() {
		// $this->maybe_set_things_up();
		// get all layers
		$layers = $this->get_db()->get( 'layers', $this->product_id );
		$this->layer = Utils::get_array_item( $layers, '_id', $this->layer_id );
		// have to do benchmark here: 
		// either use above functions either database

	}

	private function set_selected_choice(  ) {

		if ( ! $this->content_id ) $this->content_id = $this->get_db()->get_product_id_for_content( $this->product_id, $this->variation_id );

		$content = $this->get_db()->get( 'content', $this->content_id );

		if ( $this->choice_id && $content ) {
			$this->choices = apply_filters( 'mkl_pc_choice_set_selected_choice__choices', Utils::get_array_item( $content, 'layerId', $this->layer_id ), $this ); 
		}

		if ( $this->choices ) {
			$this->choice  = apply_filters( 'mkl_pc_choice_set_selected_choice__choice', Utils::get_array_item( $this->choices['choices'], '_id', $this->choice_id ), $this ); 
			$this->images  = apply_filters( 'mkl_pc_choice_set_selected_choice__images', ( $this->choice ? Utils::get_array_item( $this->choice['images'], 'angleId', $this->angle_id ) : false ), $this ); 
		} else {
			$this->choices = apply_filters( 'mkl_pc_choice_set_selected_choice__choices', [], $this ); 
			$this->choice  = apply_filters( 'mkl_pc_choice_set_selected_choice__choice', false, $this ); 
			$this->images  = apply_filters( 'mkl_pc_choice_set_selected_choice__images', false, $this );
		}
	}

	public function set_layer_value( $key, $value ) {
		if ( ! $this->layer ) return false;
		$this->layer[ $key ] = $value;
	}

	public function get_layer( $item ) {
		$this->maybe_set_things_up();
		return isset( $this->layer[ $item ] ) ? $this->layer[ $item ] : null;
	}

	public function get_choice( $item ) {
		$this->maybe_set_things_up();
		return property_exists( $this, 'choice' ) && isset( $this->choice[ $item ] ) ? $this->choice[ $item ] : null;
	}

	public function set_choice( $key, $value ) {

		if ( ! $this->choice ) return false;

		$this->choice[ $key ] = $value;
	}

	public function get_image( $type = 'image' ) {
		$this->maybe_set_things_up();
		if ( ! $this->images || ! is_array(  $this->images ) || ! isset( $this->images[ $type ] ) ) return '';
		return $this->images[ $type ];
	}

	public function get_choice_thumbnail() {
		$this->maybe_set_things_up();

		if ( $this->thumbnail ) return $this->thumbnail;

		$angles = $this->get_db()->get( 'angles', $this->product_id );
		$images = isset( $this->choice['images'] ) ? $this->choice['images'] : null;

		if ( is_array( $angles ) && is_array( $images ) ) {
			// Default to first item
			$selected_angle = $angles[0];
			foreach( $angles as $angle ) {
				if ( isset( $angle['has_thumbnails'] ) && $angle['has_thumbnails'] ) {
					$selected_angle = $angle;
				}
			}
			$res = wp_list_filter( $images, [ 'angleId' => $selected_angle['_id'] ] );
			$image = reset( $res ) ?: [];
			$this->thumbnail = isset( $image['thumbnail'] ) ? $image['thumbnail'] : [];
		} else {
			$this->thumbnail = [];
		}
		
		return $this->thumbnail;
	}

	public function get_image_url( $type = 'image' ){
		$image = $this->get_image( $type );
		return $image ? $image['url'] : '';
	}
	
	public function get_image_id( $type = 'image' ){
		$image = $this->get_image( $type );
		return $image ? $image['id'] : '';
	}

	public function get_choice_by_id( $id ) {
		$this->maybe_set_things_up();
		return Utils::get_array_item( $this->choices['choices'], '_id', $id );
	}
	
	public function is_choice() {
		return is_null( $this->get_layer( 'not_a_choice' ) ) || ! $this->get_layer( 'not_a_choice' );
	}

	/**
	 * For older data which didn't save the layer_data, give an option to populate it.
	 * Usefull for older orders
	 *
	 * @param stdClass $layer_data
	 * @return void
	 */
	public function set_layer_data( $layer_data ) {
		if ( ! empty( $this->layer_data ) ) return;
		$this->layer_data = $layer_data;
		do_action( 'mkl_pc/choice/init', $this, $this->layer_data );
	}

	private function get_db() {
		return Plugin::instance()->db;
	}

}