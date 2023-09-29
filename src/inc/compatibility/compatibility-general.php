<?php
namespace MKL\PC;

if ( ! defined( 'ABSPATH' ) ) return;

class Compatibility_General {
	public $compats = [];
	public function __construct() {
		$compats[] = include_once 'yith-quote-request.php';
		$compats[] = include_once 'yith-catalogue-mode.php';
		$compats[] = include_once 'WCPBC-price-based-on-country.php';
		foreach( $compats as $compat ) {
			if ( $compat->should_run() ) {
				$compat->run();
			}
		}
	}

}

new Compatibility_General();