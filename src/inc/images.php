<?php 
namespace MKL\PC;

// require MKL_PC_PLUGIN_PATH . 'vendor/autoload.php';

use Intervention\Image\ImageManagerStatic as Image;

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly
}

class Images { 

	public $width = 0;
	public $height = 0;
	public $images = array();
	public function __construct(  ) {
		require MKL_PC_PLUGIN_PATH . 'vendor/autoload.php';
	}
	
	/**
	 * Merge a stack of images into one
	 *
	 * @param array        $images    Absolute paths of the images to composite, bottom first.
	 * @param string       $output    'file' to write the result, 'print' (or '') to stream it.
	 * @param string       $where     Directory to write to, for the 'file' output.
	 * @param string       $file_name File name to write, for the 'file' output.
	 * @param array|null   $size      { width, height } to scale the result down to. The result
	 *                                keeps its aspect ratio and is never enlarged. Null keeps
	 *                                the merged size.
	 * @return string|false|\WP_Error
	 */
	public function merge( $images, $output = '', $where = '', $file_name = '', $size = null ) {
		$the_image = null;
		foreach($images as $image) {
			if ( ! file_exists( $image ) ) continue;
			$image = apply_filters( 'mkl_pc_images_merge__single_image_src', $image );
			if ( ! $the_image ) {
				// The first image makes it
				$the_image = Image::make( $image );
			} else {
				// Add the following images
				$the_image->insert( $image, 'center-center' );
			}
		}

		if ( ! $the_image ) return false;

		if ( 'print' == $output || '' == $output ) {
			if ( null === $size && isset( $_REQUEST[ 'width' ] ) && isset( $_REQUEST[ 'height' ] ) ) { // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Optional resize dimensions for a generated image response.
				$size = array(
					'width'  => absint( wp_unslash( $_REQUEST['width'] ) ),
					'height' => absint( wp_unslash( $_REQUEST['height'] ) ),
				);
			}

			$this->resize( $the_image, $size );

			echo $the_image->response(); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- binary image response
			exit;

		} elseif ( 'file' === $output && is_dir( $where ) ) {

			// Check empty name before file_exists(): `$where . '/'` is the directory itself.
			if ( '' === $file_name ) {
				return new \WP_Error( 'file_name_empty', 'File name is empty' );
			}

			$file_path = trailingslashit( $where ) . $file_name;
			if ( is_file( $file_path ) ) {
				return $file_path;
			}

			$this->resize( $the_image, $size );

			$the_image->save( $file_path );
			return $file_path;

		} else {
			return ['else', false, is_dir($where), $where];
		}		
	}

	/**
	 * Scale a merged image down to the requested size, in place
	 *
	 * The aspect ratio is kept and the image is never enlarged, so a stack smaller than
	 * the requested size is left alone rather than blown up.
	 *
	 * @param \Intervention\Image\Image $image
	 * @param array|null                $size { width, height }
	 * @return void
	 */
	private function resize( $image, $size ) {
		if ( ! is_array( $size ) ) return;

		$width  = isset( $size['width'] ) ? absint( $size['width'] ) : 0;
		$height = isset( $size['height'] ) ? absint( $size['height'] ) : 0;

		if ( ! $width && ! $height ) return;

		$image->resize( $width ? $width : null, $height ? $height : null, function ( $constraint ) {
			$constraint->aspectRatio();
			$constraint->upsize();
		} );
	}

	public function getSize( $image ) {
		$size = getimagesize($image);
		if( $size ) {
			$this->width = $size[0];
			$this->height = $size[1];
		}
	}

	
}
