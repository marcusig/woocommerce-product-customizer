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
		public function get_settings_list() {
			
			$display_modes = [
				[
					'label' => __( 'Default', 'product-configurator-for-woocommerce' ),
					'value' => 'default',
				],
				[
					'label' => __( 'Drop down', 'product-configurator-for-woocommerce' ),
					'value' => 'dropdown',
					'image' => MKL_PC_ASSETS_URL . 'admin/images/ui/display-dropdown.svg',
				],
				[
					'label' => __( 'Color swatches', 'product-configurator-for-woocommerce' ),
					'value' => 'colors',
					'image' => MKL_PC_ASSETS_URL . 'admin/images/ui/display-colors.svg',
				],
			];

			if ( mkl_pc( 'themes' )->current_theme_supports( 'display mode: compact list' ) ) {
				$display_modes[] = [
					'label' => __( 'Compact list', 'product-configurator-for-woocommerce' ),
					'value' => 'compact-list',
					'image' => MKL_PC_ASSETS_URL . 'admin/images/ui/display-compact-list.svg',
				];
			}

			if ( mkl_pc( 'themes' )->current_theme_supports( 'display mode: full screen' ) ) {
				$display_modes[] = [
					'label' => __( 'Full screen', 'product-configurator-for-woocommerce' ),
					'value' => 'full-screen',
					'image' => MKL_PC_ASSETS_URL . 'admin/images/ui/display-full-screen.svg',
				];
			}

			/**
			 * Filters the display modes available for a given layer
			 *
			 * @param array $display_modes
			 * @return array $display_modes
			 */
			$display_modes = apply_filters( 'mkl_pc_display_modes', $display_modes );

			$settings = array(
				'name' => array(
					'label' => __('Layer name', 'product-configurator-for-woocommerce' ),
					'type' => 'text',
					'priority' => 10,
					'section' => 'layer',
					'classes' => 'col-half',
				),
				'admin_label' => array(
					'label' => __('Admin label', 'product-configurator-for-woocommerce' ),
					'type' => 'text',
					'priority' => 11,
					'section' => 'layer',
					'classes' => 'col-half',
				),

				'not_a_choice' => array(
					'label' => __('This layer does not have choices', 'product-configurator-for-woocommerce' ),
					'help' => __('For exemple if the layer is a shadow, a static element or custom HTML', 'product-configurator-for-woocommerce' ),
					'type' => 'checkbox',
					'priority' => 20,
					'condition' => '"simple" == data.type',
					'section' => 'layer',
				),
				
				// 'not_a_choice_separator' => array(
				// 	'label' => 'separator',
				// 	'type' => 'html',
				// 	'priority' => 2,
				// 	'condition' => '!data.not_a_choice',
				// 	'section' => 'display',
				// 	'html' => '<hr class="mkl-pc-separator">',
				// 	'classes' => 'separator',
				// 	'hide_label' => true,
				// ),				

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
							'label' => __( 'Multiple choice', 'product-configurator-for-woocommerce' ) . ( class_exists( 'MKL_PC_Multiple_Choice' ) ? '' : ' ' . __( '(available as an add-on)', 'product-configurator-for-woocommerce' ) ),
							'value' => 'multiple',
							'attributes' => [
								'disabled' => 'disabled'
							]
						],
						[
							'label' => __( 'Form', 'product-configurator-for-woocommerce' ) . ( class_exists( 'MKL_PC_Form_Builder' ) ? '' : ' ' . __( '(available as an add-on)', 'product-configurator-for-woocommerce' ) ),
							'value' => 'form',
							'attributes' => [
								'disabled' => 'disabled'
							]
						],
					],
					'condition' => '!data.not_a_choice',
					'priority' => 5,
					'classes' => 'col-half',
					'section' => 'general',
				),
				'description' => array(
					'label' => __('Description', 'product-configurator-for-woocommerce' ),
					'type' => 'textarea',
					'priority' => 20,
					'condition' => '!data.not_a_choice',
					'section' => 'general',
				),


				'display_mode' => array(
					'label' => __( 'Display mode', 'product-configurator-for-woocommerce' ),
					'type' => 'image_select',
					'choices' => $display_modes,
					'condition' => '!data.not_a_choice && ( "simple" == data.type || "multiple" == data.type )',
					'priority' => 7,
					'section' => 'display',
				),
				'hide_in_cart' => array(
					'label' => __('Hide this layer in the cart / checkout / order', 'product-configurator-for-woocommerce' ),
					'help' => __('Useful if you only need to show this in the configurator, but do not need to display it in the order', 'product-configurator-for-woocommerce' ),
					'type' => 'checkbox',
					'priority' => 30,
					'condition' => '!data.not_a_choice && "summary" != data.type',
					'section' => 'display',
				),
				'hide_in_summary' => array(
					'label' => __('Hide this layer in the summary', 'product-configurator-for-woocommerce' ),
					'type' => 'checkbox',
					'priority' => 31,
					'condition' => '!data.not_a_choice && "summary" != data.type',
					'section' => 'display',
				),
				'hide_in_configurator' => array(
					'label' => __('Hide this layer in the menu', 'product-configurator-for-woocommerce' ),
					'help' => __('Useful if you only need to show this in the order, but do not need to display it in the configurator menu', 'product-configurator-for-woocommerce' ),
					'type' => 'checkbox',
					'priority' => 32,
					'condition' => '!data.not_a_choice && "summary" != data.type',
					'section' => 'display',
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
					'section' => 'selection',
				),
				'required' => array(
					'label' => __( 'Require a choice', 'product-configurator-for-woocommerce' ),
					'type' => 'checkbox',
					'condition' => '!data.not_a_choice && ( "simple" == data.type || "multiple" == data.type )',
					'priority' => 40.2,
					'section' => 'selection',

					// 'help' => __( 'If Default selection is set to first choice, the first choice will be considered as null (the user will need to select an other one)', 'product-configurator-for-woocommerce' ),
				),
				'required_info' => array(
					'label' => 'Info',
					'type' => 'html',
					'html' => '<div class="mkl-pc-setting--warning">' . __( 'If "Require a choice" is enabled and "Default selection" is set to "Select the first choice by default", the first choice will be considered as null (the user will need to select an other one)', 'product-configurator-for-woocommerce' ) . '</div>',
					'condition' => 'data.required && ( "select_first" == data.default_selection || ! data.default_selection)',
					'priority' => 40.3,
					'section' => 'selection',
				),

				'can_deselect' => array(
					'label' => __( 'The user can deselect the current choice', 'product-configurator-for-woocommerce' ),
					'type' => 'checkbox',
					'priority' => 42,
					'condition' => '!data.not_a_choice && "simple" == data.type',
					'section' => 'selection',
				),
				'custom_html' => array(
					'label' => __( 'Custom HTML', 'product-configurator-for-woocommerce' ),
					'type' => 'textarea',
					'priority' => 32,
					'condition' => 'data.not_a_choice',
					'input_classes' => 'code',
					'help' => __( 'Content entered here will be rendered in the configurator menu.', 'product-configurator-for-woocommerce' ) . ' ' . __('To add HTML to the viewer, add it to the custom HTML field in the content section.', 'product-configurator-for-woocommerce' ),
					'section' => 'advanced',
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
					'section' => 'advanced',
				),

				'class_name' => array(
					'label' => __('CSS Class', 'product-configurator-for-woocommerce' ),
					'type' => 'text',
					'priority' => 500,
					'section' => 'advanced',
				),
				'html_id' => array(
					'label' => __('ID', 'product-configurator-for-woocommerce' ),
					'type' => 'text',
					'priority' => 500,
					'section' => 'advanced',
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
					'condition' => '!data.not_a_choice && ( "simple" == data.type || "multiple" == data.type ) && ( "default" == data.display_mode || "full-screen" == data.display_mode || ! data.display_mode )' ,
					'priority' => 8,
					'section' => 'display',
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
							'label' => __( 'Large', 'product-configurator-for-woocommerce' ),
							'value' => 'large',
						],
					],
					'condition' => '!data.not_a_choice && ( "simple" == data.type || "multiple" == data.type ) && "colors" == data.display_mode',
					'priority' => 8,
					'section' => 'display',
				);
			}

			$settings['type']['choices'][] = array(
				'label' => __( 'Summary', 'product-configurator-for-woocommerce' ),
				'value' => 'summary'
			);

			if ( mkl_pc( 'themes' )->current_theme_supports( 'steps' ) ) {
				if ( mkl_pc( 'settings' )->get( 'steps_use_layer_name', false ) ) {
					$settings['next_step_button_label'] = array(
						'label' => __( 'Next step button label', 'product-configurator-for-woocommerce' ),
						'type' => 'text',
						'condition' => 'data.maybe_step',
						'priority' => 15,
						'section' => 'general',
					);
				}
			}

			return apply_filters( 'mkl_pc_layer_default_settings', $settings );
		}

		/**
		 * Get the setting sections
		 *
		 * @return array
		 */
		public function get_sections() {
			$sections = [

				'_layer' => array(
					'id' => 'layer',
					'label' => __( 'Layer', 'product-configurator-for-woocommerce' ),
					'priority' => 5,
					'fields' => [
					],
				),

				'_general' => array(
					'id' => 'general',
					'label' => __( 'General', 'product-configurator-for-woocommerce' ),
					'priority' => 10,
					'collapsible' => true,
					'fields' => [
					],
				),

				'_display' => array(
					'id' => 'display',
					'label' => __( 'Display settings', 'product-configurator-for-woocommerce' ),
					'priority' => 15,
					'collapsible' => true,
					'fields' => [
					],
				),
				'_selection' => array(
					'id' => 'selection',
					'label' => __( 'Selection settings', 'product-configurator-for-woocommerce' ),
					'priority' => 25,
					'collapsible' => true,
					'condition' => '!data.not_a_choice && ( "simple" == data.type || "multiple" == data.type )',
					'fields' => [
					]
				),
				'_advanced' => array(
					'id' => 'advanced',
					'label' => __( 'Advanced settings', 'product-configurator-for-woocommerce' ),
					'priority' => 150,
					'collapsible' => true,
					'fields' => [
					]
				),				
			];

			$languages = mkl_pc( 'languages' )->get_languages();
			if ( ! empty( $languages ) ) {
				$sections[ '_translations' ] = array(
					'id' => 'translations',
					'label' => __( 'Translations', 'product-configurator-for-woocommerce' ),
					'priority' => 140,
					'collapsible' => true,
					'fields' => []
				);
			}
			
			return apply_filters( 'mkl_pc_layer_settings_sections', $sections );
		}
	}
}