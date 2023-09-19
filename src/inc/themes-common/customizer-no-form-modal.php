<?php

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly
}

/**
 * Remove the add to cart modal on mobile or not
 */
class MKL_PC_Theme__no_form_modal {
	public $theme;
	public function __construct( $theme ) {
		$this->theme = $theme;
		add_action( 'mkl_pc_customizer_settings', [ $this, 'customizer_settings' ], 20, 2 );
		add_filter( 'mkl_pc_js_config', [ $this, 'theme_config' ] );
	}
	
	public function customizer_settings( $wp_customize, $object ) {
		/**
		 * Background image
		 */

		$wp_customize->add_setting(
			$object::PREFIX . $this->theme . '_no_form_modal',
			array(
				// 'default'    => true,
				'type'       => 'option',
				'capability' => 'edit_theme_options',
			)
		);

		$wp_customize->add_control(
			$object::PREFIX . $this->theme . '_no_form_modal',
			array(
				'label'    => __( 'No add to cart modal', 'product-configurator-for-woocommerce' ),
				'section'  => 'mlk_pc',
				'settings' => $object::PREFIX . $this->theme . '_no_form_modal',
				'type'     => 'checkbox',
			)
		);
	}
	
	public function theme_config( $settings ) {
		if ( get_option( 'mkl_pc_theme_' . $this->theme . '_no_form_modal' ) ) {
			$settings['no_form_modal'] = true;
		}
		return $settings;
	}
}
