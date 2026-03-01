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
					),
				),
				'attachment_id' => array(
					'label'     => \__( '3D file', 'product-configurator-for-woocommerce' ),
					'type'      => 'html',
					'priority'  => 25,
					'section'   => 'object3d',
					'condition' => '"gltf" == data.object_type',
					'html'      => '<div class="mkl-pc-setting--container">'
						. '<# if ( data.filename ) { #><span class="pc-3d-model-name--label">' . \__( 'Selected file:', 'product-configurator-for-woocommerce' ) . '</span> <span class="pc-3d-model-name">{{data.name}}</span><# } #>'
						. '<input type="hidden" data-setting="attachment_id" value="<# if ( data.attachment_id ) { #>{{data.attachment_id}}<# } #>"> '
						. '<# if ( data.attachment_id ) { #><button type="button" class="button mkl-pc--action" data-action="remove_object3d_upload" data-setting="attachment_id">' . \esc_html__( 'Remove', 'product-configurator-for-woocommerce' ) . '</button><# } #>'
						. '<button type="button" class="button mkl-pc--action" data-action="edit_object3d_upload" data-setting="attachment_id">' 
							. '<# if ( data.attachment_id ) { #>'
								. \esc_html__( 'Select new model', 'product-configurator-for-woocommerce' )
							. '<# } else { #>'
								. \esc_html__( 'Select model', 'product-configurator-for-woocommerce' ) 
							. '<# } #>'
						. '</button>'
						. '</div>',
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
					'id'       => 'object3d',
					'label'    => \__( '3D Object', 'product-configurator-for-woocommerce' ),
					'priority' => 5,
					'fields'   => array(),
				),
			);
		}
	}
}
