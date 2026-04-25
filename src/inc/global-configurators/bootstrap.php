<?php
/**
 * Global configurators module bootstrap.
 *
 * Registers the CPT, resolver, cache invalidator, WPML glue, and admin UI.
 *
 * @package MKL\PC\Global_Configurators
 */

namespace MKL\PC\Global_Configurators;

defined( 'ABSPATH' ) || exit;

require_once __DIR__ . '/class-schema.php';
require_once __DIR__ . '/class-storage-owner.php';
require_once __DIR__ . '/class-owner-resolver.php';
require_once __DIR__ . '/class-data-copier.php';
require_once __DIR__ . '/class-cpt.php';
require_once __DIR__ . '/class-cache-invalidator.php';
require_once __DIR__ . '/class-wpml.php';

Cpt::init();
Cache_Invalidator::init();
Wpml::init();

if ( is_admin() ) {
	require_once __DIR__ . '/class-admin-ui.php';
	Admin_Ui::init();
}
