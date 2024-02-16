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

class Ajax {
	private $db = NULL;

	public function __construct() {
		$this->_hooks();
		if( !$this->db ) {
			$this->db = mkl_pc()->db;
		}
	}

	/**
	 * Setup hooks
	 *
	 * @return void
	 */
	private function _hooks() {
		add_action( 'wp_ajax_pc_get_data', array( $this, 'get_configurator_data' ) );
		add_action( 'wp_ajax_nopriv_pc_get_data', array( $this, 'get_configurator_data' ) );
		add_action( 'wp_ajax_pc_set_data', array( $this, 'set_configurator_data' ) );
		add_action( 'wp_ajax_mkl_pc_purge_config_cache', array( $this, 'purge_config_cache' ) );
		add_action( 'wp_ajax_mkl_pc_toggle_config_images_in_library', array( $this, 'toggle_config_images_in_library' ) );
		add_action( 'wp_ajax_nopriv_mkl_pc_generate_config_image', array( $this, 'generate_config_image' ) );
		add_action( 'wp_ajax_mkl_pc_generate_config_image', array( $this, 'generate_config_image' ) );
		add_action( 'wp_ajax_mkl_pc_fix_image_ids', array( $this, 'fix_image_ids' ) );
		add_action( 'wp_ajax_mkl_pc_fix_image_ids_config', array( $this, 'fix_image_ids_from_configurator' ) );
		add_action( 'wp_ajax_mkl_pc_get_configurable_products', array( $this, 'get_configurable_products' ) );
		add_filter( 'weglot_js-data_treat_page', array( $this, 'weglot_compat' ), 20, 4 );
	}

	/**
	 * Weglot compatibility: translate the script on the fly
	 *
	 * @return string
	 */
	public function weglot_compat( $content, $parser, $original_language, $current_language ) {
		if ( function_exists( 'gzdecode' ) && $c = gzdecode($content) ) {
			// Get the JSON part
			$jsondata = preg_match('/(var PC = .*PC\.productData\.prod_[A-Za-z0-9]* = )(.*);/s', $c, $matches );

			if ( isset( $matches[2] ) ) {
				$translated_content = $parser->translate( $matches[2], $original_language, $current_language, [] );
				$replace_url_services = weglot_get_service( 'Replace_Url_Service_Weglot' );
				$translated_content = wp_json_encode( $replace_url_services->replace_link_in_json( json_decode( $translated_content, true ) ) );
				$output = $matches[1] . $translated_content . ';';
				return gzencode( $output );
				
			}
		}
		return $content;
	}

	/**
	 * Get the configurator Data
	 *
	 * @return void
	 */
	public function get_configurator_data() {
		global $mkltimestart;

		// check_ajax_referer( 'config-ajax', 'security' );

		// var_dump( 'it took ' . ( (microtime(true) - $mkltimestart ) *1000 ). 'ms to get to get_c_data' );

		if( !isset($_REQUEST['data']) || !isset($_REQUEST['id']) ) {
			wp_send_json_error();
			return false;
		}

		$start = microtime(true);
		if( ! $id = absint( $_REQUEST['id'] ) ) {
			wp_send_json_error();
		}

		$data = NULL;
		switch ( $_REQUEST['data'] ) {
			case 'init' :
				// fe parameter, to use in front end.
				if( isset($_REQUEST['fe']) && $_REQUEST['fe'] == 1 ) {
					// Set the context for proper data escaping
					$this->db->set_context( 'frontend' );
					$product = wc_get_product( $id );
					$data_version = $product->get_meta( '_mkl_product_configurator_last_updated' );
					// Translatepress: Do not translate
					add_filter( 'trp_stop_translating_page', '__return_true' );
					if ( is_user_logged_in() && current_user_can( 'edit_posts' ) && ! isset( $_REQUEST['pc-no-transient'] ) ) {
						$cached_data_version = get_transient( 'mkl_pc_data_init_version_' . $id );
						if ( $cached_data_version && $cached_data_version != $data_version ) {
							delete_transient( 'mkl_pc_data_init_' . $id );
							delete_transient( 'mkl_pc_data_init_version_' . $id );
						} else {
							$data = get_transient( 'mkl_pc_data_init_' . $id );
						}
					}

					if ( ! $data ) {
						$data = $this->db->get_front_end_data( $id );
						$data = $this->db->escape( $data );
						if ( is_user_logged_in() && current_user_can( 'edit_posts' ) ) {
							set_transient( 'mkl_pc_data_init_' . $id, $data, 600 );
							set_transient( 'mkl_pc_data_init_version_' . $id, $data_version, 600 );
						}
					}
				} else {
					$data = $this->db->get_init_data( $id );
					$data = $this->db->escape( $data );
				}
				break;
			case 'menu' :
				$data = $this->db->get_menu();
				break;
			case 'angles' :
				$data = $this->db->get_angles( $id );
				$data = $this->db->escape( $data );
				break;
			case 'content' : // = choices
				// var_dump( (microtime(true) - $start) *1000, 'Found that request[data] = content');
				$data = $this->db->get_content( $id );
				$data = $this->db->escape( $data );
				break;
			default: 
				$data = $this->db->get( sanitize_key( $_REQUEST['data'] ), $id );
				$data = $this->db->escape( $data );
				break;
		}

		$data = apply_filters( 'mkl_pc_get_configurator_data', $data, $id );

		if ( isset($_REQUEST['view']) && $_REQUEST['view'] === 'dump' && defined('WP_DEBUG') && WP_DEBUG === true ) {
			echo 'get_configurator_data was executed in ' . (microtime(true) - $start) *1000 . 'ms and we are about to dump';
			echo '<pre>';
			var_dump($data);
			echo '</pre>';
			echo 'this data was dumped after ' . (microtime(true) - $start) *1000 . 'ms since get_configurator_data executed';
			wp_die();
		} elseif ( isset($_REQUEST['view']) && 'js' === $_REQUEST['view'] ) {
			header( 'Content-Type: application/javascript; charset=UTF-8' );
			$gzip = false;
			$disable_gzip = mkl_pc( 'settings' )->get( 'disable_configuration_gzip', false );
			if ( apply_filters( 'mkl_pc_get_configurator_gzip_data_js_output', ! $disable_gzip ) && $this->gzip_accepted() && function_exists( 'gzencode' ) ) {
				header( 'Content-Encoding: gzip' );
				$gzip = true;
			}

			// Weglot: set a custom page type to treat it
			add_filter( 'weglot_type_treat_page',  function() {
				return 'js-data';
			} );

			$output = 'var PC = PC || {};'."\n";
			$output .= 'PC.productData = PC.productData || {};'."\n";
			$output .= 'PC.productData.prod_' . $id . ' = ' . json_encode( $data ) . ';';

			/**
			 * Filter the product's configuration JavaScript object which will be used in the frontend
			 *
			 * @param string $output - JS output
			 * @param int    $id     - Product ID
			 * @param array  $data   - The configurator data 
			 */
			$output = apply_filters( 'mkl_pc_get_configurator_data_js_output', $output, $id, $data );
			if ( $gzip ) {
				echo gzencode( $output );
			} else {
				echo $output;
			}
			wp_die();
		} else { 
			wp_send_json( $data );
		}
	}

	/**
	 * Save the configurator Data
	 *
	 * @return void
	 */
	public function set_configurator_data() {

		// CHECK IF THE REQUIRED FIELDS WERE SENT
		if ( ! isset( $_REQUEST['id'] ) ) wp_send_json_error();

		if ( ! $id = absint( $_REQUEST['id'] ) ) wp_send_json_error();

		// CHECK IF THE USER IS ALLOWED TO EDIT 
		$ref_id = $id;

		if( isset($_REQUEST['parent_id'] ) ) {
			$ref_id = absint( $_REQUEST['parent_id'] );
		}

		if ( ! check_ajax_referer( 'update-pc-post_' . $ref_id, 'nonce', false ) ) {
			wp_send_json_error( __( 'Error saving the data:', 'product-configurator-for-woocommerce' ). ' '.__( 'The session seems to have expired.', 'product-configurator-for-woocommerce' ) );
		}

		if ( ! current_user_can( 'edit_post', $id ) || ! current_user_can( 'edit_post', $ref_id ) ) {
			wp_send_json_error();
		}

		if ( !isset( $_REQUEST['data'] ) ) {
			wp_send_json_error( 'Expecting a data type' );
		}

		// Prepare the posted data
		$component = sanitize_key( $_REQUEST['data'] );

		if ( ! isset( $_REQUEST[$component] ) ) {
			wp_send_json_error( 'No data was received' );
		}

		if ( apply_filters( 'mkl_set_configurator_data_sanitize', true ) ) {
			$data = json_decode(stripslashes($_REQUEST[$component]), true);
		}

		if ( empty( $data ) ) $data = $_REQUEST[$component];

		// Sanitize the incoming data
		if ( apply_filters( 'mkl_set_configurator_data_sanitize', true ) ) {
			$data = $this->db->sanitize( $data );
		}

		$result = $this->db->set( $id, $ref_id, $component, $data, isset( $_REQUEST['modified_choices'] ) ? $_REQUEST['modified_choices'] : false );
		
		/**
		 * Action mkl_pc_saved_configurator_data, triggered when an item is saved
		 *
		 * @param int          $id               - Product / variation ID
		 * @param int          $ref_id           - Product ID
		 * @param string       $component        - The component saved (content, layers, angles...)
		 * @param array        $data             - The data saved
		 * @param array|false  $modified_choices - An array of modified choices
		 */
		do_action( 'mkl_pc_saved_configurator_data', $id, $ref_id, $component, $data, isset( $_REQUEST['modified_choices'] ) ? $_REQUEST['modified_choices'] : false );

		// Delete the data transient if it exists, to make sure we don't serve stale data.
		delete_transient( 'mkl_pc_data_init_' . $id );
		if ( $ref_id && $ref_id != $id) {
			delete_transient( 'mkl_pc_data_init_' . $ref_id );
		}

		wp_send_json_success( $result );
	}

	/**
	 * Purge the configurations cache
	 */
	public function purge_config_cache() {
		if ( ! current_user_can( 'manage_woocommerce' ) ) wp_send_json_error( '', 403 );
		Plugin::instance()->cache->purge();
		wp_send_json_success();
	}

	/**
	 * Purge the configurations cache
	 */
	public function toggle_config_images_in_library() {
		if ( ! current_user_can( 'manage_woocommerce' ) || ! wp_verify_nonce( $_REQUEST[ 'security' ], 'mlk_pc_settings-options' ) ) wp_send_json_error( '', 403 );
		$mode = mkl_pc( 'settings' )->get( 'show_config_images_in_the_library', true );
		if ( $mode ) {
			// Will hide the images
			$new_status = 'configuration';
		} else {
			// Will show the images
			$new_status = 'inherit';
		}

		global $wpdb;
		$res = $wpdb->query(
			$wpdb->prepare(
				"UPDATE $wpdb->posts SET `post_status` = '$new_status' WHERE `post_type` = 'attachment' AND `guid` LIKE '%mkl-pc-config-images%'"
			)
		);

		$settings = mkl_pc( 'settings' )->set( 'show_config_images_in_the_library', ! $mode );

		wp_send_json_success( [
			'mode' => ! $mode,
			'message' => sprintf( __( '%d rows were affected', 'product-configurator-for-woocommerce' ), $res )
		] );
	}

	/**
	 * Fix image ids after a transfer
	 */
	public function fix_image_ids() {
		if ( ! current_user_can( 'manage_woocommerce' ) || ! wp_verify_nonce( $_REQUEST[ 'security' ], 'mlk_pc_settings-options' ) ) wp_send_json_error( '', 403 );
		if ( ! $id = absint( $_REQUEST['id'] ) ) wp_send_json_error();
		delete_transient( 'mkl_pc_data_init_' . $id );
		wp_send_json_success( [ 'changed_items' => $this->db->scan_product_images( $id ) ] );
	}

	/**
	 * Fix image ids after a transfer
	 */
	public function fix_image_ids_from_configurator() {
		if ( ! current_user_can( 'manage_woocommerce' ) ) wp_send_json_error( '', 403 );
		if ( ! $id = absint( $_REQUEST['id'] ) ) wp_send_json_error();
		if ( ! check_ajax_referer( 'update-pc-post_' . $id, 'security', false ) ) {
			wp_send_json_error( __( 'Error processing the request:', 'product-configurator-for-woocommerce' ). ' '.__( 'The session seems to have expired.', 'product-configurator-for-woocommerce' ), 403 );
		}
		delete_transient( 'mkl_pc_data_init_' . $id );
		$changed_items = $this->db->scan_product_images( $id );
		$layers = $this->db->get( 'layers', $id );
		$layers = $this->db->escape( $layers );

		$angles = $this->db->get( 'angles', $id );
		$angles = $this->db->escape( $angles );

		$content = $this->db->get( 'content', $id );
		$content = $this->db->escape( $content );

		wp_send_json_success( [ 'layers' => $layers, 'angles' => $angles, 'content' => $content, 'changed_items' => $changed_items ] );
	}

	/**
	 * Generate the configuration image	(asynchronously)
	 */
	public function generate_config_image() {
		
		if ( empty( $_REQUEST['data'] ) ) wp_send_json_error( 'No data to process' );

		// Extract the temporary suffix: The name should contain '-temp-'
		$temp_offset = strpos( $_REQUEST['data'], '-temp-' );
		
		// Exit if the suffix was not found in the name
		if ( false === $temp_offset ) wp_send_json_error( 'No data to process' );
		
		// Extract the nonce which is storred after the suffix
		$nonce = substr( $_REQUEST['data'], $temp_offset + 6 );
		// Exit if the file name doesn't contain a valid nonce
		if ( ! $nonce || ! wp_verify_nonce( $nonce, 'generate-image-from-temp-file' ) ) wp_send_json_error( 'Unauthorized action', 403 );
		
		$config = new Configuration();
		$config->image_name = sanitize_file_name( rtrim( $_REQUEST['data'] , '-temp-' . $nonce ) );
		$image_id = $config->save_image( $_REQUEST['data'] );
		if ( $image_id ) {
			$image = wp_get_attachment_image_url( $image_id, 'woocommerce_thumbnail' );
			if ( $image ) wp_send_json_success( [ 'url' => $image ] );
		}
		if ( isset( $_REQUEST['product_id'] ) ) {
			$product = wc_get_product( intval( $_REQUEST['product_id'] ) );
			if ( $product ) {
				$image = $product->get_image( 'woocommerce_thumbnail' );
				if ( $image ) wp_send_json_success( [ 'url' => $image, 'format' => 'html' ] );
			}
		}		
		wp_send_json_success( [ 'url' => '' ] );
	}
	
	/**
	 * Get the current request http headers
	 *
	 * @return array
	 */
	private function get_http_headers() {
		static $headers;
	
		if (!empty($headers)) return $headers;
	
		$headers = array();
	
		// if is apache server then use get allheaders() function.
		if (function_exists('getallheaders')) {
			$headers = getallheaders();
		} else {
			// https://www.php.net/manual/en/function.getallheaders.php
			foreach ($_SERVER as $key => $value) {
	
				$key = strtolower($key);
	
				if ('HTTP_' == substr($key, 0, 5)) {
					$headers[str_replace(' ', '-', ucwords(str_replace('_', ' ', substr($key, 5))))] = $value;
				} elseif ('content_type' == $key) {
					$headers["Content-Type"] = $value;
				} elseif ('content_length' == $key) {
					$headers["Content-Length"] = $value;
				}
			}
		}
	
		return $headers;
	}

	/**
	 * Check if GZIP is accepted by the request
	 */
	private function gzip_accepted() {
		$headers = $this->get_http_headers();
		return isset($headers['Accept-Encoding']) && preg_match('/gzip/i', $headers['Accept-Encoding']) && false === strpos( $_SERVER['SERVER_SOFTWARE'], 'LiteSpeed' );
	}

	public function get_configurable_products() {
		if ( ! current_user_can( 'manage_woocommerce' ) || ! wp_verify_nonce( $_REQUEST[ 'security' ], 'mlk_pc_settings-options' ) ) wp_send_json_error( '', 403 );
		if ( $data = get_transient( 'mkl_get_configurable_products' ) ) wp_send_json_success( $data );
		$args = array(
			'limit' => -1,
			'meta_query' => array(
				array(
					'key' => MKL_PC_PREFIX.'_is_configurable',
					'value' => 'yes',
					'compare' => '=',
				)
			)
		 );
		 
		$products = wc_get_products( $args );
		if ( $products ) {
			$data = [];
			foreach( $products as $product ) {
				$data[] = [
					'id' => $product->get_id(),
					'name' => $product->get_name(),
				];
			}
		}

		// Cache the data for 5 min
		set_transient( 'mkl_get_configurable_products', $data, 300 );
		wp_send_json_success( $data );
	}
}