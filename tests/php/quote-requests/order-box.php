<?php
require dirname( __DIR__ ) . '/bootstrap.php';
require_once ABSPATH . 'wp-admin/includes/post.php';
require_once ABSPATH . 'wp-admin/includes/template.php';
require_once MKL_PC_INCLUDE_PATH . 'quote-requests/admin/class-quote-requests-admin.php';
$admins = get_users( [ 'role' => 'administrator', 'number' => 1, 'fields' => 'ID' ] );
wp_set_current_user( (int) $admins[0] );
$store = mkl_pc( 'quotes' )->cpt_store;
new MKL\PC\Quote_Requests_Admin( $store );
require_once ABSPATH . 'wp-admin/includes/class-wp-screen.php'; require_once ABSPATH . 'wp-admin/includes/screen.php'; set_current_screen( 'mkl_pc_quote' );
function side_boxes( $post ) {
	global $wp_meta_boxes; $wp_meta_boxes = [];
	do_action( 'add_meta_boxes_mkl_pc_quote', $post );
	$ids = [];
	foreach ( [ 'high', 'core', 'default', 'low' ] as $p ) foreach ( (array) ( $wp_meta_boxes['mkl_pc_quote']['side'][ $p ] ?? [] ) as $id => $box ) if ( $box ) $ids[] = $id;
	return $ids;
}
$draft = get_default_post_to_edit( 'mkl_pc_quote', true );
check( 'no order box without a configuration', ! in_array( 'mkl_pc_quote_order', side_boxes( $draft ), true ), implode( ',', side_boxes( $draft ) ) );
$r = new MKL\PC\Quote_Request();
$r->store = 'cpt'; $r->reference = 'Q-TEST-BOX'; $r->created = time(); $r->product_id = $r->configurator_id = 613;
$r->configuration_raw = '[{"is_choice":true,"layer_id":1,"choice_id":1,"angle_id":1,"image":0}]';
$store->save( $r ); $store->log( $r->id, 'x' );
$boxes = side_boxes( get_post( $r->id ) );
check( 'status, order, history', [ 'mkl_pc_quote_status', 'mkl_pc_quote_order', 'mkl_pc_quote_log' ] === $boxes, implode( ',', $boxes ) );
ob_start(); do_action( 'mkl_pc/admin/quote_request/status_box', get_post( $r->id ) ); $status = ob_get_clean();
check( 'button gone from the status box', false === strpos( $status, 'mkl_pc_quote_create_order' ) );
ob_start(); mkl_pc( 'quotes' )->woo_order_store->render_order_box( get_post( $r->id ) ); $html = ob_get_clean();
check( 'box offers to create the order', false !== strpos( $html, 'action=mkl_pc_quote_create_order' ) );
$order = mkl_pc( 'quotes' )->woo_order_store->create_order_from_request_post( $r->id );
ob_start(); mkl_pc( 'quotes' )->woo_order_store->render_order_box( get_post( $r->id ) ); $html = ob_get_clean();
check( 'box links the order once made', false !== strpos( $html, '#' . $order->get_order_number() ) && false === strpos( $html, 'mkl_pc_quote_create_order' ), strip_tags( $html ) );
$order->delete( true ); wp_delete_post( $r->id, true ); wp_delete_post( $draft->ID, true );
mkl_pc_tests_done();
