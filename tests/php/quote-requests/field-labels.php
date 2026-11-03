<?php
require dirname( __DIR__ ) . '/bootstrap.php';
// This suite saves the request form itself, and puts the site's back.
remove_all_filters( 'pre_option_mkl_pc_quote_request_fields' );
require_once MKL_PC_INCLUDE_PATH . 'quote-requests/admin/class-quote-fields-settings.php';
global $wpdb;
echo 'multilingual plugin: ', var_export( mkl_pc( 'languages' )->ml_plugin, true ), "\n";
add_filter( 'mkl_pc/quote_request/enabled', '__return_true' );
$quotes = mkl_pc( 'quotes' );

check( 'button label is a translatable setting', isset( mkl_pc( 'languages' )->get_translatable_options_defaults()['quote_request_button_label'] ) );

$raw_option = $wpdb->get_var( $wpdb->prepare( "SELECT option_value FROM {$wpdb->options} WHERE option_name = %s", 'mkl_pc_quote_request_fields' ) );
$registered = [];
add_action( 'wpml_register_single_string', function( $context, $name, $value ) use ( &$registered ) { $registered[] = [ $context, $name, $value ]; }, 10, 3 );
update_option( 'mkl_pc_quote_request_fields', [ 'phone' => [ 'label' => 'Phone number', 'enabled' => true ], 'email' => [ 'order' => 5 ] ] );
check( 'typed labels offered to WPML on save, defaults are not', [ [ 'Product Configurator quote request form', 'Field label: phone', 'Phone number' ] ] === $registered, wp_json_encode( $registered ) );

add_filter( 'wpml_translate_single_string', function( $value, $context, $name ) {
	return ( 'Product Configurator quote request form' === $context && 'Field label: phone' === $name ) ? 'Numéro de téléphone' : $value;
}, 10, 3 );
$all = $quotes->fields->get_all_fields();
check( 'typed label translated', 'Numéro de téléphone' === $all['phone']['label'], $all['phone']['label'] );
check( 'default label untouched', 'Email' === $all['email']['label'] );
add_filter( 'mkl_pc/quote_request/field_label', function( $t, $label, $id ) { return 'name' === $id ? 'X' : $t; }, 10, 3 );
check( 'other translation plugins can hook in', 'Numéro de téléphone' === $quotes->fields->get_all_fields()['phone']['label'] );

$quotes->enqueue_scripts();
$data = wp_scripts()->registered['mkl_pc/js/quote_request']->extra['data'] ?? '';
check( 'page labels sent with the script, translated', false !== strpos( $data, '"phone":"Numéro de téléphone"' ) || false !== strpos( $data, '"phone":"Num\u00e9ro de t\u00e9l\u00e9phone"' ), substr( $data, strpos( $data, '"labels"' ), 160 ) );

$settings = new MKL\PC\Quote_Fields_Settings( $quotes->fields );
ob_start(); $settings->render(); $list = ob_get_clean();
check( 'field list shows what was typed, not its translation', false !== strpos( $list, 'value="Phone number"' ) && false === strpos( $list, 'Numéro' ), preg_match( '#.{0,200}phone.{0,300}#s', $list, $m ) ? preg_replace( '/\s+/', ' ', $m[0] ) : 'no phone row' );

if ( null === $raw_option ) { delete_option( 'mkl_pc_quote_request_fields' ); } else { $wpdb->update( $wpdb->options, [ 'option_value' => $raw_option ], [ 'option_name' => 'mkl_pc_quote_request_fields' ] ); wp_cache_delete( 'mkl_pc_quote_request_fields', 'options' ); wp_cache_delete( 'alloptions', 'options' ); }
mkl_pc_tests_done();