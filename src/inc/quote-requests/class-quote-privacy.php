<?php
namespace MKL\PC;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Personal data held in stored quote requests
 *
 * WooCommerce covers requests kept as orders. Requests kept as posts are exported and erased here,
 * through the WordPress privacy tools, and can be deleted after a retention period.
 */
class Quote_Privacy {

	const BATCH = 50;

	public function __construct() {
		add_filter( 'wp_privacy_personal_data_exporters', [ $this, 'register_exporter' ] );
		add_filter( 'wp_privacy_personal_data_erasers', [ $this, 'register_eraser' ] );
		add_action( 'admin_init', [ $this, 'add_privacy_policy_content' ] );
		// The daily cleanup the configurator already schedules.
		add_action( 'mkl_pc_cleanup_3d_cart_screenshots', [ $this, 'delete_expired' ] );
	}

	/**
	 * @param array $exporters
	 * @return array
	 */
	public function register_exporter( $exporters ) {
		$exporters['mkl-pc-quote-requests'] = [
			'exporter_friendly_name' => __( 'Configurator quote requests', 'product-configurator-for-woocommerce' ),
			'callback'               => [ $this, 'export' ],
		];
		return $exporters;
	}

	/**
	 * @param array $erasers
	 * @return array
	 */
	public function register_eraser( $erasers ) {
		$erasers['mkl-pc-quote-requests'] = [
			'eraser_friendly_name' => __( 'Configurator quote requests', 'product-configurator-for-woocommerce' ),
			'callback'             => [ $this, 'erase' ],
		];
		return $erasers;
	}

	/**
	 * Requests sent with an email address
	 *
	 * @param string $email
	 * @param int    $page
	 * @return int[]
	 */
	private function find( $email, $page = 1 ) {
		return get_posts( [
			'post_type'      => CPT_Store::POST_TYPE,
			// Not 'any': it leaves out statuses excluded from search, which all of these are.
			'post_status'    => array_merge( array_keys( CPT_Store::get_statuses() ), [ 'trash' ] ),
			'posts_per_page' => self::BATCH,
			'paged'          => max( 1, (int) $page ),
			'fields'         => 'ids',
			'orderby'        => 'ID',
			'order'          => 'ASC',
			'meta_query'     => [ [ 'key' => '_mkl_pc_quote_email', 'value' => $email ] ], // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_query -- Privacy requests are rare.
		] );
	}

	/**
	 * @param string $email
	 * @param int    $page
	 * @return array
	 */
	public function export( $email, $page = 1 ) {
		$store = mkl_pc( 'quotes' )->cpt_store;
		$ids = $this->find( $email, $page );
		$items = [];
		foreach ( $ids as $post_id ) {
			$request = $store->load( $post_id );
			if ( ! $request ) continue;
			$data = [
				[ 'name' => __( 'Reference', 'product-configurator-for-woocommerce' ), 'value' => $request->reference ],
				[ 'name' => __( 'Date', 'product-configurator-for-woocommerce' ), 'value' => wp_date( get_option( 'date_format' ) . ' ' . get_option( 'time_format' ), $request->created ) ],
				[ 'name' => __( 'Product', 'product-configurator-for-woocommerce' ), 'value' => $request->get_product_name() . ' × ' . $request->quantity ],
			];
			$configuration = [];
			foreach ( $request->get_summary() as $row ) {
				$configuration[] = wp_strip_all_tags( $row['label'] ) . ': ' . wp_strip_all_tags( $row['value'] );
			}
			if ( $configuration ) {
				$data[] = [ 'name' => __( 'Configuration', 'product-configurator-for-woocommerce' ), 'value' => implode( "\n", $configuration ) ];
			}
			foreach ( $request->get_field_rows() as $row ) {
				$data[] = [ 'name' => wp_strip_all_tags( $row['label'] ), 'value' => $row['value'] ];
			}
			$items[] = [
				'group_id'    => 'mkl-pc-quote-requests',
				'group_label' => __( 'Quote requests', 'product-configurator-for-woocommerce' ),
				'item_id'     => 'mkl-pc-quote-request-' . $post_id,
				'data'        => $data,
			];
		}
		return [
			'data' => $items,
			'done' => count( $ids ) < self::BATCH,
		];
	}

	/**
	 * Delete the requests: they hold little besides the personal data
	 *
	 * @param string $email
	 * @param int    $page Ignored: deleted requests leave the first page.
	 * @return array
	 */
	public function erase( $email, $page = 1 ) {
		$ids = $this->find( $email, 1 );
		$removed = false;
		$retained = false;
		foreach ( $ids as $post_id ) {
			if ( wp_delete_post( $post_id, true ) ) {
				$removed = true;
			} else {
				$retained = true;
			}
		}
		return [
			'items_removed'  => $removed,
			'items_retained' => $retained,
			'messages'       => [],
			'done'           => count( $ids ) < self::BATCH || $retained,
		];
	}

	/**
	 * Delete stored requests older than the retention setting
	 *
	 * @return int Number deleted.
	 */
	public function delete_expired() {
		$days = (int) mkl_pc( 'settings' )->get( 'quote_request_retention', 0 );
		/**
		 * Number of days a stored quote request is kept. 0 keeps them for good.
		 *
		 * @param int $days
		 */
		$days = (int) apply_filters( 'mkl_pc/quote_request/retention_days', $days );
		if ( $days <= 0 ) return 0;

		$ids = get_posts( [
			'post_type'      => CPT_Store::POST_TYPE,
			'post_status'    => array_merge( array_keys( CPT_Store::get_statuses() ), [ 'trash' ] ),
			'posts_per_page' => 200,
			'fields'         => 'ids',
			'date_query'     => [ [ 'before' => gmdate( 'Y-m-d H:i:s', time() - $days * DAY_IN_SECONDS ), 'column' => 'post_date_gmt' ] ],
		] );
		$deleted = 0;
		foreach ( $ids as $post_id ) {
			if ( wp_delete_post( $post_id, true ) ) $deleted++;
		}
		return $deleted;
	}

	/**
	 * Suggested text for the site's privacy policy
	 *
	 * @return void
	 */
	public function add_privacy_policy_content() {
		if ( ! function_exists( 'wp_add_privacy_policy_content' ) || ! mkl_pc( 'quotes' )->is_enabled() ) return;
		wp_add_privacy_policy_content(
			__( 'Product Configurator quote requests', 'product-configurator-for-woocommerce' ),
			'<p>' . __( 'When you request a quote for a product you configured, we collect the details you enter in the request form (such as your name, email address and message) along with your configuration, to answer your request. They are sent to us by email and may be kept on this site until the request is dealt with.', 'product-configurator-for-woocommerce' ) . '</p>'
		);
	}
}
