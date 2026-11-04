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
				// One camera target: what a fitted view turns around and frames. The
				// select is filled by the admin JS: Visible objects, Specific objects,
				// then the models. A fixed view is the camera exactly as saved, so the
				// target and the fit settings only show for a fitted one.
				$target_fields = Abstract_Settings::get_3d_model_source_fields( array(
					'can_upload'        => false,
					'setting_model'     => 'camera_target_model',
					'setting_upload'    => null,
					'setting_object_id' => 'camera_target_object_id',
					'model_label'       => __( 'Camera target', 'product-configurator-for-woocommerce' ),
					'section'           => 'threed',
					'priority'          => 9,
					'condition'         => '"fixed" != data.camera_framing',
				) );
				// Specific objects replace the single target object; angles saved with
				// one are read as a one-object list.
				unset( $target_fields['camera_target_object_id'] );
				$target_fields['camera_target_model']['help'] = __( 'What the view turns around and frames. Visible objects follows the configuration: the view adapts when a choice adds or removes a part.', 'product-configurator-for-woocommerce' );
				$settings = array_merge( $settings, $target_fields );
				$settings['camera_focus_object_ids'] = array(
					'label'     => __( 'Objects', 'product-configurator-for-woocommerce' ),
					'type'      => 'html',
					'section'   => 'threed',
					'priority'  => 9.5,
					'condition' => '"fixed" != data.camera_framing && "objects" == data.camera_target_model',
					'html'      => '<div class="mkl-pc-setting--container mkl-pc--framing-objects-container">'
						. '<div class="mkl-pc--framing-objects-list" data-setting="camera_focus_object_ids">'
						. '<# if ( data.camera_focus_object_ids && data.camera_focus_object_ids.length ) { #>{{ data.camera_focus_object_ids.join(", ") }}<# } else { #><em>' . esc_html__( 'None selected', 'product-configurator-for-woocommerce' ) . '</em><# } #>'
						. '</div>'
						. ' <button type="button" class="button mkl-pc--action" data-action="select_3d_objects" data-setting="camera_focus_object_ids">' . esc_html__( 'Select from list', 'product-configurator-for-woocommerce' ) . '</button>'
						. ' <button type="button" class="button mkl-pc--action mkl-pc--action-clear-framing" data-action="clear_framing_objects" data-setting="camera_focus_object_ids">' . esc_html__( 'Clear', 'product-configurator-for-woocommerce' ) . '</button>'
						. '</div>',
				);
				// Stored empty until changed, which the viewer reads as "fit": the first
				// choice is what the select shows for an angle that never set it.
				$settings['camera_framing'] = array(
					'label'    => __( 'Framing', 'product-configurator-for-woocommerce' ),
					'type'     => 'select',
					'section'  => 'threed',
					'priority' => 8,
					'choices'  => array(
						array(
							'label' => __( 'Fit the target in view', 'product-configurator-for-woocommerce' ),
							'value' => 'fit',
						),
						array(
							'label' => __( 'Use the camera exactly as saved', 'product-configurator-for-woocommerce' ),
							'value' => 'fixed',
						),
					),
					'help'     => __( 'Fit keeps the viewing direction you saved and adjusts the distance so the whole target is visible, and centred, on any screen size. Exactly as saved keeps the camera where you saved it, for shots such as one from inside a car: choices do not move it.', 'product-configurator-for-woocommerce' ),
				);
				$settings['camera_fit_margin'] = array(
					'label'      => __( 'Margin around the target (%)', 'product-configurator-for-woocommerce' ),
					'type'       => 'number',
					'section'    => 'threed',
					'priority'   => 21,
					'condition'  => '"fixed" != data.camera_framing',
					'attributes' => array(
						'min'         => 0,
						'max'         => 45,
						'step'        => 1,
						'placeholder' => 5,
					),
				);
				// Empty means no cap. On a large screen the margin alone would blow the
				// product up to fill the canvas; these stop the fit growing it further.
				$settings['camera_fit_max_width'] = array(
					'label'      => __( 'Maximum width (px)', 'product-configurator-for-woocommerce' ),
					'type'       => 'number',
					'section'    => 'threed',
					'priority'   => 21.1,
					'condition'  => '"fixed" != data.camera_framing',
					'attributes' => array(
						'min'  => 0,
						'step' => 10,
					),
				);
				$settings['camera_fit_max_height'] = array(
					'label'      => __( 'Maximum height (px)', 'product-configurator-for-woocommerce' ),
					'type'       => 'number',
					'section'    => 'threed',
					'priority'   => 21.2,
					'condition'  => '"fixed" != data.camera_framing',
					'attributes' => array(
						'min'  => 0,
						'step' => 10,
					),
					'help'       => __( 'Limits how large the target is drawn on big screens, on top of the margin. Leave empty for no limit. Cart and saved-design images are not limited.', 'product-configurator-for-woocommerce' ),
				);
				$settings['camera_turn'] = array(
					'label'    => __( 'Camera turn when arriving', 'product-configurator-for-woocommerce' ),
					'type'     => 'select',
					'section'  => 'threed',
					'priority' => 22,
					'choices'  => array(
						array(
							'label' => __( 'Shortest way', 'product-configurator-for-woocommerce' ),
							'value' => 'shortest',
						),
						array(
							'label' => __( 'Clockwise, seen from above', 'product-configurator-for-woocommerce' ),
							'value' => 'cw',
						),
						array(
							'label' => __( 'Counter-clockwise, seen from above', 'product-configurator-for-woocommerce' ),
							'value' => 'ccw',
						),
					),
					'help'     => __( 'Which way the camera goes around the product when switching to this view. Ignored when the orbit is limited horizontally: the camera then takes the only way the limits allow.', 'product-configurator-for-woocommerce' ),
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