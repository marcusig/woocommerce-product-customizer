<?php 
namespace MKL\PC;

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly
}

class Images { 

	public $width = 0;
	public $height = 0;
	public $images = array();
	public function __construct(  ) {

	}

	public function merge( $images, $output = '', $where = '', $file_name = '' ) {
		if( file_exists($images[0]) ) {
			$final_img = imagecreatefrompng( $images[0] );
			imagealphablending($final_img, true);
			imagesavealpha($final_img, true);

			if( $this->width == 0 || $this->height == 0 ) {

				$this->getSize( $images[0] );
			}
			unset($images[0]);
		}

		foreach($images as $image) {
			if( file_exists( $image ) ) {
				$new_image = imagecreatefrompng( $image );
				imagecopy($final_img, $new_image, 0, 0, 0, 0, $this->width, $this->height);
			}else {
				// echo ' file '.$image.'does not exit';
			}
		}
		if( $this->width == 0 || $this->height == 0 ) {
			return 'widh n h are 0';
		}


		if( 'print' == $output || '' == $output ) {

			ob_start();
			imagepng($final_img);
			$return_img = ob_get_contents(); // Capture the output
			ob_end_clean(); // Clear the output buffer


			header('Content-Type: image/png');
			echo $return_img;
			$this->clear(); 
			imagedestroy( $final_img );
			return true;


		} elseif( 'file' === $output && is_dir($where) ) {

			if( file_exists( $where . '/' .$file_name ) )
				return 'file already exists';
			if( '' == $file_name )
				return 'file name is empty';
			imagepng($final_img, $where . '/' .$file_name);
			$this->clear(); 
			imagedestroy( $final_img );
			return $where . '/' .$file_name;

		} else {
			return ['else', false, is_dir($where), $where];
		}

		


	} 

	private function clear() {
		foreach( $this->images as $image ) {
			imagedestroy( $image );
		}
	}

	// public function pngs2png( $ )

	public function getSize( $image ) {
		$size = getimagesize($image);
		if( $size ) {
			$this->width = $size[0];
			$this->height = $size[1];
		}
	}

	
}
