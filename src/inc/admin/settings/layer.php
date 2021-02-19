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

if ( ! class_exists('MKL\PC\Layer_Settings') ) {
	class Layer_Settings extends Abstract_Settings {

		public $type = 'layer';

		public function __construct() {
			parent::__construct();
		}

		/**
		 * Gets the default settings
		 *
		 * @return array
		 */
		public function get_default_settings() {
			return apply_filters('mkl_pc_layer_default_settings', array(
				'name' => array(
					'label' => __('Layer name', 'product-configurator-for-woocommerce' ),
					'type' => 'text',
					'priority' => 10,
				),
				'admin_label' => array(
					'label' => __('Admin label', 'product-configurator-for-woocommerce' ),
					'type' => 'text',
					'priority' => 15,
				),
				'description' => array(
					'label' => __('Description', 'product-configurator-for-woocommerce' ),
					'type' => 'textarea',
					'priority' => 20,
					'condition' => '!data.not_a_choice',
				),
				'not_a_choice' => array(
					'label' => __('This layer does not have choices', 'product-configurator-for-woocommerce' ),
					'help' => __('For exemple if the layer is a shadow, a static element or custom HTML', 'product-configurator-for-woocommerce' ),
					'type' => 'checkbox',
					'priority' => 30,
				),
				'custom_html' => array(
					'label' => __('Custom HTML', 'product-configurator-for-woocommerce' ),
					'type' => 'textarea',
					'priority' => 31,
					'condition' => 'data.not_a_choice',
					'classes' => 'code',
					'help' => __('Content entered here will be rendered in the configurator menu.', 'product-configurator-for-woocommerce' ) . ' ' . __('To add HTML to the viewer, add it to the custom HTML field in the content section.', 'product-configurator-for-woocommerce' ),
				),
				'type' => array(
					'label' => 'Layer type',
					'type' => 'select',
					'condition' => '!data.not_a_choice',
					'choices' => [
						[
							'label' => 'Simple',
							'value' => 'simple'
						],
						[
							'label' => 'Multiple choice',
							'value' => 'multiple',
							'attributes' => [
								'disabled' => 'disabled'
							]
						],
					],
					'priority' => 40,
				),
				'angle_switch' => array(
					'label' => __( 'Automatic angle switch', 'product-configurator-for-woocommerce' ),
					'type' => 'select',
					'condition' => '!data.not_a_choice',
					'choices' => [
						[
							'label' => 'No',
							'value' => 'no'
						],
					],
					'priority' => 50,
				),
				'class_name' => array(
					'label' => __('CSS Class', 'product-configurator-for-woocommerce' ),
					'type' => 'text',
					'priority' => 500,
				),
	
			));
		}
	}
}