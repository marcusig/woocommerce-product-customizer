<?php 
namespace MKL\PC;

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly
}
/**
 * This is the main entry point to the plugin. Everything starts here.
 */
class Plugin {
	/**
	 * @var Plugin
	 */
	public static $_instance = null;
	public $db = null;
	public $ajax = null;
	public $languages = null;
	public $frontend = null;
	public $customizer = null;
	public $admin = null;
	public $settings = null;
	public $cache = null;
	public $themes = null;

	/**
	 * @var Extensions
	 */
	private $_extensions = array();

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
		_doing_it_wrong( __FUNCTION__, 'MKL\PC\Plugin should not be cloned...', '1.0.0' );
	}

	/**
	 * Disable unserializing of the class
	 *
	 * @since 1.0.0
	 * @return void
	 */
	public function __wakeup() {
		// Unserializing instances of the class is forbidden
		_doing_it_wrong( __FUNCTION__, 'MKL\PC\Plugin should not be serialized...', '1.0.0' );
	}

	/**
	 * Get the instance
	 *
	 * @return Plugin
	 */
	public static function instance() {
		if ( null === self::$_instance ) {
			self::$_instance = new self();
		}
		return self::$_instance;
	}

	/**
	 * Include all the required dependencies
	 *
	 * @return void
	 */
	private function _includes() {
		include_once MKL_PC_INCLUDE_PATH . 'utils.php';
		include_once MKL_PC_INCLUDE_PATH . 'languages.php';
		include_once MKL_PC_INCLUDE_PATH . 'images.php';
		include_once MKL_PC_INCLUDE_PATH . 'functions.php';
		include_once MKL_PC_INCLUDE_PATH . 'settings.php';
		
		include_once MKL_PC_INCLUDE_PATH . 'base/product.php';
		include_once MKL_PC_INCLUDE_PATH . 'base/layer.php';
		include_once MKL_PC_INCLUDE_PATH . 'base/angle.php';
		include_once MKL_PC_INCLUDE_PATH . 'base/choice.php';
		include_once MKL_PC_INCLUDE_PATH . 'base/configuration.php';

		include_once MKL_PC_INCLUDE_PATH . 'cache.php';
		include_once MKL_PC_INCLUDE_PATH . 'db.php';
		include_once MKL_PC_INCLUDE_PATH . 'themes.php';
		include_once MKL_PC_INCLUDE_PATH . 'ajax.php';
		include_once MKL_PC_INCLUDE_PATH . 'update.php';

		include_once MKL_PC_INCLUDE_PATH . 'frontend/frontend-woocommerce.php';
		include_once MKL_PC_INCLUDE_PATH . 'admin/customizer.php';
		include_once MKL_PC_INCLUDE_PATH . 'compatibility/compatibility-general.php';
		
		if( is_admin() ) {
			include_once MKL_PC_INCLUDE_PATH . 'admin/admin-woocommerce.php';
		}

	}

	/**
	 * Register an extension / addon
	 *
	 * @param string $name  - The addon name
	 * @param object $class - Addon instance
	 * @return void
	 */
	public function register_extension( $name, $class ) {
		if( ! isset( $this->_extensions[$name]) ) {
			$this->_extensions[$name] = $class; 
		}
	}

	/**
	 * Get an extension instance
	 *
	 * @param string $name
	 * @return object
	 */
	public function get_extension( $name ) {
		if( ! isset( $this->_extensions[$name]) ) {
			return false;
		}
		return $this->_extensions[$name];
	}

	/**
	 * Get all extensions
	 *
	 * @return array
	 */
	public function get_extensions() {
		return $this->_extensions;
	}

	/**
	 * Construct and setup hooks
	 */
	protected function __construct() {
	}

	/**
	 * Initialize the plugin
	 *
	 * @return void
	 */
	public function init() {
		if ( ! version_compare( WC()->version, '3.0', '>=' ) ) {
			add_action( 'admin_notices', 'mkl_pc_fail_woocommerce_version' );
			return;
		}
		// return;
		$this->_includes();
		$this->languages = new Languages();
		$this->frontend = new Frontend_Woocommerce();
		$this->customizer = new Customizer();
		
		if( is_admin() ) {
			$this->admin = new Admin_Woocommerce();
		}
		
		$this->settings = new Settings();
		$this->cache = new Cache();
		$this->db = new DB();
		$this->themes = new Themes();
		$this->ajax = new Ajax();

		do_action( 'mkl_pc_is_loaded' );
	}
}

// var_dump('$mkl_pl', $mkl_pl);
