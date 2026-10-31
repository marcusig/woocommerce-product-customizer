<?php
namespace MKL\PC;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Screens for quote requests kept as posts
 *
 * The list shows who asked for what. A request opens read-only: what was configured, what the
 * customer filled in, and a status with internal notes for the merchant to follow it up.
 */
class Quote_Requests_Admin {

	/**
	 * @var CPT_Store
	 */
	private $store;

	public function __construct( CPT_Store $store ) {
		$this->store = $store;
		$type = CPT_Store::POST_TYPE;
		add_filter( "manage_{$type}_posts_columns", [ $this, 'columns' ] );
		add_action( "manage_{$type}_posts_custom_column", [ $this, 'render_column' ], 10, 2 );
		add_filter( 'post_row_actions', [ $this, 'row_actions' ], 10, 2 );
		add_filter( "bulk_actions-edit-{$type}", [ $this, 'bulk_actions' ] );
		add_action( "add_meta_boxes_{$type}", [ $this, 'meta_boxes' ] );
		add_action( "save_post_{$type}", [ $this, 'save' ], 10, 2 );
		add_action( 'admin_head', [ $this, 'styles' ] );
	}

	/**
	 * @param array $columns
	 * @return array
	 */
	public function columns( $columns ) {
		return [
			'cb'                   => $columns['cb'],
			'title'                => __( 'Request', 'product-configurator-for-woocommerce' ),
			'mkl_pc_quote_image'   => '<span class="screen-reader-text">' . esc_html__( 'Image', 'product-configurator-for-woocommerce' ) . '</span>',
			'mkl_pc_quote_contact' => __( 'Customer', 'product-configurator-for-woocommerce' ),
			'mkl_pc_quote_product' => __( 'Product', 'product-configurator-for-woocommerce' ),
			'mkl_pc_quote_status'  => __( 'Status', 'product-configurator-for-woocommerce' ),
			'date'                 => $columns['date'],
		];
	}

	/**
	 * @param string $column
	 * @param int    $post_id
	 * @return void
	 */
	public function render_column( $column, $post_id ) {
		switch ( $column ) {
			case 'mkl_pc_quote_image':
				$image = get_post_meta( $post_id, '_mkl_pc_quote_image', true );
				if ( $image ) {
					printf( '<img src="%s" alt="" width="48" height="48" style="object-fit: contain;" />', esc_url( wp_upload_dir()['baseurl'] . '/' . $image ) );
				}
				break;
			case 'mkl_pc_quote_contact':
				$fields = (array) get_post_meta( $post_id, '_mkl_pc_quote_fields', true );
				echo esc_html( isset( $fields['name'] ) ? $fields['name'] : '' );
				if ( ! empty( $fields['email'] ) ) {
					printf( '<br><a href="mailto:%1$s">%1$s</a>', esc_attr( $fields['email'] ) );
				}
				break;
			case 'mkl_pc_quote_product':
				$product_id = (int) get_post_meta( $post_id, '_mkl_pc_quote_product_id', true );
				$variation_id = (int) get_post_meta( $post_id, '_mkl_pc_quote_variation_id', true );
				$quantity = (int) get_post_meta( $post_id, '_mkl_pc_quote_quantity', true );
				echo esc_html( get_the_title( $variation_id ? $variation_id : $product_id ) );
				if ( $quantity > 1 ) echo ' &times; ' . esc_html( $quantity );
				break;
			case 'mkl_pc_quote_status':
				$statuses = CPT_Store::get_statuses();
				$status = get_post_status( $post_id );
				printf( '<mark class="mkl-pc-quote-status status-%s"><span>%s</span></mark>', esc_attr( $status ), esc_html( isset( $statuses[ $status ] ) ? $statuses[ $status ] : $status ) );
				break;
		}
	}

	/**
	 * Quick edit only knows the built-in statuses
	 *
	 * @param array    $actions
	 * @param \WP_Post $post
	 * @return array
	 */
	public function row_actions( $actions, $post ) {
		if ( CPT_Store::POST_TYPE !== $post->post_type ) return $actions;
		unset( $actions['inline hide-if-no-js'], $actions['view'] );
		if ( isset( $actions['edit'] ) ) {
			$actions['edit'] = sprintf( '<a href="%s">%s</a>', esc_url( get_edit_post_link( $post->ID ) ), esc_html__( 'Open', 'product-configurator-for-woocommerce' ) );
		}
		return $actions;
	}

	/**
	 * Bulk edit only knows the built-in statuses too
	 *
	 * @param array $actions
	 * @return array
	 */
	public function bulk_actions( $actions ) {
		unset( $actions['edit'] );
		return $actions;
	}

	/**
	 * Replace the publish box and the editor with the request
	 *
	 * @param \WP_Post $post
	 * @return void
	 */
	public function meta_boxes( $post ) {
		remove_meta_box( 'submitdiv', CPT_Store::POST_TYPE, 'side' );
		remove_meta_box( 'slugdiv', CPT_Store::POST_TYPE, 'normal' );
		add_meta_box( 'mkl_pc_quote_request', __( 'Configuration', 'product-configurator-for-woocommerce' ), [ $this, 'render_request' ], CPT_Store::POST_TYPE, 'normal', 'high' );
		add_meta_box( 'mkl_pc_quote_contact', __( 'Customer', 'product-configurator-for-woocommerce' ), [ $this, 'render_contact' ], CPT_Store::POST_TYPE, 'normal', 'default' );
		add_meta_box( 'mkl_pc_quote_status', __( 'Status', 'product-configurator-for-woocommerce' ), [ $this, 'render_status' ], CPT_Store::POST_TYPE, 'side', 'high' );
	}

	/**
	 * @param \WP_Post $post
	 * @return void
	 */
	public function render_request( $post ) {
		$request = $this->store->load( $post->ID );
		if ( ! $request ) return;
		$product = $request->get_product();
		?>
		<h2 class="mkl-pc-quote-reference"><?php echo esc_html( $request->reference ); ?></h2>
		<div class="mkl-pc-quote-request">
			<?php if ( $request->image_url ) : ?>
				<a href="<?php echo esc_url( $request->image_url ); ?>" target="_blank" class="mkl-pc-quote-image"><img src="<?php echo esc_url( $request->image_url ); ?>" alt="" /></a>
			<?php endif; ?>
			<div>
				<p>
					<strong>
						<?php if ( $product && current_user_can( 'edit_post', $request->product_id ) ) : ?>
							<a href="<?php echo esc_url( get_edit_post_link( $request->product_id ) ); ?>"><?php echo esc_html( $request->get_product_name() ); ?></a>
						<?php else : ?>
							<?php echo esc_html( $request->get_product_name() ); ?>
						<?php endif; ?>
					</strong>
					&times; <?php echo esc_html( $request->quantity ); ?>
				</p>
				<div class="order-configuration">
					<?php foreach ( $request->get_summary() as $row ) : ?>
						<div><strong><?php echo wp_kses_post( $row['label'] ); ?></strong><?php echo $row['label'] ? ': ' : ''; ?><?php echo wp_kses_post( $row['value'] ); ?></div>
					<?php endforeach; ?>
				</div>
				<?php if ( is_array( $request->price ) && isset( $request->price['line_total'] ) && function_exists( 'wc_price' ) ) : ?>
					<p><?php esc_html_e( 'Estimated price when requested:', 'product-configurator-for-woocommerce' ); ?> <?php echo wp_kses_post( wc_price( $request->price['line_total'] ) ); ?></p>
				<?php endif; ?>
			</div>
		</div>
		<?php
		/**
		 * After the configuration of a stored quote request, in the admin
		 *
		 * @param Quote_Request $request
		 */
		do_action( 'mkl_pc/admin/quote_request/after_configuration', $request );
	}

	/**
	 * @param \WP_Post $post
	 * @return void
	 */
	public function render_contact( $post ) {
		$request = $this->store->load( $post->ID );
		if ( ! $request ) return;
		?>
		<table class="widefat striped mkl-pc-quote-fields">
			<tbody>
				<?php foreach ( $request->get_field_rows() as $row ) : ?>
					<tr>
						<th scope="row"><?php echo esc_html( wp_strip_all_tags( $row['label'] ) ); ?></th>
						<td><?php echo wp_kses_post( nl2br( make_clickable( esc_html( $row['value'] ) ) ) ); ?></td>
					</tr>
				<?php endforeach; ?>
			</tbody>
		</table>
		<?php mkl_pc( 'quotes' )->uploads->render_list( $request ); ?>
		<?php if ( $request->get_email() ) : ?>
			<p><a class="button" href="<?php echo esc_url( 'mailto:' . $request->get_email() . '?subject=' . rawurlencode( $request->reference ) ); ?>"><?php esc_html_e( 'Reply by email', 'product-configurator-for-woocommerce' ); ?></a></p>
		<?php endif;
	}

	/**
	 * @param \WP_Post $post
	 * @return void
	 */
	public function render_status( $post ) {
		wp_nonce_field( 'mkl_pc_quote_status', 'mkl_pc_quote_status_nonce' );
		$notes = get_post_meta( $post->ID, '_mkl_pc_quote_notes', true );
		?>
		<p>
			<label for="mkl_pc_quote_status_field"><?php esc_html_e( 'Status', 'product-configurator-for-woocommerce' ); ?></label>
			<select id="mkl_pc_quote_status_field" name="mkl_pc_quote_status" class="widefat">
				<?php foreach ( CPT_Store::get_statuses() as $status => $label ) : ?>
					<option value="<?php echo esc_attr( $status ); ?>" <?php selected( $post->post_status, $status ); ?>><?php echo esc_html( $label ); ?></option>
				<?php endforeach; ?>
			</select>
		</p>
		<p>
			<label for="mkl_pc_quote_notes_field"><?php esc_html_e( 'Internal notes', 'product-configurator-for-woocommerce' ); ?></label>
			<textarea id="mkl_pc_quote_notes_field" name="mkl_pc_quote_notes" class="widefat" rows="5"><?php echo esc_textarea( $notes ); ?></textarea>
		</p>
		<?php
		/**
		 * In the status box of a stored quote request, before the save button
		 *
		 * @param \WP_Post $post
		 */
		do_action( 'mkl_pc/admin/quote_request/status_box', $post );
		?>
		<p class="mkl-pc-quote-actions">
			<?php if ( current_user_can( 'delete_post', $post->ID ) ) : ?>
				<a class="submitdelete deletion" href="<?php echo esc_url( get_delete_post_link( $post->ID ) ); ?>"><?php esc_html_e( 'Move to Trash', 'product-configurator-for-woocommerce' ); ?></a>
			<?php endif; ?>
			<button type="submit" name="save" class="button button-primary"><?php esc_html_e( 'Save', 'product-configurator-for-woocommerce' ); ?></button>
		</p>
		<?php
	}

	/**
	 * Save the status and notes
	 *
	 * @param int      $post_id
	 * @param \WP_Post $post
	 * @return void
	 */
	public function save( $post_id, $post ) {
		if ( ! isset( $_POST['mkl_pc_quote_status_nonce'] ) || ! wp_verify_nonce( sanitize_key( wp_unslash( $_POST['mkl_pc_quote_status_nonce'] ) ), 'mkl_pc_quote_status' ) ) return;
		if ( defined( 'DOING_AUTOSAVE' ) && DOING_AUTOSAVE ) return;
		if ( ! current_user_can( 'edit_post', $post_id ) ) return;

		if ( isset( $_POST['mkl_pc_quote_notes'] ) ) {
			update_post_meta( $post_id, '_mkl_pc_quote_notes', sanitize_textarea_field( wp_unslash( $_POST['mkl_pc_quote_notes'] ) ) );
		}

		$status = isset( $_POST['mkl_pc_quote_status'] ) ? sanitize_key( wp_unslash( $_POST['mkl_pc_quote_status'] ) ) : '';
		if ( $status && $status !== $post->post_status && array_key_exists( $status, CPT_Store::get_statuses() ) ) {
			remove_action( 'save_post_' . CPT_Store::POST_TYPE, [ $this, 'save' ], 10 );
			wp_update_post( [ 'ID' => $post_id, 'post_status' => $status ] );
			add_action( 'save_post_' . CPT_Store::POST_TYPE, [ $this, 'save' ], 10, 2 );
		}
	}

	/**
	 * A few styles for the list and the request screen
	 *
	 * @return void
	 */
	public function styles() {
		$screen = get_current_screen();
		if ( ! $screen || CPT_Store::POST_TYPE !== $screen->post_type ) return;
		?>
		<style>
			.column-mkl_pc_quote_image { width: 56px; }
			.mkl-pc-quote-status { display: inline-block; padding: 2px 8px; border-radius: 4px; background: #e5e5e5; color: #454545; }
			.mkl-pc-quote-status.status-mkl_quote_new { background: #c6e1c6; color: #2c4700; }
			.mkl-pc-quote-status.status-mkl_quote_progress { background: #f8dda7; color: #573b00; }
			.mkl-pc-quote-status.status-mkl_quote_answered { background: #c8d7e1; color: #003d66; }
			.mkl-pc-quote-reference { padding: 0 !important; font-size: 1.3em !important; }
			.mkl-pc-quote-request { display: flex; gap: 16px; align-items: flex-start; }
			.mkl-pc-quote-image img { width: 160px; height: auto; border: 1px solid #ddd; }
			.mkl-pc-quote-fields th { width: 30%; }
			.mkl-pc-quote-actions { display: flex; justify-content: space-between; align-items: center; }
		</style>
		<?php
	}
}
