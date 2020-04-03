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
					$data = $this->db->get_front_end_data( $id );
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
			echo 'var PC = PC || {};';
			echo 'PC.productData = ' . json_encode( $data ) . ';';
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

		check_ajax_referer( 'update-pc-post_' . $ref_id, 'nonce' );

		if ( ! current_user_can( 'edit_post', $id ) || ! current_user_can( 'edit_post', $ref_id ) ) {
			wp_send_json_error();
		}

		if( !isset( $_REQUEST['data'] ) ) {
			wp_send_json_error( 'Expecting a data type' );
		}

		// Prepare the posted data
		$component = sanitize_key( $_REQUEST['data'] );

		if ( ! isset( $_REQUEST[$component] ) ) {
			wp_send_json_error( 'No data was received' );
		}

		$data = json_decode(stripslashes($_REQUEST[$component]), true);

		if (!$data) $data = $_REQUEST[$component];

		// Sanitize the incoming data
		$data = $this->db->sanitize( $data );

		$result = $this->db->set( $id, $ref_id, $component, $data );
		
		wp_send_json_success( $result );
	}
}
