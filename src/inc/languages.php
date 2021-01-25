<?php
namespace MKL\PC;

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly
}

class Languages {
	public function __construct() {
		$this->_hooks();
	}

	/**
	 * Add the hooks
	 *
	 * @return void
	 */
	private function _hooks() {
		add_filter( 'mkl_pc_choice_default_settings', [ $this, 'add_settings' ] );
		add_filter( 'mkl_pc_layer_default_settings', [ $this, 'add_settings' ] );
		add_filter( 'mkl_pc_angle_default_settings', [ $this, 'add_settings' ] );
		add_filter( 'mkl_pc_js_config', [ $this, 'add_current_language_to_js' ] );
	}

	/**
	 * Wheter the website is multilingual
	 *
	 * @return boolean
	 */
	public function website_is_multilingual() {
		// WPML
		global $sitepress;
		if ( $sitepress && is_callable( [ $sitepress, 'get_active_languages' ] ) && $sitepress->get_active_languages() ) {
			$this->ml_plugin = 'wpml';
			return true;
		}
		// Check for polylang
		if ( function_exists( 'pll_languages_list' ) ) {
			$this->ml_plugin = 'polylang';
			return true;	
		}
		return false;
	}

	/**
	 * Get the website's languages
	 *
	 * @return array
	 */
	public function get_languages() {
		if ( $this->website_is_multilingual() && 'wpml' === $this->ml_plugin ) {
			global $sitepress;
			return array_keys( $sitepress->get_active_languages() );
		}

		if ( $this->website_is_multilingual() && 'polylang' === $this->ml_plugin ) {
			return pll_languages_list();
		}
		return [];
	}

	/**
	 * get the default language
	 *
	 * @return string|false
	 */
	public function get_default_language() {
		if ( $this->website_is_multilingual() && 'wpml' === $this->ml_plugin ) {
			global $sitepress;
			return $sitepress->get_default_language();
		}

		if ( $this->website_is_multilingual() && 'polylang' === $this->ml_plugin ) {
			return pll_default_language();
		}
		return false;
	}

	/**
	 * Get the current language
	 *
	 * @return string|false
	 */
	public function get_current_language() {
		if ( $this->website_is_multilingual() && 'wpml' === $this->ml_plugin ) {
			global $sitepress;
			return $sitepress->get_current_language();
		}

		if ( $this->website_is_multilingual() && 'polylang' === $this->ml_plugin ) {
			return pll_current_language();
		}
		return false;
	}

	/**
	 * Get the flag's URL for the admin
	 *
	 * @param string $language
	 * @return string
	 */
	public function get_flag( $language ) {
		if ( $this->website_is_multilingual() && 'polylang' === $this->ml_plugin ) {
			global $polylang;
			return $polylang->model->get_language( $language )->get_display_flag_url();
		}

		if ( $this->website_is_multilingual() && 'wpml' === $this->ml_plugin ) {
			global $sitepress;
			return $sitepress->get_flag_url( $language );
		}
		return '';
	}

	/**
	 * Add the basic settings (name and description)
	 *
	 * @param array $settings
	 * @return array
	 */
	public function add_settings( $settings ) {
		if ( ! empty($this->get_languages() ) ) {
			$default = $this->get_default_language();
			foreach( $this->get_languages() as $l ) {
				if ( $default != $l ) {
					$settings['name_'.$l] = array(
						'label' => '<img src="' . $this->get_flag( $l ) . '" alt="' . __( 'Choice label', 'mkl-pc-extra-price' ) . ' ' . $l . '">',
						'type' => 'text',
						'priority' => 11,
					);
					$settings['description_'.$l] = array(
						'label' => '<img src="' . $this->get_flag( $l ) . '" alt="' . __( 'Description', 'mkl-pc-extra-price' ) . ' ' . $l . '">',
						'type' => 'textarea',
						'priority' => 21,
					);
				}
			}
		}
		return $settings;
	}

	/**
	 * Add the current language selection to the JS config
	 *
	 * @param array $config
	 * @return array
	 */
	public function add_current_language_to_js( $config ) {
		if ( $current_language = $this->get_current_language() ) $config['current_language'] = $current_language;
		return $config;
	}
}