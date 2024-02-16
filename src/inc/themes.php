<?php

namespace MKL\PC;

use WP_Error;

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly
}

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
		$this->get_themes();
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
			$this->themes = [
				'default' => MKL_PC_INCLUDE_PATH . 'themes/default',
				'float' => MKL_PC_INCLUDE_PATH . 'themes/float',
				'wsb' => MKL_PC_INCLUDE_PATH . 'themes/wsb',
				'la-pomme' => MKL_PC_INCLUDE_PATH . 'themes/la-pomme',
				'lebolide' => MKL_PC_INCLUDE_PATH . 'themes/lebolide',
				'clean' => MKL_PC_INCLUDE_PATH . 'themes/clean',
				'dark-mode' => MKL_PC_INCLUDE_PATH . 'themes/dark-mode',
				'h' => MKL_PC_INCLUDE_PATH . 'themes/h',
				'old-default' => MKL_PC_INCLUDE_PATH . 'themes/old-default',
			];
		}
		return apply_filters( 'mkl_pc_installed_themes', $this->themes );
	}

	/**
	 * Get a theme
	 *
	 * @param string $theme_id
	 * @return void
	 */
	public function get( $theme_id ) {
		if ( empty( $this->themes ) ) $this->get_themes();
		if ( ! isset( $this->themes[$theme_id] ) ) return false;
		$verified = $this->verify_theme( $theme_id, $this->themes[$theme_id] );
		return ! is_wp_error( $verified ) ? $this->themes[$theme_id] : false;
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
	 * @param string $theme
	 * @return array
	 */
	public function get_theme_info( $theme = false ) {
		static $themes = array();

		if ( ! $theme ) return $themes;
		if ( isset( $themes[$theme] ) ) return $themes[$theme];

		$theme_location = $this->get( $theme );
		if ( ! file_exists( trailingslashit( $theme_location ) . 'style.css' ) ) return false;
		$base_url = plugins_url( '', trailingslashit( $theme_location ) . 'style.css' );
		$themes[$theme] = array_merge(
			array(
				'id'       => $theme,
				'base_url' => trailingslashit( $base_url ),
				'img'      => file_exists( trailingslashit( $theme_location ) . 'preview.png' ) ? $base_url . '/preview.png' : '',
			),
			get_file_data( trailingslashit( $theme_location ) . 'style.css', array(
				'Name'        => 'Theme Name',
				'Description' => 'Description',
				'Tags'        => 'Tags',
				'Supports'    => 'Supports'
			), 'mkl_pc_theme' )
		);
		return $themes[$theme];
	}

	public function get_current_theme() {
		return mkl_pc( 'settings' )->get_theme();
	}

	public function current_theme_supports( $feature ) {
		$theme = $this->get_current_theme();
		// $supports = get_transient( 'mkl_pc_theme__' . $theme . '__supports__' . $feature );
		// if ( $supports ) return $supports;
		$theme_info = $this->get_theme_info( $theme );
		if ( ! isset( $theme_info['Supports'] ) ) return false;
		$supports = explode( ',', $theme_info['Supports'] );
		$supports = array_map( 'trim', $supports );
		return in_array( $feature, $supports );
	}
}