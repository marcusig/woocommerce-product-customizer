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
		];

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