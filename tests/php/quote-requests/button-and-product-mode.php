<?php
require dirname( __DIR__ ) . '/bootstrap.php';
// This suite saves the request form itself, and puts the site's back.
remove_all_filters( 'pre_option_mkl_pc_quote_request_fields' );
require_once MKL_PC_INCLUDE_PATH . 'quote-requests/admin/class-quote-fields-settings.php';
global $wpdb;
add_filter( 'pre_wp_mail', '__return_true' );
$enabled = true;
add_filter( 'mkl_pc/quote_request/enabled', function() use ( &$enabled ) { return $enabled; } );
add_filter( 'mkl/pc/setting/quote_request_storage', function() { return 'email'; } );
$quotes = mkl_pc( 'quotes' );
$meta_key = MKL\PC\Quote_UI::PRODUCT_META;
$before_meta = get_post_meta( 613, $meta_key, true );

// Product mode
check( 'default mode', 'default' === MKL\PC\Quote_UI::get_product_mode( 613 ) );
update_post_meta( 613, $meta_key, 'quote_only' );
check( 'quote only read back', 'quote_only' === MKL\PC\Quote_UI::get_product_mode( 613 ) );
$data = mkl_pc( 'db' )->get_front_end_data( 613 );
check( 'product_info carries the mode', 'quote_only' === ( $data['product_info']['quote_request'] ?? '' ) );
// With a configuration, as the configurator posts it: without one, core refuses the product first.
$_POST['pc_configurator_data'] = wp_json_encode( [ [ 'is_choice' => true, 'layer_id' => 1, 'choice_id' => 2, 'angle_id' => 1 ] ] );
$passed = apply_filters( 'woocommerce_add_to_cart_validation', true, 613, 1 );
unset( $_POST['pc_configurator_data'] );
check( 'quote-only product refused in the cart', false === $passed && wc_has_notice( 'This product is available on request only. Please request a quote.', 'error' ), var_export( $passed, true ) . ' ' . wp_json_encode( wc_get_notices() ) );
wc_clear_notices();
$enabled = false;
check( 'not refused while quote requests are off', true === apply_filters( 'woocommerce_add_to_cart_validation', true, 613, 1 ) || wc_get_notices() );
wc_clear_notices();
$enabled = true;

update_post_meta( 613, $meta_key, 'off' );
do_action( 'rest_api_init' );
$r = rest_do_request( new WP_REST_Request( 'GET', '/mkl_pc/v1/quote-requests/schema' ) );
$req = new WP_REST_Request( 'GET', '/mkl_pc/v1/quote-requests/schema' ); $req->set_query_params( [ 'product_id' => 613 ] );
check( 'schema refused for a product with quotes off', 404 === rest_do_request( $req )->get_status() );
$res = mkl_pc_create_quote_request( [ 'product_id' => 613, 'configuration' => [ [ 'layer_id' => 1, 'choice_id' => 1, 'angle_id' => 1 ] ], 'fields' => [ 'name' => 'A', 'email' => 'a@example.com' ] ] );
check( 'request refused for a product with quotes off', is_wp_error( $res ) && 'mkl_pc_quote_invalid_product' === $res->get_error_code() );

// Product setting saved from the product form
$_POST = [ $meta_key => 'quote_only' ];
$quotes->ui->save_product_setting( 613 );
check( 'product setting saved', 'quote_only' === get_post_meta( 613, $meta_key, true ) );
$_POST = [ $meta_key => 'default' ];
$quotes->ui->save_product_setting( 613 );
check( 'default removes the meta', '' === get_post_meta( 613, $meta_key, true ) );
$_POST = [ $meta_key => 'bogus' ];
$quotes->ui->save_product_setting( 613 );
check( 'unknown values ignored', '' === get_post_meta( 613, $meta_key, true ) );
$_POST = [];

// Templates
ob_start(); $quotes->ui->print_templates(); $tpl = ob_get_clean();
foreach ( [ 'button', 'form', 'sending', 'sent', 'error' ] as $t ) {
	check( "template $t printed", false !== strpos( $tpl, 'id="tmpl-mkl-pc-quote-request-' . $t . '"' ) );
}
check( 'default button label', false !== strpos( $tpl, 'Request a quote' ) );
$enabled = false;
ob_start(); $quotes->ui->print_templates(); $none = ob_get_clean();
check( 'no templates while off', '' === $none );
$enabled = true;

// Placement
add_filter( 'mkl/pc/setting/quote_request_placement', $place = function() { return 'replace'; } );
check( 'placement replace', 'replace' === $quotes->get_placement() );
remove_filter( 'mkl/pc/setting/quote_request_placement', $place );
add_filter( 'mkl/pc/setting/quote_request_placement', $place = function() { return 'nonsense'; } );
check( 'unknown placement is alongside', 'alongside' === $quotes->get_placement() );
remove_filter( 'mkl/pc/setting/quote_request_placement', $place );
$quotes->enqueue_scripts();
$script = wp_scripts()->registered['mkl_pc/js/quote_request'] ?? null;
check( 'script needs backbone and wp-util', $script && in_array( 'backbone', $script->deps, true ) && in_array( 'wp-util', $script->deps, true ) );
check( 'stylesheet enqueued', wp_style_is( 'mkl_pc/css/quote_request', 'enqueued' ) );

// Field list
$raw_option = $wpdb->get_var( $wpdb->prepare( "SELECT option_value FROM {$wpdb->options} WHERE option_name = %s", 'mkl_pc_quote_request_fields' ) );
update_option( 'mkl_pc_quote_request_fields', [ 'addon_field' => [ 'type' => 'text', 'label' => 'From an add-on', 'order' => 70 ] ] );
$settings = new MKL\PC\Quote_Fields_Settings( $quotes->fields );
$saved = $settings->sanitize( [
	'name'    => [ 'label' => 'Your name', 'order' => '30', 'enabled' => '0', 'required' => '0' ],
	'email'   => [ 'label' => '', 'order' => '10' ],
	'phone'   => [ 'label' => '', 'order' => '20', 'enabled' => '0', 'required' => '0' ],
	'company' => [ 'label' => 'Organisation \\ Ltd', 'order' => '40', 'enabled' => '1', 'required' => '1' ],
] );
update_option( 'mkl_pc_quote_request_fields', $saved );
$all = $quotes->fields->get_all_fields();
check( 'order follows the list', [ 'email', 'phone', 'name', 'company' ] === array_slice( array_keys( $all ), 0, 4 ), implode( ',', array_keys( $all ) ) );
check( 'locked fields stay shown and required', $all['name']['enabled'] && $all['name']['required'] && 'Your name' === $all['name']['label'] );
check( 'empty label keeps the default', 'Email' === $all['email']['label'] && ! isset( $saved['email']['label'] ) );
check( 'optional field hidden', ! $all['phone']['enabled'] );
check( 'optional field shown and required, label kept as typed', $all['company']['enabled'] && $all['company']['required'] && 'Organisation \\ Ltd' === $all['company']['label'] );
check( 'rows not posted are kept', isset( $saved['addon_field'] ) && 'From an add-on' === $all['addon_field']['label'] );
check( 'public schema follows', [ 'email', 'name', 'company', 'message', 'addon_field' ] === wp_list_pluck( $quotes->fields->get_public_schema(), 'id' ), implode( ',', wp_list_pluck( $quotes->fields->get_public_schema(), 'id' ) ) );
ob_start(); $settings->render(); $list = ob_get_clean();
check( 'list renders every field', 7 === substr_count( $list, 'class="mkl-pc-quote-field-order"' ) );
check( 'locked rows have no enabled input', false === strpos( $list, 'mkl_pc_quote_request_fields[name][enabled]' ) && false !== strpos( $list, 'mkl_pc_quote_request_fields[phone][enabled]' ) );
check( 'null input keeps what is stored', $settings->sanitize( null ) === get_option( 'mkl_pc_quote_request_fields' ) );

// Restore
if ( null === $raw_option ) { delete_option( 'mkl_pc_quote_request_fields' ); } else { $wpdb->update( $wpdb->options, [ 'option_value' => $raw_option ], [ 'option_name' => 'mkl_pc_quote_request_fields' ] ); wp_cache_delete( 'mkl_pc_quote_request_fields', 'options' ); }
if ( $before_meta ) update_post_meta( 613, $meta_key, $before_meta ); else delete_post_meta( 613, $meta_key );
echo 'option restored: ', var_export( null === $raw_option ? false === get_option( 'mkl_pc_quote_request_fields' ) : true, true ), "\n";
mkl_pc_tests_done();