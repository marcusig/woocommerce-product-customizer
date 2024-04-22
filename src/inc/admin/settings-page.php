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
			add_action( 'admin_footer', array( $this, 'add_backbone_templates' ), 20 );
			add_action( 'admin_enqueue_scripts', array( $this, 'scripts') );
			// add_action( 'woocommerce_settings_' . sanitize_title( $this->settings_id ) . '_after', array( $this, 'wc_settings_after' ), 20 );
			add_filter( 'plugin_action_links_' . MKL_PC_PLUGIN_BASE_NAME, array( $this, 'plugin_settings_link' ) );
			add_action( 'update_option_mkl_pc__settings' , array( $this, 'updated_settings' ), 20 );
		}

		/**
		 * Purge the cache when the settings were updated
		 *
		 * @return void
		 */
		public function updated_settings() {
			if ( ! isset( $_REQUEST['option_page'] ) || 'mlk_pc_settings' != $_REQUEST['option_page'] ) return;
			mkl_pc( 'cache' )->purge();
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
			$page_title = __( 'Configurator settings', 'product-configurator-for-woocommerce' );
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

		private function get_setting( $setting = '', $default = false ) {
			return mkl_pc( 'settings' )->get( $setting, $default );
		}

		public function display() {
			$active = isset( $_REQUEST['tab'] ) ? sanitize_key( $_REQUEST['tab'] ) : 'settings';
			$tabs = apply_filters( 'mkl_pc_settings_tabs', [
				'settings' => __( 'Settings', 'product-configurator-for-woocommerce' ),
				'addons' => __( 'Addons', 'product-configurator-for-woocommerce' ),
				'tools' => __( 'Tools', 'product-configurator-for-woocommerce' ),
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
							
							global $wp_settings_sections, $wp_settings_fields;

							if ( isset( $wp_settings_sections[ 'mlk_pc_settings' ] ) ) {
														
								foreach ( (array) $wp_settings_sections[ 'mlk_pc_settings' ] as $section ) {
									// if ( 'labels' == $section['id'] ) continue;
									echo '<section id="' . $section['id'] .'">';
										if ( $section['title'] ) {
											echo "<h2>{$section['title']}</h2>\n";
										}
								
										if ( $section['callback'] ) {
											call_user_func( $section['callback'], $section );
										}
								
										if ( ! isset( $wp_settings_fields ) || ! isset( $wp_settings_fields[ 'mlk_pc_settings' ] ) || ! isset( $wp_settings_fields[ 'mlk_pc_settings' ][ $section['id'] ] ) ) {
											continue;
										}
										echo '<table class="form-table" role="presentation">';
										do_settings_fields( 'mlk_pc_settings', $section['id'] );
										echo '</table>';
									echo '</section>';
								}
								submit_button();
							}

						?>
					</form>
				</div>

				<div class="mkl-settings-content" data-content="addons">
					<h2><?php _e( 'Addons', 'product-configurator-for-woocommerce' ); ?></h2>
					<?php $this->display_addons(); ?>
				</div>
				<div class="mkl-settings-content" data-content="tools">
					<h2><?php _e( 'Tools', 'product-configurator-for-woocommerce' ); ?></h2>
					<hr>
					<h3><?php _e( 'Configuration cache', 'product-configurator-for-woocommerce' ); ?></h3>
					<p>
						<?php _e( 'The product configurations are cached on the disk for better performance.', 'product-configurator-for-woocommerce' ); ?>
						<br><?php _e( 'The cache is refreshed every time you save the product or the configuration.', 'product-configurator-for-woocommerce' ); ?>
						<br><?php _e( 'Using the button bellow, you can purge all the configuration cache.', 'product-configurator-for-woocommerce' ); ?>
						<br><em><?php _e( '(The cache will be rebuilt the next time the file is requested)', 'product-configurator-for-woocommerce' ); ?></em>
					</p>
					<button type="button" class="button mkl-settings-purge-config-cache"><?php _e( 'Purge configuration cache', 'product-configurator-for-woocommerce' ); ?></button>

					<h3><?php _e( 'Fix images', 'product-configurator-for-woocommerce' ); ?></h3>
					<div class="configurable-products-list">
						<div class="notice notice-warning below-h2">
							<p>
								<?php _e( 'This feature is experimental, please backup your database before using it!', 'product-configurator-for-woocommerce' ); ?>
								<br><small><a href="https://wordpress.org/plugins/updraftplus/"><?php _e( 'I recommend UpdraftPlus for your backups.', 'product-configurator-for-woocommerce' ); ?></a></small>
							</p>
						</div>
						<p>
							<?php _e( 'If you imported a configurable product and the images do not match, you can try fixing the relationships with this tool.', 'product-configurator-for-woocommerce' ); ?>
						</p>
						<p>
							<?php _e( 'How it works:', 'product-configurator-for-woocommerce' ); ?>
							<br><?php _e( 'This tool looks for the pictures present in the configurator, and checks whether they are in the media library.', 'product-configurator-for-woocommerce' ); ?>
							<br><?php _e( 'If no exact match is found, it looks for an image with the same file name, and updates the attachment ID in the configurator data.', 'product-configurator-for-woocommerce' ); ?>
						</p>
						<p>
							<label for="configurable-products"><?php _e( 'Select a configurable product:', 'product-configurator-for-woocommerce' ); ?></label>
							<br><select id="configurable-products" style="width: 300px;"></select>
						</p>
						<button type="button" class="button mkl-settings-scan-images"><?php _e( 'Scan images', 'product-configurator-for-woocommerce' ); ?></button>
					</div>

					<h3><?php _e( 'Configuration images', 'product-configurator-for-woocommerce' ); ?></h3>
					<?php $show_configs = mkl_pc( 'settings' )->get( 'show_config_images_in_the_library', true ); ?>
					<button type="button" class="button mkl-settings-toggle-images-in-library" data-mode="<?php echo $show_configs ? 'hide' : 'show' ;?>">
						<span class="hide-configurations-label"><?php _e( 'Hide the images generated by the configurator in the media library', 'product-configurator-for-woocommerce' ); ?></span>
						<span class="show-configurations-label"><?php _e( 'Show the images generated by the configurator in the media library', 'product-configurator-for-woocommerce' ); ?></span>
					</button>
				</div>

				<?php do_action( 'mkl_pc_settings_content_after', $active ); ?>

			</div>
			<?php
		}

		
		public function init() {

			register_setting( 'mlk_pc_settings', 'mkl_pc__settings' );

			add_settings_section(
				'settings_section', 
				__( 'Styling options', 'product-configurator-for-woocommerce' ), 
				function() {},
				'mlk_pc_settings'
			);
		
			add_settings_field(
				'mkl_pc__button_classes', 
				__( 'Button classes', 'product-configurator-for-woocommerce' ),
				[ $this, 'callback_text_field' ],
				'mlk_pc_settings', 
				'settings_section',
				[ 
					'setting_name' => 'mkl_pc__button_classes',
					'placeholder' => 'btn btn-primary'
				]
			);

			add_settings_field(
				'mkl_pc__button_label', 
				__( 'Configure button label', 'product-configurator-for-woocommerce' ),
				[ $this, 'callback_text_field' ],
				'mlk_pc_settings', 
				'settings_section',
				[ 
					'setting_name' => 'mkl_pc__button_label',
					'placeholder' => __( 'Default:', 'product-configurator-for-woocommerce' ) . ' ' . __( 'Configure', 'product-configurator-for-woocommerce' )
				]
			);

			add_settings_field(
				'mkl_pc__theme', 
				__( 'Configurator theme', 'product-configurator-for-woocommerce' ),
				[ $this, 'callback_theme_setting' ],
				'mlk_pc_settings', 
				'settings_section',
				[ 
					'setting_name' => 'mkl_pc__theme'
				]
			);

			// $options = get_option( 'mkl_pc__settings' );
			if ( 'wsb' == mkl_pc( 'settings' )->get_theme() ) {
				add_settings_field(
					'wsb_no_toggle',
					__( 'Always show the choices (no toggle)', 'product-configurator-for-woocommerce' ),
					[ $this, 'callback_checkbox' ],
					'mlk_pc_settings', 
					'settings_section',
					[ 
						'setting_name' => 'wsb_no_toggle',
					]
				);
			}
			
			add_settings_section(
				'general_settings', 
				__( 'General options', 'product-configurator-for-woocommerce' ), 
				function() { },
				'mlk_pc_settings'
			);

			add_settings_field(
				'configurator_images',
				__( 'Configurator images', 'product-configurator-for-woocommerce' ),
				[ $this, 'callback_html' ],
				'mlk_pc_settings', 
				'general_settings',
				[ 
					'html' => '',
					'class' => 'heading'
				]
			);

			$sizes = array_merge( [ 'full' ], get_intermediate_image_sizes() );
			add_settings_field(
				'preview_image_size',
				__( 'Preview Image size', 'product-configurator-for-woocommerce' ),
				[ $this, 'callback_select' ],
				'mlk_pc_settings', 
				'general_settings',
				[ 
					'options' => $sizes,
					'setting_name' => 'preview_image_size',
					'no_value' => true,
				]
			);

			add_settings_field(
				'thumbnail_size',
				__( 'Thumbnail size', 'product-configurator-for-woocommerce' ),
				[ $this, 'callback_select' ],
				'mlk_pc_settings', 
				'general_settings',
				[ 
					'options' => $sizes,
					'setting_name' => 'thumbnail_size',
					'no_value' => true,
					'description' => __( 'Size of the thumbnails in the sidebar', 'product-configurator-for-woocommerce' ),
				]
			);

			add_settings_field(
				'image_loading_mode',
				__( 'Lazy load images', 'product-configurator-for-woocommerce' ),
				[ $this, 'callback_select' ],
				'mlk_pc_settings', 
				'general_settings',
				[ 
					'options' => [
						'lazy' => __( 'Yes (default) - use an empty placeholder until the user selects a choice.', 'product-configurator-for-woocommerce' ),
						'eager' => __( 'No - load everything from the beginning.', 'product-configurator-for-woocommerce' ),
					],
					'default' => 'lazy',
					'setting_name' => 'image_loading_mode'
				]
			);

			add_settings_field(
				'display_options',
				__( 'Display options', 'product-configurator-for-woocommerce' ),
				[ $this, 'callback_html' ],
				'mlk_pc_settings', 
				'general_settings',
				[ 
					'html' => '',
					'class' => 'heading'
				]
			);

			add_settings_field(
				'show_price_in_configurator',
				__( 'Show the product\'s price in the configurator', 'product-configurator-for-woocommerce' ),
				[ $this, 'callback_checkbox' ],
				'mlk_pc_settings', 
				'general_settings',
				[ 
					'setting_name' => 'show_price_in_configurator',
				]
			);

			add_settings_field(
				'show_choice_description',
				__( 'Show choices\' description', 'product-configurator-for-woocommerce' ),
				[ $this, 'callback_checkbox' ],
				'mlk_pc_settings', 
				'general_settings',
				[ 
					'setting_name' => 'show_choice_description',
				]
			);

			add_settings_field(
				'choice_description_no_tooltip',
				__( 'Always show the description (no tooltip)', 'product-configurator-for-woocommerce' ),
				[ $this, 'callback_checkbox' ],
				'mlk_pc_settings', 
				'general_settings',
				[ 
					'setting_name' => 'choice_description_no_tooltip',
				]
			);

			add_settings_field(
				'show_layer_description',
				__( 'Show layers\' description', 'product-configurator-for-woocommerce' ),
				[ $this, 'callback_checkbox' ],
				'mlk_pc_settings', 
				'general_settings',
				[ 
					'setting_name' => 'show_layer_description',
				]
			);

			add_settings_field(
				'close_configurator_on_add_to_cart',
				__( 'Close the configurator when pressing "add to cart"', 'product-configurator-for-woocommerce' ),
				[ $this, 'callback_checkbox' ],
				'mlk_pc_settings', 
				'general_settings',
				[ 
					'setting_name' => 'close_configurator_on_add_to_cart',
					'description' => __( 'Helpful if submiting the form via ajax', 'product-configurator-for-woocommerce' )
				]
			);

			add_settings_field(
				'close_choices_when_selecting_choice',
				__( 'On mobile, close the choices when making a selection', 'product-configurator-for-woocommerce' ),
				[ $this, 'callback_checkbox' ],
				'mlk_pc_settings', 
				'general_settings',
				[ 
					'setting_name' => 'close_choices_when_selecting_choice',
				]
			);

			add_settings_field(
				'close_choices_when_selecting_choice_desktop',
				__( 'On desktop, close the choices when making a selection', 'product-configurator-for-woocommerce' ),
				[ $this, 'callback_checkbox' ],
				'mlk_pc_settings', 
				'general_settings',
				[ 
					'setting_name' => 'close_choices_when_selecting_choice_desktop',
				]
			);

			add_settings_field(
				'auto_close_siblings_in_groups',
				__( 'In layer groups, close the siblings when opening an other layer', 'product-configurator-for-woocommerce' ),
				[ $this, 'callback_checkbox' ],
				'mlk_pc_settings', 
				'general_settings',
				[ 
					'setting_name' => 'auto_close_siblings_in_groups',
				]
			);

			add_settings_field(
				'show_active_choice_in_layer',
				__( 'Show the selected label in the layer header', 'product-configurator-for-woocommerce' ),
				[ $this, 'callback_checkbox' ],
				'mlk_pc_settings', 
				'general_settings',
				[ 
					'setting_name' => 'show_active_choice_in_layer',
				]
			);

			add_settings_field(
				'show_active_choice_image_in_layer',
				__( 'Show the selected image in the layer header', 'product-configurator-for-woocommerce' ),
				[ $this, 'callback_checkbox' ],
				'mlk_pc_settings', 
				'general_settings',
				[ 
					'setting_name' => 'show_active_choice_image_in_layer',
				]
			);

			add_settings_field(
				'configure_button_location',
				__( 'Where should the "configure" button be placed', 'product-configurator-for-woocommerce' ),
				[ $this, 'callback_select' ],
				'mlk_pc_settings', 
				'general_settings',
				[ 
					'options' => [
						'woocommerce_single_product_summary:19' => __( 'Before the product excerpt', 'product-configurator-for-woocommerce' ),
						'woocommerce_before_add_to_cart_form:20' => __( 'Before the add to cart form', 'product-configurator-for-woocommerce' ),
						'woocommerce_before_add_to_cart_quantity:20' => __( 'Before the quantity input', 'product-configurator-for-woocommerce' ),
						'woocommerce_after_add_to_cart_button:20' => __( 'After the add to cart button', 'product-configurator-for-woocommerce' ),
						'woocommerce_after_add_to_cart_form:20' => __( 'After the add to cart form', 'product-configurator-for-woocommerce' ),
					],
					'default' => 'woocommerce_after_add_to_cart_form:20',
					'setting_name' => 'configure_button_location',
				]
			);

			add_settings_field(
				'show_reset_button',
				__( 'Show a reset button in the configurator', 'product-configurator-for-woocommerce' ),
				[ $this, 'callback_checkbox' ],
				'mlk_pc_settings', 
				'general_settings',
				[ 
					'setting_name' => 'show_reset_button',
				]
			);

			add_settings_field(
				'open_first_layer',
				__( 'Automatically open the first layer when starting the configurator', 'product-configurator-for-woocommerce' ),
				[ $this, 'callback_checkbox' ],
				'mlk_pc_settings', 
				'general_settings',
				[ 
					'setting_name' => 'open_first_layer',
				]
			);

			add_settings_field(
				'auto_scroll',
				__( 'Automatically scroll to the top of the opened layer (Supported themes only) ', 'product-configurator-for-woocommerce' ),
				[ $this, 'callback_checkbox' ],
				'mlk_pc_settings', 
				'general_settings',
				[ 
					'setting_name' => 'auto_scroll',
				]
			);

			add_settings_field(
				'choice_groups_toggle',
				__( 'Enable toggling of the choice groups', 'product-configurator-for-woocommerce' ),
				[ $this, 'callback_checkbox' ],
				'mlk_pc_settings', 
				'general_settings',
				[ 
					'setting_name' => 'choice_groups_toggle',
				]
			);

			add_settings_field(
				'display_options_angles',
				__( 'Angle display options', 'product-configurator-for-woocommerce' ),
				[ $this, 'callback_html' ],
				'mlk_pc_settings', 
				'general_settings',
				[ 
					'html' => '',
					'class' => 'heading'
				]
			);

			add_settings_field(
				'show_angle_image',
				__( 'Show angle/view image', 'product-configurator-for-woocommerce' ),
				[ $this, 'callback_checkbox' ],
				'mlk_pc_settings', 
				'general_settings',
				[ 
					'setting_name' => 'show_angle_image',
				]
			);

			add_settings_field(
				'show_angle_name',
				__( 'Show angle/view name', 'product-configurator-for-woocommerce' ),
				[ $this, 'callback_checkbox' ],
				'mlk_pc_settings', 
				'general_settings',
				[ 
					'setting_name' => 'show_angle_name',
				]
			);

			add_settings_field(
				'use_current_angle_in_cart_image',
				__( 'Use the active angle to generate the image in the cart', 'product-configurator-for-woocommerce' ),
				[ $this, 'callback_checkbox' ],
				'mlk_pc_settings', 
				'general_settings',
				[ 
					'setting_name' => 'use_current_angle_in_cart_image',
				]
			);

			add_settings_field(
				'swipe_to_change_view',
				__( 'The user can swipe right or left to change view', 'product-configurator-for-woocommerce' ),
				[ $this, 'callback_checkbox' ],
				'mlk_pc_settings', 
				'general_settings',
				[ 
					'setting_name' => 'swipe_to_change_view',
				]
			);

			add_settings_field(
				'image_gen_options',
				__( 'Image generation options', 'product-configurator-for-woocommerce' ),
				[ $this, 'callback_html' ],
				'mlk_pc_settings', 
				'general_settings',
				[ 
					'html' => '',
					'class' => 'heading'
				]
			);

			if ( ! Utils::check_image_requirements() ) {
				add_settings_field(
					'image_warning',
					__( 'Configuration image generation', 'product-configurator-for-woocommerce' ),
					function() {
						echo '<div class="notice error below-h2">
							<p>PHP Fileinfo extension must be installed/enabled for the plugin to be able to generate the images.</p>
						</div>';
					},
					'mlk_pc_settings', 
					'general_settings',
					[ 
						'setting_name' => 'image_warning',
					]
				);
				// "PHP Fileinfo extension must be installed/enabled to use Intervention Image."
			}

			add_settings_field(
				'show_image_in_cart',
				__( 'Show configuration image in cart and checkout', 'product-configurator-for-woocommerce' ),
				[ $this, 'callback_checkbox' ],
				'mlk_pc_settings', 
				'general_settings',
				[ 
					'setting_name' => 'show_image_in_cart',
				]
			);

			add_settings_field(
				'cart_thumbnail_size',
				__( 'Image size in the cart / checkout / order', 'product-configurator-for-woocommerce' ),
				[ $this, 'callback_select' ],
				'mlk_pc_settings', 
				'general_settings',
				[ 
					'options' => $sizes,
					'default' => 'woocommerce_thumbnail',
					'setting_name' => 'cart_thumbnail_size',
					'no_value' => true,
				]
			);			

			add_settings_field(
				'save_images', 
				__( 'Image mode', 'product-configurator-for-woocommerce' ),
				[ $this, 'callback_radio' ],
				'mlk_pc_settings', 
				'general_settings',
				[ 
					'setting_name' => 'save_images',
					'options' => [
						'save_to_disk' => __( 'Add images to the library', 'product-configurator-for-woocommerce' ),
						'on_the_fly' => __( 'Generate images on the fly', 'product-configurator-for-woocommerce' ),
					],
					'help' => [
						'save_to_disk' => __( '(can take a lot of space on the disk if you have many possible configurations)', 'product-configurator-for-woocommerce' ),
						'on_the_fly' => __( '(save disk space, but uses more server resource)', 'product-configurator-for-woocommerce' ),
					],
				]
			);

			add_settings_field(
				'force_image_in_checkout',
				__( 'Add product image to the checkout', 'product-configurator-for-woocommerce' ),
				[ $this, 'callback_checkbox' ],
				'mlk_pc_settings', 
				'general_settings',
				[ 
					'setting_name' => 'force_image_in_checkout',
				]
			);

			add_settings_field(
				'force_image_in_email',
				__( 'Add product image to the email', 'product-configurator-for-woocommerce' ),
				[ $this, 'callback_checkbox' ],
				'mlk_pc_settings', 
				'general_settings',
				[ 
					'setting_name' => 'force_image_in_email',
				]
			);


			add_settings_field(
				'sku_options',
				__( 'SKU', 'product-configurator-for-woocommerce' ),
				[ $this, 'callback_html' ],
				'mlk_pc_settings', 
				'general_settings',
				[ 
					'html' => '',
					'class' => 'heading'
				]
			);

			add_settings_field(
				'sku_mode',
				__( 'SKU mode', 'product-configurator-for-woocommerce' ),
				[ $this, 'callback_select' ],
				'mlk_pc_settings', 
				'general_settings',
				[ 
					'options' => [
						'individual' => __( 'Each choice can have its own SKU', 'product-configurator-for-woocommerce' ),
						'compound' => __( 'Generate a single SKU by compounding the SKU set in each selected choice', 'product-configurator-for-woocommerce' ),
					],
					'default' => 'individual',
					'setting_name' => 'sku_mode'
				]
			);

			add_settings_field(
				'sku_glue', 
				__( 'SKU devider (character used between the parts when compounding the SKU)', 'product-configurator-for-woocommerce' ),
				[ $this, 'callback_text_field' ],
				'mlk_pc_settings', 
				'general_settings',
				[ 
					'setting_name' => 'sku_glue',
					'placeholder' => 'Default to nothing'
				]
			);

			add_settings_field(
				'sku_label', 
				__( 'SKU label', 'product-configurator-for-woocommerce' ),
				[ $this, 'callback_text_field' ],
				'mlk_pc_settings', 
				'general_settings',
				[ 
					'setting_name' => 'sku_label',
					'placeholder' => 'Eg. SKU, Reference... (Default: SKU)'
				]
			);

			add_settings_field(
				'show_sku_in_cart',
				__( 'Show SKU in the cart and checkout', 'product-configurator-for-woocommerce' ),
				[ $this, 'callback_checkbox' ],
				'mlk_pc_settings', 
				'general_settings',
				[ 
					'setting_name' => 'show_sku_in_cart',
				]
			);

			add_settings_field(
				'misc_options',
				__( 'Miscellaneous', 'product-configurator-for-woocommerce' ),
				[ $this, 'callback_html' ],
				'mlk_pc_settings', 
				'general_settings',
				[ 
					'html' => '',
					'class' => 'heading'
				]
			);

			add_settings_field(
				'enable_default_add_to_cart',
				__( 'Allow adding the product to cart without configuring', 'product-configurator-for-woocommerce' ),
				[ $this, 'callback_checkbox' ],
				'mlk_pc_settings', 
				'general_settings',
				[ 
					'setting_name' => 'enable_default_add_to_cart',
				]
			);

			add_settings_field(
				'disable_caching',
				__( 'Disable caching of configurations', 'product-configurator-for-woocommerce' ),
				[ $this, 'callback_checkbox' ],
				'mlk_pc_settings', 
				'general_settings',
				[ 
					'setting_name' => 'disable_caching',
					'description'  => __( 'Can be usefull when using CDNs such as CloudFlare', 'mkl-pc-stock-management' ),
				]
			);

			add_settings_field(
				'disable_configuration_gzip',
				__( 'Disable GZIP compression of the configuration data (only affects the ajax request)', 'product-configurator-for-woocommerce' ),
				[ $this, 'callback_checkbox' ],
				'mlk_pc_settings', 
				'general_settings',
				[ 
					'setting_name' => 'disable_configuration_gzip',
				]
			);

			add_settings_field(
				'admin_save_timeout', 
				__( 'Timeout when saving the configuration in the admin', 'product-configurator-for-woocommerce' ),
				[ $this, 'callback_text_field' ],
				'mlk_pc_settings',
				'general_settings',
				[ 
					'setting_name' => 'admin_save_timeout',
					'placeholder' => 'Default: 30000 (milliseconds)',
					'type' => 'number',
					'default' => 30000
				]
			);
			
			// if ( mkl_pc( 'themes' )->current_theme_supports( 'steps' ) ) {
				add_settings_field(
					'use_steps',
					__( 'Use steps if possible', 'product-configurator-for-woocommerce' ),
					[ $this, 'callback_checkbox' ],
					'mlk_pc_settings', 
					'general_settings',
					[ 
						'setting_name' => 'use_steps',
						'description'  => '<a href="https://wc-product-configurator.com/docs/product-configurator-for-woocommerce/general-usage/using-the-steps-feature/" target="_blank">' . __( 'Check the documentation on how to use the steps feature', 'product-configurator-for-woocommerce' ) . '</a>',
					]
				);
				add_settings_field(
					'steps_use_layer_name',
					__( 'Use layer names for previous and next button labels', 'product-configurator-for-woocommerce' ),
					[ $this, 'callback_checkbox' ],
					'mlk_pc_settings', 
					'general_settings',
					[ 
						'setting_name' => 'steps_use_layer_name',
					]
				);
				add_settings_field(
					'steps_progress_enable_click_all',
					__( 'Make all steps clickable in the breadcrumb', 'product-configurator-for-woocommerce' ),
					[ $this, 'callback_checkbox' ],
					'mlk_pc_settings', 
					'general_settings',
					[ 
						'setting_name' => 'steps_progress_enable_click_all',
					]
				);
			// }

			/*
				LABELS
			*/

			add_settings_section(
				'labels',
				__( 'Other labels', 'product-configurator-for-woocommerce' ), 
				function() { },
				'mlk_pc_settings'
			);

			add_settings_field(
				'reset_configuration_label', 
				__( 'Reset configuration', 'product-configurator-for-woocommerce' ),
				[ $this, 'callback_text_field' ],
				'mlk_pc_settings', 
				'labels',
				[ 
					'setting_name' => 'reset_configuration_label',
					'placeholder' => __( 'Default:', 'product-configurator-for-woocommerce' ) . ' ' . __( 'Reset configuration', 'product-configurator-for-woocommerce' )
				]
			);

			add_settings_field(
				'edit_configuration_label', 
				__( 'Edit configuration', 'product-configurator-for-woocommerce' ),
				[ $this, 'callback_text_field' ],
				'mlk_pc_settings', 
				'labels',
				[ 
					'setting_name' => 'edit_configuration_label',
					'placeholder' => __( 'Default:', 'product-configurator-for-woocommerce' ) . ' ' . __( 'Edit configuration', 'product-configurator-for-woocommerce' )
				]
			);

			add_settings_field(
				'edit_item_in_cart', 
				__( 'Edit item in cart', 'product-configurator-for-woocommerce' ),
				[ $this, 'callback_text_field' ],
				'mlk_pc_settings', 
				'labels',
				[ 
					'setting_name' => 'edit_item_in_cart',
					'placeholder' => __( 'Default:', 'product-configurator-for-woocommerce' ) . ' ' . __( 'Edit item in cart', 'product-configurator-for-woocommerce' )
				]
			);

			add_settings_field(
				'download_config_image', 
				__( 'Download configuration image', 'product-configurator-for-woocommerce' ),
				[ $this, 'callback_text_field' ],
				'mlk_pc_settings', 
				'labels',
				[ 
					'setting_name' => 'download_config_image',
					'placeholder' => __( 'Default:', 'product-configurator-for-woocommerce' ) . ' ' . __( 'Download configuration image', 'product-configurator-for-woocommerce' )
				]
			);

			add_settings_field(
				'view_configuration', 
				__( 'View configuration', 'product-configurator-for-woocommerce' ),
				[ $this, 'callback_text_field' ],
				'mlk_pc_settings', 
				'labels',
				[ 
					'setting_name' => 'view_configuration',
					'placeholder' => __( 'Default:', 'product-configurator-for-woocommerce' ) . ' ' . __( 'View configuration', 'product-configurator-for-woocommerce' )
				]
			);

			add_settings_field(
				'configuration_cart_meta_label', 
				__( 'Configuration (meta label in the cart)', 'product-configurator-for-woocommerce' ),
				[ $this, 'callback_text_field' ],
				'mlk_pc_settings', 
				'labels',
				[ 
					'setting_name' => 'configuration_cart_meta_label',
					'placeholder' => __( 'Default:', 'product-configurator-for-woocommerce' ) . ' ' . __( 'Configuration', 'product-configurator-for-woocommerce' )
				]
			);

			add_settings_field(
				'loading_configurator_message',
				__( 'Loading message (displayed when the configurator is loading, in inline mode)', 'product-configurator-for-woocommerce' ),
				[ $this, 'callback_text_field' ],
				'mlk_pc_settings',
				'labels',
				[
					'setting_name' => 'loading_configurator_message',
					'placeholder' => __( 'Default:', 'product-configurator-for-woocommerce' ) . ' ' . __( 'Loading the configurator...', 'product-configurator-for-woocommerce' )
				]
			);

			add_settings_field(
				'angle_switch_label',
				__( 'Angle switch label', 'product-configurator-for-woocommerce' ),
				[ $this, 'callback_text_field' ],
				'mlk_pc_settings',
				'labels',
				[
					'setting_name' => 'angle_switch_label',
					'placeholder' => __( 'Default:', 'product-configurator-for-woocommerce' ) . ' ' . __( 'Change angle', 'product-configurator-for-woocommerce' )
				]
			);

			add_settings_field(
				'previous_step_label',
				__( 'Previous step label', 'product-configurator-for-woocommerce' ),
				[ $this, 'callback_text_field' ],
				'mlk_pc_settings',
				'labels',
				[
					'setting_name' => 'previous_step_label',
					'placeholder' => __( 'Default:', 'product-configurator-for-woocommerce' ) . ' ' . _x( 'Previous', 'Previous step button label', 'product-configurator-for-woocommerce' )
				]
			);

			add_settings_field(
				'next_step_label',
				__( 'Next step label', 'product-configurator-for-woocommerce' ),
				[ $this, 'callback_text_field' ],
				'mlk_pc_settings',
				'labels',
				[
					'setting_name' => 'next_step_label',
					'placeholder' => __( 'Default:', 'product-configurator-for-woocommerce' ) . ' ' . _x( 'Next', 'Next step button label', 'product-configurator-for-woocommerce' )
				]
			);

			// Translatepress options
			if ( function_exists( 'trp_translate' ) ) {
				add_settings_section(
					'translatepress',
					'TranslatePress', 
					function() { },
					'mlk_pc_settings'
				);
				
				add_settings_field(
					'disable_translatepress_dynamic_translation',
					__( 'Disable TranslatePress Dynamic translation for the condigurator', 'product-configurator-for-woocommerce' ),
					[ $this, 'callback_checkbox' ],
					'mlk_pc_settings', 
					'translatepress',
					[ 
						'setting_name' => 'disable_translatepress_dynamic_translation',
						'description' => __( 'Activate this setting if you wish to translate the configuration data from within the configurator', 'product-configurator-for-woocommerce' )
					]
				);
			}

			do_action( 'mkl_pc/register_settings', $this );
		}

		public function styling_section_callback() {
			// echo __( 'This section description', 'product-configurator-for-woocommerce' );
		}

		public function callback_theme_setting( $field_options = [] ) {
			$options = get_option( 'mkl_pc__settings' );
			if ( ! isset( $field_options[ 'setting_name' ] ) ) return;
			?>
			<div class="theme_setting">
				<div class="theme_setting_view"></div>
				<input type='hidden' name='mkl_pc__settings[<?php echo $field_options['setting_name']; ?>]' value='<?php echo isset( $options[$field_options[ 'setting_name' ] ] ) ? $options[$field_options[ 'setting_name' ] ] : ''; ?>'>
			</div>
			<p><a href="<?php echo add_query_arg( [ 'autofocus[section]' => 'mlk_pc', 'return' => urlencode( esc_url_raw( remove_query_arg( wp_removable_query_args(), wp_unslash( $_SERVER['REQUEST_URI'] ) ) ) ) ], wp_customize_url() ); ?>"><?php _e( 'Edit the theme settings in the customizer', 'product-configurator-for-woocommerce' ); ?></a></p>
			<?php
		}

		public function callback_html( $field_options = [] ) {
			if ( ! isset( $field_options[ 'html' ] ) ) return;
			echo wp_kses_post( $field_options[ 'html' ] );
		}

		public function callback_text_field( $field_options = [] ) {
			$options = get_option( 'mkl_pc__settings' );
			if ( ! isset( $field_options[ 'setting_name' ] ) ) return;
			if ( isset( $field_options[ 'type' ] ) && in_array( $field_options[ 'type' ], [ 'text', 'number', 'password', 'email' ] ) ) {
				$type = $field_options[ 'type' ];
			} else {
				$type = 'text';
			}
			?>
			<input <?php echo isset( $field_options[ 'placeholder' ] ) ? 'placeholder="' . esc_attr( $field_options[ 'placeholder' ] ) .'" ' : ''; ?>type='<?php echo esc_attr( $type ); ?>' name='mkl_pc__settings[<?php echo esc_attr( $field_options['setting_name'] ); ?>]' value='<?php echo isset( $options[$field_options[ 'setting_name' ] ] ) ? esc_attr( $options[$field_options[ 'setting_name' ] ] ) : ''; ?>'>
			<?php
			if ( isset( $field_options['description'] ) ) { ?>
				<p class="field-description"><?php echo $field_options['description']; ?></p>
			<?php }
		}

		public function callback_select( $field_options = [] ) {
			if ( ! isset( $field_options[ 'setting_name' ] ) ) return;
			if ( ! isset( $field_options[ 'options' ] ) ) {
				echo 'Options are missing for the this select field: ' . $field_options[ 'setting_name' ];
				return;
			}

			if ( isset( $field_options[ 'no_value' ] ) && $field_options[ 'no_value' ] ) {
				$field_options[ 'options' ] = array_combine( $field_options[ 'options' ], $field_options[ 'options' ] );
			}

			$default = false;
			if ( isset( $field_options[ 'default' ] ) ) {
				$default = $field_options[ 'default' ];
			}

			$value = $this->get_setting( $field_options[ 'setting_name' ], $default );

			?>
			<select name='mkl_pc__settings[<?php echo $field_options[ 'setting_name' ]; ?>]' id='mkl_pc__settings-<?php echo $field_options['setting_name']; ?>'>
				<?php foreach ( $field_options[ 'options' ] as $key => $label ) {
					printf( '<option value="%s"%s>%s</option>', $key, selected( $value, $key, false ), $label );
				} ?>
			</select>
			<?php
			if ( isset( $field_options['description'] ) ) { ?>
				<span class="field-description"><?php echo $field_options['description']; ?></span>
			<?php }
		}

		public function callback_radio( $field_options = [] ) {
			if ( ! isset( $field_options[ 'setting_name' ] ) ) return;
			$value = $this->get_setting( $field_options[ 'setting_name' ] );
			?>
			<fieldset>
				<?php foreach ( $field_options['options'] as $key => $label ) {
					printf( '<label for="wpuf-%1$s[%2$s][%3$s]">',  'mkl_pc__settings', $field_options['setting_name'], $key );
					printf( '<input type="radio" class="radio" id="wpuf-%1$s[%2$s][%3$s]" name="%1$s[%2$s]" value="%3$s" %4$s />', 'mkl_pc__settings', $field_options['setting_name'], $key, checked( $value, $key, false ) );
					printf( '%1$s</label><br>', $label );
				} ?>
			</fieldset>
			<?php
			if ( isset( $field_options['description'] ) ) { ?>
				<span class="field-description"><?php echo $field_options['description']; ?></span>
			<?php }
		}

		public function callback_checkbox( $field_options = [] ) {
			if ( ! isset( $field_options['setting_name'] ) ) return;
			$value = $this->get_setting( $field_options[ 'setting_name' ] );
			?>
			<input type='checkbox' name='mkl_pc__settings[<?php echo $field_options['setting_name']; ?>]' <?php checked( $value, 'on' ); ?>>
			<?php
			if ( isset( $field_options['description'] ) ) { ?>
				<span class="field-description"><?php echo $field_options['description']; ?></span>
			<?php }
		}

		public function display_addons() {
			$this->get_addons(); 
			$installed_addons = Plugin::instance()->get_extensions();
			if ( ! is_array( $this->addons ) ) return;
			echo '<div class="mkl-pc-addons">';
			foreach( $this->addons as $addon ) {
				$this->display_addon( $addon, in_array( $addon->product_name, array_keys( $installed_addons ) ) );
			}
			// $this->display_mkl_theme();
			echo '</div>';
		}

		private function display_mkl_theme() { 
			
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

		public function get_addons() {
			$this->addons = include 'addons.php';
			$this->themes_url = get_transient( 'mkl_pc_themes_url' );
		}

		public function add_backbone_templates() {
			global $pagenow;
			if ( 'options-general.php' != $pagenow || ! isset( $_GET['page'] ) || 'mkl_pc_settings' != $_GET['page'] ) return;
			
			$themes = mkl_pc( 'themes' )->get_themes();
			$data = [];
			foreach( $themes as $theme_id => $theme_path ) {
				$data[] = mkl_pc( 'themes' )->get_theme_info( $theme_id );
			}
			?>

			<script type="application/json" id="mkl_pc_themes_data">
				<?php echo json_encode( $data ); ?>	
			</script>
			<script type="template/html" id="tmpl-mkl-pc-themes-setting-view">
				<# if ( data.id ) { #>
					<div class="img">
						<# if ( data.img ) { #>
							<img src="{{data.img}}" alt="<?php _e( 'Theme preview', 'product-configurator-for-woocommerce' ); ?>">
						<# } else { #>
							<span class="no-preview"><span class="no-preview--label"><?php _e( 'No preview', 'product-configurator-for-woocommerce' ); ?></span></span>
						<# } #>
					</div>
					<div class="content">
						<h4>{{data.Name}}</h4>
						<p>{{{data.Description}}}</p>
						<button type="button" class="button mkl-pc--change-theme button"><?php _e( 'Change' ); ?></button>
					</div>
				<# } else { #>
						<p class="no-theme"><?php _e( 'No theme is in use.', 'product-configurator-for-woocommerce' ); ?></p>
						<button type="button" class="button mkl-pc--change-theme button-primary"><?php _e( 'Select a theme', 'product-configurator-for-woocommerce' ); ?></button>
				<# } #>
			</script>
			<script type="template/html" id="tmpl-mkl-pc-themes">
				<div class="mkl-pc-themes">
					<div class="themes-list"></div>
					<footer>
						<div class="selection"></div>
						<div class="actions">
							<button type="button" class="button button-primary select-theme"><?php _e( 'Select the theme', 'product-configurator-for-woocommerce' ); ?></button>
							<button type="button" class="button cancel"><?php _e( 'Cancel' ); ?></button>
						</div>
					</footer>
				</div>
			</script>
			<script type="template/html" id="tmpl-mkl-pc-theme-item">
				<div class="text">
					<h4>{{data.Name}}</h4>
					<div class="desc">{{{data.Description}}}</div>
					<div class="tags">{{data.Tags}}</div>
				</div>
				<div class="theme-preview">
					<# if ( data.img ) { #>
						<img src="{{data.img}}" alt="<?php _e( 'Theme preview', 'product-configurator-for-woocommerce' ); ?>">
					<# } else { #>
						<span class="no-preview"><span class="no-preview--label"><?php _e( 'No preview', 'product-configurator-for-woocommerce' ); ?></span></span>
					<# } #>
				</div>
				<button class="trigger"></button>
			</script>
		<?php }

		public function scripts() {
			$screen = get_current_screen();
			if ( 'settings_page_mkl_pc_settings' == $screen->id ) {
				wp_enqueue_style( 'mlk_pc/admin', MKL_PC_ASSETS_URL.'admin/css/admin.css' , [], MKL_PC_VERSION );
				wp_enqueue_style( 'mlk_pc/settings', MKL_PC_ASSETS_URL.'admin/css/settings.css' , [ 'woocommerce_admin_styles' ], MKL_PC_VERSION );
				wp_enqueue_script( 'mk_pc/settings', MKL_PC_ASSETS_URL.'admin/js/settings.js', array( 'jquery', 'backbone', 'wp-util', 'select2', 'selectWoo', 'wc-enhanced-select' ), MKL_PC_VERSION, true );
			}
		}
	}
}
