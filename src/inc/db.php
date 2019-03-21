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


class DB { 

	/**
	 *
	 * 
	 */
	private $menu = array();
	private $layers = array();

	public function __construct() {
		$default_menu = array(
			array(
				'type' 	=> 'part',
				'menu_id' 	=> 'home',
				'label' => __( 'Home', MKL_PC_DOMAIN ),
				'title' => __( 'Welcome to the Product Customizer ', MKL_PC_DOMAIN ),
				// 'menu' => array(
				// 	array(
				// 		'class' => 'pc-main-cancel',
				// 		'text' => __( 'Cancel' , MKL_PC_DOMAIN ),
				// 	),
				// 	array(
				// 		'class' => 'button-primary pc-main-save-all',
				// 		'text' => __( 'Save all' , MKL_PC_DOMAIN ),
				// 	),
				// 	array(
				// 		'class' => 'button-primary pc-main-save',
				// 		'text' => __( 'Save layers' , MKL_PC_DOMAIN ),
				// 	),

				// ),
				'description' => __( 'Define the layers the product is composed of. ', MKL_PC_DOMAIN ),
			),
			array(
				'type' 	=> 'part',
				'menu_id' 	=> 'layers',
				'label' => __( 'Layers', MKL_PC_DOMAIN ),
				'title' => __( 'Layers of the product ', MKL_PC_DOMAIN ),
				'menu' => array(
					array(
						'class' => 'pc-main-cancel',
						'text' => __( 'Cancel' , MKL_PC_DOMAIN ),
					),
					array(
						'class' => 'button-primary pc-main-save-all',
						'text' => __( 'Save all' , MKL_PC_DOMAIN ),
					),
					array(
						'class' => 'button-primary pc-main-save',
						'text' => __( 'Save layers' , MKL_PC_DOMAIN ),
					),

				),
				'description' => __( 'Define the layers the product is composed of. ', MKL_PC_DOMAIN ),
			),
			array(
				'type' 	=> 'part',
				'menu_id' 	=> 'angles',
				'label' => __( 'Views', MKL_PC_DOMAIN ),
				'title' => __( 'Angles of the product ', MKL_PC_DOMAIN ),
				'menu' => array(
					array(
						'class' => 'pc-main-cancel',
						'text' => __( 'Cancel' , MKL_PC_DOMAIN ),
					),
					array(
						'class' => 'button-primary pc-main-save-all',
						'text' => __( 'Save all' , MKL_PC_DOMAIN ),
					),
					array(
						'class' => 'button-primary pc-main-save',
						'text' => __( 'Save angles' , MKL_PC_DOMAIN ),
					),

				),
				'description' => __( 'Define the view angles, if you want the client to be able to switch between them. ', MKL_PC_DOMAIN ),
			),
			array(
				'type' 	=> 'part',
				'menu_id' 	=> 'content',
				'label' => __( 'Content', MKL_PC_DOMAIN ),
				'title' => __( 'Contents ', MKL_PC_DOMAIN ),
				'menu' => array(
					array(
						'class' => 'pc-main-cancel',
						'text' => __( 'Cancel' , MKL_PC_DOMAIN ),
					),
					array(
						'class' => 'button-primary pc-main-save-all',
						'text' => __( 'Save all' , MKL_PC_DOMAIN ),
					),
					array(
						'class' => 'button-primary pc-main-save',
						'text' => __( 'Save contents' , MKL_PC_DOMAIN ),
					),

				),
				'description' => __( 'Define choices for each layer and assign them pictures', MKL_PC_DOMAIN ),
			), 
			// array(
			// 	'type' 	=> 'separator',
			// ),
			// array(
			// 	'type' 	=> 'part',
			// 	'menu_id' 	=> 'import',
			// 	'label' => __( 'Import / Export' , MKL_PC_DOMAIN ),
			// 	'title' => __( 'Import / Export the product\'s data ', MKL_PC_DOMAIN ),
			// 	'bt_save_text' => __( 'Export' , MKL_PC_DOMAIN ),
			// 	'description' => __( 'Description for I/E of the product ', MKL_PC_DOMAIN ),
			// ),

		);

		$this->menu = $default_menu;

	}

	// public function get_layers() {
	// 	$product_id = null;
		
	// 	if(isset($_REQUEST['product_id'])) { 

	// 		$product_id = $_REQUEST['product_id']; 
	// 		$product = wc_get_product( $product_id ); 
	// 		$layers =  maybe_unserialize( get_post_meta( $product_id, 'mkl_product_customizer_layers', true ) ); 

	// 		$test = array( array("name"=>"whatever", "description"=>"A description", "order"=>1), array("name"=>"Layer 2", "description"=>"A description 2","order"=>0) ); 

	// 		return apply_filters( 'mkl_product_customizer_layers', $test ); 

	// 	} elseif( $put = json_decode(file_get_contents("php://input")) ) { 
			
	// 		if( !isset( $put->id )) { 
	// 			return 4;
	// 		} 
	// 		return true; 
	// 	}
	// }
	/*
	@Structure
	@returns a products basic structure
	-> the basic structure is for ONE simple product, or is common to all of a products VARIATIONS. 
	-> it includes: LAYERS, ANGLES
	*/
	public function get_structure() {

		return apply_filters( 'mkl_product_customizer_pc_structure', array(
			'layers' => $this->get('layers'),
			'angles' => $this->get('angles'),
		) );
		
	}

	public function set_structure() {

		$this->set( 'structure' ); 

	}

	/*
	@Choices
	@returns a products choices
	-> The choices are for ONE simple product, or ONE VARIATION. 
	-> LAYERS and ANGLES have to be set before being able to add choices. 
	-> One choice has to be set for each LAYER and each ANGLE
	*/
	public function get_content( $post_id ) {
		// return apply_filters( 'mkl_product_customizer_init_data', $init_data, $product );
		return apply_filters( 'mkl_product_customizer_content_data', array( 'content' => $this->get( 'content', $post_id ) ), $post_id ); 
	}

	public function get_angles( $post_id ) {

		return array( 'angles' => $this->get( 'angles', $post_id ) ); 

	}

	public function get( $that, $post_id ) {

		if( ! is_string($that) ) 
			return false;

		if( ! $this->is_product( $post_id ) )
			return [false, $post_id];

		$product = wc_get_product($post_id);
		$data = maybe_unserialize( $product->get_meta( '_mkl_product_customizer_' . $that ) );

		if( '' == $data || false == $data ) {
			return false; 
		} else {
			return $data; 
		}
	}

	public function set_choices() {
		$this->set('choices');
	}

	public function set( $that ) {
		// CHECK IF THE REQUIRED FIELDS WERE SENT
		if ( ! isset( $_REQUEST['id'] ) || ! isset( $_REQUEST[$that] ) ) //|| ! isset( $_REQUEST['changes'] )
			wp_send_json_error();

		if ( ! $id = absint( $_REQUEST['id'] ) )
			wp_send_json_error();

		// CHECK IF THE USER IS ALLOWED TO EDIT 
		$ref_id = $id;

		if( isset($_REQUEST['parent_id'] ) ) {
			$ref_id = absint( $_REQUEST['parent_id'] );
		}

		check_ajax_referer( 'update-pc-post_' . $ref_id, 'nonce' );
		
		if ( ! current_user_can( 'edit_post', $id ) || ! current_user_can( 'edit_post', $ref_id ) )
			wp_send_json_error();

		
		if( ! $this->is_product( $id ) )
			wp_send_json_error();

		if( $ref_id != $id ) {
			if( ! $this->is_product( $ref_id ) )
				wp_send_json_error();
		}


		if( $_REQUEST[$that] === 'empty') {
			$data = '';
		} else {
			// Remove active state. Defaults to first item
			foreach ($_REQUEST[$that] as $key => $value) {
				if( isset( $value['active'] ) ) {
					$_REQUEST[$that][$key]['active'] = false;
				} elseif( isset( $value['choices'] ) ) {
					foreach ( $value['choices'] as $choice_index => $choice) {
						if( isset( $choice['active'] ) ) {
							$_REQUEST[$that][$key]['choices'][$choice_index]['active'] = false;
						}
					}
				}

			}

			$data = $this->sanitize( $_REQUEST[$that] ) ;

		}
		$product = wc_get_product( $id );
		$t = $product->update_meta_data( '_mkl_product_customizer_' . $that , $data );
		$product->save();
		return 1;

	}

	public function get_menu(){

		return apply_filters( 'mkl_product_customizer_admin_menu', $this->menu ); 

	}

	public function get_init_data() { 

		$product = null;

		if ( ! isset( $_REQUEST['id'] ) ) //|| ! isset( $_REQUEST['changes'] )
			wp_send_json_error();

		if ( ! $id = absint( $_REQUEST['id'] ) )
			wp_send_json_error();

		$init_data = array(
			// 'menu' => $this->get_menu(),
			'layers' => $this->get('layers', $id),
			'angles' => $this->get('angles', $id),
			'nonces'      => array(
				'update' => false,
				'delete' => false,
				// 'edit'   => false
			),

		);

		// fe parameter, to use in front end.
		if( isset($_REQUEST['fe']) && $_REQUEST['fe'] == 1 ) {
			if( $this->is_product( $id ) ) { 
				$product = wc_get_product( $id ); 
				// get the products 'title' attribute
				$init_data['product_info'] = array(
					'title' => apply_filters( 'the_title', $product->get_title(), $id ),
					'bg_image' => 'http://unoiseaudepapier.loc/wp-content/uploads/2017/12/bg-2.jpg',
					'product_type' => $product->get_type(),
				); 

				// Allows to load the Contents on the init data to avoid having to use AJAX. 
				if( $product->get_type() == 'simple' ) {
					// the customizer content
					$init_data['content'] = $this->get( 'content', $id ); 
				}
			}
		}

		if ( current_user_can( 'edit_post', $id ) ) {
			$init_data['nonces']['update'] = wp_create_nonce( 'update-pc-post_' . $id );
			// $init_data['nonces']['edit'] = wp_create_nonce( 'image_editor-' . $id );
			// $init_data['editLink'] = get_edit_post_link( $id, 'raw' );
		}

		if ( current_user_can( 'delete_post', $id ) )
			$init_data['nonces']['delete'] = wp_create_nonce( 'delete-pc-post_' . $id );

		return apply_filters( 'mkl_product_customizer_init_data', $init_data, $product );
	}

	private function is_product( $id ) {

		return in_array( get_post_type( $id ), apply_filters( 'mkl_pc_product_post_types', array( 'product', 'product_variation' ) ) );

	}

	public function sanitize( $data ) {
		switch ( gettype( $data ) ) {
			case 'boolean':
			case 'integer':
			case 'double':
			case 'NULL':
				return $data;
			case 'string':
				// the booleans from js are converted to string, we put them back in booleans.
				if( $data === 'true' || $data === 'false' ) {
					return filter_var($data, FILTER_VALIDATE_BOOLEAN);
				}
				return wp_kses_post( $data ); 
				// These values can be passed through.
			case 'array':
				// Arrays must be mapped in case they also return objects.
				foreach ($data as $key => $value) {
					$data[$key] = $this->sanitize( $value ); 
				}
				return $data;
			default:
				return null;
		}

	}

	// public function get_data( )
}

