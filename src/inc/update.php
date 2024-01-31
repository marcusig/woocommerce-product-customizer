<?php 
namespace MKL\PC;

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly
}
class Update {
	private function __construct() {
		add_action( 'init', [ $this, 'check_update' ] );
	}

	public function check_update() {

		$updates_list = [
			'1.1.0' => [ [ mkl_pc( 'cache' ), 'purge' ] ],
			'1.1.2' => [ [ $this, 'update_wrong_layer_ids' ], [ mkl_pc( 'cache' ), 'purge' ] ],
			'1.2.9' => [ [ mkl_pc( 'cache' ), 'purge' ] ],
			'1.2.12' => [ [ mkl_pc( 'cache' ), 'purge' ] ],
			'1.2.17' => [ [ $this, 'set_default_setting_value_v1_2_17' ] ],
			'1.2.35' => [ [ $this, 'set_default_setting_value_v1_2_35' ] ],
			'1.2.41' => [ [ mkl_pc( 'cache' ), 'purge' ] ],
			'1.3.00' => [ [ $this, 'set_default_setting_value_v1_3_00' ] ],
		];

		$saved_version = get_option( 'mkl_pc_version' );

		// First install
		if ( ! $saved_version ) {
			update_option( 'mkl_pc_version', MKL_PC_VERSION );
			return;
		}

		// Updates
		if ( $saved_version && version_compare( $saved_version, MKL_PC_VERSION, '<' ) ) {
			foreach ($updates_list as $version => $updates) {
				if (version_compare($version, $saved_version, '>')) {
					foreach ($updates as $update) {
						if ( is_callable( $update ) ) call_user_func( $update );
					}
				}
			}			
			do_action( 'mkl_pc_updated_plugin' );
			update_option('mkl_pc_version', MKL_PC_VERSION);
		}
	}

	private function update_wrong_layer_ids() {
		// Get all the products
		global $wpdb;
		$metas = $wpdb->get_results( $wpdb->prepare( "SELECT meta_id, meta_value FROM $wpdb->postmeta WHERE meta_key = %s ", '_mkl_product_configurator_content') );
		foreach( $metas as $index => $meta ) {
			$data = unserialize( $meta->meta_value );
			// Add a backup of the post data
			add_post_meta( $meta->post_id, '_mkl_product_configurator_content__backup', $data );

			// Iterate through each layer and choice
			foreach( $data as $layer_index => $layer ) {
				foreach( $layer['choices'] as $choice_index => $choice ) {
					// Set the correct proprerty "layerId"
					$data[$layer_index]['choices'][$choice_index]['layerId'] = $layer['layerId'];
				} 
			}

			// Update the data.
			$wpdb->update( 
				$wpdb->postmeta,
				array( 
					'meta_value' => serialize( $data )    // integer (number) 
				), 
				array( 'meta_id' => $meta->meta_id )
			);
		}
	}

	/**
	 * Set the default 'show_active_choice_in_layer' option
	 *
	 * @return void
	 */
	private function set_default_setting_value_v1_2_17() {
		$options = get_option( 'mkl_pc__settings' );
		$options['show_active_choice_in_layer'] = true;
		update_option( 'mkl_pc__settings', $options );
	}

	/**
	 * Set the default 'show_active_choice_in_layer' option
	 *
	 * @return void
	 */
	private function set_default_setting_value_v1_2_35() {
		$options = get_option( 'mkl_pc__settings' );
		$options['auto_scroll'] = true;
		update_option( 'mkl_pc__settings', $options );
	}

	/**
	 * Save default theme
	 *
	 * @return void
	 */
	private function set_default_setting_value_v1_3_00() {
		$theme = mkl_pc( 'settings' )->get( 'mkl_pc__theme' );
		if ( ! empty( $theme ) ) return;
		mkl_pc( 'settings' )->set( 'mkl_pc__theme', 'default' );
	}

	public static function instance() {
		static $instance;
		if ( !$instance ) {
			$instance = new self();
		}
		return $instance;
	}
}

// Initialize
Update::instance();