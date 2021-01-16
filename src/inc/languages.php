<?php
namespace MKL\PC;

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly
}

class Languages {
	public function __construct() {
		$this->_hooks();
	}

	private function _hooks() {
		add_filter( 'mkl_pc_choice_default_settings', [ $this, 'choice_settings' ] );
	}

	public function website_is_multilingual() {
		global $sitepress;
		if ( $sitepress && is_callable( [ $sitepress, 'get_active_languages' ] ) && $sitepress->get_active_languages() ) {
			$this->ml_plugin = 'wpml';
			return true;
		}
		// Check for polylang
		return false;
		// $sitepress->get_active_languages();
	}

	public function get_languages() {
		if ( $this->website_is_multilingual() && 'wpml' === $this->ml_plugin ) {
			global $sitepress;
			return $sitepress->get_active_languages();
		}
		return [];
	}

	public function choice_settings( $settings ) {
		return $settings;
	}
}