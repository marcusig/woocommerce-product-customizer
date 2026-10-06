<?php
/**
 * Admin: chunked storage migration / legacy blob UI.
 *
 * @package MKL\PC\Admin\Data_Migration
 */

namespace MKL\PC\Admin\Data_Migration;

defined( 'ABSPATH' ) || exit;

require_once __DIR__ . '/class-legacy-blob-storage.php';
require_once __DIR__ . '/class-plugin.php';

Plugin::init();
