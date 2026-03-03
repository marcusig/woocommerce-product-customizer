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
		 *
		 * @return array
		 */
		public static function get_default_3d_object() {
			return array(
				'_id'              => 0,
				'label'            => '',
				'attachment_id'    => null,
				'url'              => '',
				'filename'         => '',
				'object_type'      => 'gltf',
				'loading_strategy'  => 'eager',
				'environment_data' => array(
					'env_type' => 'hdri',
					'url'      => '',
					'faces'    => array(
						'px' => array( 'url' => '' ),
						'nx' => array( 'url' => '' ),
						'py' => array( 'url' => '' ),
						'ny' => array( 'url' => '' ),
						'pz' => array( 'url' => '' ),
						'nz' => array( 'url' => '' ),
					),
				),
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
				'object_type' => array(
					'label'   => \__( 'Object type', 'product-configurator-for-woocommerce' ),
					'type'    => 'select',
					'priority' => 20,
					'section' => 'object3d',
					'choices' => array(
						array( 'label' => \__( 'GLTF model', 'product-configurator-for-woocommerce' ), 'value' => 'gltf' ),
						array( 'label' => \__( 'Light', 'product-configurator-for-woocommerce' ), 'value' => 'light' ),
						array( 'label' => \__( 'Decal', 'product-configurator-for-woocommerce' ), 'value' => 'decal' ),
						array( 'label' => \__( 'Environment', 'product-configurator-for-woocommerce' ), 'value' => 'environment' ),
					),
				),
				'attachment_id' => array(
					'label'       => \__( '3D file', 'product-configurator-for-woocommerce' ),
					'type'        => 'file',
					'priority'    => 25,
					'section'     => 'object3d',
					'condition'   => '"gltf" == data.object_type',
					'value_path'  => 'attachment_id',
					'flat_id_path'  => 'attachment_id',
					'flat_url_path' => 'url',
					'flat_filename_path' => 'filename',
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
				'light_data.type' => array(
					'label'   => \__( 'Light type', 'product-configurator-for-woocommerce' ),
					'type'    => 'select',
					'priority' => 10,
					'section' => 'light',
					'condition' => '"light" == data.object_type',
					'choices' => self::get_light_type_choices(),
				),
				'light_position_x' => array(
					'label'   => \__( 'Position X', 'product-configurator-for-woocommerce' ),
					'type'    => 'html',
					'priority' => 12,
					'section' => 'light',
					'condition' => '"light" == data.object_type',
					'html'    => self::light_field_number( 'light_data.position.x', 0 ),
				),
				'light_position_y' => array(
					'label'   => \__( 'Position Y', 'product-configurator-for-woocommerce' ),
					'type'    => 'html',
					'priority' => 14,
					'section' => 'light',
					'condition' => '"light" == data.object_type',
					'html'    => self::light_field_number( 'light_data.position.y', 0 ),
				),
				'light_position_z' => array(
					'label'   => \__( 'Position Z', 'product-configurator-for-woocommerce' ),
					'type'    => 'html',
					'priority' => 16,
					'section' => 'light',
					'condition' => '"light" == data.object_type',
					'html'    => self::light_field_number( 'light_data.position.z', 0 ),
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
					'type'    => 'html',
					'priority' => 20,
					'section' => 'light',
					'condition' => '"light" == data.object_type',
					'html'    => self::light_field_number( 'light_data.intensity', 1, array( 'min' => 0 ) ),
				),
				'light_target_object_id' => array(
					'label'   => \__( 'Target (object)', 'product-configurator-for-woocommerce' ),
					'type'    => 'html',
					'priority' => 22,
					'section' => 'light',
					'condition' => '"light" == data.object_type',
					'html'    => self::light_field_target_selector(),
				),
				'light_target_x' => array(
					'label'   => \__( 'Target position X', 'product-configurator-for-woocommerce' ),
					'type'    => 'html',
					'priority' => 24,
					'section' => 'light',
					'condition' => '"light" == data.object_type',
					'html'    => self::light_field_number( 'light_data.target.x', 0 ),
				),
				'light_target_y' => array(
					'label'   => \__( 'Target position Y', 'product-configurator-for-woocommerce' ),
					'type'    => 'html',
					'priority' => 26,
					'section' => 'light',
					'condition' => '"light" == data.object_type',
					'html'    => self::light_field_number( 'light_data.target.y', 0 ),
				),
				'light_target_z' => array(
					'label'   => \__( 'Target position Z', 'product-configurator-for-woocommerce' ),
					'type'    => 'html',
					'priority' => 28,
					'section' => 'light',
					'condition' => '"light" == data.object_type',
					'html'    => self::light_field_number( 'light_data.target.z', 0 ),
				),
				'light_angle' => array(
					'label'   => \__( 'Angle (rad)', 'product-configurator-for-woocommerce' ),
					'type'    => 'html',
					'priority' => 30,
					'section' => 'light',
					'condition' => '"light" == data.object_type && data.light_data && data.light_data.type === "SpotLight"',
					'html'    => self::light_field_number( 'light_data.angle', 0.785398, array( 'min' => 0 ) ),
				),
				'light_penumbra' => array(
					'label'   => \__( 'Penumbra', 'product-configurator-for-woocommerce' ),
					'type'    => 'html',
					'priority' => 32,
					'section' => 'light',
					'condition' => '"light" == data.object_type && data.light_data && data.light_data.type === "SpotLight"',
					'html'    => self::light_field_number( 'light_data.penumbra', 0, array( 'min' => 0, 'max' => 1 ) ),
				),
				'light_distance' => array(
					'label'   => \__( 'Distance', 'product-configurator-for-woocommerce' ),
					'type'    => 'html',
					'priority' => 34,
					'section' => 'light',
					'condition' => '"light" == data.object_type && data.light_data && ( data.light_data.type === "PointLight" || data.light_data.type === "SpotLight" )',
					'html'    => self::light_field_number( 'light_data.distance', 0, array( 'min' => 0 ) ),
				),
				'light_decay' => array(
					'label'   => \__( 'Decay', 'product-configurator-for-woocommerce' ),
					'type'    => 'html',
					'priority' => 36,
					'section' => 'light',
					'condition' => '"light" == data.object_type && data.light_data && ( data.light_data.type === "PointLight" || data.light_data.type === "SpotLight" )',
					'html'    => self::light_field_number( 'light_data.decay', 2, array( 'min' => 0 ) ),
				),
				'light_width' => array(
					'label'   => \__( 'Width', 'product-configurator-for-woocommerce' ),
					'type'    => 'html',
					'priority' => 38,
					'section' => 'light',
					'condition' => '"light" == data.object_type && data.light_data && data.light_data.type === "RectAreaLight"',
					'html'    => self::light_field_number( 'light_data.rect_width', 10, array( 'min' => 0 ) ),
				),
				'light_height' => array(
					'label'   => \__( 'Height', 'product-configurator-for-woocommerce' ),
					'type'    => 'html',
					'priority' => 40,
					'section' => 'light',
					'condition' => '"light" == data.object_type && data.light_data && data.light_data.type === "RectAreaLight"',
					'html'    => self::light_field_number( 'light_data.rect_height', 10, array( 'min' => 0 ) ),
				),
				'light_rect_rotation_x' => array(
					'label'   => \__( 'Rotation X (deg)', 'product-configurator-for-woocommerce' ),
					'type'    => 'html',
					'priority' => 42,
					'section' => 'light',
					'condition' => '"light" == data.object_type && data.light_data && data.light_data.type === "RectAreaLight"',
					'html'    => self::light_field_number( 'light_data.rect_rotation.x', 0 ),
				),
				'light_rect_rotation_y' => array(
					'label'   => \__( 'Rotation Y (deg)', 'product-configurator-for-woocommerce' ),
					'type'    => 'html',
					'priority' => 44,
					'section' => 'light',
					'condition' => '"light" == data.object_type && data.light_data && data.light_data.type === "RectAreaLight"',
					'html'    => self::light_field_number( 'light_data.rect_rotation.y', 0 ),
				),
				'light_rect_rotation_z' => array(
					'label'   => \__( 'Rotation Z (deg)', 'product-configurator-for-woocommerce' ),
					'type'    => 'html',
					'priority' => 46,
					'section' => 'light',
					'condition' => '"light" == data.object_type && data.light_data && data.light_data.type === "RectAreaLight"',
					'html'    => self::light_field_number( 'light_data.rect_rotation.z', 0 ),
				),
				'light_ground_color' => array(
					'label'   => \__( 'Ground color', 'product-configurator-for-woocommerce' ),
					'type'    => 'html',
					'priority' => 48,
					'section' => 'light',
					'condition' => '"light" == data.object_type && data.light_data && data.light_data.type === "HemisphereLight"',
					'html'    => self::light_field_color( 'light_data.groundColor', '#443333' ),
				),
				'light_cookie' => array(
					'label'       => \__( 'Cookie (projection image)', 'product-configurator-for-woocommerce' ),
					'type'        => 'file',
					'priority'    => 44,
					'section'     => 'light',
					'condition'   => '"light" == data.object_type && data.light_data && ( data.light_data.type === "SpotLight" || data.light_data.type === "DirectionalLight" )',
					'value_path'  => 'light_data.cookie',
					'show_preview' => true,
					'allowed_types' => 'image',
					'button_select_label' => \__( 'Select image', 'product-configurator-for-woocommerce' ),
					'button_remove_label' => \__( 'Remove', 'product-configurator-for-woocommerce' ),
				),
				// Environment section (when object_type is environment)
				'env_type' => array(
					'label'    => \__( 'Environment type', 'product-configurator-for-woocommerce' ),
					'type'     => 'html',
					'priority' => 10,
					'section'  => 'environment',
					'condition' => '"environment" == data.object_type',
					'html'     => self::env_type_select(),
				),
				'env_hdri_file' => array(
					'label'       => \__( 'HDR/EXR file', 'product-configurator-for-woocommerce' ),
					'type'        => 'file',
					'priority'    => 12,
					'section'     => 'environment',
					'condition'   => '"environment" == data.object_type && data.environment_data && data.environment_data.env_type === "hdri"',
					'value_path'  => 'environment_data.url',
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
					'condition'   => '"environment" == data.object_type && data.environment_data && data.environment_data.env_type === "cubemap"',
					'value_path'  => 'environment_data.faces.px',
					'show_preview' => false,
					'allowed_types' => 'file',
					'button_select_label' => \__( 'Select', 'product-configurator-for-woocommerce' ),
					'button_remove_label' => \__( 'Remove', 'product-configurator-for-woocommerce' ),
				),
				'env_cubemap_nx' => array(
					'label'       => 'NX',
					'type'        => 'file',
					'priority'    => 22,
					'section'     => 'environment',
					'condition'   => '"environment" == data.object_type && data.environment_data && data.environment_data.env_type === "cubemap"',
					'value_path'  => 'environment_data.faces.nx',
					'show_preview' => false,
					'allowed_types' => 'file',
					'button_select_label' => \__( 'Select', 'product-configurator-for-woocommerce' ),
					'button_remove_label' => \__( 'Remove', 'product-configurator-for-woocommerce' ),
				),
				'env_cubemap_py' => array(
					'label'       => 'PY',
					'type'        => 'file',
					'priority'    => 24,
					'section'     => 'environment',
					'condition'   => '"environment" == data.object_type && data.environment_data && data.environment_data.env_type === "cubemap"',
					'value_path'  => 'environment_data.faces.py',
					'show_preview' => false,
					'allowed_types' => 'file',
					'button_select_label' => \__( 'Select', 'product-configurator-for-woocommerce' ),
					'button_remove_label' => \__( 'Remove', 'product-configurator-for-woocommerce' ),
				),
				'env_cubemap_ny' => array(
					'label'       => 'NY',
					'type'        => 'file',
					'priority'    => 26,
					'section'     => 'environment',
					'condition'   => '"environment" == data.object_type && data.environment_data && data.environment_data.env_type === "cubemap"',
					'value_path'  => 'environment_data.faces.ny',
					'show_preview' => false,
					'allowed_types' => 'file',
					'button_select_label' => \__( 'Select', 'product-configurator-for-woocommerce' ),
					'button_remove_label' => \__( 'Remove', 'product-configurator-for-woocommerce' ),
				),
				'env_cubemap_pz' => array(
					'label'       => 'PZ',
					'type'        => 'file',
					'priority'    => 28,
					'section'     => 'environment',
					'condition'   => '"environment" == data.object_type && data.environment_data && data.environment_data.env_type === "cubemap"',
					'value_path'  => 'environment_data.faces.pz',
					'show_preview' => false,
					'allowed_types' => 'file',
					'button_select_label' => \__( 'Select', 'product-configurator-for-woocommerce' ),
					'button_remove_label' => \__( 'Remove', 'product-configurator-for-woocommerce' ),
				),
				'env_cubemap_nz' => array(
					'label'       => 'NZ',
					'type'        => 'file',
					'priority'    => 30,
					'section'     => 'environment',
					'condition'   => '"environment" == data.object_type && data.environment_data && data.environment_data.env_type === "cubemap"',
					'value_path'  => 'environment_data.faces.nz',
					'show_preview' => false,
					'allowed_types' => 'file',
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
		 * Environment type select (nested path environment_data.env_type).
		 *
		 * @return string
		 */
		private static function env_type_select() {
			$out = '<select class="components-select-control__input" data-setting="environment_data.env_type">';
			$out .= '<option value="hdri" <# if ( data.environment_data && data.environment_data.env_type === "hdri" ) { #> selected <# } #>>' . \esc_html__( 'HDRi (HDR / EXR)', 'product-configurator-for-woocommerce' ) . '</option>';
			$out .= '<option value="cubemap" <# if ( data.environment_data && data.environment_data.env_type === "cubemap" ) { #> selected <# } #>>' . \esc_html__( 'Cubemap (6 faces)', 'product-configurator-for-woocommerce' ) . '</option>';
			$out .= '</select>';
			return $out;
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
		 * Build HTML for a light select field (data-setting and value from light_data path).
		 *
		 * @param string $setting data-setting value (e.g. light_data.type)
		 * @param array  $choices  value => label
		 * @return string
		 */
		private static function light_field_select( $setting, $choices ) {
			$out = '<select class="components-select-control__input" data-setting="' . \esc_attr( $setting ) . '">';
			foreach ( $choices as $value => $label ) {
				$sel = $setting === 'light_data.type'
					? '<# if ( data.light_data && data.light_data.type === "' . \esc_attr( $value ) . '" ) { #> selected <# } #>'
					: '';
				$out .= '<option value="' . \esc_attr( $value ) . '" ' . $sel . '>' . \esc_html( $label ) . '</option>';
			}
			$out .= '</select>';
			return $out;
		}

		/**
		 * Build HTML for a light number input. Value read from light_data by path (e.g. light_data.position.x).
		 *
		 * @param string $setting data-setting value
		 * @param mixed  $default default value in template
		 * @param array  $attrs   optional min/max/step
		 * @return string
		 */
		private static function light_field_number( $setting, $default, $attrs = array() ) {
			$val = self::light_value_tpl( $setting, $default );
			$extra = '';
			if ( isset( $attrs['min'] ) ) {
				$extra .= ' min="' . \esc_attr( $attrs['min'] ) . '"';
			}
			if ( isset( $attrs['max'] ) ) {
				$extra .= ' max="' . \esc_attr( $attrs['max'] ) . '"';
			}
			$extra .= ' step="any"';
			return '<input type="number" class="components-select-control__input" data-setting="' . \esc_attr( $setting ) . '" value="' . $val . '"' . $extra . '>';
		}

		/**
		 * Build HTML for a light color input (same pattern as choice color: placeholder, color-hex class).
		 *
		 * @param string $setting data-setting value (e.g. light_data.color)
		 * @param string $default default hex (e.g. #ffffff)
		 * @return string
		 */
		private static function light_field_color( $setting, $default = '#ffffff' ) {
			$val = self::light_value_tpl( $setting, $default );
			return '<input type="text" class="components-select-control__input color-hex" data-setting="' . \esc_attr( $setting ) . '" value="' . $val . '" placeholder="' . \esc_attr( \__( 'E.g. #EEFF00', 'product-configurator-for-woocommerce' ) ) . '">';
		}

		/**
		 * Template snippet for value from light_data path (safe: checks light_data and nested keys).
		 *
		 * @param string $path    dot path including light_data (e.g. light_data.position.x)
		 * @param mixed  $default default if missing
		 * @return string Underscore template snippet
		 */
		private static function light_value_tpl( $path, $default ) {
			if ( strpos( $path, 'light_data.' ) !== 0 ) {
				return (string) $default;
			}
			$parts = explode( '.', substr( $path, strlen( 'light_data.' ) ) );
			$conds = array( 'data.light_data' );
			$cur  = 'data.light_data';
			foreach ( array_slice( $parts, 0, -1 ) as $p ) {
				$cur .= '.' . $p;
				$conds[] = $cur;
			}
			$cur .= '.' . end( $parts );
			$cond = implode( ' && ', $conds ) . ' && ' . $cur . ' != null';
			return '<# if ( ' . $cond . ' ) { #>{{' . $cur . '}}<# } else { #>' . \esc_attr( (string) $default ) . '<# } #>';
		}

		/**
		 * Target object selector: read-only input + "Select from list" button.
		 *
		 * @return string
		 */
		private static function light_field_target_selector() {
			$val = self::light_value_tpl( 'light_data.target_object_id', '' );
			return '<div class="mkl-pc-setting--container">'
				. '<input type="text" class="light-target-object-id components-select-control__input" data-setting="light_data.target_object_id" value="' . $val . '" placeholder="' . \esc_attr__( 'Select from list', 'product-configurator-for-woocommerce' ) . '" readonly>'
				. '<button type="button" class="button mkl-pc--action" data-action="select_3d_object" data-setting="light_data.target_object_id">' . \esc_html__( 'Select from list', 'product-configurator-for-woocommerce' ) . '</button>'
				. '</div>';
		}

	}
}
