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
				'save_images' => 'save_to_disk',
				'show_choice_description' => false,
				'show_layer_description' => false,
				'preview_image_size' => 'full',
				'thumbnail_size' => 'thumbnail',
			) );
		}

		public function get( $setting = '', $default = false ) {
			$settings = wp_parse_args( get_option( 'mkl_pc__settings' ), $this->get_defaults() );
			if ( $setting ) {
				if ( isset( $settings[ $setting ] ) ) {
					global $sitepress;
					if ( $sitepress ) {
						$wpml_registered_fields = get_option( 'mkl_pc__wpml_registered_fields', [] );
						if ( isset( $wpml_registered_fields[ $setting ] ) ) {
							return apply_filters( 'wpml_translate_single_string', $settings[ $setting ], 'Product Configurator settings', $wpml_registered_fields[ $setting ] );
						}
					}
					return $settings[ $setting ];
				}
				return $default;
			} 
			return $settings;
		}

		public function get_theme() {
			return apply_filters( 'mkl/pc/theme_id', $this->get( 'mkl_pc__theme' ) );
		}

		/**
		 * Set a setting
		 *
		 * @param string $key
		 * @param mixed  $value
		 * @return void
		 */
		public function set( $key, $value ) {
			$settings = $this->get();
			$settings[$key] = $value;
			update_option( 'mkl_pc__settings', $settings );
		}
	}

}