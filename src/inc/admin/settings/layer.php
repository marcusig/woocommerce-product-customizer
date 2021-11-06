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
				'type' => array(
					'label' => __( 'Layer type', 'product-configurator-for-woocommerce' ),
					'type' => 'select',
					'choices' => [
						[
							'label' => __( 'Simple', 'product-configurator-for-woocommerce' ),
							'value' => 'simple'
						],
						[
							'label' => __( 'Multiple choice', 'product-configurator-for-woocommerce' ),
							'value' => 'multiple',
							'attributes' => [
								'disabled' => 'disabled'
							]
						],
					],
					'priority' => 5,
				),				
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
					'label' => __( 'Custom HTML', 'product-configurator-for-woocommerce' ),
					'type' => 'textarea',
					'priority' => 31,
					'condition' => 'data.not_a_choice',
					'classes' => 'code',
					'help' => __( 'Content entered here will be rendered in the configurator menu.', 'product-configurator-for-woocommerce' ) . ' ' . __('To add HTML to the viewer, add it to the custom HTML field in the content section.', 'product-configurator-for-woocommerce' ),
				),
				'default_selection' => array(
					'label' => __( 'Default selection', 'product-configurator-for-woocommerce' ),
					'type' => 'select',
					'condition' => '!data.not_a_choice && "simple" == data.type',
					'choices' => [
						[
							'label' => __( 'Select the first choice by default, or the one set to default', 'product-configurator-for-woocommerce' ),
							'value' => 'select_first'
						],
						[
							'label' => __( 'Select nothing', 'product-configurator-for-woocommerce' ),
							'value' => 'select_nothing'
						]
					],
					'priority' => 40,
					'help' => __( 'Choose whether a choice should be selected by default', 'product-configurator-for-woocommerce' ),
				),
				'required' => array(
					'label' => __( 'Require a choice', 'product-configurator-for-woocommerce' ),
					'type' => 'checkbox',
					'condition' => '!data.not_a_choice',
					'priority' => 40,
					'help' => __( 'If Default selection is set to first choice, the first choice will be considered as null (the user will need to select an other one)', 'product-configurator-for-woocommerce' ),
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