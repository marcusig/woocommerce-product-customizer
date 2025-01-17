<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly.
}

/**
 * Elementor Form Field - Configuration
 *
 * Add a new "Credit Card Number" field to Elementor form widget.
 *
 * @since 1.0.0
 */
class Elementor_Configuration_Field_Price extends \ElementorPro\Modules\Forms\Fields\Field_Base {

	public $depended_scripts = [ 'mkl_pc/elementor-configuration-field' ];

	/**
	 * Get field type.
	 *
	 * Retrieve credit card number field unique ID.
	 *
	 * @since 1.0.0
	 * @access public
	 * @return string Field type.
	 */
	public function get_type() {
		return 'configuration_price';
	}

	/**
	 * Get field name.
	 *
	 * Retrieve credit card number field label.
	 *
	 * @since 1.0.0
	 * @access public
	 * @return string Field name.
	 */
	public function get_name() {
		return esc_html__( 'Configuration price', 'product-configurator-for-woocommerce' );
	}

	/**
	 * Render field output on the frontend.
	 *
	 * Written in PHP and used to generate the final HTML.
	 *
	 * @since 1.0.0
	 * @access public
	 * @param mixed $item
	 * @param mixed $item_index
	 * @param mixed $form
	 * @return void
	 */
	public function render( $item, $item_index, $form ) {
		$form_id = $form->get_id();

		$form->add_render_attribute(
			'input' . $item_index,
			[
				'class' => 'elementor-field-textual configurator-price',
				'for' => $form_id . $item_index,
				// 'type' => 'hidden',
			]
		);
		echo '<input type="hidden" ' . $form->get_render_attribute_string( 'input' . $item_index ) . '>';
		echo '<div class="elementor-configuration-field-price"></div>';
	}

	/**
	 * Field validation.
	 *
	 * Validate credit card number field value to ensure it complies to certain rules.
	 *
	 * @since 1.0.0
	 * @access public
	 * @param \ElementorPro\Modules\Forms\Classes\Field_Base   $field
	 * @param \ElementorPro\Modules\Forms\Classes\Form_Record  $record
	 * @param \ElementorPro\Modules\Forms\Classes\Ajax_Handler $ajax_handler
	 * @return void
	 */
	public function validation( $field, $record, $ajax_handler ) {
		if ( empty( $field['value'] ) ) {
			return;
		}

		// if ( preg_match( '/^[0-9]{4}\s[0-9]{4}\s[0-9]{4}\s[0-9]{4}$/', $field['value'] ) !== 1 ) {
		// 	$ajax_handler->add_error(
		// 		$field['id'],
		// 		esc_html__( 'Credit card number must be in "XXXX XXXX XXXX XXXX" format.', 'product-configurator-for-woocommerce' )
		// 	);
		// }
	}

	/**
	 * Update form widget controls.
	 *
	 * Add input fields to allow the user to customize the credit card number field.
	 *
	 * @since 1.0.0
	 * @access public
	 * @param \Elementor\Widget_Base $widget The form widget instance.
	 * @return void
	 */
	public function update_controls( $widget ) {
		return;
		$elementor = \ElementorPro\Plugin::elementor();

		$control_data = $elementor->controls_manager->get_control_from_stack( $widget->get_unique_name(), 'form_fields' );

		if ( is_wp_error( $control_data ) ) {
			return;
		}

		$field_controls = [
			'show-config-in-form' => [
				'name' => 'show-config-in-form',
				'label' => esc_html__( 'Show config in form', 'product-configurator-for-woocommerce' ),
				'type' => \Elementor\Controls_Manager::SWITCHER,
				'default' => 'yes',
				'dynamic' => [
					'active' => true,
				],
				'condition' => [
					'field_type' => $this->get_type(),
				],
				'tab'          => 'content',
				'inner_tab'    => 'form_fields_content_tab',
				'tabs_wrapper' => 'form_fields_tabs',
			],
		];

		$control_data['fields'] = $this->inject_field_controls( $control_data['fields'], $field_controls );

		$widget->update_control( 'form_fields', $control_data );
	}

	/**
	 * Field constructor.
	 *
	 * Used to add a script to the Elementor editor preview.
	 *
	 * @since 1.0.0
	 * @access public
	 * @return void
	 */
	public function __construct() {
		parent::__construct();
		add_action( 'elementor/preview/init', [ $this, 'editor_preview_footer' ] );
	}

	/**
	 * Elementor editor preview.
	 *
	 * Add a script to the footer of the editor preview screen.
	 *
	 * @since 1.0.0
	 * @access public
	 * @return void
	 */
	public function editor_preview_footer() {
		add_action( 'wp_footer', [ $this, 'content_template_script' ] );
	}

	public function sanitize_field( $value, $field ) {
		return wp_kses( $value, 'data' );
	}

	/**
	 * Content template script.
	 *
	 * Add content template alternative, to display the field in Elemntor editor.
	 *
	 * @since 1.0.0
	 * @access public
	 * @return void
	 */
	public function content_template_script() {
		?>
		<script>
		jQuery( document ).ready( () => {

			elementor.hooks.addFilter(
				'elementor_pro/forms/content_template/field/<?php echo $this->get_type(); ?>',
				function ( inputField, item, i ) {
					const fieldType    = 'hidden';
					const fieldId      = `form_field_${i}`;
					const fieldClass   = `elementor-field-textual configurator-price elementor-field ${item.css_classes}`;
					
					let ret = `<input type="hidden" id="${fieldId}" class="${fieldClass}">`;
						ret += `<div class="configurator-price">[configuration price]</div>`;
					return ret;
				}, 10, 3
			);
		});
		</script>
		<?php
	}

}