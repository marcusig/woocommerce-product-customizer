<?php
// YITH Request a Quote Premium, for this process only: the site's active plugins are not changed.
const MKL_PC_TESTS_EXTRA_PLUGINS = [ 'yith-woocommerce-request-a-quote-premium/init.php' ];
require dirname( __DIR__ ) . '/bootstrap.php';
if ( ! function_exists( 'YITH_YWRAQ_Order_Request' ) && ! class_exists( 'YITH_YWRAQ_Order_Request' ) && ! defined( 'YITH_YWRAQ_PREMIUM' ) ) mkl_pc_tests_skip( 'YITH Request a Quote Premium is not installed.' );
if ( getenv( 'EXCL_TAX' ) ) add_filter( 'pre_option_woocommerce_prices_include_tax', function() { return 'no'; } );
check( 'YITH premium loaded', function_exists( 'YITH_YWRAQ_Order_Request' ) );
$admins = get_users( [ 'role' => 'administrator', 'number' => 1, 'fields' => 'ID' ] );
wp_set_current_user( (int) $admins[0] );
wc_load_cart();

$order = wc_create_order( [ 'status' => 'pending' ] );
$order->set_billing_email( 'lead@example.com' );
$order->save();
$payload = wp_json_encode( [
	[ 'is_choice' => true, 'layer_id' => 1, 'choice_id' => 2, 'angle_id' => 1, 'image' => 0 ],
	[ 'is_choice' => true, 'layer_id' => 3, 'choice_id' => 2, 'angle_id' => 1, 'image' => 0 ],
] );
$writer = new MKL\PC\Order_Item_Configuration();
$item = $writer->save( $order, wc_get_product( 613 ), $payload, [ 'quantity' => 2 ] );
$order = wc_get_order( $order->get_id() );
$item = $order->get_item( $item->get_id() );
echo 'configured line: ', $item->get_subtotal(), ' + tax ', $item->get_subtotal_tax(), "\n";

// The merchant prices the quote: 8000 incl. tax for the line of 2
$net = round( 8000 / 1.19, 4 );
$item->set_subtotal( $net ); $item->set_total( $net ); $item->save();
$order->calculate_totals( true );
$order->update_meta_data( 'ywraq_raq', 'yes' ); // As YITH marks the quotes it makes.
$order->update_status( 'ywraq-pending' );
$expected = (float) $order->get_total();
echo 'quoted order total: ', $expected, "\n";

wp_set_current_user( 0 );
wc_clear_notices();
YITH_YWRAQ_Order_Request()->order_accepted( $order->get_id() );
$errors = wc_get_notices( 'error' );
check( 'no error notice on accept', empty( $errors ), wp_json_encode( $errors ) );
$cart = WC()->cart->get_cart();
$line = current( $cart );
check( 'one line in the cart', 1 === count( $cart ) );
check( 'configuration carried', $line && ! empty( $line['configurator_data'] ) && ! empty( $line['configurator_data_raw'] ), $line ? implode( ',', array_keys( $line ) ) : '' );
check( 'quoted unit price set', $line && abs( $line['ywraq_price'] - ( getenv( 'EXCL_TAX' ) ? $net / 2 : 4000 ) ) < 0.02, $line ? (string) $line['ywraq_price'] : '' );
WC()->cart->calculate_totals();
check( 'cart total is the quoted total', abs( (float) WC()->cart->get_total( 'edit' ) - $expected ) < 0.05, WC()->cart->get_total( 'edit' ) );

// Next page load: the cart comes back from the session
WC()->cart->set_session();
$session_cart = WC()->session->get( 'cart' );
$awaiting = WC()->session->get( 'order_awaiting_payment' );
WC()->cart->empty_cart( false );
WC()->session->set( 'cart', $session_cart );
WC()->session->set( 'order_awaiting_payment', $awaiting );
WC()->cart->get_cart_from_session();
WC()->cart->calculate_totals();
check( 'still the quoted total after reload', abs( (float) WC()->cart->get_total( 'edit' ) - $expected ) < 0.05, WC()->cart->get_total( 'edit' ) );
check( 'no error notice after reload', empty( wc_get_notices( 'error' ) ), wp_json_encode( wc_get_notices( 'error' ) ) );

// Checkout: WooCommerce reuses the quote order (order_awaiting_payment) and rebuilds its lines from the cart
$order_id = WC()->checkout()->create_order( [ 'payment_method' => '', 'billing_email' => 'lead@example.com', 'billing_first_name' => 'Lea' ] );
check( 'checkout reuses the quote order', ! is_wp_error( $order_id ) && $order->get_id() === $order_id, is_wp_error( $order_id ) ? $order_id->get_error_message() : (string) $order_id );
$paid = wc_get_order( is_wp_error( $order_id ) ? $order->get_id() : $order_id );
$paid_line = current( $paid->get_items() );
check( 'order total stays quoted', abs( (float) $paid->get_total() - $expected ) < 0.05, $paid->get_total() );
check( 'line keeps its configuration', $paid_line && $paid_line->get_meta( '_configurator_data_raw' ) && 1 === count( $paid->get_items() ) );
$shown = $paid_line ? wp_list_pluck( $paid_line->get_formatted_meta_data(), 'display_value' ) : [];
check( 'configuration shown on the order', (bool) array_filter( $shown, function( $v ) { return false !== strpos( $v, 'Gold' ); } ), wp_strip_all_tags( implode( ' | ', $shown ) ) );

WC()->cart->empty_cart();
if ( ! is_wp_error( $order_id ) && $order_id !== $order->get_id() ) wc_get_order( $order_id )->delete( true );
wc_get_order( $order->get_id() )->delete( true );
mkl_pc_tests_done();
