<?php
/**
 * Core version on add-on update checks, and the compatibility notice.
 *
 * Each add-on stores its Updraft updater in the global $mkl_updater_instances.
 * Update checks send a site profile as the base64 JSON query argument si2.
 * This class adds mkl_pc (the installed core version) to that profile.
 *
 * The update server can answer with extraProperties.x-mkl-core-notice:
 * - a string, shown as the admin notice;
 * - an array with version (add-on version named in the notice), optional name,
 *   and optional requires (minimum core version). When requires is newer than
 *   the installed core, the notice is shown. The server withholds that package;
 *   this plugin does not change WordPress's update list.
 *
 * @package MKL\PC
 */

namespace MKL\PC;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Shares the core plugin version with add-on updaters and renders the server notice.
 */
class Addon_Update_Compat {

	const NOTICE_KEY = 'x-mkl-core-notice';

	/**
	 * Attach to updaters once they have all been constructed.
	 *
	 * Add-ons register on plugins_loaded at priorities up to 50.
	 *
	 * @return void
	 */
	public static function boot() {
		$compat = new self();
		$compat->attach_to_updaters();
		add_action( 'all_admin_notices', [ $compat, 'render_admin_notices' ] );
	}

	/**
	 * Add the core version to each add-on's update request.
	 *
	 * @return void
	 */
	public function attach_to_updaters() {
		foreach ( $this->updater_instances() as $updater ) {
			if ( empty( $updater->plug_updatechecker ) || ! is_object( $updater->plug_updatechecker ) ) {
				continue;
			}
			if ( ! method_exists( $updater->plug_updatechecker, 'addFilter' ) ) {
				continue;
			}
			$updater->plug_updatechecker->addFilter( 'request_info_query_args', [ $this, 'add_core_version_to_query' ], 20 );
		}
	}

	/**
	 * Insert the installed core version into the si2 site profile.
	 *
	 * Runs after Updraft_Manager_Updater_1_9::updater_queryargs_plugin(), which
	 * builds si2 at priority 10.
	 *
	 * @param array $args Query arguments for the update request.
	 * @return array
	 */
	public function add_core_version_to_query( $args ) {
		if ( ! is_array( $args ) || empty( $args['si2'] ) || ! defined( 'MKL_PC_VERSION' ) ) {
			return $args;
		}

		$info = json_decode( base64_decode( urldecode( $args['si2'] ) ), true );
		if ( ! is_array( $info ) ) {
			return $args;
		}

		$info['mkl_pc'] = MKL_PC_VERSION;
		$args['si2']    = urlencode( base64_encode( wp_json_encode( $info ) ) );

		return $args;
	}

	/**
	 * Print one warning per add-on whose latest check asked for a core update.
	 *
	 * @return void
	 */
	public function render_admin_notices() {
		if ( ! current_user_can( 'update_plugins' ) ) {
			return;
		}

		foreach ( $this->updater_instances() as $updater ) {
			$message = $this->notice_message_for( $updater );
			if ( '' === $message ) {
				continue;
			}
			echo '<div class="notice notice-warning mkl-pc-addon-core-notice"><p>' . esc_html( $message ) . '</p></div>';
		}
	}

	/**
	 * Updater instances registered by the add-ons.
	 *
	 * @return array
	 */
	private function updater_instances() {
		global $mkl_updater_instances;

		if ( empty( $mkl_updater_instances ) || ! is_array( $mkl_updater_instances ) ) {
			return [];
		}

		$instances = [];
		foreach ( $mkl_updater_instances as $updater ) {
			if ( is_object( $updater ) && ! empty( $updater->slug ) ) {
				$instances[] = $updater;
			}
		}

		return $instances;
	}

	/**
	 * The update object stored by Plugin Update Checker for an add-on.
	 *
	 * @param object $updater Updraft updater instance.
	 * @return object|null
	 */
	private function stored_update( $updater ) {
		$state = get_site_option( 'external_updates-' . $updater->slug );
		if ( ! is_object( $state ) || empty( $state->update ) || ! is_object( $state->update ) ) {
			return null;
		}
		return $state->update;
	}

	/**
	 * Notice payload from a stored update, or null when the server sent none.
	 *
	 * @param object|null $update Stored update.
	 * @return array|string|null
	 */
	private function notice_payload_from_update( $update ) {
		if ( ! is_object( $update ) || ! isset( $update->extraProperties ) ) {
			return null;
		}

		$properties = $update->extraProperties;
		if ( is_object( $properties ) ) {
			$properties = get_object_vars( $properties );
		}
		if ( ! is_array( $properties ) || ! isset( $properties[ self::NOTICE_KEY ] ) ) {
			return null;
		}

		$payload = $properties[ self::NOTICE_KEY ];
		if ( is_string( $payload ) ) {
			$payload = trim( $payload );
			return '' === $payload ? null : $payload;
		}
		if ( is_object( $payload ) ) {
			$payload = get_object_vars( $payload );
		}
		if ( ! is_array( $payload ) ) {
			return null;
		}

		return $payload;
	}

	/**
	 * Whether the payload names a core version newer than the one installed.
	 *
	 * @param array $payload Structured notice payload.
	 * @return bool
	 */
	private function requirement_blocks_update( $payload ) {
		if ( empty( $payload['requires'] ) || ! defined( 'MKL_PC_VERSION' ) ) {
			return false;
		}
		return version_compare( MKL_PC_VERSION, (string) $payload['requires'], '<' );
	}

	/**
	 * Admin notice for one add-on, or an empty string when there is nothing to show.
	 *
	 * @param object $updater Updraft updater instance.
	 * @return string
	 */
	private function notice_message_for( $updater ) {
		$update  = $this->stored_update( $updater );
		$payload = $this->notice_payload_from_update( $update );
		if ( null === $payload ) {
			return '';
		}
		if ( is_string( $payload ) ) {
			return $payload;
		}
		if ( ! empty( $payload['requires'] ) && ! $this->requirement_blocks_update( $payload ) ) {
			return '';
		}

		$version = isset( $payload['version'] ) ? (string) $payload['version'] : '';
		if ( '' === $version && is_object( $update ) && ! empty( $update->version ) ) {
			$version = (string) $update->version;
		}
		if ( '' === $version ) {
			return '';
		}

		$name = ! empty( $payload['name'] ) ? (string) $payload['name'] : $this->addon_name( $updater );
		if ( '' === $name ) {
			$name = (string) $updater->slug;
		}

		return sprintf(
			/* translators: 1: add-on name, 2: add-on version */
			__( '%1$s v%2$s is only compatible with the latest version of the core plugin. Please update.', 'product-configurator-for-woocommerce' ),
			$name,
			$version
		);
	}

	/**
	 * Plugin name from the add-on header.
	 *
	 * @param object $updater Updraft updater instance.
	 * @return string
	 */
	private function addon_name( $updater ) {
		if ( empty( $updater->relative_plugin_file ) ) {
			return '';
		}

		$path = trailingslashit( WP_PLUGIN_DIR ) . $updater->relative_plugin_file;
		if ( ! file_exists( $path ) ) {
			return '';
		}
		if ( ! function_exists( 'get_plugin_data' ) ) {
			require_once ABSPATH . 'wp-admin/includes/plugin.php';
		}

		$data = get_plugin_data( $path, false, false );
		return isset( $data['Name'] ) ? (string) $data['Name'] : '';
	}
}
