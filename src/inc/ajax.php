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
					if ( is_user_logged_in() && current_user_can( 'edit_posts' ) ) {
						$data = get_transient( 'mkl_pc_data_init_' . $id );
					}
					if ( ! $data ) {
						$data = $this->db->get_front_end_data( $id );
						set_transient( 'mkl_pc_data_init_' . $id, $data );
					}
				} else {
					$data = $this->db->get_init_data( $id );
				}
				$data = $this->db->escape( $data );
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

		$data = apply_filters('mkl_pc_get_configurator_data', $data, $id);


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
			if ( $this->gzip_accepted() && function_exists( 'gzencode' ) ) {
				header( 'Content-Encoding: gzip' );
				$gzip = true;
			}
			
			$output = 'var PC = PC || {};'."\n";
			$output .= 'PC.productData = PC.productData || {};'."\n";
			// if ( class_exists( 'GTranslate' ) && is_user_logged_in() && current_user_can( 'edit_posts' ) ) {
				// Add compatibility with GTranslate premium, enabling users to manually update translations.
			// 	$output .= "fetch('/wp-admin/admin-ajax.php?action=pc_get_data&data=init&fe=".$_REQUEST['fe']."&id={$id}&ver=1618927876').then(r => r.json()).then(data => {PC.productData.prod_$id = data;});";
			// } else {
			// }
			$output .= 'PC.productData.prod_' . $id . ' = ' . json_encode( $data ) . ';';

			/**
			 * Filter the product's configuration JavaScript object which will be used in the frontend
			 */
			$output = apply_filters( 'mkl_pc_get_configurator_data_js_output', $output, $id );
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

		if (!$data) $data = $_REQUEST[$component];

		// Sanitize the incoming data
		if ( apply_filters( 'mkl_set_configurator_data_sanitize', true ) ) {
			$data = $this->db->sanitize( $data );
		}

		$result = $this->db->set( $id, $ref_id, $component, $data );
		
		// Delete the data transient if it exists, to make sure we don't serve stale data.
		delete_transient( 'mkl_pc_data_init_' . $id );

		wp_send_json_success( $result );
	}

	/**
	 * Purge the configurations cache
	 */
	public function purge_config_cache() {
		Plugin::instance()->cache->purge();
		wp_send_json_success();
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
}