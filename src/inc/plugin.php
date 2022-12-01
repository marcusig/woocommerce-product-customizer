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
		include_once MKL_PC_INCLUDE_PATH . 'base/angle.php';
		include_once MKL_PC_INCLUDE_PATH . 'base/choice.php';
		include_once MKL_PC_INCLUDE_PATH . 'base/configuration.php';
		
		include_once MKL_PC_INCLUDE_PATH . 'api/rest-base-controller.php';
		include_once MKL_PC_INCLUDE_PATH . 'api/rest-layer-controller.php';
		include_once MKL_PC_INCLUDE_PATH . 'api/rest-angle-controller.php';
		include_once MKL_PC_INCLUDE_PATH . 'api/rest-choice-controller.php';

		include_once MKL_PC_INCLUDE_PATH . 'base/wc-data/layer-data-store.php';
		include_once MKL_PC_INCLUDE_PATH . 'base/wc-data/angle-data-store.php';
		include_once MKL_PC_INCLUDE_PATH . 'base/wc-data/choice-data-store.php';
		include_once MKL_PC_INCLUDE_PATH . 'base/wc-data/condition-data-store.php';
		include_once MKL_PC_INCLUDE_PATH . 'base/wc-data/layer-data.php';
		include_once MKL_PC_INCLUDE_PATH . 'base/wc-data/angle-data.php';
		include_once MKL_PC_INCLUDE_PATH . 'base/wc-data/choice-data.php';
		include_once MKL_PC_INCLUDE_PATH . 'base/wc-data/condition-data.php';

		include_once MKL_PC_INCLUDE_PATH . 'cache.php';
		include_once MKL_PC_INCLUDE_PATH . 'db.php';
		include_once MKL_PC_INCLUDE_PATH . 'themes.php';
		include_once MKL_PC_INCLUDE_PATH . 'ajax.php';
		include_once MKL_PC_INCLUDE_PATH . 'update.php';

		include_once MKL_PC_INCLUDE_PATH . 'frontend/frontend-woocommerce.php';
		include_once MKL_PC_INCLUDE_PATH . 'admin/customizer.php';

		if( is_admin() || WC()->is_rest_api_request() ) {
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
	 * Install the data stores
	 *
	 * @param array $stores
	 * @return array
	 */
	public function install_data_stores( $stores ) {
		$stores['pc-layer'] = 'MKL_PC_Layer_Data_Store';
		$stores['pc-choice'] = 'MKL_PC_Choice_Data_Store';
		$stores['pc-angle'] = 'MKL_PC_Angle_Data_Store';
		$stores['pc-condition'] = 'MKL_PC_Condition_Data_Store';
		return $stores;
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
		$this->_register_tables();
		$this->_includes();

		add_action( 'rest_api_init', array( $this, 'register_rest_routes' ) );
		add_filter( 'woocommerce_data_stores', array( $this, 'install_data_stores' ) );

		$this->languages = new Languages();
		$this->frontend = new Frontend_Woocommerce();
		$this->customizer = new Customizer();
		
		if( is_admin() || WC()->is_rest_api_request() ) {
			$this->admin = new Admin_Woocommerce();
		}
		
		$this->settings = new Settings();
		$this->cache = new Cache();
		$this->db = new DB();
		$this->themes = new Themes();
		$this->ajax = new Ajax();


		do_action( 'mkl_pc_is_loaded' );
	}

	public function register_rest_routes() {
		$layer_controller = new Rest_Layer_Controller();
    	$layer_controller->register_routes();
		$choice_controller = new Rest_Choice_Controller();
    	$choice_controller->register_routes();
		$angle_controller = new Rest_Angle_Controller();
    	$angle_controller->register_routes();
	}

	private function _register_tables() {
		global $wpdb;
		// List of tables without prefixes.
		$tables = array(
			'pc_layers'     => 'mklpc_layers',
			'pc_layermeta'  => 'mklpc_layermeta',
			'pc_choices'    => 'mklpc_choices',
			'pc_choicemeta' => 'mklpc_choicemeta',
			'pc_angles'    => 'mklpc_angles',
			'pc_anglemeta' => 'mklpc_anglemeta',
		);

		if ( defined( 'MKL_PC_CONDITIONAL_LOGIC_URL' ) ) {
			$tables['pc_conditions'] = 'mklpc_conditions';
		}

		foreach ( $tables as $name => $table ) {
			$wpdb->$name    = $wpdb->prefix . $table;
			$wpdb->tables[] = $table;
		}
	}


}

// var_dump('$mkl_pl', $mkl_pl);
