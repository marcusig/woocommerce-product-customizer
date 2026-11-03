<?php
require dirname( __DIR__ ) . '/bootstrap.php';
require_once MKL_PC_INCLUDE_PATH . 'quote-requests/admin/class-quote-requests-admin.php';

$mails = []; $mail_result = null;
add_filter( 'pre_wp_mail', function( $r, $atts ) use ( &$mails, &$mail_result ) { $mails[] = $atts; return null === $mail_result ? true : $mail_result; }, 10, 2 );
add_filter( 'mkl_pc/quote_request/enabled', '__return_true' );
$storage = 'cpt';
add_filter( 'mkl/pc/setting/quote_request_storage', function() use ( &$storage ) { return $storage; } );
$created = [];

$tricky = 'He said "hi" \o/ C:\path';
$payload = [];
foreach ( [ [1,1,68,'Cases','Stainless steel'], [2,1,61,'Bezels','Bezel'], [6,1,82,'Dial','Blue sunburst'], [3,1,69,'Band','Steel'], [4,1,63,'Hands','Hands'] ] as $c ) {
	$payload[] = [ 'layer_id' => $c[0], 'choice_id' => $c[1], 'angle_id' => 1, 'image' => $c[2], 'layer_name' => $c[3], 'name' => $c[4] ];
}
$payload[0]['field_value'] = $tricky;
$fields = [ 'name' => 'Ada Lovelace', 'email' => 'ada-phase2@example.com', 'phone' => '0612345678', 'message' => $tricky ];

check( 'post type registered', post_type_exists( 'mkl_pc_quote' ) );
check( 'statuses registered', null !== get_post_status_object( 'mkl_quote_new' ) && null !== get_post_status_object( 'mkl_quote_closed' ) );
check( 'cpt is the store', 'cpt' === mkl_pc( 'quotes' )->get_store()->get_id() );

// Store a 2D request
$request = mkl_pc_create_quote_request( [ 'product_id' => 613, 'quantity' => 2, 'configuration' => $payload, 'fields' => $fields ] );
check( 'request stored', $request instanceof MKL\PC\Quote_Request && $request->id > 0, is_wp_error( $request ) ? $request->get_error_message() : '' );
$id = $request->id; $created[] = $id;
$post = get_post( $id );
check( 'post is new, titled with the reference', 'mkl_quote_new' === $post->post_status && $request->reference === $post->post_title );
$raw = get_post_meta( $id, '_mkl_pc_quote_configuration', true );
check( 'raw configuration survives slashes and quotes', $raw === $request->configuration_raw && false !== strpos( json_decode( $raw )[0]->field_value ?? '', '\o/ C:\path' ), $raw );
check( 'form values survive slashes and quotes', $tricky === get_post_meta( $id, '_mkl_pc_quote_fields', true )['message'] );

$admin_mail = $mails[0]['message'] ?? '';
$url = admin_url( 'post.php?post=' . $id . '&action=edit' );
// The email's inliner rewrites entities: compare the URLs themselves.
check( 'admin email links to the request', false !== strpos( html_entity_decode( $admin_mail ), $url ) );
check( 'customer email does not', false === strpos( $mails[1]['message'] ?? '', 'post.php' ) );

// Load it back
$store = mkl_pc( 'quotes' )->cpt_store;
$loaded = $store->load( $id );
check( 'loaded fields', $loaded->fields == $request->fields && 2 === $loaded->quantity && 613 === $loaded->product_id );
check( 'loaded summary is the frozen one', ! empty( $loaded->summary ) && false !== strpos( wp_json_encode( $loaded->get_summary() ), 'Stainless steel' ) );
$stored = array_filter( $loaded->configuration->get_layers(), function( $c ) { return $c->is_stored(); } );
check( 'rebuilt choices are marked stored', count( $stored ) === count( $loaded->configuration->get_layers() ) && count( $stored ) > 0 );
check( 'image found again', $loaded->image_path && is_file( $loaded->image_path ) && $loaded->image_url, $loaded->image_path );
check( 'field labels kept with the request', 'Message' === $loaded->get_field_rows()[3]['label'] ?? '' );

// Admin screens
$admins = get_users( [ 'role' => 'administrator', 'number' => 1, 'fields' => 'ID' ] );
wp_set_current_user( (int) $admins[0] );
$admin = new MKL\PC\Quote_Requests_Admin( $store );
ob_start(); $admin->render_request( get_post( $id ) ); $admin->render_contact( get_post( $id ) ); $html = ob_get_clean();
check( 'request screen shows the configuration', false !== strpos( $html, 'Stainless steel' ) && false !== strpos( $html, $request->reference ) );
check( 'request screen shows escaped customer text', false !== strpos( $html, 'He said &quot;hi&quot;' ) );
ob_start(); foreach ( [ 'mkl_pc_quote_contact', 'mkl_pc_quote_product', 'mkl_pc_quote_status' ] as $col ) $admin->render_column( $col, $id ); $cols = ob_get_clean();
check( 'list columns', false !== strpos( $cols, 'ada-phase2@example.com' ) && false !== strpos( $cols, '&times; 2' ) && false !== strpos( $cols, 'New' ) );
$_POST = [ 'mkl_pc_quote_status_nonce' => wp_create_nonce( 'mkl_pc_quote_status' ), 'mkl_pc_quote_status' => 'mkl_quote_progress', 'mkl_pc_quote_notes' => 'Called back' ];
$admin->save( $id, get_post( $id ) );
$_POST = [];
check( 'status and notes saved', 'mkl_quote_progress' === get_post_status( $id ) && 'Called back' === get_post_meta( $id, '_mkl_pc_quote_notes', true ) );
$bad = [ 'mkl_pc_quote_status_nonce' => 'nope', 'mkl_pc_quote_status' => 'mkl_quote_closed' ];
$_POST = $bad; $admin->save( $id, get_post( $id ) ); $_POST = [];
check( 'a bad nonce changes nothing', 'mkl_quote_progress' === get_post_status( $id ) );
wp_set_current_user( 0 );

// Privacy
$export = mkl_pc( 'quotes' )->privacy->export( 'ada-phase2@example.com' );
check( 'export finds the request', 1 === count( $export['data'] ) && $export['done'] && false !== strpos( wp_json_encode( $export['data'] ), $request->reference ) );

// 3D capture is owned and deleted with the request
$im = imagecreatetruecolor( 20, 20 ); ob_start(); imagepng( $im ); $png = ob_get_clean();
$r3d = mkl_pc_create_quote_request( [ 'product_id' => 500, 'configuration' => [ [ 'layer_id' => 1, 'choice_id' => 1, 'angle_id' => 1 ] ], 'fields' => $fields, 'image' => 'data:image/png;base64,' . base64_encode( $png ) ] );
$created[] = $r3d->id;
check( '3D capture kept in quote-requests/', is_file( $r3d->image_path ) && false !== strpos( $r3d->image_path, '/mkl-pc-config-images/quote-requests/' ), $r3d->image_path );
$file3d = $r3d->image_path;

$erase = mkl_pc( 'quotes' )->privacy->erase( 'ada-phase2@example.com' );
check( 'erase deletes the requests', $erase['items_removed'] && null === get_post( $id ) && null === get_post( $r3d->id ) );
check( 'and the 3D capture with them', ! file_exists( $file3d ) );
check( 'but not the shared 2D merged image', is_file( $loaded->image_path ) );

// Retention
$old = mkl_pc_create_quote_request( [ 'product_id' => 613, 'configuration' => $payload, 'fields' => [ 'name' => 'Old', 'email' => 'old-phase2@example.com' ] ] );
$new = mkl_pc_create_quote_request( [ 'product_id' => 613, 'configuration' => $payload, 'fields' => [ 'name' => 'New', 'email' => 'new-phase2@example.com' ] ] );
$created[] = $old->id; $created[] = $new->id;
global $wpdb;
$wpdb->update( $wpdb->posts, [ 'post_date' => '2025-01-01 10:00:00', 'post_date_gmt' => '2025-01-01 09:00:00' ], [ 'ID' => $old->id ] );
clean_post_cache( $old->id );
add_filter( 'mkl_pc/quote_request/retention_days', function() { return 0; } );
check( 'retention off keeps everything', 0 === mkl_pc( 'quotes' )->privacy->delete_expired() );
remove_all_filters( 'mkl_pc/quote_request/retention_days' );
add_filter( 'mkl_pc/quote_request/retention_days', function() { return 365; } );
$deleted = mkl_pc( 'quotes' )->privacy->delete_expired();
check( 'retention deletes old requests only', 1 === $deleted && null === get_post( $old->id ) && null !== get_post( $new->id ), "deleted $deleted" );

// Persistent store: a failed email does not lose the request
$mail_result = false;
$failed = mkl_pc_create_quote_request( [ 'product_id' => 613, 'configuration' => $payload, 'fields' => [ 'name' => 'Nomail', 'email' => 'nomail-phase2@example.com' ] ] );
$mail_result = null;
check( 'a stored request survives a failed email', $failed instanceof MKL\PC\Quote_Request && get_post( $failed->id ) );
if ( $failed instanceof MKL\PC\Quote_Request ) $created[] = $failed->id;

// Fallback
// A store this site cannot use (as WooCommerce orders without WooCommerce)
add_filter( 'mkl_pc/quote_request/stores', function( $stores ) {
	$stores['unavailable'] = new class() extends MKL\PC\Email_Only_Store {
		public function get_id() { return 'unavailable'; }
		public function is_available() { return false; }
	};
	return $stores;
} );
$stores_cache = new ReflectionProperty( mkl_pc( 'quotes' ), 'stores' );
$stores_cache->setAccessible( true );
$stores_cache->setValue( mkl_pc( 'quotes' ), null );
$storage = 'unavailable';
check( 'an unavailable store falls back to posts', 'cpt' === mkl_pc( 'quotes' )->get_store()->get_id(), mkl_pc( 'quotes' )->get_store()->get_id() );
$storage = 'email';
check( 'email only stays email only', 'email' === mkl_pc( 'quotes' )->get_store()->get_id() );

foreach ( $created as $post_id ) if ( get_post( $post_id ) ) wp_delete_post( $post_id, true );
$left = get_posts( [ 'post_type' => 'mkl_pc_quote', 'post_status' => 'any', 'fields' => 'ids', 'posts_per_page' => -1 ] );
echo 'quote posts left: ', count( $left ), "\n";
mkl_pc_tests_done();