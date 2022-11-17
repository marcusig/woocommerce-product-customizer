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
		// $this->update_db();
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

	public function update_db() {
		if ( ! isset( $_REQUEST['update-db'] ) ) return;
		require_once ABSPATH . 'wp-admin/includes/upgrade.php';
		global $wpdb;

		$collate = '';

		if ( $wpdb->has_cap( 'collation' ) ) {
			$collate = $wpdb->get_charset_collate();
		}

		$schema = "
		CREATE TABLE {$wpdb->prefix}mklpc_layers (
			layer_id BIGINT UNSIGNED NOT NULL auto_increment,
			type varchar(255) default NULL,
			name varchar(500) NULL,
			parent BIGINT UNSIGNED NULL,
			global BIGINT UNSIGNED NULL,
			layer_order SMALLINT(2) NOT NULL default 0,
			product_id BIGINT UNSIGNED NULL,
			date_modified datetime NOT NULL,
			status varchar(100) NULL default 'published',
			PRIMARY KEY  (layer_id),
			KEY parent (parent),
			KEY status (status),
			KEY product_id (product_id)
		  ) $collate;
		CREATE TABLE {$wpdb->prefix}mklpc_layermeta (
			meta_id BIGINT UNSIGNED NOT NULL auto_increment,
			layer_id BIGINT UNSIGNED NOT NULL,
			meta_key varchar(255) default NULL,
			meta_value longtext NULL,
			PRIMARY KEY  (meta_id),
			KEY layer_id (layer_id),
			KEY meta_key (meta_key(32))
		  ) $collate;
		CREATE TABLE {$wpdb->prefix}mklpc_choices (
			choice_id BIGINT UNSIGNED NOT NULL auto_increment,
			layer_id BIGINT UNSIGNED NOT NULL,
			name varchar(500) NULL,
			parent BIGINT UNSIGNED NULL,
			date_modified datetime NOT NULL DEFAULT '0000-00-00 00:00:00',
			choice_order SMALLINT(2) NOT NULL default 0,
			status varchar(100) NULL default 'published',
			PRIMARY KEY  (choice_id),
			KEY layer_id (layer_id),
			KEY status (status),
			KEY parent (parent)
		  ) $collate;
		CREATE TABLE {$wpdb->prefix}mklpc_choicemeta (
			meta_id BIGINT UNSIGNED NOT NULL auto_increment,
			choice_id BIGINT UNSIGNED NOT NULL,
			meta_key varchar(255) default NULL,
			meta_value longtext NULL,
			PRIMARY KEY  (meta_id),
			KEY choice_id (choice_id),
			KEY meta_key (meta_key(32))
		  ) $collate;
		CREATE TABLE {$wpdb->prefix}mklpc_angles (
			angle_id BIGINT UNSIGNED NOT NULL auto_increment,
			name varchar(500) NULL,
			angle_order SMALLINT(2) NOT NULL default 0,
			product_id BIGINT UNSIGNED NULL,
			date_modified datetime NOT NULL,
			status varchar(100) NULL default 'published',
			PRIMARY KEY  (angle_id),
			KEY status (status),
			KEY product_id (product_id)
		  ) $collate;
		CREATE TABLE {$wpdb->prefix}mklpc_anglemeta (
			meta_id BIGINT UNSIGNED NOT NULL auto_increment,
			angle_id BIGINT UNSIGNED NOT NULL,
			meta_key varchar(255) default NULL,
			meta_value longtext NULL,
			PRIMARY KEY  (meta_id),
			KEY angle_id (angle_id),
			KEY meta_key (meta_key(32))
		  ) $collate;
		";

		dbDelta( $schema );
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