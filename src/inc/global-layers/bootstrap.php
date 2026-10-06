<?php
/**
 * Global layers module bootstrap.
 *
 * Loads schema, CPT, linker, and the public CRUD class, then registers hooks.
 *
 * @package MKL\PC\Global_Layer
 */

namespace MKL\PC\Global_Layer;

defined( 'ABSPATH' ) || exit;

require_once __DIR__ . '/class-schema.php';
require_once __DIR__ . '/class-cpt.php';
require_once __DIR__ . '/class-linker.php';
require_once dirname( __DIR__ ) . '/global-layer.php';

Cpt::init();
\MKL\PC\Global_Layers::init();
