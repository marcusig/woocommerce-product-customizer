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
				$flag_url = $this->get_flag( $l );
				if ( $default != $l ) {
					if ( isset( $settings[ '_general' ] ) && isset( $settings[ '_general' ][ 'fields' ] ) ) {
						$settings[ '_general' ][ 'fields' ]['name_'.$l] = array(
							'label' => $flag_url ? '<img src="' . esc_url( $flag_url ) . '" alt="' . __( 'Name', 'product-configurator-for-woocommerce' ) . ' ' . $l . '">' : __( 'Name', 'product-configurator-for-woocommerce' ) . ' ' . $l,
							'type' => 'text',
							'priority' => 11,
						);
						$settings[ '_general' ][ 'fields' ]['description_'.$l] = array(
							'label' => $flag_url ? '<img src="' . esc_url( $flag_url ) . '" alt="' . __( 'Description', 'product-configurator-for-woocommerce' ) . ' ' . $l . '">' : __( 'Description', 'product-configurator-for-woocommerce' ) . ' ' . $l,
							'type' => 'textarea',
							'priority' => 21,
							'condition' => '!data.not_a_choice',
						);
	
					} else {
						$settings['name_'.$l] = array(
							'label' => $flag_url ? '<img src="' . esc_url( $flag_url ) . '" alt="' . __( 'Name', 'product-configurator-for-woocommerce' ) . ' ' . $l . '">': __( 'Name', 'product-configurator-for-woocommerce' ) . ' ' . $l,
							'type' => 'text',
							'priority' => 11,
						);
						$settings['description_'.$l] = array(
							'label' => $flag_url ? '<img src="' . esc_url( $flag_url ) . '" alt="' . __( 'Description', 'product-configurator-for-woocommerce' ) . ' ' . $l . '">': __( 'Description', 'product-configurator-for-woocommerce' ) . ' ' . $l,
							'type' => 'textarea',
							'priority' => 21,
							'condition' => '!data.not_a_choice',
						);
					}
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

		// WCML
		global $woocommerce_wpml;
		if ( $woocommerce_wpml && function_exists( 'wcml_is_multi_currency_on' ) && wcml_is_multi_currency_on() ) {
			// get_currency_rate
			$cc = $woocommerce_wpml->get_multi_currency()->get_client_currency();
			$currency_details = $woocommerce_wpml->get_multi_currency()->get_currency_details_by_code( $cc );
			if ( isset( $currency_details['rate'] ) && $currency_details['rate'] ) {
				$config['wcml_rate'] = $currency_details['rate'];
			}
		}

		// Price Based on Country exchange rate
		if ( function_exists( 'wcpbc_the_zone' ) ) {
			$zone = wcpbc_the_zone();
			if ( is_callable( [ $zone, 'get_exchange_rate' ] ) ) {
				$config['wcpbc_rate'] = $zone->get_exchange_rate();
			}
		}

		if ( function_exists( 'alg_get_current_currency_code' ) && alg_get_current_currency_code() ) {
			$config['wcpbc_rate'] = alg_wc_cs_get_currency_exchange_rate( alg_get_current_currency_code() );
		}

		if ( function_exists( 'wmc_get_exchange_rate' ) ) {
			if ( class_exists( '\WOOMULTI_CURRENCY_F_Data' ) && is_callable( '\WOOMULTI_CURRENCY_F_Data::get_ins' ) ) {
				$currency_data = \WOOMULTI_CURRENCY_F_Data::get_ins();
			} elseif ( class_exists( '\WOOMULTI_CURRENCY_Data' ) && is_callable( '\WOOMULTI_CURRENCY_Data::get_ins' ) ) {
				$currency_data = \WOOMULTI_CURRENCY_Data::get_ins();
			}
			if ( $currency_data ) $config['wcpbc_rate'] = wmc_get_exchange_rate( $currency_data->get_current_currency() );
		}
		

		return $config;
	}
}