<?php
namespace MKL\PC;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}


abstract class Configuration {

	public $ID                 = 0;

	// public $post                        = null;

	public $post_type          = 'mkl_pc_configuration';
	public $configuration_type = false;
	public $should_save_image  = true;
	public $upload_dir_path    = '';
	public $upload_dir_url     = '';
	public $image_name         = '';
	public $save_image_async   = false;
	private $post 	           = null;

	// public $configuration_date          = '';

	// public $modified_date               = '';

	// public $content               		= '';


	public function __construct( $ID = NULL ) {
		$wp_upload_dir = wp_upload_dir(); 
		$this->upload_dir_path = $wp_upload_dir['basedir'] .'/mkl-pc-config-images'; 
		$this->upload_dir_url = $wp_upload_dir['baseurl'] .'/mkl-pc-config-images'; 

		if( ! is_dir( $this->upload_dir_path ) ) {
			mkdir( $this->upload_dir_path ); 
		}
		
		if( null != $ID && intval( $ID ) ) {
			$this->ID = absint( intval( $ID ) );
			$this->post = get_post( $this->ID ); 
			if ( !$this->post ) return false;
		}
		// $default_args = array(
		// 	'customer_id' 	   => null,
		// 	'configuration_id' => 0,
		// 	'product'          => 0,
		// );	
		// $args = wp_parse_args( $args, $default_args );

	}

	public function get_the_post() {
		if( ! $this->post ) return false;
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
		$args       = wp_parse_args( $args, $default_args );
		// if no product_id, exit early
		if( $args['product_id'] == 0 )
			return false;

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
			if( $args['customer_id'] ) {
				$configuration_data['post_author']  = absint( $args['customer_id'] );
			}
		}

		// if we have a new content, update it
		if( isset( $args['content'] ) ) {
			$configuration_data['post_content'] = $args['content'];
			$this->content = json_decode( stripcslashes( $args['content'] ) );
		}

		if( isset( $args['title'] ) ) {
			$configuration_data['post_title'] = sanitize_text_field( $args['title'] );
		}
		// Checks if user has already saved this configuration
		if( $this->configuration_exists() ) {

			$attach_id = Utils::get_image_id( $this->upload_dir_url . '/' . $this->get_configuration_image_name() );
			
			$configurations = get_posts( array( 
				'posts_per_page' => 1,
				'post_status' 	 => $this->configuration_type,
				'post_type'      => $this->post_type,
				'post_author'    => get_current_user_id(),
				'meta_name'      => '_thumbnail_id',
				'meta_value'     => $attach_id,
			) );

			if( count( $configurations ) > 0 ) {
				return array( 'saved' => false, 'error' => __( 'You have already saved this configuration!', MKL_PC_DOMAIN ) );
			}
		}

		if ( $updating ) {
			$this->ID = wp_update_post( $configuration_data );
		} else {
			$this->ID = wp_insert_post( apply_filters( 'mkl_pc_new_configuration_data', $configuration_data ), true );
		}


		if ( is_wp_error( $this->ID ) ) {
			return array( 'saved' => false, 'error' => 'Could not save... ' . $this->ID );

		}

		if( $this->should_save_image && isset( $this->content ) ) {

			$this->image_path = $this->save_image( $this->content );

		}
		if( is_array( $this->image_path ) ) {
			$save_image = $this->image_path;
		} else {
			$save_image = false;
		}

		return array( 
			'saved' => true, 
			'message' => apply_filters( 'mkl_pc_configuration_saved_message_success', __( 'The configuration was saved successfully!', MKL_PC_DOMAIN ) ),
			'save_image_async' => $save_image,
		);

	}

	public function update( $args ) {

		if ( ! $args['configuration_id'] ) {
			return new WP_Error( __( 'Invalid configuration_id ID', MKL_PC_DOMAIN ) );
		}
		return $this->save( $args );
		
	}

	public function delete() {
		if( $this->ID && $this->post ) {
			$user_id = get_current_user_id();
			if( $this->post->post_type != $this->post_type ) {
				return false;
			}
			// $author_id = get_author
			if( current_user_can( 'delete_posts' ) || $this->post->post_author ===  $user_id ) {
				wp_delete_post( $this->ID );
				return true;
			}
		} 
		return false;
	}

	public function configuration_exists() {
		return file_exists( $this->upload_dir_path .'/'. $this->get_configuration_image_name() );
	}
	public function get_configuration_image_name() {
		if( $this->image_name != '' ) {
			return $this->image_name;
		}

		$image_file_name = 'product_'. $this->product_id . '-conf';
		foreach ($this->content as $layer) {
			$image_file_name .= '-'.$layer->image;
		}
		$image_file_name .= '.png'; 

		$this->image_name = $image_file_name;
		return $image_file_name;
	}

	public function save_image( $content, $transient = null ) {
		if( $content && is_null( $transient ) && $this->configuration_exists() ) {
			$attach_id = Utils::get_image_id( $this->upload_dir_url . '/' . $this->get_configuration_image_name() );
			if ( $attach_id ) set_post_thumbnail( $this->ID, $attach_id );
			return $attach_id;

		} else {
			// if is async and has no transient
			if( $this->save_image_async && is_null( $transient ) ) {
				// file name
				$image_file_name = $this->get_configuration_image_name();
				$images = array();
				// collect images
				foreach ($this->content as $layer) {
					$images[] = get_attached_file( $layer->image );
				}
				if( count( $images ) > 1 ) {
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

				} elseif( count( $images ) == 1 ) {
					// if there is only 1 image, no need to process
					$fimage = $images[0];
					$this->save_attachment( $fimage, $this->ID );
					return $fimage;

				} else {
					// if there is none
					return false;
				}
				// 
				
			} elseif( absint( $transient ) ) {
				// if we have a transient, get it
				$config = get_transient( '_temp_image_data_conf_'.absint( $transient ) );
				if( !isset( $config['image_file_name'] ) || !isset( $config['images'] ) )
					return false;

				$image_file_name = $config['image_file_name'];
				$this->image_name = $image_file_name;
				$images = $config['images'];
				
				if( $this->configuration_exists() ) return false;

			} else {
				$image_file_name = $this->get_configuration_image_name();
				$images = array();
				// collect images
				foreach ($this->content as $layer) {
					$images[] = get_attached_file( $layer->image );
				}
			}


			$this->image_manager = new Images(); 

			if( count( $images ) > 1 ) {
				$fimage = $this->image_manager->merge( $images, 'file', $this->upload_dir_path, $image_file_name ); 
			} elseif( count( $images ) == 1 ) {
				$fimage = $images[0];
			} else {
				return false;
			}

			$this->save_attachment( $fimage, $this->ID );
			// update_post_meta( $this->ID, $meta_key, $meta_value, $prev_value );
			return $fimage;

		}

		

	}

	public function save_attachment( $filename, $parent_post_id ) {

		$filetype = wp_check_filetype( basename( $filename ), null );

		$attachment = array(
			'guid'           => $this->upload_dir_url . '/' . basename( $filename ), 
			'post_mime_type' => $filetype['type'],
			'post_title'     => preg_replace( '/\.[^.]+$/', '', basename( $filename ) ),
			'post_content'   => '',
			'post_status'    => 'inherit'
		);

		// Insert the attachment.
		$attach_id = wp_insert_attachment( $attachment, $filename, $parent_post_id );

		// Make sure that this file is included, as wp_generate_attachment_metadata() depends on it.
		require_once( ABSPATH . 'wp-admin/includes/image.php' );

		// Generate the metadata for the attachment, and update the database record.
		$attach_data = wp_generate_attachment_metadata( $attach_id, $filename );
		wp_update_attachment_metadata( $attach_id, $attach_data );

		set_post_thumbnail( $parent_post_id, $attach_id );
		
	}


}