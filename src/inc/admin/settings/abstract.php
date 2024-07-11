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
			add_action( 'mkl_pc_'.$this->type.'_fields', array( $this, 'output_settings' ), 10 );
		}

		/**
		 * Output the settings
		 *
		 * @return void
		 */
		public function output_settings() {

			$settings = $this->get_default_settings();

			uasort( $settings, array( $this, 'sort_settings' ) );

			foreach( $settings as $id => $options ) {
				// Setting sections
				if ( '_' == substr( $id, 0, 1 ) && isset( $options[ 'fields' ] ) ) {
					$is_opened = ( ! isset( $options[ 'collapsible' ] ) || ! $options[ 'collapsible' ] ) 
						? 'is-opened' 
						: '<# if ( data.toggled_status && data.toggled_status["' . $options[ 'id' ] .'"] && "closed" == data.toggled_status["' . $options[ 'id' ] .'"] ) { #>is-closed<# } else { #>is-opened<# } #>';

					echo '<div class="components-panel__body ' . $is_opened . ' setting setting-section" data-section="'.$options[ 'id' ].'">';
					if ( ! isset( $options[ 'collapsible' ] ) || ! $options[ 'collapsible' ] ) {
						echo '<h2 class="components-panel__body-title"><span class="components-button components-panel__body-toggle">' . $options[ 'label' ] . '</span></h2>';
					} else {
						echo '<h2 class="components-panel__body-title"><button class="components-button components-panel__body-toggle" type="button">'
							. '<span aria-hidden="true"><svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" width="24" height="24" class="components-panel__arrow" aria-hidden="true" focusable="false"><path d="M17.5 11.6L12 16l-5.5-4.4.9-1.2L12 14l4.5-3.6 1 1.2z"></path></svg></span>' 
							. $options[ 'label' ] 
							. '</button>'
							. '</h2>';
					}
					echo '<div class="section-fields">';
					uasort( $options[ 'fields' ], array( $this, 'sort_settings' ) );
					foreach( $options['fields'] as $_id => $item ) {
						$item['id'] = $_id; 
						$this->output_setting( $item );
					}
					echo '</div>';
					echo '</div>';
				} else {
					$options['id'] = $id;
					$this->output_setting($options);
				}
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
			
			if (!is_array($options)) throw new \Exception('Setting options must be an array.');

			$options = wp_parse_args($options, array(
				'type' => 'text',
				'attributes' => array(),
				'help' => '',
				'choices' => null,
				'condition' => '',
				'classes' => '',
			));

			if ( ( empty($options['id'] ) || empty( $options['label'] ) ) && 'separator' != $options['type'] ) {
				$output = '<div class="error">Setting options must have and `id` and `label` fields</div>';
				$output .= '<pre>' . print_r( $options, true ) . '</pre>';

				if ($echo) {
					echo $output;
				} else {
					return $output;
				}
			}

			$classes = isset( $options['classes'] ) ? $options['classes'] . ' ' : '';

			switch ($options['type']) {
				case 'html':
				case 'custom':
					$field = $options['html'];
					break;
				case 'actions':
					$field = '<div class="actions-container">
						<button type="button" class="button-link delete delete-item" data-delete="prompt">' . __('Delete', 'product-configurator-for-woocommerce' ) . '</button>' .
						'<button type="button" class="button-link duplicate duplicate-item">' . __('Duplicate', 'product-configurator-for-woocommerce' ) . '</button>' .
						'<div class="prompt-delete hidden mkl-pc-setting--warning">' .
							'<p>' . __( 'Do you realy want to delete this item?', 'product-configurator-for-woocommerce' ) . '</p>' .
							'<p>' .
								'<button type="button" class="button button-primary delete confirm-delete" data-delete="confirm">' . __('Delete', 'product-configurator-for-woocommerce' ) . '</button>' .
								'<button type="button" class="button cancel-delete" data-delete="cancel">' . __('Cancel', 'product-configurator-for-woocommerce' ) . '</button>' .
							'</p>' .
						'</div>' .
					'</div>';
					break;
				case 'textarea':
					$field = '<textarea class="' . ( isset($options[ 'input_classes' ]) ? esc_attr( $options[ 'input_classes' ] ) : '' ) . '" type="'.esc_attr($options['type']).'" data-setting="'.esc_attr($options['id']).'"><# if( data.'.esc_attr($options['id']).') { #>{{data.'.esc_attr($options['id']).'}}<# } #></textarea>';
					break;
				case 'checkbox':
					$classes .= 'components-checkbox-control ';
					$field = '<span class="components-checkbox-control__input-container">
						<input class="components-checkbox-control__input ' . ( isset($options[ 'input_classes' ]) ? esc_attr( $options[ 'input_classes' ] ) : '' ) . '" '.$this->field_attributes($options['attributes']).' type="'.esc_attr($options['type']).'" data-setting="'.esc_attr($options['id']).'" <# if(data.'.esc_attr($options['id']).' == true || data.'.esc_attr($options['id']).' == "true") { #> checked="checked" <# } #>>
						<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" role="presentation" class="components-checkbox-control__checked" aria-hidden="true" focusable="false"><path d="M16.7 7.1l-6.3 8.5-3.3-2.5-.9 1.2 4.5 3.4L17.9 8z"></path></svg>
						</span>';
					break;
				case 'select':
					if ( is_array($options['choices'] ) ) {
						$field = '<select class="components-select-control__input ' . ( isset($options[ 'input_classes' ]) ? esc_attr( $options[ 'input_classes' ] ) : '' ) . '" '.$this->field_attributes($options['attributes']).' data-setting="'.esc_attr($options['id']).'">';
						foreach( $options['choices'] as $choice ) {
							// Prepare any choice specific attributes
							$attributes = isset($choice['attributes']) && is_array($choice['attributes']) ? ' ' . $this->field_attributes($choice['attributes']) : '';
							// Outputs the select

							if ( isset( $choice[ 'condition' ] ) && $choice[ 'condition' ] ) {
								$field .= '<# if ( ' . $choice[ 'condition' ] . ' ) { #>';
							}
							
							$field .= '<option'.$attributes.' value="'.$choice['value'].'" <# if("'.$choice['value'].'" == data.'.esc_attr($options['id']).') { #> selected <# } #>>';
							$field .= $choice['label'];
							$field .= '</option>';

							if ( isset( $choice[ 'condition' ] ) && $choice[ 'condition' ] ) {
								$field .= '<# } #>';
							}
						}
						$field .= '</select>';
					}
					break;
				case 'image_select':
					if ( is_array($options['choices'] ) ) {
						$field = '<div class="mkl-pc-image-select">';
						foreach( $options['choices'] as $choice ) {
							// Prepare any choice specific attributes
							$attributes = isset($choice['attributes']) && is_array($choice['attributes']) ? ' ' . $this->field_attributes($choice['attributes']) : '';
							
							// Outputs the radios
							if ( isset( $choice[ 'condition' ] ) && $choice[ 'condition' ] ) {
								$field .= '<# if ( ' . $choice[ 'condition' ] . ' ) { #>';
							}
							$field_id = sanitize_title( $options['id'] . '-' . $choice['value'] );
							$field .= '<div class="mkl-pc-image-select--item">';
							$field .= '<input'
								.$attributes
								.' type="radio" 
								id="'.$field_id.'"
								value="'.$choice['value'].'" 
								class="components-select-control__input ' . ( isset($options[ 'input_classes' ]) ? esc_attr( $options[ 'input_classes' ] ) : '' ) . '" 
								data-setting="'.esc_attr($options['id']).'"
								<# if("'.$choice['value'].'" == data.'.esc_attr($options['id']).') { #> checked <# } #>
								name="img-select-'.esc_attr($options['id']).'"
								>';

							$field .= '<label for="' . $field_id . '">';
							if ( isset( $choice['image'] ) ) {
								// possible SVG usage
								if ( strpos( $choice['image'], 'viewBox' ) ) {
									$field .= $choice['image'];
								} elseif ( esc_url_raw( $choice['image'] ) ) {
									$field .= '<img src="'. esc_url_raw( $choice['image'] ) . '" alt="">';
								}
							}
							$field .= $choice['label'];
							$field .= '</label>';
							$field .= '</div>';

							if ( isset( $choice[ 'condition' ] ) && $choice[ 'condition' ] ) {
								$field .= '<# } #>';
							}
						}
						$field .= '</div>';

					}
					break;
	
				case 'text':
				case 'number':
				default:
					$field = '<input class="components-select-control__input ' . ( isset($options[ 'input_classes' ]) ? esc_attr( $options[ 'input_classes' ] ) : '' ) . '" '.$this->field_attributes($options['attributes']).' type="'.esc_attr($options['type']).'" data-setting="'.esc_attr($options['id']).'" value="<# if ( "undefined" != typeof data.'.esc_attr($options['id']).' ) { #>{{data.'.esc_attr($options['id']).'}}<# } #>">';
					break;
			}

			$output = '<div class="setting ' . esc_attr( $classes ) . esc_attr( $options['type'] ) . ' setting-id-' . esc_attr( $options['id'] ) . '">
			';

			if ( 'checkbox' == $options['type'] ) {
				$output .= '<label class="components-checkbox-control__label name '.esc_attr($options['id']).'"><span>' . $field . '</span>' . wp_kses_post($options['label']).'</label>';
			} elseif ( 'separator' !== $options['type'] ) {
				if ( ! isset( $options['hide_label'] ) || ! $options['hide_label'] ) {
					$output .= '<label class="name '.esc_attr($options['id']).'">'.wp_kses_post($options['label']).'</label>';
				}
				$output .= $field;
			}

			if ( $options['help'] ) {
				$output .= '<p class="help">' . $options['help'] . '</p>';
			}

			
			$output .= '
				</div>
			';

			$condition = 'true';
			if ( $options['condition'] ) $condition = $options['condition'];
			$output = '<# if ( wp.hooks.applyFilters( "PC.admin.' . $this->type . '.display_option",' . $condition .', data, "' . $options['id'] . '" ) ) { #>' . $output . '<# } #>';
			if ($echo) {
				echo $output;
			} else {
				return $output;
			}

		}

		/**
		 * Gets the default sections
		 *
		 * @return array
		 */
		public abstract function get_sections();

		/**
		 * Gets the settings
		 *
		 * @return array
		 */
		public abstract function get_settings_list();

		/**
		 * Gets the default settings
		 *
		 * @return array
		 */
		public function get_default_settings() {
			$sections = $this->get_sections();
			$settings = $this->get_settings_list();
			foreach( $settings as $id => $option ) {
				if ( '_' == substr( $id, 0, 1 ) ) {

					// Merge both sections
					if ( isset( $sections[$id], $sections[$id]['fields'], $option['fields'] ) ) {
						$sections[$id]['fields'] = array_merge( $sections[$id]['fields'], $option['fields'] );
						continue;
					}

					// Add the section, if it doesn't exist yet
					if ( ! isset( $sections[$id] ) && isset( $option['fields'] ) ) {
						$sections[$id] = $option;
						continue;
					}
				} 
				
				if ( isset( $option['section'], $sections['_'.$option['section']] ) ) {
					// Add settigns to their sections
					$sections['_'.$option['section']]['fields'][$id] = $option;
				} else {
					// Default to the general section
					$sections['_general']['fields'][$id] = $option;
				}
			}
			return $sections;
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
}