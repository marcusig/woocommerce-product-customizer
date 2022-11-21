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

if ( ! class_exists('MKL\PC\Choice_Settings') ) {
	class Choice_Settings extends Abstract_Settings {

		public $type = 'choice';

		public function __construct() {
			parent::__construct();
		}

		/**
		 * Gets the default settings
		 *
		 * @return array
		 */
		public function get_default_settings() {
			return apply_filters( 'mkl_pc_choice_default_settings', array(
				'_general' => array(
					'id' => 'general',
					'label' => __( 'General' ),
					'priority' => 5,
					'fields' => array(
						'is_group' => array(
							'label' => __('Use as group', 'product-configurator-for-woocommerce' ),
							'type' => 'checkbox',
							'priority' => 5,
							'condition' => '!data.not_a_choice'
						),
						'show_group_label_in_cart' => array(
							'label' => __('Show group name in the cart / order', 'product-configurator-for-woocommerce' ),
							'type' => 'checkbox',
							'priority' => 6,
							'condition' => '!data.not_a_choice && data.is_group'
						),
						'sku' => array(
							'label' => __('SKU', 'product-configurator-for-woocommerce' ),
							'type' => 'text',
							'priority' => 9,
							'condition' => '!data.not_a_choice && !data.is_group'
						),
						'name' => array(
							'label' => __('Choice label', 'product-configurator-for-woocommerce' ),
							'type' => 'text',
							'priority' => 10,
						),
						'color' => array(
							'label' => __('Color hex code', 'product-configurator-for-woocommerce' ),
							'type' => 'text',
							'attributes' => array(
								'placeholder' => __('E.g. #EEFF00', 'product-configurator-for-woocommerce'),
							),
							'condition' => '!data.not_a_choice && !data.is_group && "colors" == data.layer.display_mode',
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
							'condition' => '!data.not_a_choice'
						),
						'custom_html' => array(
							'label' => __( 'Custom html', 'product-configurator-for-woocommerce' ),
							'type' => 'textarea',
							'priority' => 20,
							'condition' => 'data.not_a_choice || PC_lang.enable_html_layers',
							'help' => __( 'Any content / HTML entered here will be added in the configurator viewer.', 'product-configurator-for-woocommerce' ),
							'classes' => 'code',
						),
						'is_default' => array(
							'label' => __('Set as default choice', 'product-configurator-for-woocommerce' ),
							'type' => 'checkbox',
							'priority' => 20,
							'condition' => '!data.not_a_choice && !data.is_group'
						),				
						'hide_in_cart' => array(
							'label' => __('Hide the layer in the cart if this choice is selected', 'product-configurator-for-woocommerce' ),
							'type' => 'checkbox',
							'priority' => 20,
							'condition' => '!data.not_a_choice && !data.is_group && ( "simple" == data.layer_type || "multiple" == data.layer_type)'
						),				
						'extra_price' => array(
							'label' => __('Extra price', 'product-configurator-for-woocommerce' ),
							'type' => 'number',
							'attributes' => array(
								'disabled' => 'disabled',
								'placeholder' => __('Extra Price is available as an addon', 'product-configurator-for-woocommerce'),
							),
							'priority' => 30,
							'condition' => '!data.is_group'

						)
					),
				),
				'_advanced' => array(
					'id' => 'advanced',
					'label' => __( 'Advanced' ),
					'priority' => 150,
					'fields' => array(
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
							'attributes' => array(
								'data-label_prefix' => __('Switch to', 'product-configurator-for-woocommerce'),
							),
							'priority' => 50,
						),
						'weight' => array(
							'label' => __('Weight', 'product-configurator-for-woocommerce' ) . ' (' . get_option( 'woocommerce_weight_unit' ) . ')',
							'type' => 'number',
							'priority' => 60,
						),
						'class_name' => array(
							'label' => __('CSS Class', 'product-configurator-for-woocommerce' ),
							'type' => 'text',
							'priority' => 150,
						),
					)
				),
			) );
		}
	}
}