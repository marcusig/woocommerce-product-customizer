<?php
namespace MKL\PC;

use WP_Post;

if ( ! defined( 'ABSPATH' ) ) {
	die( 'No direct access.' );
}

/**
 * Admin helpers for 3D asset uploads (GLTF/GLB/ZIP/HDR).
 */
class Admin_Product_3D {

	/** @var int Default max ZIP size in bytes (100 MB). */
	const DEFAULT_MAX_ZIP_BYTES = 104857600;

	/** @var int Default max files inside a ZIP. */
	const DEFAULT_MAX_ZIP_FILES = 500;

	/** @var int Default max total extracted size in bytes (200 MB). */
	const DEFAULT_MAX_EXTRACTED_BYTES = 209715200;

	/**
	 * @var array File extensions kept when a configurator ZIP is extracted.
	 *
	 * Everything a glTF scene can legitimately reference. Anything else is
	 * removed after extraction rather than left in a web-served directory.
	 * Filterable via mkl_pc_3d_allowed_zip_extensions.
	 */
	const DEFAULT_ALLOWED_ZIP_EXTENSIONS = array(
		// glTF itself.
		'glb', 'gltf', 'bin', 'json',
		// Textures.
		'png', 'jpg', 'jpeg', 'webp', 'avif', 'ktx2', 'basis', 'dds',
		// Environments.
		'hdr', 'exr',
	);

	/**
	 * @var array Extensions that can be executed by a web server.
	 *
	 * A 3D asset archive has no reason to contain any of these, so their
	 * presence means the ZIP is not what it claims to be and the whole archive
	 * is rejected before anything is written to disk.
	 */
	const EXECUTABLE_ZIP_EXTENSIONS = array(
		'php', 'php1', 'php2', 'php3', 'php4', 'php5', 'php6', 'php7', 'php8',
		'phps', 'phtml', 'phar', 'pht', 'shtml', 'cgi', 'pl', 'py', 'rb', 'sh',
		'bash', 'asp', 'aspx', 'jsp', 'jspx', 'exe', 'dll', 'so', 'htaccess',
		'htpasswd', 'ini',
	);

	/** @var array Filenames that are dangerous regardless of extension. */
	const EXECUTABLE_ZIP_BASENAMES = array(
		'.htaccess', '.htpasswd', '.user.ini', 'php.ini', 'web.config',
	);

	public function __construct() {
		add_filter( 'upload_mimes', array( $this, 'filter_upload_mimes' ) );
		add_filter( 'wp_check_filetype_and_ext', array( $this, 'filter_check_filetype_and_ext' ), 10, 4 );
		add_filter( 'upload_dir', array( $this, 'filter_upload_dir' ) );
		add_action( 'add_attachment', array( $this, 'maybe_unzip_configurator_attachment' ) );
		add_filter( 'wp_prepare_attachment_for_js', array( $this, 'prepare_attachment_for_js' ), 10, 3 );
		add_filter( 'mkl_pc_3d_settings_sections', array( $this, 'register_ar_discovery_section' ), 15 );
		add_filter( 'mkl_pc_3d_settings_sections', array( $this, 'register_postprocessing_discovery_section' ), 15 );
		add_filter( 'mkl_pc_3d_settings_sections', array( $this, 'ensure_reset_settings_section_last' ), 100 );
	}

	/**
	 * Whether the AR add-on discovery section should appear in 3D settings.
	 *
	 * @return bool
	 */
	public static function should_show_ar_discovery_section() {
		return ! class_exists( 'MKL_PC_3D_Premium' )
			&& ! get_user_meta( get_current_user_id(), 'mkl_pc_hide_addon__ar_placeholder', true );
	}

	/**
	 * Whether the postprocessing add-on discovery section should appear in 3D settings.
	 *
	 * @return bool
	 */
	public static function should_show_postprocessing_discovery_section() {
		return ! class_exists( 'MKL_PC_3D_Premium' )
			&& ! get_user_meta( get_current_user_id(), 'mkl_pc_hide_addon__postprocessing_placeholder', true );
	}

	/**
	 * Register an AR settings tab that promotes the 3D Premium add-on when it is inactive.
	 *
	 * @param array $sections 3D settings sections.
	 * @return array
	 */
	public function register_ar_discovery_section( $sections ) {
		if ( ! self::should_show_ar_discovery_section() ) {
			return $sections;
		}

		$sections[] = array(
			'id'       => 'ar',
			'title'    => __( 'AR / Quick Look', 'product-configurator-for-woocommerce' ),
			'icon_id'  => 'settings_3d_section_ar',
			'icon'     => MKL_PC_ASSETS_URL . 'icons/3d/view_in_ar.svg',
			'template' => MKL_PC_INCLUDE_PATH . 'admin/views/3d-settings-sections/ar-discovery.php',
		);

		return $sections;
	}

	/**
	 * Register a postprocessing settings tab that promotes the 3D Premium add-on when it is inactive.
	 *
	 * @param array $sections 3D settings sections.
	 * @return array
	 */
	public function register_postprocessing_discovery_section( $sections ) {
		if ( ! self::should_show_postprocessing_discovery_section() ) {
			return $sections;
		}

		$sections[] = array(
			'id'       => 'postprocessing',
			'title'    => __( 'Postprocessing', 'product-configurator-for-woocommerce' ),
			'icon_id'  => 'settings_3d_section_postprocessing',
			'icon'     => MKL_PC_ASSETS_URL . 'icons/3d/light.svg',
			'template' => MKL_PC_INCLUDE_PATH . 'admin/views/3d-settings-sections/postprocessing-discovery.php',
		);

		return $sections;
	}

	/**
	 * Keep the Reset settings section last so add-on tabs stay above the destructive action.
	 *
	 * @param array $sections 3D settings sections.
	 * @return array
	 */
	public function ensure_reset_settings_section_last( $sections ) {
		$reset_section = null;
		$ordered       = array();

		foreach ( $sections as $section ) {
			if ( isset( $section['id'] ) && 'reset' === $section['id'] ) {
				$reset_section = $section;
				continue;
			}
			$ordered[] = $section;
		}

		if ( null !== $reset_section ) {
			$ordered[] = $reset_section;
		}

		return $ordered;
	}

	/**
	 * Allow 3D-related MIME types for shop managers / admins.
	 *
	 * @param array $mimes
	 * @return array
	 */
	public function filter_upload_mimes( $mimes ) {
		if ( current_user_can( 'manage_options' ) || current_user_can( 'manage_woocommerce' ) ) {
			$mimes['gltf'] = 'model/gltf+json';
			$mimes['glb']  = 'model/gltf-binary';
			$mimes['bin']  = 'application/octet-stream';
			$mimes['zip']  = 'application/zip';
			$mimes['hdr']  = 'image/vnd.radiance';
			$mimes['exr']  = 'image/x-exr';
		}
		return $mimes;
	}

	/**
	 * Fix MIME type detection for GLB/GLTF/HDR/EXR.
	 *
	 * @param array  $data
	 * @param string $file
	 * @param string $filename
	 * @param array  $mimes
	 * @return array
	 */
	public function filter_check_filetype_and_ext( $data, $file, $filename, $mimes ) {
		if ( ! ( current_user_can( 'manage_options' ) || current_user_can( 'manage_woocommerce' ) ) ) {
			return $data;
		}

		$ext = strtolower( pathinfo( $filename, PATHINFO_EXTENSION ) );
		$map = array(
			'glb'  => 'model/gltf-binary',
			'gltf' => 'model/gltf+json',
			'bin'  => 'application/octet-stream',
			'hdr'  => 'image/vnd.radiance',
			'exr'  => 'image/x-exr',
		);

		if ( isset( $map[ $ext ] ) ) {
			$data['ext']             = $ext;
			$data['type']            = $map[ $ext ];
			$data['proper_filename'] = $filename;
		}

		return $data;
	}

	/**
	 * Route configurator media uploads into uploads/configurator_assets/3D.
	 *
	 * @param array $dirs
	 * @return array
	 */
	public function filter_upload_dir( $dirs ) {
		if ( $this->is_configurator_assets_request() ) {
			$subdir         = '/configurator_assets/3D';
			$dirs['subdir'] = $subdir;
			$dirs['path']   = $dirs['basedir'] . $subdir;
			$dirs['url']    = $dirs['baseurl'] . $subdir;
			// Covers direct 3D uploads too, not just extracted ZIPs. wp_mkdir_p
			// runs after this filter, so create the parent ourselves first.
			$assets_dir = $dirs['basedir'] . '/configurator_assets/';
			wp_mkdir_p( $assets_dir );
			$this->protect_assets_directory( $assets_dir );
		}
		return $dirs;
	}

	/**
	 * Unzip configurator ZIPs only (not every site ZIP upload).
	 *
	 * @param int $attachment_id
	 */
	public function maybe_unzip_configurator_attachment( $attachment_id ) {
		$attachment_id = absint( $attachment_id );
		if ( ! $attachment_id ) {
			return;
		}

		$file = get_attached_file( $attachment_id );
		if ( ! $file || ! is_string( $file ) ) {
			return;
		}

		if ( 'zip' !== strtolower( pathinfo( $file, PATHINFO_EXTENSION ) ) ) {
			return;
		}

		if ( ! $this->should_unzip_attachment( $attachment_id, $file ) ) {
			return;
		}

		$max_zip_bytes = (int) apply_filters( 'mkl_pc_3d_max_zip_bytes', self::DEFAULT_MAX_ZIP_BYTES, $attachment_id );
		$file_size     = @filesize( $file ); // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged
		if ( false !== $file_size && $max_zip_bytes > 0 && $file_size > $max_zip_bytes ) {
			error_log( sprintf( 'MKL PC 3D: ZIP attachment %d exceeds max size (%d > %d).', $attachment_id, $file_size, $max_zip_bytes ) );
			return;
		}

		$max_files           = (int) apply_filters( 'mkl_pc_3d_max_zip_files', self::DEFAULT_MAX_ZIP_FILES, $attachment_id );
		$max_extracted_bytes = (int) apply_filters( 'mkl_pc_3d_max_extracted_bytes', self::DEFAULT_MAX_EXTRACTED_BYTES, $attachment_id );

		$precheck = $this->precheck_zip_archive( $file, $max_files, $max_extracted_bytes );
		if ( is_wp_error( $precheck ) ) {
			error_log( sprintf( 'MKL PC 3D: ZIP precheck failed for attachment %d: %s', $attachment_id, $precheck->get_error_message() ) );
			return;
		}

		$upload_dir = wp_upload_dir();
		$target_dir = trailingslashit( $upload_dir['basedir'] ) . 'configurator_assets/zips/' . $attachment_id . '/';
		$target_dir = trailingslashit( wp_normalize_path( $target_dir ) );

		$this->delete_directory( $target_dir );
		wp_mkdir_p( $target_dir );
		$this->protect_assets_directory( trailingslashit( $upload_dir['basedir'] ) . 'configurator_assets/' );

		require_once ABSPATH . 'wp-admin/includes/file.php';

		$result = unzip_file( $file, $target_dir );
		if ( is_wp_error( $result ) ) {
			error_log( sprintf( 'MKL PC 3D: Unzip failed for attachment %d: %s', $attachment_id, $result->get_error_message() ) );
			$this->delete_directory( $target_dir );
			return;
		}

		$postcheck = $this->postcheck_extracted_directory( $target_dir, $max_files, $max_extracted_bytes );
		if ( is_wp_error( $postcheck ) ) {
			error_log( sprintf( 'MKL PC 3D: Extracted ZIP rejected for attachment %d: %s', $attachment_id, $postcheck->get_error_message() ) );
			$this->delete_directory( $target_dir );
			delete_post_meta( $attachment_id, '_configurator_entry_file' );
			return;
		}

		$main_file = $this->find_gltf_entry_relative_path( $target_dir );
		if ( $main_file ) {
			update_post_meta( $attachment_id, '_configurator_entry_file', $main_file );
			update_post_meta( $attachment_id, '_mkl_pc_is_configurator_zip', 1 );
		} else {
			delete_post_meta( $attachment_id, '_configurator_entry_file' );
			delete_post_meta( $attachment_id, '_mkl_pc_is_configurator_zip' );
		}
	}

	/**
	 * Expose extracted GLTF URL for configurator ZIP attachments in the media modal.
	 *
	 * @param array   $response
	 * @param WP_Post $attachment
	 * @param array   $meta
	 * @return array
	 */
	public function prepare_attachment_for_js( $response, WP_Post $attachment, $meta ) {
		if ( empty( $response['mime'] ) || 'application/zip' !== $response['mime'] ) {
			return $response;
		}

		$gltf_file = $this->pc_get_configurator_entry_url( $attachment->ID );
		if ( $gltf_file ) {
			$response['gltf_filename'] = basename( $gltf_file );
			$response['gltf_url']      = $gltf_file;
		}

		return $response;
	}

	/**
	 * Get the public URL of the GLTF/GLB entry file inside an extracted ZIP.
	 *
	 * @param int $attachment_id
	 * @return string|false
	 */
	public function pc_get_configurator_entry_url( $attachment_id ) {
		$attachment_id = absint( $attachment_id );
		if ( ! $attachment_id ) {
			return false;
		}

		$entry_file = get_post_meta( $attachment_id, '_configurator_entry_file', true );
		if ( ! is_string( $entry_file ) || '' === $entry_file ) {
			return false;
		}

		$entry_file = $this->sanitize_relative_entry_path( $entry_file );
		if ( ! $entry_file ) {
			return false;
		}

		$upload_dir = wp_upload_dir();
		$base_dir   = trailingslashit( wp_normalize_path( $upload_dir['basedir'] ) ) . 'configurator_assets/zips/' . $attachment_id . '/';
		$full_path  = $base_dir . $entry_file;

		if ( ! $this->is_path_inside_directory( $full_path, $base_dir ) ) {
			return false;
		}

		if ( ! file_exists( $full_path ) ) {
			return false;
		}

		return trailingslashit( $upload_dir['baseurl'] ) . 'configurator_assets/zips/' . $attachment_id . '/' . str_replace( '\\', '/', $entry_file );
	}

	/**
	 * Whether the current request is a configurator asset upload.
	 *
	 * @return bool
	 */
	private function is_configurator_assets_request() {
		if ( empty( $_REQUEST['context'] ) ) { // phpcs:ignore WordPress.Security.NonceVerification.Recommended
			return false;
		}
		$context = sanitize_key( wp_unslash( $_REQUEST['context'] ) ); // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		return ( 'configurator_assets' === $context );
	}

	/**
	 * Decide whether this ZIP should be extracted for the configurator.
	 *
	 * @param int    $attachment_id
	 * @param string $file Absolute path to the ZIP.
	 * @return bool
	 */
	private function should_unzip_attachment( $attachment_id, $file ) {
		if ( $this->is_configurator_assets_request() ) {
			return true;
		}

		// Fallback when context is missing: file already lives under configurator_assets.
		$normalized = wp_normalize_path( $file );
		if ( false !== strpos( $normalized, '/configurator_assets/' ) ) {
			return true;
		}

		return (bool) apply_filters( 'mkl_pc_3d_should_unzip_attachment', false, $attachment_id, $file );
	}

	/**
	 * Pre-scan ZIP contents when ZipArchive is available.
	 *
	 * @param string $file
	 * @param int    $max_files
	 * @param int    $max_extracted_bytes
	 * @return true|\WP_Error
	 */
	private function precheck_zip_archive( $file, $max_files, $max_extracted_bytes ) {
		if ( ! class_exists( 'ZipArchive' ) ) {
			return true;
		}

		$zip = new \ZipArchive();
		if ( true !== $zip->open( $file ) ) {
			return new \WP_Error( 'mkl_pc_zip_open', 'Unable to open ZIP archive.' );
		}

		$file_count   = 0;
		$total_bytes  = 0;
		$has_traversal = false;

		for ( $i = 0; $i < $zip->numFiles; $i++ ) {
			$stat = $zip->statIndex( $i );
			if ( ! is_array( $stat ) || empty( $stat['name'] ) ) {
				continue;
			}

			$name = str_replace( '\\', '/', $stat['name'] );
			if ( $this->zip_entry_name_is_unsafe( $name ) ) {
				$has_traversal = true;
				break;
			}

			// Skip directory entries.
			if ( '/' === substr( $name, -1 ) ) {
				continue;
			}

			// A 3D asset archive has no reason to carry anything executable, so
			// its presence means this is not the kind of ZIP it claims to be.
			// Rejected here, before unzip_file writes a single byte.
			if ( $this->zip_entry_is_executable( $name ) ) {
				$zip->close();
				return new \WP_Error(
					'mkl_pc_zip_executable_entry',
					sprintf( 'ZIP contains an executable file (%s).', $name )
				);
			}

			$file_count++;
			$total_bytes += isset( $stat['size'] ) ? (int) $stat['size'] : 0;

			if ( $max_files > 0 && $file_count > $max_files ) {
				$zip->close();
				return new \WP_Error( 'mkl_pc_zip_too_many_files', 'ZIP contains too many files.' );
			}
			if ( $max_extracted_bytes > 0 && $total_bytes > $max_extracted_bytes ) {
				$zip->close();
				return new \WP_Error( 'mkl_pc_zip_too_large', 'ZIP uncompressed size exceeds the limit.' );
			}
		}

		$zip->close();

		if ( $has_traversal ) {
			return new \WP_Error( 'mkl_pc_zip_path_traversal', 'ZIP contains unsafe paths.' );
		}

		return true;
	}

	/**
	 * Validate extracted tree size/count and that nothing escaped the target dir.
	 *
	 * @param string $target_dir
	 * @param int    $max_files
	 * @param int    $max_extracted_bytes
	 * @return true|\WP_Error
	 */
	private function postcheck_extracted_directory( $target_dir, $max_files, $max_extracted_bytes ) {
		if ( ! is_dir( $target_dir ) ) {
			return new \WP_Error( 'mkl_pc_zip_missing_dir', 'Extract directory missing.' );
		}

		$file_count  = 0;
		$total_bytes = 0;

		try {
			$iterator = new \RecursiveIteratorIterator(
				new \RecursiveDirectoryIterator( $target_dir, \FilesystemIterator::SKIP_DOTS )
			);
		} catch ( \Exception $e ) {
			return new \WP_Error( 'mkl_pc_zip_iterate', $e->getMessage() );
		}

		// Collected rather than unlinked mid-iteration, which is not safe while
		// the recursive iterator still holds the directory open.
		$to_remove = array();

		foreach ( $iterator as $item ) {
			$path = $item->getPathname();
			if ( ! $this->is_path_inside_directory( $path, $target_dir ) ) {
				return new \WP_Error( 'mkl_pc_zip_path_escape', 'Extracted file escaped the target directory.' );
			}
			if ( ! $item->isFile() ) {
				continue;
			}

			// Anything executable that reached disk means the pre-scan did not
			// run (no ZipArchive) or did not catch it. Fail the whole extraction
			// rather than trying to clean up around it.
			if ( $this->zip_entry_is_executable( $path ) ) {
				return new \WP_Error(
					'mkl_pc_zip_executable_entry',
					sprintf( 'Extracted ZIP contains an executable file (%s).', $item->getFilename() )
				);
			}

			// Everything else that is not a usable 3D asset is simply dropped.
			// This is mostly archiver noise — __MACOSX resource forks, .DS_Store,
			// readme files — which should not fail an otherwise valid upload, but
			// equally has no business sitting in a web-served directory.
			if ( ! $this->zip_entry_is_allowed_asset( $path ) ) {
				$to_remove[] = $path;
				continue;
			}

			$file_count++;
			$total_bytes += (int) $item->getSize();

			if ( $max_files > 0 && $file_count > $max_files ) {
				return new \WP_Error( 'mkl_pc_zip_too_many_files', 'Extracted ZIP contains too many files.' );
			}
			if ( $max_extracted_bytes > 0 && $total_bytes > $max_extracted_bytes ) {
				return new \WP_Error( 'mkl_pc_zip_too_large', 'Extracted ZIP exceeds the size limit.' );
			}
		}

		foreach ( $to_remove as $path ) {
			if ( $this->is_path_inside_directory( $path, $target_dir ) ) {
				@unlink( $path ); // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged
			}
		}

		return true;
	}

	/**
	 * Find the first GLB/GLTF under the extract dir and return a safe relative path.
	 *
	 * @param string $target_dir
	 * @return string Empty string when not found.
	 */
	private function find_gltf_entry_relative_path( $target_dir ) {
		$target_dir = trailingslashit( wp_normalize_path( $target_dir ) );

		try {
			$iterator = new \RecursiveIteratorIterator(
				new \RecursiveDirectoryIterator( $target_dir, \FilesystemIterator::SKIP_DOTS )
			);
		} catch ( \Exception $e ) {
			return '';
		}

		foreach ( $iterator as $item ) {
			if ( ! $item->isFile() ) {
				continue;
			}
			$ext = strtolower( $item->getExtension() );
			if ( ! in_array( $ext, array( 'glb', 'gltf' ), true ) ) {
				continue;
			}

			$full = wp_normalize_path( $item->getPathname() );
			if ( ! $this->is_path_inside_directory( $full, $target_dir ) ) {
				continue;
			}

			$relative = ltrim( substr( $full, strlen( $target_dir ) ), '/' );
			$relative = $this->sanitize_relative_entry_path( $relative );
			if ( $relative ) {
				return $relative;
			}
		}

		return '';
	}

	/**
	 * Reject relative paths that could escape the extract directory.
	 *
	 * @param string $relative
	 * @return string Sanitized relative path or empty string.
	 */
	private function sanitize_relative_entry_path( $relative ) {
		$relative = str_replace( '\\', '/', (string) $relative );
		$relative = ltrim( $relative, '/' );

		if ( '' === $relative ) {
			return '';
		}

		if ( false !== strpos( $relative, "\0" ) ) {
			return '';
		}

		$parts = explode( '/', $relative );
		foreach ( $parts as $part ) {
			if ( '' === $part || '.' === $part || '..' === $part ) {
				return '';
			}
		}

		return implode( '/', $parts );
	}

	/**
	 * Whether a ZIP entry name looks like path traversal or absolute path.
	 *
	 * @param string $name
	 * @return bool
	 */
	private function zip_entry_name_is_unsafe( $name ) {
		$name = str_replace( '\\', '/', (string) $name );
		if ( '' === $name ) {
			return true;
		}
		if ( '/' === $name[0] || preg_match( '#^[A-Za-z]:/#', $name ) ) {
			return true;
		}
		$parts = explode( '/', $name );
		foreach ( $parts as $part ) {
			if ( '..' === $part ) {
				return true;
			}
		}
		return false;
	}

	/**
	 * Drop an .htaccess and an index.php into uploads/configurator_assets/.
	 *
	 * Second line of defence behind the extension allowlist. The assets in here
	 * are served to the browser, so this cannot be WooCommerce's "deny from all"
	 * — it blocks handlers and directory listing while leaving static files
	 * readable.
	 *
	 * Apache only. nginx ignores .htaccess entirely, which is exactly why the
	 * allowlist is the primary control and this is the backstop, not the reverse.
	 *
	 * Existing files are never overwritten, so a host-specific version a
	 * merchant or their host has put here is left alone.
	 *
	 * @param string $assets_dir Absolute path to uploads/configurator_assets/.
	 */
	private function protect_assets_directory( $assets_dir ) {
		$assets_dir = trailingslashit( wp_normalize_path( $assets_dir ) );
		if ( ! is_dir( $assets_dir ) ) {
			return;
		}

		$htaccess = $assets_dir . '.htaccess';
		if ( ! file_exists( $htaccess ) ) {
			$rules = "# Managed by Product Configurator for WooCommerce.\n"
				. "# 3D assets are served from here, so static files stay readable;\n"
				. "# only script execution and directory listing are blocked.\n"
				. "Options -Indexes\n"
				. "<IfModule mod_php.c>\n\tphp_flag engine off\n</IfModule>\n"
				. "<IfModule mod_php7.c>\n\tphp_flag engine off\n</IfModule>\n"
				. "<IfModule mod_php8.c>\n\tphp_flag engine off\n</IfModule>\n"
				. "<FilesMatch \"(?i)\\.(php|php[0-9]|phps|phtml|phar|pht|shtml|cgi|pl|py|rb|sh|asp|aspx|jsp)$\">\n"
				. "\tSetHandler none\n"
				. "\t<IfModule mod_authz_core.c>\n\t\tRequire all denied\n\t</IfModule>\n"
				. "\t<IfModule !mod_authz_core.c>\n\t\tOrder allow,deny\n\t\tDeny from all\n\t</IfModule>\n"
				. "</FilesMatch>\n";
			@file_put_contents( $htaccess, $rules ); // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged, WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents
		}

		$index = $assets_dir . 'index.php';
		if ( ! file_exists( $index ) ) {
			@file_put_contents( $index, "<?php\n// Silence is golden.\n" ); // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged, WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents
		}
	}

	/**
	 * Extensions a configurator ZIP may contribute, lowercased.
	 *
	 * @return array
	 */
	private function get_allowed_zip_extensions() {
		$allowed = apply_filters( 'mkl_pc_3d_allowed_zip_extensions', self::DEFAULT_ALLOWED_ZIP_EXTENSIONS );
		if ( ! is_array( $allowed ) ) {
			$allowed = self::DEFAULT_ALLOWED_ZIP_EXTENSIONS;
		}
		return array_map( 'strtolower', $allowed );
	}

	/**
	 * Whether a ZIP entry could be executed by a web server.
	 *
	 * Checked against the whole basename as well as the extension, because the
	 * files that matter most (.htaccess, .user.ini) are named, not suffixed.
	 *
	 * @param string $name Entry name or path.
	 * @return bool
	 */
	private function zip_entry_is_executable( $name ) {
		$basename = strtolower( basename( str_replace( '\\', '/', (string) $name ) ) );
		if ( in_array( $basename, self::EXECUTABLE_ZIP_BASENAMES, true ) ) {
			return true;
		}
		$ext = strtolower( pathinfo( $basename, PATHINFO_EXTENSION ) );
		if ( '' !== $ext && in_array( $ext, self::EXECUTABLE_ZIP_EXTENSIONS, true ) ) {
			return true;
		}
		// "shell.php.jpg" style double extensions: some server configs hand any
		// file containing .php to the PHP handler, so treat inner ones as real.
		foreach ( explode( '.', $basename ) as $segment ) {
			if ( in_array( $segment, self::EXECUTABLE_ZIP_EXTENSIONS, true ) ) {
				return true;
			}
		}
		return false;
	}

	/**
	 * Whether a ZIP entry is a file type a 3D scene can legitimately use.
	 *
	 * @param string $name Entry name or path.
	 * @return bool
	 */
	private function zip_entry_is_allowed_asset( $name ) {
		// Independently of the caller's ordering: something like "shell.php.jpg"
		// ends in an allowed extension but is still executable on a server that
		// dispatches on any .php segment. Never let it through this check either.
		if ( $this->zip_entry_is_executable( $name ) ) {
			return false;
		}
		$ext = strtolower( pathinfo( basename( str_replace( '\\', '/', (string) $name ) ), PATHINFO_EXTENSION ) );
		if ( '' === $ext ) {
			return false;
		}
		return in_array( $ext, $this->get_allowed_zip_extensions(), true );
	}

	/**
	 * True when $path resolves inside $directory.
	 *
	 * @param string $path
	 * @param string $directory
	 * @return bool
	 */
	private function is_path_inside_directory( $path, $directory ) {
		$real_dir = realpath( $directory );
		if ( false === $real_dir ) {
			// Directory may not exist yet during checks of intended paths — use normalized string compare.
			$directory = trailingslashit( wp_normalize_path( $directory ) );
			$path      = wp_normalize_path( $path );
			return ( 0 === strpos( $path, $directory ) );
		}

		$real_dir = trailingslashit( wp_normalize_path( $real_dir ) );
		$real_path = realpath( $path );
		if ( false === $real_path ) {
			// File may not exist; resolve parent and compare basename-safe relative form.
			$path = wp_normalize_path( $path );
			return ( 0 === strpos( $path, $real_dir ) && false === strpos( substr( $path, strlen( $real_dir ) ), '../' ) );
		}

		$real_path = wp_normalize_path( $real_path );
		return ( 0 === strpos( $real_path, $real_dir ) );
	}

	/**
	 * Recursively delete a directory if it exists.
	 *
	 * @param string $directory
	 */
	private function delete_directory( $directory ) {
		if ( ! $directory || ! file_exists( $directory ) ) {
			return;
		}

		global $wp_filesystem;
		if ( empty( $wp_filesystem ) ) {
			require_once ABSPATH . 'wp-admin/includes/file.php';
			WP_Filesystem();
		}
		if ( $wp_filesystem ) {
			$wp_filesystem->delete( $directory, true );
		}
	}
}
