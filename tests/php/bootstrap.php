<?php
/**
 * Boots the Local development site for an integration suite, in this PHP process
 *
 * The suites run against a real site (by default the Local site holding this repo, app/public), its
 * database and its active plugins, with the plugin as built in dist/. They create what they need and
 * delete it at the end; a suite that dies halfway can leave posts, orders or users behind.
 *
 * Environment:
 * - WP_ROOT      WordPress folder. Default: the site this repo sits in (../../../../public).
 * - WP_DB_HOST   Database host. Default: the Local site's MySQL socket, found in Local's sites.json.
 * - WP_TEST_HOST Host name for URLs. Default: the Local site's domain.
 *
 * Before requiring this file, a suite can define MKL_PC_TESTS_EXTRA_PLUGINS (plugin files) to load
 * plugins the site does not have active, for this process only.
 */

error_reporting( E_ALL & ~E_DEPRECATED );

$mkl_pc_tests_root = rtrim( getenv( 'WP_ROOT' ) ?: dirname( __DIR__, 4 ) . '/public', '/' ) . '/';
if ( ! is_file( $mkl_pc_tests_root . 'wp-config.php' ) ) {
	fwrite( STDERR, "No wp-config.php in $mkl_pc_tests_root. Set WP_ROOT.\n" );
	exit( 2 );
}

/**
 * The Local site holding a WordPress folder: id (its run folder) and domain
 *
 * @param string $wp_root
 * @return array|null
 */
function mkl_pc_tests_local_site( $wp_root ) {
	$home = getenv( 'HOME' );
	$sites = $home ? json_decode( (string) @file_get_contents( "$home/Library/Application Support/Local/sites.json" ), true ) : null;
	if ( ! is_array( $sites ) ) return null;
	$site_dir = realpath( dirname( $wp_root, 2 ) );
	foreach ( $sites as $id => $site ) {
		$path = isset( $site['path'] ) ? preg_replace( '#^~#', $home, $site['path'] ) : '';
		if ( $path && realpath( $path ) === $site_dir ) {
			return [ 'id' => $id, 'domain' => isset( $site['domain'] ) ? $site['domain'] : '' ];
		}
	}
	return null;
}

$mkl_pc_tests_site = mkl_pc_tests_local_site( $mkl_pc_tests_root );
$mkl_pc_tests_db_host = getenv( 'WP_DB_HOST' );
if ( ! $mkl_pc_tests_db_host && $mkl_pc_tests_site ) {
	$mkl_pc_tests_db_host = 'localhost:' . getenv( 'HOME' ) . '/Library/Application Support/Local/run/' . $mkl_pc_tests_site['id'] . '/mysql/mysqld.sock';
}
$mkl_pc_tests_host = getenv( 'WP_TEST_HOST' ) ?: ( $mkl_pc_tests_site ? $mkl_pc_tests_site['domain'] : 'localhost' );

$_SERVER['HTTP_HOST']      = $mkl_pc_tests_host;
$_SERVER['SERVER_NAME']    = $mkl_pc_tests_host;
$_SERVER['REQUEST_URI']    = '/';
$_SERVER['REQUEST_METHOD'] = 'GET';
$_SERVER['HTTPS']          = 'on';

// The site's wp-config.php, without loading WordPress yet, and with the database reachable from the CLI.
$mkl_pc_tests_config = file_get_contents( $mkl_pc_tests_root . 'wp-config.php' );
$mkl_pc_tests_config = preg_replace( '#^\s*require(_once)?\s*\(?\s*ABSPATH\s*\.\s*[\'"]wp-settings\.php[\'"]\s*\)?\s*;#m', '', $mkl_pc_tests_config );
if ( $mkl_pc_tests_db_host ) {
	$mkl_pc_tests_config = preg_replace( '#define\(\s*[\'"]DB_HOST[\'"]\s*,\s*[\'"][^\'"]*[\'"]\s*\)#', "define( 'DB_HOST', " . var_export( $mkl_pc_tests_db_host, true ) . ' )', $mkl_pc_tests_config );
}
$mkl_pc_tests_config_file = sys_get_temp_dir() . '/mkl-pc-tests-wp-config-' . md5( $mkl_pc_tests_root . $mkl_pc_tests_config ) . '.php';
if ( ! is_file( $mkl_pc_tests_config_file ) ) {
	file_put_contents( $mkl_pc_tests_config_file, $mkl_pc_tests_config );
	chmod( $mkl_pc_tests_config_file, 0600 );
}

if ( defined( 'MKL_PC_TESTS_EXTRA_PLUGINS' ) ) {
	// Before WordPress loads: the active plugins option is read while it boots.
	$wp_filter = [ 'option_active_plugins' => [ 10 => [ [
		'function'      => function( $plugins ) {
			return array_values( array_unique( array_merge( (array) $plugins, MKL_PC_TESTS_EXTRA_PLUGINS ) ) );
		},
		'accepted_args' => 1,
	] ] ] ];
}

define( 'ABSPATH', $mkl_pc_tests_root );
require $mkl_pc_tests_config_file;
require ABSPATH . 'wp-settings.php';

if ( ! function_exists( 'mkl_pc' ) ) {
	fwrite( STDERR, "Product Configurator is not active on this site.\n" );
	exit( 2 );
}

// Never send a real email: a suite that captures mail returns before this.
add_filter( 'pre_wp_mail', function( $return ) { return null === $return ? true : $return; }, 1000 );

// The suites expect the default settings, not the ones set up on the site. Their own filters (priority 10) win.
foreach ( [
	'quote_request_enabled'     => '',
	'quote_request_storage'     => 'email',
	'quote_request_image'       => 'attach',
	'quote_request_show_prices' => '',
	'quote_request_placement'   => 'alongside',
	'syd_quote_pdf'             => '',
	'syd_disable_totals_in_pdf' => '',
] as $mkl_pc_tests_setting => $mkl_pc_tests_value ) {
	add_filter( 'mkl/pc/setting/' . $mkl_pc_tests_setting, function() use ( $mkl_pc_tests_value ) { return $mkl_pc_tests_value; }, 5 );
}
// Rate limits count across runs for an hour: lifted, except where a suite sets its own (priority 20).
add_filter( 'mkl_pc_rate_limit_rule', function() { return [ 'max' => 100000, 'window' => HOUR_IN_SECONDS ]; }, 15 );
// The default request form.
add_filter( 'pre_option_mkl_pc_quote_request_fields', function() { return []; }, 5 );

/**
 * The demo products the suites configure: 613 (2D, "My watch"), 500 (3D)
 */
const MKL_PC_TEST_PRODUCT_2D = 613;
const MKL_PC_TEST_PRODUCT_3D = 500;
foreach ( [ MKL_PC_TEST_PRODUCT_2D, MKL_PC_TEST_PRODUCT_3D ] as $mkl_pc_tests_product ) {
	if ( ! wc_get_product( $mkl_pc_tests_product ) ) {
		echo "SKIP The demo product $mkl_pc_tests_product is not on this site.\n";
		exit( 0 );
	}
}

$failures = 0;

/**
 * @param string  $label
 * @param boolean $cond
 * @param string  $extra Shown after the label, to debug a failure.
 * @return void
 */
function check( $label, $cond, $extra = '' ) {
	global $failures;
	if ( ! $cond ) $failures++;
	echo ( $cond ? 'PASS ' : 'FAIL ' ), $label, '' !== (string) $extra ? " -- $extra" : '', "\n";
}

/**
 * End a suite: its summary, and an exit code the runner reads
 *
 * @return void
 */
function mkl_pc_tests_done() {
	global $failures;
	echo $failures ? "\n$failures FAILED\n" : "\nALL PASSED\n";
	exit( $failures ? 1 : 0 );
}

/**
 * Stop a suite that cannot run here, without failing the run
 *
 * @param string $reason
 * @return void
 */
function mkl_pc_tests_skip( $reason ) {
	echo "SKIP $reason\n";
	exit( 0 );
}
