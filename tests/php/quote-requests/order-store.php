<?php
require dirname( __DIR__ ) . '/bootstrap.php';
$mails = [];
add_filter( 'pre_wp_mail', function( $r, $atts ) use ( &$mails ) { $mails[] = $atts; return true; }, 10, 2 );
add_filter( 'mkl_pc/quote_request/enabled', '__return_true' );
$storage = 'woo_order';
add_filter( 'mkl/pc/setting/quote_request_storage', function() use ( &$storage ) { return $storage; } );
add_filter( 'mkl_pc/quote_request/fields', function( $f ) { $f['deadline'] = [ 'type' => 'date', 'label' => 'Deadline', 'order' => 55 ]; return $f; } );
$orders = []; $posts = []; $files = [];

$payload = [];
foreach ( [ [1,1,68,'Cases','Stainless steel'], [2,1,61,'Bezels','Bezel'], [6,1,82,'Dial','Blue sunburst'], [3,1,69,'Band','Steel'], [4,1,63,'Hands','Hands'] ] as $c ) {
	$payload[] = [ 'layer_id' => $c[0], 'choice_id' => $c[1], 'angle_id' => 1, 'image' => $c[2], 'layer_name' => $c[3], 'name' => $c[4] ];
}
$fields = [ 'name' => 'Ada King Lovelace', 'email' => 'ada-phase3@example.com', 'phone' => '0612345678', 'message' => 'Please quote 2', 'deadline' => '2026-12-24' ];

check( 'woo order is the store', 'woo_order' === mkl_pc( 'quotes' )->get_store()->get_id() );
check( 'status registered with WooCommerce', isset( wc_get_order_statuses()['wc-mkl-quote'] ) );

$request = mkl_pc_create_quote_request( [ 'product_id' => 613, 'quantity' => 2, 'configuration' => $payload, 'fields' => $fields ] );
check( 'request created', $request instanceof MKL\PC\Quote_Request && $request->id, is_wp_error( $request ) ? $request->get_error_message() : '' );
$order = wc_get_order( $request->id ); $orders[] = $order;
check( 'order has the quote status', $order && $order->has_status( 'mkl-quote' ) && 'mkl_pc_quote_request' === $order->get_created_via() );
check( 'billing details from the form', 'Ada' === $order->get_billing_first_name() && 'King Lovelace' === $order->get_billing_last_name() && 'ada-phase3@example.com' === $order->get_billing_email() && '0612345678' === $order->get_billing_phone() );
check( 'message is the customer note', 'Please quote 2' === $order->get_customer_note() );
$items = $order->get_items();
$item = reset( $items );
check( 'one line item, product and quantity', 1 === count( $items ) && 613 === $item->get_product_id() && 2 === $item->get_quantity() );
$meta = wp_json_encode( array_map( function( $m ) { return $m->display_value; }, $item->get_formatted_meta_data() ) );
check( 'item shows the configuration', false !== strpos( $meta, 'Stainless steel' ) && false !== strpos( $meta, 'Blue sunburst' ), substr( $meta, 0, 200 ) );
check( 'item keeps the configurator data', is_array( $item->get_meta( '_configurator_data' ) ) && $item->get_meta( '_pc_configurator_data_raw' ) );
$expected = (float) wc_get_price_excluding_tax( wc_get_product( 613 ), [ 'qty' => 2, 'price' => $request->price['total'] ] );
check( 'line total from the price snapshot', abs( (float) $item->get_total() - $expected ) < 0.01, $item->get_total() . ' vs ' . $expected );
check( 'admin email links to the order', false !== strpos( html_entity_decode( $mails[0]['message'] ?? '' ), $order->get_edit_order_url() ) );
check( 'quote orders are editable', $order->is_editable() );
check( 'left out of Analytics', in_array( 'mkl-quote', apply_filters( 'woocommerce_analytics_excluded_order_statuses', [] ), true ) );
check( 'not cancelled as unpaid', ! apply_filters( 'woocommerce_cancel_unpaid_order', in_array( $order->get_created_via(), [ 'checkout', 'store-api' ], true ), $order ) );
ob_start(); mkl_pc( 'quotes' )->woo_order_store->show_request_details( $order ); $details = ob_get_clean();
check( 'order screen shows the reference and the unmapped field', false !== strpos( $details, $request->reference ) && false !== strpos( $details, 'Deadline' ) && false === strpos( $details, 'Phone' ) );

// Send the quote
$actions = apply_filters( 'woocommerce_order_actions', [], $order );
check( 'send quote action offered', isset( $actions['mkl_pc_send_quote'] ) );
$mails = [];
do_action( 'woocommerce_order_action_mkl_pc_send_quote', $order );
$order = wc_get_order( $order->get_id() );
check( 'sent quote is pending payment', $order->has_status( 'pending' ) && $order->needs_payment() );
$invoice = $mails[0] ?? [];
check( 'customer gets the payment link', 'ada-phase3@example.com' === ( $invoice['to'] ?? '' ) && false !== strpos( html_entity_decode( $invoice['message'] ?? '' ), $order->get_checkout_payment_url() ), $invoice['subject'] ?? 'no mail' );
check( 'action gone once sent', ! isset( apply_filters( 'woocommerce_order_actions', [], $order )['mkl_pc_send_quote'] ) );

// 3D capture moves to orders/
$im = imagecreatetruecolor( 20, 20 ); ob_start(); imagepng( $im ); $png = ob_get_clean();
$r3d = mkl_pc_create_quote_request( [ 'product_id' => 500, 'configuration' => [ [ 'layer_id' => 1, 'choice_id' => 1, 'angle_id' => 1 ] ], 'fields' => $fields, 'image' => 'data:image/png;base64,' . base64_encode( $png ) ] );
$o3d = wc_get_order( $r3d->id ); $orders[] = $o3d;
$i3d = current( $o3d->get_items() );
$rel = $i3d->get_meta( '_configurator_3d_screenshot_path' );
$abs = wp_upload_dir()['basedir'] . '/mkl-pc-config-images/' . $rel;
check( '3D capture stored with the order item', 0 === strpos( $rel, 'orders/order-' . $o3d->get_id() . '-' ) && is_file( $abs ), $rel );
check( 'and nothing left in cart-temp', ! glob( wp_upload_dir()['basedir'] . '/mkl-pc-config-images/cart-temp/quote-' . strtolower( $r3d->reference ) . '-*' ) );
check( 'emails attach the moved capture', in_array( $abs, $mails[ count( $mails ) - 2 ]['attachments'] ?? [], true ) );
$files[] = $abs;

// Request kept as a post, then turned into an order
$storage = 'cpt';
$rpost = mkl_pc_create_quote_request( [ 'product_id' => 500, 'configuration' => [ [ 'layer_id' => 1, 'choice_id' => 1, 'angle_id' => 1 ] ], 'fields' => $fields, 'image' => 'data:image/png;base64,' . base64_encode( $png ) ] );
$posts[] = $rpost->id;
$converted = mkl_pc( 'quotes' )->woo_order_store->create_order_from_request_post( $rpost->id );
check( 'request post becomes an order', $converted instanceof WC_Order && $converted->has_status( 'mkl-quote' ) );
if ( $converted instanceof WC_Order ) {
	$orders[] = $converted;
	check( 'order and request are linked', (int) $converted->get_meta( '_mkl_pc_quote_request_id' ) === $rpost->id && (int) get_post_meta( $rpost->id, '_mkl_pc_quote_order_id', true ) === $converted->get_id() );
	$again = mkl_pc( 'quotes' )->woo_order_store->create_order_from_request_post( $rpost->id );
	check( 'converting twice gives the same order', $again->get_id() === $converted->get_id() );
	$ci = current( $converted->get_items() );
	$crel = $ci->get_meta( '_configurator_3d_screenshot_path' );
	check( 'capture copied to the order, the request keeps its own', $crel && is_file( wp_upload_dir()['basedir'] . '/mkl-pc-config-images/' . $crel ) && is_file( $rpost->image_path ) );
	$files[] = wp_upload_dir()['basedir'] . '/mkl-pc-config-images/' . $crel;
	$stored = array_filter( $ci->get_meta( '_configurator_data' ), function( $c ) { return $c->is_stored(); } );
	check( 'order choices are stored ones', count( $stored ) > 0 );
}

foreach ( $orders as $o ) if ( $o ) $o->delete( true );
foreach ( $posts as $p ) wp_delete_post( $p, true );
foreach ( $files as $f ) if ( is_file( $f ) ) wp_delete_file( $f );
$left = wc_get_orders( [ 'created_via' => 'mkl_pc_quote_request', 'limit' => -1, 'status' => array_keys( wc_get_order_statuses() ) ] );
echo 'quote orders left: ', count( $left ), "\n";
mkl_pc_tests_done();