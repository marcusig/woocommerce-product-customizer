<?php
namespace MKL\PC;

if ( ! defined( 'ABSPATH' ) ) return;

class Compatibility_General {
	public $compats = [];
	public function __construct() {
		$compats[] = include_once 'yith-quote-request.php';
		foreach( $compats as $compat ) {
			if ( $compat->should_run() ) {
				$compat->run();
			}
		}
	}

}

new Compatibility_General();