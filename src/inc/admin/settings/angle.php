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

if ( ! class_exists('MKL\PC\Abstract_Settings') ) require_once 'abstract.php';

if ( ! class_exists('MKL\PC\Angle_Settings') ) {
	class Angle_Settings extends Abstract_Settings {

		public $type = 'angle';

		public function __construct() {
			parent::__construct();
		}

		/**
		 * Gets the default settings
		 *
		 * @return array
		 */
		public function get_settings_list() {
			$settings = array(
				'name' => array(
					'label' => __('Angle Name', 'product-configurator-for-woocommerce' ),
					'type' => 'text',
					'priority' => 10,
					'section' => 'general',
				),
				'description' => array(
					'label' => __('Description', 'product-configurator-for-woocommerce' ),
					'type' => 'textarea',
					'priority' => 20,
					'section' => 'general',
				),
				'class_name' => array(
					'label' => __('CSS Class', 'product-configurator-for-woocommerce' ),
					'type' => 'text',
					'priority' => 150,
					'section' => 'advanced',
				),
			);

			if ( mkl_pc( 'settings' )->get( 'show_image_in_cart' ) ) {
				$settings['use_in_cart'] = array(
					'label' => __('Use this view to generate the image in the cart', 'product-configurator-for-woocommerce' ),
					'type' => 'checkbox',
					'priority' => 25,
					'section' => 'general',
				);
			}

			return apply_filters('mkl_pc_angle_default_settings', $settings );
		}

		/**
		 * Get the sections
		 *
		 * @return array
		 */
		public function get_sections() {
			return apply_filters( 'mkl_pc_layer_settings_sections', [
				'_general' => array(
					'id' => 'general',
					'label' => __( 'General', 'product-configurator-for-woocommerce' ),
					'priority' => 10,
					'collapsible' => false,
					'fields' => [
					],
				),
				'_advanced' => array(
					'id' => 'advanced',
					'label' => __( 'Advanced settings', 'product-configurator-for-woocommerce' ),
					'priority' => 150,
					'collapsible' => true,
					'fields' => [
					]
				),				
			] );
		}		
	}
}