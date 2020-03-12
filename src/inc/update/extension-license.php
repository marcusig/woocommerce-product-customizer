<?php 
namespace MKL\PC;

if ( ! defined( 'ABSPATH' ) ) exit;
/**
 * (adapted from Ninja Forms Class_Extension_Updater)
 * This class handles all the update-related stuff for extensions, including adding a license section to the license tab.
 * It accepts two args: Product Name and Version.
 *
 * @param $product_name string
 * @param $version string
 * @since 2.2.47
 * @return void
 */

class Extension_License
{
	public $product_nice_name = '';
	public $product_name = '';
	public $version = '';
	// public $store_url = ;
	public $file = '';
	public $author = '';
	public $error = '';

	/**
	 * Constructor function
	 *
	 * @since 2.2.47
	 * @updated 3.0
	 * @return void
	 */
	public function __construct( $product_name, $version, $author, $file, $slug = '' ) {
		$this->store_url = MKL_PC_ADDONS_API_URL;
		$this->get_settings();
		$this->product_nice_name = $product_name;
		if ( $slug == '' ) {
			$this->product_name = strtolower( $product_name );
			$this->product_name = preg_replace( "/[^a-zA-Z]+/", "", $this->product_name );
		} else {
			$this->product_name = $slug;
		}

		$this->version = $version;
		$this->file = $file;
		$this->author = $author;

		add_filter( 'mkl_pc_settings_licenses_addons', array( $this, 'register' ) );
	}

	/**
	 * Function that adds the license entry fields to the license tab.
	 *
	 * @updated 3.0
	 * @param array $licenses
	 * @return array $licenses
	 */
	function register( $licenses ) {
		$licenses[] = $this;
		return $licenses;
	}

	/*
	 *
	 * Function that activates our license
	 *
	 * @since 2.2.47
	 * @return void
	 */
	function activate_license( $license_key ) {

		// data to send in our API request
		$api_params = array(
			'mkl_action'=> 'activate_license', 
			'license' 	=> $license_key, 
			'item_name' => urlencode( $this->product_nice_name ), // the name of our product in EDD
			'item_id'   => $this->product_name,
			'domain'    => home_url(),
		);

		// Call the custom API.
		$response = wp_remote_post( esc_url_raw( add_query_arg( $api_params, $this->store_url ) ) );

		$this->maybe_debug( $response );

		// make sure the response came back okay
		if ( is_wp_error( $response ) )
			return false;

		// decode the license data
		$license_data = json_decode( wp_remote_retrieve_body( $response ) );

		if ( 'invalid' == $license_data->license ) {
			$error = '<span style="color: red;">' . __( 'Could not activate license. <br>', MKL_PC_DOMAIN ) . $license_data->message . '</span>';

		} else {
			$error = '';
		}

		$this->set_setting( 'license', $license_key, true );
		$this->set_setting( 'license_error', $error, true );
		$this->set_setting( 'license_status', $license_data->license ); 
	}

	/*
	 *
	 * Function that deactivates our license if the user clicks the "Deactivate License" button.
	 *
	 * @since 2.2.47
	 * @return void
	 */

	function deactivate_license() {

		$license = $this->get_setting( 'license' );

		// data to send in our API request
		$api_params = array(
			'mkl_action'=> 'deactivate_license',
			'license' 	=> $license,
			'item_name' => urlencode( $this->product_nice_name ), // the name of our product in EDD
			'domain'    => home_url(),
			'item_id'   => $this->product_name,
		);


		// Call the custom API.
		$response = wp_remote_post( esc_url_raw( add_query_arg( $api_params, $this->store_url ) ), array( 'timeout' => 15, 'sslverify' => false ) );

		$this->maybe_debug( $response );

		// make sure the response came back okay
		if ( is_wp_error( $response ) )
			return false;
		$response = json_decode(wp_remote_retrieve_body($response));
		if( true == $response->success ){
			$this->set_setting( 'license_error', '', true );
			$this->set_setting( 'license_status', 'invalid', true );
			$this->set_setting( 'license', '' );
		} else {
			echo 'Could not deactivate License.';
		}
	}


	/**
	 * Return whether or not this license is valid.
	 *
	 * @access public
	 * @since 2.9
	 * @return bool
	 */
	public function is_valid() {
		 return ( 'valid' == $this->get_setting( 'license_status' ) );
	}

	/**
	 * Get any error messages for this license field.
	 *
	 * @access public
	 * @since 2.9
	 * @return string $error
	 */
	public function get_error() {
		return $this->get_setting( 'license_error' );
	}

	public function get_key() {
		return $this->get_setting( 'license' );
	}

	private function maybe_debug( $data, $key = 'debug' )
	{
		if ( isset ( $_REQUEST[ $key ] ) && 'true' == $_REQUEST[ $key ] ) {
			echo '<pre>'; var_dump( $data ); echo '</pre>';
			die();
		}
	}

	public static function get_addons() {

	}

	public function get_setting( $setting_name ){
		// var_dump( $this->settings[$setting_name], $setting_name, $this->settings );
		if( ! $this->settings )
			$this->get_settings();
		if( isset( $this->settings[$setting_name] ) )
			return $this->settings[$setting_name];
		else
			return false;
	}
	public function get_settings(){
		//var_dump($this->product_name . '-licensing-settings'); die();
		$this->settings = get_option( $this->product_name . '-licensing-settings' );
	}

	public function set_setting( $setting, $value, $defer = false ){
		$this->settings[$setting] = $value;
		if( ! $defer ) {
			$this->set_settings();
		}
	}
	public function set_settings(){
		update_option( $this->product_name . '-licensing-settings', $this->settings );
	}

} // End Class NF_Extension_Updater
