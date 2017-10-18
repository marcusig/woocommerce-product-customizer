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

	function __construct() {
		add_action( 'admin_menu', array( $this, 'register' ) );
		add_action( 'admin_init', array( $this, 'init' ), 20 );
		add_action( 'admin_enqueue_scripts', array( $this, 'scripts') );
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
			<h1>Product Customizer for WooCommerce by <a href="https://mklacroix.com" target="_blank">MKLACROIX</a></h1>
			<h2>Settings</h2>
			<p>These are the basic settings for the plugin. There aren't many, not even sure I need any.</p>
			<h2>Addons</h2>
			<p>This is the list of installed and available extensions, they as well as the place to add activate/deactivate the licenses. </p>
			<pre>
				<?php 
				// var_dump($wp_meta_boxes);
				// var_dump(get_current_screen()) ?>
			</pre>
			<div id="poststuff">
				<?php 
				$this->display_addons();
				//do_meta_boxes( 'mkl_pc_settings', 'advanced', NULL ); 
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
		$this->setup_licenses();
		$this->licenses = apply_filters( 'mkl_pc_settings_licenses_addons', array() );
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
		$addons = $this->get_addons();
		if( ! $addons ) {
			_e('could not connect to the remote server...');
			return;
		}

		$installed_addons = Plugin::instance()->extentions;
		echo '<div class="mkl-pc-addons">';
		foreach( $addons as $addon ) {
			$this->display_addon( $addon, in_array( $addon->product_name, array_keys( $installed_addons ) ) );
		}
		echo '</div>';

	}
	public function display_addon( $addon, $is_installed = false ) {

	?>	
			<div class="mkl-pc-addon<?php echo $is_installed ? ' installed' : ''; ?>">
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
					<form method="post" action="<?php echo trailingslashit( admin_url() ) ?>options-general.php?page=mkl_pc_settings">
						<input type="hidden" name="page" value="mkl_pc_settings">
						<input type="hidden" name="debug" value="false">
						<label><?php _e('Enter your licence key Here') ?></label>
						<?php echo $error ?>
						<input type="text" name="mkl_pc_license[key]" value="<?php echo $key ?>">
						<input type="hidden" name="mkl_pc_license[name]" value="<?php echo $addon->product_name?>">
						
						<?php if( $license->is_valid() ) : ?>
							<input type="hidden" name="mkl_pc_license[action]" value="deactivate">
							<button type="submit" class="button button-default">Deactivate</button>
						<?php else: ?>
							<input type="hidden" name="mkl_pc_license[action]" value="activate">
							<button type="submit" class="button button-primary">Activate</button>
						<?php endif; ?>
					</form>
				<?php else: ?>
					<a href="#"><?php _e( 'Get the addon now' ) ?></a>
				<?php endif; ?>
			</div>
	<?php
	}

	public function get_addons(){
		$api_url = 'http://mklpc.loc/';
		$api_params = array(
			'mkl_action' => 'get_list',
		);
        $request = wp_remote_post( 
        	$api_url, 
        	array( 'timeout' => 15, 'sslverify' => false, 'body' => $api_params ) 
        );
        if ( ! is_wp_error( $request ) ) {
            $request = json_decode( wp_remote_retrieve_body( $request ) );
        	if( $request->success ) {
        		return $request->data;
        	} else {
        		return [];
        	}
        }
        return [];

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