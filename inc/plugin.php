<?php 
namespace MKL\PC;

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly
}
class Plugin {
	/**
	 * @var Plugin
	 */
	public static $_instance = null;
	public $db = null;
	public $ajax = null;
	/**
	 * @var Extentions
	 */
	public $extentions = array();

	/**
	 * @return Plugin
	 */
	/**
	 * Throw error on object clone
	 *
	 * The whole idea of the singleton design pattern is that there is a single
	 * object therefore, we don't want the object to be cloned.
	 *
	 * @since 1.0.0
	 * @return void
	 */
	private function __clone() {
		// Cloning instances of the class is forbidden
		_doing_it_wrong( __FUNCTION__, __( 'No new class... Cheatin&#8217; huh?', MKL_PC_DOMAIN ), '1.0.0' );
	}

	/**
	 * Disable unserializing of the class
	 *
	 * @since 1.0.0
	 * @return void
	 */
	private function __wakeup() {
		// Unserializing instances of the class is forbidden
		_doing_it_wrong( __FUNCTION__, __( 'No serializing... Cheatin&#8217; huh?', MKL_PC_DOMAIN ), '1.0.0' );
	}

	public static function instance() {
		if ( self::$_instance == null ) {
			self::$_instance = new Plugin();
		}
		return static::$_instance;
	}

	private function _includes() {
		include( MKL_PC_INCLUDE_PATH . 'utils.php' );
		include( MKL_PC_INCLUDE_PATH . 'images.php' );
		include( MKL_PC_INCLUDE_PATH . 'functions.php' );
		
		include( MKL_PC_INCLUDE_PATH . 'base/product.php' );
		include( MKL_PC_INCLUDE_PATH . 'base/layer.php' );
		include( MKL_PC_INCLUDE_PATH . 'base/angle.php' );
		include( MKL_PC_INCLUDE_PATH . 'base/choice.php' );
		include( MKL_PC_INCLUDE_PATH . 'base/configuration.php' );

		include( MKL_PC_INCLUDE_PATH . 'db.php' );
		include( MKL_PC_INCLUDE_PATH . 'ajax.php' );

		include( MKL_PC_INCLUDE_PATH . 'frontend/frontend-woocommerce.php' );

		if( is_admin() ) {
			include ( MKL_PC_INCLUDE_PATH . 'admin/admin-woocommerce.php' );
		}
	}

	public function register_extention( $name, $class ) {
		if( ! isset( $this->extentions[$name]) ) {
			$this->extentions[$name] = $class; 
		}
	}

	public function get_extension( $name ) {
		if( ! isset( $this->extentions[$name]) ) {
			return false;
		}
		return $this->extentions[$name];
	}

	protected function __construct() {
		add_action('plugins_loaded', array( $this, 'init'), 10 );
	}

	public function init() {
		if ( ! version_compare( WC()->version, '3.0', '>=' ) ) {
			add_action( 'admin_notices', 'mkl_pc_fail_woocommerce_version' );
			return;
		}		
		// var_dump( 'self::instance()', self::instance() );
		$this->_includes();
		// $this->_hooks();
		$this->frontend = new Frontend_Woocommerce();
		if( is_admin() ) {
			$this->admin = new Admin_Woocommerce();
		}

		do_action( 'mkl_pc_is_loaded' );
		
		$this->db = new DB();
		$this->ajax = new Ajax();
	}
}

Plugin::instance();
// var_dump('$mkl_pl', $mkl_pl);
