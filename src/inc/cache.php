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
	}

	public function cache( $key, $data, $options = [] ) {
		
	}

	public function get_config_file_name( $product_id ) {
		return apply_filters('mkl_pc_config_file_name', 'product_configuration_' . $product_id . '.js');
	}

	public function get_config_file( $product_id, $generate_file = true ) {
		$location = $this->get_cache_location();
		$file_name = $this->get_config_file_name( $product_id );
		if ( file_exists( $location['path'] . '/' . $file_name ) ) {
			return $location['url'].'/'.$file_name;
		} elseif ( $generate_file ) {
			$this->save_config_file( $product_id );
		}
		if (file_exists($location['path'].'/'.$file_name)) return $location['url'].'/'.$file_name;
		return admin_url( 'admin-ajax.php?action=pc_get_data&data=init&view=js&fe=1&id=' . $product_id );
	}

	public function get_cache_location() {
		$upload_dir = wp_upload_dir();
		return apply_filters( 'mkl_pc_cache_dir', array(
			'path' => $upload_dir['basedir'] . '/mkl_product_configurations',
			'url' => $upload_dir['baseurl'] . '/mkl_product_configurations'
		));
	}

	public function save_config_file( $product_id ) {
		$config_data = Plugin::instance()->db->get_front_end_data( $product_id );
		$data =  'var PC = PC || {};'.PHP_EOL;
		$data .= 'PC.productData = ' . json_encode( $config_data ) . ';'.PHP_EOL;

		$location = $this->get_cache_location();
		$file_name = $this->get_config_file_name($product_id);
		if ( wp_mkdir_p( $location['path'] ) ) {
			$file_handle = @fopen( trailingslashit( $location['path'] ) . $file_name, 'w' );
			if ( $file_handle ) {
				fwrite( $file_handle, $data );
				fclose( $file_handle );
			}
		}
	}

	public function purge() {
		$location = $this->get_cache_location();
		$src = $location[ 'path' ];
		$handle = opendir($src);

		if (false === $handle) return;

		$file = readdir($handle);

		while (false !== $file) {

			if ('.' != $file && '..' != $file && is_file($src . '/' . $file)) {
				unlink($src . '/' . $file);
			}

			$file = readdir($handle);

		}		
	}
}