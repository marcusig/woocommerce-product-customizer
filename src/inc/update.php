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
			'1.1.2' => [ [ $this, 'update_wrong_layer_ids' ] ],
		];

		// $this->update_wrong_layer_ids();
		$saved_version = get_option( 'mkl_pc_version' );

		// First install
		if ( !$saved_version ) {
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
			foreach( $data as $layer_index => $layer ) {
				foreach( $layer['choices'] as $choice_index => $choice ) {
					$data[$layer_index]['choices'][$choice_index]['layerId'] = $layer['layerId'];
					// if ( isset( $data[$layer_index]['choices'][$choice_index]['not_a_choice'] ) ) unset( $data[$layer_index]['choices'][$choice_index]['not_a_choice'] );
				} 
			}

			$wpdb->update( 
				$wpdb->postmeta,
				array( 
					'meta_value' => serialize( $data )    // integer (number) 
				), 
				array( 'meta_id' => $meta->meta_id ), 
			);
		}
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