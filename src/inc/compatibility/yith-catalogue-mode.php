<?php
namespace MKL\PC;

if ( ! defined( 'ABSPATH' ) ) return;

class Compat_Yith_Catalogue_mode {
	public function __construct() {}

	public function should_run() {
		if ( ! function_exists( 'YITH_WCTM' ) ) return false;
		$wctm = YITH_WCTM();
		return is_callable( [ $wctm, 'disable_shop' ] );
	}

	public function run() {
		add_filter( 'mkl_pc_js_config', [ $this, 'config' ] );
		add_filter( 'mkl_pc_configure_button', [ $this, 'maybe_hide_button' ] );
		add_action( 'mkl_pc/register_settings', array( $this, 'register_settings' ), 120, 1 );
		add_action( 'mkl_pc_scripts_product_page_after', [ $this, 'enqueue_scripts' ] );
		// add_action( 'mkl_pc_frontend_configurator_after_add_to_cart', [ $this, 'add_add_to_quote_button' ], 15 );
	}

	public function register_settings( $settings_class ) {
		add_settings_section(
			'pc_yith_catalogue', 
			__( 'YITH Catalogue Mode options', 'product-configurator-for-woocommerce' ), 
			function() {},
			'mlk_pc_settings'
		);

		add_settings_field(
			'yith_catalogue_pc_mode',
			__( 'Behaviour when the catalogue mode is enabled', 'product-configurator-for-woocommerce' ),
			[ $settings_class, 'callback_select' ],
			'mlk_pc_settings', 
			'pc_yith_catalogue',
			[ 
				'options' => [
					'hide' => __( 'Hide the configure button', 'product-configurator-for-woocommerce' ),
					'show' => __( 'Show the configure button and hide the add to cart button', 'product-configurator-for-woocommerce' ),
				],
				'default' => 'hide',
				'setting_name' => 'yith_catalogue_pc_mode'
			]
		);		
	}

	public function config( $config ) {
		$config['yith_catalogue'] = YITH_WCTM()->disable_shop();
		return $config;
	}

	public function maybe_hide_button( $button ) {
		if ( YITH_WCTM()->disable_shop() && 'hide' == mkl_pc( 'settings' )->get( 'yith_catalogue_pc_mode', 'hide' ) ) return '';
		return $button;
	}

	public function enqueue_scripts() {
		// List of dependencies
		$dependencies = [
			'jquery',
			'wp-util',
			'wp-hooks',
			'mkl_pc/js/views/configurator'
		];
		wp_enqueue_script( 
			'mkl_pc/yith-catalogue/js', 
			trailingslashit( plugin_dir_url( __FILE__ ) ) . 'assets/js/ytih-catalogue-mode.js', 
			$dependencies, 
			filemtime( trailingslashit( plugin_dir_path ( __FILE__ ) ) . 'assets/js/ytih-catalogue-mode.js' ), 
			true
		);
	}
}

return new Compat_Yith_Catalogue_mode();