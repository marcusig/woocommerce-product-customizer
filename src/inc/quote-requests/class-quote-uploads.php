<?php
namespace MKL\PC;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Files a customer sends with a quote request
 *
 * Core does not ask for files itself: an add-on (Form builder's upload fields) accepts the uploads it
 * asked for on `mkl_pc/quote_request/uploads`, checks them against its own rules, and labels them.
 * Core then checks the file type again, keeps the files in a private folder of their own, and gives
 * the stores a list to persist. Requests stored nowhere (email only) attach the files to the
 * merchant's email and delete them once it is sent.
 */
class Quote_Uploads {

	/**
	 * Folder under the uploads directory
	 */
	const FOLDER = 'mkl-pc-quote-uploads';

	/**
	 * Most files one request may carry
	 */
	const MAX_FILES = 20;

	public function __construct() {
		add_action( 'admin_post_mkl_pc_quote_file', [ $this, 'download' ] );
	}

	/**
	 * Uploaded files keyed by form field name, each a list of single files
	 *
	 * PHP gives `name[]` fields as one array per property; this turns them back into files.
	 *
	 * @param array $file_params $_FILES, or WP_REST_Request::get_file_params().
	 * @return array[]
	 */
	public function normalize( $file_params ) {
		$normalized = [];
		foreach ( (array) $file_params as $key => $file ) {
			if ( ! is_array( $file ) || ! isset( $file['name'] ) ) continue;
			$key = sanitize_key( $key );
			$normalized[ $key ] = [];
			if ( is_array( $file['name'] ) ) {
				foreach ( array_keys( $file['name'] ) as $index ) {
					$single = [];
					foreach ( [ 'name', 'type', 'tmp_name', 'error', 'size' ] as $property ) {
						$single[ $property ] = isset( $file[ $property ][ $index ] ) ? $file[ $property ][ $index ] : '';
					}
					$normalized[ $key ][] = $single;
				}
			} else {
				$normalized[ $key ][] = $file;
			}
			$normalized[ $key ] = array_values( array_filter( $normalized[ $key ], function( $single ) {
				return '' !== (string) $single['name'] && UPLOAD_ERR_NO_FILE !== (int) $single['error'];
			} ) );
			if ( empty( $normalized[ $key ] ) ) unset( $normalized[ $key ] );
		}
		return $normalized;
	}

	/**
	 * Let add-ons accept the uploads, and check what they accepted. Nothing is moved yet.
	 *
	 * @param Quote_Request $request
	 * @param array         $file_params Uploaded files, as PHP gives them.
	 * @param array         $args        Submitted data.
	 * @return true|\WP_Error
	 */
	public function accept( Quote_Request $request, $file_params, $args = [] ) {
		$uploads = $this->normalize( $file_params );

		/**
		 * Accept the files sent with a quote request. Files nobody accepts are ignored.
		 *
		 * @param array[]|\WP_Error $accepted Each: key (the form field), label (shown with the file), file (one
		 *                                    uploaded file), and optionally mimes (extension => type allowed).
		 * @param array[]           $uploads  Uploaded files keyed by form field name, each a list of files.
		 * @param Quote_Request     $request
		 * @param array             $args
		 */
		$accepted = apply_filters( 'mkl_pc/quote_request/uploads', [], $uploads, $request, $args );
		if ( is_wp_error( $accepted ) ) return $accepted;

		$accepted = array_values( array_filter( (array) $accepted, function( $entry ) {
			return is_array( $entry ) && ! empty( $entry['file']['tmp_name'] ) && ! empty( $entry['key'] );
		} ) );
		if ( count( $accepted ) > self::MAX_FILES ) {
			return new \WP_Error( 'mkl_pc_quote_too_many_files', __( 'Too many files were sent with the request.', 'product-configurator-for-woocommerce' ) );
		}

		foreach ( $accepted as $index => $entry ) {
			$file = $entry['file'];
			$name = sanitize_file_name( wp_basename( (string) $file['name'] ) );
			if ( UPLOAD_ERR_OK !== (int) $file['error'] ) {
				/* translators: %s: file name */
				return new \WP_Error( 'mkl_pc_quote_upload_error', sprintf( __( 'The file %s could not be uploaded.', 'product-configurator-for-woocommerce' ), $name ) );
			}
			$mimes = ! empty( $entry['mimes'] ) && is_array( $entry['mimes'] ) ? $entry['mimes'] : get_allowed_mime_types();
			$check = wp_check_filetype_and_ext( $file['tmp_name'], $name, $mimes );
			if ( empty( $check['ext'] ) || empty( $check['type'] ) ) {
				/* translators: %s: file name */
				return new \WP_Error( 'mkl_pc_quote_upload_type', sprintf( __( 'The file type of %s is not allowed.', 'product-configurator-for-woocommerce' ), $name ) );
			}
			$accepted[ $index ] = [
				'key'   => sanitize_key( $entry['key'] ),
				'label' => isset( $entry['label'] ) ? sanitize_text_field( $entry['label'] ) : '',
				'name'  => $check['proper_filename'] ? $check['proper_filename'] : $name,
				'type'  => $check['type'],
				'size'  => (int) $file['size'],
				'tmp'   => $file['tmp_name'],
			];
		}

		$request->uploads = $accepted;
		return true;
	}

	/**
	 * Move the accepted uploads into the request's folder
	 *
	 * @param Quote_Request $request With its reference.
	 * @return true|\WP_Error
	 */
	public function save( Quote_Request $request ) {
		if ( empty( $request->uploads ) ) return true;

		// Not guessable: the folder must not be found from the reference alone.
		$folder = sanitize_file_name( strtolower( $request->reference ) ) . '-' . wp_generate_password( 12, false );
		$dir = $this->get_base_dir() . '/' . $folder;
		if ( ! wp_mkdir_p( $dir ) ) {
			return new \WP_Error( 'mkl_pc_quote_upload_folder', __( 'The files could not be saved.', 'product-configurator-for-woocommerce' ), [ 'status' => 500 ] );
		}
		$this->protect( $this->get_base_dir() );

		$files = [];
		foreach ( $request->uploads as $upload ) {
			$target = $dir . '/' . wp_unique_filename( $dir, $upload['name'] );
			if ( ! $this->move_upload( $upload['tmp'], $target ) ) {
				$this->delete( $files );
				return new \WP_Error( 'mkl_pc_quote_upload_move', __( 'The files could not be saved.', 'product-configurator-for-woocommerce' ), [ 'status' => 500 ] );
			}
			$files[] = [
				'key'   => $upload['key'],
				'label' => $upload['label'],
				'name'  => $upload['name'],
				'type'  => $upload['type'],
				'size'  => $upload['size'],
				'path'  => $target,
			];
		}
		$request->files   = $files;
		$request->uploads = [];

		/**
		 * Fires once the files sent with a quote request are saved, before the request is stored.
		 *
		 * @param Quote_Request $request Its files list where each one is.
		 */
		do_action( 'mkl_pc/quote_request/files_saved', $request );
		return true;
	}

	/**
	 * Move one uploaded file. Only files PHP received with this request are moved.
	 *
	 * @param string $from
	 * @param string $to
	 * @return boolean
	 */
	protected function move_upload( $from, $to ) {
		if ( ! is_uploaded_file( $from ) ) return false;
		if ( ! @move_uploaded_file( $from, $to ) ) return false; // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged
		@chmod( $to, 0644 ); // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged
		return true;
	}

	/**
	 * Delete files of a request, and their folder once empty. Never outside the uploads folder.
	 *
	 * @param array[] $files Entries with a path.
	 * @return void
	 */
	public function delete( $files ) {
		$base = $this->get_base_dir() . '/';
		$folders = [];
		foreach ( (array) $files as $file ) {
			$path = isset( $file['path'] ) ? (string) $file['path'] : '';
			if ( ! $path || false !== strpos( $path, '..' ) || 0 !== strpos( $path, $base ) ) continue;
			if ( is_file( $path ) ) wp_delete_file( $path );
			$folders[ dirname( $path ) ] = true;
		}
		foreach ( array_keys( $folders ) as $folder ) {
			if ( rtrim( $folder, '/' ) . '/' !== $base && is_dir( $folder ) && 2 === count( (array) scandir( $folder ) ) ) {
				@rmdir( $folder ); // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged
			}
		}
	}

	/**
	 * Files as stored: paths relative to the uploads folder
	 *
	 * @param array[] $files
	 * @return array[]
	 */
	public function to_storage( $files ) {
		$stored = [];
		foreach ( (array) $files as $file ) {
			$relative = CPT_Store::to_relative_path( $file['path'] );
			if ( ! $relative ) continue;
			$file['path'] = $relative;
			$stored[] = $file;
		}
		return $stored;
	}

	/**
	 * Files as read from storage, with absolute paths
	 *
	 * @param mixed $stored
	 * @return array[]
	 */
	public function from_storage( $stored ) {
		$files = [];
		$basedir = wp_upload_dir()['basedir'];
		foreach ( (array) $stored as $file ) {
			if ( ! is_array( $file ) || empty( $file['path'] ) ) continue;
			$file = wp_parse_args( $file, [ 'key' => '', 'label' => '', 'name' => '', 'type' => '', 'size' => 0 ] );
			$file['path'] = $basedir . '/' . ltrim( $file['path'], '/' );
			$files[] = $file;
		}
		return $files;
	}

	/**
	 * Link to download a stored file, for users who can see the request
	 *
	 * @param Quote_Request $request
	 * @param int           $index
	 * @return string
	 */
	public function get_download_url( Quote_Request $request, $index ) {
		if ( ! $request->id ) return '';
		return wp_nonce_url(
			add_query_arg( [
				'action' => 'mkl_pc_quote_file',
				'store'  => $request->store,
				'id'     => $request->id,
				'file'   => (int) $index,
			], admin_url( 'admin-post.php' ) ),
			'mkl_pc_quote_file_' . $request->store . '_' . $request->id
		);
	}

	/**
	 * Serve a stored file to a user allowed to see its request
	 *
	 * The nonce makes the links in the admin work; they are tied to the user. Links in emails reach
	 * the login page first, then this check.
	 *
	 * @return void
	 */
	public function download() {
		$store_id = isset( $_GET['store'] ) ? sanitize_key( wp_unslash( $_GET['store'] ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		$id       = isset( $_GET['id'] ) ? absint( $_GET['id'] ) : 0; // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		$index    = isset( $_GET['file'] ) ? absint( $_GET['file'] ) : 0; // phpcs:ignore WordPress.Security.NonceVerification.Recommended

		check_admin_referer( 'mkl_pc_quote_file_' . $store_id . '_' . $id );

		$stores = mkl_pc( 'quotes' )->get_stores();
		$store = isset( $stores[ $store_id ] ) ? $stores[ $store_id ] : null;
		if ( ! $store || ! $store->is_persistent() || ! $store->user_can_view( $id ) ) {
			wp_die( esc_html__( 'Sorry, you are not allowed to access this file.', 'product-configurator-for-woocommerce' ), '', [ 'response' => 403 ] );
		}

		$files = $store->get_files( $id );
		$file = isset( $files[ $index ] ) ? $files[ $index ] : null;
		$base = $this->get_base_dir() . '/';
		if ( ! $file || false !== strpos( $file['path'], '..' ) || 0 !== strpos( $file['path'], $base ) || ! is_file( $file['path'] ) ) {
			wp_die( esc_html__( 'The file was not found.', 'product-configurator-for-woocommerce' ), '', [ 'response' => 404 ] );
		}

		nocache_headers();
		header( 'Content-Type: application/octet-stream' );
		header( 'Content-Disposition: attachment; filename="' . rawurlencode( $file['name'] ) . '"; filename*=UTF-8\'\'' . rawurlencode( $file['name'] ) );
		header( 'Content-Length: ' . filesize( $file['path'] ) );
		readfile( $file['path'] ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_readfile
		exit;
	}

	/**
	 * List of a request's files, with download links when it is stored
	 *
	 * @param Quote_Request $request
	 * @param boolean       $links   False in emails: the links only work for the user who displayed them.
	 * @return void
	 */
	public function render_list( Quote_Request $request, $links = true ) {
		if ( empty( $request->files ) ) return;
		echo '<div class="mkl-pc-quote-files"><p><strong>' . esc_html__( 'Files sent:', 'product-configurator-for-woocommerce' ) . '</strong></p><ul>';
		foreach ( $request->files as $index => $file ) {
			$name = esc_html( $file['name'] );
			$url = $links ? $this->get_download_url( $request, $index ) : '';
			echo '<li>';
			if ( $file['label'] ) echo esc_html( $file['label'] ) . ': ';
			echo $url ? '<a href="' . esc_url( $url ) . '">' . $name . '</a>' : $name; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Escaped above.
			echo ' <span class="mkl-pc-quote-file-size">(' . esc_html( size_format( (int) $file['size'] ) ) . ')</span>';
			echo '</li>';
		}
		echo '</ul></div>';
	}

	/**
	 * @return string
	 */
	public function get_base_dir() {
		return wp_upload_dir()['basedir'] . '/' . self::FOLDER;
	}

	/**
	 * Keep the folder from being listed or served by Apache. Other servers rely on the random folder names.
	 *
	 * @param string $dir
	 * @return void
	 */
	private function protect( $dir ) {
		if ( ! is_file( $dir . '/index.html' ) ) @file_put_contents( $dir . '/index.html', '' ); // phpcs:ignore
		if ( ! is_file( $dir . '/.htaccess' ) ) @file_put_contents( $dir . '/.htaccess', "deny from all\n" ); // phpcs:ignore
	}
}
