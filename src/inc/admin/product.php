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

		public $ID;
		private $_product;
		private $should_update_cache = false;
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
			add_action( 'mkl_pc_saved_product_configuration', array( $this, 'write_configuration_cache' ), 100, 1 );
			add_action( 'woocommerce_ajax_save_product_variations', array( $this, 'write_configuration_cache' ), 100, 1 );
			add_action( 'wp_ajax_mkl_pc_hide_addon_setting', array( $this, 'hide_addon_setting' ) );
			// woocommerce_ajax_save_product_variations
			add_action( 'woocommerce_after_product_object_save', array( $this, 'write_configuration_cache_on_product_save' ), 100, 1 );
			add_action( 'woocommerce_before_product_object_save', array( $this, 'check_before_product_save' ), 100, 1 );

			// add the checkbox to activate configurator on the product
			add_action( 'mkl_pc_is_loaded', array( $this, 'init' ), 200 ); 
			add_action( 'admin_enqueue_scripts', array( $this, 'load_scripts' ) ); 
			add_action( 'woocommerce_product_options_general_product_data', array($this, 'add_wc_general_product_data_fields') );
			add_action( 'mkl_pc_admin_home_tab', array( $this, 'home_tab') );
			add_action( 'admin_footer', array($this, 'editor' ) ); 

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
		 * Plugins loaded
		 *
		 * @return void
		 */
		public function init_product_data() {
			global $post;
			
			if ( ! $this->_current_screen_is( 'product' ) ) return false;

			// exit early if we don't have a post (Problem found using Yith Product addons plugin)
			if ( ! $post ) return;

			$this->ID = $post->ID;
			$this->_product = wc_get_product( $this->ID ); 
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
						'label' => __( 'This product is configurable', 'product-configurator-for-woocommerce' ), 
						'description' => __( 'Select if you want this product to be configurable', 'product-configurator-for-woocommerce' ),
					) 
				);

				?>
				<div class="show_if_is_configurable">
				
					<?php

					do_action( 'mkl_pc_admin_general_tab_before_start_button' );
					
					?>

					<div class="toolbar show_if_simple show_if_redq_rental show_if_variable start_button_container">
						<?php echo $this->start_button( $post->ID ) ?>
					</div>

					<?php

					do_action( 'mkl_pc_admin_general_tab' );

					?>
				</div>
			</div>

			<?php
		}

		/**
		 * Home tab content, displayed in the product configurator editor modal
		 *
		 * @return void
		 */
		public function home_tab() {
			?>
			<div class="instructions">
				<h2><?php _e( 'You are configuring', 'product-configurator-for-woocommerce' ); echo ' "' . get_the_title( $this->ID ); ?>"</h2>
				<?php echo get_the_post_thumbnail( $this->ID, 'thumbnail' ); ?>
				<p><?php _e( 'To proceed, follow the instructions:', 'product-configurator-for-woocommerce' ); ?></p>
				<ol>
				<li><?php printf( __( 'define the structure of the product in %sLayers%s', 'product-configurator-for-woocommerce' ), '<strong>', '</strong>' ); ?></li>
				<li><?php printf( __( 'define the views / angles in which your product will be visible in %sViews%s', 'product-configurator-for-woocommerce' ), '<strong>', '</strong>' ); ?></li>
				<li><?php printf( __( 'add the Images for each of your choices in %sContent%s', 'product-configurator-for-woocommerce' ), '<strong>', '</strong>' ); ?></li>
				</ol>
				<?php do_action( 'mkl_pc_admin_instructions_after', $this->ID ); ?>
			</div>
			<div class="more">
				<h2><span class="dashicons dashicons-admin-plugins"></span> <?php _e( 'Do you need more functionality?', 'product-configurator-for-woocommerce') ; ?></h2>
				<p><a href="<?php echo admin_url( 'options-general.php?page=mkl_pc_settings&tab=addons' ); ?>"><?php _e( 'Check out the available addons and themes.', 'product-configurator-for-woocommerce' ); ?></a></p>
				<h2><span class="dashicons dashicons-star-filled"></span> <?php _e( 'Do you like the plugin?', 'product-configurator-for-woocommerce') ; ?></h2>
				<p><?php printf( __( 'Give it a review on %swordpress.org%s', 'product-configurator-for-woocommerce' ), '<a target="_blank" href="https://wordpress.org/support/plugin/product-configurator-for-woocommerce/reviews/#new-post">', '</a>' ); ?></p>
				<h2><span class="dashicons dashicons-admin-comments"></span> <?php _e( 'Do you think it could be improved?', 'product-configurator-for-woocommerce' ); ?></h2>
				<p><?php printf( __( 'Start a support topic on %swordpress.org%s', 'product-configurator-for-woocommerce' ), '<a target="_blank" href="https://wordpress.org/support/plugin/product-configurator-for-woocommerce/#new-topic-0">', '</a>' ); ?></p>
			</div>
			<?php 
		}

		/**
		 * Add the editor markup to the footer of the products.
		 *
		 * @return void
		 */
		public function editor() {
			if ( ! $this->_current_screen_is( 'product' ) ) return false;
			if ( ! $this->_product ) return;

			$structure = get_post_meta( $this->ID, MKL_PC_PREFIX.'structure', true );
			// Make variables available to the included template
			$data = json_encode( $structure );
			$product_type = $this->_product->get_type(); 
			
			include_once 'views/html-product-configurator-templates.php';

		}

		/**
		 * Load the scripts
		 *
		 * @return void
		 */
		public function load_scripts() {
			$this->init_product_data();
			wp_enqueue_script( 'wp-hooks' );
			wp_register_script( 'pixijs', MKL_PC_ASSETS_URL . 'js/vendor/pixi.min.js', [], '6.0.1', true );

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
				array('backbone/views/product_selector', 'views/product_selector.js'),
				//APP
				array('backbone/app', 'pc_app.js'), 
				// array('backbone', 'admin.js'),
			);

			if ( $this->_current_screen_is( 'product' ) || $this->_current_screen_is( 'shop_order' ) ) {
				wp_enqueue_style( 'mlk_pc/admin', MKL_PC_ASSETS_URL.'admin/css/admin.css' , [], filemtime( MKL_PC_ASSETS_PATH . 'admin/css/admin.css' ) );
			}

			if ( $this->_current_screen_is( 'product' ) ) {

				
				// wp_enqueue_script( 'mkl_pc/js/admin', $this->plugin->assets_path.'admin/js/admin.js', array('jquery'), MKL_PC_VERSION, true );
				// TO ADD OR REMOVE DEFAULT SCRIPTS, only works for scripts in the plugins JS folder
				$scripts = apply_filters( 'mkl_pc_admin_scripts', $scripts );

				// wp_enqueue_script( 'jquery-ui-accordion' );
				// LOAD BACKBONE SCRIPTS
				foreach($scripts as $script) {
					list( $key, $file ) = $script;
					wp_enqueue_script( 'mkl_pc/js/admin/' . $key, MKL_PC_ASSETS_URL . 'admin/js/'. $file , array( 'jquery', 'backbone' ), filemtime( MKL_PC_ASSETS_PATH . 'admin/js/'. $file ), true );
				}

				$pc_lang = array(
					'media_title' => __( 'Select a picture', 'product-configurator-for-woocommerce' ),
					'media_select_button' => __( 'Choose', 'product-configurator-for-woocommerce' ),
					'layers_new_placeholder' => __( 'New Layer Name', 'product-configurator-for-woocommerce' ),
					'angles_new_placeholder' => __( 'New Angle Name', 'product-configurator-for-woocommerce' ),
					'choice_new_placeholder' => __( 'New Choice Name', 'product-configurator-for-woocommerce' ),
					'group_with_content_warning' => __( 'Changing the type to group will discard the content you already added to this layer.', 'product-configurator-for-woocommerce' ) . ' ' . __( 'Do you want to continue?', 'product-configurator-for-woocommerce' ),
					'angles_no_delete_message' => __( 'This item cannot be deleted: at least one view is required for the configurator to work', 'product-configurator-for-woocommerce' ),
					'enable_html_layers' => true,
					'use_steps' => mkl_pc( 'settings' )->get( 'use_steps', false ),
					'is_rest_enabled' => true,
					'rest_url' => get_rest_url(),
					'timeout' => (int) mkl_pc( 'settings' )->get( 'admin_save_timeout', 30000, true ),
					'user_preferences_nonce' => wp_create_nonce( 'mkl_pc_user_preferences' ),
					'languages' => mkl_pc( 'languages' )->get_languages(),
					'default_language' => mkl_pc( 'languages' )->get_default_language(),
				);

				if ( current_user_can( 'edit_post', $this->ID ) ) $pc_lang['update_nonce'] = wp_create_nonce( 'update-pc-post_' . $this->ID );
				if ( current_user_can( 'delete_post', $this->ID ) ) $pc_lang['delete_nonce'] = wp_create_nonce( 'delete-pc-post_' . $this->ID );

				wp_localize_script( 'mkl_pc/js/admin/backbone/app', 'PC_lang', apply_filters( 'PC_lang', $pc_lang ) );
				
		
				wp_add_inline_script( 'underscore', "
					var PC = PC || {};
					PC._us = _;
				", 'after' );
					
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
			
			return $screen->post_type === $name && 'post' === $screen->base;
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
				<a href="#" class="button-primary start-configuration" data-product-id="<?php echo $id ?>" <?php echo ($parent_id !== NULL) ? 'data-parent-id="' . $parent_id . '"' : ''; ?>><?php _e("Start product's configurator", 'product-configurator-for-woocommerce') ?></a>
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
				return '<a href="#" class="button launch-configurator-editor" data-product-id="'.$id.'" data-product-type="'.$type.'">' . __('Edit configurator layers', 'product-configurator-for-woocommerce' ) . '</a>';
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
			if ( ! mkl_pc_is_configurable( $id ) ) return;
			Plugin::instance()->cache->save_config_file( $id );
		}

		/**
		 * Write the configuration to the cache when saving a product
		 *
		 * @param WC_Product $obj
		 * @return void
		 */
		public function write_configuration_cache_on_product_save( $obj ) {
			if ( $this->should_update_cache ) {
				$this->should_update_cache = false;
				$this->write_configuration_cache( $obj->get_id() );
			}
		}

		/**
		 * Check for changes to enable cache updating or not
		 *
		 * @param WC_Product $obj
		 * @return void
		 */
		public function check_before_product_save( $obj ) {
			if ( $obj->get_id() ) {
				$changes = $obj->get_changes();
				if ( ! empty( $changes ) ) {
					$this->should_update_cache = true;
				}
			}
		}

		/**
		 * Saves the user setting when hidding the add-on adverts from within the choices' admin
		 *
		 * @return void
		 */
		public function hide_addon_setting() {
			if ( ! wp_verify_nonce( sanitize_key( $_REQUEST['security'] ), 'mkl_pc_user_preferences' ) ) wp_send_json_error('', 401 );
			$setting_name = sanitize_key( $_REQUEST[ 'setting' ] );
			delete_user_meta( get_current_user_id(), 'mkl_pc_hide_addon__' . $setting_name );
			update_user_meta( get_current_user_id(), 'mkl_pc_hide_addon__' . $setting_name, 1 );
			wp_send_json_success();
		}

	}
}