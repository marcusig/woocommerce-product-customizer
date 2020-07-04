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
if ( ! class_exists('MKL\PC\Abstract_Settings') ) {
	abstract class Abstract_Settings {

		public function __construct() {
			add_action('mkl_pc_'.$this->type.'_fields', array($this, 'output_settings'), 10);
		}

		/**
		 * Output the settings
		 *
		 * @return void
		 */
		public function output_settings() {

			$settings = $this->get_default_settings();

			uasort($settings, array($this, 'sort_settings'));

			foreach($settings as $id => $options) {
				$options['id'] = $id;
				$this->output_setting($options);
			}
		}

		/**
		 * Sorting function
		 *
		 * @param array $a
		 * @param array $b
		 * @return int
		 */
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
				'help' => '',
				'choices' => null,
				'condition' => ''
			));

			if (empty($options['id']) || empty($options['label'])) throw new \Exception('Setting options must have and `id` and `label` fields');

			$output = '
				<label class="setting">
					<span class="name '.esc_attr($options['id']).'">'.esc_html($options['label']).'</span>
					';
			switch ($options['type']) {
				case 'textarea':
					$output .= '<textarea type="'.esc_attr($options['type']).'" data-setting="'.esc_attr($options['id']).'"><# if( data.'.esc_attr($options['id']).') { #>{{data.'.esc_attr($options['id']).'}}<# } #></textarea>';
					break;
				case 'checkbox':
					$output .= '<input '.$this->field_attributes($options['attributes']).' type="'.esc_attr($options['type']).'" data-setting="'.esc_attr($options['id']).'" <# if(data.'.esc_attr($options['id']).' == true || data.'.esc_attr($options['id']).' == "true") { #> checked="checked" <# } #>>';
					break;
				case 'select':
					if ( is_array($options['choices'] ) ) {
						$output .= '<select '.$this->field_attributes($options['attributes']).' data-setting="'.esc_attr($options['id']).'">';
						foreach( $options['choices'] as $choice ) {
							// Prepare any choice specific attributes
							$attributes = isset($choice['attributes']) && is_array($choice['attributes']) ? ' ' . $this->field_attributes($choice['attributes']) : '';
							// Outputs the select
							$output .= '<option'.$attributes.' value="'.$choice['value'].'" <# if("'.$choice['value'].'" == data.'.esc_attr($options['id']).') { #> selected <# } #>>';
							$output .= $choice['label'];
							$output .= '</option>';
						}
						$output .= '</select>';
					}
					break;
	
				case 'text':
				case 'number':
				default:
					$output .= '<input '.$this->field_attributes($options['attributes']).' type="'.esc_attr($options['type']).'" data-setting="'.esc_attr($options['id']).'" value="<# if( data.'.esc_attr($options['id']).' ) { #>{{data.'.esc_attr($options['id']).'}}<# } #>">';
					break;
			}

			if ( $options['help'] ) {
				$output .= '<p class="help">' . $options['help'] . '</p>';
			}

			$output .= '
				</label>
			';

			if ( $options['condition'] ) {
				$output = '<# if(' . $options['condition'] .') { #>' . $output . '<# } #>';
			}
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
		public abstract function get_default_settings();

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
}