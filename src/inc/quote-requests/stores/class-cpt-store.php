<?php
namespace MKL\PC;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Quote requests kept as posts of their own (mkl_pc_quote)
 *
 * Works without WooCommerce. Everything needed to show the request again is stored with it: the raw
 * configuration, a frozen summary (as orders keep theirs), the form values and the labels they were
 * given at the time.
 *
 * Post meta goes through update_post_meta(), which unslashes: JSON and arrays are slashed first, or
 * a backslash or an escaped quote in a customer's text would be lost.
 */
class CPT_Store implements Quote_Store {

	const POST_TYPE = 'mkl_pc_quote';

	const FOLDER = 'quote-requests';

	public function __construct() {
		add_action( 'init', [ $this, 'register' ] );
		add_action( 'before_delete_post', [ $this, 'delete_files' ], 10, 2 );
	}

	public function get_id() {
		return 'cpt';
	}

	public function get_label() {
		return __( 'Sent by email and kept in Product Configurator > Quote requests', 'product-configurator-for-woocommerce' );
	}

	public function is_available() {
		return true;
	}

	public function is_persistent() {
		return true;
	}

	public function get_files_folder() {
		return self::FOLDER;
	}

	/**
	 * Statuses of a request, keyed by post status
	 *
	 * @return array
	 */
	public static function get_statuses() {
		return [
			'mkl_quote_new'      => _x( 'New', 'Quote request status', 'product-configurator-for-woocommerce' ),
			'mkl_quote_progress' => _x( 'In progress', 'Quote request status', 'product-configurator-for-woocommerce' ),
			'mkl_quote_answered' => _x( 'Answered', 'Quote request status', 'product-configurator-for-woocommerce' ),
			'mkl_quote_closed'   => _x( 'Closed', 'Quote request status', 'product-configurator-for-woocommerce' ),
		];
	}

	/**
	 * Counts shown in the list's status links
	 *
	 * @return array
	 */
	private static function get_status_label_counts() {
		return [
			/* translators: %s: number of quote requests */
			'mkl_quote_new'      => _n_noop( 'New <span class="count">(%s)</span>', 'New <span class="count">(%s)</span>', 'product-configurator-for-woocommerce' ),
			/* translators: %s: number of quote requests */
			'mkl_quote_progress' => _n_noop( 'In progress <span class="count">(%s)</span>', 'In progress <span class="count">(%s)</span>', 'product-configurator-for-woocommerce' ),
			/* translators: %s: number of quote requests */
			'mkl_quote_answered' => _n_noop( 'Answered <span class="count">(%s)</span>', 'Answered <span class="count">(%s)</span>', 'product-configurator-for-woocommerce' ),
			/* translators: %s: number of quote requests */
			'mkl_quote_closed'   => _n_noop( 'Closed <span class="count">(%s)</span>', 'Closed <span class="count">(%s)</span>', 'product-configurator-for-woocommerce' ),
		];
	}

	/**
	 * Register the post type and its statuses
	 *
	 * @return void
	 */
	public function register() {
		$cap = mkl_pc_get_admin_menu_capability();
		register_post_type( self::POST_TYPE, [
			'labels'              => [
				'name'               => __( 'Quote requests', 'product-configurator-for-woocommerce' ),
				'singular_name'      => __( 'Quote request', 'product-configurator-for-woocommerce' ),
				'menu_name'          => __( 'Quote requests', 'product-configurator-for-woocommerce' ),
				'all_items'          => __( 'Quote requests', 'product-configurator-for-woocommerce' ),
				'edit_item'          => __( 'Quote request', 'product-configurator-for-woocommerce' ),
				'view_item'          => __( 'View quote request', 'product-configurator-for-woocommerce' ),
				'search_items'       => __( 'Search quote requests', 'product-configurator-for-woocommerce' ),
				'not_found'          => __( 'No quote requests found.', 'product-configurator-for-woocommerce' ),
				'not_found_in_trash' => __( 'No quote requests found in trash.', 'product-configurator-for-woocommerce' ),
			],
			'public'              => false,
			'show_ui'             => true,
			'show_in_menu'        => mkl_pc_get_admin_menu_slug(),
			'show_in_admin_bar'   => false,
			'show_in_nav_menus'   => false,
			'show_in_rest'        => false,
			'publicly_queryable'  => false,
			'exclude_from_search' => true,
			'hierarchical'        => false,
			'has_archive'         => false,
			'rewrite'             => false,
			'query_var'           => false,
			'supports'            => false,
			'map_meta_cap'        => true,
			'capabilities'        => [
				'create_posts'           => 'do_not_allow',
				'edit_posts'             => $cap,
				'edit_others_posts'      => $cap,
				'edit_published_posts'   => $cap,
				'edit_private_posts'     => $cap,
				'publish_posts'          => $cap,
				'read_private_posts'     => $cap,
				'delete_posts'           => $cap,
				'delete_others_posts'    => $cap,
				'delete_published_posts' => $cap,
				'delete_private_posts'   => $cap,
			],
		] );

		$label_counts = self::get_status_label_counts();
		foreach ( self::get_statuses() as $status => $label ) {
			register_post_status( $status, [
				'label'                     => $label,
				'public'                    => false,
				'internal'                  => false,
				'protected'                 => true,
				'exclude_from_search'       => true,
				'show_in_admin_all_list'    => true,
				'show_in_admin_status_list' => true,
				'label_count'               => $label_counts[ $status ],
			] );
		}
	}

	/**
	 * Keep the request as a post
	 *
	 * @param Quote_Request $request
	 * @return true|\WP_Error
	 */
	public function save( Quote_Request $request ) {
		$post_id = wp_insert_post( [
			'post_type'   => self::POST_TYPE,
			'post_status' => 'mkl_quote_new',
			'post_title'  => $request->reference,
			'post_author' => $request->user_id,
			'post_date'   => wp_date( 'Y-m-d H:i:s', $request->created ),
		], true );
		if ( is_wp_error( $post_id ) ) return $post_id;

		$definitions = [];
		foreach ( $request->field_definitions as $field_id => $field ) {
			$definitions[ $field_id ] = [
				'label'   => $field['label'],
				'type'    => $field['type'],
				'options' => $field['options'],
			];
		}
		$summary = [];
		foreach ( $request->get_summary() as $row ) {
			$summary[] = [
				'label' => (string) $row['label'],
				'value' => (string) $row['value'],
			];
		}
		$meta = [
			'_mkl_pc_quote_reference'         => $request->reference,
			'_mkl_pc_quote_email'             => $request->get_email(),
			'_mkl_pc_quote_configurator_id'   => $request->configurator_id,
			'_mkl_pc_quote_product_id'        => $request->product_id,
			'_mkl_pc_quote_variation_id'      => $request->variation_id,
			'_mkl_pc_quote_quantity'          => $request->quantity,
			'_mkl_pc_quote_configuration'     => $request->configuration_raw,
			'_mkl_pc_quote_summary'           => $summary,
			'_mkl_pc_quote_fields'            => $request->fields,
			'_mkl_pc_quote_field_definitions' => $definitions,
			'_mkl_pc_quote_price'             => $request->price,
			'_mkl_pc_quote_image'             => self::to_relative_path( $request->image_path ),
			'_mkl_pc_quote_owns_image'        => ! empty( $request->meta['owns_image'] ),
			'_mkl_pc_quote_lang'              => $request->lang,
			'_mkl_pc_quote_meta'              => array_diff_key( $request->meta, [ 'owns_image' => 1, 'image_data_url' => 1 ] ),
		];
		foreach ( $meta as $key => $value ) {
			update_post_meta( $post_id, $key, wp_slash( $value ) );
		}

		$request->id = $post_id;
		return true;
	}

	/**
	 * Read a stored request back
	 *
	 * The configuration is rebuilt with its choices marked as stored, so they resolve from what was
	 * saved rather than from the configurator as it is today.
	 *
	 * @param int $post_id
	 * @return Quote_Request|null
	 */
	public function load( $post_id ) {
		$post = get_post( $post_id );
		if ( ! $post || self::POST_TYPE !== $post->post_type ) return null;

		$get = function( $key, $default = '' ) use ( $post_id ) {
			$value = get_post_meta( $post_id, '_mkl_pc_quote_' . $key, true );
			return '' === $value || null === $value ? $default : $value;
		};

		$request = new Quote_Request();
		$request->id                = $post->ID;
		$request->store             = $this->get_id();
		$request->reference         = $get( 'reference', $post->post_title );
		$request->configurator_id   = (int) $get( 'configurator_id', 0 );
		$request->product_id        = (int) $get( 'product_id', 0 );
		$request->variation_id      = (int) $get( 'variation_id', 0 );
		$request->quantity          = max( 1, (int) $get( 'quantity', 1 ) );
		$request->configuration_raw = (string) $get( 'configuration' );
		$request->fields            = (array) $get( 'fields', [] );
		$request->price             = $get( 'price', null );
		$request->lang              = (string) $get( 'lang' );
		$request->user_id           = (int) $post->post_author;
		$request->created           = (int) get_post_time( 'U', true, $post );
		$request->meta              = (array) $get( 'meta', [] );
		$request->summary           = (array) $get( 'summary', [] );

		foreach ( (array) $get( 'field_definitions', [] ) as $field_id => $field ) {
			$request->field_definitions[ $field_id ] = wp_parse_args( $field, [ 'label' => $field_id, 'type' => 'text', 'options' => [] ] );
		}

		$image = (string) $get( 'image' );
		if ( $image ) {
			$uploads = wp_upload_dir();
			$request->image_path = $uploads['basedir'] . '/' . $image;
			$request->image_url  = $uploads['baseurl'] . '/' . $image;
			$request->meta['owns_image'] = (bool) $get( 'owns_image', false );
		}

		$content = Utils::decode_configurator_payload( $request->configuration_raw );
		if ( is_array( $content ) && ! empty( $content ) ) {
			$request->configuration = new Configuration( null, [
				'product_id'   => $request->product_id,
				'variation_id' => $request->variation_id,
				'content'      => $content,
			] );
			foreach ( $request->configuration->get_layers() as $choice ) {
				if ( is_callable( [ $choice, 'set_source' ] ) ) $choice->set_source( Choice::SOURCE_STORED );
			}
		}

		return $request;
	}

	public function get_admin_url( Quote_Request $request ) {
		// Not get_edit_post_link(): it is empty for the visitor whose request builds the email.
		return $request->id ? admin_url( 'post.php?post=' . (int) $request->id . '&action=edit' ) : '';
	}

	/**
	 * Delete the files a request owns when it is deleted for good
	 *
	 * Only the 3D capture belongs to the request: a 2D merged image is shared by every identical
	 * configuration. Add-ons list their own files in the request's meta, under `files`.
	 *
	 * @param int      $post_id
	 * @param \WP_Post $post
	 * @return void
	 */
	public function delete_files( $post_id, $post = null ) {
		$post = $post ? $post : get_post( $post_id );
		if ( ! $post || self::POST_TYPE !== $post->post_type ) return;

		$files = [];
		if ( get_post_meta( $post_id, '_mkl_pc_quote_owns_image', true ) ) {
			$files[] = (string) get_post_meta( $post_id, '_mkl_pc_quote_image', true );
		}
		$meta = get_post_meta( $post_id, '_mkl_pc_quote_meta', true );
		if ( is_array( $meta ) && ! empty( $meta['files'] ) && is_array( $meta['files'] ) ) {
			$files = array_merge( $files, $meta['files'] );
		}

		$base = wp_upload_dir()['basedir'] . '/mkl-pc-config-images/' . self::FOLDER . '/';
		foreach ( $files as $relative ) {
			$path = wp_upload_dir()['basedir'] . '/' . ltrim( (string) $relative, '/' );
			// Never outside the request folder, whatever the meta says.
			if ( ! $relative || false !== strpos( $relative, '..' ) || 0 !== strpos( $path, $base ) ) continue;
			if ( is_file( $path ) ) wp_delete_file( $path );
		}
	}

	/**
	 * Path relative to the uploads folder, or '' when the file is elsewhere
	 *
	 * @param string $path
	 * @return string
	 */
	public static function to_relative_path( $path ) {
		if ( ! $path ) return '';
		$base = trailingslashit( wp_upload_dir()['basedir'] );
		return 0 === strpos( $path, $base ) ? substr( $path, strlen( $base ) ) : '';
	}
}
