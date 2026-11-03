<?php
require dirname( __DIR__ ) . '/bootstrap.php';
add_filter( 'mkl_pc/quote_request/enabled', '__return_true' );
require_once ABSPATH . 'wp-admin/includes/user.php';
function schema() {
	$request = new WP_REST_Request( 'GET', '/mkl_pc/v1/quote-requests/schema' );
	$request->set_param( 'product_id', 613 );
	return rest_do_request( $request );
}
$fields = mkl_pc( 'quotes' )->fields;

$response = schema();
check( 'guests get no values', 200 === $response->get_status() && [] === (array) $response->get_data()['values'], wp_json_encode( $response->get_data()['values'] ) );
check( 'guest schema is cacheable as before', ! isset( $response->get_headers()['Cache-Control'] ) );

$user_id = wc_create_new_customer( 'prefill-' . wp_rand() . '@example.com', '', wp_generate_password(), [ 'first_name' => 'Pia', 'last_name' => 'Account' ] );
$customer = new WC_Customer( $user_id );
$customer->set_billing_phone( '+33 1 23 45' );
$customer->save();
wp_set_current_user( $user_id );
$response = schema();
$values = (array) $response->get_data()['values'];
check( 'signed in: name, email and phone', 'Pia Account' === ( $values['name'] ?? '' ) && get_userdata( $user_id )->user_email === ( $values['email'] ?? '' ) && '+33 1 23 45' === ( $values['phone'] ?? '' ), wp_json_encode( $values ) );
check( 'never the message or a consent', ! isset( $values['message'] ) && ! isset( $values['consent'] ) );
check( 'not cacheable', false !== strpos( $response->get_headers()['Cache-Control'] ?? '', 'no-store' ) && false !== strpos( $response->get_headers()['Cache-Control'], 'private' ) );
check( 'disabled fields not given', ! isset( $values['company'] ) );

$customer->set_billing_first_name( 'Pia' ); $customer->set_billing_last_name( 'Billing' ); $customer->set_billing_email( 'pia.billing@example.com' ); $customer->save();
$values = (array) schema()->get_data()['values'];
check( 'billing address wins', 'Pia Billing' === $values['name'] && 'pia.billing@example.com' === $values['email'], wp_json_encode( $values ) );

add_filter( 'mkl_pc/quote_request/account_values', '__return_empty_array' );
check( 'filter can turn it off', [] === (array) schema()->get_data()['values'] );
remove_filter( 'mkl_pc/quote_request/account_values', '__return_empty_array' );

wp_set_current_user( 0 );
wp_delete_user( $user_id );
mkl_pc_tests_done();
