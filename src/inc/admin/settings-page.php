<?php
namespace MKL\PC;
/**
 *	
 *	
 * @author   Marc Lacroix
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly
}
if ( ! class_exists('MKL\PC\Admin_Settings') ) {
	class Admin_Settings {

		public $licenses;
		private $settings_id = 'mkl-pc-configurator';

		function __construct() {
			add_action( 'admin_menu', array( $this, 'register' ) );
			add_action( 'admin_init', array( $this, 'init' ), 20 );
			add_action( 'admin_enqueue_scripts', array( $this, 'scripts') );
			// add_action( 'woocommerce_settings_' . sanitize_title( $this->settings_id ) . '_after', array( $this, 'wc_settings_after' ), 20 );
			add_filter( 'plugin_action_links_' . MKL_PC_PLUGIN_BASE_NAME, array( $this, 'plugin_settings_link' ) );
		}

		/**
		 * Add the settings link in the plugins page
		 *
		 * @param array $links
		 * @return array
		 */
		public function plugin_settings_link( $links ) {
			$settings_link = '<a href="' . admin_url( 'options-general.php?page=mkl_pc_settings' ) . '">' . __( 'Settings' ) . '</a>';
			array_unshift($links, $settings_link);
			return $links;
		}

		public function register() {
			$page_title = 'MKL Product Configurator for WooCommerce';
			$menu_title = 'Product Configurator';
			$capability = 'manage_options';
			$menu_slug = 'mkl_pc_settings';
			$fn = array( $this, 'display' );

			add_options_page(
				$page_title,
				$menu_title,
				$capability,
				$menu_slug,
				$fn
			);		
		}

		public function display(){
			$active = isset( $_REQUEST['tab'] ) ? sanitize_key( $_REQUEST['tab'] ) : 'settings';
			$tabs = apply_filters( 'mkl_pc_settings_tabs', [
				'settings' => __( 'Settings', 'product-configurator-for-woocommerce' ),
				'addons' => __( 'Addons', 'product-configurator-for-woocommerce' )
			], $active );
			?>
			<div class="wrap">
				<header>
					<h1>
						<img src="<?php echo MKL_PC_ASSETS_URL; ?>admin/images/mkl-live-product-configurator-for-woocommerce.png" alt="Product Configurator for WooCommerce"/>
						<span class="version"><?php echo MKL_PC_VERSION; ?></span>
						<span class="by">by <a href="https://mklacroix.com" target="_blank">MKLACROIX</a></span>
					</h1>
					<div class="links">
						<a href="http://wc-product-configurator.com"><?php _e( 'Product Configurator website', 'product-configurator-for-woocommerce' ); ?></a><!--  | <a href="http://wc-product-configurator.com"><?php _e( 'Addons', 'product-configurator-for-woocommerce' ); ?></a> | <a href="http://wc-product-configurator.com"><?php _e( 'Themes', 'product-configurator-for-woocommerce' ); ?></a> -->
					</div>
				</header>
				<nav class="nav-tab-wrapper mkl-nav-tab-wrapper">
					<?php
					foreach( $tabs as $tab_id => $tab ) { ?>
						<a href="#" class="nav-tab<?php echo ( $active === $tab_id ? ' nav-tab-active' : '' ); ?>" data-content="<?php echo esc_attr( $tab_id ); ?>"><?php echo $tab; ?></a>
					<?php 
					} ?>
				</nav>
				<div class="mkl-settings-content" data-content="settings">
					<form method="post" action="options.php">
						<?php
							settings_fields( 'mlk_pc_settings' );
							do_settings_sections( 'mlk_pc_settings' );
							submit_button();
						?>
					</form>
				</div>
				<div class="mkl-settings-content" data-content="addons">
					<h2><?php _e( 'Addons', 'product-configurator-for-woocommerce' ); ?></h2>
					<?php $this->display_addons(); ?>
				</div>

				<?php do_action( 'mkl_pc_settings_content_after', $active ); ?>

			</div>
			<?php 
		} 

		public function init() {

			register_setting( 'mlk_pc_settings', 'mkl_pc__settings' );

			add_settings_section(
				'mkl_pc__mlk_pc_settings_section', 
				__( 'Styling options', 'product-configurator-for-woocommerce' ), 
				[ $this, 'styling_section_callback' ],
				'mlk_pc_settings'
			);
		
			add_settings_field(
				'mkl_pc__button_classes', 
				__( 'Button classes', 'product-configurator-for-woocommerce' ),
				[ $this, 'text_field_callback' ],
				'mlk_pc_settings', 
				'mkl_pc__mlk_pc_settings_section',
				[ 
					'setting_name' => 'mkl_pc__button_classes',
					'placeholder' => 'btn btn-primary'
				]
			);

			add_settings_field(
				'mkl_pc__button_label', 
				__( 'Configure button label', 'product-configurator-for-woocommerce' ),
				[ $this, 'text_field_callback' ],
				'mlk_pc_settings', 
				'mkl_pc__mlk_pc_settings_section',
				[ 
					'setting_name' => 'mkl_pc__button_label',
					'placeholder' => __( 'Default:', 'product-configurator-for-woocommerce' ) . ' ' . __( 'Configure', 'product-configurator-for-woocommerce' )
				]
			);
		}

		public function styling_section_callback() {
			// echo __( 'This section description', 'product-configurator-for-woocommerce' );
		}

		public function text_field_callback($field_options = []) {
			$options = get_option( 'mkl_pc__settings' );
			if ( !isset($field_options['setting_name'])) return;
			?>
			<input <?php echo isset( $field_options[ 'placeholder' ] ) ? 'placeholder="' . esc_attr( $field_options[ 'placeholder' ] ) .'" ' : ''; ?>type='text' name='mkl_pc__settings[<?php echo $field_options['setting_name']; ?>]' value='<?php echo isset( $options[$field_options['setting_name']] ) ? $options[$field_options['setting_name']] : ''; ?>'>
			<?php
		}

		public function display_addons() {
			$this->get_addons(); 
			$installed_addons = Plugin::instance()->get_extensions();
			if ( ! is_array( $this->addons ) ) return;
			echo '<div class="mkl-pc-addons">';
			foreach( $this->addons as $addon ) {
				$this->display_addon( $addon, in_array( $addon->product_name, array_keys( $installed_addons ) ) );
			}
			$this->display_mkl_theme();
			echo '</div>';
		}

		private function display_mkl_theme(){ 
			
			?>
			<div class="mkl-pc-addon mkl-pc-theme">
				<figure><img src="<?php echo MKL_PC_ASSETS_URL .'admin/images/' ?>mkl-theme-thumbnail.png" alt=""></figure>
				<div class="content">
					<h4><?php _e( 'Get the official Product Configurator themes', 'product-configurator-for-woocommerce' ) ?></h4>
					<p><?php _e( 'Beautiful design, integrated live configuring interface, widgetized homepage, flexible, lightweight and much more...', 'product-configurator-for-woocommerce' ) ?></p>
					<em>Coming soon</em>
					<?php
					/*  <a href="<?php echo esc_url( $this->themes_url ); ?>" target="_blank" class="button button-primary button-large"><?php _e( 'View available themes', 'product-configurator-for-woocommerce' ) ?></a> */
					?>
				</div>
			</div>
			<?php 
		}

		/**
		 * Display a single addon
		 *
		 * @param object $addon
		 * @param boolean $is_installed
		 * @return void
		 */
		public function display_addon( $addon, $is_installed = false ) {
		?>	
			<div class="mkl-pc-addon<?php echo $is_installed ? ' installed' : ''; ?>">
				<figure>
					<img src="<?php echo esc_url( trailingslashit( MKL_PC_ASSETS_URL ) . 'admin/images/addons/' . $addon->img ) ?>" alt="">
				</figure>
				<h4>
					<?php echo esc_textarea( $addon->label ); ?>
					<?php if ( $is_installed ) { echo ' <span class="installed">' . __( 'installed' ) . '</span>'; } ?>
				</h4>
				<div class="desc">
					<?php echo esc_textarea( $addon->description ); ?>
				</div>
				<?php if ( ! $is_installed ) : ?>
					<a href="<?php echo esc_url( $addon->product_url ) ?>" class="button button-primary button-large"><?php _e( 'Get the addon now' ) ?> <span class="dashicons dashicons-external"></span></a>
				<?php endif; ?>
			</div>
		<?php
		}

		public function get_addons(){
			$this->addons = include 'addons.php';
			$this->themes_url = get_transient( 'mkl_pc_themes_url' );
		}

		public function scripts(){
			$screen = get_current_screen();
			if ( 'settings_page_mkl_pc_settings' == $screen->id ){
				wp_enqueue_style( 'mlk_pc/settings', MKL_PC_ASSETS_URL.'admin/css/settings.css' , false, MKL_PC_VERSION );
				wp_enqueue_script( 'mk_pc/settings', MKL_PC_ASSETS_URL.'admin/js/settings.js', array('jquery'), MKL_PC_VERSION, true );
			}
		}
	}
}
