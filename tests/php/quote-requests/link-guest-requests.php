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

$tag = wp_rand();
$account_email = "link-$tag@example.com";
$billing_email = "link-billing-$tag@example.com";
$user_id = wc_create_new_customer( $account_email, '', wp_generate_password(), [ 'first_name' => 'Lina', 'last_name' => 'Link' ] );
update_user_meta( $user_id, 'billing_email', $billing_email );
$other_id = wc_create_new_customer( "other-$tag@example.com", '', wp_generate_password() );

function make_request( $store, $email, $user_id = 0, $legacy_author = null ) {
	$r = new MKL\PC\Quote_Request();
	$r->store = 'cpt'; $r->reference = 'Q-LINK-' . wp_rand( 1000, 9999 ); $r->created = time(); $r->user_id = $user_id;
	$r->fields = [ 'name' => 'Lina', 'email' => $email ];
	$r->field_definitions = [ 'name' => [ 'label' => 'Name', 'type' => 'text', 'options' => [], 'maps_to' => 'full_name' ], 'email' => [ 'label' => 'Email', 'type' => 'email', 'options' => [], 'maps_to' => 'billing_email' ] ];
	$store->save( $r );
	if ( null !== $legacy_author ) {
		// Stored before the account had its own meta: the author was the customer.
		delete_post_meta( $r->id, '_mkl_pc_quote_user_id' );
		wp_update_post( [ 'ID' => $r->id, 'post_author' => $legacy_author ] );
	}
	return $r->id;
}
$guest_account = make_request( $store, $account_email );
$guest_billing = make_request( $store, strtoupper( $billing_email ) === $billing_email ? $billing_email : $billing_email );
$legacy_guest = make_request( $store, $account_email, 0, 0 );
$legacy_owned = make_request( $store, $account_email, 0, $other_id );
$already = make_request( $store, $account_email, $other_id );
$stranger = make_request( $store, "someone-else-$tag@example.com" );

$found = $store->get_guest_request_ids( [ $account_email, $billing_email ] );
sort( $found );
$expected = [ $guest_account, $guest_billing, $legacy_guest ];
sort( $expected );
check( 'guest requests found by account and billing email', $expected === $found, wp_json_encode( $found ) . ' vs ' . wp_json_encode( $expected ) );
check( 'requests with an account, old or new, left out', ! in_array( $legacy_owned, $found, true ) && ! in_array( $already, $found, true ) );

// Request screen hint
ob_start(); $admin->render_contact( get_post( $guest_billing ) ); $html = ob_get_clean();
check( 'guest request suggests the account', false !== strpos( $html, 'mkl-pc-quote-user__link' ) && false !== strpos( $html, 'data-user="' . $user_id . '"' ) );
ob_start(); $admin->render_contact( get_post( $already ) ); $html = ob_get_clean();
check( 'no suggestion once linked', false === strpos( $html, 'mkl-pc-quote-user__matches' ) );
ob_start(); $admin->render_contact( get_post( $stranger ) ); $html = ob_get_clean();
check( 'no suggestion without a matching account', false === strpos( $html, 'mkl-pc-quote-user__matches' ) );

// Profile
ob_start(); $admin->profile_section( get_userdata( $user_id ) ); $html = ob_get_clean();
check( 'profile lists the 3 guest requests', false !== strpos( $html, '3 quote requests were sent as a guest' ) && false !== strpos( $html, 'action=mkl_pc_quote_link_requests' ), strip_tags( substr( $html, 0, 300 ) ) );
ob_start(); $admin->profile_section( get_userdata( $other_id ) ); $html = ob_get_clean();
check( 'no guest section on a profile without guest requests', false === strpos( $html, 'Sent as a guest' ) && false !== strpos( $html, 'Linked to this account' ) );

$linked = $admin->link_guest_requests( get_userdata( $user_id ) );
check( 'three linked', 3 === $linked );
check( 'each belongs to the account', $user_id === $store->load( $guest_account )->user_id && $user_id === $store->load( $guest_billing )->user_id && $user_id === $store->load( $legacy_guest )->user_id );
check( 'others untouched', $other_id === $store->load( $legacy_owned )->user_id && $other_id === $store->load( $already )->user_id && 0 === $store->load( $stranger )->user_id );
check( 'history records it', false !== strpos( end( $store->get_log( $guest_account ) )['message'], 'Customer account: Lina Link' ) );
check( 'details kept as sent', $billing_email === $store->load( $guest_billing )->get_email() );
check( 'nothing left to link', [] === $store->get_guest_request_ids( [ $account_email, $billing_email ] ) );

// Who may link
$deny = function( $caps, $cap ) { return 'list_users' === $cap ? [ 'do_not_allow' ] : $caps; };
add_filter( 'map_meta_cap', $deny, 10, 2 );
$fresh = make_request( $store, $account_email );
ob_start(); $admin->profile_section( get_userdata( $user_id ) ); $html = ob_get_clean();
check( 'no profile section without list_users', '' === trim( $html ) );
remove_filter( 'map_meta_cap', $deny, 10 );

foreach ( [ $guest_account, $guest_billing, $legacy_guest, $legacy_owned, $already, $stranger, $fresh ] as $id ) wp_delete_post( $id, true );
wp_delete_user( $user_id ); wp_delete_user( $other_id );
wp_set_current_user( 0 );
mkl_pc_tests_done();
