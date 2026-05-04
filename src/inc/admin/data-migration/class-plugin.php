<?php
/**
 * Hooks: home notices, AJAX, assets, PC_lang strings.
 *
 * @package MKL\PC\Admin\Data_Migration
 */

namespace MKL\PC\Admin\Data_Migration;

use MKL\PC\DB;
use MKL\PC\Global_Configurators\Owner_Resolver;
use MKL\PC\Global_Configurators\Schema;

defined( 'ABSPATH' ) || exit;

final class Plugin {

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

		add_action( 'mkl_pc_admin_instructions_before_content', array( __CLASS__, 'render_home_migration_notices' ), 5, 2 );
		add_action( 'wp_ajax_mkl_pc_delete_legacy_configurator_blobs', array( __CLASS__, 'ajax_delete_legacy_blobs' ) );
		add_action( 'wp_ajax_mkl_pc_restore_legacy_configurator_blobs', array( __CLASS__, 'ajax_restore_legacy_blobs' ) );
		add_action( 'mkl_pc_admin_scripts_product_page', array( __CLASS__, 'enqueue_assets' ) );
		add_filter( 'PC_lang', array( __CLASS__, 'filter_pc_lang' ), 20, 1 );
	}

	/**
	 * @param int               $product_id Current editor context (simple/variation/parent id).
	 * @param \WC_Product|null $product     Optional product object from admin screen.
	 * @return void
	 */
	public static function render_home_migration_notices( $product_id, $product = null ) {
		$product_id = (int) $product_id;
		if ( ! $product_id ) {
			return;
		}

		$is_cpt = class_exists( Schema::class ) && Schema::is_global_configurator_id( $product_id );
		if ( ! $is_cpt && ! mkl_pc_is_configurable( $product_id ) ) {
			return;
		}
		if ( ! $is_cpt ) {
			if ( ! $product || ! is_a( $product, \WC_Product::class ) ) {
				$product = wc_get_product( $product_id );
			}
			if ( ! $product || ! is_a( $product, \WC_Product::class ) ) {
				return;
			}
		}

		$db           = mkl_pc()->db;
		if ( $is_cpt ) {
			$parent_id    = $product_id;
			$variation_id = 0;
		} else {
			$parent_id    = $product->is_type( 'variation' ) ? (int) $product->get_parent_id() : (int) $product->get_id();
			$variation_id = $product->is_type( 'variation' ) ? (int) $product->get_id() : 0;
		}
		$storage      = $db->get_pc_storage_state_for_editor( $parent_id, $variation_id, false );

		$pending_migration = ! empty( $storage['needs_batch_migration'] ) || ! empty( $storage['needs_format_finalize'] );
		$legacy_still      = (int) $storage['storage_format_version'] === DB::STORAGE_FORMAT_CHUNKED_VERIFIED
			&& Legacy_Blob_Storage::has_legacy_blobs( $parent_id, $variation_id );

		// Verified chunked storage with leftover legacy blobs: mixed state still sets needs_batch_migration;
		// only the legacy cleanup notice is relevant (not "migrate on next save").
		if ( $legacy_still ) {
			$pending_migration = false;
		}

		if ( ! $pending_migration && ! $legacy_still ) {
			return;
		}

		$persist_nonce = wp_create_nonce( 'update-pc-post_' . $parent_id );
		?>
		<div class="mkl-pc-data-migration migration-warning">
			<?php if ( $pending_migration ) : ?>
				<div class="notice notice-warning">
					<h3><?php esc_html_e( 'Data migration required', 'product-configurator-for-woocommerce' ); ?></h3>
					<p><?php esc_html_e( 'Configuration storage will be migrated to the new format the next time you save.', 'product-configurator-for-woocommerce' ); ?></p>
				</div>
			<?php endif; ?>
			<?php if ( $legacy_still ) : ?>
				<div class="notice notice-warning mkl-pc-legacy-data-notice">
					<p><?php esc_html_e( 'Legacy storage data is still present alongside the new format. You can delete it after you have verified everything, or restore it from the current configuration.', 'product-configurator-for-woocommerce' ); ?></p>
					<p>
						<button type="button" class="button button-secondary mkl-pc-delete-legacy-config" data-nonce="<?php echo esc_attr( $persist_nonce ); ?>" data-parent-id="<?php echo esc_attr( (string) $parent_id ); ?>" data-variation-id="<?php echo esc_attr( (string) $variation_id ); ?>"><?php esc_html_e( 'Delete legacy data', 'product-configurator-for-woocommerce' ); ?></button>
						<button type="button" class="button mkl-pc-restore-legacy-config" data-nonce="<?php echo esc_attr( $persist_nonce ); ?>" data-parent-id="<?php echo esc_attr( (string) $parent_id ); ?>" data-variation-id="<?php echo esc_attr( (string) $variation_id ); ?>"><?php esc_html_e( 'Restore legacy data', 'product-configurator-for-woocommerce' ); ?></button>
					</p>
				</div>
			<?php endif; ?>
		</div>
		<?php
	}

	/**
	 * @return void
	 */
	public static function ajax_delete_legacy_blobs() {
		if ( ! isset( $_REQUEST['parent_id'], $_REQUEST['nonce'] ) ) {
			wp_send_json_error( array( 'message' => __( 'Missing parameters.', 'product-configurator-for-woocommerce' ) ), 400 );
		}
		$parent_id    = absint( $_REQUEST['parent_id'] );
		$variation_id = isset( $_REQUEST['variation_id'] ) ? absint( $_REQUEST['variation_id'] ) : 0;
		if ( ! $parent_id ) {
			wp_send_json_error( array( 'message' => __( 'Invalid product.', 'product-configurator-for-woocommerce' ) ), 400 );
		}
		if ( ! check_ajax_referer( 'update-pc-post_' . $parent_id, 'nonce', false ) ) {
			wp_send_json_error( array( 'message' => __( 'The session seems to have expired.', 'product-configurator-for-woocommerce' ) ), 403 );
		}
		if ( ! current_user_can( 'edit_post', $parent_id ) ) {
			wp_send_json_error( array( 'message' => __( 'You are not allowed to edit this product.', 'product-configurator-for-woocommerce' ) ), 403 );
		}
		Legacy_Blob_Storage::delete_legacy_blobs( $parent_id, $variation_id );
		wp_send_json_success(
			array(
				'snapshot' => mkl_pc()->db->get_pc_storage_state_for_editor( $parent_id, $variation_id, false ),
			)
		);
	}

	/**
	 * Remove chunked metas when legacy blobs still exist (failed migration recovery). Requires client confirmation.
	 *
	 * @return void
	 */
	public static function ajax_restore_legacy_blobs() {
		if ( ! isset( $_REQUEST['parent_id'], $_REQUEST['nonce'] ) ) {
			wp_send_json_error( array( 'message' => __( 'Missing parameters.', 'product-configurator-for-woocommerce' ) ), 400 );
		}
		$parent_id    = absint( $_REQUEST['parent_id'] );
		$variation_id = isset( $_REQUEST['variation_id'] ) ? absint( $_REQUEST['variation_id'] ) : 0;
		if ( ! $parent_id ) {
			wp_send_json_error( array( 'message' => __( 'Invalid product.', 'product-configurator-for-woocommerce' ) ), 400 );
		}
		if ( ! check_ajax_referer( 'update-pc-post_' . $parent_id, 'nonce', false ) ) {
			wp_send_json_error( array( 'message' => __( 'The session seems to have expired.', 'product-configurator-for-woocommerce' ) ), 403 );
		}
		if ( ! current_user_can( 'edit_post', $parent_id ) ) {
			wp_send_json_error( array( 'message' => __( 'You are not allowed to edit this product.', 'product-configurator-for-woocommerce' ) ), 403 );
		}
		$result = Legacy_Blob_Storage::revert_to_legacy_storage_remove_chunks( $parent_id, $variation_id );
		if ( is_wp_error( $result ) ) {
			wp_send_json_error( array( 'message' => $result->get_error_message() ), 400 );
		}
		wp_send_json_success(
			array(
				'snapshot' => mkl_pc()->db->get_pc_storage_state_for_editor( $parent_id, $variation_id, false ),
			)
		);
	}

	/**
	 * @return void
	 */
	public static function enqueue_assets() {
		$slug  = 'mkl_pc-data-migration-admin';
		$path  = MKL_PC_INCLUDE_PATH . 'admin/data-migration/assets/data-migration-home.js';
		$url   = plugins_url( 'inc/admin/data-migration/assets/data-migration-home.js', MKL_PC_PLUGIN_PATH . 'woocommerce-mkl-product-configurator.php' );
		$css_p = MKL_PC_INCLUDE_PATH . 'admin/data-migration/assets/data-migration-admin.css';
		$css_u = plugins_url( 'inc/admin/data-migration/assets/data-migration-admin.css', MKL_PC_PLUGIN_PATH . 'woocommerce-mkl-product-configurator.php' );

		if ( file_exists( $path ) ) {
			wp_enqueue_script( $slug, $url, array( 'jquery' ), filemtime( $path ), true );
		}

		$overlay_path = MKL_PC_INCLUDE_PATH . 'admin/data-migration/assets/data-migration-overlay.js';
		$overlay_url  = plugins_url( 'inc/admin/data-migration/assets/data-migration-overlay.js', MKL_PC_PLUGIN_PATH . 'woocommerce-mkl-product-configurator.php' );
		if ( file_exists( $overlay_path ) ) {
			wp_enqueue_script(
				'mkl_pc-data-migration-overlay',
				$overlay_url,
				array( 'jquery', 'mkl_pc/js/admin/backbone/app' ),
				filemtime( $overlay_path ),
				true
			);
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
		$pc_lang['mkl_pc_delete_legacy_confirm'] = __( 'Delete the legacy copy of layers and content? Chunked storage will not be removed.', 'product-configurator-for-woocommerce' );
		$pc_lang['mkl_pc_restore_legacy_confirm'] = __( 'This will permanently remove the new (chunked) storage for this product: all per-layer and per-content chunk metas, the layers index, and the migration flags. The editor will use your existing legacy blobs only. This is intended when a migration failed and legacy data is still intact. Continue?', 'product-configurator-for-woocommerce' );
		$pc_lang['mkl_pc_legacy_ajax_error']     = __( 'Could not update legacy storage.', 'product-configurator-for-woocommerce' );

		$pc_lang['mkl_pc_migration_layers']       = __( 'Migrating layers…', 'product-configurator-for-woocommerce' );
		$pc_lang['mkl_pc_migration_content']     = __( 'Migrating content…', 'product-configurator-for-woocommerce' );
		$pc_lang['mkl_pc_migration_finalize']   = __( 'Finalizing storage migration…', 'product-configurator-for-woocommerce' );
		$pc_lang['mkl_pc_migration_other']       = __( 'Saving configuration…', 'product-configurator-for-woocommerce' );
		$pc_lang['mkl_pc_migration_complete']    = __( 'Migration complete', 'product-configurator-for-woocommerce' );
		$pc_lang['mkl_pc_migration_legacy_note']  = __( 'A copy of your data may still exist in the previous (legacy) format until you delete it from the home tab. If a migration went wrong while that copy still exists, you can use “Restore legacy data” there to remove chunked storage and load the legacy copy again.', 'product-configurator-for-woocommerce' );
		$pc_lang['mkl_pc_migration_dismiss']     = __( 'OK', 'product-configurator-for-woocommerce' );

		$pc_lang['mkl_pc_bulk_save_layers']   = __( 'Saving layers…', 'product-configurator-for-woocommerce' );
		$pc_lang['mkl_pc_bulk_save_content']  = __( 'Saving content…', 'product-configurator-for-woocommerce' );
		$pc_lang['mkl_pc_bulk_save_finalize'] = __( 'Finishing storage update…', 'product-configurator-for-woocommerce' );
		$pc_lang['mkl_pc_bulk_save_other']    = __( 'Saving configuration…', 'product-configurator-for-woocommerce' );
		$pc_lang['mkl_pc_bulk_save_complete'] = __( 'Save complete', 'product-configurator-for-woocommerce' );
		$pc_lang['mkl_pc_bulk_save_dismiss']   = __( 'OK', 'product-configurator-for-woocommerce' );

		$pc_lang['mkl_pc_make_global_progress'] = __( 'Creating global layer…', 'product-configurator-for-woocommerce' );
		$pc_lang['mkl_pc_save_global_layer_progress'] = __( 'Saving global layer…', 'product-configurator-for-woocommerce' );

		return $pc_lang;
	}
}
