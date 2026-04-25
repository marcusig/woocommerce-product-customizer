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

		add_action( 'mkl_pc_admin_instructions_before_content', array( __CLASS__, 'render_home_global_notice' ), 10, 2 );

		add_action( 'wp_ajax_mkl_pc_search_global_configurators', array( __CLASS__, 'ajax_search_global_configurators' ) );
		add_action( 'wp_ajax_mkl_pc_create_global_from_product', array( __CLASS__, 'ajax_create_global_from_product' ) );
		add_action( 'wp_ajax_mkl_pc_make_local_copy', array( __CLASS__, 'ajax_make_local_copy' ) );

		add_action( 'mkl_pc_admin_scripts_product_page', array( __CLASS__, 'enqueue_assets' ) );
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
	 * Add source selector + picker to the General tab inside the show_if_is_configurable wrapper.
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
		<div class="options_group mkl-pc-configurator-source-group show_if_is_configurable">
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

		$posted_source = isset( $_POST[ Schema::META_SOURCE ] ) ? sanitize_key( wp_unslash( $_POST[ Schema::META_SOURCE ] ) ) : '';
		$posted_id     = isset( $_POST[ Schema::META_GLOBAL_ID ] ) ? absint( wp_unslash( $_POST[ Schema::META_GLOBAL_ID ] ) ) : 0;

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
			$consumer_count = count( Owner_Resolver::get_consumer_product_ids( $post_id ) );
			?>
			<div class="notice notice-info mkl-pc-global-editor-notice">
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
			<div class="notice notice-warning mkl-pc-global-editor-notice">
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
			return;
		}

		if ( ! Owner_Resolver::can_use_global( $post_id ) ) {
			return;
		}
		?>
		<div class="mkl-pc-home-tab-actions mkl-pc-home-tab-actions--local">
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
					'consumer_count' => count( Owner_Resolver::get_consumer_product_ids( $pid ) ),
					'edit_url'       => get_edit_post_link( $pid, 'raw' ),
				);
			}
		}
		wp_send_json_success( array( 'items' => $items ) );
	}

	/**
	 * Create a new CPT from the product's current data and link the product to it.
	 *
	 * @return void
	 */
	public static function ajax_create_global_from_product() {
		if ( ! isset( $_REQUEST['nonce'], $_REQUEST['product_id'] ) ) {
			wp_send_json_error( array( 'message' => __( 'Missing parameters.', 'product-configurator-for-woocommerce' ) ), 400 );
		}
		$product_id = absint( $_REQUEST['product_id'] );
		if ( ! check_ajax_referer( 'mkl_pc_global_configurators_admin_' . $product_id, 'nonce', false ) ) {
			wp_send_json_error( array( 'message' => __( 'Session expired.', 'product-configurator-for-woocommerce' ) ), 403 );
		}
		if ( ! current_user_can( 'edit_post', $product_id ) || ! current_user_can( 'edit_posts' ) ) {
			wp_send_json_error( array( 'message' => __( 'Not allowed.', 'product-configurator-for-woocommerce' ) ), 403 );
		}
		if ( ! Owner_Resolver::can_use_global( $product_id ) ) {
			wp_send_json_error( array( 'message' => __( 'This product cannot use a global configurator.', 'product-configurator-for-woocommerce' ) ), 400 );
		}
		$title  = isset( $_REQUEST['title'] ) ? sanitize_text_field( wp_unslash( $_REQUEST['title'] ) ) : '';
		$new_id = Data_Copier::create_global_from_product( $product_id, $title );
		if ( is_wp_error( $new_id ) ) {
			wp_send_json_error( array( 'message' => $new_id->get_error_message() ), 400 );
		}
		$linked = Data_Copier::link_product_to_global( $product_id, (int) $new_id, true );
		if ( is_wp_error( $linked ) ) {
			wp_send_json_error( array( 'message' => $linked->get_error_message() ), 400 );
		}
		wp_send_json_success(
			array(
				'global_id'    => (int) $new_id,
				'global_title' => self::decode_post_title( get_the_title( (int) $new_id ) ),
				'edit_url'     => get_edit_post_link( (int) $new_id, 'raw' ),
			)
		);
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
	 * @param array<string, mixed> $pc_lang
	 * @return array<string, mixed>
	 */
	public static function filter_pc_lang( $pc_lang ) {
		if ( ! is_array( $pc_lang ) ) {
			$pc_lang = array();
		}
		$pc_lang['mkl_pc_global_confirm_turn_global']  = __( 'Create a new global configurator from this product\'s configurator and link the product to it? The product\'s own configurator data will be replaced by the link.', 'product-configurator-for-woocommerce' );
		$pc_lang['mkl_pc_global_confirm_make_local']   = __( 'Copy the global configurator\'s data onto this product and unlink it? Future changes will only affect this product.', 'product-configurator-for-woocommerce' );
		$pc_lang['mkl_pc_global_picker_searching']     = __( 'Searching…', 'product-configurator-for-woocommerce' );
		$pc_lang['mkl_pc_global_picker_request_failed'] = __( 'Search failed. Please refresh the page and try again.', 'product-configurator-for-woocommerce' );
		$pc_lang['mkl_pc_global_picker_edit']            = __( 'Edit', 'product-configurator-for-woocommerce' );
		$pc_lang['mkl_pc_global_picker_no_results']     = __( 'No global configurators found.', 'product-configurator-for-woocommerce' );
		$pc_lang['mkl_pc_global_picker_placeholder']   = __( 'Search global configurators…', 'product-configurator-for-woocommerce' );
		$pc_lang['mkl_pc_global_consumer_count_label'] = __( '%d using', 'product-configurator-for-woocommerce' );
		$pc_lang['mkl_pc_global_editor_readonly_note'] = __( 'This product is linked to a shared configurator. Editing is redirected to the global configurator.', 'product-configurator-for-woocommerce' );
		return $pc_lang;
	}
}
