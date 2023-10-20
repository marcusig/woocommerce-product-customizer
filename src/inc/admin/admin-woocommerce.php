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

	// public function get_editor_menu( $structure ) {
		
	// 	if( !is_array($structure) ) return false;
	// 	$menu = '';


	// 	<div class="pc-editor">
	// 		<div class="list-elements"></div>
	// 		<div class="list-choices"></div>
	// 		<div class="choice-form"></div>
	// 	</div>

	// 	foreach ($structure as $index => $element) {

	// 		if( $element['name'] != '' && is_array($element['choice']) ) {
	// 			$menu .= '<li>';
	// 			$menu .= '<a href="#"> '. $element['name'] .'</a>';
	// 			$menu .= '<ul class="wc-pc-tabs-sub">';
	// 			foreach( $element['choice'] as $choice ) {
	// 				$menu .= '<li>';
	// 				$menu .= '<a href="#"> '. $choice .'</a>';
	// 				$menu .= '
	// 				<div class="image-selectors">
	// 					<a href="#" class="image-selector" data-select-image="main">'.__('Choose an image for ').$choice.'</a><br>
	// 					<a href="#" class="image-selector" data-select-image="thumbnail">'.__('Choose a thumbnail').'</a>
	// 				</div>';
	// 				$menu .= '</li>';
	// 			}
	// 			$menu .= '</ul>';
	// 			$menu .= '</li>';
	// 		}
	// 	}
		


	// 	if( $menu != '' ) { 
	// 		return '<ul class="wc-pc-tabs">'. $menu .'</ul><div class="wc-pc-tabs-sub-container" id="pc_tabs_submenu"></div><div id="pc_img_selectors"></div>';
	// 	} else {
	// 		return false;
	// 	}
	// }

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
} // END CLASS
