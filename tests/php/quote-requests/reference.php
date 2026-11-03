<?php
require dirname( __DIR__ ) . '/bootstrap.php';
$q = mkl_pc( 'quotes' );
$store = $q->cpt_store;
$ref = $q->service->generate_reference();
check( 'format', (bool) preg_match( '/^Q-' . wp_date( 'Ymd' ) . '-[A-HJ-NP-Z2-9]{4}$/', $ref ), $ref );
check( 'unknown reference is free', ! $store->reference_exists( $ref ) && ! $store->reference_exists( '' ) );

$dup = 'Q-TEST-' . wp_rand();
$post = wp_insert_post( [ 'post_type' => 'mkl_pc_quote', 'post_status' => 'mkl_quote_new', 'post_title' => $dup ] );
update_post_meta( $post, '_mkl_pc_quote_reference', $dup );
check( 'stored reference found', $store->reference_exists( $dup ) );

// The first two draws are taken: the third is used
$calls = 0;
$f = function( $r ) use ( &$calls, $dup ) { return ++$calls <= 2 ? $dup : $r; };
add_filter( 'mkl_pc/quote_request/reference', $f );
$ref = $q->service->generate_reference();
check( 'taken reference drawn again', $ref !== $dup && 3 === $calls, "$ref after $calls" );

foreach ( [ 'trash', 'auto-draft', 'mkl_quote_accepted' ] as $status ) {
	wp_update_post( [ 'ID' => $post, 'post_status' => $status ] );
	$calls = 0;
	$ref = $q->service->generate_reference();
	check( "$status request's reference is taken too", $ref !== $dup && 3 === $calls, get_post_status( $post ) );
}
remove_filter( 'mkl_pc/quote_request/reference', $f );

// A filter returning one value: given up after 10 draws, not an endless loop
$calls = 0;
$g = function() use ( &$calls, $dup ) { $calls++; return $dup; };
add_filter( 'mkl_pc/quote_request/reference', $g );
$ref = $q->service->generate_reference();
check( 'gives up after 10 draws', $dup === $ref && 10 === $calls, (string) $calls );
remove_filter( 'mkl_pc/quote_request/reference', $g );

wp_delete_post( $post, true );
mkl_pc_tests_done();
