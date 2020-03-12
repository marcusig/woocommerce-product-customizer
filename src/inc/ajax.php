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
		// $this->plugin = Plugin::instance()->db;
		if( !$this->db ) {
			$this->db = Plugin::instance()->db;
			// var_dump( (microtime(true) - $start) *1000, 'initialized custmizer data');
		}
	}
	private function _hooks() {
		add_action( 'wp_ajax_pc_get_data', array( $this, 'get_customizer_data' ) );
		add_action( 'wp_ajax_nopriv_pc_get_data', array( $this, 'get_customizer_data' ) );
		add_action( 'wp_ajax_pc_set_data', array( $this, 'set_customizer_data' ) );
	}

	public function get_customizer_data() {
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
				$data = $this->db->get_init_data( $id );
				break;
			case 'menu' :
				$data = $this->db->get_menu();
				break;
			case 'angles' :
				$data = $this->db->get_angles( $id );
				break;
			case 'content' : // = choices
				// var_dump( (microtime(true) - $start) *1000, 'Found that request[data] = content');
				$data = $this->db->get_content( $id );
				break;
			default: 
				$data = $this->db->get( sanitize_key( $_REQUEST['data'] ), $id );
				break;
		}

		$data = apply_filters('mkl_pc_get_customizer_data', $data, $id);

		if ( isset($_REQUEST['view']) && $_REQUEST['view'] =='dump' && defined('WP_DEBUG') && WP_DEBUG == true ) {
			echo 'get_customizer_data was executed in ' . (microtime(true) - $start) *1000 . 'ms and we are about to dump';
			echo '<pre>';
			var_dump($data);
			echo '</pre>';
			echo 'this data was dumped after ' . (microtime(true) - $start) *1000 . 'ms since get_customizer_data executed';

			wp_die();

		} elseif ( isset($_REQUEST['view']) && $_REQUEST['view'] =='js' ) {

			header( 'Content-Type: application/javascript; charset=UTF-8' );
			echo 'var PC = PC || {};';
			echo 'PC.productData = ' . json_encode( $data ) . ';';
			wp_die(); 

		} else { 

			wp_send_json( $data );

		}
	}
	/**

	*/

	public function set_customizer_data() {
		if( !isset($_REQUEST['data'] ) ) {
			wp_send_json('Expecting a data type');
			return false;
		}

		$data = $this->db->set( $_REQUEST['data'] );
		
		// $data = NULL;
		// switch ( $_REQUEST['data'] ) {
		// 	case 'menu' :
		// 		$data = $this->db->set( $_REQUEST['data'] );
		// 		break;
		// 	case 'layers' :
		// 		$data = $this->db->get_layers();
		// 		break;
		// }

		wp_send_json( $data );
	}
}
