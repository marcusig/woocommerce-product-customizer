<?php
require dirname( __DIR__ ) . '/bootstrap.php';


$mails = [];
$mail_result = null;
add_filter( 'pre_wp_mail', function( $return, $atts ) use ( &$mails, &$mail_result ) {
	$mails[] = $atts;
	return null === $mail_result ? true : $mail_result;
}, 10, 2 );
add_filter( 'mkl_pc_rate_limit_rule', function( $rule, $action ) { return 'quote_request_send' === $action ? [ 'max' => 1000, 'window' => 60 ] : $rule; }, 20, 2 );

function rest( $method, $route, $params = [] ) {
	$request = new WP_REST_Request( $method, $route );
	if ( 'GET' === $method ) $request->set_query_params( $params );
	else { $request->set_header( 'content-type', 'application/json' ); $request->set_body( wp_json_encode( $params ) ); }
	$response = rest_do_request( $request );
	return [ $response->get_status(), rest_get_server()->response_to_data( $response, false ) ];
}
function token( $product_id ) {
	return mkl_pc( 'frontend_security' )->get_action_token()->issue( 'quote_request_send', [ 'product_id' => $product_id ] );
}

do_action( 'rest_api_init' );

$payload_2d = [];
foreach ( [ [1,1,68,'Cases','Stainless steel'], [2,1,61,'Bezels','Bezel'], [6,1,82,'Dial','Blue sunburst'], [3,1,69,'Band','Steel'], [4,1,63,'Hands','Hands'] ] as $c ) {
	$payload_2d[] = [ 'layer_id' => $c[0], 'choice_id' => $c[1], 'angle_id' => 1, 'image' => $c[2], 'layer_name' => $c[3], 'name' => $c[4] ];
}
$fields = [ 'name' => 'Ada <b>Love</b> & Co', 'email' => 'ada@example.com', 'phone' => '+33 6 12 34 56 78', 'message' => "Line one\nLine <script>two</script>" ];

// A. Disabled
[ $status ] = rest( 'GET', '/mkl_pc/v1/quote-requests/schema', [ 'product_id' => 613 ] );
check( 'schema refused while disabled', 403 === $status, "status $status" );

add_filter( 'mkl_pc/quote_request/enabled', '__return_true' );

// B. Schema
[ $status, $schema ] = rest( 'GET', '/mkl_pc/v1/quote-requests/schema', [ 'product_id' => 613 ] );
check( 'schema ok', 200 === $status, "status $status" );
check( 'schema lists the enabled default fields in order', [ 'name', 'email', 'phone', 'message' ] === wp_list_pluck( $schema['fields'], 'id' ), implode( ',', wp_list_pluck( $schema['fields'], 'id' ) ) );
check( '2D schema does not ask for a capture', false === $schema['capture_image'] );
[ $status ] = rest( 'GET', '/mkl_pc/v1/quote-requests/schema', [ 'product_id' => 1 ] );
check( 'schema refuses a non configurable product', 404 === $status, "status $status" );

// Locked fields survive a filter that removes them
add_filter( 'mkl_pc/quote_request/fields', $remove = function( $f ) { unset( $f['email'] ); $f['name']['required'] = false; $f['name']['enabled'] = false; return $f; } );
$all = mkl_pc( 'quotes' )->fields->get_fields();
check( 'name and email cannot be removed or made optional', isset( $all['email'], $all['name'] ) && $all['name']['required'] && $all['email']['required'] );
remove_filter( 'mkl_pc/quote_request/fields', $remove );

// C. Invalid fields
[ $status, $body ] = rest( 'POST', '/mkl_pc/v1/quote-requests', [ 'product_id' => 613, 'configuration' => wp_json_encode( $payload_2d ), 'fields' => [ 'email' => 'nope' ], 'token' => 'x' ] );
check( 'invalid fields are refused with field_errors', 400 === $status && isset( $body['data']['field_errors']['name'], $body['data']['field_errors']['email'] ), "status $status " . wp_json_encode( $body['data'] ?? null ) );

// D. Missing token
[ $status, $body ] = rest( 'POST', '/mkl_pc/v1/quote-requests', [ 'product_id' => 613, 'configuration' => wp_json_encode( $payload_2d ), 'fields' => $fields ] );
check( 'a request without a token is refused', 403 === $status, "status $status {$body['code']}" );
check( 'and sends nothing', 0 === count( $mails ) );

// E. Honeypot
[ $status ] = rest( 'POST', '/mkl_pc/v1/quote-requests', [ 'product_id' => 613, 'configuration' => wp_json_encode( $payload_2d ), 'fields' => $fields, 'token' => token( 613 ), 'honeypot' => 'http://spam' ] );
check( 'honeypot looks like success', 201 === $status );
check( 'honeypot sends nothing', 0 === count( $mails ) );

// F. Valid 2D request
$token = token( 613 );
[ $status, $body ] = rest( 'POST', '/mkl_pc/v1/quote-requests', [ 'product_id' => 613, 'quantity' => 3, 'configuration' => wp_json_encode( $payload_2d ), 'fields' => $fields, 'token' => $token ] );
check( 'valid request is created', 201 === $status, "status $status " . wp_json_encode( $body ) );
check( 'response has a reference', ! empty( $body['reference'] ) && 'email' === $body['store'], $body['reference'] ?? '' );
check( 'two emails sent', 2 === count( $mails ), count( $mails ) . ' mails' );
$admin = $mails[0] ?? []; $customer = $mails[1] ?? [];
$admin_headers = is_array( $admin['headers'] ?? '' ) ? implode( "\n", $admin['headers'] ) : ( $admin['headers'] ?? '' );
check( 'admin email goes to the shop', get_option( 'admin_email' ) === ( $admin['to'] ?? '' ), $admin['to'] ?? '' );
check( 'admin email replies to the customer', false !== strpos( $admin_headers, 'Reply-to: "Ada Love & Co" <ada@example.com>' ), $admin_headers );
check( 'admin subject has the reference and name', false !== strpos( $admin['subject'] ?? '', $body['reference'] ) && false !== strpos( $admin['subject'] ?? '', 'Ada Love & Co' ), $admin['subject'] ?? '' );
check( 'customer email goes to the customer', 'ada@example.com' === ( $customer['to'] ?? '' ) );
$html = $admin['message'] ?? '';
check( 'email lists the configuration', false !== strpos( $html, 'Stainless steel' ) && false !== strpos( $html, 'Blue sunburst' ) );
// "&times;", or "×" once the email's inliner decoded it.
check( 'email shows the quantity', (bool) preg_match( '/(&times;|×)\s*3/u', $html ) );
check( 'email lists the contact details', false !== strpos( $html, '+33 6 12 34 56 78' ) );
check( 'customer input is not markup', false === strpos( $html, '<script>' ) && false === strpos( $html, '<b>Love' ) );
check( 'name is escaped in the main content', false !== strpos( $html, 'Ada Love &amp; Co requested a quote' ), '' );
$attachments = $admin['attachments'] ?? [];
check( '2D merged image attached', 1 === count( $attachments ) && is_file( $attachments[0] ), wp_json_encode( $attachments ) );
check( '2D image shown in the email', (bool) preg_match( '#<img src="[^"]*mkl-pc-config-images/[^"]+\.png"#', $html ) );

// G. Token reuse
[ $status ] = rest( 'POST', '/mkl_pc/v1/quote-requests', [ 'product_id' => 613, 'configuration' => wp_json_encode( $payload_2d ), 'fields' => $fields, 'token' => $token ] );
check( 'a token works once', 403 === $status, "status $status" );

// H. 3D request with a capture
$im = imagecreatetruecolor( 20, 20 ); ob_start(); imagepng( $im ); $png = ob_get_clean();
$payload_3d = [ [ 'layer_id' => 1, 'choice_id' => 1, 'angle_id' => 1, 'layer_name' => 'Chair color2', 'name' => 'Mango' ] ];
$mails = [];
[ $status, $schema3d ] = rest( 'GET', '/mkl_pc/v1/quote-requests/schema', [ 'product_id' => 500 ] );
check( '3D schema asks for a capture', true === $schema3d['capture_image'] );
[ $status, $body ] = rest( 'POST', '/mkl_pc/v1/quote-requests', [ 'product_id' => 500, 'configuration' => $payload_3d, 'fields' => $fields, 'image' => 'data:image/png;base64,' . base64_encode( $png ), 'token' => token( 500 ) ] );
check( '3D request created (configuration posted as an array)', 201 === $status, "status $status " . wp_json_encode( $body ) );
$file = $mails[0]['attachments'][0] ?? '';
check( '3D capture kept in quotes/ and attached', $file && is_file( $file ) && false !== strpos( $file, '/mkl-pc-config-images/quotes/quote-q-' ), $file );
if ( $file ) wp_delete_file( $file );

// I. Mail failure in email-only mode
$mails = []; $mail_result = false;
$before = glob( wp_upload_dir()['basedir'] . '/mkl-pc-config-images/quotes/*.png' );
[ $status, $body ] = rest( 'POST', '/mkl_pc/v1/quote-requests', [ 'product_id' => 500, 'configuration' => $payload_3d, 'fields' => $fields, 'image' => 'data:image/png;base64,' . base64_encode( $png ), 'token' => token( 500 ) ] );
$after = glob( wp_upload_dir()['basedir'] . '/mkl-pc-config-images/quotes/*.png' );
check( 'unsent request is reported to the customer', 500 === $status && 'mkl_pc_quote_not_sent' === ( $body['code'] ?? '' ), "status $status" );
check( 'and its capture removed', count( $before ) === count( $after ) );
$mail_result = null;

// J. PHP entry point
$mails = [];
$result = mkl_pc_create_quote_request( [ 'product_id' => 613, 'configuration' => $payload_2d, 'fields' => [ 'name' => 'Bob', 'email' => 'bob@example.com' ] ] );
check( 'mkl_pc_create_quote_request sends a request', $result instanceof MKL\PC\Quote_Request && 2 === count( $mails ) );

mkl_pc_tests_done();