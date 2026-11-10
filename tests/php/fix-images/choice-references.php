<?php
/**
 * The Fix images tool and images an add-on keeps in a choice: the mkl_pc/db/scan_images/choice
 * hook, DB::remap_image_reference(), and Form builder's upload zones and zone masks
 * (docs/image-overlay-spec.md).
 */
require dirname( __DIR__ ) . '/bootstrap.php';

$db = mkl_pc( 'db' );
$tag = wp_generate_password( 6, false );

// Two attachments of the demo product: the case (68) and the green dial (67).
$case_url = wp_get_attachment_url( 68 );
$dial_url = wp_get_attachment_url( 67 );
if ( ! $case_url || ! $dial_url ) mkl_pc_tests_skip( 'the demo product images 67 and 68 are missing' );

check( 'a reference still right is left alone', null === $db->remap_image_reference( array( 'id' => 68, 'url' => $case_url ) ) );
$fixed = $db->remap_image_reference( array( 'id' => 999999999, 'url' => $case_url, 'width' => 532 ) );
check( 'a wrong id is found again by its file name, other keys kept', is_array( $fixed ) && 68 === $fixed['id'] && $case_url === $fixed['url'] && 532 === $fixed['width'], wp_json_encode( $fixed ) );
check( 'a file name found nowhere is left alone', null === $db->remap_image_reference( array( 'id' => 68, 'url' => 'https://elsewhere.test/uploads/nothing-' . $tag . '.png' ) ) );

$product = new WC_Product_Simple();
$product->set_name( 'Fix images test ' . $tag );
$product->set_status( 'private' );
$product_id = $product->save();

$db->set( $product_id, $product_id, 'layers', array(
	array( '_id' => 1, 'id' => 1, 'order' => 1, 'name' => 'Upload', 'type' => 'form' ),
) );
$db->set( $product_id, $product_id, 'content', array(
	array( 'layerId' => 1, 'choices' => array(
		array(
			'_id' => 1, 'id' => 1, 'layerId' => 1, 'name' => 'Your photo', 'text_field_type' => 'upload', 'upload_preview' => true,
			'kept_by_an_add_on' => array( 'id' => 999999999, 'url' => $dial_url ),
			'image_zones' => array( array( 'angleId' => 1, 'ref_image' => array( 'url' => $case_url, 'id' => 999999998, 'width' => 532, 'height' => 864 ), 'position' => array( 'x' => 266, 'y' => 200, 'width' => 200, 'height' => 200, 'rotation' => 0 ) ) ),
			'zone_masks' => array( array( 'angleId' => 1, 'image' => array( 'id' => 999999997, 'url' => $dial_url, 'dimensions' => array( 'width' => 532, 'height' => 864 ) ) ) ),
		),
	) ),
) );

$seen = 0;
$hook = function( $choice, $the_db, $id, $layer_id ) use ( &$seen, $product_id ) {
	if ( (int) $id !== (int) $product_id ) return $choice;
	$seen++;
	if ( ! empty( $choice['kept_by_an_add_on'] ) ) {
		$remapped = $the_db->remap_image_reference( $choice['kept_by_an_add_on'] );
		if ( null !== $remapped ) $choice['kept_by_an_add_on'] = $remapped;
	}
	return $choice;
};
add_filter( 'mkl_pc/db/scan_images/choice', $hook, 10, 4 );
$db->scan_product_images( $product_id );
remove_filter( 'mkl_pc/db/scan_images/choice', $hook, 10 );
wp_cache_flush();

$content = $db->get( 'content', $product_id );
$choice = $content[0]['choices'][0];
check( 'the hook sees a choice without images (a form field)', 1 === $seen, (string) $seen );
check( 'what the hook changed is saved', 67 === (int) $choice['kept_by_an_add_on']['id'], wp_json_encode( $choice['kept_by_an_add_on'] ) );

if ( class_exists( 'MKL_PC_Form_Builder__Upload_Preview' ) ) {
	check( 'Form builder: a zone\'s reference image is remapped, its size kept', 68 === (int) $choice['image_zones'][0]['ref_image']['id'] && 532 === (int) $choice['image_zones'][0]['ref_image']['width'], wp_json_encode( $choice['image_zones'][0]['ref_image'] ) );
	check( 'Form builder: a zone mask is remapped', 67 === (int) $choice['zone_masks'][0]['image']['id'], wp_json_encode( $choice['zone_masks'][0]['image'] ) );
} else {
	echo "Form builder is not active: its part is not checked.\n";
}

wp_delete_post( $product_id, true );
mkl_pc_tests_done();
