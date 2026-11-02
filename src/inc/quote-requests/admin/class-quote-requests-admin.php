<?php
namespace MKL\PC;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Screens for quote requests kept as posts
 *
 * The list shows who asked for what. A request opens with what was configured, which the merchant can
 * configure again in a dialog (Quote_Request_Target), the customer's details, which they can correct
 * or take from a customer account, and a status box to follow it up and send the quote. "Add request"
 * makes one for a customer who did not use the configurator: their details, a product to configure,
 * then Save and send.
 */
class Quote_Requests_Admin {

	const NOTICES = 'mkl_pc_quote_notices_';

	/**
	 * @var CPT_Store
	 */
	private $store;

	/**
	 * @var boolean While save() writes the post, which runs save_post again.
	 */
	private $saving = false;

	public function __construct( CPT_Store $store ) {
		$this->store = $store;
		$type = CPT_Store::POST_TYPE;
		add_filter( "manage_{$type}_posts_columns", [ $this, 'columns' ] );
		add_action( "manage_{$type}_posts_custom_column", [ $this, 'render_column' ], 10, 2 );
		add_filter( 'post_row_actions', [ $this, 'row_actions' ], 10, 2 );
		add_filter( "bulk_actions-edit-{$type}", [ $this, 'bulk_actions' ] );
		add_action( "add_meta_boxes_{$type}", [ $this, 'meta_boxes' ] );
		add_action( "save_post_{$type}", [ $this, 'save' ], 10, 2 );
		add_filter( 'post_updated_messages', [ $this, 'updated_messages' ] );
		add_action( 'admin_notices', [ $this, 'notices' ] );
		add_action( 'admin_enqueue_scripts', [ $this, 'enqueue' ] );
		add_action( 'wp_ajax_mkl_pc_quote_configuration', [ $this, 'ajax_configuration' ] );
		add_action( 'wp_ajax_mkl_pc_quote_customer_details', [ $this, 'ajax_customer_details' ] );
		add_action( 'wp_ajax_mkl_pc_quote_search_customers', [ $this, 'ajax_search_customers' ] );
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
				if ( ! $product_id ) break;
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
		if ( $this->store->get_log( $post->ID ) ) {
			add_meta_box( 'mkl_pc_quote_log', __( 'History', 'product-configurator-for-woocommerce' ), [ $this, 'render_log' ], CPT_Store::POST_TYPE, 'side', 'default' );
		}
	}

	/**
	 * @param \WP_Post $post
	 * @return void
	 */
	public function render_request( $post ) {
		$request = $this->store->load( $post->ID );
		if ( ! $request ) return;
		echo '<div class="mkl-pc-quote-configuration" data-post="' . (int) $post->ID . '">';
		$this->render_configuration( $request );
		echo '</div>';
	}

	/**
	 * What was configured, and the buttons to configure it again
	 *
	 * @param Quote_Request $request
	 * @return void
	 */
	public function render_configuration( Quote_Request $request ) {
		if ( $request->reference ) : ?>
			<h2 class="mkl-pc-quote-reference"><?php echo esc_html( $request->reference ); ?></h2>
		<?php endif;

		if ( '' === $request->configuration_raw ) {
			echo '<p>' . esc_html__( 'No product configured yet.', 'product-configurator-for-woocommerce' ) . '</p>';
			$this->configuration_buttons( $request );
			return;
		}

		$product = $request->get_product();
		?>
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
					<p><?php esc_html_e( 'Configured price:', 'product-configurator-for-woocommerce' ); ?> <?php echo wp_kses_post( wc_price( $request->price['line_total'] ) ); ?></p>
				<?php endif; ?>
				<?php $this->configuration_buttons( $request ); ?>
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
	 * @param Quote_Request $request
	 * @return void
	 */
	private function configuration_buttons( Quote_Request $request ) {
		$editor = mkl_pc( 'configuration_editor' );
		$type = $editor && function_exists( 'wc_get_product' ) ? $editor->get_target_type( 'quote' ) : null;
		if ( ! $type || ! $type->current_user_can() ) return;
		$base = 'quote:' . $request->id;
		echo '<p class="mkl-pc-quote-configuration-actions">';
		if ( '' === $request->configuration_raw ) {
			$editor->add_button( $base, __( 'Choose a product', 'product-configurator-for-woocommerce' ), 'button-primary' );
		} else {
			$resolved = $editor->resolve_target( $base );
			if ( ! is_wp_error( $resolved ) ) {
				$editor->edit_button( $base, $resolved['product'], __( 'Edit the configuration', 'product-configurator-for-woocommerce' ) );
			}
			$editor->add_button( $base, __( 'Change the product', 'product-configurator-for-woocommerce' ) );
		}
		echo '</p>';
	}

	/**
	 * The configuration box again, after the configurator saved
	 *
	 * @return void
	 */
	public function ajax_configuration() {
		check_ajax_referer( 'mkl_pc_configuration_editor', 'security' );
		$post_id = isset( $_POST['post_id'] ) ? absint( $_POST['post_id'] ) : 0;
		if ( ! $post_id || ! current_user_can( 'edit_post', $post_id ) ) wp_die( -1 );
		$request = $this->store->load( $post_id );
		if ( ! $request ) wp_die( -1 );
		ob_start();
		$this->render_configuration( $request );
		wp_send_json_success( [
			'html'  => ob_get_clean(),
			'price' => $this->get_price_placeholder( $request ),
		] );
	}

	/**
	 * The fields of the customer box
	 *
	 * Those the request was made with; for a request made here, the form's fields as they are now, but
	 * its checkboxes (consents, opt-ins), which are the customer's to tick.
	 *
	 * @param Quote_Request $request
	 * @return array Keyed by field id: label, type, options, maps_to.
	 */
	private function get_field_definitions( Quote_Request $request ) {
		if ( ! empty( $request->field_definitions ) ) return $request->field_definitions;
		$context = $request->product_id ? [ 'product_id' => $request->product_id, 'configurator_id' => $request->configurator_id ] : [];
		$definitions = [];
		foreach ( mkl_pc( 'quotes' )->fields->get_fields( $context ) as $field_id => $field ) {
			if ( 'checkbox' === $field['type'] ) continue;
			$definitions[ $field_id ] = [
				'label'   => $field['label'],
				'type'    => $field['type'],
				'options' => $field['options'],
				'maps_to' => $field['maps_to'],
			];
		}
		return $definitions;
	}

	/**
	 * @param \WP_Post $post
	 * @return void
	 */
	public function render_contact( $post ) {
		$request = $this->store->load( $post->ID );
		if ( ! $request ) return;
		?>
		<input type="hidden" name="mkl_pc_quote_fields_shown" value="1" />
		<table class="form-table mkl-pc-quote-fields" role="presentation">
			<tbody>
				<?php if ( $this->can_pick_customer() ) : ?>
					<tr>
						<th scope="row"><label for="mkl_pc_quote_user_field"><?php esc_html_e( 'Customer account', 'product-configurator-for-woocommerce' ); ?></label></th>
						<td><?php $this->render_customer_picker( $request ); ?></td>
					</tr>
				<?php endif; ?>
				<?php foreach ( $this->get_field_definitions( $request ) as $field_id => $field ) : ?>
					<tr>
						<th scope="row"><label for="mkl_pc_quote_field_<?php echo esc_attr( $field_id ); ?>"><?php echo esc_html( wp_strip_all_tags( $field['label'] ) ); ?></label></th>
						<td><?php $this->render_field( $field_id, $field, $request->get_field( $field_id ) ); ?></td>
					</tr>
				<?php endforeach; ?>
			</tbody>
		</table>
		<?php if ( $request->get_email() ) : ?>
			<p><a class="button" href="<?php echo esc_url( 'mailto:' . $request->get_email() . '?subject=' . rawurlencode( $request->reference ) ); ?>"><?php esc_html_e( 'Reply by email', 'product-configurator-for-woocommerce' ); ?></a></p>
		<?php endif;
	}

	/**
	 * One input of the customer box. Types it does not know are shown, not edited.
	 *
	 * @param string $field_id
	 * @param array  $field
	 * @param mixed  $value
	 * @return void
	 */
	private function render_field( $field_id, $field, $value ) {
		$id = 'mkl_pc_quote_field_' . $field_id;
		$name = 'mkl_pc_quote_fields[' . $field_id . ']';
		// Filled from a customer account picked above (see enqueue()).
		$maps_to = ! empty( $field['maps_to'] ) ? ' data-maps-to="' . esc_attr( $field['maps_to'] ) . '"' : '';
		$options = ! empty( $field['options'] ) && is_array( $field['options'] ) ? $field['options'] : [];
		switch ( $field['type'] ) {
			case 'textarea':
				printf( '<textarea id="%s" name="%s" rows="4" class="large-text"%s>%s</textarea>', esc_attr( $id ), esc_attr( $name ), $maps_to, esc_textarea( (string) $value ) ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Escaped above.
				break;
			case 'checkbox':
				printf( '<input type="checkbox" id="%s" name="%s" value="1" %s />', esc_attr( $id ), esc_attr( $name ), checked( (bool) $value, true, false ) );
				break;
			case 'select':
			case 'radio':
				printf( '<select id="%s" name="%s"><option value="">%s</option>', esc_attr( $id ), esc_attr( $name ), esc_html__( '—', 'product-configurator-for-woocommerce' ) );
				foreach ( $options as $option => $label ) {
					printf( '<option value="%s" %s>%s</option>', esc_attr( $option ), selected( (string) $value, (string) $option, false ), esc_html( $label ) );
				}
				echo '</select>';
				break;
			case 'text':
			case 'email':
			case 'tel':
			case 'number':
			case 'date':
				printf( '<input type="%s" id="%s" name="%s" value="%s" class="regular-text"%s />', esc_attr( $field['type'] ), esc_attr( $id ), esc_attr( $name ), esc_attr( is_scalar( $value ) ? (string) $value : '' ), $maps_to ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Escaped above.
				break;
			default:
				echo wp_kses_post( nl2br( esc_html( is_scalar( $value ) ? (string) $value : '' ) ) );
		}
	}

	/**
	 * Whether the current user may link a request to a customer account
	 *
	 * Searching accounts lists the site's users.
	 *
	 * @return boolean
	 */
	private function can_pick_customer() {
		return current_user_can( 'list_users' );
	}

	/**
	 * @param \WP_User $user
	 * @return string
	 */
	private function format_user( $user ) {
		return sprintf( '%1$s (#%2$d – %3$s)', $user->display_name, $user->ID, $user->user_email );
	}

	/**
	 * The request's account, and a search among the site's users to change it (quote-request-screen.js)
	 *
	 * @param Quote_Request $request
	 * @return void
	 */
	private function render_customer_picker( Quote_Request $request ) {
		$user = $request->user_id ? get_userdata( $request->user_id ) : null;
		?>
		<div class="mkl-pc-quote-user">
			<input type="hidden" name="mkl_pc_quote_user_shown" value="1" />
			<input type="hidden" name="mkl_pc_quote_user_id" value="<?php echo (int) ( $user ? $user->ID : 0 ); ?>" />
			<p class="mkl-pc-quote-user__account">
				<span class="mkl-pc-quote-user__current"><?php echo esc_html( $user ? $this->format_user( $user ) : __( 'Guest', 'product-configurator-for-woocommerce' ) ); ?></span>
				<?php if ( $user && current_user_can( 'edit_user', $user->ID ) ) : ?>
					<a href="<?php echo esc_url( get_edit_user_link( $user->ID ) ); ?>" class="mkl-pc-quote-user__profile"><?php esc_html_e( 'Profile', 'product-configurator-for-woocommerce' ); ?></a>
				<?php endif; ?>
				<button type="button" class="button-link mkl-pc-quote-user__clear" <?php echo $user ? '' : 'hidden'; ?>><?php esc_html_e( 'Remove', 'product-configurator-for-woocommerce' ); ?></button>
			</p>
			<div class="mkl-pc-search-dropdown mkl-pc-quote-user__dropdown">
				<input type="search" id="mkl_pc_quote_user_field" class="mkl-pc-quote-user__search" autocomplete="off" placeholder="<?php esc_attr_e( 'Search accounts by name or email…', 'product-configurator-for-woocommerce' ); ?>" aria-describedby="mkl_pc_quote_user_description" aria-controls="mkl_pc_quote_user_results" aria-expanded="false" />
				<ul id="mkl_pc_quote_user_results" class="mkl-pc-quote-user__results mkl-pc-search-dropdown__results"></ul>
			</div>
			<?php // The live region stays; the script puts a notice in it (quote-request-screen.js). ?>
			<div class="mkl-pc-quote-user__status" role="status"></div>
			<p id="mkl_pc_quote_user_description" class="description">
				<?php
				esc_html_e( 'Picking an account fills in the empty details below.', 'product-configurator-for-woocommerce' );
				if ( mkl_pc( 'quotes' )->woo_order_store->is_available() ) {
					echo ' ' . esc_html__( 'Orders made from this request belong to it.', 'product-configurator-for-woocommerce' );
				}
				?>
			</p>
		</div>
		<?php
	}

	/**
	 * Accounts matching a search, for the picker
	 *
	 * @return void
	 */
	public function ajax_search_customers() {
		check_ajax_referer( 'mkl_pc_quote_customer', 'security' );
		if ( ! $this->can_pick_customer() ) wp_die( -1 );
		$term = isset( $_GET['term'] ) ? sanitize_text_field( wp_unslash( $_GET['term'] ) ) : '';
		if ( mb_strlen( $term ) < 2 ) wp_send_json( [] );
		$args = [ 'number' => 20, 'orderby' => 'display_name', 'fields' => 'ID' ];
		$ids = array_merge(
			get_users( $args + [ 'search' => '*' . $term . '*', 'search_columns' => [ 'user_login', 'user_email', 'user_nicename', 'display_name' ] ] ),
			// phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_query -- An admin search, 20 results.
			get_users( $args + [ 'meta_query' => [ 'relation' => 'OR', [ 'key' => 'first_name', 'value' => $term, 'compare' => 'LIKE' ], [ 'key' => 'last_name', 'value' => $term, 'compare' => 'LIKE' ] ] ] )
		);
		$found = [];
		foreach ( array_slice( array_unique( array_map( 'intval', $ids ) ), 0, 20 ) as $user_id ) {
			$user = get_userdata( $user_id );
			if ( $user ) $found[] = [ 'id' => $user->ID, 'label' => $this->format_user( $user ) ];
		}
		wp_send_json( $found );
	}

	/**
	 * @return void
	 */
	public function ajax_customer_details() {
		check_ajax_referer( 'mkl_pc_quote_customer', 'security' );
		if ( ! $this->can_pick_customer() ) wp_die( -1 );
		$details = mkl_pc( 'quotes' )->fields->get_account_details( isset( $_POST['user_id'] ) ? absint( $_POST['user_id'] ) : 0 );
		if ( ! $details ) wp_send_json_error();
		wp_send_json_success( $details );
	}

	/**
	 * The configured price, as the quoted price field's placeholder
	 *
	 * @param Quote_Request $request
	 * @return string
	 */
	private function get_price_placeholder( Quote_Request $request ) {
		if ( ! function_exists( 'wc_format_localized_price' ) || ! is_array( $request->price ) || ! isset( $request->price['line_total'] ) ) return '';
		return wc_format_localized_price( wc_format_decimal( $request->price['line_total'], wc_get_price_decimals() ) );
	}

	/**
	 * @param \WP_Post $post
	 * @return void
	 */
	public function render_status( $post ) {
		wp_nonce_field( 'mkl_pc_quote_status', 'mkl_pc_quote_status_nonce' );
		$request = $this->store->load( $post->ID );
		$notes = get_post_meta( $post->ID, '_mkl_pc_quote_notes', true );
		// A request made here is being worked on.
		$current = array_key_exists( $post->post_status, CPT_Store::get_statuses() ) ? $post->post_status : 'mkl_quote_progress';
		?>
		<p>
			<label for="mkl_pc_quote_status_field"><?php esc_html_e( 'Status', 'product-configurator-for-woocommerce' ); ?></label>
			<select id="mkl_pc_quote_status_field" name="mkl_pc_quote_status" class="widefat">
				<?php foreach ( CPT_Store::get_statuses() as $status => $label ) : ?>
					<option value="<?php echo esc_attr( $status ); ?>" <?php selected( $current, $status ); ?>><?php echo esc_html( $label ); ?></option>
				<?php endforeach; ?>
			</select>
		</p>
		<p>
			<label for="mkl_pc_quote_notes_field"><?php esc_html_e( 'Internal notes', 'product-configurator-for-woocommerce' ); ?></label>
			<textarea id="mkl_pc_quote_notes_field" name="mkl_pc_quote_notes" class="widefat" rows="4"><?php echo esc_textarea( $notes ); ?></textarea>
		</p>
		<?php if ( $request && function_exists( 'wc_format_localized_price' ) ) : ?>
			<p>
				<label for="mkl_pc_quote_price_field">
					<?php
					/* translators: %s: currency symbol */
					echo esc_html( sprintf( __( 'Quoted price (%s)', 'product-configurator-for-woocommerce' ), html_entity_decode( get_woocommerce_currency_symbol(), ENT_QUOTES, get_bloginfo( 'charset' ) ) ) );
					?>
				</label>
				<input type="text" inputmode="decimal" id="mkl_pc_quote_price_field" name="mkl_pc_quote_price" class="widefat" value="<?php echo esc_attr( null === $request->quoted_price ? '' : wc_format_localized_price( $request->quoted_price ) ); ?>" placeholder="<?php echo esc_attr( $this->get_price_placeholder( $request ) ); ?>" aria-describedby="mkl_pc_quote_price_description" />
				<span id="mkl_pc_quote_price_description" class="description"><?php esc_html_e( 'Total for the quantity, sent with the quote. Leave empty to send the configured price.', 'product-configurator-for-woocommerce' ); ?></span>
			</p>
		<?php endif; ?>
		<p>
			<label for="mkl_pc_quote_message_field"><?php esc_html_e( 'Message to the customer', 'product-configurator-for-woocommerce' ); ?></label>
			<textarea id="mkl_pc_quote_message_field" name="mkl_pc_quote_message" class="widefat" rows="4" aria-describedby="mkl_pc_quote_message_description"><?php echo esc_textarea( (string) get_post_meta( $post->ID, '_mkl_pc_quote_message', true ) ); ?></textarea>
			<span id="mkl_pc_quote_message_description" class="description"><?php esc_html_e( 'Added to the quote email.', 'product-configurator-for-woocommerce' ); ?></span>
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
			<?php if ( 'auto-draft' !== $post->post_status && current_user_can( 'delete_post', $post->ID ) ) : ?>
				<a class="submitdelete deletion" href="<?php echo esc_url( get_delete_post_link( $post->ID ) ); ?>"><?php esc_html_e( 'Move to Trash', 'product-configurator-for-woocommerce' ); ?></a>
			<?php endif; ?>
			<button type="submit" name="save" class="button"><?php esc_html_e( 'Save', 'product-configurator-for-woocommerce' ); ?></button>
		</p>
		<p>
			<button type="submit" name="mkl_pc_quote_send" value="1" class="button button-primary mkl-pc-quote-send"><?php esc_html_e( 'Save and send the quote', 'product-configurator-for-woocommerce' ); ?></button>
		</p>
		<?php
		$sent = (int) get_post_meta( $post->ID, '_mkl_pc_quote_sent', true );
		if ( $sent ) {
			/* translators: %s: date */
			echo '<p class="description">' . esc_html( sprintf( __( 'Last sent on %s.', 'product-configurator-for-woocommerce' ), wp_date( get_option( 'date_format' ) . ' ' . get_option( 'time_format' ), $sent ) ) ) . '</p>';
		}
	}

	/**
	 * @param \WP_Post $post
	 * @return void
	 */
	public function render_log( $post ) {
		echo '<ul class="mkl-pc-quote-log">';
		foreach ( array_reverse( $this->store->get_log( $post->ID ) ) as $entry ) {
			$user = ! empty( $entry['user_id'] ) ? get_userdata( $entry['user_id'] ) : null;
			printf(
				'<li><span class="mkl-pc-quote-log__message">%s</span><span class="mkl-pc-quote-log__meta">%s</span></li>',
				esc_html( $entry['message'] ),
				esc_html( wp_date( get_option( 'date_format' ) . ' ' . get_option( 'time_format' ), (int) $entry['time'] ) . ( $user ? ' · ' . $user->display_name : '' ) )
			);
		}
		echo '</ul>';
	}

	/**
	 * Save the request's details and status, and send the quote when asked
	 *
	 * @param int      $post_id
	 * @param \WP_Post $post
	 * @return void
	 */
	public function save( $post_id, $post ) {
		if ( $this->saving ) return;
		if ( ! isset( $_POST['mkl_pc_quote_status_nonce'] ) || ! wp_verify_nonce( sanitize_key( wp_unslash( $_POST['mkl_pc_quote_status_nonce'] ) ), 'mkl_pc_quote_status' ) ) return;
		if ( defined( 'DOING_AUTOSAVE' ) && DOING_AUTOSAVE ) return;
		if ( ! current_user_can( 'edit_post', $post_id ) ) return;
		$request = $this->store->load( $post_id );
		if ( ! $request ) return;

		$this->saving = true;
		$notices = [];

		if ( isset( $_POST['mkl_pc_quote_notes'] ) ) {
			update_post_meta( $post_id, '_mkl_pc_quote_notes', sanitize_textarea_field( wp_unslash( $_POST['mkl_pc_quote_notes'] ) ) );
		}
		$message = isset( $_POST['mkl_pc_quote_message'] ) ? sanitize_textarea_field( wp_unslash( $_POST['mkl_pc_quote_message'] ) ) : '';
		update_post_meta( $post_id, '_mkl_pc_quote_message', wp_slash( $message ) );

		if ( isset( $_POST['mkl_pc_quote_fields_shown'] ) ) {
			$definitions = $this->get_field_definitions( $request );
			// phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized -- Sanitized per field by Quote_Fields::clean().
			$raw = isset( $_POST['mkl_pc_quote_fields'] ) && is_array( $_POST['mkl_pc_quote_fields'] ) ? wp_unslash( $_POST['mkl_pc_quote_fields'] ) : [];
			$clean = mkl_pc( 'quotes' )->fields->clean( $raw, $definitions );
			$request->fields = array_merge( $request->fields, $clean['values'] );
			$request->field_definitions = $definitions;
			foreach ( $clean['errors'] as $error ) {
				$notices[] = [ 'error', $error . ' ' . __( 'The previous value was kept.', 'product-configurator-for-woocommerce' ) ];
			}
		}

		$account_log = '';
		if ( isset( $_POST['mkl_pc_quote_user_shown'] ) && $this->can_pick_customer() ) {
			$user_id = isset( $_POST['mkl_pc_quote_user_id'] ) ? absint( $_POST['mkl_pc_quote_user_id'] ) : 0;
			$user = $user_id ? get_userdata( $user_id ) : null;
			if ( ! $user_id || $user ) {
				if ( $user_id !== $request->user_id ) {
					$account_log = $user
						/* translators: 1: user name, 2: email address */
						? sprintf( __( 'Customer account: %1$s (%2$s).', 'product-configurator-for-woocommerce' ), $user->display_name, $user->user_email )
						: __( 'Customer account removed: the request is a guest\'s.', 'product-configurator-for-woocommerce' );
				}
				$request->user_id = $user_id;
			}
		}

		if ( isset( $_POST['mkl_pc_quote_price'] ) && function_exists( 'wc_format_decimal' ) ) {
			$price = wc_format_decimal( sanitize_text_field( wp_unslash( $_POST['mkl_pc_quote_price'] ) ) );
			$request->quoted_price = '' === $price ? null : (float) $price;
		}

		if ( ! $request->reference ) {
			$request->reference = mkl_pc( 'quotes' )->service->generate_reference();
			$request->created = time();
		}

		$saved = $this->store->save( $request );
		if ( is_wp_error( $saved ) ) {
			$notices[] = [ 'error', $saved->get_error_message() ];
		} elseif ( $account_log ) {
			$this->store->log( $post_id, $account_log );
		}

		$status = isset( $_POST['mkl_pc_quote_status'] ) ? sanitize_key( wp_unslash( $_POST['mkl_pc_quote_status'] ) ) : '';
		if ( ! empty( $_POST['mkl_pc_quote_send'] ) && ! is_wp_error( $saved ) ) {
			$sent = $this->send( $request, $message );
			if ( is_wp_error( $sent ) ) {
				$notices[] = [ 'error', $sent->get_error_message() ];
			} else {
				$status = 'mkl_quote_answered';
				delete_post_meta( $post_id, '_mkl_pc_quote_message' );
				/* translators: %s: email address */
				$notices[] = [ 'success', sprintf( __( 'Quote sent to %s.', 'product-configurator-for-woocommerce' ), $request->get_email() ) ];
			}
		}

		if ( $status && $status !== get_post_status( $post_id ) && array_key_exists( $status, CPT_Store::get_statuses() ) ) {
			wp_update_post( [ 'ID' => $post_id, 'post_status' => $status ] );
		}

		$this->saving = false;
		if ( $notices ) {
			set_transient( self::NOTICES . get_current_user_id(), $notices, MINUTE_IN_SECONDS );
		}
	}

	/**
	 * Email the quote to the customer
	 *
	 * @param Quote_Request $request
	 * @param string        $message What the merchant wrote for them.
	 * @return true|\WP_Error
	 */
	public function send( Quote_Request $request, $message = '' ) {
		if ( '' === $request->configuration_raw ) {
			return new \WP_Error( 'mkl_pc_quote_not_configured', __( 'Choose and configure a product before sending the quote.', 'product-configurator-for-woocommerce' ) );
		}
		if ( ! is_email( $request->get_email() ) ) {
			return new \WP_Error( 'mkl_pc_quote_no_email', __( "Enter the customer's email address before sending the quote.", 'product-configurator-for-woocommerce' ) );
		}
		if ( ! mkl_pc( 'mailer' )->send( 'mkl_pc_quote_request_quote', $request, [ 'message' => $message ] ) ) {
			return new \WP_Error( 'mkl_pc_quote_not_sent', __( 'The quote could not be sent. Check that the "Configurator quote" email is enabled in WooCommerce > Settings > Emails.', 'product-configurator-for-woocommerce' ) );
		}
		$price = $request->get_line_price();
		$log = null !== $price && function_exists( 'wc_price' )
			/* translators: 1: email address, 2: price */
			? sprintf( __( 'Quote sent to %1$s, for %2$s.', 'product-configurator-for-woocommerce' ), $request->get_email(), html_entity_decode( wp_strip_all_tags( wc_price( $price ) ), ENT_QUOTES, get_bloginfo( 'charset' ) ) )
			/* translators: %s: email address */
			: sprintf( __( 'Quote sent to %s.', 'product-configurator-for-woocommerce' ), $request->get_email() );
		$this->store->log( $request->id, $log );
		update_post_meta( $request->id, '_mkl_pc_quote_sent', time() );

		/**
		 * Fires once the quote was emailed to the customer
		 *
		 * @param Quote_Request $request
		 * @param string        $message
		 */
		do_action( 'mkl_pc/quote_request/quote_sent', $request, $message );
		return true;
	}

	/**
	 * @param array $messages
	 * @return array
	 */
	public function updated_messages( $messages ) {
		$saved = __( 'Quote request saved.', 'product-configurator-for-woocommerce' );
		$messages[ CPT_Store::POST_TYPE ] = [ 0 => '', 1 => $saved, 4 => $saved, 6 => $saved, 7 => $saved, 10 => $saved ];
		return $messages;
	}

	/**
	 * What the last save said
	 *
	 * @return void
	 */
	public function notices() {
		$screen = get_current_screen();
		if ( ! $screen || CPT_Store::POST_TYPE !== $screen->post_type ) return;
		$key = self::NOTICES . get_current_user_id();
		$notices = get_transient( $key );
		if ( ! is_array( $notices ) ) return;
		delete_transient( $key );
		foreach ( $notices as $notice ) {
			printf( '<div class="notice notice-%s is-dismissible"><p>%s</p></div>', esc_attr( $notice[0] ), esc_html( $notice[1] ) );
		}
	}

	/**
	 * The screen's script, and the configurator dialog
	 *
	 * @return void
	 */
	public function enqueue() {
		$screen = get_current_screen();
		if ( ! $screen || CPT_Store::POST_TYPE !== $screen->post_type || 'post' !== $screen->base ) return;
		$deps = [ 'jquery' ];
		$editor = mkl_pc( 'configuration_editor' );
		if ( $editor && function_exists( 'wc_get_product' ) ) {
			$editor->enqueue_dialog( 'quote' );
			$deps[] = 'mkl_pc/admin/js/configuration_editor_dialog';
		}
		$file = 'admin/js/quote-request-screen.js';
		wp_enqueue_script( 'mkl_pc/admin/js/quote_request_screen', MKL_PC_ASSETS_URL . $file, $deps, filemtime( MKL_PC_ASSETS_PATH . $file ), true );
		wp_enqueue_style( 'mkl_pc/admin/css/search_dropdown' );
		wp_localize_script( 'mkl_pc/admin/js/quote_request_screen', 'PC_quote_screen', [
			'ajax_url' => admin_url( 'admin-ajax.php' ),
			'nonce'    => wp_create_nonce( 'mkl_pc_quote_customer' ),
			'lang'     => [
				'guest'      => __( 'Guest', 'product-configurator-for-woocommerce' ),
				'searching'  => __( 'Searching…', 'product-configurator-for-woocommerce' ),
				'no_results' => __( 'No account found.', 'product-configurator-for-woocommerce' ),
				'picked'     => __( 'Account picked. Save the request to keep it.', 'product-configurator-for-woocommerce' ),
			],
		] );
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
			.mkl-pc-quote-configuration { transition: opacity .15s; }
			.mkl-pc-quote-request { display: flex; gap: 16px; align-items: flex-start; }
			.mkl-pc-quote-image img { width: 160px; height: auto; border: 1px solid #ddd; }
			.mkl-pc-quote-configuration-actions { display: flex; flex-wrap: wrap; gap: 8px; margin: 12px 0 0; }
			.mkl-pc-quote-fields th { width: 30%; padding-top: 14px; padding-bottom: 14px; }
			.mkl-pc-quote-fields td { padding-top: 8px; padding-bottom: 8px; }
			.mkl-pc-quote-user__account { display: flex; flex-wrap: wrap; gap: 4px 12px; align-items: baseline; margin: 0 0 8px; }
			.mkl-pc-quote-user__current { font-weight: 600; }
			.mkl-pc-quote-user__dropdown { max-width: 25em; }
			.mkl-pc-quote-user__search { width: 100%; }
			.mkl-pc-quote-user__status .notice { max-width: 25em; box-sizing: border-box; margin: 8px 0; }
			#mkl_pc_quote_status label { display: block; margin-bottom: 4px; font-weight: 600; }
			#mkl_pc_quote_status .description { display: block; margin-top: 4px; }
			.mkl-pc-quote-actions { display: flex; justify-content: space-between; align-items: center; }
			.mkl-pc-quote-send { width: 100%; text-align: center; }
			.mkl-pc-quote-log { margin: 0; }
			.mkl-pc-quote-log li { display: flex; flex-direction: column; gap: 2px; padding: 8px 0; margin: 0; border-bottom: 1px solid #f0f0f1; }
			.mkl-pc-quote-log li:last-child { border-bottom: 0; }
			.mkl-pc-quote-log__meta { color: #646970; font-size: 12px; }
		</style>
		<?php
	}
}
