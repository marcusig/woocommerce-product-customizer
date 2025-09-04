<?php
namespace MKL\PC;

use WP_Post;

if (!defined('ABSPATH')) die('No direct access.');
class Admin_Product_3D {

	public function __construct() {
        add_filter( 'script_loader_tag', [ $this, 'module_script_type' ], 10, 3 );
        add_filter( 'upload_mimes', function( $mimes ) {
            if ( current_user_can( 'manage_options' ) || current_user_can( 'manage_woocommerce' ) ) {
                // Add GLTF (JSON-based format)
                $mimes['gltf'] = 'model/gltf+json';
                // Add GLB (binary format)
                $mimes['glb']  = 'model/gltf-binary';
                $mimes['bin']  = 'application/octet-stream';
                $mimes['zip'] = 'application/zip';
            }
            return $mimes;
        });

        // Fix MIME type check for GLB/GLTF
        add_filter( 'wp_check_filetype_and_ext', function( $data, $file, $filename, $mimes ) {
            $ext = pathinfo( $filename, PATHINFO_EXTENSION );
            if ( current_user_can( 'manage_options' ) || current_user_can( 'manage_woocommerce' ) ) {
                if ( 'glb' === strtolower( $ext ) ) {
                    $data['ext']  = 'glb';
                    $data['type'] = 'model/gltf-binary';
                    $data['proper_filename'] = $filename;
                }

                if ( 'gltf' === strtolower( $ext ) ) {
                    $data['ext']  = 'gltf';
                    $data['type'] = 'model/gltf+json';
                    $data['proper_filename'] = $filename;
                }
                if ( 'bin' === $ext ) {
                    $data['ext']  = 'bin';
                    $data['type'] = 'application/octet-stream';
                    $data['proper_filename'] = $filename;
                }
            }
            return $data;
        }, 10, 4 );        

        add_filter('upload_dir', function ($dirs) {
            // Only intercept when our custom context is present
            if (isset($_REQUEST['context']) && $_REQUEST['context'] === 'configurator_assets') {
                $subdir = "/configurator_assets/3D";
                $dirs['subdir'] = $subdir;
                $dirs['path']   = $dirs['basedir'] . $subdir;
                $dirs['url']    = $dirs['baseurl'] . $subdir;
            }
            return $dirs;
        });
        
		// 2. When a ZIP is uploaded, unzip it into our folder.
        add_action( 'add_attachment', function( $attachment_id ) {
            $file = get_attached_file( $attachment_id );

            if ( strtolower( pathinfo( $file, PATHINFO_EXTENSION ) ) !== 'zip' ) {
                return; // Not a zip, ignore.
            }

            $upload_dir = wp_upload_dir();
            $target_dir = trailingslashit( $upload_dir['basedir'] ) . "configurator_assets/zips/$attachment_id/";

            // Clean old extracted version (if exists)
            if ( file_exists( $target_dir ) ) {
                global $wp_filesystem;
                if ( empty( $wp_filesystem ) ) {
                    require_once ABSPATH . 'wp-admin/includes/file.php';
                    WP_Filesystem();
                }
                $wp_filesystem->delete( $target_dir, true );
            }

            // Make folder
            wp_mkdir_p( $target_dir );

            // Unzip
            require_once ABSPATH . 'wp-admin/includes/file.php';
            require_once ABSPATH . 'wp-admin/includes/class-wp-filesystem-base.php';
            require_once ABSPATH . 'wp-admin/includes/class-wp-filesystem-direct.php';

            $result = unzip_file( $file, $target_dir );

            if ( is_wp_error( $result ) ) {
                error_log( "Unzip failed for attachment $attachment_id: " . $result->get_error_message() );
                return;
            }

            // Try to detect main file (GLB or GLTF)
            $main_file = '';
            $rii = new \RecursiveIteratorIterator( new \RecursiveDirectoryIterator($target_dir) );
            foreach ($rii as $item) {
                if ($item->isFile()) {
                    $ext = strtolower( $item->getExtension() );
                    if ( in_array( $ext, ['glb','gltf'] ) ) {
                        $main_file = str_replace( $target_dir, '', $item->getPathname() );
                        break;
                    }
                }
            }

            if ( $main_file ) {
                update_post_meta( $attachment_id, '_configurator_entry_file', $main_file );
            }
        });

        /**
         * Add the gltf file to the response
         */
        add_filter( 'wp_prepare_attachment_for_js', function( $response, WP_Post $attachment, $meta ) {
            if ( $response['mime'] === 'application/zip' ) {
                // Suppose you extract the zip contents to /uploads/product-configurator/{post_id}/
                // $extracted_dir = wp_upload_dir()['baseurl'] . '/product-configurator/' . $attachment->ID . '/';

                // Try to find the main .gltf file (or store this info when unzipping)
                $gltf_file = $this->pc_get_configurator_entry_url( $attachment->ID );
                if ( $gltf_file ) {
                    $response['gltf_filename'] = basename( $gltf_file );
                    $response['gltf_url'] = $gltf_file;
                }
            }
            return $response;
        }, 10, 3 );
    }
    
    // 3. Helper: Get entry URL from a ZIP attachment
    public function pc_get_configurator_entry_url( $attachment_id ) {
        $upload_dir = wp_upload_dir();
        $entry_file = get_post_meta( $attachment_id, '_configurator_entry_file', true );

        if ( ! $entry_file ) {
            return false;
        }

        return trailingslashit( $upload_dir['baseurl'] ) . "configurator_assets/zips/$attachment_id/" . $entry_file;
    }

    /**
     * Add type="module" to specific scripts.
     */
    function module_script_type( $tag, $handle, $src ) {
        $module_handles = [ 'mkl_pc/js/admin/backbone/views/3d-settings', 'my-admin-3d' ];

        if ( in_array( $handle, $module_handles, true ) ) {
            return '<script type="module" src="' . esc_url( $src ) . '"></script>';
        }

        return $tag;
    }

}