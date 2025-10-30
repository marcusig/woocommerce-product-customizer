<?php
namespace MKL\PC;

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly
}

/**
 * Global Layers: CPT registration and CRUD helpers
 *
 * Stores shared layers and their content so multiple products can reference them.
 * Data metas:
 * - _mkl_pc_layer   (array)  Layer structure (name, image, settings...)
 * - _mkl_pc_content (array)  Layer choices/content structure
 */
class Global_Layers {

	/**
	 * Register hooks
	 */
	public static function init() {
		add_action( 'init', [ __CLASS__, 'register_cpt' ] );
	}

	/**
	 * Register the mkl_global_layer CPT
	 */
	public static function register_cpt() {
		$labels = array(
			'name' => 'Global Layers',
			'singular_name' => 'Global Layer',
		);
		$args = array(
			'labels' => $labels,
			'public' => false,
			'show_ui' => false,
			'show_in_menu' => false,
			'supports' => array( 'title', 'custom-fields' ),
			'capability_type' => 'post',
			'has_archive' => false,
			'rewrite' => false,
		);
		register_post_type( 'mkl_global_layer', $args );
	}

	/**
	 * Get a global layer by post ID
	 * @return array{layer: array|false, content: array|false}
	 */
	public static function get( $global_id ) {
		$global_id = intval( $global_id );
		if ( $global_id <= 0 ) return [ 'layer' => false, 'content' => false ];
		$layer = get_post_meta( $global_id, '_mkl_pc_layer', true );
		$content = get_post_meta( $global_id, '_mkl_pc_content', true );
		$layer = maybe_unserialize( $layer );
		$content = maybe_unserialize( $content );
		return [ 'layer' => $layer, 'content' => $content ];
	}

	/**
	 * Create or update a global layer
	 * @param array $layer   Layer structure
	 * @param array $content Content/choices structure for that layer
	 * @param int|null $global_id Existing post ID to update, or null to create
	 * @return int|WP_Error The post ID on success
	 */
	public static function save( $layer, $content, $global_id = null ) {
		$postarr = array(
			'post_type' => 'mkl_global_layer',
			'post_status' => 'publish',
			'post_title' => isset( $layer['name'] ) ? sanitize_text_field( $layer['name'] ) : 'Global Layer',
		);
		if ( $global_id ) {
			$postarr['ID'] = intval( $global_id );
			$global_id = wp_update_post( $postarr, true );
		} else {
			$global_id = wp_insert_post( $postarr, true );
		}
		if ( is_wp_error( $global_id ) ) return $global_id;
		update_post_meta( $global_id, '_mkl_pc_layer', $layer );
		update_post_meta( $global_id, '_mkl_pc_content', $content );
		return $global_id;
	}

	/**
	 * Delete a global layer
	 */
	public static function delete( $global_id ) {
		$global_id = intval( $global_id );
		if ( $global_id <= 0 ) return false;
		return (bool) wp_delete_post( $global_id, true );
	}

	/**
	 * List global layers (IDs and basic info)
	 */
	public static function list( $args = array() ) {
		$defaults = array(
			'post_type' => 'mkl_global_layer',
			'post_status' => 'publish',
			'posts_per_page' => -1,
			'fields' => 'ids',
		);
		$q = new \WP_Query( wp_parse_args( $args, $defaults ) );
		return $q->posts;
	}
}

Global_Layers::init();


