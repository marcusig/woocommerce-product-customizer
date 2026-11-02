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
 * or take from a customer account (one using the same email is suggested), and a status box to follow
 * it up and send the quote. A user's profile offers to link the requests they sent as a guest. "Add request"
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
		add_filter( "views_edit-{$type}", [ $this, 'views' ] );
		add_action( "add_meta_boxes_{$type}", [ $this, 'meta_boxes' ] );
		add_action( "save_post_{$type}", [ $this, 'save' ], 10, 2 );
		add_filter( 'post_updated_messages', [ $this, 'updated_messages' ] );
		add_action( 'admin_notices', [ $this, 'notices' ] );
		add_action( 'admin_enqueue_scripts', [ $this, 'enqueue' ] );
		add_action( 'wp_ajax_mkl_pc_quote_configuration', [ $this, 'ajax_configuration' ] );
		add_action( 'wp_ajax_mkl_pc_quote_customer_details', [ $this, 'ajax_customer_details' ] );
		add_action( 'wp_ajax_mkl_pc_quote_search_customers', [ $this, 'ajax_search_customers' ] );
		add_action( 'show_user_profile', [ $this, 'profile_section' ] );
		add_action( 'edit_user_profile', [ $this, 'profile_section' ] );
		add_action( 'admin_post_mkl_pc_quote_link_requests', [ $this, 'link_requests' ] );
		add_action( 'admin_post_mkl_pc_quote_reset_key', [ $this, 'reset_key' ] );
		add_action( 'admin_notices', [ $this, 'linked_notice' ] );
		add_action( 'restrict_manage_posts', [ $this, 'list_filter' ], 10, 2 );
		add_action( 'pre_get_posts', [ $this, 'filter_list' ] );
		add_action( 'admin_notices', [ $this, 'customer_filter_notice' ] );
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
				$user = get_userdata( $this->store->get_user_id( $post_id ) );
				echo '<br><span class="mkl-pc-quote-account">';
				if ( $user ) {
					/* translators: %s: user name, linked to the requests of that account */
					printf( esc_html__( 'Account: %s', 'product-configurator-for-woocommerce' ), '<a href="' . esc_url( $this->get_customer_list_url( $user->ID ) ) . '">' . esc_html( $user->display_name ) . '</a>' );
				} else {
					esc_html_e( 'Guest', 'product-configurator-for-woocommerce' );
				}
				echo '</span>';
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
	 * No "Mine": a request's author is its customer, or the merchant who made it in the admin. The
	 * customer filter and the account links show whose requests they are.
	 *
	 * @param array $views
	 * @return array
	 */
	public function views( $views ) {
		unset( $views['mine'] );
		return $views;
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
		$this->render_customer_link( $request );
	}

	/**
	 * The link the customer's emails carry, and a way to change it
	 *
	 * @param Quote_Request $request
	 * @return void
	 */
	private function render_customer_link( Quote_Request $request ) {
		// A request being made here gets its link once saved.
		if ( 'auto-draft' === $request->status || ! $request->reference ) return;
		$url = $request->get_view_url();
		if ( ! $url ) return;
		$reset = wp_nonce_url( admin_url( 'admin-post.php?action=mkl_pc_quote_reset_key&post=' . $request->id ), 'mkl_pc_quote_reset_key_' . $request->id );
		?>
		<div class="mkl-pc-quote-customer-link">
			<label for="mkl_pc_quote_customer_link"><?php esc_html_e( 'Customer link', 'product-configurator-for-woocommerce' ); ?></label>
			<input type="text" id="mkl_pc_quote_customer_link" class="large-text code" value="<?php echo esc_attr( $url ); ?>" readonly onfocus="this.select();" aria-describedby="mkl_pc_quote_customer_link_description" />
			<p id="mkl_pc_quote_customer_link_description" class="description">
				<?php esc_html_e( 'Shows this request to whoever has the link, without an account. The customer emails carry it.', 'product-configurator-for-woocommerce' ); ?>
				<a href="<?php echo esc_url( $reset ); ?>" onclick="return window.confirm( <?php echo esc_attr( wp_json_encode( __( 'The link the customer has will stop working. Change it?', 'product-configurator-for-woocommerce' ) ) ); ?> );"><?php esc_html_e( 'Change the link', 'product-configurator-for-woocommerce' ); ?></a>
			</p>
		</div>
		<?php
	}

	/**
	 * admin-post handler of "Change the link"
	 *
	 * @return void
	 */
	public function reset_key() {
		$post_id = isset( $_GET['post'] ) ? absint( $_GET['post'] ) : 0;
		check_admin_referer( 'mkl_pc_quote_reset_key_' . $post_id );
		if ( CPT_Store::POST_TYPE !== get_post_type( $post_id ) || ! current_user_can( 'edit_post', $post_id ) ) {
			wp_die( esc_html__( 'You are not allowed to do this.', 'product-configurator-for-woocommerce' ), 403 );
		}
		$this->store->reset_access_key( $post_id );
		$this->store->log( $post_id, __( 'Customer link changed: the previous one no longer works.', 'product-configurator-for-woocommerce' ) );
		set_transient( self::NOTICES . get_current_user_id(), [ [ 'success', __( 'Customer link changed. Send the customer the new one.', 'product-configurator-for-woocommerce' ) ] ], MINUTE_IN_SECONDS );
		wp_safe_redirect( admin_url( 'post.php?post=' . $post_id . '&action=edit' ) );
		exit;
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
	 * @param \WP_User $user
	 * @return string
	 */
	private function get_account_log( $user ) {
		/* translators: 1: user name, 2: email address */
		return sprintf( __( 'Customer account: %1$s (%2$s).', 'product-configurator-for-woocommerce' ), $user->display_name, $user->user_email );
	}

	/**
	 * The addresses an account holder set: the account's email, and its WooCommerce billing email
	 *
	 * Unlike the email typed in a request form, which anyone can type.
	 *
	 * @param \WP_User $user
	 * @return string[]
	 */
	private function get_account_emails( $user ) {
		return array_values( array_unique( array_filter( [ $user->user_email, (string) get_user_meta( $user->ID, 'billing_email', true ) ] ) ) );
	}

	/**
	 * Accounts using an email, as their own or their billing email
	 *
	 * @param string $email
	 * @return \WP_User[]
	 */
	private function get_accounts_by_email( $email ) {
		$email = sanitize_email( $email );
		if ( ! is_email( $email ) ) return [];
		$ids = array_merge(
			get_users( [ 'search' => $email, 'search_columns' => [ 'user_email' ], 'fields' => 'ID', 'number' => 10 ] ),
			get_users( [ 'meta_key' => 'billing_email', 'meta_value' => $email, 'fields' => 'ID', 'number' => 10 ] ) // phpcs:ignore WordPress.DB.SlowDBQuery -- Admin only.
		);
		return array_values( array_filter( array_map( 'get_userdata', array_unique( array_map( 'intval', $ids ) ) ) ) );
	}

	/**
	 * Whether the current user may link a user's guest requests to their account
	 *
	 * @param int $user_id
	 * @return boolean
	 */
	private function can_link_requests( $user_id ) {
		$type = get_post_type_object( CPT_Store::POST_TYPE );
		return $this->can_pick_customer() && current_user_can( 'edit_user', $user_id ) && $type && current_user_can( $type->cap->edit_others_posts );
	}

	/**
	 * User profile: the account's quote requests, and those sent as a guest with its emails, to link
	 *
	 * @param \WP_User $user
	 * @return void
	 */
	public function profile_section( $user ) {
		if ( ! $this->can_list_customers() ) return;
		$linked = $this->store->count_user_requests( $user->ID );
		$guest_ids = $this->can_link_requests( $user->ID ) ? $this->store->get_guest_request_ids( $this->get_account_emails( $user ) ) : [];
		if ( ! $linked && ! $guest_ids ) return;
		?>
		<h2><?php esc_html_e( 'Quote requests', 'product-configurator-for-woocommerce' ); ?></h2>
		<table class="form-table" role="presentation">
			<?php if ( $linked ) : ?>
				<tr>
					<th scope="row"><?php esc_html_e( 'Linked to this account', 'product-configurator-for-woocommerce' ); ?></th>
					<td>
						<a href="<?php echo esc_url( $this->get_customer_list_url( $user->ID ) ); ?>">
							<?php
							/* translators: %d: number of quote requests */
							echo esc_html( sprintf( _n( '%d quote request', '%d quote requests', $linked, 'product-configurator-for-woocommerce' ), $linked ) );
							?>
						</a>
					</td>
				</tr>
			<?php endif; ?>
			<?php if ( $guest_ids ) : ?>
				<?php $url = wp_nonce_url( admin_url( 'admin-post.php?action=mkl_pc_quote_link_requests&user_id=' . $user->ID ), 'mkl_pc_quote_link_requests_' . $user->ID ); ?>
				<tr>
					<th scope="row"><?php esc_html_e( 'Sent as a guest', 'product-configurator-for-woocommerce' ); ?></th>
					<td>
						<p>
							<?php
							/* translators: %d: number of quote requests */
							echo esc_html( sprintf( _n( '%d quote request was sent as a guest with this account\'s email address:', '%d quote requests were sent as a guest with this account\'s email addresses:', count( $guest_ids ), 'product-configurator-for-woocommerce' ), count( $guest_ids ) ) );
							?>
						</p>
						<ul>
							<?php foreach ( array_slice( $guest_ids, 0, 10 ) as $post_id ) : ?>
								<li><a href="<?php echo esc_url( admin_url( 'post.php?post=' . $post_id . '&action=edit' ) ); ?>"><?php echo esc_html( get_the_title( $post_id ) ); ?></a> – <?php echo esc_html( get_the_date( '', $post_id ) ); ?></li>
							<?php endforeach; ?>
							<?php if ( count( $guest_ids ) > 10 ) : ?>
								<li>
									<?php
									/* translators: %d: number of quote requests */
									echo esc_html( sprintf( __( 'and %d more', 'product-configurator-for-woocommerce' ), count( $guest_ids ) - 10 ) );
									?>
								</li>
							<?php endif; ?>
						</ul>
						<p><a class="button" href="<?php echo esc_url( $url ); ?>"><?php esc_html_e( 'Link them to this account', 'product-configurator-for-woocommerce' ); ?></a></p>
						<p class="description"><?php esc_html_e( 'The details on each request stay as they were sent. Its history records the link.', 'product-configurator-for-woocommerce' ); ?></p>
					</td>
				</tr>
			<?php endif; ?>
		</table>
		<?php
	}

	/**
	 * Whether the current user sees requests by customer account (list column filter, profile section)
	 *
	 * @return boolean
	 */
	private function can_list_customers() {
		$type = get_post_type_object( CPT_Store::POST_TYPE );
		return $this->can_pick_customer() && $type && current_user_can( $type->cap->edit_posts );
	}

	/**
	 * The request list, showing one account's requests
	 *
	 * @param int $user_id
	 * @return string
	 */
	private function get_customer_list_url( $user_id ) {
		return admin_url( 'edit.php?post_type=' . CPT_Store::POST_TYPE . '&mkl_pc_quote_user=' . (int) $user_id );
	}

	/**
	 * The list's customer filter: all, guests, with an account
	 *
	 * @param string $post_type
	 * @param string $which
	 * @return void
	 */
	public function list_filter( $post_type, $which = 'top' ) {
		if ( CPT_Store::POST_TYPE !== $post_type || 'top' !== $which ) return;
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- A list filter.
		$current = isset( $_GET['mkl_pc_quote_customer'] ) ? sanitize_key( wp_unslash( $_GET['mkl_pc_quote_customer'] ) ) : '';
		?>
		<label for="mkl_pc_quote_customer_filter" class="screen-reader-text"><?php esc_html_e( 'Filter by customer', 'product-configurator-for-woocommerce' ); ?></label>
		<select id="mkl_pc_quote_customer_filter" name="mkl_pc_quote_customer">
			<option value=""><?php esc_html_e( 'All customers', 'product-configurator-for-woocommerce' ); ?></option>
			<option value="account" <?php selected( $current, 'account' ); ?>><?php esc_html_e( 'With an account', 'product-configurator-for-woocommerce' ); ?></option>
			<option value="guest" <?php selected( $current, 'guest' ); ?>><?php esc_html_e( 'Guests', 'product-configurator-for-woocommerce' ); ?></option>
		</select>
		<?php
	}

	/**
	 * Apply the customer filter, and the account of `mkl_pc_quote_user`
	 *
	 * @param \WP_Query $query
	 * @return void
	 */
	public function filter_list( $query ) {
		if ( ! $query->is_main_query() || CPT_Store::POST_TYPE !== $query->get( 'post_type' ) ) return;
		// phpcs:disable WordPress.Security.NonceVerification.Recommended -- List filters.
		$user_id = isset( $_GET['mkl_pc_quote_user'] ) ? absint( $_GET['mkl_pc_quote_user'] ) : 0;
		$customer = isset( $_GET['mkl_pc_quote_customer'] ) ? sanitize_key( wp_unslash( $_GET['mkl_pc_quote_customer'] ) ) : '';
		// phpcs:enable
		if ( $user_id ) {
			$clause = [ 'key' => '_mkl_pc_quote_user_id', 'value' => $user_id, 'type' => 'NUMERIC' ];
		} elseif ( 'guest' === $customer ) {
			$clause = [ 'key' => '_mkl_pc_quote_user_id', 'value' => 0, 'type' => 'NUMERIC' ];
		} elseif ( 'account' === $customer ) {
			$clause = [ 'key' => '_mkl_pc_quote_user_id', 'value' => 0, 'compare' => '>', 'type' => 'NUMERIC' ];
		} else {
			return;
		}
		$this->store->maybe_store_user_ids();
		$meta_query = (array) $query->get( 'meta_query' );
		$meta_query[] = $clause;
		$query->set( 'meta_query', $meta_query );
	}

	/**
	 * Says whose requests the list shows
	 *
	 * @return void
	 */
	public function customer_filter_notice() {
		$screen = get_current_screen();
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- A list filter.
		if ( ! $screen || 'edit-' . CPT_Store::POST_TYPE !== $screen->id || empty( $_GET['mkl_pc_quote_user'] ) ) return;
		$user = get_userdata( absint( $_GET['mkl_pc_quote_user'] ) ); // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		if ( ! $user ) return;
		printf(
			'<div class="notice notice-info"><p>%s <a href="%s">%s</a></p></div>',
			/* translators: %s: user name and email */
			esc_html( sprintf( __( 'Quote requests of %s.', 'product-configurator-for-woocommerce' ), $this->format_user( $user ) ) ),
			esc_url( admin_url( 'edit.php?post_type=' . CPT_Store::POST_TYPE ) ),
			esc_html__( 'Show all requests', 'product-configurator-for-woocommerce' )
		);
	}

	/**
	 * admin-post handler of the profile's button
	 *
	 * The requests are found again here, from the account's emails: never from what the link says.
	 *
	 * @return void
	 */
	public function link_requests() {
		$user_id = isset( $_GET['user_id'] ) ? absint( $_GET['user_id'] ) : 0;
		check_admin_referer( 'mkl_pc_quote_link_requests_' . $user_id );
		$user = get_userdata( $user_id );
		if ( ! $user || ! $this->can_link_requests( $user_id ) ) {
			wp_die( esc_html__( 'You are not allowed to do this.', 'product-configurator-for-woocommerce' ), 403 );
		}
		$linked = $this->link_guest_requests( $user );
		wp_safe_redirect( add_query_arg( 'mkl_pc_quote_linked', $linked, get_edit_user_link( $user_id ) ) );
		exit;
	}

	/**
	 * Link the requests sent as a guest with an account's emails to it
	 *
	 * @param \WP_User $user
	 * @return int Number linked.
	 */
	public function link_guest_requests( $user ) {
		$linked = 0;
		foreach ( $this->store->get_guest_request_ids( $this->get_account_emails( $user ) ) as $post_id ) {
			if ( ! current_user_can( 'edit_post', $post_id ) ) continue;
			$request = $this->store->load( $post_id );
			if ( ! $request ) continue;
			$request->user_id = $user->ID;
			if ( true !== $this->store->save( $request ) ) continue;
			$this->store->log( $post_id, $this->get_account_log( $user ) );
			$linked++;
		}
		return $linked;
	}

	/**
	 * On the profile, after the link
	 *
	 * @return void
	 */
	public function linked_notice() {
		$screen = get_current_screen();
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- A count to display.
		if ( ! $screen || ! in_array( $screen->id, [ 'profile', 'user-edit' ], true ) || ! isset( $_GET['mkl_pc_quote_linked'] ) ) return;
		$linked = absint( $_GET['mkl_pc_quote_linked'] ); // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		/* translators: %d: number of quote requests */
		printf( '<div class="notice notice-success is-dismissible"><p>%s</p></div>', esc_html( sprintf( _n( '%d quote request linked to this account.', '%d quote requests linked to this account.', $linked, 'product-configurator-for-woocommerce' ), $linked ) ) );
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
				<?php if ( $user ) : ?>
					<a href="<?php echo esc_url( $this->get_customer_list_url( $user->ID ) ); ?>" class="mkl-pc-quote-user__profile">
						<?php
						$count = $this->store->count_user_requests( $user->ID );
						/* translators: %d: number of quote requests */
						echo esc_html( sprintf( _n( '%d request', 'All %d requests', $count, 'product-configurator-for-woocommerce' ), $count ) );
						?>
					</a>
				<?php endif; ?>
				<button type="button" class="button-link mkl-pc-quote-user__clear" <?php echo $user ? '' : 'hidden'; ?>><?php esc_html_e( 'Remove', 'product-configurator-for-woocommerce' ); ?></button>
			</p>
			<?php $matches = $user ? [] : $this->get_accounts_by_email( $request->get_email() ); ?>
			<?php if ( $matches ) : ?>
				<div class="notice notice-info inline mkl-pc-quote-user__matches">
					<p>
						<?php echo esc_html( _n( 'An account uses this email:', 'Accounts use this email:', count( $matches ), 'product-configurator-for-woocommerce' ) ); ?>
						<?php foreach ( $matches as $match ) : ?>
							<br><button type="button" class="button-link mkl-pc-quote-user__link" data-user="<?php echo (int) $match->ID; ?>" data-label="<?php echo esc_attr( $this->format_user( $match ) ); ?>">
								<?php
								/* translators: %s: user name, id and email */
								echo esc_html( sprintf( __( 'Link to %s', 'product-configurator-for-woocommerce' ), $this->format_user( $match ) ) );
								?>
							</button>
						<?php endforeach; ?>
					</p>
				</div>
			<?php endif; ?>
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
			// Customers' messages keep their line breaks.
			$user = ! empty( $entry['user_id'] ) ? get_userdata( $entry['user_id'] ) : null;
			printf(
				'<li><span class="mkl-pc-quote-log__message">%s</span><span class="mkl-pc-quote-log__meta">%s</span></li>',
				nl2br( esc_html( $entry['message'] ) ),
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
					$account_log = $user ? $this->get_account_log( $user ) : __( 'Customer account removed: the request is a guest\'s.', 'product-configurator-for-woocommerce' );
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
		// Shown with the quote on the customer's page.
		update_post_meta( $request->id, '_mkl_pc_quote_sent_message', wp_slash( $message ) );

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
			.mkl-pc-quote-status.status-mkl_quote_accepted { background: #b8e6bf; color: #00450c; }
			.mkl-pc-quote-status.status-mkl_quote_declined { background: #eba3a3; color: #761919; }
			.mkl-pc-quote-reference { padding: 0 !important; font-size: 1.3em !important; }
			.mkl-pc-quote-configuration { transition: opacity .15s; }
			.mkl-pc-quote-request { display: flex; gap: 16px; align-items: flex-start; }
			.mkl-pc-quote-image img { width: 160px; height: auto; border: 1px solid #ddd; }
			.mkl-pc-quote-configuration-actions { display: flex; flex-wrap: wrap; gap: 8px; margin: 12px 0 0; }
			.mkl-pc-quote-fields th { width: 30%; padding-top: 14px; padding-bottom: 14px; }
			.mkl-pc-quote-fields td { padding-top: 8px; padding-bottom: 8px; }
			.mkl-pc-quote-account { color: #646970; }
			.mkl-pc-quote-customer-link { margin-top: 16px; padding-top: 12px; border-top: 1px solid #f0f0f1; }
			.mkl-pc-quote-customer-link label { display: block; margin-bottom: 4px; font-weight: 600; }
			.mkl-pc-quote-user__account { display: flex; flex-wrap: wrap; gap: 4px 12px; align-items: baseline; margin: 0 0 8px; }
			.mkl-pc-quote-user__current { font-weight: 600; }
			.mkl-pc-quote-user__dropdown { max-width: 25em; }
			.mkl-pc-quote-user__search { width: 100%; }
			.mkl-pc-quote-user__status .notice, .mkl-pc-quote-user__matches { max-width: 25em; box-sizing: border-box; margin: 8px 0 !important; }
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
