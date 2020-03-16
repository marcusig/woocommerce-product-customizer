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

	/**
	 * Initialize the class
	 */
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

	/**
	 * Get the content data
	 *
	 * @param integer $post_id
	 * @return array
	 */
	public function get_content( $post_id ) {
		return apply_filters( 'mkl_product_customizer_content_data', array( 'content' => $this->get( 'content', $post_id ) ), $post_id ); 
	}

	/**
	 * Get the angles
	 *
	 * @param integer $post_id
	 * @return array
	 */
	public function get_angles( $post_id ) {
		return array( 'angles' => $this->get( 'angles', $post_id ) ); 
	}

	/**
	 * Getter
	 *
	 * @param string  $that
	 * @param integer $post_id
	 * @return boolean|array
	 */
	public function get( $that, $post_id ) {

		if( ! is_string($that) ) return false;

		if( ! $this->is_product( $post_id ) ) return false;

		$product = wc_get_product($post_id);
		$data = maybe_unserialize( $product->get_meta( '_mkl_product_customizer_' . $that ) );
		if (is_string($data)) {
			$data = json_decode($data);
		}
		if( '' == $data || false == $data ) {
			return false; 
		} else {
			return $data; 
		}
	}

	/**
	 * Set Data
	 *
	 * @param integer $id
	 * @param integer $ref_id
	 * @param string  $component
	 * @param array   $raw_data
	 * @return array
	 */
	public function set( $id, $ref_id, $component, $raw_data ) {
		if( ! $this->is_product( $id ) ) return false;

		if( $ref_id !== $id && !$this->is_product( $ref_id ) ) return false;

		if( 'empty' === $raw_data ) {
			$data = '';
		} else {
			// Remove active state. Defaults to first item
			foreach ($raw_data as $key => $value) {
				if( isset( $value['active'] ) ) {
					$raw_data[$key]['active'] = false;
				} elseif( isset( $value['choices'] ) ) {
					foreach ( $value['choices'] as $choice_index => $choice) {
						if( isset( $choice['active'] ) ) {
							$raw_data[$key]['choices'][$choice_index]['active'] = false;
						}
					}
				}

			}

			$data = $this->sanitize( $raw_data ) ;

		}

		$product = wc_get_product( $id );
		$product->update_meta_data( '_mkl_product_customizer_' . $component , $data );
		$product->save();

		do_action( 'mkl_pc_saved_product_configuration_'.$component, $id, $data );
		do_action( 'mkl_pc_saved_product_configuration', $id );

		return $data;
	}

	/**
	 * Get the menu
	 *
	 * @return array
	 */
	public function get_menu(){
		return apply_filters( 'mkl_product_customizer_admin_menu', $this->menu ); 
	}

	/**
	 * Get the basic data structure
	 *
	 * @param integer $id - The product's ID
	 * @return array
	 */
	public function get_init_data( $id ) {

		$product = wc_get_product( $id );
		$init_data = array(
			// 'menu' => $this->get_menu(),
			'layers' => $this->get('layers', $id),
			'angles' => $this->get('angles', $id),
			'nonces'      => array(
				'update' => false,
				'delete' => false,
			),
			'product_info' => array()
		);

		if ( current_user_can( 'edit_post', $id ) ) $init_data['nonces']['update'] = wp_create_nonce( 'update-pc-post_' . $id );

		if ( current_user_can( 'delete_post', $id ) ) $init_data['nonces']['delete'] = wp_create_nonce( 'delete-pc-post_' . $id );

		return apply_filters( 'mkl_product_customizer_init_data', $init_data, $product );
	}

	/**
	 * Get the Front end Data
	 *
	 * @param integer $id - The product's ID
	 * @return array
	 */
	public function get_front_end_data( $id ) {
		$init_data = $this->get_init_data( $id );
		$product = wc_get_product( $id ); 
		// get the products 'title' attribute
		$init_data['product_info'] = array_merge(
			$init_data['product_info'], 
			array(
				'title' => apply_filters( 'the_title', $product->get_title(), $id ),
				'bg_image' => apply_filters( 'mkl_pc_bg_image', MKL_PC_ASSETS_URL.'images/default-bg.jpg'),
				'product_type' => $product->get_type(),
			) 
		);

		// Allows to load the Contents on the init data to avoid having to use AJAX. 
		if( $product->get_type() == 'simple' ) {
			// the customizer content
			$init_data['content'] = $this->get( 'content', $id ); 
		}

		return apply_filters( 'mkl_product_customizer_get_front_end_data', $init_data, $product );
	}

	/**
	 * Wether the post is a supported post type
	 *
	 * @param integer $id - The product / post ID
	 * @return boolean
	 */
	public function is_product( $id ) {
		return in_array( get_post_type( $id ), apply_filters( 'mkl_pc_product_post_types', array( 'product', 'product_variation' ) ) );
	}

	/**
	 * Sanitize the data
	 *
	 * @param mixed $data - The data to sanitize
	 * @return mixed
	 */
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
			case 'object':
				// Arrays must be mapped in case they also return objects.
				foreach ((array) $data as $key => $value) {
					$data->{$key} = $this->sanitize( $value );
				}
				return $data;
			default:
				return null;
		}

	}
}

