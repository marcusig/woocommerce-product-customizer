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

	public function get_config_file_name( $product_id ) {
		return apply_filters('mkl_pc_config_file_name', 'product_configuration_' . $product_id . '.js');
	}

	public function get_config_file( $product_id, $generate_file = true ) {
		$location = $this->get_cache_location();
		$file_name = $this->get_config_file_name( $product_id );
		$default_url = apply_filters( 'mkl_pc_default_config_url', admin_url( 'admin-ajax.php?action=pc_get_data&data=init&view=js&fe=1&id=' . $product_id ) );
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
		$file_name = $this->get_config_file_name($product_id);
		if ( wp_mkdir_p( $location['path'] ) ) {
			$file_handle = @fopen( trailingslashit( $location['path'] ) . $file_name, 'w' );
			if ( $file_handle ) {
				fwrite( $file_handle, $data );
				fclose( $file_handle );
			}
			return trailingslashit( $location['path'] ) . $file_name;
		}
		return '';
	}

	/**
	 * Delete a configuraiton file, given a product ID
	 *
	 * @param integer $product_id The product ID
	 */
	public function delete_config_file( $product_id ) {
		$location = $this->get_cache_location();
		$file_name = $this->get_config_file_name( $product_id );
		if ( file_exists( trailingslashit( $location['path'] ) . $file_name ) ) {
			unlink( trailingslashit( $location['path'] ) . $file_name );
		}
	}

	public function purge() {
		$location = $this->get_cache_location();
		$src = $location[ 'path' ];
		
		if ( ! file_exists( $src ) ) return;

		$handle = opendir($src);

		if (false === $handle) return;

		$file = readdir($handle);

		$allowed_file_extensions = [ 'js', 'css', 'map' ];

		while (false !== $file) {

			if ('.' != $file && '..' != $file && is_file($src . '/' . $file) && in_array( pathinfo( $file, PATHINFO_EXTENSION ), $allowed_file_extensions ) ) {
				unlink($src . '/' . $file);
			}

			$file = readdir($handle);

		}
	}

	/**
	 * Maybe regenerate the JS FILE if a 404 is encountered
	 */
	public function check_and_regenerate_js_file() {
		if ( is_404() ) {
			
			$request_uri = $_SERVER['REQUEST_URI'];
	
			// Check if the requested file is a missing JS file
			if ( strpos( $request_uri, 'wp-content/uploads/mkl_product_configurations/product_configuration_') !== false && strpos($request_uri, '.js') !== false ) {
				preg_match('/product_configuration_(\d+)\.js/', $request_uri, $matches);
				if ( $matches ) {
					$product_id = $matches[1];
					// $file_path = WP_CONTENT_DIR . "/uploads/mkl_product_configurations/product_configuration_{$product_id}.js";
	
					// Regenerate the JavaScript content
					$file_path = $this->save_config_file( $product_id );

					if ( ! $file_path || ! file_exists( $file_path ) ) return;
					
					$content = file_get_contents( $file_path );
	
					// Change the response code to 200 (OK) instead of 404
					status_header(200);
	
					// Set the correct Content-Type header for JavaScript
					header('Content-Type: application/javascript');
	
					// Output the regenerated content
					echo $content;
					exit;
				}
			}
		}
	}
	
}