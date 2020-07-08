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

if ( ! class_exists('MKL\PC\Admin_Product') ) {
	class Admin_Product {

		public function __construct() {
			$this->_hooks();
		}

		/**
		 * Setup hooks
		 *
		 * @return void
		 */
		private function _hooks() {
			// add_action( 'woocommerce_product_data_panels', array( $this, 'add_pc_settings_tab_content' ) );
			add_action( 'mkl_pc_saved_product_configuration', array( $this, 'write_configuration_cache' ), 20, 1 );
			// add the checkbox to activate configurator on the product
			add_action( 'woocommerce_product_options_general_product_data', array($this, 'add_wc_general_product_data_fields') );
			add_action( 'mkl_pc_admin_home_tab', array( $this, 'home_tab') );
			add_action( 'admin_footer', array($this, 'editor' ) ); 
			add_action( 'admin_enqueue_scripts', array( $this, 'load_scripts' ) ); 
			add_action( 'mkl_pc_is_loaded', array( $this, 'init' ), 200 ); 

		}

		/**
		 * Plugins loaded
		 *
		 * @return void
		 */
		public function init() {
			// Supported product types
			$product_types = apply_filters( 'mkl_pc_woocommerce_product_types', array('simple') );
			foreach( $product_types as $product_type ) {
				add_action( 'woocommerce_process_product_meta_' . $product_type, array( $this, 'save_product_setting' ) );
			}
		}

		/**
		 * Add the settings
		 *
		 * @return void
		 */
		public function add_pc_settings_tab_content() {
			?>
			<div id="configurable_product_options" class="panel wc-metaboxes-wrapper">
				<?php 
				do_action( 'woocommerce_product_configurator_options' );
				?>
			</div>

			<?php
		}

		/**
		 * Add the setting to WooCommerce
		 *
		 * @return void
		 */
		public function add_wc_general_product_data_fields() {
			global $post;

			echo '<div class="options_group wc-metaboxes-wrapper '. join( ' ', apply_filters( 'mkl_wc_general_metaboxe_classes', array('show_if_simple') ) ) .'">';

			woocommerce_wp_checkbox( 
				array( 
						'id' => MKL_PC_PREFIX.'_is_configurable',
						'wrapper_class' => join( ' ', apply_filters( 'mkl_wc_general_metaboxe_classes', array('show_if_simple') ) ) .' is_configurable', 
						'class' => 'is_configurable',
						'label' => __( 'This product is configurable', MKL_PC_DOMAIN ), 
						'description' => __( 'Select if you want this product to be configurable', MKL_PC_DOMAIN ) 
					) 
				);

			?>
			<div class="toolbar show_if_simple">
			<?php echo $this->start_button( $post->ID ) ?>
			</div>
			<?php
			do_action( 'mkl_pc_admin_general_tab' );
			echo '</div>';
			
		}

		/**
		 * Home tab content, displayed in the product configurator editor modal
		 *
		 * @return void
		 */
		public function home_tab() {
			?>
			<div class="instructions">
				<h2><?php _e( 'You are configuring', MKL_PC_DOMAIN ); echo ' "' . get_the_title( $this->ID ); ?>"</h2>
				<?php echo get_the_post_thumbnail( $this->ID, 'thumbnail' ); ?>
				<p><?php _e( 'To proceed, follow the instructions:', MKL_PC_DOMAIN ); ?></p>
				<ol>
				<li><?php printf( __( 'define the structure of the product in %sLayers%s', MKL_PC_DOMAIN ), '<strong>', '</strong>' ); ?></li>
				<li><?php printf( __( 'define the views / angles in which your product will be visible in %sViews%s', MKL_PC_DOMAIN ), '<strong>', '</strong>' ); ?></li>
				<li><?php printf( __( 'add the Images for each of your choices in %sContent%s', MKL_PC_DOMAIN ), '<strong>', '</strong>' ); ?></li>
				</ol>
			</div>
			<div class="more">
				<h2><span class="dashicons dashicons-admin-plugins"></span> <?php _e( 'Do you need more functionality?', MKL_PC_DOMAIN) ; ?></h2>
				<p><a href="<?php echo admin_url( 'options-general.php?page=mkl_pc_settings&tab=addons' ); ?>"><?php _e( 'Check out the available addons and themes.', MKL_PC_DOMAIN ); ?></a></p>
				<h2><span class="dashicons dashicons-star-filled"></span> <?php _e( 'Do you like the plugin?', MKL_PC_DOMAIN) ; ?></h2>
				<p><?php printf( __( 'Give it a review on %swordpress.org%s', MKL_PC_DOMAIN ), '<a target="_blank" href="https://wordpress.org/support/plugin/product-configurator-for-woocommerce/reviews/#new-post">', '</a>' ); ?></p>
				<h2><span class="dashicons dashicons-admin-comments"></span> <?php _e( 'Do you think it could be improved?', MKL_PC_DOMAIN ); ?></h2>
				<p><?php printf( __( 'Start a support topic on %swordpress.org%s', MKL_PC_DOMAIN ), '<a target="_blank" href="https://wordpress.org/support/plugin/product-configurator-for-woocommerce/#new-topic-0">', '</a>' ); ?></p>
			</div>
			<?php 
		}

		/**
		 * Add the editor markup to the footer of the products.
		 *
		 * @return void
		 */
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
			
			include 'views/html-product-configurator-templates.php';

		}

		/**
		 * Load the scripts
		 *
		 * @return void
		 */
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
				array('backbone/views/home', 'views/configurator_home.js'),
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

				// wp_enqueue_script( 'jquery-ui-accordion' );
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
			$_is_configurable = isset( $_POST[MKL_PC_PREFIX.'_is_configurable'] ) ? 'yes' : 'no';
			update_post_meta( $post_id, MKL_PC_PREFIX.'_is_configurable', $_is_configurable );
		}	

		/**
		 * Outputs the button to start the editor
		 *
		 * @param integer $id
		 * @param integer $parent_id
		 * @return string
		 */
		public function start_button($id, $parent_id = NULL) {
			ob_start();
			?>
				<a href="#" class="button-primary start-configuration show_if_is_configurable" data-product-id="<?php echo $id ?>" <?php echo ($parent_id !== NULL) ? 'data-parent-id="' . $parent_id . '"' : ''; ?>><?php _e("Start product's configurator", MKL_PC_DOMAIN) ?></a>
			<?php 
			$return = ob_get_clean();
			return $return;
		}

		/**
		 * Outputs the edit button
		 *
		 * @param integer $id   - Product ID
		 * @param string  $type - Product type
		 * @return string
		 */
		public function edit_button( $id = NULL, $type = NULL ) {
			if( $id && $type ) {
				return '<a href="#" class="button launch-configurator-editor" data-product-id="'.$id.'" data-product-type="'.$type.'">' . __('Edit configurator layers', MKL_PC_DOMAIN ) . '</a>';
			} else {
				return '';
			}
		}

		/**
		 * Write the configuration to the cache
		 *
		 * @param integer $id
		 * @return void
		 */
		public function write_configuration_cache( $id ) {
			Plugin::instance()->cache->save_config_file( $id );
		}
	}
}