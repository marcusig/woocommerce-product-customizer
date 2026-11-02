<?php
require dirname( __DIR__ ) . '/bootstrap.php';
require_once ABSPATH . 'wp-admin/includes/post.php';
require_once MKL_PC_INCLUDE_PATH . 'quote-requests/admin/class-quote-requests-admin.php';

function payload( $case_choice, $band_choice ) {
	return wp_json_encode( [
		[ 'is_choice' => true, 'layer_id' => 1, 'choice_id' => $case_choice, 'angle_id' => 1, 'image' => 0 ],
		[ 'is_choice' => true, 'layer_id' => 3, 'choice_id' => $band_choice, 'angle_id' => 1, 'image' => 0 ],
	] );
}
function save_config( $target, $payload, $quantity = 1, $image = '' ) {
	$rest = new WP_REST_Request( 'POST', '/mkl_pc/v1/configuration-editor/save' );
	$rest->set_header( 'Content-Type', 'application/json' );
	$rest->set_body( wp_json_encode( [ 'target' => $target, 'configuration' => $payload, 'quantity' => $quantity, 'image' => $image ] ) );
	return rest_do_request( $rest );
}
$mails = [];
add_filter( 'pre_wp_mail', function( $null, $atts ) use ( &$mails ) { $mails[] = $atts; return true; }, 10, 2 );

$editor = mkl_pc( 'configuration_editor' );
$store = mkl_pc( 'quotes' )->cpt_store;
$admins = get_users( [ 'role' => 'administrator', 'number' => 1, 'fields' => 'ID' ] );
$admin_id = (int) $admins[0];
wp_set_current_user( $admin_id );
$admin = new MKL\PC\Quote_Requests_Admin( $store );

// Add request: WordPress makes an auto-draft, as on post-new.php
check( 'admins can add requests', current_user_can( get_post_type_object( 'mkl_pc_quote' )->cap->create_posts ) );
$post = get_default_post_to_edit( 'mkl_pc_quote', true );
$id = $post->ID;
$draft = $store->load( $id );
check( 'draft has no reference nor customer account', '' === $draft->reference && 0 === $draft->user_id, $draft->reference . ' / ' . $draft->user_id );
check( 'nothing to edit yet', is_wp_error( $editor->resolve_target( "quote:$id" ) ) );
$resolved = $editor->resolve_target( "quote:$id:product:613" );
check( 'a product can be configured for it', ! is_wp_error( $resolved ) && $resolved['is_new'] && 'Add to the request' === $resolved['save_label'] );
wp_set_current_user( 0 );
check( 'not by visitors', is_wp_error( $editor->resolve_target( "quote:$id:product:613" ) ) && 401 === save_config( "quote:$id:product:613", payload( 1, 1 ) )->get_status() );
wp_set_current_user( $admin_id );
check( 'not on another post type', is_wp_error( $editor->resolve_target( 'quote:' . get_posts( [ 'post_type' => 'page', 'numberposts' => 1, 'fields' => 'ids' ] )[0] . ':product:613' ) ) );

ob_start(); $admin->render_request( get_post( $id ) ); $html = ob_get_clean();
check( 'screen asks for a product', false !== strpos( $html, 'mkl-pc-add-configured-product' ) && false !== strpos( $html, 'data-target="quote:' . $id . '"' ) && false === strpos( $html, 'mkl-pc-open-configuration-editor' ) );

// Configure it, as the frame does
$response = save_config( "quote:$id:product:613", payload( 1, 1 ), 2 );
check( 'configuration saved', 200 === $response->get_status() && $id === $response->get_data()['request_id'], $response->get_status() . ' ' . wp_json_encode( $response->get_data() ) );
$request = $store->load( $id );
check( 'reference given and used as title', preg_match( '/^Q-\d{8}-[A-Z0-9]{4}$/', $request->reference ) && get_the_title( $id ) === $request->reference, $request->reference );
check( 'still no customer account', 0 === $request->user_id );
check( 'product, quantity and price', 613 === $request->product_id && 2 === $request->quantity && abs( $request->price['line_total'] - 3120 ) < 0.02, wp_json_encode( $request->price ) );
$summary = wp_json_encode( $request->get_summary() );
check( 'summary frozen with the choices', false !== strpos( $summary, 'Steel' ), $summary );
$log = $store->get_log( $id );
check( 'history: product added', 1 === count( $log ) && false !== strpos( $log[0]['message'], 'Configured product added' ) && $admin_id === $log[0]['user_id'], wp_json_encode( $log ) );
check( 'still a draft', 'auto-draft' === get_post_status( $id ) );

$resolved = $editor->resolve_target( "quote:$id" );
check( 'now editable, preloaded', ! is_wp_error( $resolved ) && ! $resolved['is_new'] && 2 === count( $resolved['configuration'] ) && 2 === $resolved['quantity'] );
ob_start(); $admin->render_request( get_post( $id ) ); $html = ob_get_clean();
check( 'screen offers edit and change', false !== strpos( $html, 'mkl-pc-open-configuration-editor' ) && false !== strpos( $html, 'Change the product' ) && false !== strpos( $html, $request->reference ) );

// The admin types the customer's details and saves (post.php)
$_POST = [
	'mkl_pc_quote_status_nonce' => wp_create_nonce( 'mkl_pc_quote_status' ),
	'mkl_pc_quote_status'       => 'mkl_quote_progress',
	'mkl_pc_quote_notes'        => 'Called on Monday',
	'mkl_pc_quote_fields_shown' => '1',
	'mkl_pc_quote_fields'       => [ 'name' => 'Lea O\'Brien', 'email' => 'lead@example.com', 'phone' => 'not a phone', 'message' => "Two \"quoted\" words\\slash" ],
	'mkl_pc_quote_price'        => '2500' . wc_get_price_decimal_separator() . '50',
	'mkl_pc_quote_message'      => 'Delivery in two weeks.',
	'save'                      => 'Save',
];
$_POST = wp_slash( $_POST );
wp_update_post( [ 'ID' => $id, 'post_status' => 'draft' ] ); // What edit_post() does to an auto-draft.
$admin->save( $id, get_post( $id ) );
$request = $store->load( $id );
check( 'details saved, quotes and slashes kept', 'Lea O\'Brien' === $request->get_name() && "Two \"quoted\" words\\slash" === $request->get_field( 'message' ), wp_json_encode( $request->fields ) );
check( 'invalid phone left out', '' === $request->get_field( 'phone' ) );
check( 'privacy lookup follows the email', 'lead@example.com' === get_post_meta( $id, '_mkl_pc_quote_email', true ) );
check( 'quoted price read in the shop format', 2500.5 === $request->quoted_price && 2500.5 === $request->get_line_price(), var_export( $request->quoted_price, true ) );
check( 'status set', 'mkl_quote_progress' === get_post_status( $id ) );
check( 'message kept until sent', 'Delivery in two weeks.' === get_post_meta( $id, '_mkl_pc_quote_message', true ) );
check( 'customer-facing checkboxes not offered', ! isset( $request->field_definitions['consent'] ) && isset( $request->field_definitions['email'] ) );
$notices = get_transient( MKL\PC\Quote_Requests_Admin::NOTICES . $admin_id );
check( 'phone error reported', is_array( $notices ) && false !== strpos( wp_json_encode( $notices ), 'Phone' ), wp_json_encode( $notices ) );
delete_transient( MKL\PC\Quote_Requests_Admin::NOTICES . $admin_id );
check( 'nothing sent on save', 0 === count( $mails ) );

// Edit the configuration: the quoted price stays, the configured price follows
$response = save_config( "quote:$id", payload( 2, 2 ), 1 );
$request = $store->load( $id );
check( 'configuration edited', 200 === $response->get_status() && false !== strpos( wp_json_encode( $request->get_summary() ), 'Gold' ) && 1 === $request->quantity );
check( 'configured price recalculated', abs( $request->price['line_total'] - ( 1500 + 8400 + 30 ) ) < 0.02, wp_json_encode( $request->price ) );
check( 'quoted price kept', 2500.5 === $request->quoted_price );
check( 'details kept', 'lead@example.com' === $request->get_email() && 'Called on Monday' === get_post_meta( $id, '_mkl_pc_quote_notes', true ) );
check( 'status kept', 'mkl_quote_progress' === get_post_status( $id ) );
$log = $store->get_log( $id );
check( 'history: edit with prices', 2 === count( $log ) && false !== strpos( end( $log )['message'], 'edited' ) && false !== strpos( end( $log )['message'], '→' ), wp_json_encode( $log ) );

// Save and send
$_POST['mkl_pc_quote_send'] = '1';
$_POST['mkl_pc_quote_status_nonce'] = wp_create_nonce( 'mkl_pc_quote_status' );
$admin->save( $id, get_post( $id ) );
check( 'one email sent, to the customer', 1 === count( $mails ) && 'lead@example.com' === ( is_array( $mails[0]['to'] ) ? $mails[0]['to'][0] : $mails[0]['to'] ), wp_json_encode( wp_list_pluck( $mails, 'to' ) ) );
$mail = $mails[0]['message'] ?? '';
$subject = $mails[0]['subject'] ?? '';
check( 'subject names the quote', false !== strpos( $subject, $request->reference ) && false !== stripos( $subject, 'quote' ), $subject );
$price_text = preg_replace( '/\s+/u', ' ', html_entity_decode( wp_strip_all_tags( substr( $mail, strpos( $mail, 'Price:' ) ?: 0, 400 ) ) ) );
check( 'email has the quoted price', false !== strpos( $price_text, '500,50' ), $price_text );
check( 'email has the message and the choices', false !== strpos( $mail, 'Delivery in two weeks.' ) && false !== strpos( $mail, 'Gold' ) );
check( 'email is a quote, without the contact table', false !== strpos( $mail, 'Quote ' . $request->reference ) && false === strpos( $mail, 'Contact details' ) && false === strpos( $mail, 'Estimated price' ) );
check( 'answered, message cleared', 'mkl_quote_answered' === get_post_status( $id ) && '' === get_post_meta( $id, '_mkl_pc_quote_message', true ) && get_post_meta( $id, '_mkl_pc_quote_sent', true ) );
$log = $store->get_log( $id );
check( 'history: sent with price', false !== strpos( end( $log )['message'], 'Quote sent to lead@example.com' ) && false !== strpos( end( $log )['message'], '2' ), end( $log )['message'] );
$notices = get_transient( MKL\PC\Quote_Requests_Admin::NOTICES . $admin_id );
check( 'success reported', is_array( $notices ) && 'success' === end( $notices )[0], wp_json_encode( $notices ) );
delete_transient( MKL\PC\Quote_Requests_Admin::NOTICES . $admin_id );
$_POST = [];

// Sending needs an email and a configuration
$empty = get_default_post_to_edit( 'mkl_pc_quote', true );
$sent = $admin->send( $store->load( $empty->ID ) );
check( 'no configuration, not sent', is_wp_error( $sent ) && 'mkl_pc_quote_not_configured' === $sent->get_error_code() );
$no_email = $store->load( $id );
$no_email->fields['email'] = '';
check( 'no email, not sent', is_wp_error( $admin->send( $no_email ) ) && 1 === count( $mails ) );
wp_delete_post( $empty->ID, true );

// A request from the configurator, edited: 3D capture replaced, customer account kept
$customer = get_users( [ 'role' => 'customer', 'number' => 1, 'fields' => 'ID' ] );
$customer_id = $customer ? (int) $customer[0] : 0;
$front = new MKL\PC\Quote_Request();
$front->store = 'cpt';
$front->reference = 'Q-TEST-0001';
$front->created = time();
$front->user_id = $customer_id;
$front->product_id = $front->configurator_id = 6958;
$front->configuration_raw = payload( 1, 1 );
$front->fields = [ 'name' => 'Customer', 'email' => 'customer@example.com' ];
$front->field_definitions = [ 'name' => [ 'label' => 'Name', 'type' => 'text', 'options' => [], 'maps_to' => 'full_name' ], 'email' => [ 'label' => 'Email', 'type' => 'email', 'options' => [], 'maps_to' => 'billing_email' ] ];
$dir = wp_upload_dir()['basedir'] . '/mkl-pc-config-images/quote-requests';
wp_mkdir_p( $dir );
file_put_contents( $dir . '/quote-q-test-0001-old.png', 'x' );
$front->image_path = $dir . '/quote-q-test-0001-old.png';
$front->meta['owns_image'] = true;
$store->save( $front );
$png = imagecreatetruecolor( 64, 64 ); ob_start(); imagepng( $png ); $data_url = 'data:image/png;base64,' . base64_encode( ob_get_clean() );
$response = save_config( 'quote:' . $front->id, payload( 2, 1 ), 1, $data_url );
$edited = $store->load( $front->id );
check( 'customer request edited', 200 === $response->get_status() && 'Q-TEST-0001' === $edited->reference, $response->get_status() . ' ' . wp_json_encode( $response->get_data() ) );
check( 'customer account kept', $customer_id === $edited->user_id && $customer_id === (int) get_post_field( 'post_author', $front->id ) );
check( 'new 3D capture owned, old one deleted', $edited->image_path && is_file( $edited->image_path ) && ! empty( $edited->meta['owns_image'] ) && ! is_file( $dir . '/quote-q-test-0001-old.png' ), $edited->image_path );
check( 'status untouched by an edit', 'mkl_quote_new' === get_post_status( $front->id ) );
$capture = $edited->image_path;

// Woo order from the stored request uses the quoted price
$quoted = $store->load( $id );
$order = mkl_pc( 'quotes' )->woo_order_store->create_order( $quoted );
$line = $order && ! is_wp_error( $order ) ? current( $order->get_items() ) : null;
check( 'order made with the quoted price', $line && abs( (float) $line->get_total() + (float) $line->get_total_tax() - 2500.5 ) < 0.02, $line ? $line->get_total() . ' + ' . $line->get_total_tax() : 'no order' );
check( 'order has no customer account', $order && ! is_wp_error( $order ) && 0 === $order->get_customer_id() );
if ( $order && ! is_wp_error( $order ) ) $order->delete( true );

wp_delete_post( $front->id, true );
check( 'capture deleted with the request', ! is_file( $capture ) );
wp_delete_post( $id, true );
wp_set_current_user( 0 );
mkl_pc_tests_done();
