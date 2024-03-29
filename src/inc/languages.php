<?php
namespace MKL\PC;

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly
}

class Languages {
	public $ml_plugin;
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
		add_filter( 'mkl_pc_db_fields', [ $this, 'add_sanitize_methods' ], 20, 2 );
		add_action( 'wpml_after_copy_custom_field', [ $this, 'purge_transient_after_translation_sync' ], 20, 3 );
		add_filter( 'mkl_pc_item_meta', [ $this, 'translate_cart_data' ], 2, 4 );
		add_filter( 'mkl_pc_order_item_meta', [ $this, 'translate_order_data' ], 2, 3 );
		add_filter( 'mkl_configurator_data_attributes', [ $this, 'configurator_data_attributes' ] );

		add_action( 'update_option_mkl_pc__settings', array( $this, 'wpml_register_translatable_settings' ), 10, 2 );
		add_action( 'init', array( $this, 'pll_register_translatable_settings' ), 20 );
		add_action( 'wpml_after_copy_custom_field', [ $this, 'wpml_maybe_fix_duplicate_data' ], 20, 3 );
	}

	/**
	 * Get the translatable options
	 *
	 * @return array
	 */
	private function _get_translatable_options() {
		return apply_filters( 'mkl_pc_translatable_settings', array_keys( $this->get_translatable_options_defaults() ) );
	}

	public function get_translatable_options_defaults() {
		return apply_filters( 'mkl_pc_translatable_settings_defaults', [
			'mkl_pc__button_label' => __( 'Configure', 'product-configurator-for-woocommerce' ),
			'sku_glue' => __( '', 'product-configurator-for-woocommerce' ),
			'sku_label' => __( 'SKU', 'product-configurator-for-woocommerce' ),
			'mc_max_items_message' => __( 'You have reached the maximum number of selectable items', 'product-configurator-for-woocommerce' ),
			'mc_max_items_message_global' => __( 'You have reached the maximum number of selectable items for this product', 'product-configurator-for-woocommerce' ),
			'mc_min_items_required_message' => __( 'Select at least %i items in %s', 'product-configurator-for-woocommerce' ),
			'reset_configuration_label' => __( 'Reset configuration', 'product-configurator-for-woocommerce' ),
			'edit_configuration_label' => __( 'Edit configuration', 'product-configurator-for-woocommerce' ),
			'edit_item_in_cart' => __( 'Edit item in cart', 'product-configurator-for-woocommerce' ),
			'configuration_cart_meta_label' => _x( 'Configuration', 'Label displayed in the cart / order', 'product-configurator-for-woocommerce' ),
			'loading_configurator_message' => __( 'Loading the configurator...', 'product-configurator-for-woocommerce' ),
			'download_config_image' => __( 'Download configuration image', 'product-configurator-for-woocommerce' ),
			'view_configuration' => _x( 'View configuration', 'Label of the link to view a configuration, in the cart or an order', 'product-configurator-for-woocommerce' ),
			'configuration_costs_label' => __( 'Configuration costs:', 'mkl-pc-extra-price' ),
			'adv_desc_close_label' => __( 'Close', 'mkl-pc-advanced-description' ),
			'previous_step_label' => _x( 'Previous', 'Previous step button label', 'product-configurator-for-woocommerce' ),
			'next_step_label' => _x( 'Next', 'Next step button label', 'product-configurator-for-woocommerce' ),
		] );		
	}
	/**
	 * Add translatable strings to WPML String translation section
	 *
	 * @param array $old_value
	 * @param array $options
	 * @return void
	 */
	public function wpml_register_translatable_settings( $old_value, $options ) {
		
		global $sitepress, $wp_settings_fields;
		if ( ! $sitepress ) return;
		$settings = get_registered_settings();
		if ( ! isset( $wp_settings_fields['mlk_pc_settings'] ) ) return;
		$translatable_options = $this->_get_translatable_options();
		$registered_fields = [];
		foreach( $wp_settings_fields['mlk_pc_settings'] as $section ) {
			foreach( $section as $field => $field_options ) {
				if ( in_array( $field, $translatable_options ) ) {
					do_action( 'wpml_register_single_string', 'Product Configurator settings', $field_options['title'], isset( $options[$field] ) ? $options[$field] : '' );
					if ( function_exists( 'pll_register_string' ) ) {
						pll_register_string( $field, isset( $options[$field] ) ? $options[$field] : '', 'Product Configurator', false );
					}
					$registered_fields[$field] = $field_options['title'];
				}
			}
		}
		if ( ! empty( $registered_fields ) ) {
			update_option( 'mkl_pc__wpml_registered_fields', $registered_fields );
		}
	}

	/**
	 * Add translatable strings to WPML String translation section
	 *
	 * @param array $old_value
	 * @param array $options
	 * @return void
	 */
	public function pll_register_translatable_settings() {
		if ( ! function_exists( 'pll_register_string' ) ) return;
		$translatable_options = $this->_get_translatable_options();
		$translatable_defaults = $this->get_translatable_options_defaults();

		$registered_fields = [];
		foreach( $translatable_options as $option ) {
			pll_register_string( 
				$option,
				mkl_pc( 'settings' )->get_label( $option, isset( $translatable_defaults[$option] ) ? $translatable_defaults[$option] : '' ),
				'Product Configurator', 
				false
			);
			
			$registered_fields[] = $option;
		}

		if ( ! empty( $registered_fields ) ) {
			update_option( 'mkl_pc__pll_registered_fields', $registered_fields );
		}
	}
	
	/**
	 * Add sanitize methods to the translated fields
	 *
	 * @param array  $fields
	 * @param object $instance
	 * @return array
	 */
	public function add_sanitize_methods( $fields, $instance ) {
		if ( ! $this->website_is_multilingual() ) return $fields;
		$languages = $this->get_languages();
		foreach( $languages as $language ) {
			if ( $language == $this->get_default_language() ) continue;
			$language = str_replace( '-', '_', $language );
			$fields['name_' . $language] = [
				'sanitize' => [ $instance, 'sanitize_description' ],
				'escape' => [ $instance, 'escape_description' ],				
			];
			$fields['description_' . $language] = [
				'sanitize' => [ $instance, 'sanitize_description' ],
				'escape' => [ $instance, 'escape_description' ],				
			];
		}
		return $fields;
	}

	public function purge_transient_after_translation_sync( $post_id_from, $post_id_to, $meta_key ) {
		if ( false === strpos( $meta_key, '_mkl_product_configurator_' ) ) return;
		delete_transient( 'mkl_pc_data_init_' . $post_id_to );
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

		// Check for TranslatePress
		if ( function_exists( 'trp_translate' ) ) {
			$this->ml_plugin = 'translatepress';
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
		static $languages;
		if ( $languages ) return $languages;
		if ( $this->website_is_multilingual() && 'wpml' === $this->ml_plugin ) {
			global $sitepress;
			$languages = array_keys( $sitepress->get_active_languages() );
			return $languages;
		}

		if ( $this->website_is_multilingual() && 'polylang' === $this->ml_plugin ) {
			$languages = pll_languages_list();
			return $languages;
		}

		if ( $this->website_is_multilingual() && 'translatepress' === $this->ml_plugin ) {
			$trp                  = \TRP_Translate_Press::get_trp_instance();
			$trp_settings         = $trp->get_component( 'settings' );
			$language_codes_array = $trp_settings->get_settings()['publish-languages'];

			$languages = $language_codes_array;
			return $languages;
		}

		return [];
	}

	/**
	 * get the default language
	 *
	 * @return string|false
	 */
	public function get_default_language() {
		static $default_language;
		if ( $default_language ) return $default_language;
		if ( $this->website_is_multilingual() && 'wpml' === $this->ml_plugin ) {
			global $sitepress;
			$default_language = $sitepress->get_default_language();
			return $default_language;
		}

		if ( $this->website_is_multilingual() && 'polylang' === $this->ml_plugin ) {
			$default_language = pll_default_language();
			return $default_language;
		}

		if ( $this->website_is_multilingual() && 'translatepress' === $this->ml_plugin ) {
			$trp              = \TRP_Translate_Press::get_trp_instance();
			$trp_settings     = $trp->get_component( 'settings' );
			$default_language = $trp_settings->get_settings()['default-language'];
			return $default_language;
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

		if ( $this->website_is_multilingual() && 'translatepress' === $this->ml_plugin ) {
			global $TRP_LANGUAGE;
			return $TRP_LANGUAGE;
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
		
		if ( $this->website_is_multilingual() && 'translatepress' === $this->ml_plugin ) {
			$trp      = \TRP_Translate_Press::get_trp_instance();
			$switcher = $trp->get_component( 'language_switcher' );
			
			return $switcher->add_flag( $language, $language, 'ls_shortcode' );
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
					// Replace dashes by underscores
					$l = str_replace( '-', '_', $l );
					$settings['name_'.$l] = array(
						'label' => __( 'Name', 'product-configurator-for-woocommerce' ) . ' ' . $l . ( $flag_url ? '<img src="' . esc_url( $flag_url ) . '" alt="' . esc_attr__( 'Name', 'product-configurator-for-woocommerce' ) . ' ' . esc_attr( $l ) . '">' : '' ),
						'type' => 'text',
						'priority' => 11,
						'section' => 'translations',
					);
					$settings['description_'.$l] = array(
						'label' => __( 'Description', 'product-configurator-for-woocommerce' ) . ' ' . $l . ( $flag_url ? '<img src="' . esc_url( $flag_url ) . '" alt="' . esc_attr__( 'Description', 'product-configurator-for-woocommerce' ) . ' ' . esc_attr( $l ) . '">' : '' ),
						'type' => 'textarea',
						'priority' => 21,
						'condition' => '!data.not_a_choice',
						'section' => 'translations',
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
		if ( $current_language = $this->get_current_language() ) $config['current_language'] = str_replace( '-', '_', $current_language );;

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
			if ( is_callable( [ $zone, 'get_round_nearest' ] ) ) {
				$config['wcpbc_round_nearest'] = $zone->get_round_nearest();
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

	/**
	 * Override the name and label with the translated one, if applicable
	 *
	 * @param array $meta
	 * @param object $layer
	 * @param object $product
	 * @param string $cart_item_key
	 * @return array
	 */
	public function translate_cart_data( $meta, $layer, $product, $cart_item_key ) {
		if ( $this->website_is_multilingual() && $this->get_current_language() !== $this->get_default_language() ) {
			if ( $label_translation = $layer->get_layer( 'name_' . $this->get_current_language() ) ) {
				$meta['label'] = $label_translation;
			}
			if ( $value_translation = $layer->get_choice( 'name_' . $this->get_current_language() ) ) {
				$meta['value'] = $value_translation;
			}
		}

		return $meta;
	}

	/**
	 * Override the name and label with the translated one, if applicable
	 *
	 * @param array $meta
	 * @param object $layer
	 * @param object $product
	 * @return array
	 */
	public function translate_order_data( $meta, $layer, $product ) {
		if ( $this->website_is_multilingual() && $this->get_current_language() !== $this->get_default_language() ) {
			if ( $label_translation = $layer->get_layer( 'name_' . $this->get_current_language() ) ) {
				$meta['label'] = $label_translation;
			}
			if ( $value_translation = $layer->get_choice( 'name_' . $this->get_current_language() ) ) {
				$meta['value'] = $value_translation;
			}
		}

		return $meta;
	}

	public function configurator_data_attributes( $data_attributes ) {
		if ( $this->website_is_multilingual() && 'translatepress' === $this->ml_plugin && mkl_pc( 'settings' )->get( 'disable_translatepress_dynamic_translation' ) ) {
			$data_attributes['no-translation'] = ''; 
		}
		return $data_attributes;
	}

	public function wpml_maybe_fix_duplicate_data( $post_id_from, $post_id_to, $meta_key ) {
		if ( in_array( $meta_key, [ '_mkl_product_configurator_content', '_mkl_product_configurator_layers', '_mkl_product_configurator_conditions', '_mkl_product_configurator_angles' ] ) ) {
			$meta = get_post_meta( $post_id_to, $meta_key, false );
			if ( is_array( $meta ) && 1 < count( $meta ) ) {
				$keep = end( $meta );
				// delete all post_meta
				delete_post_meta( $post_id_to, $meta_key );
				// insert the last one only
				add_post_meta( $post_id_to, $meta_key, $keep );
			}
		}
	}
}