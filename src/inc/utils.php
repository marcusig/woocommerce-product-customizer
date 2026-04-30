<?php 
namespace MKL\PC;


if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly
}

if ( ! class_exists( 'MKL\PC\Utils' ) ) {

	class Utils { 

		/**
		 * Get an item in an array
		 *
		 * @param array  $array        - The array to search
		 * @param string $by           - The field to sort
		 * @param mixed  $search_value - The value to search
		 * @return mixed
		 */
		public static function get_array_item( $array, $by = 'order', $search_value = NULL ) { 
			// if there is several items in the array, we search for the one(s) we need

			if ( ! is_array( $array )  ) return $array;
			
			if ( count($array) ) {

				// get the first one, ordered by 'order'
				if ( 'order' == $by ) {
					usort( $array, array( 'Utils', 'filter_order' ) ); 
					return $array[0];
				// get the item with such id
				} else {
					$result = Utils::filter_by_value( $array, $by, $search_value );
					if ( $result ) {
						return $result[0];
					} else {
						return false;
					}
				}

			} else {
				return $array;
			}
		}

		/**
		 * Filter by order
		 *
		 * @param array $var1 - The first value to compare
		 * @param array $var2 - The second value to compare
		 * @return integer
		 */
		public static function filter_order( $var1, $var2 ) {
			return ( intval($var1['order']) < intval($var2['order']) ) ? -1 : 1;
		}

		/**
		 * Filter by value
		 *
		 * @param array   $array
		 * @param mixed   $index
		 * @param mixed   $value
		 * @param boolean $preserve_key
		 * @return array
		 */
		public static function filter_by_value ($array, $index, $value, $preserve_key = false){ 
			// maybe use wp_list_filter instead
			$newarray = [];

			if ( is_array($array) && count( $array ) > 0 ) { 

				foreach(array_keys($array) as $key) {
					$temp[$key] = $array[$key][$index];

					if ( $temp[$key] == $value ) {
						if ( $preserve_key ) {
							$newarray[$key] = $array[$key]; 
						} else {
							$newarray[] = $array[$key];
						}
					} 
				} 
			} else {
				return array();
			}

			return $newarray; 
		}

		/**
		 * Check if a product is configurable
		 *
		 * @param integer $product_id
		 * @return boolean
		 */
		public static function is_configurable( $product_id = NULL ) {
			if ( NULL == $product_id ) {
				// if $product_id wasn't given, find the current one
				$product_id = get_the_id();

				if ( NULL == $product_id || false == $product_id ) return false;
			} 
			// if $product_id doesn't match a product, exit
			if ( ! Utils::is_product( $product_id )  ) return false;

			$fetched_product = wc_get_product( $product_id );

			$configurable = $fetched_product->get_meta( MKL_PC_PREFIX.'_is_configurable' );

			// Check if the product type is registered
//			global $product;
			$product_types = apply_filters( 'mkl_pc_woocommerce_product_types', array( 'simple', 'variable', 'variation' ) );

			if ( ! in_array($fetched_product->get_type(), $product_types) ) {
				return false;
			}

			if ( $configurable === 'yes') return true;
			
			if ( $fetched_product->is_type( 'variation' ) ) {
				$all_variations_are_configurable = get_post_meta( $fetched_product->get_parent_id(), MKL_PC_PREFIX.'_all_variations_are_configurable', true );
				$configurable = get_post_meta( $fetched_product->get_parent_id(), MKL_PC_PREFIX.'_is_configurable', true );
				return $all_variations_are_configurable === 'yes' && $configurable === 'yes';
			}

			return false;
		}

		/**
		 * Check if post is a product
		 *
		 * @param integer $post_id
		 * @return boolean
		 */
		public static function is_product( $post_id = NULL ) {
			$supported_post_types = apply_filters( 'mkl_pc_product_post_types', [ 'product_variation', 'product' ] );
			if ( NULL !== $post_id ) {
				$post_type = get_post_type( $post_id );
			} else { //else we look for the current product
				$post_type = get_post_type();
			}
			return in_array( $post_type, $supported_post_types );
		}

		/**
		 * Retreives an attachment id from its URL
		 * credit: https://pippinsplugins.com/retrieve-attachment-id-from-image-url/
		 *
		 * @param string $image_url
		 * @return void
		 */
		public static function get_image_id ( $image_url ) {
			global $wpdb;
			$attachment = $wpdb->get_col( $wpdb->prepare( "SELECT ID FROM {$wpdb->posts} WHERE guid = %s", $image_url ) );
			return $attachment ? $attachment[0] : false;
		}

		/**
		 * Include a template file, and extracts some values
		 *
		 * @param string  $template_file          - The template to include (full path)
		 * @param boolean $return_instead_of_echo - Wether to echo or return
		 * @param array   $extract_these          - Variables to extract - will be available in the template
		 * @return void|string
		 */
		public static function include_template($template_file, $return_instead_of_echo = false, $extract_these = array()) {

			if ($return_instead_of_echo) ob_start();

			do_action('mkl_pc_before_template', $template_file, $return_instead_of_echo, $extract_these);

			if (!file_exists($template_file)) {
				error_log("MKL Product Configurator: template not found: ".$template_file);
				echo esc_html__( 'Error:', 'product-configurator-for-woocommerce' ) . ' ' . esc_html__( 'template not found', 'product-configurator-for-woocommerce' ) . ' (' . esc_html( $template_file ) . ')';
			} else {
				extract($extract_these, EXTR_SKIP);
				include $template_file;
			}

			do_action('mkl_pc_after_template', $template_file, $return_instead_of_echo, $extract_these);

			if ($return_instead_of_echo) return ob_get_clean();
		}

		/**
		 * Sanitize html classes
		 *
		 * @param string|array $classes
		 * @return string
		 */
		public static function sanitize_html_classes( $classes ) {
			if ( is_array( $classes ) ) return implode( ' ', array_filter( array_map( 'MKL\PC\Utils::sanitize_html_classes', $classes ) ) );
			$classes_array = explode( ' ', $classes );
			return implode( ' ', array_filter( array_map( 'sanitize_html_class', $classes_array ) ) );
		}

		/**
		 * Check if all requirements are available for the image compilation
		 *
		 * @return void
		 */
		public static function check_image_requirements() {
			if ( ! function_exists( 'finfo_buffer' ) ) {
				return false;
			}
			return true;
		}

		/**
		 * Get the dimensions of a registered image size
		 * 
		 *  Example usage:
		 *  $size_data = get_registered_image_size( 'medium' );
		 *  if ( $size_data ) {
		 *  	echo "Width: {$size_data['width']}px, Height: {$size_data['height']}px, Crop: " . ( $size_data['crop'] ? 'yes' : 'no' );
		 *  }
		 *
		 * @param string $size
		 * @return array|false
		 */
		public static function get_registered_image_size( $size ) {
			global $_wp_additional_image_sizes;

			// Handle core sizes first (thumbnail, medium, large)
			if ( in_array( $size, [ 'thumbnail', 'medium', 'large' ], true ) ) {
				return [
					'width'  => (int) get_option( "{$size}_size_w" ),
					'height' => (int) get_option( "{$size}_size_h" ),
					'crop'   => (bool) get_option( "{$size}_crop" ),
				];
			}

			// Handle custom sizes
			if ( isset( $_wp_additional_image_sizes[ $size ] ) ) {
				return [
					'width'  => (int) $_wp_additional_image_sizes[ $size ]['width'],
					'height' => (int) $_wp_additional_image_sizes[ $size ]['height'],
					'crop'   => $_wp_additional_image_sizes[ $size ]['crop'],
				];
			}

			// Not a registered size
			return false;
		}

		/**
		 * Allowlist for inline SVG output.
		 *
		 * @return array
		 */
		private static function allowed_svg_tags() {
			return [
				'svg' => [
					'xmlns' => true,
					'viewbox' => true,
					'width' => true,
					'height' => true,
					'fill' => true,
					'stroke' => true,
					'class' => true,
					'role' => true,
					'aria-hidden' => true,
					'focusable' => true,
				],
				'title' => [],
				'desc' => [],
				'g' => [
					'fill' => true,
					'stroke' => true,
					'class' => true,
					'transform' => true,
				],
				'path' => [
					'd' => true,
					'fill' => true,
					'stroke' => true,
					'stroke-width' => true,
					'stroke-linecap' => true,
					'stroke-linejoin' => true,
					'transform' => true,
				],
				'polyline' => [
					'points' => true,
					'fill' => true,
					'stroke' => true,
					'stroke-width' => true,
					'stroke-linecap' => true,
					'stroke-linejoin' => true,
					'transform' => true,
				],
				'polygon' => [
					'points' => true,
					'fill' => true,
					'stroke' => true,
					'stroke-width' => true,
					'transform' => true,
				],
				'circle' => [
					'cx' => true,
					'cy' => true,
					'r' => true,
					'fill' => true,
					'stroke' => true,
					'stroke-width' => true,
				],
				'rect' => [
					'x' => true,
					'y' => true,
					'width' => true,
					'height' => true,
					'rx' => true,
					'ry' => true,
					'fill' => true,
					'stroke' => true,
					'stroke-width' => true,
				],
				'line' => [
					'x1' => true,
					'x2' => true,
					'y1' => true,
					'y2' => true,
					'stroke' => true,
					'stroke-width' => true,
				],
			];
		}

		/**
		 * Allowlist for "basic HTML" labels (choice names, etc).
		 *
		 * @return array
		 */
		public static function allowed_basic_inline_html_tags() {
			return [
				'span' => [
					'class' => true,
				],
				'br' => [],
				'strong' => [],
				'em' => [],
				'b' => [],
				'i' => [],
				'small' => [],
			];
		}

		/**
		 * KSES helper for basic inline HTML.
		 *
		 * @param string $html Raw HTML.
		 * @return string
		 */
		public static function kses_basic_inline_html( $html ) {
			return wp_kses( (string) $html, self::allowed_basic_inline_html_tags() );
		}

		/**
		 * Read a file using WP_Filesystem (preferred over direct PHP filesystem calls).
		 *
		 * @param string $file_path Absolute path to the file.
		 * @return string|false File contents, or false on failure.
		 */
		public static function fs_get_contents( $file_path ) {
			if ( ! is_string( $file_path ) || '' === $file_path ) {
				return false;
			}

			if ( ! function_exists( 'WP_Filesystem' ) ) {
				require_once ABSPATH . 'wp-admin/includes/file.php';
			}

			global $wp_filesystem;
			if ( ! $wp_filesystem ) {
				WP_Filesystem();
			}

			if ( ! $wp_filesystem || ! is_object( $wp_filesystem ) ) {
				return false;
			}

			return $wp_filesystem->get_contents( $file_path );
		}

		/**
		 * Create a directory using WP_Filesystem.
		 *
		 * @param string $dir_path Absolute directory path.
		 * @param int    $chmod    Optional chmod.
		 * @return bool
		 */
		public static function fs_mkdir( $dir_path, $chmod = null ) {
			if ( ! is_string( $dir_path ) || '' === $dir_path ) {
				return false;
			}

			if ( ! function_exists( 'WP_Filesystem' ) ) {
				require_once ABSPATH . 'wp-admin/includes/file.php';
			}

			global $wp_filesystem;
			if ( ! $wp_filesystem ) {
				WP_Filesystem();
			}

			if ( ! $wp_filesystem || ! is_object( $wp_filesystem ) ) {
				return false;
			}

			return (bool) $wp_filesystem->mkdir( $dir_path, $chmod );
		}

		/**
		 * Write a file using WP_Filesystem.
		 *
		 * @param string $file_path Absolute file path.
		 * @param string $contents  File contents.
		 * @param int    $mode      Optional file mode (FS_CHMOD_FILE).
		 * @return bool
		 */
		public static function fs_put_contents( $file_path, $contents, $mode = null ) {
			if ( ! is_string( $file_path ) || '' === $file_path ) {
				return false;
			}

			if ( ! function_exists( 'WP_Filesystem' ) ) {
				require_once ABSPATH . 'wp-admin/includes/file.php';
			}

			global $wp_filesystem;
			if ( ! $wp_filesystem ) {
				WP_Filesystem();
			}

			if ( ! $wp_filesystem || ! is_object( $wp_filesystem ) ) {
				return false;
			}

			if ( null === $mode ) {
				$mode = defined( 'FS_CHMOD_FILE' ) ? FS_CHMOD_FILE : false;
			}

			return (bool) $wp_filesystem->put_contents( $file_path, (string) $contents, $mode );
		}

		/**
		 * Delete a file or directory using WP_Filesystem.
		 *
		 * @param string $path      Absolute path.
		 * @param bool   $recursive Whether to recurse into directories.
		 * @param string $type      'f' for file, 'd' for directory, or false for auto.
		 * @return bool
		 */
		public static function fs_delete( $path, $recursive = false, $type = false ) {
			if ( ! is_string( $path ) || '' === $path ) {
				return false;
			}

			if ( ! function_exists( 'WP_Filesystem' ) ) {
				require_once ABSPATH . 'wp-admin/includes/file.php';
			}

			global $wp_filesystem;
			if ( ! $wp_filesystem ) {
				WP_Filesystem();
			}

			if ( ! $wp_filesystem || ! is_object( $wp_filesystem ) ) {
				return false;
			}

			return (bool) $wp_filesystem->delete( $path, $recursive, $type );
		}

		/**
		 * List a directory using WP_Filesystem.
		 *
		 * @param string $dir_path Absolute directory path.
		 * @param bool   $recursive Whether to recurse.
		 * @return array|false
		 */
		public static function fs_dirlist( $dir_path, $recursive = false ) {
			if ( ! is_string( $dir_path ) || '' === $dir_path ) {
				return false;
			}

			if ( ! function_exists( 'WP_Filesystem' ) ) {
				require_once ABSPATH . 'wp-admin/includes/file.php';
			}

			global $wp_filesystem;
			if ( ! $wp_filesystem ) {
				WP_Filesystem();
			}

			if ( ! $wp_filesystem || ! is_object( $wp_filesystem ) ) {
				return false;
			}

			return $wp_filesystem->dirlist( $dir_path, $recursive );
		}

		/**
		 * Read an SVG file and return sanitized markup for inline output.
		 *
		 * @param string $file_path Absolute path to an SVG file.
		 * @return string Sanitized SVG markup, or empty string.
		 */
		public static function inline_svg( $file_path ) {
			if ( ! is_string( $file_path ) || '' === $file_path ) {
				return '';
			}

			$real = realpath( $file_path );
			if ( ! $real || ! is_readable( $real ) ) {
				return '';
			}

			if ( 'svg' !== strtolower( pathinfo( $real, PATHINFO_EXTENSION ) ) ) {
				return '';
			}

			$svg = self::fs_get_contents( $real );
			if ( false === $svg || '' === $svg ) {
				return '';
			}

			return wp_kses( $svg, self::allowed_svg_tags() );
		}
	}
}
