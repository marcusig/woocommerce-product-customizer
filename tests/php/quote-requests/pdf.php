<?php
require dirname( __DIR__ ) . '/bootstrap.php';
add_filter( 'mkl_pc/quote_request/enabled', '__return_true' );
require_once ABSPATH . 'wp-admin/includes/post.php';
require_once ABSPATH . 'wp-admin/includes/user.php';
require_once MKL_PC_INCLUDE_PATH . 'quote-requests/admin/class-quote-requests-admin.php';
$mails = [];
$attached = []; // What each attachment held while the mail was "sent".
add_filter( 'pre_wp_mail', function( $null, $atts ) use ( &$mails, &$attached ) {
	$files = [];
	foreach ( (array) $atts['attachments'] as $path ) $files[ $path ] = is_file( $path ) ? file_get_contents( $path ) : null;
	$atts['files'] = $files;
	$mails[] = $atts;
	return true;
}, 10, 2 );
$html = [];
add_filter( 'PC.syd.pdf_download.pdf_content', function( $content, $template = '' ) use ( &$html ) { $html[] = [ $template, $content ]; return $content; }, 10, 2 );
$mode = 'none';
$hide_totals = false;
add_filter( 'mkl/pc/setting/syd_disable_totals_in_pdf', function() use ( &$hide_totals ) { return $hide_totals; } );
add_filter( 'mkl/pc/setting/syd_quote_pdf', function() use ( &$mode ) { return $mode; } );
add_filter( 'mkl/pc/setting/quote_request_storage', function() { return 'cpt'; } );
add_filter( 'mkl_pc_rate_limit_rule', function( $rule, $action ) { return MKL\PC\Quote_PDF::ACTION === $action ? [ 'max' => 1000, 'window' => HOUR_IN_SECONDS ] : $rule; }, 20, 2 );

$q = mkl_pc( 'quotes' );
$pdf = $q->pdf;
$store = $q->cpt_store;
$page_before = mkl_pc( 'settings' )->get( 'quote_request_page' );
$admins = get_users( [ 'role' => 'administrator', 'number' => 1, 'fields' => 'ID' ] );
$admin_id = (int) $admins[0];
$admin = new MKL\PC\Quote_Requests_Admin( $store );
$tag = wp_rand();
$email = "pdf-$tag@example.com";
$posts = [];

function submit_request( $email ) {
	global $posts;
	wp_set_current_user( 0 );
	$q = mkl_pc( 'quotes' );
	$r = $q->service->submit( $q->service->prepare( [
		'product_id'    => 613,
		'configuration' => [ [ 'is_choice' => true, 'layer_id' => 1, 'choice_id' => 2, 'angle_id' => 1, 'image' => 0 ] ],
		'fields'        => [ 'name' => 'Paula PDF', 'email' => $email ],
	] ) );
	$posts[] = $r->id;
	return $q->cpt_store->load( $r->id );
}
function pdf_mail( $needle ) { global $mails; foreach ( $mails as $m ) { if ( false !== strpos( implode( ',', (array) $m['to'] ), $needle ) ) { foreach ( $m['files'] as $path => $content ) { if ( '.pdf' === substr( $path, -4 ) ) return [ $path, $content, $m ]; } return [ null, null, $m ]; } } return [ null, null, null ]; }
function last_html() { global $html; $last = end( $html ); return $last ? $last[1] : ''; }

if ( ! $pdf->get_provider() ) mkl_pc_tests_skip( 'No PDF provider: Save your design with quote PDFs is not active.' );

// None: nothing attached, no links
$r = submit_request( $email );
$admin_mail = pdf_mail( get_option( 'admin_email' ) );
$customer_mail = pdf_mail( $email );
check( 'none: request emails without PDF', $admin_mail[2] && null === $admin_mail[0] && $customer_mail[2] && null === $customer_mail[0] );
check( 'none: no download', ! $pdf->customer_can_download( $r ) && ! $pdf->merchant_can_download( $r ) && is_wp_error( $pdf->get_download( $r->reference, $r->access_key ) ) );

// Quote mode
$mode = 'quote';
$mails = [];
$r = submit_request( $email );
check( 'quote: request emails without PDF', null === pdf_mail( $email )[0] && null === pdf_mail( get_option( 'admin_email' ) )[0] );
check( 'quote: customer cannot download before it is sent', ! $pdf->customer_can_download( $r ) && is_wp_error( $pdf->get_download( $r->reference, $r->access_key ) ) );
wp_set_current_user( $admin_id );
check( 'merchant can', $pdf->merchant_can_download( $r ) );
update_post_meta( $r->id, '_mkl_pc_quote_message', 'Draft words' );
$d = $pdf->get_download( $r->reference );
check( 'merchant downloads a PDF', is_array( $d ) && 0 === strpos( $d['content'], '%PDF' ) && $r->reference . '.pdf' === $d['filename'], is_wp_error( $d ) ? $d->get_error_message() : '' );
check( 'merchant sees the draft message', false !== strpos( last_html(), 'Draft words' ) );
ob_start(); $admin->render_status( get_post( $r->id ) ); $box = ob_get_clean();
check( 'status box has the download link', false !== strpos( $box, 'Download the quote (PDF)' ) && false !== strpos( html_entity_decode( $box ), 'action=mkl_pc_quote_pdf' ) );

// Send it: the quote email carries the PDF with the message being sent
$loaded = $store->load( $r->id );
$loaded->quoted_price = 1500;
$store->save( $loaded );
$mails = []; $html = [];
check( 'quote sent', true === $admin->send( $store->load( $r->id ), "Sent words\nsecond line" ) );
list( $path, $content, $m ) = pdf_mail( $email );
check( 'quote email carries the PDF', $path && 0 === strpos( (string) $content, '%PDF' ) && $r->reference . '.pdf' === basename( $path ) );
check( 'temporary file deleted after sending', $path && ! file_exists( $path ) && ! file_exists( dirname( $path ) ) );
$doc = last_html();
check( 'PDF shows the message being sent, not the draft', false !== strpos( $doc, 'Sent words' ) && false === strpos( $doc, 'Draft words' ) );
check( 'PDF shows reference, customer, product, quoted price', false !== strpos( $doc, 'Quote ' . $r->reference ) && false !== strpos( $doc, 'Paula PDF' ) && false !== strpos( $doc, $r->get_product_name() ) && false !== strpos( $doc, '500,00' ), wp_strip_all_tags( substr( $doc, strpos( $doc, '<body' ) ) ) );
check( 'no consent row', false === strpos( $doc, 'I agree' ) );
check( 'shop details', false !== strpos( $doc, esc_html( get_bloginfo( 'name' ) ) ) );
wp_update_post( [ 'ID' => $r->id, 'post_status' => 'mkl_quote_answered' ] );
delete_post_meta( $r->id, '_mkl_pc_quote_message' ); // As save() does once sent.

// The customer, once sent
wp_set_current_user( 0 );
$r = $store->load( $r->id );
check( 'quote: customer can download once sent', $pdf->customer_can_download( $r ) );
$html = [];
$d = $pdf->get_download( $r->reference, $r->access_key );
check( 'customer downloads with the key', is_array( $d ) && 0 === strpos( $d['content'], '%PDF' ) );
check( 'customer sees the sent message', false !== strpos( last_html(), 'Sent words' ) );
check( 'wrong key refused', is_wp_error( $pdf->get_download( $r->reference, 'nope' ) ) && is_wp_error( $pdf->get_download( $r->reference ) ) );
$page = $q->customer_view->render_request( $r, '', $r->access_key );
check( 'customer page links the PDF with the key', false !== strpos( $page, 'Download the quote (PDF)' ) && false !== strpos( html_entity_decode( $page ), 'key=' . $r->access_key ) );
check( 'no link without access', false === strpos( $q->customer_view->render_request( $r, '', '' ), 'Download the quote (PDF)' ) );
wp_set_current_user( $admin_id );
$page = $q->customer_view->render_request( $r, '', '' );
check( 'merchant on the page gets the link without a key', false !== strpos( $page, 'Download the quote (PDF)' ) && false === strpos( html_entity_decode( $page ), 'key=' ) );
wp_set_current_user( 0 );

// Answer emails never carry it
$mails = [];
$_POST = [ '_wpnonce' => wp_create_nonce( MKL\PC\Quote_Customer_Actions::ACTION . '_' . $r->id ) ];
$q->customer_actions->handle_answer( $r->reference, $r->access_key, 'change', 'Smaller please' );
$_POST = [];
check( 'answer emails without PDF', null === pdf_mail( $email )[0] && pdf_mail( $email )[2] );

// All mode: request emails too, download from the start
$mode = 'all';
$mails = [];
$r2 = submit_request( $email );
check( 'all: customer confirmation carries the PDF', 0 === strpos( (string) pdf_mail( $email )[1], '%PDF' ) );
check( 'all: shop notification carries the PDF', 0 === strpos( (string) pdf_mail( get_option( 'admin_email' ) )[1], '%PDF' ) );
check( 'all: customer downloads before any quote', $pdf->customer_can_download( $r2 ) && is_array( $pdf->get_download( $r2->reference, $r2->access_key ) ) );
check( 'all: configured price, no message yet', false !== strpos( last_html(), 'Total' ) && false === strpos( last_html(), 'class="message"' ), preg_replace( '/\s+/', ' ', wp_strip_all_tags( substr( last_html(), strpos( last_html(), '<body' ) ) ) ) );

// Totals hidden by SYD's setting: the estimate, never the quote
$hide_totals = true;
$pdf->get_download( $r2->reference, $r2->access_key );
check( 'estimate hidden', false === strpos( last_html(), 'class="total"' ) );
$pdf->get_download( $r->reference, $r->access_key );
check( 'sent quote keeps its price', false !== strpos( last_html(), 'class="total"' ) );
wp_set_current_user( $admin_id );
$pdf->get_download( $r2->reference );
check( 'merchant preview shows the price', false !== strpos( last_html(), 'class="total"' ) );
wp_set_current_user( 0 );
$hide_totals = false;

// Configurator PDF: the price comes from the server, not the request
$syd = $GLOBALS['mkl_pc_syd'] ?? null;
$pdf_class = null;
foreach ( $GLOBALS['wp_filter']['mkl_pc/quote_request/pdf_provider']->callbacks as $cbs ) foreach ( $cbs as $cb ) if ( is_array( $cb['function'] ) ) $pdf_class = $cb['function'][0];
$_REQUEST = [ 'base_price' => '1', 'extra_price' => '1' ];
$m = new ReflectionMethod( $pdf_class, 'get_prices' );
$m->setAccessible( true );
$content = json_decode( json_encode( [ [ 'is_choice' => true, 'layer_id' => 1, 'choice_id' => 2, 'angle_id' => 1 ] ] ) );
$prices = $m->invoke( $pdf_class, 613, 613, $content );
$expected = ( new MKL\PC\Configuration( null, [ 'product_id' => 613, 'variation_id' => 0, 'content' => $content ] ) )->get_configured_price();
$_REQUEST = [];
check( 'configurator PDF ignores the posted price', abs( $prices['base'] - $expected['base'] ) < 0.001 && $prices['base'] != 1.0, json_encode( $prices ) . ' vs ' . json_encode( $expected ) );
check( 'configurator PDF extra from the server', ( $expected['extra'] ? abs( $prices['extra'] - $expected['extra'] ) < 0.001 : false === $prices['extra'] ) );
$out = $pdf_class->render( 'pc-pdf-export/pdf.php', [ '_product' => wc_get_product( 613 ), 'product_id' => 613, 'variation_id' => 613, 'image' => '', 'layers' => [], 'item_data' => [ 'data' => wc_get_product( 613 ), 'product_id' => 613 ], 'display_price' => true, 'base_price' => $prices['base'], 'extra_price' => $prices['extra'] ] );
check( 'configurator template still renders through render()', 0 === strpos( $out, '%PDF' ) );

foreach ( array_unique( $posts ) as $p ) wp_delete_post( $p, true );
if ( ! $page_before && ( $pid = (int) mkl_pc( 'settings' )->get( 'quote_request_page' ) ) ) { wp_delete_post( $pid, true ); mkl_pc( 'settings' )->set( 'quote_request_page', '' ); }
mkl_pc_tests_done();
