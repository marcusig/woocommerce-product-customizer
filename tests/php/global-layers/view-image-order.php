<?php
/**
 * A view's own image order (`image_order_by_angle`, docs/canvas-viewer-spec.md, Order): kept
 * by the product, never shared through a global layer, and read by the server for the view it
 * composes, with the canvas viewer only.
 */
require dirname( __DIR__ ) . '/bootstrap.php';

$db  = mkl_pc( 'db' );
$tag = wp_generate_password( 6, false );

$raw_chunk = function( $product_id, $layer_id ) use ( $db ) {
	$value = get_post_meta( $product_id, '_mkl_product_configurator_layer_' . $layer_id, true );
	$value = \MKL\PC\Utils::safe_unserialize( $value );
	return is_string( $value ) ? $db->decode_stored_json( $value ) : $value;
};
$layers_by_id = function( $layers ) {
	$out = array();
	foreach ( (array) $layers as $layer ) $out[ (int) $layer['_id'] ] = $layer;
	return $out;
};

// A definition that carries a map (it should not): no product's views are its views.
$global_id = MKL\PC\Global_Layers::save(
	array( '_id' => 1, 'id' => 1, 'name' => 'Straps ' . $tag, 'type' => 'simple', 'image_order_by_angle' => array( 2 => 9 ) ),
	array( array( '_id' => 1, 'layerId' => 1, 'name' => 'Black' ) )
);
check( 'global layer created', is_int( $global_id ) && $global_id > 0, is_wp_error( $global_id ) ? $global_id->get_error_message() : '' );

$product = new WC_Product_Simple();
$product->set_name( 'View image order test ' . $tag );
$product->set_status( 'private' );
$product_id = $product->save();

$db->set( $product_id, $product_id, 'angles', array(
	array( '_id' => 1, 'id' => 1, 'name' => 'Front', 'order' => 1 ),
	array( '_id' => 2, 'id' => 2, 'name' => 'Back', 'order' => 2 ),
) );
$db->set( $product_id, $product_id, 'layers', array(
	array( '_id' => 10, 'id' => 10, 'order' => 1, 'image_order' => 1, 'is_global' => true, 'global_id' => $global_id, 'name' => 'Straps ' . $tag, 'type' => 'simple', 'image_order_by_angle' => array( 2 => 3 ) ),
	array( '_id' => 11, 'id' => 11, 'order' => 2, 'image_order' => 2, 'is_global' => true, 'global_id' => $global_id, 'name' => 'Straps ' . $tag, 'type' => 'simple' ),
	array( '_id' => 12, 'id' => 12, 'order' => 3, 'image_order' => 0, 'name' => 'Case', 'type' => 'simple', 'image_order_by_angle' => array( 2 => 0, 1 => 4 ) ),
) );
$db->set( $product_id, $product_id, 'content', array(
	array( 'layerId' => 12, 'choices' => array( array( '_id' => 1, 'layerId' => 12, 'name' => 'Steel', 'images' => array() ) ) ),
) );

$chunk = $raw_chunk( $product_id, 10 );
check( 'link: the map is stored on the reference', 3 === (int) ( $chunk['image_order_by_angle'][2] ?? -1 ) && ! isset( $chunk['name'] ), wp_json_encode( $chunk ) );

wp_cache_flush();
$layers = $layers_by_id( $db->get( 'layers', $product_id ) );
check( 'resolved: the link keeps its own map', 3 === (int) ( $layers[10]['image_order_by_angle'][2] ?? -1 ), wp_json_encode( $layers[10] ?? null ) );
check( 'resolved: the definition\'s map never reaches a link', ! isset( $layers[11]['image_order_by_angle'] ), wp_json_encode( $layers[11] ?? null ) );
check( 'plain layer: the map round-trips', 0 === (int) ( $layers[12]['image_order_by_angle'][2] ?? -1 ) && 4 === (int) ( $layers[12]['image_order_by_angle'][1] ?? -1 ), wp_json_encode( $layers[12] ?? null ) );

// The server reads the view's order for the view it composes, with the canvas viewer only.
$renderer = 'canvas';
$filter = function() use ( &$renderer ) {
	return $renderer;
};
add_filter( 'mkl_pc_viewer_2d_renderer', $filter );
$back  = new MKL\PC\Choice( $product_id, 0, 12, 1, 2 );
$front = new MKL\PC\Choice( $product_id, 0, 12, 1, 1 );
check( 'canvas: the back view\'s own order', 0 === $back->get_image_order(), var_export( $back->get_image_order(), true ) );
check( 'canvas: the front view\'s own order', 4 === $front->get_image_order(), var_export( $front->get_image_order(), true ) );
$renderer = 'dom';
check( 'image stack: the configurator\'s order', 0 === $front->get_image_order(), var_export( $front->get_image_order(), true ) );
check( 'image stack: no view order', null === $front->get_view_image_order() );
$renderer = 'canvas';

// A stored configuration saved its view's order already: that wins.
$stored = new MKL\PC\Choice( $product_id, 0, 12, 1, 1, (object) array( 'image_order' => 7, 'is_choice' => true, 'layer_id' => 12, 'choice_id' => 1, 'angle_id' => 1 ) );
$stored->set_source( MKL\PC\Choice::SOURCE_STORED );
check( 'stored: the saved order wins', 7 === $stored->get_image_order(), var_export( $stored->get_image_order(), true ) );
$stored_without = new MKL\PC\Choice( $product_id, 0, 12, 1, 1, (object) array( 'is_choice' => true, 'layer_id' => 12, 'choice_id' => 1, 'angle_id' => 1 ) );
$stored_without->set_source( MKL\PC\Choice::SOURCE_STORED );
check( 'stored without a saved order: the view\'s own order', 4 === $stored_without->get_image_order(), var_export( $stored_without->get_image_order(), true ) );
remove_filter( 'mkl_pc_viewer_2d_renderer', $filter );

// The global layer goes: each link becomes a plain layer and keeps its own map.
wp_delete_post( $global_id, true );
$chunk = $raw_chunk( $product_id, 10 );
check( 'localized link keeps its map', empty( $chunk['is_global'] ) && 3 === (int) ( $chunk['image_order_by_angle'][2] ?? -1 ), wp_json_encode( $chunk ) );
$chunk11 = $raw_chunk( $product_id, 11 );
check( 'localized inheriting link gets no map from the definition', empty( $chunk11['is_global'] ) && ! isset( $chunk11['image_order_by_angle'] ), wp_json_encode( $chunk11 ) );

wp_delete_post( $product_id, true );
mkl_pc_tests_done();
