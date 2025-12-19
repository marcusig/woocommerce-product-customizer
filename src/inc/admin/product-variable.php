<?php
namespace MKL\PC;

if (!defined('ABSPATH')) die('No direct access.');
class Admin_Variable_Product {

	public function __construct() {
		add_action( 'woocommerce_product_after_variable_attributes', array($this, 'product_variation_data_fields' ), 9, 3 );
		add_action( 'woocommerce_save_product_variation', array( $this, 'set_configurable' ) , 10, 2 );
		add_action( 'woocommerce_variation_options', array($this, 'variation_options' ), 10, 3 );
		add_action( 'mkl_pc_admin_general_tab_before_start_button', array( $this, 'general_tab_help_text' ) );
		add_action( 'mkl_pc_admin_general_tab', array( $this, 'general_tab_mode_select' ) );
		add_action( 'woocommerce_process_product_meta_variable', array( $this, 'save_mode' ) );

		add_filter( 'mkl_wc_general_metaboxe_classes', array( $this, 'wc_general_metaboxe_classes' ),10, 2 );
	}

	public function wc_general_metaboxe_classes( $classes ) {
		$classes[] = 'show_if_variable';
		return $classes;
	}

	/**
	 * Save the mode
	 *
	 * @param boolean $product_id
	 * @return void
	 */
	public function save_mode( $product_id ) {
		if ( isset( $_POST[MKL_PC_PREFIX.'_variable_configuration_mode'] ) ) {
			update_post_meta( $product_id, MKL_PC_PREFIX.'_variable_configuration_mode', sanitize_key( $_POST[MKL_PC_PREFIX.'_variable_configuration_mode'] ) );
		}
		update_post_meta( $product_id, MKL_PC_PREFIX.'_all_variations_are_configurable', isset( $_POST[MKL_PC_PREFIX.'_all_variations_are_configurable'] ) ? 'yes' : 'no' );
	}

	public function general_tab_mode_select() {
		?>
		<div class="show_if_variable">
			<?php
			woocommerce_wp_select( 
				array( 
					'id' => MKL_PC_PREFIX.'_variable_configuration_mode',
					'options' => [
						'share_layers_config' => __('Variations share the same layers, choices are set per variation', 'product-configurator-for-woocommerce'),
						'share_all_config' => __('Variations share the same configuration', 'product-configurator-for-woocommerce'),
					],
					'label' => __( 'Configuration mode', 'product-configurator-for-woocommerce' ),
					'description' => __( 'Warning: changing mode on a product already in use could have undesired effects.', 'product-configurator-for-woocommerce' ),
					'desc_tip' => true
				) 
			);
			
			woocommerce_wp_checkbox( 
				array( 
					'id' => MKL_PC_PREFIX.'_all_variations_are_configurable',
					'class' => 'all_variations_configurable',
					'label' => __( 'All variations are configurable', 'product-configurator-for-woocommerce' ), 
					'description' => __( 'Select if you want all variations to be configurable – prevents having to enable the setting on each variation', 'product-configurator-for-woocommerce' ),
					// 'desc_tip' => true
				) 
			);
			?>
		</div>
		<?php
	}

	public function general_tab_help_text() {
		?>
		<p class="show_if_variable">
			<?php _e( 'Each variation also has to be set individualy as Configurable. ', 'mkl-pc-variable-product' ); ?>
		</p>
		<?php
	}

	public function set_configurable( $variation_id, $loop ) {
		$variable_is_configurable = isset( $_POST[MKL_PC_PREFIX.'_is_configurable'] ) ? $_POST[MKL_PC_PREFIX.'_is_configurable'] : array();
		$_is_configurable = isset( $variable_is_configurable[$loop] ) ? 'yes' : 'no';
		update_post_meta( $variation_id, MKL_PC_PREFIX.'_is_configurable', $_is_configurable );
	}

	public function variation_options($loop, $variation_data, $variation) {
		$configurable = get_post_meta( $variation->ID, MKL_PC_PREFIX.'_is_configurable', true);
		?>
		<label><input type="checkbox" class="checkbox variable_is_configurable" name="<?php echo MKL_PC_PREFIX.'_is_configurable[' .$loop ?>]" <?php checked( isset( $configurable ) ? $configurable : '', 'yes' ); ?> /> <?php _e( 'Configurable', 'mkl-pc-variable-product' ); ?> <?php echo wc_help_tip( __( 'Enable this option if variation is configurable', 'mkl-pc-variable-product' ) ); ?></label>
		<?php
	}
	public function product_variation_data_fields($loop, $variation_data, $variation) {
		
		?>
		<div class="toolbar show_if_variation_is_configurable">
		<?php echo Plugin::instance()->admin->product->start_button( $variation->ID, $variation->post_parent ) ?>
		</div>
		<?php
	}

}
