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

class Admin_Product {

	public function __construct() {
		$this->_hooks();
	}

	private function _hooks() {
		// add_action( 'woocommerce_product_data_panels', array( $this, 'add_pc_settings_tab_content' ) );
		add_action( 'mkl_pc_saved_product_configuration', array( $this, 'write_configuration_cache' ), 20, 1 );
		// add the checkbox to activate customizer on the product
		add_action( 'woocommerce_product_options_general_product_data', array($this, 'add_wc_general_product_data_fields') );
		add_action( 'mkl_pc_admin_home_tab', array( $this, 'home_tab') );
		add_action( 'admin_footer', array($this, 'editor' ) ); 
		add_action( 'admin_enqueue_scripts', array( $this, 'load_scripts' ) ); 
		add_action( 'plugins_loaded', array( $this, 'on_plugins_loaded' ), 50 );

	}

	public function on_plugins_loaded() {
		// Supported product types
		$product_types = apply_filters( 'mkl_pc_woocommerce_product_types', array('simple') );
		foreach( $product_types as $product_type ) {
			add_action( 'woocommerce_process_product_meta_' . $product_type, array( $this, 'save_product_setting' ) );
		}
	}

	/**
	 * Add the settings tab to WooCommerce
	 *
	 * @param array $tabs
	 * @return array
	 */
	// public function add_pc_settings_tab( $tabs ) {
	// 	error_log('did you call me?');
	// 	$tabs['customizable-product'] = array(
	// 		'label'  => __( 'Customizer options', MKL_PC_DOMAIN ),
	// 		'target' => 'customizable_product_options',
	// 		'class'  => array( 'customizable_product_tab', 'show_if_is_customizable' ),

	// 	);
	// 	return $tabs;
	// }

	/**
	 * Add the settings
	 *
	 * @return void
	 */
	public function add_pc_settings_tab_content() {
		?>
		<div id="customizable_product_options" class="panel wc-metaboxes-wrapper">
			<?php 
			do_action( 'woocommerce_product_customizer_options' );
			?>
		</div>

		<?php
		
	}

	public function add_wc_general_product_data_fields() {
		global $post, $wc_mkl_pc;
		// var_dump($post->ID);

		echo '<div class="options_group wc-metaboxes-wrapper '. join( ' ', apply_filters( 'mkl_wc_general_metaboxe_classes', array('show_if_simple') ) ) .'">';

		woocommerce_wp_checkbox( 
			array( 
					'id' => MKL_PC_PREFIX.'_is_customizable',
					'wrapper_class' => join( ' ', apply_filters( 'mkl_wc_general_metaboxe_classes', array('show_if_simple') ) ) .' is_customizable', 
					'class' => 'is_customizable',
					'label' => __( 'This product is customizable', MKL_PC_DOMAIN ), 
					'description' => __( 'Select if you want this product to be customizable', MKL_PC_DOMAIN ) 
				) 
			);

		// piklist('customizer/is_customizer'); 

		?>
		<div class="toolbar show_if_simple">
		<?php echo $this->start_button( $post->ID ) ?>
		</div>
		<?php
		do_action( 'mkl_pc_admin_general_tab' );
		echo '</div>';
		
		// $this->editor();

	}

	public function product_variation_data_fields( $loop, $variation_data, $variation ) {
		global $wc_mkl_pc;
		?>
		<div class="toolbar">
		<?php
		woocommerce_wp_checkbox( 
			array( 
					'id' => MKL_PC_PREFIX.'_is_customizable',
					'wrapper_class' => 'is_customizable', 
					'class' => 'is_customizable',
					'label' => __( 'This variation is customizable', MKL_PC_DOMAIN ), 
					'description' => __( 'Select if you want this v to be customizable', MKL_PC_DOMAIN ) 
				) 
			);

		?>
		<?php echo $this->start_button( $variation->ID, $variation->post_parent ) ?>
		</div>
		<?php
	}
	public function home_tab() {
		?>
		<h2><?php _e( 'You are configuring "', MKL_PC_DOMAIN) ; echo get_the_title( $this->ID ) ?>"</h2>
		<?php echo get_the_post_thumbnail( $this->ID, 'thumbnail' ); ?>
		<p><?php _e('To proceed, follow the instructions:', MKL_PC_DOMAIN ); ?></p>
		<ol>
		<li><?php _e( 'define the structure of the product in <strong>Layers</strong>', MKL_PC_DOMAIN) ?></li>
		<li><?php _e( 'define the views / angles in which your product will be visible in  <strong>Views</strong>', MKL_PC_DOMAIN) ?></li>
		<li><?php _e( 'add the Images for each of your choices in  <strong>Content</strong>', MKL_PC_DOMAIN) ?></li>
		</ol>
		<?php 
	}

	public function editor() {
		global $post;
		
		if ( !$this->_current_screen_is( 'product' ) ) return false;

		// exit early if we don't have a post (Problem found using Yith Product addons plugin)
		if( ! $post ) return;

		$this->ID = $post->ID;
		$this->_product = wc_get_product( $this->ID ); 

		$structure = get_post_meta( $this->ID, MKL_PC_PREFIX.'structure', true );
		// $menu = $this->get_editor_menu( $structure );
		$data = json_encode( $structure );
		$product_type = $this->_product->get_type(); 
		
		include( 'views/html-product-customizer-templates.php' );

	}


	public function load_scripts() {
		$scripts = array(
			array('admin', 'admin.js'),
			//MODELS
			array('backbone/models/state', 'models/state.js'),
			array('backbone/models/choice', 'models/choice.js'),
			array('backbone/models/layer', 'models/layer.js'),
			array('backbone/models/product', 'models/product.js'),
			array('backbone/models/admin', 'models/admin.js'),
			//COLLECTIONS
			array('backbone/collections/layers', 'collections/layers.js'),
			array('backbone/collections/angles', 'collections/angles.js'),
			array('backbone/collections/choices', 'collections/choices.js'),
			array('backbone/collections/states', 'collections/states.js'),
			array('backbone/collections/products', 'collections/products.js'),
			//VIEWS
			array('backbone/views/home', 'views/customizer_home.js'),
			array('backbone/views/layers', 'views/layers.js'),
			array('backbone/views/choices', 'views/choices.js'),
			array('backbone/views/states', 'views/states.js'),
			array('backbone/views/angles', 'views/angles.js'),
			array('backbone/views/content', 'views/content.js'),
			array('backbone/views/import', 'views/import.js'),
			array('backbone/views/app', 'views/app.js'),
			//APP
			array('backbone/app', 'pc_app.js'), 
			// array('backbone', 'admin.js'),
		);

		if( $this->_current_screen_is( 'product' ) ) {

			wp_enqueue_style( 'mlk_pc/admin', MKL_PC_ASSETS_URL.'admin/css/admin.css' , false, MKL_PC_VERSION );
			
			// wp_enqueue_script( 'mkl_pc/js/admin', $this->plugin->assets_path.'admin/js/admin.js', array('jquery'), MKL_PC_VERSION, true );
			// TO ADD OR REMOVE DEFAULT SCRIPTS, only works for scripts in the plugins JS folder
			$scripts = apply_filters( 'mkl_pc_admin_scripts', $scripts );

			wp_enqueue_script( 'jquery-ui-accordion' );
			// LOAD BACKBONE SCRIPTS
			foreach($scripts as $script) {
				list( $key, $file ) = $script;
				wp_enqueue_script( 'mkl_pc/js/admin/' . $key, MKL_PC_ASSETS_URL . 'admin/js/'. $file , array('jquery', 'backbone'), MKL_PC_VERSION, true );
			}

			wp_localize_script( 'mkl_pc/js/admin/backbone/app', 'PC_lang', array(
				'media_title' => __('Select a picture', MKL_PC_DOMAIN ),
				'media_select_button' => __('Choose', MKL_PC_DOMAIN ),
				'layers_new_placeholder' => __('New Layer Name', MKL_PC_DOMAIN),
				'angles_new_placeholder' => __('New Angle Name', MKL_PC_DOMAIN),
				'choice_new_placeholder' => __('New Choice Name', MKL_PC_DOMAIN),
			));

			do_action( 'mkl_pc_admin_scripts_product_page' );
		}
	}

	/**
	 * Check if the current screen is a certain post type
	 *
	 * @param string $name - The screen post tyme
	 * @return boolean
	 */
	private function _current_screen_is( $name ) {
		$screen = get_current_screen();
		return $screen->post_type === $name;
	}

	/**
	 * Save a product's settigns
	 *
	 * @param integer $post_id
	 * @return void
	 */
	public function save_product_setting( $post_id ) {
		$_is_customizable = isset( $_POST[MKL_PC_PREFIX.'_is_customizable'] ) ? 'yes' : 'no';
		update_post_meta( $post_id, MKL_PC_PREFIX.'_is_customizable', $_is_customizable );
	}	

	public function start_button($id, $parent_id = NULL) {
		ob_start();
		?>
			<a href="#" class="button-primary start-customization show_if_is_customizable" data-product-id="<?php echo $id ?>" <?php echo ($parent_id !== NULL) ? 'data-parent-id="' . $parent_id . '"' : ''; ?>><?php _e("Configure product's customizer", MKL_PC_DOMAIN) ?></a>
		<?php 
		$return = ob_get_clean();
		return $return;
	}

	public function edit_button( $id = NULL, $type = NULL ) {
		if( $id && $type ) {
			return '<a href="#" class="button launch-customizer-editor" data-product-id="'.$id.'" data-product-type="'.$type.'">' . __('Edit customizer layers', MKL_PC_DOMAIN ) . '</a>';
		} else {
			return '';
		}
	}

	/**
	 * Write the configuration to the cache
	 *
	 * @param [type] $id
	 * @return void
	 */
	public function write_configuration_cache( $id ) {
		Plugin::instance()->cache->save_config_file( $id );
	}
}
