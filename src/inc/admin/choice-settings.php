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

class Choice_Settings {

	public function __construct() {
		add_action('mkl_pc_choice_fields', array($this, 'output_settings'), 10);
	}

	/** Output the settings */
	public function output_settings() {

		$settings = $this->get_default_settings();

		uasort($settings, array($this, 'sort_settings'));

		foreach($settings as $id => $options) {
			$options['id'] = $id;
			$this->output_setting($options);
		}
	}

	public function sort_settings ($a, $b) {
		if (!isset($a['priority']) || !isset($b['priority'])) return 0;
		return ($a['priority'] > $b['priority']) ? 1 : -1;
	}
	/**
	 * Output the options
	 *
	 * @param array   $options The options 
	 * @param boolean $echo    If the setting should be echoed or returned
	 * @return void
	 */
	public function output_setting($options, $echo = true) {
		
		if (!is_array($options)) throw new \Exception('Setting options must be an array?');

		$options = wp_parse_args($options, array(
			'type' => 'text',
			'attributes' => array(),
		));

		if (empty($options['id']) || empty($options['label'])) throw new \Exception('Setting options must have and `id` and `label` fields');

		$output = '
			<label class="setting">
				<span class="'.esc_attr($options['id']).'">'.esc_html($options['label']).'</span>
				';
		switch ($options['type']) {
			case 'textarea':
				$output .= '<textarea type="'.esc_attr($options['type']).'" data-setting="'.esc_attr($options['id']).'"><# if( data.'.esc_attr($options['id']).') { #>{{data.'.esc_attr($options['id']).'}}<# } #></textarea>';
				break;
			case 'text':
			case 'number':
			default:
				$output .= '<input '.$this->field_attributes($options['attributes']).' type="'.esc_attr($options['type']).'" data-setting="'.esc_attr($options['id']).'" value="<# if( data.'.esc_attr($options['id']).' ) { #>{{data.'.esc_attr($options['id']).'}}<# } #>">';
				break;
		}
		$output .= '
			</label>
		';

		if ($echo) {
			echo $output;
		} else {
			return $output;
		}

	}

	/**
	 * Gets the default settings
	 *
	 * @return array
	 */
	public function get_default_settings() {
		return apply_filters('mkl_pc_choice_default_settings', array(
			'name' => array(
				'label' => __('Choice label', MKL_PC_DOMAIN ),
				'type' => 'text',
				'priority' => 10,
			),
			'description' => array(
				'label' => __('Description', MKL_PC_DOMAIN ),
				'type' => 'textarea',
				'priority' => 20,
			),
			'extra_price' => array(
				'label' => __('Extra price', MKL_PC_DOMAIN ),
				'type' => 'number',
				'attributes' => array(
					'disabled' => 'disabled',
					'placeholder' => __('Extra Price is available as an addon', MKL_PC_DOMAIN),
				),
				'priority' => 30,
			),

		));
	}

	/**
	 * Print the attributes
	 *
	 * @param array $attr
	 * @return string
	 */
	private function field_attributes($attr) {
		if (!is_array($attr)) return '';
		$render = '';
		foreach($attr as $key => $val) {
			if (is_array($val)) $val = implode(' ', $val);
			$render .= esc_attr($key).'="'.esc_attr($val).'" ';
		}
		return $render;
	}
}
