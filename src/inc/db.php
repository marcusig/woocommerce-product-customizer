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
	private $changed_items_count = 0;
	private $context = 'admin';

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
				'order' => 10,
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
				'order' => 20,
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
				'order' => 30,
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
				'order' => 40,
			),
		);

		if ( ! class_exists( 'MKL_PC_Conditional_Logic_Admin' ) && ! get_user_meta( get_current_user_id(), 'mkl_pc_hide_addon__conditional_placeholder', true )  ) {
			$default_menu[] = array(
				'type' 	=> 'separator',
				'order' => 100,
			);
	
			$default_menu[] = array(
				'type' 	=> 'part',
				'menu_id' 	=> 'conditional_placeholder',
				'label' => __( 'Conditional settings', 'product-configurator-for-woocommerce' ),
				'title' => __( 'Conditional settings ', 'product-configurator-for-woocommerce' ),
				'menu' => array(
					array(
						'class' => 'pc-main-cancel',
						'text' => __( 'Cancel', 'product-configurator-for-woocommerce' ),
					),
				),
				'description' => __( 'Define the conditions for displaying or not the choices / layers', 'mkl-pc-conditional-logic' ),
				'order' => 101,
			);			
		}
		$this->menu = $default_menu;

		// Add tne import section at the end of the menu
		add_filter( 'mkl_product_configurator_admin_menu', [ $this, 'add_import_section' ], 1200 );

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
	 * @param integer $product_id
	 * @return boolean|array
	 */
	public function get( $that, $product_id ) {

		if ( ! is_string( $that ) ) return false;

		if ( ! $this->is_product( $product_id ) ) return false;

		$product = wc_get_product( $product_id );

		if ( ! $product || ! is_a( $product, 'WC_Product' ) ) return false;

		$data = $product->get_meta( '_mkl_product_configurator_' . $that );

		$data = maybe_unserialize( $data );

		if ( is_string( $data) ) {
			$data = json_decode( stripslashes( $data ), 1 );
		}

		if ( '' == $data || false == $data ) {
			return false; 
		} else {
			/**
			 * Filters the data fetched using the Get method
			 * 
			 * @param $data       - The data filtered
			 * @param $that       - The slug of the meta data fetched - e.g 'content', 'angles', 'layers'...
			 * @param $product_id - The product ID
			 */
			return apply_filters( 'mkl_pc/db/get', $data, $that, $product_id ); 
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
	public function set( $id, $ref_id, $component, $raw_data, $modified_choices = false ) {
		if( ! $this->is_product( $id ) ) return false;

		if( $ref_id !== $id && !$this->is_product( $ref_id ) ) return false;

		do_action( 'mkl_pc_before_save_product_configuration_'.$component, $id, $raw_data );
		do_action( 'mkl_pc_before_save_product_configuration', $id, $raw_data );

		if ( 'empty' === $raw_data ) {
			$data = array();
		} elseif ( is_array( $raw_data ) ) {
			// Remove active state. Defaults to first item
			foreach ($raw_data as $key => $value) {
				if( isset( $value['active'] ) ) {
					$raw_data[$key]['active'] = false;
				} elseif( isset( $value['choices'] ) ) {
					foreach ( $value['choices'] as $choice_index => $choice) {
						if ( isset( $choice['active'] ) ) {
							$raw_data[$key]['choices'][$choice_index]['active'] = false;
							$raw_data[$key]['choices'][$choice_index] = apply_filters( 'mkl_product_configurator/data/set/choice', $raw_data[$key]['choices'][$choice_index], $id, $raw_data, $modified_choices );
						}
					}
				}
			}
			$data = $raw_data;
		} else {
			$data = $raw_data;
		}

		$data = apply_filters( 'mkl_product_configurator/data/set/' . $component, $data, $id );
		$product = wc_get_product( $id );
		$product->update_meta_data( '_mkl_product_configurator_last_updated', time() );
		$product->update_meta_data( '_mkl_product_configurator_' . $component , $data );
		$product->save();

		// WPML Sync custom field
		do_action( 'wpml_sync_custom_field', $id, '_mkl_product_configurator_' . $component );
		do_action( 'wpml_sync_custom_field', $id, '_mkl_product_configurator_last_updated' );
		
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
		if ( ! $product ) return 0;
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
	 * @param int   $variation_id
	 * @param int   $layer_id
	 * @param int   $choice_id
	 * @param array $data
	 * @return boolean
	 */
	public function update_choice( $product_id, $variation_id, $layer_id, $choice_id, $data = array() ) {

		if ( empty( $data ) ) return false;

		$product_id = $this->get_product_id_for_content( $product_id, $variation_id );

		if ( ! $product_id ) return false;

		$content = $this->get( 'content', $product_id );

		if ( empty( $content ) ) return false;

		foreach( $content as $index => $layer ) {
			if ( $layer_id !== $layer[ 'layerId' ] ) continue;
			foreach( $layer['choices'] as $choice_index => $choice ) {
				if ( $choice_id !== $choice[ '_id' ] ) continue;
				$choice = wp_parse_args( $data, $choice );
				$content[$index]['choices'][$choice_index] = $choice;
				$this->set( $product_id, $product_id, 'content', $content, [ $layer_id . '_' . $choice_id ] );
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
	 * Add tne import section to the menu
	 */
	public function add_import_section( $menu ) {
		return array_merge(
			$menu, 
			array(
				array(
					'type' 	=> 'separator',
					'order' => 1190,
				),
				array(
					'type' 	=> 'part',
					'menu_id' 	=> 'import',
					'label' => __( 'Import / Export' , 'product-configurator-for-woocommerce' ),
					'title' => __( 'Import / Export the product\'s data ', 'product-configurator-for-woocommerce' ),
					'bt_save_text' => __( 'Export' , 'product-configurator-for-woocommerce' ),
					'description' => '',
					'order' => 1200,
					// __( 'Description for I/E of the product ', 'product-configurator-for-woocommerce' ),
				),
			)
		);
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

		return apply_filters( 'mkl_product_configurator_init_data', $init_data, $product );
	}

	/**
	 * Get the Front end Data
	 *
	 * @param integer $id - The product's ID
	 * @return array
	 */
	public function get_front_end_data( $id ) {
		// global $product;
		// if ( $product ) {
		// 	$g_product = $product;
		// } else {
		// 	$g_product = false;
		// }
		$this->set_context( 'frontend' );
		if ( is_callable( [ mkl_pc( 'frontend' ), 'setup_themes' ] ) ) mkl_pc( 'frontend' )->setup_themes();
		$init_data = $this->get_init_data( $id );
		$product = wc_get_product( $id );
		
		if ( ! $product ) return [];

		$product_type = apply_filters( 'mkl_product_configurator_get_front_end_data/product_type', $product->get_type(), $product );
		// get the products 'title' attribute
		$init_data['product_info'] = array_merge(
			$init_data['product_info'], 
			array(
				'title'         => apply_filters( 'the_title', $product->get_title(), $id ),
				'product_type'  => $product_type,
				'show_qty'      => ! $product->is_sold_individually(),
				'is_in_stock'   => $product->is_in_stock() || $product->backorders_allowed(), 
				'is_purchasable'   => $product->is_purchasable(), 
				'weight'        => $product->get_weight(),
				'weight_unit'   => get_option( 'woocommerce_weight_unit' ),
				'qty_min_value' => apply_filters( 'woocommerce_quantity_input_min', 1, $product ),
				'qty_max_value' => apply_filters( 'woocommerce_quantity_input_max', $product->backorders_allowed() ? '' : $product->get_stock_quantity(), $product ),
			) 
		);

		// Allows to load the Contents on the init data to avoid having to use AJAX. 
		if( 'simple' == $product_type ) {
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
				'choiceId' => [ 
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
				'weight' => [ 
					'sanitize' => 'floatval',
					'escape' => 'floatval',
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
					'sanitize' => [ $this, 'sanitize_description' ],
					'escape' => [ $this, 'escape_description' ],
				],
				'admin_label' => [ 
					'sanitize' => [ $this, 'sanitize_description' ],
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
				'is_default' => [ 
					'sanitize' => 'boolean',
					'escape' => 'boolean',
				],
				'is_group' => [ 
					'sanitize' => 'boolean',
					'escape' => 'boolean',
				],
				'show_group_label_in_cart' => [
					'sanitize' => 'boolean',
					'escape' => 'boolean',
				],
				'hide_in_cart' => [ 
					'sanitize' => 'boolean',
					'escape' => 'boolean',
				],
				'hide_in_configurator' => [ 
					'sanitize' => 'boolean',
					'escape' => 'boolean',
				],
				'use_in_cart' => [ 
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
				'parent' => [ 
					'sanitize' => 'intval',
					'escape' => 'intval',
				],
			],
			$this
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
	 * Escape the data
	 *
	 * @param mixed  $data - The data to escape
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
	
	public function sanitize_description( $description ) {
		return wp_kses( stripslashes( $description ), 'post' );
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
				'id' => array(),
			);
			$tags['path'] = array(
				'd' => array(),
				'fill' => array(),
				'stroke' => array(),
				'stroke-width' => array(),
				'text' => array(),
				'class' => array(),
				'transform' => array(),
				'data-layer_id' => array(),
				'id' => array(),
			);
			$tags['line'] = array(
				'x1' => array(),
				'y1' => array(),
				'x2' => array(),
				'y2' => array(),
				'class' => array(),
				'fill' => array(),
				'stroke' => array(),
				'stroke-width' => array(),
				'transform' => array(),
				'data-layer_id' => array(),
				'id' => array(),
			);			
			$tags['rect'] = array(
				'x' => array(),
				'y' => array(),
				'width' => array(),
				'height' => array(),
				'class' => array(),
				'fill' => array(),
				'stroke' => array(),
				'stroke-width' => array(),
				'transform' => array(),
				'data-layer_id' => array(),
				'id' => array(),
			);

			$tags['circle'] = array(
				'cx' => array(),
				'cy' => array(),
				'r' => array(),
				'class' => array(),
				'fill' => array(),
				'stroke' => array(),
				'stroke-width' => array(),
				'transform' => array(),
				'data-layer_id' => array(),
				'id' => array(),
			);
			$tags['ellipse'] = array(
				'cx' => array(),
				'cy' => array(),
				'rx' => array(),
				'ry' => array(),
				'class' => array(),
				'fill' => array(),
				'stroke' => array(),
				'stroke-width' => array(),
				'transform' => array(),
				'data-layer_id' => array(),
				'id' => array(),
			);
			$tags['text'] = array(
				'transform' => array(),
				'style' => array('fill', 'font-size'),
				'class' => array(),
				'id' => array(),
			);
			$tags['defs'] = array();
			$tags['style'] = array();
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
	 * Scan and fix images
	 */
	public function scan_product_images( $product_id ) {
		// UPDATE the content
		$content = $this->get( 'content', $product_id );
		if ( is_array( $content ) ) {
			foreach( $content as $key => $item ) {
				if ( is_array( $item[ 'choices' ] ) ) {
					foreach( $item[ 'choices' ] as $choice_key => $choice ) {
						if ( isset( $choice[ 'images' ] ) && is_array( $choice[ 'images' ] ) ) {
							foreach( $choice[ 'images' ] as $ik => $image ) {
								if ( isset( $image[ 'image' ] ) && $image[ 'image' ]['url'] ) {
									$new_image_id = $this->_find_image_id( $image[ 'image' ]['url'], $image[ 'image' ]['id'] );
									$new_url = wp_get_attachment_url( $new_image_id );
									if ( $new_image_id && $new_image_id != $image[ 'image' ]['id'] || $new_url != $image[ 'image' ]['url'] ) {
										$content[ $key ][ 'choices' ][ $choice_key ][ 'images' ][ $ik ][ 'image' ][ 'id' ] = $new_image_id;
										$content[ $key ][ 'choices' ][ $choice_key ][ 'images' ][ $ik ][ 'image' ][ 'url' ] = wp_get_attachment_url( $new_image_id );
									}
								}
								if ( isset( $image[ 'thumbnail' ] ) && $image[ 'thumbnail' ]['url'] ) { 									
									$new_thumbnail_id = $this->_find_image_id( $image[ 'thumbnail' ]['url'], $image[ 'thumbnail' ]['id'] );
									if ( $new_thumbnail_id && $new_thumbnail_id != $image[ 'thumbnail' ]['id'] ) {
										$content[ $key ][ 'choices' ][ $choice_key ][ 'images' ][ $ik ][ 'thumbnail' ][ 'id' ] = $new_thumbnail_id;
										$content[ $key ][ 'choices' ][ $choice_key ][ 'images' ][ $ik ][ 'thumbnail' ][ 'url' ] = wp_get_attachment_url( $new_thumbnail_id );
									}

								}
							}
							
						}
					}
				}
			}
		}
		$this->set( $product_id, $product_id, 'content', $content );

		// Update the angles
		$angles = $this->get( 'angles', $product_id );
		if ( is_array( $angles ) ) {
			foreach( $angles as $key => $angle ) {
				if ( isset( $angle[ 'image' ] ) && $angle[ 'image' ]['url'] ) {
					$new_angle_id = $this->_find_image_id( $angle[ 'image' ]['url'], $angle[ 'image' ]['id'] );
					if ( $new_angle_id && $new_angle_id != $angle[ 'image' ]['id'] ) {
						$angles[ $key ][ 'image' ][ 'id' ] = $new_angle_id;
						$angles[ $key ][ 'image' ][ 'url' ] = wp_get_attachment_url( $new_angle_id );
					}
				}
			}
		}

		$this->set( $product_id, $product_id, 'angles', $angles );
		
		// Update the layers
		$layers = $this->get( 'layers', $product_id );
		if ( is_array( $layers ) ) {
			foreach( $layers as $key => $layer ) {
				if ( isset( $layer[ 'image' ] ) && $layer[ 'image' ]['url'] ) {
					$new_layer_id = $this->_find_image_id( $layer[ 'image' ]['url'], $layer[ 'image' ]['id'] );
					if ( $new_layer_id && $new_layer_id != $layer[ 'image' ]['id'] ) {
						$layers[ $key ][ 'image' ][ 'id' ] = $new_layer_id;
						$layers[ $key ][ 'image' ][ 'url' ] = wp_get_attachment_url( $new_layer_id );
					}
				}
			}
		}
		$this->set( $product_id, $product_id, 'layers', $layers );

		return $this->changed_items_count;
	}

	/**
	 * Find a matching ID for a specific URL
	 *
	 * @param string  $url
	 * @param integer $original_id
	 * @return integer
	 */
	private function _find_image_id( $url, $original_id, $exact_match = false ) {
		// Check if original ID matches
		if ( wp_get_attachment_url( $original_id ) == $url ) return $original_id;

		// Search for the URL
		if ( $exact_match ) {
			// Search for an item with the exact url (e.g. 2021/10/image.png)
			$matching_image = attachment_url_to_postid( $url );
		} else {
			// Search for an item with the exact name only (e.g. /image.png)
			$matching_image = $this->_attachment_filename_to_postid( $url );
		}
		if ( $matching_image ) {
			$this->changed_items_count++;
			return $matching_image;
		}
		return $original_id;
	}

	/**
	 * Similar to attachment_url_to_postid, but using the file name only, ignoring the folder structure.
	 * Useful after migrating a configuration later in time
	 */
	private function _attachment_filename_to_postid( $url ) {
		global $wpdb;

		$image_path = pathinfo( $url );
	
		// Force the protocols to match if needed.
		if ( ! isset( $image_path['basename'] ) ) return false;
		
		$sql = $wpdb->prepare(
			"SELECT post_id, meta_value FROM $wpdb->postmeta WHERE meta_key = '_wp_attached_file' AND meta_value LIKE %s",
			'%/'.$image_path['basename']
		);
	
		$results = $wpdb->get_results( $sql );
		$post_id = null;
	
		if ( $results ) {
			// Use the first available result, but prefer a case-sensitive match, if exists.
			$post_id = reset( $results )->post_id;

			if ( count( $results ) > 1 ) {
				// Look for exact match
				$exact_id = attachment_url_to_postid( $url );
				if ( $exact_id ) $post_id = $exact_id;
			}
		}

		return $post_id ? $post_id : false;
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

	public function get_context() {
		return $this->context;
	}

	public function set_context( $c) {
		return $this->context = $c;
	}
}
