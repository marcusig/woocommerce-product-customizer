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
			
			$settings = array(
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
						[
							'label' => __( 'Form', 'product-configurator-for-woocommerce' ),
							'value' => 'form',
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
							'label' => __( 'Color swatches', 'product-configurator-for-woocommerce' ),
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
					'condition' => '!data.not_a_choice && "summary" != data.type',
				),
				'hide_in_configurator' => array(
					'label' => __('Hide this layer in the menu', 'product-configurator-for-woocommerce' ),
					'help' => __('Useful if you only need to show this in the order, but do not need to display it in the configurator menu', 'product-configurator-for-woocommerce' ),
					'type' => 'checkbox',
					'priority' => 31,
					'condition' => '!data.not_a_choice && "summary" != data.type',
				),
				'custom_html' => array(
					'label' => __( 'Custom HTML', 'product-configurator-for-woocommerce' ),
					'type' => 'textarea',
					'priority' => 32,
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
					'priority' => 40.1,
					'help' => __( 'Choose whether a choice should be selected by default', 'product-configurator-for-woocommerce' ),
				),
				'required' => array(
					'label' => __( 'Require a choice', 'product-configurator-for-woocommerce' ),
					'type' => 'checkbox',
					'condition' => '!data.not_a_choice && ( "simple" == data.type || "multiple" == data.type )',
					'priority' => 40.2,
					// 'help' => __( 'If Default selection is set to first choice, the first choice will be considered as null (the user will need to select an other one)', 'product-configurator-for-woocommerce' ),
				),
				'required_info' => array(
					'label' => __( 'Info', 'product-configurator-for-woocommerce' ),
					'type' => 'html',
					'html' => '<div class="mkl-pc-setting--warning">' . __( 'If "Require a choice" is enabled "Default selection" is set to "Select the first choice by default", the first choice will be considered as null (the user will need to select an other one)', 'product-configurator-for-woocommerce' ) . '</div>',
					'condition' => 'data.required && ( "select_first" == data.default_selection || ! data.default_selection)',
					'priority' => 40.3,
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
					'condition' => '!data.not_a_choice && ( "simple" == data.type || "multiple" == data.type || "group" == data.type )',
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
			);

			if ( mkl_pc( 'themes' )->current_theme_supports( 'columns' ) ) {
				$settings['columns'] = array(
					'label' => __( 'Number of columns', 'product-configurator-for-woocommerce' ),
					'type' => 'select',
					'choices' => [
						[
							'label' => __( 'Default', 'product-configurator-for-woocommerce' ),
							'value' => 'default'
						],
						[
							'label' => __( '4', 'product-configurator-for-woocommerce' ),
							'value' => '4',
						],
						[
							'label' => __( '3', 'product-configurator-for-woocommerce' ),
							'value' => '3',
						],
						[
							'label' => __( '2', 'product-configurator-for-woocommerce' ),
							'value' => '2',
						],
						[
							'label' => __( '1', 'product-configurator-for-woocommerce' ),
							'value' => '1',
						],
					],
					'condition' => '!data.not_a_choice && ( "simple" == data.type || "multiple" == data.type ) && ( "default" == data.display_mode || ! data.display_mode )' ,
					'priority' => 8,
				);
			}

			if ( mkl_pc( 'themes' )->current_theme_supports( 'color_swatches' ) ) {
				$settings['color_swatch_size'] = array(
					'label' => __( 'Color swatch size', 'product-configurator-for-woocommerce' ),
					'type' => 'select',
					'choices' => [
						[
							'label' => __( 'Small', 'product-configurator-for-woocommerce' ),
							'value' => 'small'
						],
						[
							'label' => __( 'Medium', 'product-configurator-for-woocommerce' ),
							'value' => 'medium',
						],
						[
							'label' => __( 'Color swatches', 'product-configurator-for-woocommerce' ),
							'value' => 'large',
						],
					],
					'condition' => '!data.not_a_choice && ( "simple" == data.type || "multiple" == data.type ) && "colors" == data.display_mode',
					'priority' => 8,
				);
			}

			if ( mkl_pc( 'themes' )->current_theme_supports( 'steps' ) ) {
				$settings['type']['choices'][] = array(
					'label' => __( 'Summary', 'product-configurator-for-woocommerce' ),
					'value' => 'summary'
				);
			}
			return apply_filters( 'mkl_pc_layer_default_settings', $settings );
		}
	}
}