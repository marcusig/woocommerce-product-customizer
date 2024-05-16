<?php
namespace MKL\PC;

use WP_Error;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Configuration {

	public $ID                 = 0;

	// public $post                        = null;

	public $post_type          = 'mkl_pc_configuration';
	public $configuration_type = false;
	public $allow_duplicate    = false;
	public $should_save_image  = true;
	public $upload_dir_path    = '';
	public $upload_dir_url     = '';
	public $image_name         = '';
	public $save_image_async   = false;
	public $product_id;
	public $content            = null;
	public $image_path         = null;
	public $configuration_visibility = 'private';
	private $post 	           = null;

	// public $configuration_date          = '';

	// public $modified_date               = '';

	// public $content               		= '';


	public function __construct( $ID = NULL, $args = array() ) {

		$default_args = array(
			'product_id' => 0,
			'content'    => []
		);

		$args = wp_parse_args( $args, $default_args );

		$this->product_id = $args['product_id'];

		// if we have a new content, update it
		if ( ! empty( $args['content'] ) ) {
			$this->set_content( $args['content'] );
		}

		$wp_upload_dir = wp_upload_dir();
		$this->upload_dir_path = $wp_upload_dir['basedir'] .'/mkl-pc-config-images'; 
		$this->upload_dir_url = $wp_upload_dir['baseurl'] .'/mkl-pc-config-images'; 

		// Add an empty index to prevent directory listing if the server doesn't prevent it
		if ( ! file_exists( $this->upload_dir_path . '/index.html' ) ) {
			// Delete existing php file
			if ( file_exists( $this->upload_dir_path . '/index.php' ) ) unlink( $this->upload_dir_path . '/index.php' );
			$file_handle = @fopen( trailingslashit( $this->upload_dir_path ) . '/index.html', 'w' );
			if ( $file_handle ) {
				fclose( $file_handle );
			}
		}

		if ( ! is_dir( $this->upload_dir_path ) ) {
			mkdir( $this->upload_dir_path ); 
		}

		if ( null != $ID && intval( $ID ) ) {
			$this->ID = absint( $ID );
			$conf_post = get_post( $this->ID );

			if ( ! $conf_post ) return new WP_Error( '400', __( 'Configuration not found', 'product-configurator-for-woocommerce' ) );
			if ( 'private' === $this->get_visibility() && $conf_post->post_author != get_current_user_id() && ! current_user_can( 'manage_woocommerce' ) ) {
				return new WP_Error( '403', __( 'Unauthorized action, author issue', 'product-configurator-for-woocommerce' ) );
			}
			$this->post = $conf_post;
			if ( ! $this->configuration_type ) {
				$this->configuration_type = $conf_post->post_status;
			} elseif ( $this->configuration_type != $conf_post->post_status ) {
				return new WP_Error( '400', __( 'The configuration type does not match the requested item', 'product-configurator-for-woocommerce' ) );
			}
			// if ( ! $this->post ) return false;
		} else {
			$this->ID = 0;
		}
	}

	public function get_the_post() {
		if ( ! $this->post ) return false;
		return $this->post;
	}

	/*
	- customer_id = author_id
	- product_id = post_parent
	- configuration json = post_content / meta, depends on what happens to the content
	- config image (visual) = attacthment
	- config type = post_status -> saved config, shared config, Premade designs
	*/
	public function save( $args = array() ) {

		$default_args = array(
			'customer_id' 	   => null,
			'configuration_id' => 0,
			'product_id'       => 0,
		);
		$args = wp_parse_args( $args, $default_args );
		// if no product_id, exit early
		if ( 0 == $args['product_id'] ) return false;

		$this->product_id = $args['product_id'];

		$configuration_data = array();
		if ( $args['configuration_id'] > 0 ) {
			$updating         = true;
			$configuration_data['ID'] = $args['configuration_id'];
		} else {
			$updating                    		= false;
			$configuration_data['post_type']    = $this->post_type;
			$configuration_data['post_status']  = $this->configuration_type;
			$configuration_data['post_parent']  = absint( $args['product_id'] );
			if ( $args['customer_id'] ) {
				$configuration_data['post_author']  = absint( $args['customer_id'] );
			}
		}

		// if we have a new content, update it
		if ( isset( $args['content'] ) ) {
			$configuration_data['post_content'] = $args['content'];
			$this->set_content( $args['content'] );
		}

		if ( isset( $args['title'] ) ) {
			$configuration_data['post_title'] = sanitize_text_field( $args['title'] );
		}
		// Checks if user has already saved this configuration
		if ( ! $this->allow_duplicate && $this->configuration_image_exists() && ! $updating ) {

			$attach_id = $this->content_has_single_image( 'id' );
			if ( ! $attach_id ) {
				$attach_id = Utils::get_image_id( $this->upload_dir_url . '/' . $this->get_configuration_image_name() );
			}
			
			$configurations = get_posts( array( 
				'posts_per_page' => 1,
				'post_status' 	 => $this->configuration_type,
				'post_type'      => $this->post_type,
				'author'         => get_current_user_id(),
				'meta_name'      => '_thumbnail_id',
				'meta_value'     => $attach_id,
			) );

			if ( count( $configurations ) > 0 ) {
				foreach( $configurations as $configuration ) {
					if ( isset($args['content']) && $configuration->post_content === stripslashes($args['content']) ) {
						return array( 'saved' => false, 'error' => __( 'You have already saved this configuration!', 'product-configurator-for-woocommerce' ) );
					}
				}
			}
		}

		if ( $updating ) {
			$this->ID = wp_update_post( $configuration_data );
		} else {
			$this->ID = wp_insert_post( apply_filters( 'mkl_pc_new_configuration_data', $configuration_data ), true );
		}


		if ( is_wp_error( $this->ID ) ) {
			return array( 'saved' => false, 'error' => 'Could not save... ' . $this->ID->get_error_message() );

		}

		if ( $this->should_save_image && isset( $this->content ) ) {
			$this->image_path = $this->save_image( $this->content );
		}
		if ( is_array( $this->image_path ) ) {
			$save_image = $this->image_path;
		} else {
			$save_image = false;
		}

		return array( 
			'saved' => true, 
			'message' => apply_filters( 'mkl_pc_configuration_saved_message_success', __( 'The configuration was saved successfully!', 'product-configurator-for-woocommerce' ) ),
			'save_image_async' => $save_image,
			'config_id' => $this->ID
		);
	}

	/**
	 * Set the content
	 *
	 * @param string $content - A JSON object of the content
	 */
	public function set_content( $content ) {
		if ( isset( $this->content ) ) return;
		$this->content = json_decode( stripcslashes( $content ) );
	}

	public function update( $args ) {

		if ( ! $args['configuration_id'] ) {
			return new \WP_Error( __( 'Invalid configuration_id ID', 'product-configurator-for-woocommerce' ) );
		}
		return $this->save( $args );
		
	}

	public function delete() {
		if ( $this->ID && $this->post ) {
			$user_id = get_current_user_id();
			if ( $this->post->post_type != $this->post_type ) {
				return false;
			}
			// $author_id = get_author
			if ( current_user_can( 'delete_posts' ) || (int) $this->post->post_author === $user_id ) {
				wp_delete_post( $this->ID );
				return true;
			}
		} 
		return false;
	}

	public function configuration_exists() {
		if ( $this->content_has_single_image() ) return true;
		return file_exists( $this->upload_dir_path .'/'. $this->get_configuration_image_name() );
	}

	public function configuration_image_exists() {
		if ( $this->content_has_single_image() ) return true;
		return file_exists( $this->upload_dir_path .'/'. $this->get_configuration_image_name() );
	}

	/**
	 * Check whether the image exists for the given configuration
	 * 
	 * @param string $return The type returned (if not bool, the image url will be returned)
	 * @return bool|string
	 */
	public function content_has_single_image( $return = 'bool' ) {
		if ( ! property_exists( $this, 'content' ) || ! is_array( $this->content ) || empty( $this->content ) ) return false;
		$item = array_values( $this->content )[0];
		if ( 1 === count( $this->content ) && $image = wp_get_attachment_url( $item->image ) ) {
			return 'bool' == $return ? true : $item->image;
		}
		return false;
	}

	public function get_configuration_image_name() {
		if ( $this->image_name != '' ) {
			return $this->image_name;
		}

		$image_file_name = 'product_'. $this->product_id . '-conf';
		
		if ( empty( $this->content ) ) return '';

		foreach ($this->content as $layer) {
			$image_file_name .= '-'.$layer->image;
		}
		$image_file_name .= '.png'; 

		$this->image_name = $image_file_name;
		return $image_file_name;
	}

	/**
	 * Get the image
	 *
	 * @param string $size - The image size
	 * @param array  $attr - The image attributes
	 */
	public function get_image( $size = 'woocommerce_thumbnail', $attr = array(), $lazy = true ) {
		if ( $this->get_the_post() && $attachment = get_post_thumbnail_id( $this->get_the_post() ) ) {
			return wp_get_attachment_image( $attachment, $size, false, $attr );
		}

		if ( $single_image = $this->content_has_single_image( 'id' ) ) {
			return wp_get_attachment_image( $single_image, $size, false, $attr );
		}

		$url = $this->get_image_url( $lazy, $size );

		$attachment_id = false;

		if ( is_string( $url ) ) $attachment_id = Utils::get_image_id( $url );

		if ( $attachment_id ) {
			return wp_get_attachment_image( $attachment_id, $size, false, $attr );
		} else {

			if ( ! $url ) return '';

			if ( is_array( $url ) ) {
				$lazy_url = $url['lazy'];
				$url = $url['url'];
			}

			$size_class = $size;

			if ( is_array( $size_class ) ) {
				$size_class = join( 'x', $size_class );
			}

			$default_attr = array(
				'src'   => $url,
				'class' => "attachment-$size_class size-$size_class configuration-image",
				'alt'   => "",
			);

			// Add `loading` attribute.
			if ( function_exists( 'wp_lazy_loading_enabled' ) && wp_lazy_loading_enabled( 'img', 'wp_get_attachment_image' ) ) {
				$default_attr['loading'] = 'lazy';
			}

			if ( ! empty( $lazy_url ) ) {
				if ( ! file_exists( $this->upload_dir_path . '/' . $lazy_url ) ) return '';
				$default_attr['data-generate_image'] = $lazy_url;
				if ( $this->product_id ) $default_attr['data-product_id'] = $this->product_id;
			}

			$attr = wp_parse_args( $attr, $default_attr );

			// If the default value of `lazy` for the `loading` attribute is overridden
			// to omit the attribute for this image, ensure it is not included.
			if ( array_key_exists( 'loading', $attr ) && ! $attr['loading'] ) {
				unset( $attr['loading'] );
			}

			$attr = array_map( 'esc_attr', $attr );
			$html = rtrim( "<img" );
	
			foreach ( $attr as $name => $value ) {
				$html .= " $name=" . '"' . $value . '"';
			}
	
			$html .= ' />';

			return $html;
	
		}
	}

	/**
	 * @return array|string
	 */
	public function get_image_url( $lazy = false, $size = 'woocommerce_thumbnail' ) {
		
		if ( $this->configuration_image_exists() ) {

			if ( $single_image = $this->content_has_single_image( 'id' ) ) {
				return wp_get_attachment_image_url( $single_image, $size );
			}
			if ( ! $this->get_configuration_image_name() ) return '';
			return $this->upload_dir_url . '/' . $this->get_configuration_image_name();
		}

		$mode = mkl_pc( 'settings' )->get( 'save_images' );
		if ( 'save_to_disk' === $mode ) {
			if ( $lazy ) {
				$tempfile = $this->get_configuration_image_name() . '-temp-' . wp_create_nonce( 'generate-image-from-temp-file' );
				$file_handle = @fopen( trailingslashit( $this->upload_dir_path ) . $tempfile, 'w' );
				if ( $file_handle ) {
					fwrite( $file_handle, json_encode( $this->content ) );
					fclose( $file_handle );
				}				
				return [
					'lazy' => $tempfile,
					'url'  => apply_filters( 'mkl_pc_get_image_url_default_empty_image', includes_url( 'images/blank.gif' ) ),
				];
			} else {
				$image_id = $this->save_image( $this->content );
				return $image_id ? wp_get_attachment_image_url( $image_id, $size ) : '';
			}
				
		} else { // on_the_fly
			
			$images = array();

			if ( empty( $this->content ) ) return '';

			// collect images
			foreach ( $this->content as $layer ) {
				$images[] = $layer->image;
			}

			// No images, return an empty one
			if ( empty( $images ) ) return apply_filters( 'mkl_pc_get_image_url_default_empty_image', includes_url( 'images/blank.gif' ) );

			if ( in_array( $size, get_intermediate_image_sizes() ) ) {
				$size = $this->get_dimensions_from_size_name( $size );
			}

			if ( is_array( $size ) ) {
				// Add fallback dimensions, as 0x0 will generate a fatal error
				if ( 0 == $size['width'] && 0 == $size['width']) {
					$size['width'] = 251;
					$size['height'] = 251;
				}
				$size = "width=" . $size['width'] . "&height=" . $size['height'];
			} else {
				$size = '';
			}

			return get_rest_url() .'mkl_pc/v1/merge/'. $this->product_id . '/'. implode('-', $images) .'/' . ( $size ? '?' . $size : '' );
		}
	}

	public function get_dimensions_from_size_name( $size ) {
		global $_wp_additional_image_sizes;
		$dimensions = [];
		if ( in_array( $size, array( 'thumbnail', 'medium', 'medium_large', 'large' ) ) ) {
			$dimensions[ 'width' ] = get_option( $size . '_size_w' );
			$dimensions[ 'height' ] = get_option( $size . '_size_h' );
		} elseif ( isset( $_wp_additional_image_sizes[ $size ] ) ) {
			$dimensions[ 'width' ] = $_wp_additional_image_sizes[ $size ][ 'width' ];
			$dimensions[ 'height' ] = $_wp_additional_image_sizes[ $size ][ 'height' ];
		}
		return $dimensions;
	}
	/**
	 * Save image to the disk
	 *
	 * @param 
	 * @return integer - The image ID
	 */
	public function save_image( $content, $transient = null ) {

		$image_manager = $this->_get_image_manager();
		if ( is_string( $content ) ) {
			$content = sanitize_file_name( $content );
			$tempfile = trailingslashit( $this->upload_dir_path ) . $content;
			$real_path = realpath( $tempfile );
			if ( ( false === $real_path ) || ( false === strpos( $real_path, $this->upload_dir_path ) ) ) return 0;
			if ( ! file_exists( $tempfile ) ) return 0;
			$content = file_get_contents( $tempfile );
			if ( $content ) {
				$content = json_decode( $content );
				$this->content = $content;
			}

			unlink( $tempfile );
		}

		// The image already exists
		if ( $content && is_null( $transient ) && $this->configuration_exists() ) {
			$attach_id = $this->content_has_single_image( 'id' );
			if ( ! $attach_id ) {
				$attach_id = Utils::get_image_id( $this->upload_dir_url . '/' . $this->get_configuration_image_name() );
			}
			if ( $attach_id && $this->ID ) set_post_thumbnail( $this->ID, $attach_id );
			return $attach_id;
		} else {
			// if is async and has no transient
			if ( $this->save_image_async && is_null( $transient ) ) {
				// file name
				$image_file_name = $this->get_configuration_image_name();
				$images = array();
				// collect images
				foreach ($content as $layer) {
					$image = apply_filters( 'mkl-pc-serve-image-process-layer-image', get_attached_file( $layer->image ), $layer );
					$images[] = $image;
					
				}
				if ( count( $images ) > 1 ) {
					// if there are images to process
					$store_data = array(
						'image_file_name' => $image_file_name,
						'images' => $images,
						);
					set_transient( '_temp_image_data_conf_'.$this->ID, $store_data, HOUR_IN_SECONDS );
					// prepare return values 
					$save_image = array(
						'should_save' => true,
						'config_id'     => $this->ID,
					);

					return $save_image;

				} elseif ( count( $images ) == 1 ) {
					// if there is only 1 image, no need to process
					$fimage = $images[0];
					return $this->save_attachment( $fimage, $this->ID );
					// return $fimage;

				} else {
					// if there is none
					return false;
				}
				// 
				
			} elseif ( absint( $transient ) ) {
				// if we have a transient, get it
				$config = get_transient( '_temp_image_data_conf_'.absint( $transient ) );
				if ( !isset( $config['image_file_name'] ) || !isset( $config['images'] ) )
					return false;

				$image_file_name = $config['image_file_name'];
				$this->image_name = $image_file_name;
				$images = $config['images'];
				
				if ( $this->configuration_exists() ) return Utils::get_image_id( $this->upload_dir_url . '/' . $image_file_name );

			} else {
				$image_file_name = $this->get_configuration_image_name();
				$images = array();
				// collect images
				foreach ($content as $layer) {
					$image = apply_filters( 'mkl-pc-serve-image-process-layer-image', get_attached_file( $layer->image ), $layer );
					$images[] = $image;
				}
			}

			if ( count( $images ) > 1 && Utils::check_image_requirements() ) {
				$fimage = $image_manager->merge( $images, 'file', $this->upload_dir_path, $image_file_name ); 
			} elseif ( count( $images ) == 1 ) {
				$fimage = $images[0];
			} else {
				return false;
			}

			return $this->save_attachment( $fimage, $this->ID );

		}
	}

	public function serve_image() {
		$images = array();
		// collect images
		foreach ($this->content as $layer) {
			$image = apply_filters( 'mkl-pc-serve-image-process-layer-image', get_attached_file( $layer->image ), $layer );
			$images[] = $image;
		}

		if ( count( $images ) && $image_manager = $this->_get_image_manager() ) {
			$image_manager->merge( $images, 'print' );
		}
	}

	private function get_visibility() {
		return apply_filters( 'mkl_pc_configuration_visibility', $this->configuration_visibility, $this );
	}

	public function save_attachment( $filename, $parent_post_id ) {

		global $wpdb;
		$filetype = wp_check_filetype( basename( $filename ), null );

		$attachment = array(
			'guid'           => $this->upload_dir_url . '/' . basename( $filename ), 
			'post_mime_type' => $filetype['type'],
			'post_title'     => preg_replace( '/\.[^.]+$/', '', basename( $filename ) ),
			'post_content'   => '',
		);

		// Insert the attachment.
		$attach_id = wp_insert_attachment( $attachment, $filename, $parent_post_id );

		// Generate the metadata for the attachment, and update the database record.
		$attach_data = wp_generate_attachment_metadata( $attach_id, $filename );
		wp_update_attachment_metadata( $attach_id, $attach_data );

		if ( ! mkl_pc( 'settings' )->get( 'show_config_images_in_the_library', true ) ) {
			// Changing the post status prevents the image being listed in the library
			$wpdb->update( $wpdb->posts, array( 'post_status' => 'configuration' ), array( 'ID' => $attach_id ) );
		}

		if ( $parent_post_id ) set_post_thumbnail( $parent_post_id, $attach_id );

		return $attach_id;
	}

	private function _get_image_manager() {
		static $im;
		if ( ! $im && Utils::check_image_requirements() ) {
			require_once ABSPATH . 'wp-admin/includes/image.php';
			$im = new Images();
		}
		return $im;

	}

}