<?php
/**
 * Admin-side UI: General tab source selector + picker + home-tab warnings + AJAX + actions.
 *
 * @package MKL\PC\Global_Configurators
 */

namespace MKL\PC\Global_Configurators;

defined( 'ABSPATH' ) || exit;

/**
 * General tab controls, home-tab warnings, picker search, and turn-into-global / make-local actions.
 */
final class Admin_Ui {

	/** @var bool */
	private static $did_init = false;

	/**
	 * @return void
	 */
	public static function init() {
		if ( self::$did_init ) {
			return;
		}
		self::$did_init = true;

		add_action( 'mkl_pc_admin_general_tab_before_start_button', array( __CLASS__, 'render_general_tab_controls' ), 20 );
		add_action( 'woocommerce_process_product_meta_simple', array( __CLASS__, 'save_product_settings' ) );
		add_action( 'woocommerce_process_product_meta_variable', array( __CLASS__, 'save_product_settings' ) );

		add_action( 'mkl_pc_admin_global_configurator_content', array( __CLASS__, 'render_home_global_notice' ), 10, 2 );
		add_action( 'woocommerce_product_options_general_product_data', array( __CLASS__, 'render_product_assignment_notice' ) );

		add_action( 'add_meta_boxes', array( __CLASS__, 'add_apply_meta_box' ) );
		add_action( 'save_post_' . Schema::CPT_SLUG, array( __CLASS__, 'save_apply_settings' ), 10, 2 );
		add_action( 'admin_notices', array( __CLASS__, 'render_apply_notices' ) );

		add_action( 'wp_ajax_mkl_pc_search_global_configurators', array( __CLASS__, 'ajax_search_global_configurators' ) );
		add_action( 'wp_ajax_mkl_pc_create_global_from_product', array( __CLASS__, 'ajax_create_global_from_product' ) );
		add_action( 'wp_ajax_mkl_pc_link_product_to_global', array( __CLASS__, 'ajax_link_product_to_global' ) );
		add_action( 'wp_ajax_mkl_pc_discard_global_configurator', array( __CLASS__, 'ajax_discard_global_configurator' ) );
		add_action( 'wp_ajax_mkl_pc_delete_local_configurator_data', array( __CLASS__, 'ajax_delete_local_configurator_data' ) );
		add_action( 'wp_ajax_mkl_pc_make_local_copy', array( __CLASS__, 'ajax_make_local_copy' ) );

		add_action( 'mkl_pc_admin_scripts_product_page', array( __CLASS__, 'enqueue_assets' ) );
		add_action( 'admin_enqueue_scripts', array( __CLASS__, 'enqueue_cpt_apply_assets' ), 20 );
		add_filter( 'PC_lang', array( __CLASS__, 'filter_pc_lang' ), 30, 1 );
	}

	/**
	 * Decode entity sequences in a post title so the UI shows real apostrophes, quotes, etc.
	 * Some sources store e.g. &#8217; literally in post_title; a second pass covers &amp;#8217;.
	 *
	 * @param string $title Title from get_the_title or post_title.
	 * @return string
	 */
	private static function decode_post_title( $title ) {
		if ( '' === $title || null === $title ) {
			return '';
		}
		$s   = (string) $title;
		$out = $s;
		// Up to 2 passes: &#8217; and double-encoded &amp;#8217;.
		for ( $i = 0; $i < 2; $i++ ) {
			$next = html_entity_decode( $out, ENT_QUOTES | ENT_HTML5, 'UTF-8' );
			if ( $next === $out ) {
				break;
			}
			$out = $next;
		}
		return $out;
	}

	/**
	 * Add source selector + picker to the Configurator product data tab.
	 *
	 * @return void
	 */
	public static function render_general_tab_controls() {
		global $post;
		if ( ! $post || ! isset( $post->ID ) ) {
			return;
		}
		$product_id = (int) $post->ID;

		$current_source    = get_post_meta( $product_id, Schema::META_SOURCE, true );
		if ( Schema::SOURCE_GLOBAL !== $current_source ) {
			$current_source = Schema::SOURCE_LOCAL;
		}
		$current_global_id = (int) get_post_meta( $product_id, Schema::META_GLOBAL_ID, true );
		$can_use_global    = Owner_Resolver::can_use_global( $product_id );
		$global_title      = $current_global_id > 0 ? self::decode_post_title( get_the_title( $current_global_id ) ) : '';

		$nonce         = wp_create_nonce( 'mkl_pc_global_configurators_admin_' . $product_id );
		$picker_class  = 'mkl-pc-global-picker';
		$picker_class .= ( $current_global_id > 0 ? ' mkl-pc-global-picker--has-value' : ' mkl-pc-global-picker--no-value' );
		?>
		<div class="options_group mkl-pc-configurator-source-group">
			<p class="form-field mkl-pc-configurator-source-field">
				<label for="mkl_pc_configurator_source"><?php esc_html_e( 'Configurator source', 'product-configurator-for-woocommerce' ); ?></label>
				<select id="mkl_pc_configurator_source" name="<?php echo esc_attr( Schema::META_SOURCE ); ?>" class="mkl-pc-configurator-source" <?php disabled( ! $can_use_global && Schema::SOURCE_LOCAL === $current_source ); ?>>
					<option value="<?php echo esc_attr( Schema::SOURCE_LOCAL ); ?>" <?php selected( $current_source, Schema::SOURCE_LOCAL ); ?>><?php esc_html_e( 'Local (this product owns its configurator)', 'product-configurator-for-woocommerce' ); ?></option>
					<option value="<?php echo esc_attr( Schema::SOURCE_GLOBAL ); ?>" <?php selected( $current_source, Schema::SOURCE_GLOBAL ); ?> <?php disabled( ! $can_use_global ); ?>><?php esc_html_e( 'Global (use a shared configurator)', 'product-configurator-for-woocommerce' ); ?></option>
				</select>
				<span class="description"><?php esc_html_e( 'A global configurator is a shared post that multiple products can point to. Changes to it affect all linked products.', 'product-configurator-for-woocommerce' ); ?></span>
			</p>

			<?php if ( ! $can_use_global ) : ?>
				<p class="form-field mkl-pc-configurator-source-warning">
					<span class="description notice notice-warning inline">
						<?php esc_html_e( 'Global configurators are not available on variable products unless "Variations share the same configuration" is selected.', 'product-configurator-for-woocommerce' ); ?>
					</span>
				</p>
			<?php endif; ?>

			<div class="form-field mkl-pc-configurator-picker-field" data-show-when-source="<?php echo esc_attr( Schema::SOURCE_GLOBAL ); ?>">
				<span class="mkl-pc-global-configurator-label"><?php esc_html_e( 'Global configurator', 'product-configurator-for-woocommerce' ); ?></span>
				<div class="<?php echo esc_attr( $picker_class ); ?>"
					data-product-id="<?php echo esc_attr( (string) $product_id ); ?>"
					data-nonce="<?php echo esc_attr( $nonce ); ?>"
					data-current-id="<?php echo esc_attr( (string) $current_global_id ); ?>"
					data-current-title="<?php echo esc_attr( $global_title ); ?>">
					<input type="hidden" id="mkl_pc_global_configurator_id" name="<?php echo esc_attr( Schema::META_GLOBAL_ID ); ?>" value="<?php echo esc_attr( (string) $current_global_id ); ?>">
					<div class="mkl-pc-global-picker-search-wrap">
						<input type="text" id="mkl_pc_global_picker_search" class="mkl-pc-global-picker-search" placeholder="<?php esc_attr_e( 'Search global configurators…', 'product-configurator-for-woocommerce' ); ?>" autocomplete="off" <?php disabled( ! $can_use_global ); ?>>
						<ul class="mkl-pc-global-picker-results" role="listbox" aria-hidden="true"></ul>
					</div>
					<div class="mkl-pc-global-picker-summary">
						<span class="mkl-pc-global-picker-selected">
							<?php if ( $current_global_id > 0 ) : ?>
								<strong><?php echo esc_html( $global_title ); ?></strong> <?php echo esc_html( ' (#' . (string) $current_global_id . ') ' ); ?>
								<a class="mkl-pc-global-picker-edit" href="<?php echo esc_url( get_edit_post_link( $current_global_id ) ); ?>" target="_blank" rel="noopener noreferrer"><?php esc_html_e( 'Edit', 'product-configurator-for-woocommerce' ); ?></a>
							<?php endif; ?>
						</span>
						<button type="button" class="button mkl-pc-global-picker-change" <?php disabled( ! $can_use_global ); ?>>
							<?php esc_html_e( 'Change', 'product-configurator-for-woocommerce' ); ?>
						</button>
					</div>
				</div>
			</div>
		</div>
		<?php
	}

	/**
	 * Persist the source + linked CPT id on product save. Validates allowed transitions.
	 *
	 * @param int $product_id
	 * @return void
	 */
	public static function save_product_settings( $product_id ) {
		$product_id = (int) $product_id;
		if ( $product_id <= 0 ) {
			return;
		}
		if ( ! current_user_can( 'edit_post', $product_id ) ) {
			return;
		}

		$posted_source = isset( $_POST[ Schema::META_SOURCE ] ) ? sanitize_key( wp_unslash( $_POST[ Schema::META_SOURCE ] ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Missing -- WooCommerce verifies the product save nonce before woocommerce_process_product_meta_*.
		$posted_id     = isset( $_POST[ Schema::META_GLOBAL_ID ] ) ? absint( wp_unslash( $_POST[ Schema::META_GLOBAL_ID ] ) ) : 0; // phpcs:ignore WordPress.Security.NonceVerification.Missing -- Same WooCommerce product-save nonce as above.

		$previous_source    = get_post_meta( $product_id, Schema::META_SOURCE, true );
		$previous_global_id = (int) get_post_meta( $product_id, Schema::META_GLOBAL_ID, true );

		if ( Schema::SOURCE_GLOBAL === $posted_source && Owner_Resolver::can_use_global( $product_id ) && $posted_id > 0 && Schema::is_global_configurator_id( $posted_id ) ) {
			update_post_meta( $product_id, Schema::META_SOURCE, Schema::SOURCE_GLOBAL );
			update_post_meta( $product_id, Schema::META_GLOBAL_ID, $posted_id );
			if ( $previous_global_id !== $posted_id ) {
				Owner_Resolver::invalidate_consumers_cache( $posted_id );
				if ( $previous_global_id > 0 ) {
					Owner_Resolver::invalidate_consumers_cache( $previous_global_id );
				}
			}
			do_action( 'mkl_pc/global_configurators/source_changed', $product_id, $posted_id, $previous_source );
			return;
		}

		update_post_meta( $product_id, Schema::META_SOURCE, Schema::SOURCE_LOCAL );
		delete_post_meta( $product_id, Schema::META_GLOBAL_ID );
		if ( $previous_global_id > 0 ) {
			Owner_Resolver::invalidate_consumers_cache( $previous_global_id );
		}
		if ( Schema::SOURCE_LOCAL !== $previous_source ) {
			do_action( 'mkl_pc/global_configurators/source_changed', $product_id, 0, $previous_source );
		}
	}

	/**
	 * Home-tab content inside the configurator editor.
	 *
	 * Renders persistent notices and the conversion action buttons:
	 *  - CPT screen: read-only "you are editing a global" notice, no buttons.
	 *  - Product in global mode: warning about shared data + "Make local copy" button.
	 *  - Product in local mode: "Turn into global configurator" button (if eligible).
	 *
	 * @param int              $post_id
	 * @param \WC_Product|null $product
	 * @return void
	 */
	public static function render_home_global_notice( $post_id, $product = null ) {
		$post_id = (int) $post_id;
		if ( $post_id <= 0 ) {
			return;
		}

		if ( Schema::is_global_configurator_id( $post_id ) ) {
			$consumer_count = Owner_Resolver::count_consumer_products( $post_id );
			?>
			<div class="notice notice-info mkl-pc-global-editor-notice mkl-home-section">
				<p><strong><?php esc_html_e( 'You are editing a global configurator.', 'product-configurator-for-woocommerce' ); ?></strong></p>
				<p>
					<?php
					printf(
						/* translators: %d: number of products using this global configurator. */
						esc_html( _n(
							'Changes will affect the %d product currently using this configurator.',
							'Changes will affect the %d products currently using this configurator.',
							max( 1, $consumer_count ),
							'product-configurator-for-woocommerce'
						) ),
						(int) $consumer_count
					);
					?>
				</p>
			</div>
			<?php
			return;
		}

		$nonce     = wp_create_nonce( 'mkl_pc_global_configurators_admin_' . $post_id );
		$global_id = Owner_Resolver::get_global_id( $post_id );

		if ( $global_id > 0 ) {
			?>
			<div class="mkl-pc-global-editor-notice mkl-home-section">
				<p>
					<strong><?php esc_html_e( 'This product uses a shared global configurator.', 'product-configurator-for-woocommerce' ); ?></strong>
				</p>
				<p>
					<?php esc_html_e( 'Any changes you make to the global configurator will affect every product using it.', 'product-configurator-for-woocommerce' ); ?>
					<?php
					// printf(
					// 	/* translators: %s: global configurator title linked to its edit screen. */
					// 	esc_html__( 'Open %s to edit shared data that affects every product using this configurator.', 'product-configurator-for-woocommerce' ),
					// 	'<a href="' . esc_url( get_edit_post_link( $global_id ) ) . '" target="_blank"><strong>' . esc_html( get_the_title( $global_id ) ) . '</strong></a>'
					// );
					?>
				</p>
				<p class="mkl-pc-home-tab-actions">
					<button type="button" class="button mkl-pc-make-local-copy"
						data-product-id="<?php echo esc_attr( (string) $post_id ); ?>"
						data-nonce="<?php echo esc_attr( $nonce ); ?>">
						<?php esc_html_e( 'Make local copy', 'product-configurator-for-woocommerce' ); ?>
					</button>
					<span class="description">
						<?php esc_html_e( 'Unlinks this product and copies the global data onto it so you can edit it independently.', 'product-configurator-for-woocommerce' ); ?>
					</span>
				</p>
			</div>
			<?php
			self::render_local_data_leftover_notice( $post_id, $nonce );
			return;
		}

		if ( ! Owner_Resolver::can_use_global( $post_id ) ) {
			return;
		}
		?>
		<div class="mkl-pc-home-tab-actions mkl-pc-home-tab-actions--local mkl-home-section">
			<p class="description">
				<?php esc_html_e( 'Want to reuse this configurator across multiple products?', 'product-configurator-for-woocommerce' ); ?>
			</p>
			<p>
				<button type="button" class="button mkl-pc-turn-into-global"
					data-product-id="<?php echo esc_attr( (string) $post_id ); ?>"
					data-nonce="<?php echo esc_attr( $nonce ); ?>">
					<?php esc_html_e( 'Turn into global configurator', 'product-configurator-for-woocommerce' ); ?>
				</button>
			</p>
		</div>
		<?php
	}

	/**
	 * Notice offering to delete the configurator data a linked product still holds.
	 *
	 * Turning a product into a global configurator copies its data up and leaves the original in
	 * place: the link alone decides which one is read, so the copy is dormant rather than
	 * conflicting, and keeping it means an unlink puts the product back the way it was. It is
	 * only worth removing once the shared configurator has been checked, which is a decision for
	 * whoever did the conversion - hence a button rather than an automatic cleanup.
	 *
	 * @param int    $product_id
	 * @param string $nonce Conversion nonce for this product.
	 * @return void
	 */
	private static function render_local_data_leftover_notice( $product_id, $nonce ) {
		$product = Storage_Owner::for_post( $product_id );
		if ( ! $product || ! Data_Copier::has_local_configurator_data( $product ) ) {
			return;
		}
		?>
		<div class="mkl-pc-data-migration migration-warning mkl-home-section">
			<div class="notice notice-warning mkl-pc-local-data-notice">
				<p>
					<strong><?php esc_html_e( 'This product still has its own configurator data.', 'product-configurator-for-woocommerce' ); ?></strong>
				</p>
				<p>
					<?php esc_html_e( 'It is not used while the product is linked to a global configurator, and it is what the product falls back to if you unlink it. Delete it once you have checked that the global configurator is correct.', 'product-configurator-for-woocommerce' ); ?>
				</p>
				<p>
					<button type="button" class="button button-secondary mkl-pc-delete-local-config"
						data-product-id="<?php echo esc_attr( (string) $product_id ); ?>"
						data-nonce="<?php echo esc_attr( $nonce ); ?>">
						<?php esc_html_e( 'Delete local configurator data', 'product-configurator-for-woocommerce' ); ?>
					</button>
				</p>
			</div>
		</div>
		<?php
	}

	/**
	 * Autocomplete endpoint for the picker.
	 *
	 * @return void
	 */
	public static function ajax_search_global_configurators() {
		if ( ! isset( $_REQUEST['nonce'], $_REQUEST['product_id'] ) ) {
			wp_send_json_error( array( 'message' => __( 'Missing parameters.', 'product-configurator-for-woocommerce' ) ), 400 );
		}
		$product_id = absint( $_REQUEST['product_id'] );
		if ( ! check_ajax_referer( 'mkl_pc_global_configurators_admin_' . $product_id, 'nonce', false ) ) {
			wp_send_json_error( array( 'message' => __( 'Session expired.', 'product-configurator-for-woocommerce' ) ), 403 );
		}
		if ( ! current_user_can( 'edit_post', $product_id ) ) {
			wp_send_json_error( array( 'message' => __( 'Not allowed.', 'product-configurator-for-woocommerce' ) ), 403 );
		}
		$q = isset( $_REQUEST['q'] ) ? sanitize_text_field( wp_unslash( $_REQUEST['q'] ) ) : '';

		$query = new \WP_Query(
			array(
				'post_type'      => Schema::CPT_SLUG,
				'post_status'    => array( 'publish', 'private' ),
				'posts_per_page' => 20,
				's'              => $q,
				'no_found_rows'  => true,
				'fields'         => 'ids',
			)
		);
		$items = array();
		if ( ! empty( $query->posts ) ) {
			foreach ( $query->posts as $pid ) {
				$pid = (int) $pid;
				$items[] = array(
					'id'             => $pid,
					'title'          => self::decode_post_title( get_the_title( $pid ) ),
					'consumer_count' => Owner_Resolver::count_consumer_products( $pid ),
					'edit_url'       => get_edit_post_link( $pid, 'raw' ),
				);
			}
		}
		wp_send_json_success( array( 'items' => $items ) );
	}

	/**
	 * Shared request guard for the conversion endpoints.
	 *
	 * @param int $product_id
	 * @return void Sends a JSON error and exits when the request may not proceed.
	 */
	private static function require_conversion_access( $product_id ) {
		if ( ! check_ajax_referer( 'mkl_pc_global_configurators_admin_' . $product_id, 'nonce', false ) ) {
			wp_send_json_error( array( 'message' => __( 'Session expired.', 'product-configurator-for-woocommerce' ) ), 403 );
		}
		if ( ! current_user_can( 'edit_post', $product_id ) || ! current_user_can( 'edit_posts' ) ) {
			wp_send_json_error( array( 'message' => __( 'Not allowed.', 'product-configurator-for-woocommerce' ) ), 403 );
		}
	}

	/**
	 * Step 1 of turning a product into a global configurator: create the empty post.
	 *
	 * The configuration itself is not copied here. The editor already holds it in memory and
	 * uploads it to the new post in the same chunked batches a normal save uses, so a large
	 * configurator is not pushed through one request that can hit post_max_size or a proxy
	 * timeout, and the user gets progress instead of a stalled spinner. The product is linked
	 * only once that upload succeeds - see {@see self::ajax_link_product_to_global()}.
	 *
	 * @return void
	 */
	public static function ajax_create_global_from_product() {
		if ( ! isset( $_REQUEST['nonce'], $_REQUEST['product_id'] ) ) {
			wp_send_json_error( array( 'message' => __( 'Missing parameters.', 'product-configurator-for-woocommerce' ) ), 400 );
		}
		$product_id = absint( $_REQUEST['product_id'] );
		self::require_conversion_access( $product_id );
		if ( ! Owner_Resolver::can_use_global( $product_id ) ) {
			wp_send_json_error( array( 'message' => __( 'This product cannot use a global configurator.', 'product-configurator-for-woocommerce' ) ), 400 );
		}
		if ( Owner_Resolver::get_global_id( $product_id ) > 0 ) {
			wp_send_json_error( array( 'message' => __( 'This product already uses a global configurator.', 'product-configurator-for-woocommerce' ) ), 400 );
		}
		$title  = isset( $_REQUEST['title'] ) ? sanitize_text_field( wp_unslash( $_REQUEST['title'] ) ) : '';
		$new_id = Data_Copier::create_global_from_product( $product_id, $title, false );
		if ( is_wp_error( $new_id ) ) {
			wp_send_json_error( array( 'message' => $new_id->get_error_message() ), 400 );
		}
		$new_id = (int) $new_id;

		wp_send_json_success(
			array(
				'global_id'    => $new_id,
				'global_title' => self::decode_post_title( get_the_title( $new_id ) ),
				'edit_url'     => get_edit_post_link( $new_id, 'raw' ),
				// The editor saves to the new post through the normal configurator-data endpoint,
				// which checks a nonce bound to the post being written.
				'save_nonce'   => wp_create_nonce( 'update-pc-post_' . $new_id ),
			)
		);
	}

	/**
	 * Step 2: point the product at the global configurator once its data is uploaded.
	 *
	 * The product keeps its own configurator rows. They are unreachable while the link is in
	 * place, and deleting them is left to an explicit action on the home tab so a conversion
	 * that turns out wrong can be undone by unlinking.
	 *
	 * @return void
	 */
	public static function ajax_link_product_to_global() {
		if ( ! isset( $_REQUEST['nonce'], $_REQUEST['product_id'], $_REQUEST['global_id'] ) ) {
			wp_send_json_error( array( 'message' => __( 'Missing parameters.', 'product-configurator-for-woocommerce' ) ), 400 );
		}
		$product_id = absint( $_REQUEST['product_id'] );
		$global_id  = absint( $_REQUEST['global_id'] );
		self::require_conversion_access( $product_id );
		if ( ! current_user_can( 'edit_post', $global_id ) ) {
			wp_send_json_error( array( 'message' => __( 'Not allowed.', 'product-configurator-for-woocommerce' ) ), 403 );
		}

		$linked = Data_Copier::link_product_to_global( $product_id, $global_id, false );
		if ( is_wp_error( $linked ) ) {
			wp_send_json_error( array( 'message' => $linked->get_error_message() ), 400 );
		}
		wp_send_json_success(
			array(
				'global_id'    => $global_id,
				'global_title' => self::decode_post_title( get_the_title( $global_id ) ),
				'edit_url'     => get_edit_post_link( $global_id, 'raw' ),
			)
		);
	}

	/**
	 * Remove a global configurator created by a conversion that then failed part-way.
	 *
	 * Refuses anything another product already points at, so a mis-sent id cannot take out a
	 * configurator that is in use.
	 *
	 * @return void
	 */
	public static function ajax_discard_global_configurator() {
		if ( ! isset( $_REQUEST['nonce'], $_REQUEST['product_id'], $_REQUEST['global_id'] ) ) {
			wp_send_json_error( array( 'message' => __( 'Missing parameters.', 'product-configurator-for-woocommerce' ) ), 400 );
		}
		$product_id = absint( $_REQUEST['product_id'] );
		$global_id  = absint( $_REQUEST['global_id'] );
		self::require_conversion_access( $product_id );
		if ( ! Schema::is_global_configurator_id( $global_id ) || ! current_user_can( 'delete_post', $global_id ) ) {
			wp_send_json_error( array( 'message' => __( 'Not allowed.', 'product-configurator-for-woocommerce' ) ), 403 );
		}
		if ( Owner_Resolver::count_consumer_products( $global_id ) > 0 ) {
			wp_send_json_error( array( 'message' => __( 'This global configurator is in use and was not deleted.', 'product-configurator-for-woocommerce' ) ), 400 );
		}
		wp_delete_post( $global_id, true );
		wp_send_json_success();
	}

	/**
	 * Delete the configurator data a product still holds after being linked to a global one.
	 *
	 * Only ever runs on a product that is currently reading from a global configurator, so the
	 * rows being removed are the unreachable copy and not the configuration in use.
	 *
	 * @return void
	 */
	public static function ajax_delete_local_configurator_data() {
		if ( ! isset( $_REQUEST['nonce'], $_REQUEST['product_id'] ) ) {
			wp_send_json_error( array( 'message' => __( 'Missing parameters.', 'product-configurator-for-woocommerce' ) ), 400 );
		}
		$product_id = absint( $_REQUEST['product_id'] );
		self::require_conversion_access( $product_id );

		$global_id = Owner_Resolver::get_global_id( $product_id );
		if ( $global_id <= 0 ) {
			wp_send_json_error( array( 'message' => __( 'This product is not linked to a global configurator, so its data was left alone.', 'product-configurator-for-woocommerce' ) ), 400 );
		}

		$product = Storage_Owner::for_post( $product_id );
		if ( ! $product ) {
			wp_send_json_error( array( 'message' => __( 'Invalid product.', 'product-configurator-for-woocommerce' ) ), 400 );
		}

		$wiped = Data_Copier::wipe_configurator_meta( $product );
		if ( is_wp_error( $wiped ) ) {
			wp_send_json_error( array( 'message' => $wiped->get_error_message() ), 400 );
		}
		$product->save();

		do_action( 'mkl_pc/global_configurators/local_data_deleted', $product_id, $global_id );
		wp_send_json_success();
	}

	/**
	 * Copy the currently linked global configurator meta onto the product and unlink.
	 *
	 * @return void
	 */
	public static function ajax_make_local_copy() {
		if ( ! isset( $_REQUEST['nonce'], $_REQUEST['product_id'] ) ) {
			wp_send_json_error( array( 'message' => __( 'Missing parameters.', 'product-configurator-for-woocommerce' ) ), 400 );
		}
		$product_id = absint( $_REQUEST['product_id'] );
		if ( ! check_ajax_referer( 'mkl_pc_global_configurators_admin_' . $product_id, 'nonce', false ) ) {
			wp_send_json_error( array( 'message' => __( 'Session expired.', 'product-configurator-for-woocommerce' ) ), 403 );
		}
		if ( ! current_user_can( 'edit_post', $product_id ) ) {
			wp_send_json_error( array( 'message' => __( 'Not allowed.', 'product-configurator-for-woocommerce' ) ), 403 );
		}
		$result = Data_Copier::unlink_product_from_global( $product_id, true );
		if ( is_wp_error( $result ) ) {
			wp_send_json_error( array( 'message' => $result->get_error_message() ), 400 );
		}
		wp_send_json_success();
	}

	/**
	 * @return void
	 */
	public static function enqueue_assets() {
		$slug    = 'mkl_pc-global-configurators-admin';
		$js_path = MKL_PC_INCLUDE_PATH . 'global-configurators/assets/global-configurators-admin.js';
		$js_url  = plugins_url( 'inc/global-configurators/assets/global-configurators-admin.js', MKL_PC_PLUGIN_PATH . 'woocommerce-mkl-product-configurator.php' );
		$css_p   = MKL_PC_INCLUDE_PATH . 'global-configurators/assets/global-configurators-admin.css';
		$css_u   = plugins_url( 'inc/global-configurators/assets/global-configurators-admin.css', MKL_PC_PLUGIN_PATH . 'woocommerce-mkl-product-configurator.php' );

		if ( file_exists( $js_path ) ) {
			wp_enqueue_script( $slug, $js_url, array( 'jquery' ), filemtime( $js_path ), true );
		}
		if ( file_exists( $css_p ) ) {
			wp_enqueue_style( $slug, $css_u, array(), filemtime( $css_p ) );
		}
	}

	/**
	 * Category search + apply-mode toggle on the global configurator CPT screen.
	 *
	 * @return void
	 */
	public static function enqueue_cpt_apply_assets() {
		$screen = function_exists( 'get_current_screen' ) ? get_current_screen() : null;
		if ( ! $screen || Schema::CPT_SLUG !== $screen->post_type || 'post' !== $screen->base ) {
			return;
		}
		if ( function_exists( 'WC' ) ) {
			wp_enqueue_script( 'wc-enhanced-select' );
			wp_enqueue_style( 'woocommerce_admin_styles' );
		}
		self::enqueue_assets();
	}

	/**
	 * @param array<string, mixed> $pc_lang
	 * @return array<string, mixed>
	 */
	public static function filter_pc_lang( $pc_lang ) {
		if ( ! is_array( $pc_lang ) ) {
			$pc_lang = array();
		}
		$pc_lang['mkl_pc_global_confirm_turn_global']  = __( 'Create a new global configurator from this product\'s configurator and link the product to it? This product\'s own data is kept until you delete it from the home tab.', 'product-configurator-for-woocommerce' );
		$pc_lang['mkl_pc_global_convert_layers']       = __( 'Copying layers to the global configurator…', 'product-configurator-for-woocommerce' );
		$pc_lang['mkl_pc_global_convert_content']      = __( 'Copying options and choices…', 'product-configurator-for-woocommerce' );
		$pc_lang['mkl_pc_global_convert_other']        = __( 'Copying configurator data…', 'product-configurator-for-woocommerce' );
		$pc_lang['mkl_pc_global_convert_finalize']     = __( 'Linking this product to the global configurator…', 'product-configurator-for-woocommerce' );
		$pc_lang['mkl_pc_global_convert_complete']     = __( 'The global configurator was created and this product is now linked to it.', 'product-configurator-for-woocommerce' );
		$pc_lang['mkl_pc_global_convert_note']         = __( 'This product still has its own copy of the configuration. It is no longer used, and you can delete it from the home tab once you have checked the global configurator.', 'product-configurator-for-woocommerce' );
		$pc_lang['mkl_pc_global_convert_dismiss']      = __( 'Reload the page', 'product-configurator-for-woocommerce' );
		$pc_lang['mkl_pc_global_convert_save_first']   = __( 'You have unsaved changes. They will be saved to this product first, then copied to the new global configurator.', 'product-configurator-for-woocommerce' );
		$pc_lang['mkl_pc_global_convert_empty']        = __( 'This configurator has no data to copy yet.', 'product-configurator-for-woocommerce' );
		$pc_lang['mkl_pc_global_convert_failed']       = __( 'The configurator data could not be copied, so the product was left as it is.', 'product-configurator-for-woocommerce' );
		$pc_lang['mkl_pc_delete_local_config_confirm'] = __( 'Delete this product\'s own configurator data? The product will keep using the global configurator, and unlinking it later will leave it with no configuration.', 'product-configurator-for-woocommerce' );
		$pc_lang['mkl_pc_global_confirm_make_local']   = __( 'Copy the global configurator\'s data onto this product and unlink it? Future changes will only affect this product.', 'product-configurator-for-woocommerce' );
		$pc_lang['mkl_pc_global_picker_searching']     = __( 'Searching…', 'product-configurator-for-woocommerce' );
		$pc_lang['mkl_pc_global_picker_request_failed'] = __( 'Search failed. Please refresh the page and try again.', 'product-configurator-for-woocommerce' );
		$pc_lang['mkl_pc_global_picker_edit']            = __( 'Edit', 'product-configurator-for-woocommerce' );
		$pc_lang['mkl_pc_global_picker_no_results']     = __( 'No global configurators found.', 'product-configurator-for-woocommerce' );
		$pc_lang['mkl_pc_global_picker_placeholder']   = __( 'Search global configurators…', 'product-configurator-for-woocommerce' );
		/* translators: %d: number of products using the global configurator */
		$pc_lang['mkl_pc_global_consumer_count_label'] = __( '%d using', 'product-configurator-for-woocommerce' );
		$pc_lang['mkl_pc_global_editor_readonly_note'] = __( 'This product is linked to a shared configurator. Editing is redirected to the global configurator.', 'product-configurator-for-woocommerce' );
		return $pc_lang;
	}

	/**
	 * Meta box on the global configurator CPT: apply to selected products or to a category.
	 *
	 * @return void
	 */
	public static function add_apply_meta_box() {
		add_meta_box(
			'mkl_pc_global_apply',
			__( 'Apply configurator to', 'product-configurator-for-woocommerce' ),
			array( __CLASS__, 'render_apply_meta_box' ),
			Schema::CPT_SLUG,
			'normal',
			'default'
		);
	}

	/**
	 * Two independent targeting rules plus a read-only account of who is using this configurator.
	 *
	 * There used to be a radio here presenting "Selected products" and "Products in category" as
	 * exclusive. They never were: an explicit per-product link resolves before the category rule
	 * and was never gated by the mode, so the radio's only real effects were hiding the category
	 * field and wiping the stored term ids on every switch. Both rules are now plain additive
	 * fields, and the product field edits the same per-product meta the product edit screen does -
	 * it is a second view of one value, not a second place to store it.
	 *
	 * @param \WP_Post $post
	 * @return void
	 */
	public static function render_apply_meta_box( $post ) {
		if ( ! $post || ! isset( $post->ID ) ) {
			return;
		}
		$global_id = (int) $post->ID;

		if ( 'auto-draft' === ( isset( $post->post_status ) ? $post->post_status : '' ) ) {
			echo '<p>' . esc_html__( 'Save this global configurator once before choosing which products use it.', 'product-configurator-for-woocommerce' ) . '</p>';
			return;
		}

		$category_ids = Assignment::get_apply_category_ids( $global_id );
		$linked_ids   = Owner_Resolver::get_explicitly_linked_product_ids( $global_id );
		wp_nonce_field( 'mkl_pc_global_apply_settings_' . $global_id, 'mkl_pc_apply_settings_nonce' );
		?>
		<div class="mkl-pc-apply-settings">
			<p class="description mkl-pc-apply-intro">
				<?php esc_html_e( 'A product uses this configurator when you pick it below, or when it sits in one of the selected categories. The two rules are independent - you can use either, or both.', 'product-configurator-for-woocommerce' ); ?>
			</p>

			<?php self::render_products_field( $linked_ids ); ?>

			<div class="mkl-pc-apply-field mkl-pc-apply-category-field">
				<label for="mkl_pc_apply_category_ids" class="mkl-pc-apply-label"><?php esc_html_e( 'Categories', 'product-configurator-for-woocommerce' ); ?></label>
				<select id="mkl_pc_apply_category_ids"
					class="wc-category-search"
					name="<?php echo esc_attr( Schema::META_APPLY_CATEGORY_IDS ); ?>[]"
					multiple="multiple"
					style="width: 100%;"
					data-placeholder="<?php esc_attr_e( 'Search for a category&hellip;', 'product-configurator-for-woocommerce' ); ?>"
					data-allow_clear="true"
					data-return_id="true"
					data-minimum_input_length="1">
					<?php
					foreach ( $category_ids as $term_id ) {
						$term = get_term( $term_id, 'product_cat' );
						if ( ! $term || is_wp_error( $term ) ) {
							continue;
						}
						echo '<option value="' . esc_attr( (string) $term_id ) . '" selected="selected">' . esc_html( $term->name ) . '</option>';
					}
					?>
				</select>
				<p class="description">
					<?php esc_html_e( 'Matching products become configurable automatically, including products added to these categories later. Subcategories are included. Products that already have Configurable enabled keep their own configurator. If several global configurators match the same product, the oldest one is used.', 'product-configurator-for-woocommerce' ); ?>
				</p>
			</div>

			<?php self::render_usage_summary( $global_id, $linked_ids ); ?>
		</div>
		<?php
	}

	/**
	 * Maximum number of linked products the editable selector will render.
	 *
	 * Past this the field becomes read-only. A select2 holding thousands of options is unusable in
	 * the browser, and - more importantly - a list that large belongs to bulk tooling, not to a
	 * control where one mis-click unlinks a product.
	 */
	const PRODUCT_FIELD_LIMIT = 300;

	/**
	 * The Products field, or a read-only summary when the selection is too large to edit here.
	 *
	 * The selection is submitted as ONE comma-separated hidden value rather than as a
	 * `name[]` multi-select. A multi-select posts one variable per option, and PHP silently
	 * discards everything past `max_input_vars` (1000 by default) keeping only the leading
	 * variables - so a configurator with more linked products than that would have had its tail
	 * read as "deselected" and unlinked on every save.
	 *
	 * The hidden input is pre-filled with the current selection and only rewritten by JS, so if
	 * the script does not run the form posts the list unchanged and the save is a no-op. The
	 * baseline field alongside it records what was on screen, which is what lets the save apply a
	 * difference instead of an absolute set - two editors saving the same configurator then do not
	 * silently undo each other's additions.
	 *
	 * @param int[] $linked_ids
	 * @return void
	 */
	private static function render_products_field( $linked_ids ) {
		$value = implode( ',', array_map( 'absint', $linked_ids ) );
		?>
		<div class="mkl-pc-apply-field mkl-pc-apply-products-field">
			<label for="mkl_pc_apply_product_ids" class="mkl-pc-apply-label"><?php esc_html_e( 'Products', 'product-configurator-for-woocommerce' ); ?></label>
			<?php if ( count( $linked_ids ) > self::PRODUCT_FIELD_LIMIT ) : ?>
				<p>
					<?php
					echo esc_html(
						sprintf(
							/* translators: 1: number of linked products, 2: the maximum this field will edit. */
							__( 'This global configurator is selected on %1$d products - more than the %2$d this field will edit at once. The list is shown below. Add or remove products from their own Configurator tab; saving here leaves the selection untouched.', 'product-configurator-for-woocommerce' ),
							count( $linked_ids ),
							self::PRODUCT_FIELD_LIMIT
						)
					);
					?>
				</p>
			<?php else : ?>
				<select id="mkl_pc_apply_product_ids"
					class="wc-product-search mkl-pc-apply-product-search"
					multiple="multiple"
					style="width: 100%;"
					data-placeholder="<?php esc_attr_e( 'Search for a product&hellip;', 'product-configurator-for-woocommerce' ); ?>"
					data-action="woocommerce_json_search_products"
					data-allow_clear="true"
					data-minimum_input_length="1"
					data-value-field="mkl_pc_apply_product_ids_value">
					<?php
					foreach ( $linked_ids as $product_id ) {
						$product = function_exists( 'wc_get_product' ) ? wc_get_product( $product_id ) : null;
						if ( ! $product ) {
							continue;
						}
						echo '<option value="' . esc_attr( (string) $product_id ) . '" selected="selected">' . esc_html( wp_strip_all_tags( $product->get_formatted_name() ) ) . '</option>';
					}
					?>
				</select>
				<input type="hidden" id="mkl_pc_apply_product_ids_value" name="mkl_pc_apply_product_ids" value="<?php echo esc_attr( $value ); ?>">
				<input type="hidden" name="mkl_pc_apply_products_baseline" value="<?php echo esc_attr( $value ); ?>">
				<p class="description">
					<?php esc_html_e( 'Picking a product here is the same as choosing this global configurator on the product\'s own Configurator tab - either screen edits the same setting. Removing a product returns it to its own configurator. Variable products need "Variations share the same configuration" set on them; a product that cannot be linked is reported after saving.', 'product-configurator-for-woocommerce' ); ?>
				</p>
			<?php endif; ?>
		</div>
		<?php
	}

	/**
	 * Who is using this configurator, grouped by which rule brought them in.
	 *
	 * Grouped rather than pooled because the two groups are not equally editable: the selected
	 * products are the field above, while the category matches follow from the products' own
	 * terms and can only be changed by editing those.
	 *
	 * @param int   $global_id
	 * @param int[] $linked_ids Explicitly linked product ids, already resolved by the caller.
	 * @return void
	 */
	private static function render_usage_summary( $global_id, $linked_ids ) {
		$global_id = (int) $global_id;

		// Ask how far the category rule reaches before enumerating it. A rule on a top-level
		// category can match the whole catalogue, and this screen only needs a number and a
		// sample - never every id.
		$category_total = Assignment::count_products_in_assigned_categories( $global_id );
		$exact          = $category_total <= self::USAGE_COUNT_EXACT_LIMIT;
		$category_ids   = $category_total > 0
			? Owner_Resolver::get_category_matched_product_ids( $global_id, $exact ? 0 : self::USAGE_LIST_LIMIT )
			: array();
		if ( $exact ) {
			$category_total = count( $category_ids );
		}
		$total = count( $linked_ids ) + $category_total;
		?>
		<hr>
		<div class="mkl-pc-apply-usage">
			<p class="mkl-pc-apply-usage-total">
				<strong>
					<?php
					if ( $exact ) {
						echo esc_html(
							sprintf(
								/* translators: %d: number of products currently using this configurator. */
								_n( '%d product currently uses this configurator.', '%d products currently use this configurator.', $total, 'product-configurator-for-woocommerce' ),
								$total
							)
						);
					} else {
						echo esc_html(
							sprintf(
								/* translators: %d: approximate number of products using this configurator. */
								__( 'About %d products currently use this configurator.', 'product-configurator-for-woocommerce' ),
								$total
							)
						);
					}
					?>
				</strong>
			</p>
			<?php
			if ( ! $exact ) {
				echo '<p class="description">' . esc_html__( 'The category rule matches too many products to check one by one, so the total is the number in those categories that do not keep their own configurator.', 'product-configurator-for-woocommerce' ) . '</p>';
			}
			if ( ! empty( $linked_ids ) ) {
				echo '<h4>' . esc_html__( 'Selected directly', 'product-configurator-for-woocommerce' ) . '</h4>';
				self::render_product_links( $linked_ids, count( $linked_ids ) );
			}
			if ( ! empty( $category_ids ) ) {
				echo '<h4>' . esc_html__( 'Matched by category', 'product-configurator-for-woocommerce' ) . '</h4>';
				self::render_product_links( $category_ids, $category_total );
			}
			?>
		</div>
		<?php
	}

	/**
	 * How many products each group in the usage summary lists before it stops naming them.
	 *
	 * A category rule can reach the whole catalogue, and a meta box is not a product list table.
	 */
	const USAGE_LIST_LIMIT = 50;

	/**
	 * Above this many category matches the summary reports a count from the database instead of
	 * verifying each product, so the edit screen's cost does not scale with the catalogue.
	 */
	const USAGE_COUNT_EXACT_LIMIT = 500;

	/**
	 * @param int[] $product_ids Ids to name; may be a sample rather than the whole group.
	 * @param int   $total       Size of the whole group, when it is larger than the sample.
	 * @return void
	 */
	private static function render_product_links( $product_ids, $total = 0 ) {
		$product_ids = array_values( $product_ids );
		$total       = max( (int) $total, count( $product_ids ) );
		$shown       = array_slice( $product_ids, 0, self::USAGE_LIST_LIMIT );

		// Bounded by USAGE_LIST_LIMIT, so priming here is a fixed cost rather than one that grows
		// with the rule - and it turns three queries per named product into a handful in total.
		if ( ! empty( $shown ) ) {
			_prime_post_caches( $shown, false, true );
		}

		echo '<div class="consumer-products">';
		foreach ( $shown as $product_id ) {
			$product = function_exists( 'wc_get_product' ) ? wc_get_product( $product_id ) : null;
			if ( ! $product ) {
				continue;
			}
			$edit_url = get_edit_post_link( $product_id );
			$name     = wp_strip_all_tags( $product->get_formatted_name() );
			if ( $edit_url ) {
				echo '<div><a href="' . esc_url( $edit_url ) . '" target="_blank">' . esc_html( $name ) . '</a></div>';
			} else {
				echo '<div>' . esc_html( $name ) . '</div>';
			}
		}
		if ( $total > count( $shown ) ) {
			echo '<div class="description">' . esc_html(
				sprintf(
					/* translators: %d: number of further products not listed individually. */
					_n( '… and %d more.', '… and %d more.', $total - count( $shown ), 'product-configurator-for-woocommerce' ),
					$total - count( $shown )
				)
			) . '</div>';
		}
		echo '</div>';
	}

	/**
	 * @param int      $post_id
	 * @param \WP_Post $post
	 * @return void
	 */
	public static function save_apply_settings( $post_id, $post ) {
		$post_id = (int) $post_id;
		if ( $post_id <= 0 ) {
			return;
		}
		if ( defined( 'DOING_AUTOSAVE' ) && DOING_AUTOSAVE ) {
			return;
		}
		if ( wp_is_post_revision( $post_id ) ) {
			return;
		}
		if ( ! isset( $_POST['mkl_pc_apply_settings_nonce'] ) ) {
			return;
		}
		if ( ! wp_verify_nonce( sanitize_text_field( wp_unslash( $_POST['mkl_pc_apply_settings_nonce'] ) ), 'mkl_pc_global_apply_settings_' . $post_id ) ) {
			return;
		}
		if ( ! current_user_can( 'edit_post', $post_id ) ) {
			return;
		}

		$category_ids = array();
		if ( isset( $_POST[ Schema::META_APPLY_CATEGORY_IDS ] ) && is_array( $_POST[ Schema::META_APPLY_CATEGORY_IDS ] ) ) {
			$category_ids = array_map( 'absint', wp_unslash( $_POST[ Schema::META_APPLY_CATEGORY_IDS ] ) );
		}
		Assignment::save_apply_categories( $post_id, $category_ids );

		// No baseline means the Products field was not editable on this screen (too many linked
		// products), so this save has nothing to say about the selection. Treating a missing field
		// as "nothing selected" would unlink every product on it.
		if ( ! isset( $_POST['mkl_pc_apply_products_baseline'] ) ) {
			return;
		}
		$baseline = self::parse_id_list( wp_unslash( $_POST['mkl_pc_apply_products_baseline'] ) );
		$posted   = isset( $_POST['mkl_pc_apply_product_ids'] )
			? self::parse_id_list( wp_unslash( $_POST['mkl_pc_apply_product_ids'] ) )
			: $baseline;

		self::sync_selected_products( $post_id, $posted, $baseline );
	}

	/**
	 * Parse a comma-separated id list into unique positive ints.
	 *
	 * @param mixed $raw
	 * @return int[]
	 */
	private static function parse_id_list( $raw ) {
		if ( ! is_string( $raw ) || '' === trim( $raw ) ) {
			return array();
		}
		$ids = array();
		foreach ( explode( ',', $raw ) as $part ) {
			$id = absint( trim( $part ) );
			if ( $id > 0 ) {
				$ids[] = $id;
			}
		}
		return array_values( array_unique( $ids ) );
	}

	/**
	 * Apply the change the editor made to the Products field.
	 *
	 * Deliberately a difference against the baseline that was on screen rather than "make the links
	 * equal the posted list". Two consequences, both wanted:
	 *
	 * - A product linked by someone else since this form was rendered is in neither list, so it is
	 *   left alone instead of being unlinked by a stale form.
	 * - Only genuine changes are written, so re-saving a configurator with three hundred linked
	 *   products touches no product meta at all.
	 *
	 * The meta written is exactly what the product edit screen writes, which is what keeps the two
	 * screens from drifting - and why nothing is stored on the CPT itself.
	 *
	 * @param int   $global_id
	 * @param int[] $posted_ids   The selection as submitted.
	 * @param int[] $baseline_ids The selection as rendered.
	 * @return void
	 */
	private static function sync_selected_products( $global_id, $posted_ids, $baseline_ids ) {
		$global_id = (int) $global_id;
		if ( $global_id <= 0 ) {
			return;
		}

		$current = Owner_Resolver::get_explicitly_linked_product_ids( $global_id );

		// Only link what the editor actually added, and only unlink what they actually removed and
		// that is still linked.
		$added   = array_values( array_diff( $posted_ids, $baseline_ids, $current ) );
		$removed = array_values( array_intersect( array_diff( $baseline_ids, $posted_ids ), $current ) );

		$skipped = array();
		foreach ( $added as $product_id ) {
			$error = self::link_selected_product( $product_id, $global_id );
			if ( '' !== $error ) {
				$skipped[] = $error;
			}
		}
		foreach ( $removed as $product_id ) {
			self::unlink_selected_product( $product_id, $global_id );
		}

		if ( ! empty( $added ) || ! empty( $removed ) ) {
			// A product that changed hands also changes what the category rule reaches, since
			// category matching skips anything explicitly linked - and the configurator that
			// matched it by category has no idea this save happened. The index invalidation
			// busts every category-rule consumer cache, which is the cheap way to cover that.
			Assignment::invalidate_category_index();
			delete_transient( 'mkl_get_configurable_products' );
		}

		if ( ! empty( $skipped ) ) {
			set_transient( 'mkl_pc_apply_notice_' . get_current_user_id() . '_' . $global_id, $skipped, 60 );
		}
	}

	/**
	 * Point one product at this global configurator.
	 *
	 * @param int $product_id
	 * @param int $global_id
	 * @return string Empty on success, otherwise a message naming why the product was skipped.
	 */
	private static function link_selected_product( $product_id, $global_id ) {
		$product_id = (int) $product_id;
		if ( $product_id <= 0 || 'product' !== get_post_type( $product_id ) ) {
			return '';
		}
		$name = get_the_title( $product_id );

		if ( ! current_user_can( 'edit_post', $product_id ) ) {
			/* translators: %s: product name. */
			return sprintf( __( '%s: you are not allowed to edit this product.', 'product-configurator-for-woocommerce' ), $name );
		}

		// Never take a product away from another global configurator on the strength of a search
		// result - that is a change to make on the product, where the current link is visible.
		$other_id = (int) get_post_meta( $product_id, Schema::META_GLOBAL_ID, true );
		if ( Schema::SOURCE_GLOBAL === get_post_meta( $product_id, Schema::META_SOURCE, true ) && $other_id > 0 && $other_id !== $global_id ) {
			return sprintf(
				/* translators: 1: product name, 2: title of the global configurator it is already linked to. */
				__( '%1$s: already linked to "%2$s". Unlink it there first.', 'product-configurator-for-woocommerce' ),
				$name,
				self::decode_post_title( get_the_title( $other_id ) )
			);
		}

		$linked = Data_Copier::link_product_to_global( $product_id, $global_id, false );
		if ( is_wp_error( $linked ) ) {
			/* translators: 1: product name, 2: reason the link was refused. */
			return sprintf( __( '%1$s: %2$s', 'product-configurator-for-woocommerce' ), $name, $linked->get_error_message() );
		}

		// The product keeps its own configurator rows; they are simply unreachable while linked,
		// exactly as they are after a conversion from the product screen.
		update_post_meta( $product_id, MKL_PC_PREFIX . '_is_configurable', 'yes' );
		self::flush_product_meta_cache( $product_id );
		return '';
	}

	/**
	 * Return one product to its own configurator.
	 *
	 * Not Data_Copier::unlink_product_from_global(): that sets Configurable to 'yes' because it
	 * is used when copying the shared configuration back onto the product. Nothing is copied
	 * back here, so a product with no configurator of its own has to stop being configurable
	 * rather than be left offering an empty configurator.
	 *
	 * @param int $product_id
	 * @param int $global_id
	 * @return void
	 */
	private static function unlink_selected_product( $product_id, $global_id ) {
		$product_id = (int) $product_id;
		if ( $product_id <= 0 || ! current_user_can( 'edit_post', $product_id ) ) {
			return;
		}

		delete_post_meta( $product_id, Schema::META_GLOBAL_ID );
		update_post_meta( $product_id, Schema::META_SOURCE, Schema::SOURCE_LOCAL );

		// Only clear the Configurable flag when we can positively establish the product has no
		// configurator of its own to fall back on. An owner we cannot even resolve is not evidence
		// of an empty product, and guessing wrong here turns a working product off.
		$owner = Storage_Owner::for_post( $product_id );
		if ( $owner && ! Data_Copier::has_local_configurator_data( $owner ) ) {
			update_post_meta( $product_id, MKL_PC_PREFIX . '_is_configurable', 'no' );
		}
		self::flush_product_meta_cache( $product_id );

		Owner_Resolver::invalidate_consumers_cache( $global_id );

		do_action( 'mkl_pc/global_configurators/unlinked', $product_id, (int) $global_id, false );
	}

	/**
	 * Drop WooCommerce's cached meta blob for one product.
	 *
	 * `Utils::is_configurable()` reads the Configurable flag through `WC_Product::get_meta()`,
	 * which serves a whole-object meta cache keyed by an `object_<id>` prefix. update_post_meta()
	 * writes past that cache, so on a store with a persistent object cache an unlinked product
	 * would keep reporting itself configurable - offering a configurator it no longer has - until
	 * the prefix happened to roll over.
	 *
	 * @param int $product_id
	 * @return void
	 */
	private static function flush_product_meta_cache( $product_id ) {
		$product_id = (int) $product_id;
		if ( $product_id <= 0 ) {
			return;
		}
		if ( class_exists( '\WC_Cache_Helper' ) ) {
			\WC_Cache_Helper::invalidate_cache_group( 'object_' . $product_id );
		}
		if ( function_exists( 'wc_delete_product_transients' ) ) {
			wc_delete_product_transients( $product_id );
		}
	}

	/**
	 * Report products the save could not link, once, on the redirect back to the edit screen.
	 *
	 * @return void
	 */
	public static function render_apply_notices() {
		$screen = function_exists( 'get_current_screen' ) ? get_current_screen() : null;
		if ( ! $screen || Schema::CPT_SLUG !== $screen->post_type || 'post' !== $screen->base ) {
			return;
		}
		$global_id = isset( $_GET['post'] ) ? absint( $_GET['post'] ) : 0; // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Reading the post being edited to key a display-only transient.
		if ( $global_id <= 0 ) {
			return;
		}
		$key      = 'mkl_pc_apply_notice_' . get_current_user_id() . '_' . $global_id;
		$messages = get_transient( $key );
		if ( empty( $messages ) || ! is_array( $messages ) ) {
			return;
		}
		delete_transient( $key );
		echo '<div class="notice notice-warning"><p><strong>' . esc_html__( 'Some products were not added to this global configurator:', 'product-configurator-for-woocommerce' ) . '</strong></p><ul style="margin-left:20px;list-style:disc;">';
		foreach ( $messages as $message ) {
			echo '<li>' . esc_html( $message ) . '</li>';
		}
		echo '</ul></div>';
	}

	/**
	 * Notice on the product General tab when a category assignment applies.
	 *
	 * @return void
	 */
	public static function render_product_assignment_notice() {
		global $post;
		if ( ! $post || ! isset( $post->ID ) ) {
			return;
		}
		$product_id = (int) $post->ID;
		$global_id  = Assignment::get_category_assigned_global_id( $product_id );
		if ( $global_id <= 0 ) {
			return;
		}
		// A product the resolver will not hand a global configurator to is not using one, so
		// telling the editor it is would send them looking in the wrong place. The "not available
		// on variable products unless..." warning above already explains why.
		if ( ! Owner_Resolver::can_use_global( $product_id ) ) {
			return;
		}
		$title    = self::decode_post_title( get_the_title( $global_id ) );
		$edit_url = get_edit_post_link( $global_id, 'raw' );
		$term_names = array();
		if ( function_exists( 'wc_get_product_term_ids' ) ) {
			$product_terms = wc_get_product_term_ids( $product_id, 'product_cat' );
			$assigned      = Assignment::expand_category_ids( Assignment::get_apply_category_ids( $global_id ), $global_id );
			foreach ( $product_terms as $term_id ) {
				if ( ! in_array( (int) $term_id, $assigned, true ) ) {
					continue;
				}
				$term = get_term( (int) $term_id, 'product_cat' );
				if ( $term && ! is_wp_error( $term ) ) {
					$term_names[] = $term->name;
				}
			}
		}
		?>
		<div class="options_group mkl-pc-category-assignment-notice">
			<p>
				<?php
				if ( $edit_url ) {
					echo wp_kses_post(
						sprintf(
							/* translators: 1: opening link tag, 2: global configurator title, 3: closing link tag */
							__( 'This product uses the global configurator %1$s%2$s%3$s because it is in an assigned category.', 'product-configurator-for-woocommerce' ),
							'<a href="' . esc_url( $edit_url ) . '"><strong>',
							esc_html( $title ),
							'</strong></a>'
						)
					);
				} else {
					echo wp_kses_post(
						sprintf(
							/* translators: %s: global configurator title */
							__( 'This product uses the global configurator %s because it is in an assigned category.', 'product-configurator-for-woocommerce' ),
							'<strong>' . esc_html( $title ) . '</strong>'
						)
					);
				}
				if ( ! empty( $term_names ) ) {
					echo ' ';
					echo esc_html(
						sprintf(
							/* translators: %s: comma-separated category names */
							_n( 'Matching category: %s.', 'Matching categories: %s.', count( $term_names ), 'product-configurator-for-woocommerce' ),
							implode( ', ', $term_names )
						)
					);
				}
				?>
			</p>
			<p class="description">
				<?php esc_html_e( 'Enable Configurable on this product if you need a different configurator. Otherwise edit the global configurator, or change the product categories.', 'product-configurator-for-woocommerce' ); ?>
			</p>
		</div>
		<?php
	}
}
