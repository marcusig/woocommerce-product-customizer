<?php

namespace MKL\PC;


/**
 * Data functions
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
				'label' => __( 'Home', 'product-configurator-for-woocommerce' ),
				'title' => __( 'Welcome to the Product Configurator ', 'product-configurator-for-woocommerce' ),
				// 'menu' => array(
				// 	array(
				// 		'class' => 'pc-main-cancel',
				// 		'text' => __( 'Cancel' , 'product-configurator-for-woocommerce' ),
				// 	),
				// 	array(
				// 		'class' => 'button-primary pc-main-save-all',
				// 		'text' => __( 'Save' , 'product-configurator-for-woocommerce' ),
				// 	),

				// ),
				'description' => '',
			),
			array(
				'type' 	=> 'part',
				'menu_id' 	=> 'layers',
				'label' => __( 'Layers', 'product-configurator-for-woocommerce' ),
				'title' => __( 'Layers of the product ', 'product-configurator-for-woocommerce' ),
				'menu' => array(
					array(
						'class' => 'pc-main-cancel',
						'text' => __( 'Cancel' , 'product-configurator-for-woocommerce' ),
					),
					array(
						'class' => 'button-primary pc-main-save-all',
						'text' => __( 'Save' , 'product-configurator-for-woocommerce' ),
					),

				),
				'description' => __( 'Define the layers the product is composed of. ', 'product-configurator-for-woocommerce' ),
			),
			array(
				'type' 	=> 'part',
				'menu_id' 	=> 'angles',
				'label' => __( 'Views', 'product-configurator-for-woocommerce' ),
				'title' => __( 'Angles of the product ', 'product-configurator-for-woocommerce' ),
				'menu' => array(
					array(
						'class' => 'pc-main-cancel',
						'text' => __( 'Cancel' , 'product-configurator-for-woocommerce' ),
					),
					array(
						'class' => 'button-primary pc-main-save-all',
						'text' => __( 'Save' , 'product-configurator-for-woocommerce' ),
					),

				),
				'description' => __( 'Define the view angles, if you want the client to be able to switch between them. ', 'product-configurator-for-woocommerce' ),
			),
			array(
				'type' 	=> 'part',
				'menu_id' 	=> 'content',
				'label' => __( 'Content', 'product-configurator-for-woocommerce' ),
				'title' => __( 'Contents ', 'product-configurator-for-woocommerce' ),
				'menu' => array(
					array(
						'class' => 'pc-main-cancel',
						'text' => __( 'Cancel' , 'product-configurator-for-woocommerce' ),
					),
					array(
						'class' => 'button-primary pc-main-save-all',
						'text' => __( 'Save' , 'product-configurator-for-woocommerce' ),
					),

				),
				'description' => __( 'Define choices for each layer and assign them pictures', 'product-configurator-for-woocommerce' ),
			), 
			// array(
			// 	'type' 	=> 'separator',
			// ),
			// array(
			// 	'type' 	=> 'part',
			// 	'menu_id' 	=> 'import',
			// 	'label' => __( 'Import / Export' , 'product-configurator-for-woocommerce' ),
			// 	'title' => __( 'Import / Export the product\'s data ', 'product-configurator-for-woocommerce' ),
			// 	'bt_save_text' => __( 'Export' , 'product-configurator-for-woocommerce' ),
			// 	'description' => __( 'Description for I/E of the product ', 'product-configurator-for-woocommerce' ),
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
		return apply_filters( 'mkl_product_configurator_content_data', array( 'content' => $this->get( 'content', $post_id ) ), $post_id ); 
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
		$data = maybe_unserialize( $product->get_meta( '_mkl_product_configurator_' . $that ) );
		if ( is_string( $data) ) {
			$data = json_decode($data);
		}
		if( '' == $data || false == $data ) {
			return false; 
		} else {
			/**
			 * Filters the data fetched using the Get method
			 * 
			 * @param $data    - The data filtered
			 * @param $slug    - The slug of the meta data fetched - e.g 'content', 'angles', 'layers'...
			 * @param $product_id - The product ID
			 */
			return apply_filters( 'mkl_pc/db/get', $data, $that, $post_id ); 
		}
	}

	/**
	 * Set Data
	 *
	 * @param integer $id        - The product ID 
	 * @param integer $ref_id    - The referring ID
	 * @param string  $component - Which component to save (Layers, angles, content)
	 * @param array   $raw_data  - The data
	 * @return array
	 */
	public function set( $id, $ref_id, $component, $raw_data ) {
		if( ! $this->is_product( $id ) ) return false;

		if( $ref_id !== $id && !$this->is_product( $ref_id ) ) return false;

		do_action( 'mkl_pc_before_save_product_configuration_'.$component, $id, $raw_data );
		do_action( 'mkl_pc_before_save_product_configuration', $id, $raw_data );

		if ( 'empty' === $raw_data ) {
			$data = array();
		} else {
			// Remove active state. Defaults to first item
			foreach ($raw_data as $key => $value) {
				if( isset( $value['active'] ) ) {
					$raw_data[$key]['active'] = false;
				} elseif( isset( $value['choices'] ) ) {
					foreach ( $value['choices'] as $choice_index => $choice) {
						if( isset( $choice['active'] ) ) {
							$raw_data[$key]['choices'][$choice_index]['active'] = false;
							$raw_data[$key]['choices'][$choice_index] = apply_filters( 'mkl_product_configurator/data/set/choice', $raw_data[$key]['choices'][$choice_index], $id, $raw_data );
						}
					}
				}

			}

			$data = $raw_data;

		}
		$data = apply_filters( 'mkl_product_configurator/data/set/' . $component, $data, $id );
		$product = wc_get_product( $id );
		$product->update_meta_data( '_mkl_product_configurator_last_updated', time() );
		$product->update_meta_data( '_mkl_product_configurator_' . $component , $data );
		$product->save();

		do_action( 'mkl_pc_saved_product_configuration_'.$component, $id, $data );
		do_action( 'mkl_pc_saved_product_configuration', $id );

		return $data;
	}

	/**
	 * Get the product ID for storing the content
	 *
	 * @param int $product_id
	 * @param int $variation_id
	 * @return int
	 */
	public function get_product_id_for_content( $product_id, $variation_id ) {
		$product = wc_get_product( $product_id );
		$mode = $product->get_meta( MKL_PC_PREFIX . '_variable_configuration_mode', true );
		if ( ( ! $mode || 'share_layers_config' == $mode ) && $variation_id ) {
			return $variation_id;
		}
		return $product_id;
	}
	/**
	 * Update a choice
	 *
	 * @param int   $product_id
	 * @param int   $choice_id
	 * @param array $data
	 */
	public function update_choice( $product_id, $variation_id, $layer_id, $choice_id, $data = array() ) {

		if ( empty( $data ) ) return false;

		$product_id = $this->get_product_id_for_content( $product_id, $variation_id );

		$content = $this->get( 'content', $product_id );

		if ( empty( $content ) ) return false;

		foreach( $content as $index => $layer ) {
			if ( $layer_id !== $layer[ 'layerId' ] ) continue;
			foreach( $layer['choices'] as $choice_index => $choice ) {
				if ( $choice_id !== $choice[ '_id' ] ) continue;
				$choice = wp_parse_args( $data, $choice );
				$content[$index]['choices'][$choice_index] = $choice;
				$this->set( $product_id, $product_id, 'content', $content );
				return true;
			}
		}
		return false;
	}

	/**
	 * Get the menu
	 *
	 * @return array
	 */
	public function get_menu(){
		return apply_filters( 'mkl_product_configurator_admin_menu', $this->menu ); 
	}

	/**
	 * Get the basic data structure
	 *
	 * @param integer $id - The product's ID
	 * @return array
	 */
	public function get_init_data( $id ) {

		$product = wc_get_product( $id );
		if ( 'variation' === $product->get_type() ) {
			$parent_id = $product->get_parent_id();
		} else {
			$parent_id = $id;
		}

		$init_data = array(
			// 'menu' => $this->get_menu(),
			'layers' => $this->get('layers', $parent_id),
			'angles' => $this->get('angles', $parent_id),
			'nonces'      => array(
				'update' => false,
				'delete' => false,
			),
			'product_info' => array()
		);

		if ( current_user_can( 'edit_post', $id ) ) $init_data['nonces']['update'] = wp_create_nonce( 'update-pc-post_' . $id );

		if ( current_user_can( 'delete_post', $id ) ) $init_data['nonces']['delete'] = wp_create_nonce( 'delete-pc-post_' . $id );

		return apply_filters( 'mkl_product_configurator_init_data', $init_data, $product );
	}

	/**
	 * Get the Front end Data
	 *
	 * @param integer $id - The product's ID
	 * @return array
	 */
	public function get_front_end_data( $id ) {
		global $product;
		if ( $product ) {
			$g_product = $product;
		} else {
			$g_product = false;
		}

		if ( is_callable( [ mkl_pc( 'frontend' ), 'setup_themes' ] ) ) mkl_pc( 'frontend' )->setup_themes();
		$init_data = $this->get_init_data( $id );
		$product = wc_get_product( $id ); 
		$price = wc_get_price_to_display( $product );
		global $WOOCS;
		if ( $WOOCS && ! isset( $_REQUEST['woocs_block_price_hook'] ) ) {
			$_REQUEST['woocs_block_price_hook'] = 1;
			$price = wc_get_price_to_display( $product );
			unset( $_REQUEST['woocs_block_price_hook'] );
		}

		// Price Based on Country
		if ( function_exists( 'wcpbc_the_zone' ) ) {
			$zone = wcpbc_the_zone();
			$rate = $zone->get_exchange_rate();
			$price = $price / $rate;
		}

		
		// get the products 'title' attribute
		$init_data['product_info'] = array_merge(
			$init_data['product_info'], 
			array(
				'title'        => apply_filters( 'the_title', $product->get_title(), $id ),
				'product_type' => $product->get_type(),
				'show_qty'     => ! $product->is_sold_individually(),
				'show_form'    => apply_filters( 'mkl_pc_show_form', ! $g_product, $id ),
				'is_in_stock'  => $product->is_in_stock() || $product->backorders_allowed(), 
				'price'        => $price,
			) 
		);

		// Allows to load the Contents on the init data to avoid having to use AJAX. 
		if( 'simple' == $product->get_type() ) {
			// the configurator content
			$init_data['content'] = $this->get( 'content', $id );
		}

		return apply_filters( 'mkl_product_configurator_get_front_end_data', $init_data, $product );
	}

	/**
	 * Wether the post is a supported post type
	 *
	 * @param integer $id - The product / post ID
	 * @return boolean
	 */
	public function is_product( $id ) {
		return Utils::is_product( $id );
		// return in_array( get_post_type( $id ), apply_filters( 'mkl_pc_product_post_types', array( 'product', 'product_variation' ) ) );
	}

	/**
	 * Get the accepted fields
	 *
	 * @return array
	 */
	public function get_fields() {
		return apply_filters( 'mkl_pc_db_fields', 
			[
				'layerId' => [ 
					'sanitize' => 'intval',
					'escape' => 'intval',
				],
				'_id' => [ 
					'sanitize' => 'intval',
					'escape' => 'intval',
				],
				'id' => [ 
					'sanitize' => 'intval',
					'escape' => 'intval',
				],
				'layer_id' => [ 
					'sanitize' => 'intval',
					'escape' => 'intval',
				],
				'angle_id' => [ 
					'sanitize' => 'intval',
					'escape' => 'intval',
				],
				'choice_id' => [ 
					'sanitize' => 'intval',
					'escape' => 'intval',
				],
				'ID' => [ 
					'sanitize' => 'intval',
					'escape' => 'intval',
				],
				'height' => [ 
					'sanitize' => 'intval',
					'escape' => 'intval',
				],
				'width' => [ 
					'sanitize' => 'intval',
					'escape' => 'intval',
				],
				'angleId' => [ 
					'sanitize' => 'intval',
					'escape' => 'intval',
				],
				'order' => [ 
					'sanitize' => 'intval',
					'escape' => 'intval',
				],
				'image_order' => [ 
					'sanitize' => 'intval',
					'escape' => 'intval',
				],
				'extra_price' => [ 
					'sanitize' => 'floatval',
					'escape' => 'floatval',
				],
				'name' => [ 
					'sanitize' => 'wp_filter_post_kses',
					'escape' => [ $this, 'escape_description' ],
				],
				'angle_name' => [ 
					'sanitize' => 'sanitize_text_field',
					'escape' => 'esc_html',
				],
				'description' => [ 
					'sanitize' => 'wp_filter_post_kses',
					'escape' => [ $this, 'escape_description' ],
				],
				'custom_html' => [ 
					'sanitize' => [ $this, 'sanitize_custom_html_description' ],
					'escape' => [ $this, 'escape_custom_html_description' ],
				],
				'url' => [ 
					'sanitize' => 'esc_url_raw',
					'escape' => [ $this, 'esc_url' ],
				],
				'class_name' => [ 
					'sanitize' => [ 'MKL\PC\Utils', 'sanitize_html_classes' ],
					'escape' => 'esc_attr',
				],
				'active' => [ 
					'sanitize' => 'boolean',
					'escape' => 'boolean',
				],
				'update' => [ 
					'sanitize' => 'sanitize_key',
					'escape' => 'esc_attr',
				],
				'delete' => [ 
					'sanitize' => 'sanitize_key',
					'escape' => 'esc_attr',
				],
				'image' => [ 
					'sanitize' => [ $this, 'sanitize_image' ],
					'escape' => [ $this, 'esc_image' ],
				],
				'bg_image' => [
					'sanitize' => [ $this, 'sanitize_image' ],
					'escape' => [ $this, 'esc_image' ],
				],
				'product_type' => [ 
					'sanitize' => 'sanitize_key',
					'escape' => 'esc_html',
				],
			]
		);
	}
	
	/**
	 * Sanitize the data
	 *
	 * @param mixed  $data - The data to sanitize
	 * @param string $key
	 * @return mixed
	 */
	public function sanitize( $data, $the_key = '' ) {
		return $this->_sanitize_or_escape( 'sanitize', $data, $the_key );
	}

	/**
	 * Sanitize the data
	 *
	 * @param mixed  $data - The data to sanitize
	 * @param string $key
	 * @return mixed
	 */
	public function escape( $data, $the_key = '' ) {
		return $this->_sanitize_or_escape( 'escape', $data, $the_key );
	}

	public function esc_url( $url ) {
		if ( is_ssl() ) $url = str_ireplace( 'http://', 'https://', $url );
		$url = esc_url( $url );
		return $url;
	}

	public function sanitize_image( $image ) {
		if ( is_int( $image ) ) return intval( $image );
		return esc_url_raw( $image );
	}

	public function esc_image( $image ) {
		if ( is_int( $image ) ) return intval( $image );
		return $this->esc_url( $image );
	}

	public function escape_description( $description ) {
		return wp_kses_post( stripslashes( $description ) );
	}

	public function sanitize_custom_html_description( $html ) {
		$tags = wp_kses_allowed_html( 'post' );
		if ( ! isset( $tags[ 'svg' ] ) ) {
			$tags['svg'] = array(
				'xmlns' => array(),
				'fill' => array(),
				'viewbox' => array(),
				'role' => array(),
				'aria-hidden' => array(),
				'focusable' => array(),
				'width' => array(),
				'height' => array(),
				'class' => array(),
			);
			$tags['path'] = array(
				'd' => array(),
				'fill' => array(),
				'text' => array(),
			);
			$tags['text'] = array(
				'transform' => array(),
				'style' => array('fill', 'font-size'),
				'class' => array(),
			);
		}

		/**
		 * Filters the allowed tags in the custom html fields.
		 * @default - tags allowed in Post content + svg
		 */
		$allowed_tags = apply_filters( 'mkl_pc/custom_html/allowed_tags', $tags );
		$r = wp_kses( $html, $allowed_tags );
		return $r;
	}

	public function escape_custom_html_description( $html ) {
		return $this->sanitize_custom_html_description( stripslashes( $html ) );
	}

	/**
	 * Sanitize the data
	 *
	 * @param mixed  $action - The action to do
	 * @param mixed  $data   - The data to sanitize
	 * @param string $key
	 * @return mixed
	 */
	private function _sanitize_or_escape( $action, $data, $the_key = '' ) {
		$data_type = gettype( $data );
		if ( 'array' === $data_type ) {
			foreach ( $data as $key => $value ) {
				$data[$key] = $this->_sanitize_or_escape( $action, $value, $key );
			}
			return $data;
		}

		if ( 'object' === $data_type ) {
			foreach ( (array) $data as $key => $value ) {
				$data->{$key} = $this->_sanitize_or_escape( $action, $value, $key );
			}
			return $data;
		}

		$supported_fields = $this->get_fields();

		// No key is set, we treat as a text field
		if ( ! $the_key ) return sanitize_text_field( $data );

		// Default to empty field
		if ( ! in_array( $the_key, array_keys( $supported_fields ) ) ) {
			return sanitize_text_field( $data );
		}

		// Default 
		if ( ! isset( $supported_fields[$the_key][$action] ) ) {
			if ( 'sanitize' === $action) return sanitize_text_field( $data );
			return sanitize_text_field( $data );
		}

		if ( is_callable( $supported_fields[$the_key][$action] ) ) {
			$data = call_user_func( $supported_fields[$the_key][$action], $data );
			return $data;
		}

		if ( 'boolean' == $supported_fields[$the_key][$action] ) {
			return filter_var( $data, FILTER_VALIDATE_BOOLEAN );
		}

		error_log( 'MKL Product Configurator: Sanitazing could not be done for the variable ' . $the_key . ' (The function returned and empty string instead)');
		return '';
	}
}

