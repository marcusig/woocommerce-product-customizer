<?php 
global $is_IE;
$class = 'mkl-pc-admin-ui wp-core-ui pc-modal';
if ( $is_IE && strpos($_SERVER['HTTP_USER_AGENT'], 'MSIE 7') !== false )
	$class .= ' ie7';
?>
<?php 
