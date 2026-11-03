<?php
require dirname( __DIR__ ) . '/bootstrap.php';
require_once ABSPATH . 'wp-admin/includes/post.php';
require_once ABSPATH . 'wp-admin/includes/user.php';
require_once MKL_PC_INCLUDE_PATH . 'quote-requests/admin/class-quote-requests-admin.php';
$store = mkl_pc( 'quotes' )->cpt_store;
$admins = get_users( [ 'role' => 'administrator', 'number' => 1, 'fields' => 'ID' ] );
$admin_id = (int) $admins[0];
wp_set_current_user( $admin_id );
$admin = new MKL\PC\Quote_Requests_Admin( $store );

$customer_id = wc_create_new_customer( 'picker-test-' . wp_rand() . '@example.com', '', wp_generate_password(), [ 'first_name' => 'Ann', 'last_name' => 'Account' ] );
$customer = new WC_Customer( $customer_id );
$customer->set_billing_first_name( 'Anna' ); $customer->set_billing_last_name( 'Billing' ); $customer->set_billing_phone( '+49 30 1234' ); $customer->set_billing_company( 'Acme' ); $customer->set_billing_email( 'billing@example.com' );
$customer->save();

$details = mkl_pc( "quotes" )->fields->get_account_details( $customer_id );
// Account search, as the picker calls it
add_filter( 'wp_doing_ajax', '__return_true' );
add_filter( 'wp_die_ajax_handler', function() { return function() { throw new Exception( 'die' ); }; } );
function ajax_json( $callback, $get ) {
	$_GET = $get; $_REQUEST = $get;
	ob_start();
	try { $callback(); } catch ( Exception $e ) {}
	$_GET = $_REQUEST = [];
	return json_decode( ob_get_clean(), true );
}
$nonce = wp_create_nonce( 'mkl_pc_quote_customer' );
$found = ajax_json( [ $admin, 'ajax_search_customers' ], [ 'security' => $nonce, 'term' => 'Account' ] );
check( 'search finds by last name', in_array( $customer_id, wp_list_pluck( (array) $found, 'id' ), true ), wp_json_encode( $found ) );
$found = ajax_json( [ $admin, 'ajax_search_customers' ], [ 'security' => $nonce, 'term' => 'picker-test' ] );
check( 'search finds by email', in_array( $customer_id, wp_list_pluck( (array) $found, 'id' ), true ) );
check( 'short terms find nothing', [] === ajax_json( [ $admin, 'ajax_search_customers' ], [ 'security' => $nonce, 'term' => 'a' ] ) );
$user_only = get_userdata( $admin_id );
$plain = mkl_pc( "quotes" )->fields->get_account_details( $admin_id );
check( 'details without a billing address come from the account', '' !== $plain['full_name'] && ( $user_only->user_email === $plain['billing_email'] || get_user_meta( $admin_id, 'billing_email', true ) === $plain['billing_email'] ), wp_json_encode( $plain ) );
check( 'details from the billing address', 'Anna Billing' === $details['full_name'] && 'billing@example.com' === $details['billing_email'] && '+49 30 1234' === $details['billing_phone'] && 'Acme' === $details['billing_company'], wp_json_encode( $details ) );
check( 'no details for an unknown user', [] === mkl_pc( "quotes" )->fields->get_account_details( 999999 ) );

$post = get_default_post_to_edit( 'mkl_pc_quote', true );
$id = $post->ID;
ob_start(); $admin->render_contact( get_post( $id ) ); $html = ob_get_clean();
check( 'picker shown, as a guest', false !== strpos( $html, 'mkl-pc-quote-user__search' ) && false !== strpos( $html, 'name="mkl_pc_quote_user_id" value="0"' ) && false !== strpos( $html, '>Guest<' ) );
check( 'fields say what they map to', false !== strpos( $html, 'data-maps-to="billing_email"' ) && false !== strpos( $html, 'data-maps-to="full_name"' ) );

function save_with( $admin, $id, $user_id ) {
	$_POST = wp_slash( [
		'mkl_pc_quote_status_nonce' => wp_create_nonce( 'mkl_pc_quote_status' ),
		'mkl_pc_quote_status'       => 'mkl_quote_progress',
		'mkl_pc_quote_fields_shown' => '1',
		'mkl_pc_quote_fields'       => [ 'name' => 'Anna Billing', 'email' => 'billing@example.com' ],
		'mkl_pc_quote_user_shown'   => '1',
		'mkl_pc_quote_user_id'      => (string) $user_id,
	] );
	$admin->save( $id, get_post( $id ) );
	$_POST = [];
}
save_with( $admin, $id, $customer_id );
$request = $store->load( $id );
check( 'account linked', $customer_id === $request->user_id );
check( 'history records it', false !== strpos( end( $store->get_log( $id ) )['message'] ?? '', 'Customer account: Ann Account' ), wp_json_encode( $store->get_log( $id ) ) );
ob_start(); $admin->render_contact( get_post( $id ) ); $html = ob_get_clean();
check( 'picker shows the account and its profile link', false !== strpos( $html, 'name="mkl_pc_quote_user_id" value="' . $customer_id . '"' ) && false !== strpos( $html, 'Ann Account (#' . $customer_id ) && false !== strpos( $html, 'user-edit.php?user_id=' . $customer_id ) );
$log_count = count( $store->get_log( $id ) );
save_with( $admin, $id, $customer_id );
check( 'saving again logs nothing', $log_count === count( $store->get_log( $id ) ) );

save_with( $admin, $id, 999999 );
check( 'unknown user ignored', $customer_id === $store->load( $id )->user_id );

// An order made from it is the customer's
$request = $store->load( $id );
$request->configuration_raw = '[{"is_choice":true,"layer_id":1,"choice_id":1,"angle_id":1,"image":0}]';
$request->product_id = $request->configurator_id = 613;
$request->configuration = new MKL\PC\Configuration( null, [ 'product_id' => 613, 'content' => MKL\PC\Utils::decode_configurator_payload( $request->configuration_raw ) ] );
$order = mkl_pc( 'quotes' )->woo_order_store->create_order( $request );
check( 'order belongs to the account', ! is_wp_error( $order ) && $customer_id === $order->get_customer_id() );
if ( ! is_wp_error( $order ) ) $order->delete( true );

save_with( $admin, $id, 0 );
check( 'cleared back to a guest', 0 === $store->load( $id )->user_id && false !== strpos( end( $store->get_log( $id ) )['message'], 'guest' ) );

// Without the right to search customers, no picker and the account is left alone
save_with( $admin, $id, $customer_id );
$shop_manager_cap = function( $caps, $cap ) { return 'list_users' === $cap ? [ 'do_not_allow' ] : $caps; };
add_filter( 'map_meta_cap', $shop_manager_cap, 10, 2 );
ob_start(); $admin->render_contact( get_post( $id ) ); $html = ob_get_clean();
check( 'no picker without list_users', false === strpos( $html, 'mkl-pc-quote-user' ) );
save_with( $admin, $id, 0 );
check( 'account kept when the picker was not allowed', $customer_id === $store->load( $id )->user_id );
remove_filter( 'map_meta_cap', $shop_manager_cap, 10 );

delete_transient( MKL\PC\Quote_Requests_Admin::NOTICES . $admin_id );
wp_delete_post( $id, true );
wp_delete_user( $customer_id );
wp_set_current_user( 0 );
mkl_pc_tests_done();
