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
						'<button type="button" class="button-link copy copy-item">' . __('Copy', 'product-configurator-for-woocommerce' ) . '</button>' .
						'<div class="prompt-delete hidden mkl-pc-setting--warning">' .
							'<p>' . __( 'Do you realy want to delete this item?', 'product-configurator-for-woocommerce' ) . '</p>' .
							'<p>' .
								'<button type="button" class="button button-primary delete confirm-delete" data-delete="confirm">' . __('Delete', 'product-configurator-for-woocommerce' ) . '</button>' .
								'<button type="button" class="button cancel-delete" data-delete="cancel">' . __('Cancel', 'product-configurator-for-woocommerce' ) . '</button>' .
							'</p>' .
						'</div>' .
					'</div>';
					break;
				case 'repeater':
					$field = '<div class="field-repeater" data-setting="' . esc_attr( $options['id'] ) . '" data-fields="' . esc_attr( json_encode( $options['fields'] ) ) . '"></div>';
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

							$field .= '<# console.log(data, data.'.esc_attr($options['id']).') #>';

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
				case 'file':
					$field = $this->output_setting_file( $options );
					break;
				case 'euler':
				case 'vector3':
					$field = $this->output_setting_euler( $options );
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
		 * Output an euler/vector3 field: one path (e.g. light_data.position), value { x, y, z }, three number inputs.
		 *
		 * @param array $options {
		 *     @type string $id     Dot path for the value, e.g. 'light_data.position'.
		 *     @type string $label  Label for the group.
		 *     @type array  $attributes Optional min/max/step for inputs.
		 * }
		 * @return string
		 */
		private function output_setting_euler( $options ) {
			$setting = isset( $options['id'] ) ? $options['id'] : '';
			if ( ! $setting ) {
				return '<div class="error">' . __( 'Euler/vector3 field requires setting (id).', 'product-configurator-for-woocommerce' ) . '</div>';
			}
			$data_expr = 'data.' . $setting;
			$attrs = isset( $options['attributes'] ) && is_array( $options['attributes'] ) ? $this->field_attributes( $options['attributes'] ) : '';
			$step = isset( $options['attributes']['step'] ) ? ' step="' . esc_attr( $options['attributes']['step'] ) . '"' : ' step="any"';
			$min = isset( $options['attributes']['min'] ) ? ' min="' . esc_attr( $options['attributes']['min'] ) . '"' : '';
			$max = isset( $options['attributes']['max'] ) ? ' max="' . esc_attr( $options['attributes']['max'] ) . '"' : '';
			$out = '<div class="mkl-pc-setting--euler" data-setting="' . esc_attr( $setting ) . '" data-euler="1">';
			foreach ( array( 'x', 'y', 'z' ) as $axis ) {
				$val_tpl = '<# if ( ' . $data_expr . ' && ' . $data_expr . '.' . $axis . ' != null ) { #>{{' . $data_expr . '.' . $axis . '}}<# } else { #>0<# } #>';
				$out .= '<label class="euler-axis"><span class="euler-axis-label">' . strtoupper( $axis ) . '</span>';
				$out .= '<input type="number" class="components-select-control__input euler-input" data-component="' . esc_attr( $axis ) . '" value="' . $val_tpl . '"' . $step . $min . $max . '>';
				$out .= '</label>';
			}
			$out .= '</div>';
			return $out;
		}

		/**
		 * Output a file upload field (select + remove buttons, optional preview).
		 * Value at id (dot path) is a single object { attachment_id, url }. No filename stored.
		 *
		 * @param array $options {
		 *     @type string $id                    Setting id / dot path (e.g. 'gltf', 'light_data.cookie'). Required.
		 *     @type bool   $show_preview          Show image preview when value has .url. Default true.
		 *     @type string $allowed_types         'image' or 'file'. Default 'image'.
		 *     @type string $button_select_label   Label for the select button.
		 *     @type string $button_select_label_has_file Optional label when file already set.
		 *     @type string $button_remove_label   Label for remove button.
		 *     @type string $action_select         data-action for select. Default 'pc_file_select'.
		 *     @type string $action_remove         data-action for remove. Default 'pc_file_remove'.
		 *     @type string $preview_img_style     Inline style for preview img.
		 * }
		 * @return string
		 */
		private function output_setting_file( $options ) {
			$id          = isset( $options['id'] ) ? $options['id'] : '';
			$show_preview = isset( $options['show_preview'] ) ? $options['show_preview'] : true;
			$allowed     = isset( $options['allowed_types'] ) ? $options['allowed_types'] : 'image';
			$label_select = isset( $options['button_select_label'] ) ? $options['button_select_label'] : ( $allowed === 'image' ? __( 'Select image', 'product-configurator-for-woocommerce' ) : __( 'Select file', 'product-configurator-for-woocommerce' ) );
			$label_select_has = isset( $options['button_select_label_has_file'] ) ? $options['button_select_label_has_file'] : $label_select;
			$label_remove = isset( $options['button_remove_label'] ) ? $options['button_remove_label'] : __( 'Remove', 'product-configurator-for-woocommerce' );
			$action_select = isset( $options['action_select'] ) ? $options['action_select'] : 'pc_file_select';
			$action_remove = isset( $options['action_remove'] ) ? $options['action_remove'] : 'pc_file_remove';
			$preview_style = isset( $options['preview_img_style'] ) ? $options['preview_img_style'] : 'max-width:80px;max-height:60px;display:block;';

			if ( ! $action_select || ! $action_remove ) {
				return '<div class="error">' . __( 'File field requires action_select and action_remove.', 'product-configurator-for-woocommerce' ) . '</div>';
			}

			$data_expr = $id ? ( 'data.' . $id ) : '';
			$parts = $id ? explode( '.', $id ) : array();
			$has_value_conds = array( 'data' );
			$cur = 'data';
			foreach ( $parts as $p ) {
				$cur .= '.' . $p;
				$has_value_conds[] = $cur;
			}
			$has_value_cond = implode( ' && ', $has_value_conds ) . ' && ' . $data_expr . '.attachment_id';
			$has_url_cond = $has_value_cond . ' && ' . $data_expr . '.url';

			$out = '<div class="mkl-pc-setting--container mkl-pc-setting--file"'
				. ' data-allowed-types="' . esc_attr( $allowed ) . '"'
				. ' data-setting="' . esc_attr( $id ) . '"';
			$out .= '>';
			if ( $show_preview ) {
				$out .= '<# if ( ' . $has_url_cond . ' ) { #>';
				$out .= '<div class="mkl-pc-setting--file-preview"><img src="{{' . $data_expr . '.url}}" alt="" style="' . esc_attr( $preview_style ) . '"></div>';
				$out .= '<button type="button" class="button mkl-pc--action" data-action="' . esc_attr( $action_remove ) . '">' . esc_html( $label_remove ) . '</button> ';
				$out .= '<# } #>';
			} else {
				$out .= '<# if ( ' . $has_url_cond . ' ) {  console.log("'. $data_expr .'"); #>';
				$out .= '<div class="mkl-pc-setting--file-preview-filename">' . __( 'Selected file:', 'product-configurator-for-woocommerce' ) . ' <b>{{' . $data_expr . '.url.replace( /^.*\//, "" )}}</b></div>';
				$out .= '<# } #>';
			}

			$out .= '<# if ( ' . $has_value_cond . ' ) { #>';
			$out .= '<button type="button" class="button mkl-pc--action" data-action="' . esc_attr( $action_remove ) . '">' . esc_html( $label_remove ) . '</button> ';
			$out .= '<# } #>';

			$out .= '<button type="button" class="button mkl-pc--action" data-action="' . esc_attr( $action_select ) . '">';
			$out .= '<# if ( ' . $has_value_cond . ' ) { #>' . esc_html( $label_select_has ) . '<# } else { #>' . esc_html( $label_select ) . '<# } #>';
			$out .= '</button>';
			$out .= '</div>';
			return $out;
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

		/**
		 * Shared 3D model source fields (Use object from / Model upload / Object ID) for layers, choices, and angles.
		 *
		 * @param array $config {
		 *     @type bool   $can_upload        Whether to show Upload option and model upload field.
		 *     @type string $setting_model     Setting key for model source (e.g. object_selection_3d, camera_target_model).
		 *     @type string $setting_upload    Setting key for upload attachment (e.g. model_upload_3d). Omit or null if no upload.
		 *     @type string $setting_object_id Setting key for object ID (e.g. object_id_3d, camera_target_object_id).
		 *     @type string $model_label       Label for the model source select.
		 *     @type string $upload_label      Label for the upload field.
		 *     @type string $object_id_label   Label for the object ID field.
		 *     @type string $condition         Optional condition expression for the fields.
		 *     @type string $section           Section id (e.g. threed).
		 *     @type int    $priority          Priority for first field (default 10).
		 * }
		 * @return array Field key => field config for merging into get_settings_list().
		 */
		public static function get_3d_model_source_fields( $config ) {
			$can_upload       = ! empty( $config['can_upload'] );
			$setting_model    = isset( $config['setting_model'] ) ? $config['setting_model'] : 'object_selection_3d';
			$setting_upload   = isset( $config['setting_upload'] ) ? $config['setting_upload'] : null;
			$setting_object   = isset( $config['setting_object_id'] ) ? $config['setting_object_id'] : 'object_id_3d';
			$model_label      = isset( $config['model_label'] ) ? $config['model_label'] : __( 'Use object from', 'product-configurator-for-woocommerce' );
			$upload_label     = isset( $config['upload_label'] ) ? $config['upload_label'] : __( 'Model upload', 'product-configurator-for-woocommerce' );
			$object_id_label  = isset( $config['object_id_label'] ) ? $config['object_id_label'] : __( 'Object ID', 'product-configurator-for-woocommerce' );
			$condition        = isset( $config['condition'] ) ? $config['condition'] : null;
			$section          = isset( $config['section'] ) ? $config['section'] : 'threed';
			$priority         = isset( $config['priority'] ) ? (int) $config['priority'] : 10;

			$choices = [];
			if ( $can_upload ) {
				$choices[] = [
					'label' => __( 'Upload model', 'product-configurator-for-woocommerce' ),
					'value' => 'upload_model',
				];
			}

			$base = [
				'priority' => $priority,
				'section'  => $section,
			];
			if ( $condition ) {
				$base['condition'] = $condition;
			}

			$fields = [];
			$fields[ $setting_model ] = array_merge( $base, [
				'label'   => $model_label,
				'type'    => 'select',
				'choices' => $choices,
			] );

			if ( $can_upload && $setting_upload ) {
				$upload_condition = '"upload_model" == data.' . $setting_model;
				if ( $condition ) {
					$upload_condition = $condition . ' && ' . $upload_condition;
				}
				$fields[ $setting_upload ] = array_merge( $base, [
					'label'     => $upload_label,
					'type'      => 'html',
					'priority'  => $priority + 5,
					'condition' => $upload_condition,
					'html'      => '<div class="mkl-pc-setting--container">'
						. '<input type="hidden" data-setting="' . esc_attr( $setting_upload ) . '" value="<# if ( data.' . esc_attr( $setting_upload ) . ' ) { #>{{data.' . esc_attr( $setting_upload ) . '}}<# } #>"> '
						. '<button type="button" class="button mkl-pc--action" data-action="edit_model_upload" data-setting="' . esc_attr( $setting_upload ) . '">' . esc_html__( 'Select model', 'product-configurator-for-woocommerce' ) . '</button>'
						. '<# if ( data.' . esc_attr( $setting_upload ) . ' ) { #><button type="button" class="button mkl-pc--action" data-action="remove_model_upload" data-setting="' . esc_attr( $setting_upload ) . '">' . esc_html__( 'Remove', 'product-configurator-for-woocommerce' ) . '</button><# } #>'
						. '<# if ( data.' . esc_attr( $setting_upload ) . '_filename ) { #><span class="pc-3d-model-upload-filename">{{data.' . esc_attr( $setting_upload ) . '_filename}}</span><# } #>'
						. '</div>',
				] );
			}

			$object_html = '<div class="mkl-pc-setting--container">'
				. '<input type="text" class="components-select-control__input" data-setting="' . esc_attr( $setting_object ) . '" value="<# if ( data.' . esc_attr( $setting_object ) . ' ) { #>{{data.' . esc_attr( $setting_object ) . '}}<# } #>" placeholder="' . esc_attr__( 'Object ID or name', 'product-configurator-for-woocommerce' ) . '"> '
				. __( 'Or', 'product-configurator-for-woocommerce' )
				. ' <button type="button" class="button mkl-pc--action" data-action="select_3d_object" data-setting="' . esc_attr( $setting_object ) . '">' . esc_html__( 'Select from list', 'product-configurator-for-woocommerce' ) . '</button>'
				. '</div>';

			$fields[ $setting_object ] = array_merge( $base, [
				'label'     => $object_id_label,
				'type'      => 'html',
				'priority'  => $priority + 10,
				'html'      => $object_html,
			] );

			return $fields;
		}
	}
}