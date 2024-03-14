<?php
namespace MKL\PC;

if ( ! defined( 'ABSPATH' ) ) return;

class Compatibility_General {
	public $compats_plugins = [];
	public $compats_themes = [];
	public function __construct() {
		$this->compats_themes[] = include_once 'theme-botiga.php';
		$this->compats_plugins[] = include_once 'yith-quote-request.php';
		$this->compats_plugins[] = include_once 'yith-catalogue-mode.php';

		add_action( 'after_setup_theme', [ $this, 'check_themes' ] );
		if ( did_action( 'plugins_loaded' ) ) {
			$this->check_plugins();
		} else {
			add_action( 'plugins_loaded', [ $this, 'check_plugins' ] );
		}
	}

	public function check_themes() {
		$this->check( $this->compats_themes );
	}

	public function check_plugins() {
		$this->check( $this->compats_plugins );
	}

	private function check( $items ) {
		foreach( $items as $compat ) {
			if ( $compat->should_run() ) {
				$compat->run();
			}
		}

	}
}

new Compatibility_General();