<?php
/**
 * Links to a global layer with their own choice settings
 * (docs/global-layer-choice-overrides-spec.md): stored, resolved, written back, localized.
 */
require dirname( __DIR__ ) . '/bootstrap.php';

use MKL\PC\Global_Layer\Linker;

$db  = mkl_pc( 'db' );
$tag = wp_generate_password( 6, false );

$raw_content = function( $owner_id, $layer_id ) use ( $db ) {
	clean_post_cache( $owner_id );
	$value = get_post_meta( $owner_id, '_mkl_product_configurator_content_' . $layer_id, true );
	$value = \MKL\PC\Utils::safe_unserialize( $value );
	return is_string( $value ) ? $db->decode_stored_json( $value ) : $value;
};
$by_id = function( $choices ) {
	$out = array();
	foreach ( (array) $choices as $choice ) $out[ (int) $choice['_id'] ] = $choice;
	return $out;
};
$entry_for = function( $chunk, $id ) {
	foreach ( (array) ( $chunk['overrides']['choices'] ?? array() ) as $entry ) {
		if ( (int) $entry['id'] === (int) $id ) return $entry;
	}
	return null;
};
$global_choices = function( $global_id ) use ( $by_id ) {
	clean_post_cache( $global_id );
	$data = MKL\PC\Global_Layers::get( $global_id );
	return $by_id( MKL\PC\Global_Layers::normalize_choices( $data['content'] ) );
};
$flush = function() { wp_cache_flush(); };

$image_list = function( $name ) {
	return array( array( 'angleId' => 1, 'image' => array( 'id' => 0, 'url' => 'https://example.com/' . $name . '.png' ) ) );
};

$global_layer = array( '_id' => 1, 'id' => 1, 'name' => 'Fabrics ' . $tag, 'type' => 'simple' );
$global_id = MKL\PC\Global_Layers::save(
	$global_layer,
	array(
		array( '_id' => 1, 'layerId' => 1, 'name' => 'Blue', 'extra_price' => 10, 'sku' => 'GLB-1', 'stock' => 50, 'images' => $image_list( 'blue' ), 'order' => 1 ),
		array( '_id' => 2, 'layerId' => 1, 'name' => 'Red', 'extra_price' => 12, 'sku' => 'GLB-2', 'stock' => 20, 'order' => 2 ),
		array( '_id' => 3, 'layerId' => 1, 'name' => 'Green', 'extra_price' => 14, 'sku' => 'GLB-3', 'stock' => 30, 'order' => 3 ),
	)
);
check( 'global layer created', is_int( $global_id ) && $global_id > 0, is_wp_error( $global_id ) ? $global_id->get_error_message() : '' );

// -- next_choice_id ---------------------------------------------------------------------------
check( 'next_choice_id: seeded from the highest choice id', 4 === MKL\PC\Global_Layers::get_next_choice_id( $global_id ), (string) MKL\PC\Global_Layers::get_next_choice_id( $global_id ) );
check( 'next_choice_id: stored next to the content', 4 === (int) get_post_meta( $global_id, \MKL\PC\Global_Layer\Schema::META_NEXT_CHOICE_ID, true ) );
$editor_content = Linker::content_for_editor( $global_id );
$editor_init    = Linker::init_data_for_editor( $global_id );
check( 'next_choice_id: given to the editor, on the content row and on the global layer block', 4 === ( $editor_content[0]['next_choice_id'] ?? null ) && 4 === ( $editor_init['global_layer']['next_choice_id'] ?? null ), wp_json_encode( array( $editor_content[0]['next_choice_id'] ?? null, $editor_init['global_layer'] ?? null ) ) );
$three = array_values( $global_choices( $global_id ) );
// Delete the newest choice: its id must not come back.
MKL\PC\Global_Layers::save_content( $global_id, array( $three[0], $three[1] ) );
check( 'next_choice_id: never reuses the id of a deleted choice', 4 === MKL\PC\Global_Layers::get_next_choice_id( $global_id ), (string) MKL\PC\Global_Layers::get_next_choice_id( $global_id ) );
$new_choice = array( '_id' => 4, 'name' => 'Yellow', 'extra_price' => 9, 'sku' => 'GLB-4', 'stock' => 5, 'order' => 4 );
MKL\PC\Global_Layers::save_content( $global_id, array( $three[0], $three[1], $new_choice ) );
check( 'next_choice_id: moves on once the id is used', 5 === MKL\PC\Global_Layers::get_next_choice_id( $global_id ) );
// A layer stored before the meta existed: seeded on first read.
$legacy_id = MKL\PC\Global_Layers::save( array( '_id' => 1, 'name' => 'Legacy ' . $tag, 'type' => 'simple' ), array( array( '_id' => 7, 'name' => 'Seven' ) ) );
delete_post_meta( $legacy_id, \MKL\PC\Global_Layer\Schema::META_NEXT_CHOICE_ID );
check( 'next_choice_id: a layer without it is seeded from its highest id', 8 === MKL\PC\Global_Layers::get_next_choice_id( $legacy_id ) );
wp_delete_post( $legacy_id, true );
// Back to three choices for the rest.
MKL\PC\Global_Layers::save_content( $global_id, $three );
check( 'next_choice_id: never decreases', 5 === MKL\PC\Global_Layers::get_next_choice_id( $global_id ) );

// -- A product with links -----------------------------------------------------------------------
$product = new WC_Product_Simple();
$product->set_name( 'Choice overrides test ' . $tag );
$product->set_status( 'private' );
$product_id = $product->save();

$link = function( $id ) use ( $global_id, $tag ) {
	return array( '_id' => $id, 'id' => $id, 'order' => $id, 'is_global' => true, 'global_id' => $global_id, 'name' => 'Fabrics ' . $tag, 'type' => 'simple' );
};
$db->set( $product_id, $product_id, 'layers', array( $link( 10 ), $link( 11 ) ) );

$collar_images = $image_list( 'collar-blue' );
$editor_choice = function( $id, $name, $extra = array() ) {
	$base = array( 1 => array( 'name' => 'Blue', 'extra_price' => 10, 'sku' => 'GLB-1', 'stock' => 50, 'images' => array( array( 'angleId' => 1, 'image' => array( 'id' => 0, 'url' => 'https://example.com/blue.png' ) ) ), 'order' => 1 ),
		2 => array( 'name' => 'Red', 'extra_price' => 12, 'sku' => 'GLB-2', 'stock' => 20, 'order' => 2 ),
		3 => array( 'name' => 'Green', 'extra_price' => 14, 'sku' => 'GLB-3', 'stock' => 30, 'order' => 3 ) );
	return array_merge( array( '_id' => $id, 'layerId' => 10 ), $base[ $id ], $extra );
};
$content_row = function( $layer_id, $choices ) use ( $global_id ) {
	return array( 'layerId' => $layer_id, 'global_id' => $global_id, 'choices' => $choices );
};

// Link 10 (collar): choice 1 has its own price, SKU, stock and images; `order` cannot be overridden;
// `is_default` was overridden once and switched off; `name` has a value but is not listed. Choice 3
// is overridden too, but its global choice gets deleted below. Choice 99 is no choice at all.
$collar_choices = array(
	$editor_choice( 1, 'Blue', array(
		'extra_price' => 15, 'sku' => 'FAB-1-COL', 'stock' => 5, 'images' => $collar_images, 'name' => 'Blue',
		'overrides'   => array(
			'fields' => array( 'extra_price', 'sku', 'stock', 'images', 'order', 'html_missing' ),
			'values' => array( 'is_default' => true, 'name' => 'Not listed', 'order' => 99, 'extra_price' => 0 ),
			'global' => array( 'extra_price' => 10 ),
		),
	) ),
	$editor_choice( 2, 'Red' ),
	$editor_choice( 3, 'Green', array(
		'extra_price' => 20,
		'overrides'   => array( 'fields' => array( 'extra_price' ), 'values' => array() ),
	) ),
	array( '_id' => 99, 'layerId' => 10, 'name' => 'Ghost', 'overrides' => array( 'fields' => array( 'name' ), 'values' => array( 'name' => 'Ghost' ) ) ),
);
$db->set( $product_id, $product_id, 'content', array(
	$content_row( 10, $collar_choices ),
	// Inherits everything.
	$content_row( 11, array( $editor_choice( 1, 'Blue' ), $editor_choice( 2, 'Red' ), $editor_choice( 3, 'Green' ) ) ),
) );

$chunk = $raw_content( $product_id, 10 );
check( 'stored as a reference', is_array( $chunk ) && ! isset( $chunk['choices'] ) && $global_id === (int) $chunk['global_id'], wp_json_encode( $chunk ) );
$entry = $entry_for( $chunk, 1 );
check( 'overrides.choices is a list of { id, fields, values }', isset( $chunk['overrides']['choices'] ) && array_keys( $chunk['overrides']['choices'] ) === range( 0, count( $chunk['overrides']['choices'] ) - 1 ) && is_array( $entry ), wp_json_encode( $chunk['overrides'] ?? null ) );
check( 'listed fields stored, excluded and valueless ones dropped', array( 'extra_price', 'sku', 'stock', 'images' ) === ( $entry['fields'] ?? null ), wp_json_encode( $entry ) );
check( 'a listed field takes the value the form edited', 15 == ( $entry['values']['extra_price'] ?? null ) && 'FAB-1-COL' === ( $entry['values']['sku'] ?? null ) && 5 == ( $entry['values']['stock'] ?? null ) && $collar_images[0]['image']['url'] === ( $entry['values']['images'][0]['image']['url'] ?? null ), wp_json_encode( $entry['values'] ?? null ) );
check( 'a switched-off value is kept', true === ( $entry['values']['is_default'] ?? null ) );
check( 'an excluded value is not kept', ! isset( $entry['values']['order'] ) );
check( 'the per-choice key and the global values are never stored', ! isset( $entry['global'] ) && ! isset( $chunk['choices'] ) && ! strpos( wp_json_encode( $chunk ), '"overrides":{"fields"' ) );
check( 'an entry on a choice the global layer lacks is dropped', null === $entry_for( $chunk, 99 ) );
$chunk11 = $raw_content( $product_id, 11 );
check( 'an inheriting link has no overrides', is_array( $chunk11 ) && ! isset( $chunk11['overrides'] ), wp_json_encode( $chunk11 ) );

// -- Reading ------------------------------------------------------------------------------------
$flush();
$content = $db->get( 'content', $product_id );
$rows    = array();
foreach ( $content as $row ) $rows[ (int) $row['layerId'] ] = $row;
$c10 = $by_id( $rows[10]['choices'] );
$c11 = $by_id( $rows[11]['choices'] );
check( 'resolved: the link\'s values', 15 == $c10[1]['extra_price'] && 'FAB-1-COL' === $c10[1]['sku'] && 5 == $c10[1]['stock'] && $collar_images[0]['image']['url'] === $c10[1]['images'][0]['image']['url'], wp_json_encode( $c10[1] ) );
check( 'resolved: an unlisted value is not applied', 'Blue' === $c10[1]['name'] && 1 === (int) $c10[1]['order'] && ! isset( $c10[1]['is_default'] ), wp_json_encode( $c10[1] ) );
check( 'resolved: layerId stamped', 10 === (int) $c10[1]['layerId'] );
check( 'resolved: the other choices follow the global layer', 12 == $c10[2]['extra_price'] && ! isset( $c10[2]['overrides'] ), wp_json_encode( $c10[2] ) );
check( 'resolved: overrides handed to the editor', array( 'extra_price', 'sku', 'stock', 'images' ) === ( $c10[1]['overrides']['fields'] ?? null ) && true === ( $c10[1]['overrides']['values']['is_default'] ?? null ), wp_json_encode( $c10[1]['overrides'] ?? null ) );
check( 'resolved: global values of the overridden fields, for the editor', 10 == ( $c10[1]['overrides']['global']['extra_price'] ?? null ) && 'GLB-1' === ( $c10[1]['overrides']['global']['sku'] ?? null ) && 'https://example.com/blue.png' === ( $c10[1]['overrides']['global']['images'][0]['image']['url'] ?? null ) && ! isset( $c10[1]['overrides']['global']['is_default'] ), wp_json_encode( $c10[1]['overrides']['global'] ?? null ) );
check( 'resolved: the other link inherits', 10 == $c11[1]['extra_price'] && 'GLB-1' === $c11[1]['sku'] && ! isset( $c11[1]['overrides'] ) && 11 === (int) $c11[1]['layerId'], wp_json_encode( $c11[1] ) );
check( 'resolved: the row carries no reference bookkeeping', ! isset( $rows[10]['overrides'] ) );

$front = $db->get_front_end_data( $product_id );
$front_choices = $by_id( $front['content'][0]['choices'] ?? array() );
$front_row10   = null;
foreach ( $front['content'] ?? array() as $row ) if ( 10 === (int) $row['layerId'] ) $front_row10 = $by_id( $row['choices'] );
check( 'front end: the link\'s values, without the bookkeeping', is_array( $front_row10 ) && 15 == $front_row10[1]['extra_price'] && ! isset( $front_row10[1]['overrides'] ), wp_json_encode( $front_row10[1] ?? null ) );
$db->set_context( 'admin' );

// Saving what the editor got back keeps everything as it was (strip o resolve).
$flush();
$db->set( $product_id, $product_id, 'content', $db->get( 'content', $product_id ) );
$again = $raw_content( $product_id, 10 );
check( 'round trip keeps fields and values', $entry_for( $chunk, 1 ) == $entry_for( $again, 1 ), wp_json_encode( $again['overrides'] ?? null ) );
check( 'round trip keeps the choice 3 entry while its global choice exists', null !== $entry_for( $again, 3 ), wp_json_encode( $again['overrides'] ?? null ) );

// Switched off in the editor: the effective value goes back to the global one, the link's is kept.
$flush();
$rows_now = $db->get( 'content', $product_id );
foreach ( $rows_now as $row_index => $row ) {
	if ( 10 !== (int) $row['layerId'] ) continue;
	foreach ( $row['choices'] as $choice_index => $choice ) {
		if ( 1 !== (int) $choice['_id'] ) continue;
		$rows_now[ $row_index ]['choices'][ $choice_index ]['overrides']['fields'] = array( 'sku', 'stock', 'images' );
		$rows_now[ $row_index ]['choices'][ $choice_index ]['extra_price']         = $choice['overrides']['global']['extra_price'];
	}
}
$db->set( $product_id, $product_id, 'content', $rows_now );
$switched_off_entry = $entry_for( $raw_content( $product_id, 10 ), 1 );
check( 'switched off: the value is kept for later', array( 'sku', 'stock', 'images' ) === ( $switched_off_entry['fields'] ?? null ) && 15 == ( $switched_off_entry['values']['extra_price'] ?? null ), wp_json_encode( $switched_off_entry ) );
$flush();
$c10 = $by_id( $db->get( 'content', $product_id )[0]['choices'] );
check( 'switched off: the global price shows', 10 == $c10[1]['extra_price'] );

// Saved during "Edit original": the choice shows the global values, the link's are in `values`.
$rows_now = $db->get( 'content', $product_id );
foreach ( $rows_now as $row_index => $row ) {
	if ( 10 !== (int) $row['layerId'] ) continue;
	foreach ( $row['choices'] as $choice_index => $choice ) {
		if ( 1 !== (int) $choice['_id'] ) continue;
		$rows_now[ $row_index ]['choices'][ $choice_index ]['overrides']['editing_original'] = true;
		$rows_now[ $row_index ]['choices'][ $choice_index ]['sku']                           = 'GLB-1';
	}
}
$db->set( $product_id, $product_id, 'content', $rows_now );
$editing_original_entry = $entry_for( $raw_content( $product_id, 10 ), 1 );
check( 'saved during Edit original: the link keeps its own value', 'FAB-1-COL' === ( $editing_original_entry['values']['sku'] ?? null ) && ! isset( $editing_original_entry['editing_original'] ), wp_json_encode( $editing_original_entry ) );

// An override on a choice deleted from the global layer: ignored on read, dropped on the next save.
$flush();
MKL\PC\Global_Layers::save_content( $global_id, array_values( array_filter( $global_choices( $global_id ), function( $global_choice ) { return 3 !== (int) $global_choice['_id']; } ) ) );
$flush();
$rows_now = $db->get( 'content', $product_id );
$c10 = $by_id( $rows_now[0]['choices'] );
check( 'deleted global choice: gone from the read, its override applies to nothing', ! isset( $c10[3] ) && 3 === count( array_filter( array( 1, 2 ), 'is_int' ) ) + 1 && 20 != ( $c10[1]['extra_price'] ), wp_json_encode( array_keys( $c10 ) ) );
check( 'deleted global choice: the entry is still stored until the owner is saved', null !== $entry_for( $raw_content( $product_id, 10 ), 3 ) );
$db->set( $product_id, $product_id, 'content', $rows_now );
check( 'deleted global choice: the entry is dropped on the next save', null === $entry_for( $raw_content( $product_id, 10 ), 3 ), wp_json_encode( $raw_content( $product_id, 10 )['overrides'] ?? null ) );
check( 'deleted global choice: its id is not reused', 5 === MKL\PC\Global_Layers::get_next_choice_id( $global_id ) );

// An import onto a site where the global id means nothing keeps the effective content, as its own.
$foreign = $content_row( 10, $collar_choices );
$foreign['global_id'] = 999999999;
$stripped = Linker::strip_content_to_references( array( $foreign ) );
check( 'unknown global id: effective choices kept, no overrides', empty( $stripped[0]['global_id'] ) && 15 == $stripped[0]['choices'][0]['extra_price'] && ! isset( $stripped[0]['choices'][0]['overrides'] ) && ! isset( $stripped[0]['overrides'] ), wp_json_encode( $stripped[0] ) );

// A local layer's choices carry no overrides.
$local = Linker::strip_content_to_references( array( array( 'layerId' => 5, 'choices' => array( array( '_id' => 1, 'name' => 'X', 'overrides' => array( 'fields' => array( 'name' ), 'values' => array( 'name' => 'X' ) ) ) ) ) ) );
check( 'a local layer drops choice overrides', ! isset( $local[0]['choices'][0]['overrides'] ) && 'X' === $local[0]['choices'][0]['name'] );

// The global layer never stores a link's choice overrides, whatever the editor sends.
$leak = array_values( $global_choices( $global_id ) );
$leak[0]['overrides'] = array( 'fields' => array( 'name' ), 'values' => array( 'name' => 'Leak' ) );
MKL\PC\Global_Layers::save_content( $global_id, $leak );
check( 'global layer never stores choice overrides', ! isset( $global_choices( $global_id )[1]['overrides'] ) );

// Excluded list.
check( 'excluded fields: the system fields', array() === array_diff( array( '_id', 'id', 'layerId', 'is_group', 'parent', 'order', 'overrides' ), Linker::choice_override_excluded_fields() ) );
$exclude_sku = function( $excluded_fields ) { $excluded_fields[] = 'sku'; return array_diff( $excluded_fields, array( 'order' ) ); };
add_filter( 'mkl_pc_global_layer_choice_override_excluded_fields', $exclude_sku );
$filtered = Linker::choice_override_excluded_fields();
remove_filter( 'mkl_pc_global_layer_choice_override_excluded_fields', $exclude_sku );
check( 'excluded fields: filterable, the structural ones cannot be removed', in_array( 'sku', $filtered, true ) && in_array( 'order', $filtered, true ) );

// Sanitizing: fields are keys, the id an int, values go by their key.
$sanitized = $db->sanitize( array( 'overrides' => array( 'choices' => array( array( 'id' => '7', 'fields' => array( 'Extra_Price', 'sku<script>' ), 'values' => array( 'extra_price' => '15.5', 'name' => 'A <b>name</b>' ) ) ) ) ) );
check( 'sanitize: id int, fields keys, values by key', 7 === $sanitized['overrides']['choices'][0]['id'] && array( 'extra_price', 'skuscript' ) === $sanitized['overrides']['choices'][0]['fields'] && 15.5 === $sanitized['overrides']['choices'][0]['values']['extra_price'], wp_json_encode( $sanitized ) );

// -- Writing a resolved choice back (stock add-on, Fix images) ----------------------------------
// Fresh state: link 10 overrides price, SKU, stock and images of choice 1.
$global_snapshot = $global_choices( $global_id );
$db->set( $product_id, $product_id, 'content', array(
	$content_row( 10, array(
		$editor_choice( 1, 'Blue', array(
			'extra_price' => 15, 'sku' => 'FAB-1-COL', 'stock' => 5, 'images' => $collar_images,
			'overrides'   => array( 'fields' => array( 'extra_price', 'sku', 'stock', 'images' ), 'values' => array() ),
		) ),
		$editor_choice( 2, 'Red' ),
	) ),
	$content_row( 11, array( $editor_choice( 1, 'Blue' ), $editor_choice( 2, 'Red' ) ) ),
) );
$flush();

$updated = $db->update_choice( $product_id, 0, 10, 1, array( 'stock' => 4 ) );
$flush();
$global_now = $global_choices( $global_id );
$entry      = $entry_for( $raw_content( $product_id, 10 ), 1 );
check( 'update_choice: stock overridden lands in the link\'s value', $updated && 4 == ( $entry['values']['stock'] ?? null ), wp_json_encode( $entry ) );
check( 'update_choice: the global stock is left alone', 50 == $global_now[1]['stock'], (string) $global_now[1]['stock'] );
check( 'update_choice: no other overridden field leaks into the global layer', 10 == $global_now[1]['extra_price'] && 'GLB-1' === $global_now[1]['sku'] && 'https://example.com/blue.png' === $global_now[1]['images'][0]['image']['url'] && ! isset( $global_now[1]['overrides'] ), wp_json_encode( $global_now[1] ) );
check( 'update_choice: the link\'s other values are kept', 15 == ( $entry['values']['extra_price'] ?? null ) && 'FAB-1-COL' === ( $entry['values']['sku'] ?? null ) && array( 'extra_price', 'sku', 'stock', 'images' ) === ( $entry['fields'] ?? null ), wp_json_encode( $entry ) );
$read = $by_id( $db->get( 'content', $product_id )[0]['choices'] );
check( 'update_choice: the link reads its new stock', 4 == $read[1]['stock'] && 15 == $read[1]['extra_price'] );
$other = $by_id( $db->get( 'content', $product_id )[1]['choices'] );
check( 'update_choice: the other link still reads the global stock', 50 == $other[1]['stock'] && 10 == $other[1]['extra_price'] );

// Stock not overridden: every link shares the one count; price and SKU stay the link's.
$rows_now = $db->get( 'content', $product_id );
foreach ( $rows_now[0]['choices'] as $choice_index => $choice ) {
	if ( 1 === (int) $choice['_id'] ) {
		$rows_now[0]['choices'][ $choice_index ]['overrides']['fields'] = array( 'extra_price', 'sku', 'images' );
		$rows_now[0]['choices'][ $choice_index ]['stock']              = $choice['overrides']['global']['stock'];
	}
}
$db->set( $product_id, $product_id, 'content', $rows_now );
$flush();
$updated         = $db->update_choice( $product_id, 0, 10, 1, array( 'stock' => 49 ) );
$flush();
$global_now = $global_choices( $global_id );
$entry      = $entry_for( $raw_content( $product_id, 10 ), 1 );
check( 'update_choice: stock not overridden lands in the global choice', $updated && 49 == $global_now[1]['stock'], (string) $global_now[1]['stock'] );
check( 'update_choice: and the other overridden fields stay out of the global layer', 10 == $global_now[1]['extra_price'] && 'GLB-1' === $global_now[1]['sku'] && 'https://example.com/blue.png' === $global_now[1]['images'][0]['image']['url'], wp_json_encode( $global_now[1] ) );
check( 'update_choice: the link keeps its own price and SKU', 15 == ( $entry['values']['extra_price'] ?? null ) && 'FAB-1-COL' === ( $entry['values']['sku'] ?? null ), wp_json_encode( $entry ) );
$other = $by_id( $db->get( 'content', $product_id )[1]['choices'] );
check( 'update_choice: every link reads the shared stock', 49 == $other[1]['stock'] && 49 == $by_id( $db->get( 'content', $product_id )[0]['choices'] )[1]['stock'] );

// -- Fix images ---------------------------------------------------------------------------------
$case_url = wp_get_attachment_url( 68 );
if ( $case_url ) {
	// The global choice holds a right image; the link keeps a stale one behind a switched-off
	// override (`images` is not listed), the link's price and SKU stay overridden.
	$global_choice_list = array_values( $global_choices( $global_id ) );
	$global_choice_list[0]['images'] = array( array( 'angleId' => 1, 'image' => array( 'id' => 68, 'url' => $case_url ) ) );
	MKL\PC\Global_Layers::save_content( $global_id, $global_choice_list );
	$flush();
	$rows_now = $db->get( 'content', $product_id );
	foreach ( $rows_now[0]['choices'] as $choice_index => $choice ) {
		if ( 1 === (int) $choice['_id'] ) {
			$rows_now[0]['choices'][ $choice_index ]['overrides']['fields'] = array( 'extra_price', 'sku' );
			$rows_now[0]['choices'][ $choice_index ]['images']              = $choice['overrides']['global']['images'];
			$rows_now[0]['choices'][ $choice_index ]['overrides']['values']['images'] = array( array( 'angleId' => 1, 'image' => array( 'id' => 999999999, 'url' => $case_url ), 'thumbnail' => array( 'id' => 999999998, 'url' => $case_url ) ) );
		}
	}
	$rows_now[0]['editing_original'] = false;
	$db->set( $product_id, $product_id, 'content', $rows_now );
	$flush();
	$before = $entry_for( $raw_content( $product_id, 10 ), 1 );
	check( 'fix images: setup keeps the stale kept value', 999999999 === (int) ( $before['values']['images'][0]['image']['id'] ?? 0 ), wp_json_encode( $before ) );
	$db->scan_product_images( $product_id );
	$flush();
	$entry = $entry_for( $raw_content( $product_id, 10 ), 1 );
	check( 'fix images: the kept images of the link are remapped in the content chunk', 68 === (int) ( $entry['values']['images'][0]['image']['id'] ?? 0 ) && 68 === (int) ( $entry['values']['images'][0]['thumbnail']['id'] ?? 0 ), wp_json_encode( $entry['values']['images'] ?? null ) );
	check( 'fix images: the link\'s overrides are still its own', array( 'extra_price', 'sku' ) === ( $entry['fields'] ?? null ) && 15 == $entry['values']['extra_price'], wp_json_encode( $entry ) );
	check( 'fix images: nothing leaked into the global layer', 15 != $global_choices( $global_id )[1]['extra_price'] && 'GLB-1' === $global_choices( $global_id )[1]['sku'] && 68 === (int) $global_choices( $global_id )[1]['images'][0]['image']['id'] );
} else {
	check( 'fix images: skipped, demo attachment 68 is missing', true );
}

// -- Reconcile: the link becomes a local copy ---------------------------------------------------
$db->set( $product_id, $product_id, 'content', array(
	$content_row( 10, array(
		$editor_choice( 1, 'Blue', array( 'extra_price' => 15, 'sku' => 'FAB-1-COL', 'overrides' => array( 'fields' => array( 'extra_price', 'sku' ), 'values' => array( 'stock' => 3 ) ) ) ),
		$editor_choice( 2, 'Red' ),
	) ),
	$content_row( 11, array( $editor_choice( 1, 'Blue' ), $editor_choice( 2, 'Red' ) ) ),
) );
$local_layer = array( '_id' => 10, 'id' => 10, 'order' => 10, 'name' => 'Fabrics ' . $tag, 'type' => 'simple', 'is_global' => false, 'global_id' => null );
$db->set( $product_id, $product_id, 'layers', array( $local_layer, $link( 11 ) ) );
$copy = $raw_content( $product_id, 10 );
$copy_choices = $by_id( $copy['choices'] ?? array() );
check( 'reconcile: the copy has the link\'s listed values', empty( $copy['global_id'] ) && 15 == ( $copy_choices[1]['extra_price'] ?? null ) && 'FAB-1-COL' === ( $copy_choices[1]['sku'] ?? null ), wp_json_encode( $copy_choices[1] ?? $copy ) );
check( 'reconcile: switched-off values are dropped, global ones kept', 49 == ( $copy_choices[1]['stock'] ?? null ) && ! isset( $copy_choices[1]['overrides'] ) && ! isset( $copy['overrides'] ) && 12 == ( $copy_choices[2]['extra_price'] ?? null ), wp_json_encode( $copy_choices[1] ?? null ) );
check( 'reconcile: the global layer is untouched', 10 == $global_choices( $global_id )[1]['extra_price'] );

// -- Localize: the global layer goes ------------------------------------------------------------
// Link 11 gets its own price on choice 2, then the global layer is deleted.
$db->set( $product_id, $product_id, 'layers', array( $link( 10 ), $link( 11 ) ) );
$db->set( $product_id, $product_id, 'content', array(
	$content_row( 10, array( $editor_choice( 1, 'Blue' ), $editor_choice( 2, 'Red' ) ) ),
	$content_row( 11, array(
		$editor_choice( 1, 'Blue' ),
		$editor_choice( 2, 'Red', array( 'extra_price' => 99, 'overrides' => array( 'fields' => array( 'extra_price' ), 'values' => array( 'sku' => 'SWITCHED-OFF' ) ) ) ),
	) ),
) );
$flush();
$db->get( 'content', $product_id ); // registers the owner as a consumer.
wp_delete_post( $global_id, true );
$l10 = $by_id( $raw_content( $product_id, 10 )['choices'] ?? array() );
$l11 = $by_id( $raw_content( $product_id, 11 )['choices'] ?? array() );
check( 'localized link: listed values applied to the copy', 99 == ( $l11[2]['extra_price'] ?? null ) && 10 == ( $l11[1]['extra_price'] ?? null ), wp_json_encode( $l11 ) );
check( 'localized link: switched-off values dropped, global ones kept', 'GLB-2' === ( $l11[2]['sku'] ?? null ) && ! isset( $l11[2]['overrides'] ) && empty( $raw_content( $product_id, 11 )['overrides'] ) );
check( 'localized inheriting link has the global values', 12 == ( $l10[2]['extra_price'] ?? null ) && empty( $raw_content( $product_id, 10 )['global_id'] ) );

wp_delete_post( $product_id, true );

// -- share_layers_config: content lives on each variation ---------------------------------------
$global_id = MKL\PC\Global_Layers::save(
	$global_layer,
	array(
		array( '_id' => 1, 'layerId' => 1, 'name' => 'Blue', 'extra_price' => 10, 'sku' => 'GLB-1', 'order' => 1 ),
		array( '_id' => 2, 'layerId' => 1, 'name' => 'Red', 'extra_price' => 12, 'sku' => 'GLB-2', 'order' => 2 ),
	)
);
$variable = new WC_Product_Variable();
$variable->set_name( 'Choice overrides variable ' . $tag );
$variable->set_status( 'private' );
$variable->update_meta_data( MKL_PC_PREFIX . '_variable_configuration_mode', 'share_layers_config' );
$parent_id = $variable->save();
$variation_ids = array();
foreach ( array( 'A', 'B' ) as $variation_name ) {
	$variation = new WC_Product_Variation();
	$variation->set_parent_id( $parent_id );
	$variation->set_status( 'publish' );
	$variation_ids[ $variation_name ] = $variation->save();
}
$link12 = array( '_id' => 12, 'id' => 12, 'order' => 12, 'is_global' => true, 'global_id' => $global_id, 'name' => 'Fabrics ' . $tag, 'type' => 'simple' );
$db->set( $parent_id, $parent_id, 'layers', array( $link12 ) );
$variation_content = function( $price ) use ( $global_id ) {
	return array( 'layerId' => 12, 'global_id' => $global_id, 'choices' => array(
		array( '_id' => 1, 'layerId' => 12, 'name' => 'Blue', 'extra_price' => $price, 'sku' => 'GLB-1', 'order' => 1, 'overrides' => array( 'fields' => array( 'extra_price' ), 'values' => array() ) ),
		array( '_id' => 2, 'layerId' => 12, 'name' => 'Red', 'extra_price' => 12, 'sku' => 'GLB-2', 'order' => 2 ),
	) );
};
$db->set( $variation_ids['A'], $parent_id, 'content', array( $variation_content( 33 ) ) );
$db->set( $variation_ids['B'], $parent_id, 'content', array( array( 'layerId' => 12, 'global_id' => $global_id, 'choices' => array(
	array( '_id' => 1, 'layerId' => 12, 'name' => 'Blue', 'extra_price' => 10, 'sku' => 'GLB-1', 'order' => 1 ),
	array( '_id' => 2, 'layerId' => 12, 'name' => 'Red', 'extra_price' => 12, 'sku' => 'GLB-2', 'order' => 2 ),
) ) ) );
$flush();
$choices_of_a = $by_id( $db->get( 'content', $variation_ids['A'] )[0]['choices'] ?? array() );
$choices_of_b = $by_id( $db->get( 'content', $variation_ids['B'] )[0]['choices'] ?? array() );
check( 'share_layers_config: variation A has its own price', 33 == ( $choices_of_a[1]['extra_price'] ?? null ), wp_json_encode( $choices_of_a[1] ?? null ) );
check( 'share_layers_config: variation B does not get it', 10 == ( $choices_of_b[1]['extra_price'] ?? null ) && ! isset( $choices_of_b[1]['overrides'] ), wp_json_encode( $choices_of_b[1] ?? null ) );
check( 'share_layers_config: the entry sits on variation A only', null !== $entry_for( $raw_content( $variation_ids['A'], 12 ), 1 ) && null === $entry_for( $raw_content( $variation_ids['B'], 12 ), 1 ) );
// Writing back from A (the stock add-on's path) stays in A.
$updated = $db->update_choice( $parent_id, $variation_ids['A'], 12, 1, array( 'extra_price' => 34 ) );
$flush();
$choices_of_a = $by_id( $db->get( 'content', $variation_ids['A'] )[0]['choices'] ?? array() );
$choices_of_b = $by_id( $db->get( 'content', $variation_ids['B'] )[0]['choices'] ?? array() );
check( 'share_layers_config: a write from A stays in A\'s value', $updated && 34 == ( $choices_of_a[1]['extra_price'] ?? null ) && 10 == ( $choices_of_b[1]['extra_price'] ?? null ) && 10 == $global_choices( $global_id )[1]['extra_price'], wp_json_encode( array( $choices_of_a[1]['extra_price'] ?? null, $choices_of_b[1]['extra_price'] ?? null ) ) );

foreach ( $variation_ids as $variation_id ) wp_delete_post( $variation_id, true );
wp_delete_post( $parent_id, true );
wp_delete_post( $global_id, true );
mkl_pc_tests_done();
