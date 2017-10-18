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
	public function __construct() {

		$this->_hooks();
		$this->_includes();
		$this->order = new Admin_Order();
		$this->product = new Admin_Product();
		// $this->settings = new Admin_Settings();

	}
	private function _includes() {
		// Includes for Addons management
		// if( !class_exists('MKL_EDD_SL_Plugin_Updater') ){
		// 	require_once( MKL_PC_INCLUDE_PATH . 'update/EDD_SL_Plugin_Updater.php');
		// }
		// include( MKL_PC_INCLUDE_PATH . 'update/extension-license.php');
		// include( MKL_PC_INCLUDE_PATH . 'admin/settings.php' );
		include( MKL_PC_INCLUDE_PATH . 'admin/product.php' );
		include( MKL_PC_INCLUDE_PATH . 'admin/order.php' );
	}
	private function _hooks() {
		// add_action( 'admin_init', array( &$this, 'woocommerce_loaded' ) ); 
		// add_action( 'woocommerce_product_customizer_options', array($this, 'product_data_fields' ), 1 );
		// add_action( 'woocommerce_product_after_variable_attributes', array($this, 'product_variation_data_fields' ), 10, 3 );
	}

	// /wp-content/plugins/woocommerce-mkl-product-customizer/lib/class-mlk-pc-admin.php
	// /wp-content/plugins/woocommerce-mkl-product-customizer/lib/class-mkl-pc-admin.php


	public function get_editor_menu( $structure ) {
		
		if( !is_array($structure) ) return false;
		$menu = '';

		?>

		<div class="pc-editor">
			<div class="list-elements"></div>
			<div class="list-choices"></div>
			<div class="choice-form"></div>
		</div>

		<?php
		foreach ($structure as $index => $element) {

			if( $element['name'] != '' && is_array($element['choice']) ) {
				$menu .= '<li>';
				$menu .= '<a href="#"> '. $element['name'] .'</a>';
				$menu .= '<ul class="wc-pc-tabs-sub">';
				foreach( $element['choice'] as $choice ) {
					$menu .= '<li>';
					$menu .= '<a href="#"> '. $choice .'</a>';
					$menu .= '
					<div class="image-selectors">
						<a href="#" class="image-selector" data-select-image="main">'.__('Choisir une image pour ').$choice.'</a><br>
						<a href="#" class="image-selector" data-select-image="thumbnail">'.__('Choisir une miniature').'</a>
					</div>';
					$menu .= '</li>';
				}
				$menu .= '</ul>';
				$menu .= '</li>';
			}
		}
		


		if( $menu != '' ) { 
			return '<ul class="wc-pc-tabs">'. $menu .'</ul><div class="wc-pc-tabs-sub-container" id="pc_tabs_submenu"></div><div id="pc_img_selectors"></div>';
		} else {
			return false;
		}
	}

	public function get_template_part( $file_path, $view_data = null ) {
		( $view_data ) ? extract( $view_data ) : null;
		ob_start();
		include ( "$file_path" );
		$template = ob_get_contents();
		ob_end_clean();

		return $template;			
	}


} // END CLASS


/*

add an ID for each element + choice 

- STRUCTURE
	view.on.change 
	- Save STRUCTURE
- VIEWS
	view.on.change 
	- Save VIEWS
- DATA
	view.on.show
	- GET STRUCTURE
	- GET VIEW
	view.on.change
	- SAVE

*/

