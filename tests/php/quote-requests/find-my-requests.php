<?php
require dirname( __DIR__ ) . '/bootstrap.php';
$mails = [];
add_filter( 'pre_wp_mail', function( $null, $atts ) use ( &$mails ) { $mails[] = $atts; return true; }, 10, 2 );
$max = 100;
add_filter( 'mkl_pc_rate_limit_rule', function( $rule, $action ) use ( &$max ) { return MKL\PC\Quote_Customer_View::LOOKUP_ACTION === $action ? [ 'max' => $max, 'window' => HOUR_IN_SECONDS ] : $rule; }, 20, 2 );
$_SERVER['REMOTE_ADDR'] = '203.0.113.' . wp_rand( 1, 250 );

$quotes = mkl_pc( 'quotes' );
$store = $quotes->cpt_store;
$view = $quotes->customer_view;
$page_id = $view->get_page_id( true );
global $wp_query;
$wp_query = new WP_Query( [ 'page_id' => $page_id ] );
$GLOBALS['wp_the_query'] = $wp_query;

$tag = wp_rand();
$email = "lookup-$tag@example.com";
function req( $store, $email, $ref ) {
	$r = new MKL\PC\Quote_Request();
	$r->store = 'cpt'; $r->reference = $ref; $r->created = time(); $r->product_id = $r->configurator_id = 613;
	$r->fields = [ 'name' => 'Lu', 'email' => $email ];
	$store->save( $r );
	return $r->id;
}
$ids = [ req( $store, $email, "Q-LOOK1-$tag" ), req( $store, $email, "Q-LOOK2-$tag" ), req( $store, "other-$tag@example.com", "Q-LOOKX-$tag" ) ];

function submit( $view, $post ) {
	$_SERVER['REQUEST_METHOD'] = 'POST';
	$_POST = wp_slash( $post + [ MKL\PC\Quote_Customer_View::LOOKUP_ACTION => '1', '_wpnonce' => wp_create_nonce( MKL\PC\Quote_Customer_View::LOOKUP_ACTION ) ] );
	$r = new ReflectionProperty( $view, 'lookup' ); $r->setAccessible( true ); $r->setValue( $view, null );
	$view->handle_lookup();
	$html = $view->shortcode();
	$_POST = []; $_SERVER['REQUEST_METHOD'] = 'GET';
	return $html;
}
$throttle = 'mkl_pc_quote_lookup_' . md5( strtolower( $email ) );
delete_transient( $throttle );

$html = $view->shortcode();
check( 'visitors get the form', false !== strpos( $html, 'Find my requests' ) && false !== strpos( $html, 'name="email"' ) );

$html = submit( $view, [ 'email' => $email ] );
check( 'usual answer', false !== strpos( $html, 'we have emailed you their links' ) );
check( 'one email, to that address', 1 === count( $mails ) && $email === ( is_array( $mails[0]['to'] ) ? $mails[0]['to'][0] : $mails[0]['to'] ) );
$body = html_entity_decode( $mails[0]['message'] ?? '' );
$l1 = $store->get_by_reference( "Q-LOOK1-$tag" )->get_view_url();
check( 'with the links of its requests', false !== strpos( $body, $l1 ) && false !== strpos( $body, "Q-LOOK2-$tag" ) && false === strpos( $body, "Q-LOOKX-$tag" ) );
check( 'links open the request', false !== strpos( $l1, 'key=' ) );

$mails = [];
$html = submit( $view, [ 'email' => "nobody-$tag@example.com" ] );
check( 'unknown address: same answer, no email', false !== strpos( $html, 'we have emailed you their links' ) && 0 === count( $mails ) );

$html = submit( $view, [ 'email' => 'not an email' ] );
check( 'invalid address', false !== strpos( $html, 'valid email address' ) && false !== strpos( $html, 'aria-invalid="true"' ) );

$mails = [];
$html = submit( $view, [ 'email' => $email, 'website' => 'http://spam' ] );
check( 'bots read the usual answer, nothing sent', false !== strpos( $html, 'we have emailed you their links' ) && 0 === count( $mails ) );

$_SERVER['REQUEST_METHOD'] = 'POST';
$_POST = [ MKL\PC\Quote_Customer_View::LOOKUP_ACTION => '1', 'email' => $email, '_wpnonce' => 'bad' ];
$r = new ReflectionProperty( $view, 'lookup' ); $r->setAccessible( true ); $r->setValue( $view, null );
$view->handle_lookup(); $html = $view->shortcode(); $_POST = []; $_SERVER['REQUEST_METHOD'] = 'GET';
check( 'expired form', false !== strpos( $html, 'form expired' ) );

// An address gets a few emails an hour, whoever asks
$mails = [];
submit( $view, [ 'email' => $email ] ); submit( $view, [ 'email' => $email ] ); submit( $view, [ 'email' => $email ] );
check( 'three a hour per address (one already sent)', 2 === count( $mails ), (string) count( $mails ) );
$html = submit( $view, [ 'email' => $email ] );
check( 'beyond, the same answer', false !== strpos( $html, 'we have emailed you their links' ) );

// A visitor asks a few times an hour
$max = 1;
$_SERVER['REMOTE_ADDR'] = '198.51.100.' . wp_rand( 1, 250 );
submit( $view, [ 'email' => "x-$tag@example.com" ] );
$html = submit( $view, [ 'email' => "y-$tag@example.com" ] );
check( 'visitor limited', false !== strpos( $html, 'Too many requests' ) );

wp_set_current_user( (int) get_users( [ 'role' => 'administrator', 'number' => 1, 'fields' => 'ID' ] )[0] );
check( 'signed-in customers get their list, not the form', false === strpos( $view->shortcode(), 'Find my requests' ) );
wp_set_current_user( 0 );

delete_transient( $throttle );
foreach ( $ids as $id ) wp_delete_post( $id, true );
mkl_pc_tests_done();
