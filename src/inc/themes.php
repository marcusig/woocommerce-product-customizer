<?php

namespace MKL\PC;

use WP_Error;

class Themes {

	/**
	 * The Themes
	 *
	 * @var array
	 */
	private $themes = array();

	/**
	 * Construct
	 */
	public function __construct() {}

	/**
	 * Register a theme
	 *
	 * @param string $theme_id - The theme slug
	 * @param string $location - The absolute path
	 * @return boolean|WP_Error
	 */
	public function register_theme( $theme_id, $location ) {
		if ( ! isset( $this->themes[$theme_id] ) && file_exists( $location ) ) {
			$is_theme_valid = $this->verify_theme( $theme_id, $location );
			if ( is_wp_error( $is_theme_valid ) ) return $is_theme_valid;
			$this->themes[$theme_id] = $location;
			return true;
		} else {
			if ( isset( $this->themes[$theme_id] ) ) return new WP_Error( 'theme-exists', sprintf( __( 'A theme called %s is already registered.', '' ), $theme_id ) );
			if ( ! file_exists( $location ) ) return new WP_Error( 'theme-missing', sprintf( __( 'The provided location for the theme "%s" does not exist: %s', '' ), $theme_id, $location ) );
		}
		return new WP_Error( 'theme-error', sprintf( __( 'The theme "%s" could not be registered for an unknowned reason.', '' ), "$theme_id ($location)" ) );
	}

	/**
	 * Get the installed themes
	 *
	 * @return array
	 */
	public function get_themes() {
		if ( empty( $this->themes ) ) {
			$dirs = glob( MKL_PC_INCLUDE_PATH . 'themes/*', GLOB_ONLYDIR );
		}
		$this->themes = array_combine( array_map( 'basename', $dirs ), $dirs );
		return apply_filters( 'mkl_pc_installed_themes', $this->themes );
	}

	/**
	 * Get a theme
	 *
	 * @param string $theme_id
	 * @return void
	 */
	public function get_theme( $theme_id ) {
		return isset( $this->themes[$theme_id] ) ? $this->themes[$theme_id] : false;
	}

	/**
	 * Verify a theme
	 *
	 * @param string $theme    - The theme's slug/id
	 * @param string $location - THe theme's location
	 * @return boolean|WP_Error
	 */
	public function verify_theme( $theme, $location ) {
		$errors = new WP_Error();
		// A theme must contain a file named style.css
		if ( ! file_exists ( trailingslashit( $location ) . 'style.css' ) ) $errors->add( 'error', sprintf( __( 'The file style.css is missing for the theme %s.', '' ), $theme ) );
		if ( $errors->has_errors() ) return $errors;
		return true;
	}

	/**
	 * Get a theme's information, as stored in the css file
	 *
	 * @param string $theme_location
	 * @return array
	 */
	public function get_theme_info( $theme_location ) {
		return get_file_data( trailingslashit( $theme_location ) . 'style.css', array(
			'Name'        => 'Theme Name',
			'Description' => 'Description',
			'Tags'        => 'Tags'
		), 'mkl_pc_theme' );
	}
}