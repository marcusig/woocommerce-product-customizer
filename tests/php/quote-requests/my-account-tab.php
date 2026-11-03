<?php
require dirname( __DIR__ ) . '/bootstrap.php';
require_once ABSPATH . 'wp-admin/includes/user.php';
$quotes = mkl_pc( 'quotes' );
$store = $quotes->cpt_store;
$tab = $quotes->account_tab;
check( 'tab loaded with WooCommerce', $tab instanceof MKL\PC\Quote_Account_Tab && 'quote-requests' === $tab->get_endpoint() );
check( 'endpoint is a WooCommerce query var', isset( WC()->query->get_query_vars()['quote-requests'] ) );
$rules = (array) get_option( 'rewrite_rules' );
check( 'rewrite rule exists', (bool) preg_grep( '#quote-requests\(#', array_keys( $rules ) ) );

$tag = wp_rand();
$customer_id = wc_create_new_customer( "tab-$tag@example.com", '', wp_generate_password() );
$other_id = wc_create_new_customer( "tab-other-$tag@example.com", '', wp_generate_password() );
function req( $store, $user_id, $ref ) {
	$r = new MKL\PC\Quote_Request();
	$r->store = 'cpt'; $r->reference = $ref; $r->created = time(); $r->user_id = $user_id; $r->product_id = $r->configurator_id = 613;
	$r->fields = [ 'name' => 'Tab', 'email' => 'tab@example.com' ];
	$store->save( $r );
	return $r->id;
}
$mine = req( $store, $customer_id, "Q-TAB-$tag" );
$theirs = req( $store, $other_id, "Q-TABX-$tag" );

$storage = 'email';
add_filter( 'mkl/pc/setting/quote_request_storage', function() use ( &$storage ) { return $storage; } );
wp_set_current_user( $other_id + 1000000 );
wp_set_current_user( 0 );
check( 'no tab for visitors', ! isset( $tab->menu_items( [ 'dashboard' => 'D', 'orders' => 'O' ] )['quote-requests'] ) );
wp_set_current_user( $customer_id );
$items = $tab->menu_items( [ 'dashboard' => 'D', 'orders' => 'O', 'customer-logout' => 'L' ] );
check( 'tab after Orders when the customer has requests, even in another mode', [ 'dashboard', 'orders', 'quote-requests', 'customer-logout' ] === array_keys( $items ) );
$none_id = wc_create_new_customer( "tab-none-$tag@example.com", '', wp_generate_password() );
wp_set_current_user( $none_id );
check( 'no tab without requests in another mode', ! isset( $tab->menu_items( [ 'orders' => 'O' ] )['quote-requests'] ) );
$storage = 'cpt';
add_filter( 'mkl_pc/quote_request/enabled', '__return_true' );
check( 'tab for everyone when requests are kept as posts', isset( $tab->menu_items( [ 'orders' => 'O' ] )['quote-requests'] ) );

wp_set_current_user( $customer_id );
ob_start(); $tab->render( '' ); $html = ob_get_clean();
check( 'list shows the customer\'s own', false !== strpos( $html, "Q-TAB-$tag" ) && false === strpos( $html, "Q-TABX-$tag" ) );
check( 'list links into the tab', false !== strpos( $html, $tab->get_request_url( $store->load( $mine ) ) ) && false !== strpos( $tab->get_request_url( $store->load( $mine ) ), 'quote-requests' ) );
ob_start(); $tab->render( "Q-TAB-$tag" ); $html = ob_get_clean();
check( 'one request, with the way back', false !== strpos( $html, "Quote request Q-TAB-$tag" ) && false !== strpos( $html, wc_get_account_endpoint_url( 'quote-requests' ) ) );
ob_start(); $tab->render( "Q-TABX-$tag" ); $html = ob_get_clean();
check( 'another customer\'s request, not shown', false !== strpos( $html, 'not valid' ) && false === strpos( $html, 'Quote request Q-TABX' ) );
$admins = get_users( [ 'role' => 'administrator', 'number' => 1, 'fields' => 'ID' ] );
wp_set_current_user( (int) $admins[0] );
ob_start(); $tab->render( "Q-TABX-$tag" ); $html = ob_get_clean();
check( 'not even to the merchant: My account is the customer\'s own', false !== strpos( $html, 'not valid' ) );

global $wp;
$wp->query_vars['quote-requests'] = '';
check( 'title of the list', 'Quote requests' === $tab->title( 'x' ) );
$wp->query_vars['quote-requests'] = "Q-TAB-$tag";
check( 'title of a request', "Quote request Q-TAB-$tag" === $tab->title( 'x' ) );

wp_delete_post( $mine, true ); wp_delete_post( $theirs, true );
wp_delete_user( $customer_id ); wp_delete_user( $other_id ); wp_delete_user( $none_id );
wp_set_current_user( 0 );
mkl_pc_tests_done();
