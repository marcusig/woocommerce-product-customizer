<?php
/**
 * Links to a global layer with their own settings (docs/global-layer-overrides-spec.md):
 * stored, resolved, localized.
 */
require dirname( __DIR__ ) . '/bootstrap.php';

use MKL\PC\Global_Layer\Linker;

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

$global_masks = array( array( 'angleId' => 1, 'image' => array( 'id' => 0, 'url' => 'https://example.com/global-mask.png' ) ) );
$collar_masks = array( array( 'angleId' => 1, 'image' => array( 'id' => 0, 'url' => 'https://example.com/collar-mask.png' ) ) );

$global_id = MKL\PC\Global_Layers::save(
	array( '_id' => 1, 'id' => 1, 'name' => 'Fabrics ' . $tag, 'type' => 'simple', 'admin_label' => 'Fabric', 'html_id' => 'fabric', 'masks' => $global_masks ),
	array( array( '_id' => 1, 'layerId' => 1, 'name' => 'Blue' ) )
);
check( 'global layer created', is_int( $global_id ) && $global_id > 0, is_wp_error( $global_id ) ? $global_id->get_error_message() : '' );

$product = new WC_Product_Simple();
$product->set_name( 'Overrides test ' . $tag );
$product->set_status( 'private' );
$product_id = $product->save();

$link = function( $id, $extra ) use ( $global_id, $tag, $global_masks ) {
	return array_merge( array(
		'_id' => $id, 'id' => $id, 'order' => $id, 'is_global' => true, 'global_id' => $global_id,
		'name' => 'Fabrics ' . $tag, 'type' => 'simple', 'admin_label' => 'Fabric', 'html_id' => 'fabric', 'masks' => $global_masks,
	), $extra );
};

$db->set( $product_id, $product_id, 'layers', array(
	// Name and masks are the link's; the admin label was overridden once and switched off;
	// `type` cannot be overridden; `html_id` is listed with no value anywhere.
	$link( 10, array(
		'name'      => 'Collar',
		'masks'     => $collar_masks,
		'overrides' => array(
			'fields' => array( 'name', 'masks', 'type', 'html_id_missing' ),
			'values' => array( 'admin_label' => 'Collar fabric', 'type' => 'multiple', 'name' => 'stale' ),
		),
	) ),
	// Inherits everything.
	$link( 11, array() ),
	// Not a link: overrides mean nothing.
	array( '_id' => 12, 'id' => 12, 'order' => 12, 'name' => 'Local', 'type' => 'simple', 'overrides' => array( 'fields' => array( 'name' ), 'values' => array( 'name' => 'X' ) ) ),
) );

$chunk = $raw_chunk( $product_id, 10 );
check( 'link stored as a reference', is_array( $chunk ) && ! isset( $chunk['name'] ) && ! isset( $chunk['masks'] ) && $global_id === (int) $chunk['global_id'], wp_json_encode( $chunk ) );
check( 'overridden fields stored, excluded and valueless ones dropped', isset( $chunk['overrides']['fields'] ) && array( 'name', 'masks' ) === $chunk['overrides']['fields'], wp_json_encode( $chunk['overrides'] ?? null ) );
check( 'a listed field takes the value the form edited', 'Collar' === ( $chunk['overrides']['values']['name'] ?? null ), wp_json_encode( $chunk['overrides']['values'] ?? null ) );
check( 'masks stored whole', $collar_masks[0]['image']['url'] === ( $chunk['overrides']['values']['masks'][0]['image']['url'] ?? null ) );
check( 'a switched-off value is kept', 'Collar fabric' === ( $chunk['overrides']['values']['admin_label'] ?? null ) );
check( 'an excluded value is not kept', ! isset( $chunk['overrides']['values']['type'] ) );
$chunk11 = $raw_chunk( $product_id, 11 );
check( 'an inheriting link has no overrides', is_array( $chunk11 ) && ! isset( $chunk11['overrides'] ), wp_json_encode( $chunk11 ) );
$chunk12 = $raw_chunk( $product_id, 12 );
check( 'a plain layer drops overrides', is_array( $chunk12 ) && ! isset( $chunk12['overrides'] ) && 'Local' === $chunk12['name'], wp_json_encode( $chunk12 ) );

wp_cache_flush();
$layers = $layers_by_id( $db->get( 'layers', $product_id ) );
check( 'resolved: overridden name', 'Collar' === ( $layers[10]['name'] ?? null ), wp_json_encode( $layers[10] ?? null ) );
check( 'resolved: overridden masks', $collar_masks[0]['image']['url'] === ( $layers[10]['masks'][0]['image']['url'] ?? null ) );
check( 'resolved: switched-off field shows the global value', 'Fabric' === ( $layers[10]['admin_label'] ?? null ) );
check( 'resolved: excluded field stays the global one', 'simple' === ( $layers[10]['type'] ?? null ) );
check( 'resolved: overrides handed to the editor', array( 'name', 'masks' ) === ( $layers[10]['overrides']['fields'] ?? null ) && 'Collar fabric' === ( $layers[10]['overrides']['values']['admin_label'] ?? null ) );
check( 'resolved: the other link inherits', 'Fabrics ' . $tag === ( $layers[11]['name'] ?? null ) && $global_masks[0]['image']['url'] === ( $layers[11]['masks'][0]['image']['url'] ?? null ) && ! isset( $layers[11]['overrides'] ) );

// Saving what the editor got back keeps everything as it was (strip ∘ resolve).
$db->set( $product_id, $product_id, 'layers', array_values( $layers ) );
check( 'round trip keeps the overrides', $chunk['overrides'] == ( $raw_chunk( $product_id, 10 )['overrides'] ?? null ), wp_json_encode( $raw_chunk( $product_id, 10 ) ) );

// Switching the name off in the editor: the effective value goes back to the global one.
$off = $layers[10];
$off['name'] = 'Fabrics ' . $tag;
$off['overrides']['fields'] = array( 'masks' );
$db->set( $product_id, $product_id, 'layers', array( $off, $layers[11] ) );
$chunk = $raw_chunk( $product_id, 10 );
check( 'switched off: the value is kept for later', array( 'masks' ) === ( $chunk['overrides']['fields'] ?? null ) && 'Collar' === ( $chunk['overrides']['values']['name'] ?? null ), wp_json_encode( $chunk['overrides'] ?? null ) );
wp_cache_flush();
$layers = $layers_by_id( $db->get( 'layers', $product_id ) );
check( 'switched off: the global name shows', 'Fabrics ' . $tag === ( $layers[10]['name'] ?? null ) );

// Switched back on: the kept value is back.
$on = $layers[10];
$on['overrides']['fields'] = array( 'masks', 'name' );
$on['name'] = $on['overrides']['values']['name'];
$db->set( $product_id, $product_id, 'layers', array( $on, $layers[11] ) );
wp_cache_flush();
$layers = $layers_by_id( $db->get( 'layers', $product_id ) );
check( 'switched on again: the kept name is back', 'Collar' === ( $layers[10]['name'] ?? null ) );

// An import onto a site where the global id means nothing keeps the effective values, as its own.
$foreign = $layers[10];
$foreign['global_id'] = 999999999;
$stripped = Linker::strip_layers_to_references( array( $foreign ) );
check( 'unknown global id: effective values kept, no overrides', 'Collar' === $stripped[0]['name'] && empty( $stripped[0]['is_global'] ) && ! isset( $stripped[0]['overrides'] ), wp_json_encode( $stripped[0] ) );

check( 'normalize: nothing is null', null === Linker::normalize_overrides( array( 'fields' => array(), 'values' => array() ) ) && null === Linker::normalize_overrides( 'x' ) );
check( 'excluded fields filterable', in_array( 'html_id', ( function() {
	add_filter( 'mkl_pc_global_layer_override_excluded_fields', $f = function( $l ) { $l[] = 'html_id'; return $l; } );
	$out = Linker::override_excluded_fields();
	remove_filter( 'mkl_pc_global_layer_override_excluded_fields', $f );
	return $out;
} )(), true ) );

// The global layer goes: each link becomes a plain layer with its own values.
wp_delete_post( $global_id, true );
$chunk = $raw_chunk( $product_id, 10 );
check( 'localized link keeps its overridden values', is_array( $chunk ) && empty( $chunk['is_global'] ) && 'Collar' === ( $chunk['name'] ?? null ) && $collar_masks[0]['image']['url'] === ( $chunk['masks'][0]['image']['url'] ?? null ), wp_json_encode( $chunk ) );
check( 'localized link: switched-off values dropped, global ones kept', 'Fabric' === ( $chunk['admin_label'] ?? null ) && ! isset( $chunk['overrides'] ) );
$chunk11 = $raw_chunk( $product_id, 11 );
check( 'localized inheriting link has the global values', 'Fabrics ' . $tag === ( $chunk11['name'] ?? null ) && empty( $chunk11['is_global'] ) );

wp_delete_post( $product_id, true );
mkl_pc_tests_done();
