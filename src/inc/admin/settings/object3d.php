<?php
namespace MKL\PC;
/**
 * Settings schema and defaults for 3D objects (GLTF uploads, etc.)
 *
 * @author   Marc Lacroix
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( ! class_exists( 'MKL\PC\Abstract_Settings' ) ) {
	require_once __DIR__ . '/abstract.php';
}

if ( ! class_exists( 'MKL\PC\Object3D_Settings' ) ) {

	class Object3D_Settings extends Abstract_Settings {

		public $type = 'object3d';

		public function __construct() {
			parent::__construct();
		}

		/**
		 * Default attributes for a single 3D object in the collection.
		 * File fields store only { attachment_id, url }. No filename.
		 *
		 * @return array
		 */
		public static function get_default_3d_object() {
			return array(
				'_id'              => 0,
				'label'            => '',
				'object_type'      => 'gltf',
				'loading_strategy'  => 'eager',
				'gltf'             => array(
					'attachment_id' => null,
					'url'           => '',
				),
				'env_type' => 'hdri',
				'env_hdri_file' => array( 'attachment_id' => null, 'url' => '' ),
				'env_cubemap_px' => array( 'attachment_id' => null, 'url' => '' ),
				'env_cubemap_nx' => array( 'attachment_id' => null, 'url' => '' ),
				'env_cubemap_py' => array( 'attachment_id' => null, 'url' => '' ),
				'env_cubemap_ny' => array( 'attachment_id' => null, 'url' => '' ),
				'env_cubemap_pz' => array( 'attachment_id' => null, 'url' => '' ),
				'env_cubemap_nz' => array( 'attachment_id' => null, 'url' => '' ),
				'light_type' => 'PointLight',
				'light_position' => array( 'x' => 0, 'y' => 0, 'z' => 0 ),
				'light_color' => '#ffffff',
				'light_intensity' => 1,
				'cast_shadows' => false,
				'light_target_object_id' => '',
				'light_target' => array( 'x' => 0, 'y' => 0, 'z' => 0 ),
				'light_angle' => 0.785398,
				'penumbra' => 0,
				'distance' => 0,
				'decay' => 2,
				'rect_width' => 10,
				'rect_height' => 10,
				'rect_rotation' => array( 'x' => 0, 'y' => 0, 'z' => 0 ),
				'light_ground_color' => '#443333',
				'light_cookie' => array( 'attachment_id' => null, 'url' => '' ),
			);
		}

		/**
		 * Form fields for editing one 3D object (used by admin 3D Objects view).
		 *
		 * @return array
		 */
		public function get_settings_list() {
			$settings = array(
				'name' => array(
					'label'   => \__( 'Label', 'product-configurator-for-woocommerce' ),
					'type'    => 'text',
					'priority' => 10,
					'section' => 'object3d',
				),
				// 'object_type' => array(
				// 	'label'   => \__( 'Object type', 'product-configurator-for-woocommerce' ),
				// 	'type'    => 'select',
				// 	'priority' => 20,
				// 	'section' => 'object3d',
				// 	'choices' => array(
				// 		array( 'label' => \__( 'GLTF model', 'product-configurator-for-woocommerce' ), 'value' => 'gltf' ),
				// 		array( 'label' => \__( 'Light', 'product-configurator-for-woocommerce' ), 'value' => 'light' ),
				// 		// array( 'label' => \__( 'Decal', 'product-configurator-for-woocommerce' ), 'value' => 'decal' ),
				// 		array( 'label' => \__( 'Environment', 'product-configurator-for-woocommerce' ), 'value' => 'environment' ),
				// 	),
				// ),
				'gltf' => array(
					'label'       => \__( '3D file', 'product-configurator-for-woocommerce' ),
					'type'        => 'file',
					'priority'    => 25,
					'section'     => 'object3d',
					'condition'   => '"gltf" == data.object_type',
					'show_preview' => false,
					'allowed_types' => 'file',
					'button_select_label' => \__( 'Select model', 'product-configurator-for-woocommerce' ),
					'button_select_label_has_file' => \__( 'Select new model', 'product-configurator-for-woocommerce' ),
					'button_remove_label' => \__( 'Remove', 'product-configurator-for-woocommerce' ),
				),
				'loading_strategy' => array(
					'label'   => \__( 'Loading', 'product-configurator-for-woocommerce' ),
					'type'    => 'select',
					'priority' => 30,
					'section' => 'object3d',
					'choices' => array(
						array( 'label' => \__( 'Eager', 'product-configurator-for-woocommerce' ), 'value' => 'eager' ),
						array( 'label' => \__( 'Lazy', 'product-configurator-for-woocommerce' ), 'value' => 'lazy' ),
					),
					'condition' => '"gltf" == data.object_type',
				),
				// Light section fields (section "light" – shown when object_type is light)
				'light_type' => array(
					'label'   => \__( 'Light type', 'product-configurator-for-woocommerce' ),
					'type'    => 'select',
					'priority' => 10,
					'section' => 'light',
					'condition' => '"light" == data.object_type',
					'choices' => self::get_light_type_choices(),
				),
				'light_position' => array(
					'label'   => \__( 'Position', 'product-configurator-for-woocommerce' ),
					'type'    => 'euler',
					'priority' => 12,
					'section' => 'light',
					'condition' => '"light" == data.object_type',
					'id'      => 'light_position',
				),
				'light_color' => array(
					'label'   => \__( 'Color', 'product-configurator-for-woocommerce' ),
					'type'    => 'text',
					'priority' => 18,
					'section' => 'light',
					'input_classes' => 'color-hex',
					'condition' => '"light" == data.object_type',
				),
				'light_intensity' => array(
					'label'   => \__( 'Intensity', 'product-configurator-for-woocommerce' ),
					'type'    => 'number',
					'priority' => 20,
					'section' => 'light',
					'condition' => '"light" == data.object_type',
					'attributes' => array( 'min' => 0, 'step' => 'any' ),
				),
				'cast_shadows' => array(
					'label'   => \__( 'Cast shadows', 'product-configurator-for-woocommerce' ),
					'type'    => 'checkbox',
					'priority' => 21,
					'section' => 'light',
					'condition' => '"light" == data.object_type && ( data.light_type === "DirectionalLight" || data.light_type === "SpotLight" || data.light_type === "PointLight" )',
				),
				'light_target_object_id' => array(
					'label'   => \__( 'Target (object)', 'product-configurator-for-woocommerce' ),
					'type'    => 'html',
					'priority' => 22,
					'section' => 'light',
					'condition' => '"light" == data.object_type',
					'html'    => self::light_field_target_selector(),
				),
				'light_target' => array(
					'label'   => \__( 'Target position', 'product-configurator-for-woocommerce' ),
					'type'    => 'euler',
					'priority' => 24,
					'section' => 'light',
					'condition' => '"light" == data.object_type',
				),
				'light_angle' => array(
					'label'   => \__( 'Angle (rad)', 'product-configurator-for-woocommerce' ),
					'type'    => 'number',
					'priority' => 30,
					'section' => 'light',
					'condition' => '"light" == data.object_type && data.light_type === "SpotLight"',
					'attributes' => array( 'min' => 0, 'step' => 'any' ),
				),
				'penumbra' => array(
					'label'   => \__( 'Penumbra', 'product-configurator-for-woocommerce' ),
					'type'    => 'number',
					'priority' => 32,
					'section' => 'light',
					'condition' => '"light" == data.object_type && data.light_type === "SpotLight"',
					'attributes' => array( 'min' => 0, 'max' => 1, 'step' => 'any' ),
				),
				'distance' => array(
					'label'   => \__( 'Distance', 'product-configurator-for-woocommerce' ),
					'type'    => 'number',
					'priority' => 34,
					'section' => 'light',
					'condition' => '"light" == data.object_type && ( data.light_type === "PointLight" || data.light_type === "SpotLight" )',
					'attributes' => array( 'min' => 0, 'step' => 'any' ),
				),
				'decay' => array(
					'label'   => \__( 'Decay', 'product-configurator-for-woocommerce' ),
					'type'    => 'number',
					'priority' => 36,
					'section' => 'light',
					'condition' => '"light" == data.object_type && ( data.light_type === "PointLight" || data.light_type === "SpotLight" )',
					'attributes' => array( 'min' => 0, 'step' => 'any' ),
				),
				'rect_width' => array(
					'label'   => \__( 'Width', 'product-configurator-for-woocommerce' ),
					'type'    => 'number',
					'priority' => 38,
					'section' => 'light',
					'condition' => '"light" == data.object_type && data.light_type === "RectAreaLight"',
					'attributes' => array( 'min' => 0, 'step' => 'any' ),
				),
				'rect_height' => array(
					'label'   => \__( 'Height', 'product-configurator-for-woocommerce' ),
					'type'    => 'number',
					'priority' => 40,
					'section' => 'light',
					'condition' => '"light" == data.object_type && data.light_type === "RectAreaLight"',
					'attributes' => array( 'min' => 0, 'step' => 'any' ),
				),
				'rect_rotation' => array(
					'label'   => \__( 'Rotation (deg)', 'product-configurator-for-woocommerce' ),
					'type'    => 'euler',
					'priority' => 42,
					'section' => 'light',
					'condition' => '"light" == data.object_type && data.light_type === "RectAreaLight"',
				),
				'light_ground_color' => array(
					'label'   => \__( 'Ground color', 'product-configurator-for-woocommerce' ),
					'type'    => 'text',
					'priority' => 48,
					'section' => 'light',
					'input_classes' => 'color-hex',
					'condition' => '"light" == data.object_type && data.light_type === "HemisphereLight"',
				),
				'light_cookie' => array(
					'label'       => \__( 'Cookie (projection image)', 'product-configurator-for-woocommerce' ),
					'type'        => 'file',
					'priority'    => 44,
					'section'     => 'light',
					'condition'   => '"light" == data.object_type && ( data.light_type === "SpotLight" || data.light_type === "DirectionalLight" )',
					'show_preview' => true,
					'allowed_types' => 'image',
					'button_select_label' => \__( 'Select image', 'product-configurator-for-woocommerce' ),
					'button_remove_label' => \__( 'Remove', 'product-configurator-for-woocommerce' ),
				),
				// Environment section (when object_type is environment)
				'env_type' => array(
					'label'    => \__( 'Environment type', 'product-configurator-for-woocommerce' ),
					'type'     => 'select',
					'priority' => 10,
					'section'  => 'environment',
					'condition' => '"environment" == data.object_type',
					'choices' => array(
						array( 'label' => \__( 'HDRi (HDR / EXR)', 'product-configurator-for-woocommerce' ), 'value' => 'hdri' ),
						array( 'label' => \__( 'Cubemap (6 faces)', 'product-configurator-for-woocommerce' ), 'value' => 'cubemap' ),
					),
				),
				'env_hdri_file' => array(
					'label'       => \__( 'HDR/EXR file', 'product-configurator-for-woocommerce' ),
					'type'        => 'file',
					'priority'    => 12,
					'section'     => 'environment',
					'condition'   => '"environment" == data.object_type && data.env_type === "hdri"',
					'show_preview' => false,
					'allowed_types' => 'file',
					'button_select_label' => \__( 'Select HDR/EXR', 'product-configurator-for-woocommerce' ),
					'button_remove_label' => \__( 'Remove', 'product-configurator-for-woocommerce' ),
				),
				'env_cubemap_px' => array(
					'label'       => 'PX',
					'type'        => 'file',
					'priority'    => 20,
					'section'     => 'environment',
					'condition'   => '"environment" == data.object_type && data.env_type === "cubemap"',
					'show_preview' => false,
					'allowed_types' => 'image',
					'button_select_label' => \__( 'Select', 'product-configurator-for-woocommerce' ),
					'button_remove_label' => \__( 'Remove', 'product-configurator-for-woocommerce' ),
				),
				'env_cubemap_nx' => array(
					'label'       => 'NX',
					'type'        => 'file',
					'priority'    => 22,
					'section'     => 'environment',
					'condition'   => '"environment" == data.object_type && data.env_type === "cubemap"',
					'show_preview' => false,
					'allowed_types' => 'image',
					'button_select_label' => \__( 'Select', 'product-configurator-for-woocommerce' ),
					'button_remove_label' => \__( 'Remove', 'product-configurator-for-woocommerce' ),
				),
				'env_cubemap_py' => array(
					'label'       => 'PY',
					'type'        => 'file',
					'priority'    => 24,
					'section'     => 'environment',
					'condition'   => '"environment" == data.object_type && data.env_type === "cubemap"',
					'show_preview' => false,
					'allowed_types' => 'image',
					'button_select_label' => \__( 'Select', 'product-configurator-for-woocommerce' ),
					'button_remove_label' => \__( 'Remove', 'product-configurator-for-woocommerce' ),
				),
				'env_cubemap_ny' => array(
					'label'       => 'NY',
					'type'        => 'file',
					'priority'    => 26,
					'section'     => 'environment',
					'condition'   => '"environment" == data.object_type && data.env_type === "cubemap"',
					'show_preview' => false,
					'allowed_types' => 'image',
					'button_select_label' => \__( 'Select', 'product-configurator-for-woocommerce' ),
					'button_remove_label' => \__( 'Remove', 'product-configurator-for-woocommerce' ),
				),
				'env_cubemap_pz' => array(
					'label'       => 'PZ',
					'type'        => 'file',
					'priority'    => 28,
					'section'     => 'environment',
					'condition'   => '"environment" == data.object_type && data.env_type === "cubemap"',
					'show_preview' => false,
					'allowed_types' => 'image',
					'button_select_label' => \__( 'Select', 'product-configurator-for-woocommerce' ),
					'button_remove_label' => \__( 'Remove', 'product-configurator-for-woocommerce' ),
				),
				'env_cubemap_nz' => array(
					'label'       => 'NZ',
					'type'        => 'file',
					'priority'    => 30,
					'section'     => 'environment',
					'condition'   => '"environment" == data.object_type && data.env_type === "cubemap"',
					'show_preview' => false,
					'allowed_types' => 'image',
					'button_select_label' => \__( 'Select', 'product-configurator-for-woocommerce' ),
					'button_remove_label' => \__( 'Remove', 'product-configurator-for-woocommerce' ),
				),
			);

			return \apply_filters( 'mkl_pc_object3d_default_settings', $settings );
		}

		/**
		 * Sections for the 3D object form.
		 *
		 * @return array
		 */
		public function get_sections() {
			return array(
				'_object3d' => array(
					'id'          => 'object3d',
					'label'       => \__( '3D Object', 'product-configurator-for-woocommerce' ),
					'priority'    => 5,
					'fields'      => array(),
				),
				'_light' => array(
					'id'          => 'light',
					'label'       => \__( 'Light settings', 'product-configurator-for-woocommerce' ),
					'priority'    => 6,
					'collapsible' => true,
					'fields'      => array(),
				),
				'_environment' => array(
					'id'          => 'environment',
					'label'       => \__( 'Environment settings', 'product-configurator-for-woocommerce' ),
					'priority'    => 7,
					'collapsible' => true,
					'fields'      => array(),
				),
			);
		}


		/**
		 * Light type choices for the select (value => label).
		 *
		 * @return array
		 */
		private static function get_light_type_choices() {
			return array(
				array( 'value' => 'AmbientLight',     'label' => \__( 'Ambient', 'product-configurator-for-woocommerce' ) ),
				array( 'value' => 'DirectionalLight', 'label' => \__( 'Directional', 'product-configurator-for-woocommerce' ) ),
				array( 'value' => 'PointLight',       'label' => \__( 'Point', 'product-configurator-for-woocommerce' ) ),
				array( 'value' => 'SpotLight',        'label' => \__( 'Spot', 'product-configurator-for-woocommerce' ) ),
				array( 'value' => 'RectAreaLight',    'label' => \__( 'Rect Area', 'product-configurator-for-woocommerce' ) ),
				array( 'value' => 'HemisphereLight',  'label' => \__( 'Hemisphere', 'product-configurator-for-woocommerce' ) ),
			);
		}

		/**
		 * Template snippet for value from a flat light_* key (e.g. light_target_object_id).
		 *
		 * @param string $path    Flat key name (may contain non-identifier chars, which are stripped).
		 * @param mixed  $default default if missing
		 * @return string Underscore template snippet
		 */
		private static function light_value_tpl( $path, $default ) {
			$key = preg_replace( '/[^a-z0-9_]/i', '', $path );
			if ( $key === '' ) {
				return (string) $default;
			}
			return '<# if ( data.' . $key . ' != null && data.' . $key . ' !== "" ) { #>{{data.' . $key . '}}<# } else { #>' . \esc_attr( (string) $default ) . '<# } #>';
		}

		/**
		 * Target object selector: read-only input + "Select from list" button.
		 *
		 * @return string
		 */
		private static function light_field_target_selector() {
			$val = self::light_value_tpl( 'light_target_object_id', '' );
			return '<div class="mkl-pc-setting--container">'
				. '<input type="text" class="light-target-object-id components-select-control__input" data-setting="light_target_object_id" value="' . $val . '" placeholder="' . \esc_attr__( 'Select from list', 'product-configurator-for-woocommerce' ) . '" readonly>'
				. '<button type="button" class="button mkl-pc--action" data-action="select_3d_object" data-setting="light_target_object_id">' . \esc_html__( 'Select from list', 'product-configurator-for-woocommerce' ) . '</button>'
				. '</div>';
		}

	}
}
