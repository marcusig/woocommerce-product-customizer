<?php
/**
 * Solid-colour choices in the server merge (docs/solid-colour-choices-spec.md, phase 2): the
 * `s<rrggbb>` image token, Images::merge() filling a mask with a colour, Configuration treating a
 * colour as a layer that is always merged, and Choice resolving its colour live and stored.
 */
require dirname( __DIR__ ) . '/bootstrap.php';

use MKL\PC\Configuration;
use MKL\PC\Choice;

$tag = wp_generate_password( 6, false );

// The demo product's case image (68) has an alpha shape: it serves as the mask. The green dial
// (67) is an image of the same size to draw under it.
$mask_path = get_attached_file( 68 );
$dial_path = get_attached_file( 67 );
if ( ! $mask_path || ! is_file( $mask_path ) || ! $dial_path || ! is_file( $dial_path ) ) mkl_pc_tests_skip( 'the demo product images 67 and 68 are missing' );
$mask_size = getimagesize( $mask_path );
$dial_size = getimagesize( $dial_path );

// Tokens.
check( 'a colour image reads back as its colour', '#1e90ff' === Configuration::parse_color_image( 's1e90ff' ) );
check( 'an attachment id, an md5 or an upload token is no colour', '' === Configuration::parse_color_image( '68' ) && '' === Configuration::parse_color_image( md5( 'x' ) ) && '' === Configuration::parse_color_image( 'u' . md5( 'x' ) ) && '' === Configuration::parse_color_image( 68 ) );
check( 'a hex code becomes a colour image, short codes expanded', 's1199ff' === Configuration::color_image( ' #19F ' ) && 's1e90ff' === Configuration::color_image( '#1E90FF' ) );
check( 'anything else is no colour image', '' === Configuration::color_image( 'red' ) && '' === Configuration::color_image( '#1e90ff80' ) && '' === Configuration::color_image( null ) );
check( 'a masked colour token parses into image and mask', array( 'image' => 's1e90ff', 'mask' => 68 ) === Configuration::parse_layer_token( 's1e90ffm68' ), wp_json_encode( Configuration::parse_layer_token( 's1e90ffm68' ) ) );
check( 'image tokens parse as before', array( 'image' => '67', 'mask' => 68 ) === Configuration::parse_layer_token( '67m68' ) && array( 'image' => 'abc' ) === Configuration::parse_layer_token( 'abc' ) );

/**
 * Alpha (GD, 0 opaque - 127 clear) and colour of a PNG's pixel.
 */
function solid_colour_pixel( $gd, $x, $y ) {
	$c = imagecolorat( $gd, $x, $y );
	return array( 'a' => ( $c >> 24 ) & 0x7F, 'rgb' => $c & 0xFFFFFF );
}

$dir = wp_upload_dir()['basedir'] . '/mkl-pc-tests-' . $tag;
wp_mkdir_p( $dir );
$images = new MKL\PC\Images();

// A colour alone, under the mask: the mask's size, the colour where the mask shows, the mask's alpha.
$file = $images->merge( array( 's1e90ffm68' => array( 'color' => '#1e90ff', 'mask' => $mask_path ) ), 'file', $dir, 'alone.png' );
$out = is_string( $file ) && is_file( $file ) ? imagecreatefrompng( $file ) : null;
$mask_gd = imagecreatefromstring( file_get_contents( $mask_path ) );
check( 'a colour alone is merged', (bool) $out, wp_json_encode( $file ) );
if ( $out ) {
	check( 'at the mask size', imagesx( $out ) === $mask_size[0] && imagesy( $out ) === $mask_size[1], imagesx( $out ) . 'x' . imagesy( $out ) );
	$off = 0; $wrong_colour = 0; $shown = 0; $hidden = 0;
	for ( $y = 0; $y < imagesy( $out ); $y += 2 ) {
		for ( $x = 0; $x < imagesx( $out ); $x += 2 ) {
			$m = ( imagecolorat( $mask_gd, $x, $y ) >> 24 ) & 0x7F;
			$p = solid_colour_pixel( $out, $x, $y );
			if ( abs( $p['a'] - $m ) > 1 ) $off++;
			if ( $m < 127 && 0x1e90ff !== $p['rgb'] ) $wrong_colour++;
			if ( 0 === $m ) $shown++;
			if ( 127 === $m ) $hidden++;
		}
	}
	check( 'the mask has opaque and clear parts to compare', $shown > 100 && $hidden > 100, "$shown / $hidden" );
	check( 'the alpha is the mask\'s, pixel for pixel', 0 === $off, "$off pixels off" );
	check( 'the colour is the choice\'s where it shows', 0 === $wrong_colour, "$wrong_colour pixels" );
}

// Over an image: the colour where the mask shows, the image where it hides.
$file = $images->merge( array( 67 => $dial_path, 's1e90ffm68' => array( 'color' => '#1e90ff', 'mask' => $mask_path ) ), 'file', $dir, 'over.png' );
$out = is_string( $file ) && is_file( $file ) ? imagecreatefrompng( $file ) : null;
$dial_gd = imagecreatefromstring( file_get_contents( $dial_path ) );
check( 'a colour over an image is merged', (bool) $out );
if ( $out && $dial_size[0] === $mask_size[0] && $dial_size[1] === $mask_size[1] ) {
	$bad = 0;
	for ( $y = 0; $y < imagesy( $out ); $y += 3 ) {
		for ( $x = 0; $x < imagesx( $out ); $x += 3 ) {
			$m = ( imagecolorat( $mask_gd, $x, $y ) >> 24 ) & 0x7F;
			$p = solid_colour_pixel( $out, $x, $y );
			if ( 0 === $m && ( 0x1e90ff !== $p['rgb'] || 0 !== $p['a'] ) ) $bad++;
			if ( 127 === $m && ( imagecolorat( $dial_gd, $x, $y ) & 0xFFFFFF ) !== $p['rgb'] && 127 !== ( ( imagecolorat( $dial_gd, $x, $y ) >> 24 ) & 0x7F ) ) $bad++;
		}
	}
	check( 'colour inside the mask, the image outside', 0 === $bad, "$bad pixels" );
}

// Scaled to an output size: the colour and its mask scale together.
$file = $images->merge( array( 's1e90ffm68' => array( 'color' => '#1e90ff', 'mask' => $mask_path ) ), 'file', $dir, 'scaled.png', array( 'width' => (int) ( $mask_size[0] / 2 ), 'height' => 0 ) );
$out = is_string( $file ) && is_file( $file ) ? imagecreatefrompng( $file ) : null;
check( 'scaled to the output width', $out && abs( imagesx( $out ) - (int) ( $mask_size[0] / 2 ) ) <= 1, $out ? imagesx( $out ) . 'x' . imagesy( $out ) : 'none' );

// An unreadable mask: over an image the colour fills the picture; as the bottom layer it has no size.
$file = $images->merge( array( 67 => $dial_path, 's1e90ffm0' => array( 'color' => '#1e90ff', 'mask' => '' ) ), 'file', $dir, 'unmasked.png' );
$out = is_string( $file ) && is_file( $file ) ? imagecreatefrompng( $file ) : null;
check( 'without a mask, over an image, the colour fills the picture', $out && 0x1e90ff === solid_colour_pixel( $out, 1, 1 )['rgb'] && 0 === solid_colour_pixel( $out, 1, 1 )['a'] );
$file = $images->merge( array( 's1e90ffm0' => array( 'color' => '#1e90ff', 'mask' => '' ) ), 'file', $dir, 'nothing.png' );
check( 'without a mask, alone, nothing is merged', false === $file, wp_json_encode( $file ) );

// Configuration: a colour layer is never a single attachment, and names its file.
$configuration = new Configuration( null, array( 'product_id' => 613, 'content' => wp_json_encode( array( array( 'image' => 's1e90ff', 'mask' => 68 ) ) ) ) );
check( 'a colour alone is not a single image', false === $configuration->content_has_single_image() );
check( 'the file name carries the colour token', false !== strpos( $configuration->get_configuration_image_name(), '-s1e90ffm68' ), $configuration->get_configuration_image_name() );
$file = $configuration->get_image_file( null, $dir );
check( 'a colour alone is merged to a file', $file && is_file( $file ), wp_json_encode( $file ) );
$configuration = new Configuration( null, array( 'product_id' => 613, 'content' => wp_json_encode( array( array( 'image' => 67 ), array( 'image' => 's1e90ff', 'mask' => 68 ) ) ) ) );
$file = $configuration->get_image_file( null, $dir );
check( 'an image and a colour are merged to a file', $file && is_file( $file ) && false !== strpos( $file, '-67-s1e90ffm68' ), wp_json_encode( $file ) );

// A masked image alone is merged too (before this, get_image_file() refused any stack of one).
$configuration = new Configuration( null, array( 'product_id' => 613, 'content' => wp_json_encode( array( array( 'image' => 67, 'mask' => 68 ) ) ) ) );
$file = $configuration->get_image_file( null, $dir );
check( 'a masked image alone is merged to a file', $file && is_file( $file ) && false !== strpos( $file, '-67m68' ), wp_json_encode( $file ) );
$configuration = new Configuration( null, array( 'product_id' => 613, 'content' => wp_json_encode( array( array( 'image' => 67 ) ) ) ) );
check( 'an unmasked image alone is still not merged', false === $configuration->get_image_file( null, $dir ) && $configuration->content_has_single_image() );

// Choice: live from the product, stored from the configuration.
$product = new WC_Product_Simple();
$product->set_name( 'Solid colour test ' . $tag );
$product->set_status( 'private' );
$product_id = $product->save();
$db = mkl_pc( 'db' );
$db->set( $product_id, $product_id, 'angles', array( array( '_id' => 1, 'id' => 1, 'name' => 'Front' ), array( '_id' => 2, 'id' => 2, 'name' => 'Back' ) ) );
$mask_entry = array( 'angleId' => 1, 'image' => array( 'id' => 68, 'url' => wp_get_attachment_url( 68 ), 'dimensions' => array( 'width' => $mask_size[0], 'height' => $mask_size[1] ) ) );
$db->set( $product_id, $product_id, 'layers', array(
	array( '_id' => 1, 'id' => 1, 'order' => 1, 'name' => 'Body', 'type' => 'simple', 'draw_choice_color' => true, 'masks' => array( $mask_entry ) ),
	array( '_id' => 2, 'id' => 2, 'order' => 2, 'name' => 'Trim', 'type' => 'simple', 'masks' => array( $mask_entry ) ),
) );
$no_image = array( array( 'angleId' => 1, 'image' => array( 'id' => '', 'url' => '' ) ), array( 'angleId' => 2, 'image' => array( 'id' => '', 'url' => '' ) ) );
$db->set( $product_id, $product_id, 'content', array(
	array( 'layerId' => 1, 'choices' => array(
		array( '_id' => 1, 'id' => 1, 'layerId' => 1, 'name' => 'Blue', 'color' => '#1E90FF', 'images' => $no_image ),
		array( '_id' => 2, 'id' => 2, 'layerId' => 1, 'name' => 'Red', 'color' => 'red', 'images' => $no_image ),
		array( '_id' => 3, 'id' => 3, 'layerId' => 1, 'name' => 'Printed', 'color' => '#00ff00', 'images' => array( array( 'angleId' => 1, 'image' => array( 'id' => 67, 'url' => wp_get_attachment_url( 67 ) ) ) ) ),
	) ),
	array( 'layerId' => 2, 'choices' => array(
		array( '_id' => 1, 'id' => 1, 'layerId' => 2, 'name' => 'Blue', 'color' => '#1E90FF', 'images' => $no_image ),
	) ),
) );
wp_cache_flush();

$blue = new Choice( $product_id, $product_id, 1, 1, 1 );
check( 'a live colour choice resolves to its colour image', 's1e90ff' === $blue->get_image_id(), wp_json_encode( $blue->get_image_id() ) );
check( 'get_color() reads it', '#1e90ff' === $blue->get_color() );
check( 'its mask is the layer\'s for the view', 68 === $blue->get_mask_id() );
check( 'no mask on the view, no colour', '' === ( new Choice( $product_id, $product_id, 1, 1, 2 ) )->get_image_id() );
check( 'a colour that is not a hex code draws nothing', '' === ( new Choice( $product_id, $product_id, 1, 2, 1 ) )->get_image_id() );
check( 'an image wins over the colour', 67 === (int) ( new Choice( $product_id, $product_id, 1, 3, 1 ) )->get_image_id() );
check( 'a layer without the setting draws no colour', '' === ( new Choice( $product_id, $product_id, 2, 1, 1 ) )->get_image_id() );
check( 'the thumbnail type is not affected', '' === $blue->get_image_id( 'thumbnail' ) );
$filter = function() { return '#00ff00'; };
add_filter( 'mkl_pc/choice/color', $filter );
check( 'mkl_pc/choice/color changes the live colour', 's00ff00' === ( new Choice( $product_id, $product_id, 1, 1, 1 ) )->get_image_id() );
remove_filter( 'mkl_pc/choice/color', $filter );

$stored = new Choice( $product_id, $product_id, 1, 1, 1, (object) array( 'image' => 's00ff00', 'mask' => 68 ) );
$stored->set_source( Choice::SOURCE_STORED );
check( 'a stored choice keeps the colour it was saved with', 's00ff00' === $stored->get_image_id() && '#00ff00' === $stored->get_color() && 68 === $stored->get_mask_id() );
$stored = new Choice( $product_id, $product_id, 1, 1, 1, (object) array( 'image' => 0 ) );
$stored->set_source( Choice::SOURCE_STORED );
check( 'a choice stored with image 0 stays without', '' === $stored->get_image_id() );
// An empty saved image counts as nothing saved (get_saved_image_id(), unchanged), so the product's
// current state is used, colour included.
$stored = new Choice( $product_id, $product_id, 1, 1, 1, (object) array( 'image' => '' ) );
$stored->set_source( Choice::SOURCE_STORED );
check( 'a choice stored with an empty image falls back to the live colour', 's1e90ff' === $stored->get_image_id() );
$stored = new Choice( $product_id, $product_id, 1, 1, 1, (object) array( 'name' => 'Blue' ) );
$stored->set_source( Choice::SOURCE_STORED );
check( 'a stored choice from before images were saved falls back to the live colour', 's1e90ff' === $stored->get_image_id() );

// The cart's merge list: the colour travels as an image, with its mask.
$cart = mkl_pc( 'frontend' )->cart;
$method = new ReflectionMethod( $cart, '_get_configuration_for_cart_item' );
$method->setAccessible( true );
$cart_configuration = $method->invoke( $cart, array( 'product_id' => $product_id, 'configurator_data' => array( $blue ) ) );
check( 'the cart picture names the colour and its mask', false !== strpos( $cart_configuration->get_configuration_image_name(), '-s1e90ffm68' ), $cart_configuration->get_configuration_image_name() );

// Clean up.
foreach ( glob( $dir . '/*' ) as $f ) unlink( $f );
rmdir( $dir );
wp_delete_post( $product_id, true );

mkl_pc_tests_done();
