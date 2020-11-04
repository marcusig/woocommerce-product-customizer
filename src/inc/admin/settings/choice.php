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
			return apply_filters('mkl_pc_choice_default_settings', array(
				'name' => array(
					'label' => __('Choice label', 'product-configurator-for-woocommerce' ),
					'type' => 'text',
					'priority' => 10,
				),
				'description' => array(
					'label' => __('Description', 'product-configurator-for-woocommerce' ),
					'type' => 'textarea',
					'priority' => 20,
				),
				'extra_price' => array(
					'label' => __('Extra price', 'product-configurator-for-woocommerce' ),
					'type' => 'number',
					'attributes' => array(
						'disabled' => 'disabled',
						'placeholder' => __('Extra Price is available as an addon', 'product-configurator-for-woocommerce'),
					),
					'priority' => 30,
				),
				'class_name' => array(
					'label' => __('CSS Class', 'product-configurator-for-woocommerce' ),
					'type' => 'text',
					'priority' => 150,
				),
			));
		}
	}
}