<?php
namespace MKL\PC;
/**
 * Admin functions
 *
 *
 * @author   Marc Lacroix
 */


if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly
}

class Admin_Woocommerce { 

	public $plugin = NULL;
	public $_product = NULL;
	public $ID = NULL;
	public $admin = NULL;
	public $customizer;
	public $order;
	public $product;
	public $settings;
	public $choice_settings;
	public $layer_settings;
	public $angle_settings;
	public function __construct() {
		$this->_includes();
		$this->customizer = new Customizer();
		$this->order = new Admin_Order();
		$this->product = new Admin_Product();
		$this->settings = new Admin_Settings();
		$this->choice_settings = new Choice_Settings();
		$this->layer_settings = new Layer_Settings();
		$this->angle_settings = new Angle_Settings();

		add_action( 'admin_enqueue_scripts', [ $this, 'admin_enqueue_scripts' ] );
		add_filter( 'udmupdater_you_are_connected', [ $this, 'updater_message' ], 20, 3 );
	}

	/**
	 * Include dependencies
	 *
	 * @return void
	 */
	private function _includes() {
		include( MKL_PC_INCLUDE_PATH . 'admin/customizer.php' );
		include( MKL_PC_INCLUDE_PATH . 'admin/settings-page.php' );
		include( MKL_PC_INCLUDE_PATH . 'admin/settings/choice.php' );
		include( MKL_PC_INCLUDE_PATH . 'admin/settings/layer.php' );
		include( MKL_PC_INCLUDE_PATH . 'admin/settings/angle.php' );
		include( MKL_PC_INCLUDE_PATH . 'admin/product.php' );
		include( MKL_PC_INCLUDE_PATH . 'admin/order.php' );
	}

	/**
	 * Get a template part
	 *
	 * @param string  $file_path - The file to include
	 * @param array   $view_data - The data to extract
	 * @return string
	 */
	public function get_template_part( $file_path, $view_data = null ) {
		if ( ! file_exists( $file_path ) ) return '';
		if ( $view_data ) extract( $view_data, EXTR_SKIP );
		ob_start();
		include $file_path;
		$template = ob_get_contents();
		ob_end_clean();

		return $template;			
	}

	public function admin_enqueue_scripts() {

		global $pagenow;

		/**
		 * Enqueue styles and scripts for plugins and update screen
		 */
		if ( 'plugins.php' == $pagenow || 'update-core.php' == $pagenow ) {
			wp_enqueue_style( 'mlk_pc/admin/updates', MKL_PC_ASSETS_URL.'admin/css/updates.css' , [], filemtime( MKL_PC_ASSETS_PATH . 'admin/css/updates.css' ) );
		}

		/**
		 * Add styles for the addify quotes admin
		 */
		wp_add_inline_style( 'afrfq-adminc', '
			.addify_quote_items span.choice-thumb {
				max-width: 50px;
				display: inline-block;
			}
			
			.addify_quote_items span.choice-thumb img {
				max-width: 100%;
			}
		' );
	}

	/**
	 * Add expiry indication to connected message
	 *
	 * @param string $message
	 * @param array  $plugin_data
	 * @param string $slug
	 * @return string
	 */
	public function updater_message( $message, $plugin_data, $slug ) {

		if ( false === strpos( $slug, 'mkl-pc' ) ) return $message;

		$op = get_option( 'external_updates-' . $slug );

		if ( $op && is_object( $op ) && isset( $op->update, $op->update->extraProperties, $op->update->extraProperties['x-spm-expiry'] ) ) {
			if ( 'expired' === $op->update->extraProperties['x-spm-expiry'] ) {
				$message = '<span class="mkl-license-expired">License expired</span> ' . $message;
			}
			if ( 'soon' === $op->update->extraProperties['x-spm-expiry'] ) {
				$message = '<span class="mkl-license-expire-soon">License will expire soon</span> ' . $message;
			}
		}
		return $message;
	}

}
