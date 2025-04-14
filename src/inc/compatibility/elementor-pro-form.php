<?php

namespace MKL\PC;

if ( ! defined( 'ABSPATH' ) ) return;

class Compat_ElementorPro_Form {
	public function __construct() {}

	public function should_run() {
		return class_exists( 'ElementorPro\Modules\Forms\Fields\Field_Base');
	}

	public function run() {
		add_action( 'mkl_pc_scripts_product_page_after', [ $this, 'enqueue_scripts' ] );
		add_action( 'elementor_pro/forms/fields/register', [ $this, 'add_fields' ] );
		add_action( 'wp_footer', [ $this, 'output_form' ] );
	}

	public function add_fields( $form_fields_registrar ) {

		require_once 'elementor-fields/elementor-configurator-field.php';
		require_once 'elementor-fields/elementor-configurator-field-image.php';
		require_once 'elementor-fields/elementor-configurator-field-price.php';
	
		$form_fields_registrar->register( new \Elementor_Configuration_Field() );
		$form_fields_registrar->register( new \Elementor_Configuration_Field_Image() );
		$form_fields_registrar->register( new \Elementor_Configuration_Field_Price() );
	}

	public function output_form() {
		if ( $modal_id = get_post_meta( get_the_ID(), 'elementor_configuration_modal_id', true ) ) {
			$button_label = get_post_meta( get_the_ID(), 'elementor_configuration_modal_button_label', true );
			echo '<div class="js-mkl-pc-elementor-configuration-modal--container" data-button-label="' . esc_attr( $button_label ? $button_label : __( 'Request a quote', 'product-configurator-for-woocommerce' ) ) . '" data-modal-id="' . esc_attr( intval( $modal_id ) ) . '">' . do_shortcode( '[elementor-template id="' . intval( $modal_id ) . '"]' ) . '</div>';
		}
	}

	public function enqueue_scripts() {
		wp_register_script( 
			'mkl_pc/elementor-configuration-field', 
			trailingslashit( plugin_dir_url( __FILE__ ) ) . 'assets/js/elementor-pro-configurator-field.js', 
			[ 'jquery' ], 
			filemtime( trailingslashit( plugin_dir_path ( __FILE__ ) ) . 'assets/js/elementor-pro-configurator-field.js' )
		);

		wp_register_style( 
			'mkl_pc/elementor-configuration-field-summary',
			trailingslashit( plugin_dir_url( __FILE__ ) ) . 'assets/css/elementor-pro-configurator-field-summary.css', 
			[], 
			filemtime( trailingslashit( plugin_dir_path ( __FILE__ ) ) . 'assets/css/elementor-pro-configurator-field-summary.css' )
		);
	}
}

return new Compat_ElementorPro_Form();
