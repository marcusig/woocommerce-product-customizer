<?php
require dirname( __DIR__ ) . '/bootstrap.php';
add_filter( 'mkl_pc/quote_request/enabled', '__return_true' );
require_once ABSPATH . 'wp-admin/includes/post.php';
require_once ABSPATH . 'wp-admin/includes/user.php';
require_once MKL_PC_INCLUDE_PATH . 'quote-requests/admin/class-quote-requests-admin.php';
$mails = [];
add_filter( 'pre_wp_mail', function( $null, $atts ) use ( &$mails ) { $mails[] = $atts; return true; }, 10, 2 );
$max = 1000;
add_filter( 'mkl_pc_rate_limit_rule', function( $rule, $action ) use ( &$max ) { return MKL\PC\Quote_Customer_Actions::ACTION === $action ? [ 'max' => $max, 'window' => HOUR_IN_SECONDS ] : $rule; }, 20, 2 );
add_filter( 'mkl/pc/setting/quote_request_storage', function() { return 'cpt'; } );

$quotes = mkl_pc( 'quotes' );
$store = $quotes->cpt_store;
$actions = $quotes->customer_actions;
$page_before = mkl_pc( 'settings' )->get( 'quote_request_page' );
$admins = get_users( [ 'role' => 'administrator', 'number' => 1, 'fields' => 'ID' ] );
$admin_id = (int) $admins[0];
$admin = new MKL\PC\Quote_Requests_Admin( $store );
$tag = wp_rand();
$email = "answer-$tag@example.com";
$customer_id = wc_create_new_customer( "answer-acc-$tag@example.com", '', wp_generate_password() );
$posts = []; $orders = [];

function make_request( $user_id, $email ) {
	global $posts;
	wp_set_current_user( $user_id );
	$q = mkl_pc( 'quotes' );
	$prepared = $q->service->prepare( [
		'product_id'    => 613,
		'configuration' => [ [ 'is_choice' => true, 'layer_id' => 1, 'choice_id' => 2, 'angle_id' => 1, 'image' => 0 ] ],
		'fields'        => [ 'name' => 'Ana Answer', 'email' => $email ],
	] );
	$request = $q->service->submit( $prepared );
	$posts[] = $request->id;
	wp_set_current_user( 0 );
	return $q->cpt_store->load( $request->id );
}
function send_quote( $id, $price = 1234.5 ) {
	global $admin, $store, $admin_id;
	wp_set_current_user( $admin_id );
	$r = $store->load( $id );
	$r->quoted_price = $price;
	$store->save( $r );
	$admin->send( $store->load( $id ), 'Here it is.' );
	wp_update_post( [ 'ID' => $id, 'post_status' => 'mkl_quote_answered' ] );
	wp_set_current_user( 0 );
	return $store->load( $id );
}
function post_answer( $request, $answer, $key, $message = '', $nonce = null ) {
	$_POST = [ '_wpnonce' => null === $nonce ? wp_create_nonce( MKL\PC\Quote_Customer_Actions::ACTION . '_' . $request->id ) : $nonce ];
	$result = mkl_pc( 'quotes' )->customer_actions->handle_answer( $request->reference, $key, $answer, $message );
	$_POST = [];
	return $result;
}
function code( $result ) { return is_wp_error( $result ) ? $result->get_error_code() : 'ok:' . $result['answer']; }
function mail_to( $needle ) { global $mails; foreach ( $mails as $m ) { $to = is_array( $m['to'] ) ? implode( ',', $m['to'] ) : $m['to']; if ( false !== strpos( $to, $needle ) ) return $m; } return null; }
function view_html( $request, $key ) { return mkl_pc( 'quotes' )->customer_view->render_request( mkl_pc( 'quotes' )->cpt_store->load( $request->id ), '', $key ); }

// A new request: only "ask for a change"
$r = make_request( 0, $email );
$key = $r->access_key;
check( 'new request: change only', [ 'change' ] === $actions->get_available( $r ), implode( ',', $actions->get_available( $r ) ) );
check( 'key holder answers', $actions->can_answer( $r, $key ) );
check( 'wrong key does not', ! $actions->can_answer( $r, 'nope' ) && ! $actions->can_answer( $r, '' ) );
wp_set_current_user( $admin_id );
check( 'merchant without the key does not answer for the customer', ! $actions->can_answer( $r, '' ) );
check( 'merchant sees no answer form', false === strpos( view_html( $r, '' ), 'mkl-pc-quote-answer' ) );
wp_set_current_user( 0 );
$html = view_html( $r, $key );
check( 'page: ask for a change, no accept', false !== strpos( $html, 'Ask for a change' ) && false === strpos( $html, 'Accept' ) && false === strpos( $html, 'Decline the quote' ) );
check( 'page: forms carry reference, key and nonce', false !== strpos( $html, 'name="reference" value="' . $r->reference ) && false !== strpos( $html, 'name="key" value="' . $key ) && false !== strpos( $html, 'name="_wpnonce"' ) );
check( 'no repeated nonce id', false === strpos( $html, 'id="_wpnonce"' ) );

check( 'wrong key refused', 'unavailable' === code( post_answer( $r, 'change', 'nope', 'Hi' ) ) );
check( 'bad nonce refused', 'expired' === code( post_answer( $r, 'change', $key, 'Hi', 'bad' ) ) );
check( 'accept before the quote refused', 'unavailable' === code( post_answer( $r, 'accept', $key ) ) );
check( 'change needs a message', 'message' === code( post_answer( $r, 'change', $key, '   ' ) ) );
$mails = [];
$res = post_answer( $r, 'change', $key, "Blue instead of red, please.\n<b>Thanks</b>" );
check( 'change asked', 'ok:change' === code( $res ) );
$r = $store->load( $r->id );
check( 'back in progress', 'mkl_quote_progress' === $r->status );
$log = $store->get_log( $r->id );
$last = end( $log );
check( 'history has the message', false !== strpos( $last['message'], 'Blue instead of red' ) && false === strpos( $last['message'], '<b>' ), $last['message'] );
$m_admin = mail_to( get_option( 'admin_email' ) );
$m_customer = mail_to( $email );
check( 'merchant told, reply goes to the customer', $m_admin && false !== strpos( $m_admin['subject'], 'Change requested' ) && false !== strpos( $m_admin['message'], 'Blue instead of red' ) && false !== stripos( implode( "\n", (array) $m_admin['headers'] ), 'Reply-to: "Ana Answer" <' . $email ), $m_admin ? $m_admin['subject'] : 'none' );
check( 'customer confirmation', $m_customer && false !== strpos( $m_customer['message'], 'We will get back to you with a new quote' ) && false !== strpos( $m_customer['message'], 'Your message' ) );
check( 'customer confirmation has no reply-to to themselves', $m_customer && false === stripos( implode( "\n", (array) $m_customer['headers'] ), 'Reply-to: "Ana Answer"' ) );
check( 'answer emails attach nothing', $m_admin && empty( $m_admin['attachments'] ) );

// The quote is sent: accept, decline, change
$r = send_quote( $r->id );
check( 'sent quote: all three', [ 'accept', 'decline', 'change' ] === $actions->get_available( $r ) );
$html = view_html( $r, $key );
check( 'page: accept and pay, decline, change', false !== strpos( $html, 'Accept and pay' ) && false !== strpos( $html, 'Decline the quote' ) && false !== strpos( $html, 'Ask for a change' ) );
$_GET = [ 'quote_answer' => 'message' ];
$html = view_html( $r, $key );
$_GET = [];
check( 'error notice shown, change form opened', false !== strpos( $html, 'Please tell us what you would like to change.' ) && false !== strpos( $html, '<details class="mkl-pc-quote-answer__more" open' ) );
$_GET = [ 'quote_answer' => '<script>' ];
check( 'unknown result code ignored', null === $actions->get_result() );
$_GET = [];

// Decline
$mails = [];
check( 'declined', 'ok:decline' === code( post_answer( $r, 'decline', $key, 'Too expensive.' ) ) );
$r = $store->load( $r->id );
check( 'status declined', 'mkl_quote_declined' === $r->status );
check( 'nothing left to answer', [] === $actions->get_available( $r ) );
check( 'second decline refused', 'unavailable' === code( post_answer( $r, 'decline', $key ) ) );
$m_admin = mail_to( get_option( 'admin_email' ) );
check( 'merchant reads the reason', $m_admin && false !== strpos( $m_admin['subject'], 'Declined' ) && false !== strpos( $m_admin['message'], 'Their reason' ) && false !== strpos( $m_admin['message'], 'Too expensive.' ) );
check( 'page: declined, no forms', false !== strpos( view_html( $r, $key ), 'Declined' ) && false === strpos( view_html( $r, $key ), '<form' ) );

// Accept: an order to pay
$r = send_quote( $r->id, 1190 );
$mails = [];
$res = post_answer( $r, 'accept', $key );
check( 'accepted', 'ok:accept' === code( $res ), is_wp_error( $res ) ? $res->get_error_message() : '' );
$order = is_array( $res ) ? $res['order'] : null;
if ( $order ) $orders[] = $order->get_id();
$r = $store->load( $r->id );
check( 'status accepted', 'mkl_quote_accepted' === $r->status );
check( 'order made, pending', $order && $order->has_status( 'pending' ) && (int) get_post_meta( $r->id, '_mkl_pc_quote_order_id', true ) === $order->get_id() );
check( 'at the quoted price', $order && abs( (float) $order->get_total() - 1190 ) < 0.02, $order ? $order->get_total() : '' );
check( 'guest order, billing email', $order && 0 === $order->get_customer_id() && $email === $order->get_billing_email() );
check( 'redirect to the payment page', $order && $res['redirect'] === $order->get_checkout_payment_url() );
check( 'not cancelled as unpaid (not a checkout order)', $order && 'checkout' !== $order->get_created_via() );
$log = $store->get_log( $r->id );
$last = end( $log );
check( 'history names the order', $order && false !== strpos( $last['message'], '#' . $order->get_order_number() ) );
$m_admin = mail_to( get_option( 'admin_email' ) );
$m_customer = mail_to( $email );
check( 'merchant gets the order link', $m_admin && false !== strpos( $m_admin['subject'], 'Accepted' ) && $order && false !== strpos( html_entity_decode( $m_admin['message'] ), $order->get_edit_order_url() ) );
check( 'customer gets the payment link', $m_customer && $order && false !== strpos( html_entity_decode( $m_customer['message'] ), $order->get_checkout_payment_url() ) );
check( 'customer email shows the price', $m_customer && false !== strpos( $m_customer['message'], '190' ) );
$html = view_html( $r, $key );
check( 'page: pay for your order, no forms', false !== strpos( $html, 'Pay for your order' ) && false === strpos( $html, '<form' ) );
$again = post_answer( $r, 'accept', $key );
check( 'second accept goes to the same payment page', is_array( $again ) && $order && $again['redirect'] === $order->get_checkout_payment_url() && 1 === count( wc_get_orders( [ 'meta_key' => '_mkl_pc_quote_request_id', 'meta_value' => $r->id, 'return' => 'ids' ] ) ) );
$order->set_status( 'processing' ); $order->save();
$html = view_html( $r, $key );
check( 'paid: order status instead of the link', false === strpos( $html, 'Pay for your order' ) && false !== strpos( $html, 'Processing' ) );
check( 'paid: accept refused', 'unavailable' === code( post_answer( $r, 'accept', $key ) ) );

// An order the merchant already made from the request is the one to pay
$r2 = make_request( 0, $email );
$r2 = send_quote( $r2->id, 500 );
$made = $quotes->woo_order_store->create_order_from_request_post( $r2->id );
$orders[] = $made->get_id();
$made->set_status( MKL\PC\Woo_Order_Store::STATUS ); $made->save();
$res = post_answer( $r2, 'accept', $r2->access_key );
check( 'existing quote order reused', is_array( $res ) && $res['order'] && $res['order']->get_id() === $made->get_id() && wc_get_order( $made->get_id() )->has_status( 'pending' ) );

// Accepting without an order
add_filter( 'mkl_pc/quote_request/accept_creates_order', '__return_false' );
$r3 = make_request( 0, $email );
$r3 = send_quote( $r3->id );
$res = post_answer( $r3, 'accept', $r3->access_key );
check( 'accepted without an order', is_array( $res ) && null === $res['order'] && '' === $res['redirect'] && 'mkl_quote_accepted' === $store->load( $r3->id )->status && ! get_post_meta( $r3->id, '_mkl_pc_quote_order_id', true ) );
$html = view_html( $r3, $r3->access_key );
check( 'page: accept the quote label off', false === strpos( $html, 'Pay for your order' ) );
remove_filter( 'mkl_pc/quote_request/accept_creates_order', '__return_false' );

// The account answers without the key
$r4 = make_request( $customer_id, "answer-acc-$tag@example.com" );
$r4 = send_quote( $r4->id );
check( 'linked to the account', $customer_id === $r4->user_id );
check( 'visitor without key cannot', 'unavailable' === code( post_answer( $r4, 'change', '', 'x' ) ) );
wp_set_current_user( $customer_id );
check( 'account sees the forms', false !== strpos( view_html( $r4, '' ), 'Accept and pay' ) );
$res = post_answer( $r4, 'accept', '' );
check( 'account accepts', 'ok:accept' === code( $res ) );
if ( is_array( $res ) && $res['order'] ) { $orders[] = $res['order']->get_id(); check( 'order belongs to the account', $customer_id === $res['order']->get_customer_id() ); }
wp_set_current_user( 0 );

// Rate limit
$r5 = make_request( 0, $email );
$max = 1;
check( 'limited', 'limited' === code( post_answer( $r5, 'change', $r5->access_key, 'x' ) ) );
$max = 1000;
$posts[] = $r5->id;

// WooCommerce lists the emails
$wc_emails = WC()->mailer()->get_emails();
$ids = array_map( function( $e ) { return $e->id; }, $wc_emails );
check( 'emails in WooCommerce settings', in_array( 'mkl_pc_quote_request_answer', $ids, true ) && in_array( 'mkl_pc_quote_request_answer_customer', $ids, true ) );

// Statuses
check( 'statuses registered', get_post_status_object( 'mkl_quote_accepted' ) && get_post_status_object( 'mkl_quote_declined' ) );

foreach ( array_unique( $posts ) as $p ) wp_delete_post( $p, true );
foreach ( array_unique( $orders ) as $o ) { $oo = wc_get_order( $o ); if ( $oo ) $oo->delete( true ); }
wp_delete_user( $customer_id );
if ( ! $page_before && ( $pid = (int) mkl_pc( 'settings' )->get( 'quote_request_page' ) ) ) { wp_delete_post( $pid, true ); mkl_pc( 'settings' )->set( 'quote_request_page', '' ); }
mkl_pc_tests_done();
