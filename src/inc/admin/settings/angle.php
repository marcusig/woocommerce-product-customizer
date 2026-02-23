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
			global $post;
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

			if ( '3d' === mkl_pc_get_configurator_type( $post->ID ) ) {
				$settings = array_merge( $settings, Abstract_Settings::get_3d_model_source_fields( array(
					'can_upload'        => false,
					'setting_model'     => 'camera_target_model',
					'setting_upload'    => null,
					'setting_object_id' => 'camera_target_object_id',
					'model_label'       => __( 'Camera target (model)', 'product-configurator-for-woocommerce' ),
					'object_id_label'   => __( 'Camera target (object)', 'product-configurator-for-woocommerce' ),
					'section'           => 'threed',
					'priority'          => 8,
				) ) );
			}

			return apply_filters('mkl_pc_angle_default_settings', $settings );
		}

		/**
		 * Get the sections
		 *
		 * @return array
		 */
		public function get_sections() {
			$sections = [
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

			return apply_filters( 'mkl_pc_angle_settings_sections', $sections );
		}		
	}
}