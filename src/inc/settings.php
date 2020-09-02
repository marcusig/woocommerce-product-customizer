<?php

namespace MKL\PC;
/**
 *	
 *	
 * @author   Marc Lacroix
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly
}

if ( ! class_exists('MKL\PC\Settings') ) {

	class Settings {
		private function get_defaults() {
			return apply_filters( 'mkl_pc__settings_defaults', array(
				'save_images' => 'save_to_disk'
			) );
		}

		public function get( $setting = '', $default = false ) {
			$settings = wp_parse_args( get_option( 'mkl_pc__settings' ), $this->get_defaults() );
			if ( $setting ){
				if ( isset( $settings[ $setting ] ) ) return $settings[ $setting ];
				return $default;
			} 
			return $settings;
		}
	}

}