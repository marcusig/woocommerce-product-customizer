<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly.
}

global $is_IE;
$class = 'media-modal wp-core-ui pc-modal';
$user_agent = isset( $_SERVER['HTTP_USER_AGENT'] ) ? wp_unslash( $_SERVER['HTTP_USER_AGENT'] ) : '';
if ( $is_IE && strpos( $user_agent, 'MSIE 7' ) !== false )
	$class .= ' ie7';
?>
<?php 
