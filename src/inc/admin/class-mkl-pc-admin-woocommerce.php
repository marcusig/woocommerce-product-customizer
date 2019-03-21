<?php
/**
 * Woocommerce related functions
 *	Hooks
 *	
 * @author   Marc Lacroix
 */


if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly
}
if ( ! class_exists( 'Mkl_Pc_Admin_Woocommerce' ) ) {

	class Mkl_Pc_Admin_Woocommerce extends Mkl_Pc_Admin {

		public function __construct( $plugin ) {
			parent::__construct( $plugin );
			$this->hooks();
		}



		// public function woocommerce_loaded() {
		// 	global $post;
		// 	var_dump($post);
		// 	die();
		// 	$this->ID = $post->ID;
		// 	$this->_product = wc_get_product( $this->ID );

		// }


	}

	if( ! function_exists( 'mkl_pc_init_admin') ) {
		function mkl_pc_init_admin( $plugin ) {
			return new Mkl_Pc_Admin_Woocommerce( $plugin );
		}
	}
} 