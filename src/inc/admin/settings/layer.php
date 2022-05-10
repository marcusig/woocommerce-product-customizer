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
							'label' => __( 'Group', 'product-configurator-for-woocommerce' ),
							'value' => 'group'
						],
						[
							'label' => __( 'Multiple choice', 'product-configurator-for-woocommerce' ),
							'value' => 'multiple',
							'attributes' => [
								'disabled' => 'disabled'
							]
						],
					],
					'condition' => '!data.not_a_choice',
					'priority' => 5,
				),
				'display_mode' => array(
					'label' => __( 'Display mode', 'product-configurator-for-woocommerce' ),
					'type' => 'select',
					'choices' => [
						[
							'label' => __( 'Default', 'product-configurator-for-woocommerce' ),
							'value' => 'default'
						],
						[
							'label' => __( 'Drop down', 'product-configurator-for-woocommerce' ),
							'value' => 'dropdown',
						],
						[
							'label' => __( 'Small color choices', 'product-configurator-for-woocommerce' ),
							'value' => 'colors',
						],
					],
					'condition' => '!data.not_a_choice && ( "simple" == data.type || "multiple" == data.type )',
					'priority' => 7,
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
					'condition' => '"simple" == data.type',
				),
				'hide_in_cart' => array(
					'label' => __('Hide this layer in the cart / checkout / order', 'product-configurator-for-woocommerce' ),
					'help' => __('Useful if you only need to show this in the configurator, but do not need to display it in the order', 'product-configurator-for-woocommerce' ),
					'type' => 'checkbox',
					'priority' => 30,
					'condition' => '"group" != data.type',
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
					'condition' => '!data.not_a_choice && ( "simple" == data.type || "multiple" == data.type )',
					'priority' => 40,
					'help' => __( 'If Default selection is set to first choice, the first choice will be considered as null (the user will need to select an other one)', 'product-configurator-for-woocommerce' ),
				),
				'can_deselect' => array(
					'label' => __( 'The user can deselect the current choice', 'product-configurator-for-woocommerce' ),
					'type' => 'checkbox',
					'priority' => 42,
					'condition' => '!data.not_a_choice && "simple" == data.type',
				),
				'angle_switch' => array(
					'label' => __( 'Automatic angle switch', 'product-configurator-for-woocommerce' ),
					'type' => 'select',
					'condition' => '!data.not_a_choice && ( "simple" == data.type || "multiple" == data.type )',
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
				'html_id' => array(
					'label' => __('ID', 'product-configurator-for-woocommerce' ),
					'type' => 'text',
					'priority' => 500,
				),
	
			));
		}
	}
}