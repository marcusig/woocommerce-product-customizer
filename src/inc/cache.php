<?php

namespace MKL\PC;


/**
 * Cache functions.
 *
 *
 * @author   Marc Lacroix
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly
}

class Cache {
	public function __construct() {
		$this->_hooks();
	}

	private function _hooks() {
		add_action( 'woocommerce_settings_saved', array( $this, 'purge' ) );
		add_action( 'wpo_cache_flush', array( $this, 'purge' ) );
		add_action( 'litespeed_purged_all', array( $this, 'purge' ) );
		add_action( 'after_rocket_clean_domain', array( $this, 'purge' ) );
		add_action( 'template_redirect', array( $this, 'check_and_regenerate_js_file' ) );
	}

	public function cache( $key, $data, $options = [] ) {
		
	}

	public function get_config_file_name( $product_id, $format = 'js' ) {
		$format = in_array( $format, array( 'js', 'json' ), true ) ? $format : 'js';
		return apply_filters( 'mkl_pc_config_file_name', 'product_configuration_' . $product_id . '.' . $format, $product_id, $format );
	}

	/**
	 * Get the URL of a product's cached configuration file.
	 *
	 * @param int    $product_id
	 * @param bool   $generate_file
	 * @param string $format 'js' (executable `PC.productData.prod_X = ...` assignment, used by the
	 *                        default enqueued-script data mode) or 'json' (bare JSON body, used by
	 *                        the async_data frontend fetch path).
	 * @return string
	 */
	public function get_config_file( $product_id, $generate_file = true, $format = 'js' ) {
		$format = in_array( $format, array( 'js', 'json' ), true ) ? $format : 'js';
		$location = $this->get_cache_location();
		$file_name = $this->get_config_file_name( $product_id, $format );
		$default_url = $this->get_default_config_url( $product_id, $format );
		if ( current_user_can( 'edit_posts' ) || mkl_pc( 'settings' )->get( 'disable_caching' ) ) {
			return $default_url;
		}
		if ( file_exists( trailingslashit( $location['path'] ) . $file_name ) ) {
			return trailingslashit( $location['url'] ) . $file_name;
		} elseif ( $generate_file ) {
			$this->save_config_file( $product_id );
		}
		if ( file_exists( trailingslashit( $location['path'] ) . $file_name ) ) return trailingslashit( $location['url'] ) . $file_name;
		return $default_url;
	}

	/**
	 * Get the URL of a product's cached configuration file, without ever building it.
	 *
	 * Unlike get_config_file(), this does not fall back to the admin-ajax.php endpoint
	 * when the file happens to be missing. The URL it returns is printed into the page
	 * markup, which is itself page-cached, while purge() wipes every config file at the
	 * same moment the page cache is flushed ( wpo_cache_flush / litespeed_purged_all /
	 * after_rocket_clean_domain ) - so a fallback URL captured during one cold render
	 * would stay baked into the cached HTML long after the file came back, sending every
	 * visitor through an uncacheable admin-ajax request. Pointing at the static file
	 * unconditionally keeps the markup stable; a request that arrives before the file
	 * exists is rescued by check_and_regenerate_js_file().
	 *
	 * Logged-in editors and sites with caching disabled still get the direct endpoint:
	 * those responses are not shared through a page cache.
	 *
	 * @param int    $product_id
	 * @param string $format 'js' or 'json'. See get_config_file().
	 * @return string
	 */
	public function get_config_file_url( $product_id, $format = 'js' ) {
		$format = in_array( $format, array( 'js', 'json' ), true ) ? $format : 'js';
		if ( current_user_can( 'edit_posts' ) || mkl_pc( 'settings' )->get( 'disable_caching' ) ) {
			return $this->get_default_config_url( $product_id, $format );
		}
		$location = $this->get_cache_location();
		return trailingslashit( $location['url'] ) . $this->get_config_file_name( $product_id, $format );
	}

	/**
	 * The admin-ajax.php endpoint that serves the same payload as the cached file.
	 *
	 * @param int    $product_id
	 * @param string $format 'js' or 'json'.
	 * @return string
	 */
	protected function get_default_config_url( $product_id, $format = 'js' ) {
		$format = in_array( $format, array( 'js', 'json' ), true ) ? $format : 'js';
		$default_url = apply_filters( 'mkl_pc_default_config_url', admin_url( 'admin-ajax.php?action=pc_get_data&data=init&view=' . $format . '&fe=1&id=' . $product_id ), $product_id, $format );
		$product = wc_get_product( $product_id );
		if ( $product && 'publish' !== $product->get_status() && current_user_can( 'edit_post', $product_id ) ) {
			$default_url = add_query_arg( 'nonce', wp_create_nonce( 'update-pc-post_' . $product_id ), $default_url );
		}
		return $default_url;
	}

	public function get_cache_location() {
		$dir = 'mkl_product_configurations';
		if ( is_multisite() ) {
			$dir .= '/' . get_current_blog_id();
		}
		$upload_dir = wp_upload_dir();
		$url = trailingslashit( $upload_dir['baseurl'] ) . $dir;
		if ( is_ssl() && false === strpos( $url, 'https' ) ) {
			$url = str_replace( 'http://', 'https://', $url );
		}
		return apply_filters( 'mkl_pc_cache_dir', array(
			'path' => trailingslashit( $upload_dir['basedir'] ) . $dir,
			'url' => $url
		));
	}

	/**
	 * Save a configuration file
	 *
	 * @param int $product_id
	 * @param null|array $config_data
	 * @return string The file path when successful, empty otherwise
	 */
	public function save_config_file( $product_id, $config_data = null ) {
		if ( ! $config_data ) {
			$config_data = Plugin::instance()->db->escape( Plugin::instance()->db->get_front_end_data( $product_id ) );
			$config_data = apply_filters( 'mkl_pc_get_configurator_data', $config_data, $product_id );
		}	

		$json_data = json_encode( $config_data );
		// if the data is empty, return an empty string to use the ajax call instead
		if ( ! $json_data ) return '';
		$data =  'var PC = PC || {};'.PHP_EOL;
		$data .= 'PC.productData = PC.productData || {};'.PHP_EOL;
		$data .= 'PC.productData.prod_'.$product_id.' = ' . $json_data . ';'.PHP_EOL;

		/**
		 * Filter the product's configuration JavaScript object which will be used in the frontend
		 */
		apply_filters( 'mkl_pc_get_configurator_data_js_output', $data, $product_id, $config_data );

		$location = $this->get_cache_location();
		$dir = untrailingslashit( $location['path'] );
		if ( ! Utils::fs_mkdir( $dir ) ) {
			// Fallback to core helper for hosts where FS is not ready.
			wp_mkdir_p( $dir );
		}

		$file_path = trailingslashit( $location['path'] ) . $this->get_config_file_name( $product_id, 'js' );
		if ( ! Utils::fs_put_contents( $file_path, $data ) ) {
			return '';
		}

		// Bare-JSON sibling for the async_data frontend fetch path, which expects a
		// plain JSON body rather than the executable `PC.productData.prod_X = ...` assignment.
		$json_file_path = trailingslashit( $location['path'] ) . $this->get_config_file_name( $product_id, 'json' );
		Utils::fs_put_contents( $json_file_path, $json_data );

		return $file_path;
	}

	/**
	 * Delete a configuraiton file, given a product ID
	 *
	 * @param integer $product_id The product ID
	 */
	public function delete_config_file( $product_id ) {
		$location = $this->get_cache_location();
		foreach ( array( 'js', 'json' ) as $format ) {
			$file_name = $this->get_config_file_name( $product_id, $format );
			Utils::fs_delete( trailingslashit( $location['path'] ) . $file_name, false, 'f' );
		}
	}

	public function purge() {
		$location = $this->get_cache_location();
		$src = $location[ 'path' ];
		
		$allowed_file_extensions = [ 'js', 'css', 'map', 'json' ];
		$listing = Utils::fs_dirlist( $src, false );
		if ( ! is_array( $listing ) ) return;

		foreach ( $listing as $name => $info ) {
			if ( empty( $info['type'] ) || 'f' !== $info['type'] ) {
				continue;
			}
			$ext = pathinfo( $name, PATHINFO_EXTENSION );
			if ( in_array( $ext, $allowed_file_extensions, true ) ) {
				Utils::fs_delete( trailingslashit( $src ) . $name, false, 'f' );
			}
		}
	}

	/**
	 * Maybe regenerate a config file if a 404 is encountered.
	 *
	 * The product page points at the static config file unconditionally (see
	 * get_config_file_url()), so a request landing here is the normal way a purged file
	 * comes back: the <link rel="preload"> in <head> warms it during page load rather
	 * than making the shopper wait for it on the "Configure" click.
	 *
	 * Whether this runs at all depends on the server routing a miss under
	 * wp-content/uploads/ to index.php. It does on Apache with the stock WordPress
	 * .htaccess ( RewriteCond !-f ) and on nginx configs that end in
	 * `try_files $uri $uri/ /index.php` or forward 404s to WordPress; a vhost that
	 * serves static assets with `try_files $uri =404`, offloaded uploads, or a CDN
	 * negative-caching the 404 will never reach PHP. On those the file only comes back
	 * when the product is next saved, so the frontend still needs a fetch-failed
	 * fallback to the ajax endpoint.
	 */
	public function check_and_regenerate_js_file() {
		if ( ! is_404() ) {
			return;
		}

		$request_uri = isset( $_SERVER['REQUEST_URI'] ) ? sanitize_text_field( wp_unslash( $_SERVER['REQUEST_URI'] ) ) : '';

		// Check if the requested file is a missing JS or JSON config file. The directory
		// comes from get_cache_location() rather than a literal path so this keeps working
		// on multisite ( where it gains a /<blog_id> segment ) and behind the
		// mkl_pc_cache_dir filter.
		$location = $this->get_cache_location();
		$cache_path = wp_parse_url( $location['url'], PHP_URL_PATH );
		if ( ! $cache_path || false === strpos( $request_uri, trailingslashit( $cache_path ) . 'product_configuration_' ) ) {
			return;
		}
		if ( ! preg_match( '/product_configuration_(\\d+)\\.(js|json)(?:[?#]|$)/', $request_uri, $matches ) ) {
			return;
		}

		$product_id = absint( $matches[1] );
		$format     = $matches[2];

		// Rebuilding a payload is expensive and this path is unauthenticated, so refuse
		// anything that isn't a real configurable product - otherwise walking product IDs
		// ( product_configuration_1.json, _2.json, ... ) is enough to keep the site
		// rebuilding payloads. Leaving early lets the 404 stand, as it should.
		if ( ! $this->can_regenerate_config_file( $product_id ) ) {
			return;
		}

		$file_path = trailingslashit( $location['path'] ) . $this->get_config_file_name( $product_id, $format );

		if ( ! $this->build_config_file_locked( $product_id, $file_path ) ) {
			return;
		}

		$content = Utils::fs_get_contents( $file_path );
		if ( false === $content ) {
			return;
		}

		$this->serve_config_file( $content, $format );
	}

	/**
	 * Whether a 404'd config file request may trigger a rebuild.
	 *
	 * @param int $product_id
	 * @return bool
	 */
	protected function can_regenerate_config_file( $product_id ) {
		if ( ! $product_id ) {
			return false;
		}

		// The setting says not to serve cached files at all; honour it rather than
		// quietly writing one because a stale cached page asked for it.
		if ( mkl_pc( 'settings' )->get( 'disable_caching' ) ) {
			return false;
		}

		$product = wc_get_product( $product_id );
		if ( ! $product || 'publish' !== $product->get_status() ) {
			return false;
		}

		return Utils::is_configurable( $product_id );
	}

	/**
	 * Build a product's config files, letting only one request at a time do the work.
	 *
	 * purge() runs on wpo_cache_flush / litespeed_purged_all / after_rocket_clean_domain,
	 * so every config file disappears at the exact moment the page cache is emptied and
	 * traffic starts hitting PHP. Every product page preloads its JSON from <head>, so
	 * without a lock a burst of visitors after a flush becomes one full payload rebuild
	 * per concurrent request, all producing the same bytes.
	 *
	 * Requests that lose the race wait for the winner instead of starting their own
	 * rebuild, and give up rather than hold a PHP worker indefinitely - the 404 then
	 * stands and the configurator falls back to the ajax endpoint on click.
	 *
	 * @param int    $product_id
	 * @param string $file_path The file the caller wants to read back afterwards.
	 * @return bool Whether $file_path exists once this returns.
	 */
	protected function build_config_file_locked( $product_id, $file_path ) {
		$lock_key = 'mkl_pc_building_config_' . (int) $product_id;

		// Requests that piled up behind an earlier rebuild got their 404 from the web
		// server before the file existed, so they arrive here even though it does now.
		// Without this they each rebuild it again - which is most of the herd, since a
		// limited worker pool runs them one after another rather than truly in parallel.
		if ( $this->config_file_is_ready( $file_path ) ) {
			return true;
		}

		if ( get_transient( $lock_key ) ) {
			/**
			 * Filter how long, in seconds, a request waits for another request that is
			 * already rebuilding the same product's config file.
			 *
			 * @param float $seconds
			 * @param int   $product_id
			 */
			$max_wait = (float) apply_filters( 'mkl_pc_config_build_lock_wait', 5, $product_id );
			$step     = 250000; // 0.25s, in microseconds.
			$waited   = 0;

			while ( $waited < $max_wait * 1000000 ) {
				usleep( $step );
				$waited += $step;

				if ( $this->config_file_is_ready( $file_path ) ) {
					return true;
				}

				// The other request finished ( or died ) without producing the file.
				if ( ! get_transient( $lock_key ) ) {
					break;
				}
			}

			return $this->config_file_is_ready( $file_path );
		}

		set_transient( $lock_key, 1, 2 * MINUTE_IN_SECONDS );

		try {
			// Re-check now that the lock is held: the request that was building when the
			// get_transient() above ran may have finished in between.
			if ( $this->config_file_is_ready( $file_path ) ) {
				return true;
			}

			// save_config_file always writes the JS + JSON pair.
			$this->save_config_file( $product_id );
		} finally {
			delete_transient( $lock_key );
		}

		return $this->config_file_is_ready( $file_path );
	}

	/**
	 * Whether a config file is on disk, ignoring PHP's stat cache.
	 *
	 * @param string $file_path
	 * @return bool
	 */
	protected function config_file_is_ready( $file_path ) {
		clearstatcache( true, $file_path );
		return file_exists( $file_path ) && filesize( $file_path ) > 0;
	}

	/**
	 * Send a freshly rebuilt config file as the response to the request that 404'd.
	 *
	 * @param string $content
	 * @param string $format 'js' or 'json'.
	 */
	protected function serve_config_file( $content, $format ) {
		// Drop any output buffering another plugin started. This body has to be clean
		// JSON / JS - a page cache capturing it as a page, or a stray notice printed
		// ahead of it, makes the frontend fetch throw on parse.
		while ( ob_get_level() > 0 ) {
			if ( ! ob_end_clean() ) {
				break;
			}
		}

		// Change the response code to 200 (OK) instead of 404
		status_header( 200 );

		// Drop the no-cache headers a 404 response ( or a caching plugin ) may have
		// queued: this is a real asset, and without them the preload of a just-purged
		// file would be re-fetched on the click that follows it.
		header_remove( 'Cache-Control' );
		header_remove( 'Expires' );
		header_remove( 'Pragma' );

		// Set the correct Content-Type header
		header( 'json' === $format ? 'Content-Type: application/json' : 'Content-Type: application/javascript' );
		header( 'Content-Length: ' . strlen( $content ) );

		/**
		 * Filter the max-age sent with a rebuilt config file. Deliberately short: the
		 * URL carries no version string, so a purge cannot reach anything that cached
		 * it. Once this response has been sent the web server serves the file directly
		 * and applies its own headers, so this only covers the rebuild itself.
		 *
		 * @param int $max_age Seconds.
		 */
		$max_age = absint( apply_filters( 'mkl_pc_config_file_max_age', 5 * MINUTE_IN_SECONDS ) );
		header( 'Cache-Control: public, max-age=' . $max_age );

		// Output the regenerated content
		echo $content; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- JS/JSON response body
		exit;
	}

}