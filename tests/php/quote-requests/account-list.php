<?php
require dirname( __DIR__ ) . '/bootstrap.php';
require_once ABSPATH . 'wp-admin/includes/post.php';
require_once ABSPATH . 'wp-admin/includes/user.php';
require_once MKL_PC_INCLUDE_PATH . 'quote-requests/admin/class-quote-requests-admin.php';
$store = mkl_pc( 'quotes' )->cpt_store;
$admins = get_users( [ 'role' => 'administrator', 'number' => 1, 'fields' => 'ID' ] );
wp_set_current_user( (int) $admins[0] );
$admin = new MKL\PC\Quote_Requests_Admin( $store );
$tag = wp_rand();
$user_id = wc_create_new_customer( "list-$tag@example.com", '', wp_generate_password(), [ 'first_name' => 'Lou', 'last_name' => 'List' ] );
wp_update_user( [ 'ID' => $user_id, 'display_name' => "Lou List $tag" ] );

function req( $store, $user_id, $legacy = false ) {
	$r = new MKL\PC\Quote_Request();
	$r->store = 'cpt'; $r->reference = 'Q-LIST-' . wp_rand( 1000, 9999 ); $r->created = time(); $r->user_id = $user_id;
	$r->fields = [ 'name' => 'Lou', 'email' => 'lou@example.com' ];
	$store->save( $r );
	if ( $legacy ) {
		delete_post_meta( $r->id, '_mkl_pc_quote_user_id' );
		wp_update_post( [ 'ID' => $r->id, 'post_author' => $user_id ] );
	}
	return $r->id;
}
$mine = req( $store, $user_id );
$legacy_mine = req( $store, $user_id, true );
$guest = req( $store, 0 );
$legacy_guest = req( $store, 0, true );

delete_option( 'mkl_pc_quote_user_ids_stored' );
check( 'count includes requests stored before the meta', 2 === $store->count_user_requests( $user_id ) );
check( 'meta written for old requests', $user_id === (int) get_post_meta( $legacy_mine, '_mkl_pc_quote_user_id', true ) && metadata_exists( 'post', $legacy_guest, '_mkl_pc_quote_user_id' ) && 0 === (int) get_post_meta( $legacy_guest, '_mkl_pc_quote_user_id', true ) );
check( 'done once', (bool) get_option( 'mkl_pc_quote_user_ids_stored' ) );

function listed( $admin, $get ) {
	$_GET = $get;
	$q = new WP_Query();
	$GLOBALS['wp_the_query'] = $q;
	$q->query_vars = [ 'post_type' => 'mkl_pc_quote', 'post_status' => array_keys( MKL\PC\CPT_Store::get_statuses() ), 'posts_per_page' => -1, 'fields' => 'ids' ];
	$admin->filter_list( $q );
	$ids = $q->get_posts();
	$_GET = [];
	return array_map( 'intval', $ids );
}
$ids = listed( $admin, [ 'mkl_pc_quote_user' => (string) $user_id ] );
sort( $ids ); $expected = [ $mine, $legacy_mine ]; sort( $expected );
check( 'one account\'s requests', $expected === $ids, wp_json_encode( $ids ) );
$ids = listed( $admin, [ 'mkl_pc_quote_customer' => 'guest' ] );
check( 'guests only', in_array( $guest, $ids, true ) && in_array( $legacy_guest, $ids, true ) && ! in_array( $mine, $ids, true ) && ! in_array( $legacy_mine, $ids, true ) );
$ids = listed( $admin, [ 'mkl_pc_quote_customer' => 'account' ] );
check( 'with an account only', in_array( $mine, $ids, true ) && in_array( $legacy_mine, $ids, true ) && ! in_array( $guest, $ids, true ) );
$ids = listed( $admin, [] );
check( 'no filter, everything', count( array_intersect( [ $mine, $legacy_mine, $guest, $legacy_guest ], $ids ) ) === 4 );

ob_start(); $admin->render_column( 'mkl_pc_quote_contact', $mine ); $html = ob_get_clean();
check( 'column names the account, linked to its requests', false !== strpos( $html, "Lou List $tag" ) && false !== strpos( $html, 'mkl_pc_quote_user=' . $user_id ) );
ob_start(); $admin->render_column( 'mkl_pc_quote_contact', $guest ); $html = ob_get_clean();
check( 'column says guest', false !== strpos( $html, '>Guest<' ) );

ob_start(); $admin->render_contact( get_post( $mine ) ); $html = ob_get_clean();
check( 'request screen links all their requests', false !== strpos( $html, 'All 2 requests' ) && false !== strpos( $html, 'mkl_pc_quote_user=' . $user_id ) );

ob_start(); $admin->profile_section( get_userdata( $user_id ) ); $html = ob_get_clean();
check( 'profile links the account\'s requests', false !== strpos( $html, 'Linked to this account' ) && false !== strpos( $html, '2 quote requests' ) && false === strpos( $html, 'Sent as a guest' ) );

require_once ABSPATH . 'wp-admin/includes/class-wp-screen.php'; require_once ABSPATH . 'wp-admin/includes/screen.php'; set_current_screen( 'edit-mkl_pc_quote' );
$_GET = [ 'mkl_pc_quote_user' => (string) $user_id ];
ob_start(); $admin->customer_filter_notice(); $html = ob_get_clean();
$_GET = [];
check( 'list says whose requests it shows', false !== strpos( $html, "Quote requests of Lou List $tag" ) && false !== strpos( $html, 'Show all requests' ) );

foreach ( [ $mine, $legacy_mine, $guest, $legacy_guest ] as $id ) wp_delete_post( $id, true );
wp_delete_user( $user_id );
wp_set_current_user( 0 );
mkl_pc_tests_done();
