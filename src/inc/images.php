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
	
	public function merge( $images, $output = '', $where = '', $file_name = '' ) {
		$the_image = null;
		foreach($images as $image) {
			if ( ! file_exists( $image ) ) continue;
			$image = apply_filters( 'mkl_pc_images_merge__single_image_src', $image );
			if ( ! $the_image ) {
				// The first image makes it
				$the_image = Image::make( $image );
			} else {
				// Add the following images
				$the_image->insert( $image );
			}
		}

		if ( ! $the_image ) return false;

		if ( 'print' == $output || '' == $output ) {
			if ( isset( $_REQUEST[ 'width' ] ) && isset( $_REQUEST[ 'height' ] ) ) {

				$the_image->resize( intval( $_REQUEST[ 'width' ] ) ? intval( $_REQUEST[ 'width' ] ) : null , intval( $_REQUEST[ 'height' ] ) ? intval( $_REQUEST[ 'height' ] ) : null, function ( $constraint ) {
					$constraint->aspectRatio();
					$constraint->upsize();
				} );
			}

			echo $the_image->response();
			exit;

		} elseif ( 'file' === $output && is_dir( $where ) ) {

			if( file_exists( $where . '/' .$file_name ) )
				return 'file already exists';
			if( '' == $file_name )
				return 'file name is empty';

			$the_image->save($where . '/' .$file_name);
			return $where . '/' .$file_name;

		} else {
			return ['else', false, is_dir($where), $where];
		}		
	}

	public function getSize( $image ) {
		$size = getimagesize($image);
		if( $size ) {
			$this->width = $size[0];
			$this->height = $size[1];
		}
	}

	
}
