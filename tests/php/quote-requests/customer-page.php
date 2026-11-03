<?php
require dirname( __DIR__ ) . '/bootstrap.php';
add_filter( 'mkl_pc/quote_request/enabled', '__return_true' );
require_once ABSPATH . 'wp-admin/includes/post.php';
require_once ABSPATH . 'wp-admin/includes/user.php';
require_once MKL_PC_INCLUDE_PATH . 'quote-requests/admin/class-quote-requests-admin.php';
$mails = [];
add_filter( 'pre_wp_mail', function( $null, $atts ) use ( &$mails ) { $mails[] = $atts; return true; }, 10, 2 );
$quotes = mkl_pc( 'quotes' );
$store = $quotes->cpt_store;
$view = $quotes->customer_view;
$page_before = mkl_pc( 'settings' )->get( 'quote_request_page' );
$storage = 'cpt';
add_filter( 'mkl/pc/setting/quote_request_storage', function() use ( &$storage ) { return $storage; } );

$admins = get_users( [ 'role' => 'administrator', 'number' => 1, 'fields' => 'ID' ] );
$admin_id = (int) $admins[0];
$tag = wp_rand();
$customer_id = wc_create_new_customer( "view-$tag@example.com", '', wp_generate_password() );
$other_id = wc_create_new_customer( "view-other-$tag@example.com", '', wp_generate_password() );

// A request from the configurator, by a signed-in customer
wp_set_current_user( $customer_id );
$prepared = $quotes->service->prepare( [
	'product_id'    => 613,
	'configuration' => [ [ 'is_choice' => true, 'layer_id' => 1, 'choice_id' => 2, 'angle_id' => 1, 'image' => 0 ] ],
	'fields'        => [ 'name' => 'Vera View', 'email' => "view-$tag@example.com" ],
] );
check( 'request prepared', ! is_wp_error( $prepared ), is_wp_error( $prepared ) ? $prepared->get_error_message() : '' );
$request = $quotes->service->submit( $prepared );
check( 'stored as a post', ! is_wp_error( $request ) && $request->id && 'cpt' === $request->store );
$id = $request->id;
$key = get_post_meta( $id, '_mkl_pc_quote_key', true );
check( 'stored with a key', 24 === strlen( $key ) && $store->load( $id )->access_key === $key );

$page_id = $view->get_page_id();
check( 'customer page made for the link', $page_id && false !== strpos( get_post_field( 'post_content', $page_id ), '[mkl_pc_quotes]' ) && (int) mkl_pc( 'settings' )->get( 'quote_request_page' ) === $page_id );
$url = $request->get_view_url();
check( 'link: page, reference and key', 0 === strpos( $url, get_permalink( $page_id ) ) && false !== strpos( $url, 'quote_request=' . rawurlencode( $request->reference ) ) && false !== strpos( $url, 'key=' . $key ), $url );
check( 'same page next time', $page_id === $view->get_page_id( true ) );

$customer_mail = null; $admin_mail = null;
foreach ( $mails as $mail ) { if ( false !== strpos( (string) ( is_array( $mail['to'] ) ? $mail['to'][0] : $mail['to'] ), "view-$tag" ) ) $customer_mail = $mail; else $admin_mail = $mail; }
check( 'customer email links the request', $customer_mail && false !== strpos( $customer_mail['message'], 'View your request online' ) && false !== strpos( html_entity_decode( $customer_mail['message'] ), 'key=' . $key ) );
check( 'admin email does not carry the customer link', $admin_mail && false === strpos( html_entity_decode( $admin_mail['message'] ), 'key=' . $key ) );

function shortcode_with( $get ) {
	$_GET = $get;
	$html = mkl_pc( 'quotes' )->customer_view->shortcode();
	$_GET = [];
	return $html;
}
// Who sees it
wp_set_current_user( 0 );
$html = shortcode_with( [ 'quote_request' => $request->reference, 'key' => $key ] );
check( 'guest with the link sees the request', false !== strpos( $html, 'Quote request ' . $request->reference ) && false !== strpos( $html, 'Vera View' ) && false !== strpos( $html, 'Received' ) );
check( 'no price before the quote (prices not shown in this shop)', false === strpos( $html, 'mkl-pc-quote__price' ) || mkl_pc( 'quotes' )->show_prices() );
check( 'wrong key, nothing', false !== strpos( shortcode_with( [ 'quote_request' => $request->reference, 'key' => 'nope' ] ), 'not valid' ) );
check( 'no key, nothing', false !== strpos( shortcode_with( [ 'quote_request' => $request->reference ] ), 'not valid' ) );
check( 'unknown reference, nothing', false !== strpos( shortcode_with( [ 'quote_request' => 'Q-NOPE', 'key' => $key ] ), 'not valid' ) );
$html = shortcode_with( [] );
check( 'guest without a link is told to use it', false !== strpos( $html, 'open the link in the email' ) && false === strpos( $html, $request->reference ) );

wp_set_current_user( $customer_id );
$html = shortcode_with( [] );
check( 'signed-in customer sees their list', false !== strpos( $html, $request->reference ) && false !== strpos( $html, 'quote_request=' ) && false === strpos( $html, 'key=' ) );
check( 'and the request without a key', false !== strpos( shortcode_with( [ 'quote_request' => $request->reference ] ), 'Vera View' ) );
wp_set_current_user( $other_id );
check( 'another customer does not', false !== strpos( shortcode_with( [ 'quote_request' => $request->reference ] ), 'not valid' ) && false === strpos( shortcode_with( [] ), $request->reference ) );

// The quote is sent: price and message show
wp_set_current_user( $admin_id );
$admin = new MKL\PC\Quote_Requests_Admin( $store );
$loaded = $store->load( $id );
$loaded->quoted_price = 1234.5;
$store->save( $loaded );
$mails = [];
check( 'quote sent', true === $admin->send( $store->load( $id ), 'Ready in two weeks.' ) );
check( 'quote email links the quote', isset( $mails[0] ) && false !== strpos( $mails[0]['message'], 'View your quote online' ) );
wp_update_post( [ 'ID' => $id, 'post_status' => 'mkl_quote_answered' ] );
wp_set_current_user( 0 );
$html = shortcode_with( [ 'quote_request' => $request->reference, 'key' => $key ] );
check( 'page shows the quoted price, the message and the status', false !== strpos( $html, 'mkl-pc-quote__price' ) && false !== strpos( $html, '234,50' ) && false !== strpos( $html, 'Ready in two weeks.' ) && false !== strpos( $html, 'Answered' ), wp_strip_all_tags( $html ) );

// Admin: the link, and changing it
wp_set_current_user( $admin_id );
ob_start(); $admin->render_contact( get_post( $id ) ); $html = ob_get_clean();
check( 'request screen shows the customer link', false !== strpos( html_entity_decode( $html ), 'key=' . $key ) && false !== strpos( $html, 'mkl_pc_quote_reset_key' ) );
$new_key = $store->reset_access_key( $id );
wp_set_current_user( 0 );
check( 'old link stops working', false !== strpos( shortcode_with( [ 'quote_request' => $request->reference, 'key' => $key ] ), 'not valid' ) );
check( 'new link works', false !== strpos( shortcode_with( [ 'quote_request' => $request->reference, 'key' => $new_key ] ), 'Vera View' ) );

// Requests stored before keys get one when their link is asked for
delete_post_meta( $id, '_mkl_pc_quote_key' );
$legacy = $store->load( $id );
check( 'old request has no key', '' === $legacy->access_key );
$legacy_url = $legacy->get_view_url();
check( 'and gets one for its link', strlen( get_post_meta( $id, '_mkl_pc_quote_key', true ) ) === 24 && false !== strpos( $legacy_url, 'key=' . get_post_meta( $id, '_mkl_pc_quote_key', true ) ) );

// Other stores have no customer page
$storage = 'email';
$plain = clone $legacy; $plain->store = 'email';
check( 'email-only requests have no link', '' === $plain->get_view_url() );
$storage = 'cpt';

// Personal page: not cacheable, not indexed
global $wp_query;
$wp_query = new WP_Query( [ 'page_id' => $page_id ] );
$GLOBALS['wp_the_query'] = $wp_query;
check( 'page recognised', $view->is_customer_page() );
$robots = $view->no_robots( [] );
check( 'noindex', ! empty( $robots['noindex'] ) );

wp_delete_post( $id, true );
if ( ! $page_before ) { wp_delete_post( $page_id, true ); mkl_pc( 'settings' )->set( 'quote_request_page', '' ); }
wp_delete_user( $customer_id ); wp_delete_user( $other_id );
wp_set_current_user( 0 );
mkl_pc_tests_done();
