<?php
namespace MKL\PC;

if ( ! defined( 'ABSPATH' ) ) return;

class Compat_Theme_Botiga {
	public function __construct() {}

	public function should_run() {
		$theme = wp_get_theme();
		return 'botiga' === $theme->get_template();
	}

	public function run() {
		add_action( 'mkl_pc_scripts_product_page_after', [ $this, 'enqueue_scripts' ] );
	}

	public function enqueue_scripts() {
		wp_enqueue_style(
			'mkl_pc/botiga', 
			trailingslashit( plugin_dir_url( __FILE__ ) ) . 'assets/css/botiga-compat.css', 
			[], 
			filemtime( trailingslashit( plugin_dir_path ( __FILE__ ) ) . 'assets/css/botiga-compat.css' )
		);

		wp_add_inline_script( 'mkl_pc/js/views/configurator', "
		(function() {
			if ( 'undefined' == typeof wp.hooks ) return;
			wp.hooks.addAction( 'PC.fe.start', 'mkl_pc/botiga/compat', function() {
				if ( 'undefined' == typeof botiga || ! botiga.qtyButton || ! botiga.qtyButton.init ) return;
				botiga.qtyButton.init(); 
			} );
		})();
		", 'after' );
	}
}

return new Compat_Theme_Botiga();