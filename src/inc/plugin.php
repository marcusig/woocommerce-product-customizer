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

		add_action( 'core_upgrade_preamble', array($this, 'core_upgrade_preamble'), 10 );
		add_action('load-plugins.php', array($this, 'load_plugins_php'), 5);
	}

	public function load_plugins_php() {
		if (!current_user_can('update_plugins')) return;
		global $mkl_updater_instances;
		if ( ! is_array( $mkl_updater_instances ) ) return;
		foreach( $mkl_updater_instances as $updater_instance ) {
			remove_action( 'load-plugins.php', [ $updater_instance, 'load_plugins_php' ], 10 );
		}
		add_action('all_admin_notices', array($this, 'add_notice'), 5);
	}
	public function add_notice() {
		if (!current_user_can('update_plugins')) return;
		global $mkl_updater_instances;
		if ( ! is_array( $mkl_updater_instances ) ) return;
		?> 
		<style>
			.updated.mkl_pc_addons {
				display: flex;
				flex-wrap: wrap;
				border-left-color: #cb3a27;
				align-items: center;
			}

			.mkl_pc_addons--description,
			.mkl_pc_addons--connector{
				box-sizing: border-box;
				width: 50%;
				padding: 20px;
			}

			.mkl_pc_addons--description {
				border-right: 1px solid #EEE;
			}

			.mkl_pc_addons--description img {
				max-width: 250px;
			}
			h3.mkl_pc_addons--warning {
				padding: 10px;
				background: #cb3a26;
				border-radius: 3px;
				color: #FFF;
			}
			.mkl_pc_addons--list {
				width: 100%;
				display: none;
			}

			.mkl_pc_addons--list table tr.active td {
				border-left: none;
				border-top: 1px solid #EEE
			}

			.mkl_pc_addons--list table {
				width: 100%;
			}

			[class*="udmupdater_box_woocommerce-mkl-pc"] {
				display: flex;
				flex-wrap: wrap;
			}

			[class*="udmupdater_box_woocommerce-mkl-pc"] div:first-of-type {
				flex: 2;
			}

			.udmupdater_userpassform[class*="udmupdater_userpassform_woocommerce-mkl-pc"] {flex: 1;}

			.udmupdater_autoupdate {
				width: 100%;
			}

		</style>
		<div class="updated mkl_pc_addons">
			<div class="mkl_pc_addons--description">
				<img src="<?php echo MKL_PC_ASSETS_URL; ?>admin/images/mkl-live-product-configurator-for-woocommerce.png" alt="Product Configurator for WooCommerce"/>
				<h3 class="mkl_pc_addons--warning">Access to  updates for some add-ons is not active</h3>
				<p>You haven’t connected some of the add-ons licenses, so you will not receive updates.
				Keeping the add-ons up to date is recommended. </p>
				<button class="button button-primary mkl_pc_addons--show-list">Connect now</button>
			</div>
			<div class="mkl_pc_addons--list">
				<div class="mkl_pc_addons--connector">
					<label for="">Please enter your customer login to access updates:</label><br>
					<input type="text" style="width:180px;" placeholder="<?php echo esc_attr(__('Email', 'udmupdater')); ?>" name="email" value="">
					<input type="password" style="width:180px;" placeholder="<?php echo esc_attr(ucfirst(__('password', 'udmupdater'))); ?>" name="password" value="">
					<button class="button button-primary mkl_pc_addons--connect">Connect all licenses</button>
					<br><a href="#" class="mkl_pc_addons--show-list">I have several logins, display connections for each add-on.</a>
				</div>
				<table>
				<?php
				$data = [];
				foreach( $mkl_updater_instances as $updater_instance ) {
					if ( $updater_instance && is_callable( [$updater_instance, 'after_plugin_row']) ) {
						$updater_instance->after_plugin_row( false );
						$data[] = [
							'muid' => $updater_instance->muid,
							'slug' => $updater_instance->slug
						];
					}
				}
				?>
				</table>
			</div>
		</div>
		<script>
			jQuery( function( $ ) {
				// Show the list 
				$( '.mkl_pc_addons--show-list' ).on( 'click', function( e ) {
					e.preventDefault();
					$( '.mkl_pc_addons--list' ).toggle();
				} );
				var plugins_list = <?php echo json_encode( $data ); ?>;
				// Handle logging in
				var nonce = '<?php echo esc_js(wp_create_nonce('udmupdater-ajax-nonce')); ?>';

				$('.mkl_pc_addons--connect').click( function() {
					var button = this;
					var $box = $(this).closest('.mkl_pc_addons--connector');
					var email = $box.find('input[name="email"]').val();
					var password = $box.find('input[name="password"]').val();
					if (email == '' || password == '') {
						alert( '<?php echo esc_js( sprintf( __('You need to enter both an email address and a %s', 'udmupdater'), __('password', 'udmupdater') ) ); ?>' );
						return false;
					}
					$.each( plugins_list, function( ind, item ) {

						var sdata = {
							action: 'udmupdater_ajax',
							subaction: 'connect',
							nonce: nonce,
							userid: item.muid,
							slug: item.slug,
							email: email,
							password: password
						}
						$(this).prop('disabled', true).html('<?php echo esc_js(__('Connecting...', 'udmupdater')); ?>');
						
						
					} );

					return false;
				});				

			} );
		</script>
	
		<?php

	}
}

// var_dump('$mkl_pl', $mkl_pl);
