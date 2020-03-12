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

class Admin_Settings {

	public $licenses;
	private $settings_id = 'mkl-pc-customizer';

	function __construct() {
		add_action( 'admin_menu', array( $this, 'register' ) );
		add_action( 'admin_init', array( $this, 'init' ), 20 );
		add_action( 'admin_enqueue_scripts', array( $this, 'scripts') );
		add_filter( 'woocommerce_get_sections_products', array( $this, 'add_wc_settings_section' ));
		add_filter( 'woocommerce_get_settings_products', array( $this, 'add_wc_settings_to_section' ), 20, 2);
		
		add_action( 'woocommerce_settings_' . sanitize_title( $this->settings_id ) . '_after', array( $this, 'wc_settings_after' ), 20 );
	}

	public function add_wc_settings_section( $sections ) {
		$sections[$this->settings_id] = __( 'Product Customizer', MKL_PC_DOMAIN );
		return $sections;
	}

	public function add_wc_settings_to_section( $settings, $current_section ) {
		if ( $this->settings_id == $current_section ) {
			$pc_settings = array();

			$pc_settings[] = array(
				'name' => __( 'Product Customizer settings', MKL_PC_DOMAIN ),
				'type' => 'title',
				'id' => $this->settings_id,
			);

			$pc_settings[] = array(
				'name' => __( 'The first setting', MKL_PC_DOMAIN ),
				'desc_tip' => __( 'This will add a title to your slider', 'text-domain' ),
				'type' => 'text',
				'id' => $this->settings_id . '_something',
				'desc'     => __( 'Any title you want can be added to your slider with this option!', 'text-domain' ),
			);

			// Allow adding other settings
			$pc_settings = apply_filters( 'mklpc_settings', $pc_settings, $this->settings_id, $current_section );

			$pc_settings['sectionend'] = array( 'type' => 'sectionend', 'id' => $this->settings_id );

			return $pc_settings;

		}
		return $settings;
	}

	public function wc_settings_after() {
		// $this->display();
	}

	public function register() {
		$page_title = 'MKL Product Customizer for WooCommerce';
		$menu_title = 'Product Customizer';
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
		global $wp_meta_boxes;
		?>
		<div class="wrap">
			<h1><img src="<?php echo MKL_PC_ASSETS_URL; ?>admin/images/mkl-live-product-customizer-for-woocommerce.png" alt="Product Customizer for WooCommerce"/><br>by <a href="https://mklacroix.com" target="_blank">MKLACROIX</a></h1>
			<nav class="nav-tab-wrapper mkl-nav-tab-wrapper">
				<a href="#" class="nav-tab nav-tab-active" data-content="settings"><?php _e( 'Settings', MKL_PC_DOMAIN ); ?></a>
				<a href="#" class="nav-tab" data-content="addons"><?php _e( 'Addons', MKL_PC_DOMAIN ); ?></a>
			</nav>
			<div class="mkl-settings-content" data-content="settings">
				<form>
					<h4>Custumizer Style</h4>
					<label>Include styles</label> 
					<select>
						<option>None</option>
						<option>Core elements</option>
						<option>Core elements + Simple styling</option>
					</select>
					<label>Buttons class</label>
					<input type="text" name="btns" placeholder="eg: btn btn-primary">
				</form>
			</div>
			<div class="mkl-settings-content" data-content="addons">
				<h2><?php _e( 'Addons', MKL_PC_DOMAIN ); ?></h2>
			</div>

			<pre>
				<?php 
				// var_dump($wp_meta_boxes);
				// var_dump(get_current_screen()) ?>
			</pre>
			<div id="poststuff">
				<?php 
				// $this->display_addons();
				// do_meta_boxes( 'mkl_pc_settings', 'advanced', NULL ); 
				?>
			</div>
		</div>
		<?php 
	} 

	public function setup_licenses() {
        if ( ! class_exists( 'MKL\PC\Extension_License' ) ) return;

        $installed_addons = Plugin::instance()->extentions;
        foreach ($installed_addons as $ext_key => $ext_instance) {
        	//new Extension_License( $product_name, $version, $author, $file, $slug = '' )
			new Extension_License( $ext_instance::NAME, $ext_instance::VERSION, $ext_instance::AUTHOR, $ext_instance->plugin_file, $ext_instance::SLUG );
	        
        }
    }

	public function init() {
		if( ! current_user_can(  'manage_options' ) ) return; 
		$this->submit_listener(); 

        // add_meta_box(
        //     'mkl_pc_addon',
        //     __( 'Add-Ons', 'ninja-forms' ),
        //     array( $this, 'display_addon' ),
        //     'mkl_pc_settings'
        // );
	}

    public function submit_listener() {
        if( ! current_user_can(  'manage_options' ) ) return;

        if( ! isset( $_POST[ 'mkl_pc_license' ] ) || ! $_POST[ 'mkl_pc_license' ] ) return;

        $key    = sanitize_text_field( $_POST[ 'mkl_pc_license' ][ 'key' ]    ); 
        $name   = sanitize_text_field( $_POST[ 'mkl_pc_license' ][ 'name' ]   ); 
        $action = sanitize_text_field( $_POST[ 'mkl_pc_license' ][ 'action' ] ); 

        switch( $action ){
            case 'activate':
                $this->activate_license( $name, $key );
                break;
            case 'deactivate': 
                $this->deactivate_license( $name );
                break;
        }
    }

    private function get_license( $name ) {
        // return get_option( $name . '-licensing-settings' );
        foreach( $this->licenses as $license ){
            if( $name == $license->product_name )
            	return $license;
        }
        return false;
    }

    private function activate_license( $name, $key ) {
        $licence = $this->get_license( $name ); 
        if($licence) $licence->activate_license( $key );
    }

    private function deactivate_license( $name  ) {
        
        $licence = $this->get_license( $name );
        if( $licence ) $licence->deactivate_license();
        
    }

	public function display_addons() {
		$this->get_addons(); 
		$installed_addons = Plugin::instance()->extentions;
		if( ! is_array( $this->addons ) ) return;
		// var_dump($this->addons);
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
				<h4><?php _e( 'Get the official Live Product Customizer themes', MKL_PC_DOMAIN ) ?></h4>
				<p><?php _e( 'Beautiful design, integrated live customizing interface, widgetized homepage, flexible, lightweight and much more...', MKL_PC_DOMAIN ) ?></p>
				<a href="<?php echo $this->themes_url ?>" target="_blank" class="button button-primary button-large"><?php _e( 'View available themes', MKL_PC_DOMAIN ) ?></a>
			</div>
		</div>
		<?php 
	}
	public function display_addon( $addon, $is_installed = false ) {

	?>	
			<div class="mkl-pc-addon<?php echo $is_installed ? ' installed' : ''; ?>">
				<figure>
					<img src="<?php echo esc_url_raw( $addon->img ) ?>" alt="">
				</figure>
				<h4>
					<?php echo esc_textarea( $addon->label ); ?>
					<?php if( $is_installed ) { echo " (installed)"; } ?>
				</h4>
				<div class="desc">
					<?php echo esc_textarea( $addon->description ); ?>
				</div>
				<?php if( $is_installed ) : ?>
					<?php
					$license = $this->get_license( $addon->product_name );
					$key = $license->get_key();
					$error = $license->get_error();
					?>
					<div class="license">
						<?php if( $license->is_valid() ) : ?>
							<p>Your license is activated. </p>
							<a href="#" class="mkl-edit-license">Edit license</a>
						<?php endif; ?>
						<form method="post" action="<?php echo trailingslashit( admin_url() ) ?>options-general.php?page=mkl_pc_settings">
							<input type="hidden" name="page" value="mkl_pc_settings">
							<input type="hidden" name="debug" value="false">
							<label><?php _e('Enter your licence key Here') ?></label>
							<?php echo $error ?>
							<input type="text" name="mkl_pc_license[key]" value="<?php echo $key ?>">
							<input type="hidden" name="mkl_pc_license[name]" value="<?php echo $addon->product_name?>">
							<input type="hidden" name="mkl_pc_license[product_id]" value="<?php echo $addon->product_id?>">
							
							<?php if( $license->is_valid() ) : ?>
								<input type="hidden" name="mkl_pc_license[action]" value="deactivate">
								<button type="submit" class="button button-default">Deactivate</button>
							<?php else: ?>
								<input type="hidden" name="mkl_pc_license[action]" value="activate">
								<button type="submit" class="button button-primary">Activate</button>
							<?php endif; ?>
						</form>
					</div>
				<?php else: ?>
					<a href="<?php echo esc_url_raw( $addon->product_url ) ?>" class="button button-primary button-large"><?php _e( 'Get the addon now' ) ?></a>
				<?php endif; ?>
			</div>
	<?php
	}

	public function get_addons(){

		if( isset( $_REQUEST['mkl_refresh_addons'] ) ) {
			delete_transient( 'mkl_pc_addons' ); 
			delete_transient( 'mkl_pc_themes_url' );
		}

		$this->addons = get_transient( 'mkl_pc_addons' ); 
		$this->themes_url = get_transient( 'mkl_pc_themes_url' ); 

		if( ! $this->addons || ! $this->themes_url ) {
			
			$api_url = MKL_PC_ADDONS_API_URL;
			$api_params = array(
				'mkl_action' => 'get_pc_addons',
			);

	        $request = wp_remote_get( 
	        	$api_url, 
	        	array( 'timeout' => 15, 'sslverify' => false, 'body' => $api_params ) 
	        );

	        if ( ! is_wp_error( $request ) ) {
	            $request = json_decode( wp_remote_retrieve_body( $request ) );
	        	if( $request->success ) {
	        		$this->addons = $request->data->addons;
	        		$this->themes_url = $request->data->themes_url;
		        	set_transient( 'mkl_pc_themes_url', $this->themes_url, DAY_IN_SECONDS * 2 );
		        	set_transient( 'mkl_pc_addons', $this->addons, DAY_IN_SECONDS * 2 );
		        }
	        }
		}

		// if ( class_exists( 'MKL_Extension_License' ) ) {		
	 //        new MKL_Extension_License( self::NAME, self::VERSION, self::AUTHOR, __FILE__, self::SLUG );
		// }

	}

	public function scripts(){
		$screen = get_current_screen();
		if( 'settings_page_mkl_pc_settings' == $screen->id ){
			wp_enqueue_style( 'mlk_pc/settings', MKL_PC_ASSETS_URL.'admin/css/settings.css' , false, '1.0.0' );
			wp_enqueue_script( 'mk_pc/settings', MKL_PC_ASSETS_URL.'admin/js/settings.js', array('jquery'), '1.0.0', true );
		}
	}


}