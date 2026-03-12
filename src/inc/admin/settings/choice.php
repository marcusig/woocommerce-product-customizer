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
		public function get_settings_list() {
			global $post;
			$fields = array(
				'name' => array(
					'label' => __('Choice label', 'product-configurator-for-woocommerce' ),
					'type' => 'text',
					'priority' => 1,
					'classes' => 'col-half',
					'section' => 'general',
				),
				// 'actions' => array(
				// 	'label' => __('Actions', 'product-configurator-for-woocommerce' ),
				// 	'type' => 'actions',
				// 	'priority' => 2,
				// 	'classes' => 'col-half',
				// 	'section' => 'general',
				// ),
				'admin_label' => array(
					'label' => __('Admin label', 'product-configurator-for-woocommerce' ),
					'type' => 'text',
					'priority' => 2,
					'classes' => 'col-half',
					'section' => 'general',
				),
				'is_group' => array(
					'label' => __('Use as group', 'product-configurator-for-woocommerce' ),
					'type' => 'checkbox',
					'priority' => 5,
					'section' => 'general',
					'condition' => '!data.not_a_choice',
				),
				'show_group_label_in_cart' => array(
					'label' => __('Show group name in the cart / order', 'product-configurator-for-woocommerce' ),
					'type' => 'checkbox',
					'priority' => 6,
					'section' => 'general',
					'condition' => '!data.not_a_choice && data.is_group'
				),
				'sku' => array(
					'label' => ( 'individual' == mkl_pc( 'settings')->get( 'sku_mode', 'individual' ) ) ? __('SKU', 'product-configurator-for-woocommerce' ) : __('SKU part', 'product-configurator-for-woocommerce' ),
					'type' => 'text',
					'priority' => 9,
					'section' => 'general',
					'condition' => '!data.not_a_choice && !data.is_group'
				),
				'color' => array(
					'label' => __('Color hex code', 'product-configurator-for-woocommerce' ),
					'type' => 'text',
					'attributes' => array(
						'placeholder' => __('E.g. #EEFF00', 'product-configurator-for-woocommerce'),
					),
					'priority' => 14,
					'section' => 'general',
					'input_classes' => 'color-hex',
					'condition' => '!data.not_a_choice && !data.is_group && ( "simple" == data.layer_type || "multiple" == data.layer_type)',
				),
				'description' => array(
					'label' => __('Description', 'product-configurator-for-woocommerce' ),
					'type' => 'textarea',
					'priority' => 20,
					'section' => 'general',
					'condition' => '!data.not_a_choice',
				),
				'custom_html' => array(
					'label' => __( 'Custom html', 'product-configurator-for-woocommerce' ),
					'type' => 'textarea',
					'priority' => 20,
					'help' => __( 'Any content / HTML entered here will be added in the configurator viewer.', 'product-configurator-for-woocommerce' ),
					'input_classes' => 'code',
					'section' => 'general',
					'condition' => 'data.not_a_choice || PC_lang.enable_html_layers',
				),
				'is_default' => array(
					'label' => __('Set as default choice', 'product-configurator-for-woocommerce' ),
					'type' => 'checkbox',
					'priority' => 20,
					'section' => 'general',
					'condition' => '!data.not_a_choice && !data.is_group'
				),
				'hide_in_cart' => array(
					'label' => __('Hide the layer in the cart if this choice is selected', 'product-configurator-for-woocommerce' ),
					'type' => 'checkbox',
					'priority' => 20,
					'section' => 'general',
					'condition' => '!data.not_a_choice && !data.is_group && ("simple" == data.layer_type || "multiple" == data.layer_type)'
				),
				'angle_switch' => array(
					'label' => __( 'Automatic angle switch', 'product-configurator-for-woocommerce' ),
					'type' => 'select',
					'condition' => '!data.not_a_choice',
					'choices' => [
						[
							'label' => _x( 'No', 'Automatic angle switch - Choose an angle, or no switch', 'product-configurator-for-woocommerce' ),
							'value' => 'no'
						],
					],
					'attributes' => array(
						'data-label_prefix' => __('Switch to', 'product-configurator-for-woocommerce'),
					),
					'section' => 'advanced',
					'priority' => 50,
				),
				'choice_groups_toggle' => array(
					'label' => __( 'Content of this group is hidden by default, toggled when clicking the title', 'product-configurator-for-woocommerce' ),
					'type' => 'select',
					'condition' => '!data.not_a_choice && data.is_group',
					'choices' => [
						[
							'label' => __( 'Use global setting', 'product-configurator-for-woocommerce' ),
							'value' => 'inherit'
						],
						[
							'label' => __( 'Yes', 'product-configurator-for-woocommerce' ),
							'value' => 'enabled'
						],
						[
							'label' => _x( 'No', 'Content of this group is hidden by default - Yes, No, Inherit', 'product-configurator-for-woocommerce' ),
							'value' => 'disabled'
						],
					],
					'priority' => 55,
					'section' => 'advanced',
				),
				'weight' => array(
					'label' => __('Weight', 'product-configurator-for-woocommerce' ) . ' (' . get_option( 'woocommerce_weight_unit' ) . ')',
					'type' => 'number',
					'priority' => 60,
					'section' => 'advanced',
					'condition' => '!data.not_a_choice && !data.is_group && ( "simple" == data.layer_type || "multiple" == data.layer_type  || ( "form" == data.layer_type && ( "number" == data.text_field_type || "mkl_quantity" == data.text_field_type )))',
				),
				'class_name' => array(
					'label' => __('CSS Class', 'product-configurator-for-woocommerce' ),
					'type' => 'text',
					'priority' => 150,
					'section' => 'advanced',
				),
			);

			if ( '3d' === mkl_pc_get_configurator_type( $post->ID ) ) {
				$fields['object_3d_id'] = array(
					'label'     => __( '3D model', 'product-configurator-for-woocommerce' ),
					'type'      => 'html',
					'section'   => 'threed',
					'priority'  => 10,
					'condition' => '!data.not_a_choice && !data.is_group && ( "simple" == data.layer_type || "multiple" == data.layer_type)',
					'html'      => '<div class="mkl-pc-setting--container mkl-pc--object3d-select-container">'
						. '<select class="components-select-control__input" data-setting="object_3d_id">'
						. '<option value="">' . esc_html__( '— None / Inherit —', 'product-configurator-for-woocommerce' ) . '</option>'
						. '</select>'
						. '<p class="description">' . esc_html__( 'Select a 3D object from the 3D Objects tab.', 'product-configurator-for-woocommerce' ) . '</p>'
						. '</div>',
				);
				$fields['object_id_3d'] = array(
					'label'     => __( 'Object ID (scene)', 'product-configurator-for-woocommerce' ),
					'type'      => 'html',
					'section'   => 'threed',
					'priority'  => 12,
					'condition' => '!data.not_a_choice && !data.is_group && ( "simple" == data.layer_type || "multiple" == data.layer_type)',
					'html'      => '<div class="mkl-pc-setting--container">'
						. '<input type="text" class="components-select-control__input" data-setting="object_id_3d" value="<# if ( data.object_id_3d ) { #>{{data.object_id_3d}}<# } #>" placeholder="' . esc_attr__( 'Object ID or name', 'product-configurator-for-woocommerce' ) . '"> '
						. ' <button type="button" class="button mkl-pc--action" data-action="select_3d_object" data-setting="object_id_3d">' . esc_html__( 'Select from list', 'product-configurator-for-woocommerce' ) . '</button>'
						. '</div>',
				);
				$fields['actions_3d'] = array(
					'label'    => __( 'Actions', 'product-configurator-for-woocommerce' ),
					'type'     => 'repeater',
					'priority' => 25,
					'section'  => 'threed',
					'condition' => '!data.not_a_choice && !data.is_group && ( "simple" == data.layer_type || "multiple" == data.layer_type)',
					'fields'   => array(
						'action_type' => array(
							'label'   => __( 'Action', 'product-configurator-for-woocommerce' ),
							'type'    => 'select',
							'choices' => array(
								array( 'label' => __( 'Display object', 'product-configurator-for-woocommerce' ), 'value' => 'toggle_visibility' ),
								array( 'label' => __( 'Select material variant', 'product-configurator-for-woocommerce' ), 'value' => 'material_variant' ),
								array( 'label' => __( 'Set material texture', 'product-configurator-for-woocommerce' ), 'value' => 'material_texture' ),
								array( 'label' => __( 'Change material color (from registry)', 'product-configurator-for-woocommerce' ), 'value' => 'material_color_registry' ),
								array( 'label' => __( 'Change material property', 'product-configurator-for-woocommerce' ), 'value' => 'material_property' ),
								array( 'label' => __( 'Apply material', 'product-configurator-for-woocommerce' ), 'value' => 'apply_material' ),
							),
							'default' => 'toggle_visibility',
						),
						'material_variant_value' => array(
							'label'     => __( 'Variant name', 'product-configurator-for-woocommerce' ),
							'type'      => 'variant_select',
							'default'   => '',
							'show_when' => 'material_variant',
						),
						'material_texture_id' => array(
							'label'     => __( 'Texture', 'product-configurator-for-woocommerce' ),
							'type'      => 'attachment',
							'default'   => '',
							'show_when' => 'material_texture',
						),
						'material_texture_material_name' => array(
							'label'     => __( 'Material', 'product-configurator-for-woocommerce' ),
							'type'      => 'material_select',
							'default'   => '',
							'show_when' => 'material_texture',
						),
						'material_name' => array(
							'label'     => __( 'Material', 'product-configurator-for-woocommerce' ),
							'type'      => 'material_select',
							'default'   => '',
							'show_when' => 'material_color_registry|material_property|apply_material',
						),
						'material_registry_color' => array(
							'label'     => __( 'Color', 'product-configurator-for-woocommerce' ),
							'type'      => 'color',
							'default'   => '#ffffff',
							'show_when' => 'material_color_registry',
						),
						'material_property_name' => array(
							'label'     => __( 'Property', 'product-configurator-for-woocommerce' ),
							'type'      => 'text',
							'default'   => '',
							'placeholder' => 'e.g. roughness, metalness, opacity',
							'show_when' => 'material_property',
						),
						'material_property_value' => array(
							'label'     => __( 'Value', 'product-configurator-for-woocommerce' ),
							'type'      => 'text',
							'default'   => '',
							'show_when' => 'material_property',
						),
					),
				);
			}

			if ( ! class_exists( 'MKL_PC_Stock_Management__Admin' ) && ! get_user_meta( get_current_user_id(), 'mkl_pc_hide_addon__stock_management_placeholder', true ) ) {
				$fields['stock_management_placeholder'] = array(
					'label' => __( 'Stock management and linked product', 'product-configurator-for-woocommerce' ),
					'type'=> 'html',
					'priority' => 10,
					'section' => 'stock_management',
					'html' => '<div class="addon-setting-info">' 
						. '<p>' . sprintf( _x( '%s is available as %san add-on%s.', 'First placeholder is the add-on name, second and third are the link tags to the add-on', 'product-configurator-for-woocommerce' ), __( 'Stock management and linked product', 'product-configurator-for-woocommerce' ), '<a href="https://wc-product-configurator.com/product/stock-management-and-linked-product/" target="_blank" class="mkl-pc-link--external">', '</a>' ) . '</p>'
						. '<p>' . __( 'Manage stock, add a linked product to the cart.', 'product-configurator-for-woocommerce' ) . '</p>'
						. '<p>' . __( 'Create complex composite products, and easily export your order data to third party services and ERP platforms.', 'product-configurator-for-woocommerce' ) . '</p>'
						. '<p><a href="#" class="hide-addon-placeholder">' . __( 'Hide this notice', 'product-configurator-for-woocommerce' ) . '</a>'
						. '</div>',
					'condition' => '!data.is_group && ! localStorage.getItem( "mkl_pc_settings_hide__stock_management_placeholder" )',
					'classes' => 'add-on-placeholder',
				);
			}

			if ( ! class_exists( 'MKL_PC_Extra_Price' ) && ! get_user_meta( get_current_user_id(), 'mkl_pc_hide_addon__extra_price_placeholder', true ) ) {
				$fields['extra_price_placeholder'] = array(
					'label' => __( 'Extra price', 'product-configurator-for-woocommerce' ),
					'type' => 'html',
					'priority' => 31,
					'html' => '<div class="addon-setting-info">' 
						. '<p>' . sprintf( _x( '%s is available as %san add-on%s.', 'First placeholder is the add-on name, second and third are the link tags to the add-on', 'product-configurator-for-woocommerce' ), __( 'Extra price', 'product-configurator-for-woocommerce' ), '<a href="https://wc-product-configurator.com/product/extra-price/" target="_blank" class="mkl-pc-link--external">', '</a>' ) . '</p>'
						. '<p>' . __( 'Add a price to your choices.', 'product-configurator-for-woocommerce' ) . '</p>'
						. '<p>' . ' ' . __( 'Together with the Form fields add-on, calculate complex prices.', 'product-configurator-for-woocommerce' ) . '</p>'
						. '<p><a href="#" class="hide-addon-placeholder">' . __( 'Hide this notice', 'product-configurator-for-woocommerce' ) . '</a>'
						. '</div>',
					'section' => 'extra_price_settings',
					'condition' => '!data.is_group && ! localStorage.getItem( "mkl_pc_settings_hide__extra_price_placeholder" )',
					'classes' => 'add-on-placeholder',
				);
			}

			if ( ! class_exists( 'MKL_PC_Form_Builder_Admin' ) && ! get_user_meta( get_current_user_id(), 'mkl_pc_hide_addon__form_field_placeholder', true ) ) {
				$fields['form_field_placeholder'] = array(
					'label' => __( 'Form fields', 'product-configurator-for-woocommerce' ),
					'type'=> 'html',
					'priority' => 10,
					'section' => 'form_fields',
					'html' => '<div class="addon-setting-info">' 
						. '<p>' . sprintf( _x( '%s is available as %san add-on%s.', 'First placeholder is the add-on name, second and third are the link tags to the add-on', 'product-configurator-for-woocommerce' ), __( 'Form fields', 'product-configurator-for-woocommerce' ), '<a href="https://wc-product-configurator.com/product/form-fields/" target="_blank" class="mkl-pc-link--external">', '</a>' ) . '</p>'
						. '<p>' . __( 'Add form fields to your choices: text, number, files and more.', 'product-configurator-for-woocommerce' ) . '</p>'
						. '<p>' . ' ' . __( 'Together with the Extra price add-on, calculate complex prices.', 'product-configurator-for-woocommerce' ) . '</p>'
						. '<p><a href="#" class="hide-addon-placeholder">' . __( 'Hide this notice', 'product-configurator-for-woocommerce' ) . '</a>'
						. '</div>',
					'condition' => '!data.is_group && ! localStorage.getItem( "mkl_pc_settings_hide__form_field_placeholder" )',
					'classes' => 'add-on-placeholder',
				);
			}

			return apply_filters( 'mkl_pc_choice_default_settings', $fields );
		}

		/**
		 * Get the setting sections
		 *
		 * @return array
		 */
		public function get_sections() {
			$sections = [
				'_general' => array(
					'id' => 'general',
					'label' => __( 'General', 'product-configurator-for-woocommerce' ),
					'priority' => 10,
					'fields' => [
					],
				),
				'_extra_price_settings' => array(
					'id' => 'extra_price_settings',
					'label' => __( 'Extra price', 'product-configurator-for-woocommerce' ),
					'priority' => 30,
					'collapsible' => true,
					'fields' => [
					],
				),
				'_stock_management' => array(
					'id' => 'stock_management',
					'label' => __( 'Stock management' ),
					'priority' => 40,
					'collapsible' => true,
					'fields' => [],
				),
				'_form_fields' => array(
					'id' => 'form_fields',
					'label' => __( 'Form fields', 'product-configurator-for-woocommerce' ),
					'priority' => 46,
					'collapsible' => true,
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
			];
			global $post;
			if ( '3d' === mkl_pc_get_configurator_type( $post->ID ) ) {
				$sections['_threed'] = array(
					'id' => 'threed',
					'label' => __( '3D', 'product-configurator-for-woocommerce' ),
					'priority' => 20,
					'collapsible' => true,
					'fields' => [
					],
				);
			}
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
				
			return apply_filters( 'mkl_pc_choice_settings_sections', $sections );

		}
	}
}