# PHP integration suites

Plain PHP scripts that boot the Local development site this repo sits in (`app/public`), with its
database and active plugins, and check the plugin as built in `dist/`. One suite per file, each run in
its own PHP process. They are not part of the release: `gulp` only ships `src/`.

## Run

```bash
PHP_BIN="$HOME/Library/Application Support/Local/lightning-services/php-8.2.30+1/bin/darwin-arm64/bin/php" npm run test:php
```

One suite: `tests/php/run.sh quote-requests/pdf`. Use Local's PHP: the system one may lack the
extensions or the MySQL socket support. The site must be running in Local.

The suites test `dist/`. After a PHP-only change, sync it rather than building:
`rsync -a src/inc/ dist/inc/` (a running `gulp watch` does it too).

## What they assume

- **The Local site.** `bootstrap.php` finds its database socket and domain in Local's `sites.json`.
  Elsewhere, set `WP_ROOT`, `WP_DB_HOST` and `WP_TEST_HOST`.
- **The demo products** 613 (2D, "My watch") and 500 (3D). Without them the suites are skipped.
- **Default settings.** The bootstrap pins the quote request settings and the request form to their
  defaults (priority 5), whatever the site has; a suite sets what it tests with its own filters.
- **Optional plugins.** `pdf.php` needs Save your design with its quote PDF; `yith-accept.php` needs YITH
  Request a Quote Premium installed (it is loaded for that process only). Otherwise they are skipped.

No email leaves: `wp_mail` is short-circuited. Each suite deletes what it created, but one that dies
halfway can leave posts, orders or users behind (their names carry a random tag).

## Writing one

```php
<?php
require dirname( __DIR__ ) . '/bootstrap.php';

check( 'what is true', $condition, 'shown when it fails' );

mkl_pc_tests_done(); // Summary and exit code.
```

`mkl_pc_tests_skip( $reason )` stops a suite that cannot run on this site without failing the run.
