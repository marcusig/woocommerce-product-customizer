<?php
namespace MKL\PC;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Where a quote request ends up
 *
 * One store per setting of "What happens to a quote request". Stores are registered through the
 * `mkl_pc/quote_request/stores` filter.
 */
interface Quote_Store {

	/**
	 * Setting value for this store
	 *
	 * @return string
	 */
	public function get_id();

	/**
	 * Label in the settings
	 *
	 * @return string
	 */
	public function get_label();

	/**
	 * Whether the store can be used on this site (e.g. WooCommerce is active)
	 *
	 * @return boolean
	 */
	public function is_available();

	/**
	 * Whether the request is kept somewhere other than the emails
	 *
	 * When it is not, a request whose admin email fails is lost, so the customer is told.
	 *
	 * @return boolean
	 */
	public function is_persistent();

	/**
	 * Folder, under mkl-pc-config-images, the request's files are kept in
	 *
	 * `quotes` is swept after the quote_image_retention setting; persistent stores use a folder
	 * that is never swept.
	 *
	 * @return string
	 */
	public function get_files_folder();

	/**
	 * Keep the request. Sets its id when the store gives it one.
	 *
	 * @param Quote_Request $request
	 * @return true|\WP_Error
	 */
	public function save( Quote_Request $request );

	/**
	 * Where the merchant sees a stored request, or ''
	 *
	 * @param Quote_Request $request
	 * @return string
	 */
	public function get_admin_url( Quote_Request $request );

	/**
	 * Files the customer sent with a stored request, with absolute paths
	 *
	 * @param int $id Request id in this store.
	 * @return array[]
	 */
	public function get_files( $id );

	/**
	 * Whether the current user may see a stored request (and download its files)
	 *
	 * @param int $id
	 * @return boolean
	 */
	public function user_can_view( $id );
}
