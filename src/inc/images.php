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
	 * @param array        $images    Absolute paths of the images to composite, bottom first. A
	 *                                masked image is { path, mask }, the mask's path an alpha
	 *                                PNG (docs/layer-masks-spec.md).
	 * @param string       $output    'file' to write the result, 'print' (or '') to stream it.
	 * @param string       $where     Directory to write to, for the 'file' output.
	 * @param string       $file_name File name to write, for the 'file' output.
	 * @param array|null   $size      { width, height } to scale the result down to. The result
	 *                                keeps its aspect ratio and is never enlarged. Null keeps
	 *                                the merged size.
	 * @return string|false|\WP_Error
	 */
	public function merge( $images, $output = '', $where = '', $file_name = '', $size = null ) {
		if ( ( 'print' == $output || '' == $output ) && null === $size && isset( $_REQUEST[ 'width' ] ) && isset( $_REQUEST[ 'height' ] ) ) { // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Optional resize dimensions for a generated image response.
			$size = array(
				'width'  => absint( wp_unslash( $_REQUEST['width'] ) ),
				'height' => absint( wp_unslash( $_REQUEST['height'] ) ),
			);
		}

		// With masks, every image is scaled to the output first: masking is a pass over every
		// pixel, and on GD that is affordable at the output's size, not at the full one.
		$scaled = false;
		if ( $this->has_masks( $images ) ) {
			$the_image = $this->merge_masked( $images, $size );
			$scaled = true;
		} else {
			$the_image = null;
			foreach($images as $image) {
				if ( is_array( $image ) ) $image = isset( $image['path'] ) ? $image['path'] : '';
				if ( ! $image || ! file_exists( $image ) ) continue;
				$image = apply_filters( 'mkl_pc_images_merge__single_image_src', $image );
				if ( ! $the_image ) {
					// The first image makes it
					$the_image = Image::make( $image );
				} else {
					// Add the following images
					$the_image->insert( $image, 'center-center' );
				}
			}
		}
		if ( ! $the_image ) return false;
		if ( 'print' == $output || '' == $output ) {
			if ( ! $scaled ) $this->resize( $the_image, $size );
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
			if ( ! $scaled ) $this->resize( $the_image, $size );
			$the_image->save( $file_path );
			return $file_path;
		} else {
			return ['else', false, is_dir($where), $where];
		}		
	}

	/**
	 * Whether a merge list holds a masked image.
	 *
	 * @param array $images
	 * @return bool
	 */
	private function has_masks( $images ) {
		foreach ( $images as $image ) {
			if ( is_array( $image ) && ! empty( $image['mask'] ) ) return true;
		}
		return false;
	}

	/**
	 * Merge a stack holding masked images, at the output size.
	 *
	 * The first image sets the canvas, as in the plain merge, and the scale: the one that fits
	 * it in $size without enlarging it, applied to every image (and mask) before compositing.
	 *
	 * @param array      $images
	 * @param array|null $size
	 * @return \Intervention\Image\Image|null
	 */
	private function merge_masked( $images, $size ) {
		$the_image = null;
		$scale = null;
		foreach ( $images as $item ) {
			$path = is_array( $item ) ? ( isset( $item['path'] ) ? $item['path'] : '' ) : $item;
			if ( ! $path || ! file_exists( $path ) ) continue;
			$path = apply_filters( 'mkl_pc_images_merge__single_image_src', $path );

			$layer = Image::make( $path );
			if ( null === $scale ) $scale = self::fit_scale( $layer->width(), $layer->height(), $size );
			if ( $scale < 1 ) {
				$layer->resize( max( 1, (int) round( $layer->width() * $scale ) ), max( 1, (int) round( $layer->height() * $scale ) ) );
			}

			if ( is_array( $item ) && ! empty( $item['mask'] ) ) {
				$this->apply_mask( $layer, $item['mask'], $scale );
			}

			if ( ! $the_image ) {
				$the_image = $layer;
			} else {
				$the_image->insert( $layer, 'center-center' );
			}
		}
		return $the_image;
	}

	/**
	 * The scale that fits an image in a size without enlarging it, as resize() does.
	 *
	 * @param int        $width
	 * @param int        $height
	 * @param array|null $size { width, height }; either may be 0 for "any".
	 * @return float 1 for no change.
	 */
	public static function fit_scale( $width, $height, $size ) {
		if ( ! is_array( $size ) || ! $width || ! $height ) return 1;
		$max_width  = isset( $size['width'] ) ? absint( $size['width'] ) : 0;
		$max_height = isset( $size['height'] ) ? absint( $size['height'] ) : 0;
		$scale = 1;
		if ( $max_width ) $scale = min( $scale, $max_width / $width );
		if ( $max_height ) $scale = min( $scale, $max_height / $height );
		return $scale;
	}

	/**
	 * Cut an image with a mask, in place: the image's alpha times the mask's.
	 *
	 * The mask is scaled like the image and centred on it at that size; a mask of the image's
	 * own size (the rule, which the admin checks) covers it exactly. Colour channels of the mask
	 * are ignored. A mask that cannot be read leaves the image as it is.
	 *
	 * @param \Intervention\Image\Image $image
	 * @param string                    $mask_path
	 * @param float                     $scale The scale the image was drawn at.
	 * @return bool Whether the image was masked.
	 */
	public function apply_mask( $image, $mask_path, $scale = 1 ) {
		try {
			$mask = Image::make( $mask_path );
		} catch ( \Exception $e ) {
			if ( function_exists( 'wc_get_logger' ) ) {
				wc_get_logger()->warning( 'MKL Product Configurator: the layer mask ' . $mask_path . ' could not be read, the image is merged unmasked.', array( 'source' => 'mkl-pc' ) );
			}
			return false;
		}

		if ( $scale < 1 ) {
			$mask->resize( max( 1, (int) round( $mask->width() * $scale ) ), max( 1, (int) round( $mask->height() * $scale ) ) );
		}
		if ( $mask->width() !== $image->width() || $mask->height() !== $image->height() ) {
			// Centred on a transparent canvas of the image's size: outside the mask is hidden.
			$canvas = Image::canvas( $image->width(), $image->height() );
			$canvas->insert( $mask, 'center' );
			$mask = $canvas;
		}

		$core = $image->getCore();
		$mask_core = $mask->getCore();

		if ( class_exists( 'Imagick' ) && $core instanceof \Imagick ) {
			$core->setImageAlphaChannel( \Imagick::ALPHACHANNEL_ACTIVATE );
			$mask_core->setImageAlphaChannel( \Imagick::ALPHACHANNEL_ACTIVATE );
			$core->compositeImage( $mask_core, \Imagick::COMPOSITE_DSTIN, 0, 0 );
			return true;
		}

		self::mask_gd( $core, $mask_core );
		return true;
	}

	/**
	 * The GD pass: one read of each pixel's alpha and one write where the mask is not opaque.
	 *
	 * GD alpha runs from 0 (opaque) to 127 (transparent). The kept opacity is the image's
	 * times the mask's: 127 - (127 - a) * (127 - m) / 127.
	 *
	 * Intervention's own mask() is not used: on GD it redraws every pixel through its colour
	 * objects, and rounds alpha to two decimals. Measured on PHP 8.5: 1.17 s at 3840x2160, 0.11 s
	 * at 1200x675 for this loop.
	 *
	 * @param \GdImage|resource $image Truecolor.
	 * @param \GdImage|resource $mask  Truecolor, the image's size.
	 * @return void
	 */
	public static function mask_gd( $image, $mask ) {
		$width = imagesx( $image );
		$height = imagesy( $image );
		imagealphablending( $image, false );
		imagesavealpha( $image, true );
		for ( $y = 0; $y < $height; $y++ ) {
			for ( $x = 0; $x < $width; $x++ ) {
				$m = ( imagecolorat( $mask, $x, $y ) >> 24 ) & 0x7F;
				if ( 0 === $m ) continue;
				$color = imagecolorat( $image, $x, $y );
				$a = ( $color >> 24 ) & 0x7F;
				if ( 127 === $a ) continue;
				$alpha = 127 - (int) round( ( 127 - $a ) * ( 127 - $m ) / 127 );
				imagesetpixel( $image, $x, $y, ( $alpha << 24 ) | ( $color & 0xFFFFFF ) );
			}
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
