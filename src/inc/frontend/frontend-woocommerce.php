<?php
namespace MKL\PC;
/**
 * Frontend functions
 *
 *
 * @author   Marc Lacroix
 */


if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly
}


class Frontend_Woocommerce { 

	public $plugin = NULL;
	public $_product = NULL;
	public $ID = NULL;
	public $frontend = NULL;
	public $product = NULL;
	public $cart = NULL;
	public $order = NULL;
	public function __construct() {
		// Plugin::instance()->db;	
		$this->_hooks();
		$this->_includes();
		$this->product = new Frontend_Product();
		$this->cart = new Frontend_Cart();
		$this->order = new Frontend_Order();
	}
	private function _includes() {
		include( MKL_PC_INCLUDE_PATH . 'frontend/product.php' );
		include( MKL_PC_INCLUDE_PATH . 'frontend/order.php' );
		include( MKL_PC_INCLUDE_PATH . 'frontend/cart.php' );
	}

	private function _hooks() {
		add_action( 'wp_enqueue_scripts', array( $this, 'load_scripts' ), 50 );
		add_filter( 'script_loader_tag', array( $this, 'prevent_underscore_conflict' ), 10, 2 );
		add_action( 'template_redirect', array( $this, 'setup_themes' ), 50 );
		add_action( 'admin_init', array( $this, 'setup_themes' ), 50 );
		add_action( 'customize_register', array( $this, 'setup_themes' ), 9 );
		// add_filter( 'woocommerce_get_price', array( &$this, 'get_price' ), 10, 2 ); 
		// add_filter( 'woocommerce_cart_item_product' , array( &$this, 'change_item_price' ), 10 , 3); 
		// 		
		// variation: include text when prod configurator is opened and no variation is selected
		add_shortcode( 'mkl_configurator_button', array( $this, 'button_shortcode' ) );
		add_shortcode( 'mkl_configurator', array( $this, 'configurator_shortcode' ) );
		add_action( 'rest_api_init', array( $this, 'register_rest_route' ) );
		add_filter( 'mkl_product_configurator_get_front_end_data', array( $this, 'set_thumbnail_url' ), 20 );

		add_filter( 'mkl_pc_order_item_meta', array($this, 'add_sku_to_meta' ), 20, 5 );
		add_filter( 'mkl_pc_item_meta', array($this, 'add_sku_to_meta_cart' ), 20, 5 );
		
		// Siteground compatibility: exclude JS from async loading
		add_filter( 'sgo_js_async_exclude', array( $this, 'siteground_optimize_compat' ) );

		add_filter( 'mkl_pc/sku_mode', array( $this, 'maybe_filter_sku_mode' ), 20, 2 );
	}

	public function register_rest_route() {
		register_rest_route( 'mkl_pc/v1', '/merge/(?P<id>\d+)/(?P<images>[a-zA-Z0-9-]+)', array(
			'methods' => 'GET',
			'callback' => array( $this, 'serve_image' ),
			'permission_callback' => '__return_true'
		) );
	}

	public function setup_themes() {
		static $setup = false;
		if ( $setup ) return;
		$theme_id = apply_filters( 'mkl/pc/theme_id', mkl_pc( 'settings' )->get( 'mkl_pc__theme' ) );

		if ( $theme_id ) {
			$theme = mkl_pc( 'themes' )->get( $theme_id );
			if ( $theme && file_exists( trailingslashit( $theme ) . 'theme.php' ) ) include_once trailingslashit( $theme ) . 'theme.php';
		}

		$setup = true;
	}

	/**
	 * Undocumented function
	 *
	 * @param [type] $data
	 * @return void
	 */
	public function serve_image( $data ) {
		if ( ! Utils::check_image_requirements() ) {
			header("Content-type: image/png");
			readfile( MKL_PC_ASSETS_PATH . 'images/image-error.png' );
			return;
		}

		$product_id = $data->get_param( 'id' );
		$images = explode( '-', $data->get_param( 'images' ) );
		if ( empty( $images ) ) {
			header("Content-type: image/gif");
			readfile( WPINC . '/images/blank.gif' );
			return;
		}
		$content = [];
		foreach( $images as $image ) {
			$content[] = [ 'image' => $image ];
		}
		$configuration = new Configuration( NULL, array( 'product_id' => $product_id, 'content' => json_encode( $content ) ) );
		$configuration->serve_image();
	}

	/**
	 * Configure Button shortcode
	 *
	 * @param array  $atts
	 * @param string $content
	 * @return string
	 */
	public function button_shortcode( $atts, $content = '' ) {
		if ( ! isset( $atts[ 'product_id' ] ) ) {
			global $product;
			if ( ! $product || ! is_a( $product, 'WC_Product' ) ) return __( 'A product id must be set in order for this shortcode to work.', 'product-configurator-for-woocommerce' );
			$product_id = $product->get_id();
		} else {
			global $mkl_product;
			$product_id = intval( $atts[ 'product_id' ] );
			if ( function_exists( 'wpml_object_id_filter' ) ) {
				$translated_product_id = wpml_object_id_filter( $product_id );	
				if ( $translated_product_id ) $product_id = $translated_product_id;
			}
			$product = $mkl_product = wc_get_product( $product_id );
		}

		$shortcode_class = isset( $atts[ 'classes' ] ) ? Utils::sanitize_html_classes( $atts[ 'classes' ] ) : '';

		if ( ! $product || ! mkl_pc_is_configurable( $product_id ) ) return __( 'The provided ID is not a valid product.', 'product-configurator-for-woocommerce' );

		$date_modified = $product->get_date_modified();
		
		wp_enqueue_script( 'mkl_pc/js/fe_data_'.$product_id, Plugin::instance()->cache->get_config_file($product_id), array(), ( $date_modified ? $date_modified->getTimestamp() : MKL_PC_VERSION ), true );

		if ( ! trim( $content ) ) $content = mkl_pc( 'settings' )->get_label( 'mkl_pc__button_label', __( 'Configure', 'product-configurator-for-woocommerce' ) );

		$options = get_option( 'mkl_pc__settings' );
		$button_class = isset( $options['mkl_pc__button_classes'] ) ? Utils::sanitize_html_classes( $options['mkl_pc__button_classes'] ) : 'primary button btn btn-primary';

		if ( isset( $atts['tag'] ) && ( 'a' === $atts['tag'] || 'link' === $atts['tag'] ) ) {
			$tag_name = 'a href="#" ';
			$tag_name_close = 'a';
		} else {
			$tag_name = 'button type="button"';
			$tag_name_close = 'button';
		}

		$data_attributes = $this->get_configurator_element_attributes( $product );

		if ( isset( $atts[ 'product_id' ] ) ) {
			$data_attributes['force_form'] = 1;
		}

		$data_attributes = apply_filters( 'mkl_configurator_button_data_attributes', $data_attributes, $product_id, $atts );
		
		return '<' . $tag_name . ' class="'.$button_class.' is-shortcode configure-product-simple configure-product '.$shortcode_class.'" ' . implode( ' ', $this->_output_data_attributes( $data_attributes ) ) . '>'.$content.'</' . $tag_name_close . '>';
	}

	/**
	 * Get the attributes for the configurator trigger element. Button or inline div
	 *
	 * @param WC_Product $product
	 * @return array
	 */
	public function get_configurator_element_attributes( $product ) {
		$data_attributes = array( 
			'product_id' => $product->get_id(),
			'price' => $this->product->get_product_price( $product->get_id() ),
			'regular_price' => $this->product->get_product_price( $product->get_id(), 'regular_price' ),
			'is_on_sale'    => $product->is_on_sale(),
			'settings' => [
				'convert_base_price' => apply_filters( 'configurator_convert_base_price', false, $product ),
			]
		);
		/**
		 * Filters the list of attributes added to the configurator trigger element.
		 *
		 * @param array $data_attributes The attributes
		 * @param WC_Product $product The configurable product
		 * @return array
		 */
		return apply_filters( 'get_configurator_element_attributes', $data_attributes, $product );
	}

	/**
	 * Format the data attributes
	 *
	 * @param array $data
	 * @return array
	 */
	public function _output_data_attributes( $data ) {
		$data_attributes_string = array_map( function( $key, $value ) {
			if ( ! is_scalar( $value ) && ! is_null( $value ) ) $value = wp_json_encode( $value );
			return ' data-' . $key . '="' . esc_attr( $value ) . '"';
		}, array_keys( $data ), $data );
		return $data_attributes_string;
	}

	/**
	 * Configure Button shortcode
	 *
	 * @param array  $atts
	 * @param string $content
	 * @return string
	 */
	public function configurator_shortcode( $atts, $content = '' ) {

		if ( ! isset( $atts[ 'product_id' ] ) ) {
			global $product, $post;
			if ( ! $product ) return __( 'A product id must be set in order for this shortcode to work.', 'product-configurator-for-woocommerce' );
			if ( $product && ! is_a( $product, 'WC_Product' ) ) {
				if ( is_string( $product ) && $post ) {
					$product = wc_get_product( $post );
				}				
				if ( ! is_a( $product, 'WC_Product' ) ) return __( 'The global product variable is not a WC_Product instance', 'product-configurator-for-woocommerce' ) . ' - ' . print_r( $product, true );
			}
			$product_id = $product->get_id();
		} else {
			global $mkl_product;
			$product_id = intval( $atts[ 'product_id' ] );
			if ( function_exists( 'wpml_object_id_filter' ) ) {
				$translated_product_id = wpml_object_id_filter( $product_id );
				if ( $translated_product_id ) $product_id = $translated_product_id;
			}

			$product = $mkl_product = wc_get_product( $product_id );
		}
		$shortcode_class = isset( $atts[ 'classes' ] ) ? Utils::sanitize_html_classes( $atts[ 'classes' ] ) : '';

		if ( ! $product || ! mkl_pc_is_configurable( $product_id ) ) return __( 'The provided ID is not a valid product.', 'product-configurator-for-woocommerce' );

		$date_modified = $product->get_date_modified();
		
		wp_enqueue_script( 'mkl_pc/js/fe_data_'.$product_id, Plugin::instance()->cache->get_config_file($product_id), array(), ( $date_modified ? $date_modified->getTimestamp() : MKL_PC_VERSION ), true );

		if ( ! trim( $content ) ) $content = __( 'Configure', 'product-configurator-for-woocommerce' );

		$data_attributes = $this->get_configurator_element_attributes( $product );

		$data_attributes['loading'] = mkl_pc( 'settings' )->get_label( 'loading_configurator_message', __( 'Loading the configurator...', 'product-configurator-for-woocommerce' ) );

		if ( isset( $atts[ 'product_id' ] ) ) {
			$data_attributes['force_form'] = 1;
		}

		$data_attributes = apply_filters( 'mkl_configurator_data_attributes', $data_attributes, $product_id, $atts );
		return '<div class="mkl-configurator-inline is-shortcode configure-product '.$shortcode_class.'" ' . implode( ' ', $this->_output_data_attributes( $data_attributes ) ) . '></div>';
	}

	/**
	 * Whether the configurator should be loaded on the page
	 *
	 * @return boolean
	 */
	public function load_configurator_on_page() {
		global $post;
		static $load_it;
		if ( $load_it ) return $load_it;

		if ( $post && $post->ID ) {
			$product = wc_get_product( $post->ID );
		} else {
			$product = false;
		}
		$maybe_load_it = apply_filters( 'load_configurator_on_page', ( $product && mkl_pc_is_configurable( $post->ID ) ) || is_a( $post, 'WP_Post' ) && ( has_shortcode( $post->post_content, 'mkl_configurator_button' ) || has_shortcode( $post->post_content, 'mkl_configurator' ) || is_a( $post, 'WP_Post' ) && get_post_meta( $post->ID, 'mkl_load_configurator_on_page', true ) ) );
		// If true, save the value
		if ( $maybe_load_it ) $load_it = $maybe_load_it;
		return $maybe_load_it;
	}

	public function load_scripts() {
		global $post, $wp_version, $product;
		if ( $product ) {
			$g_product = $product;
		} else {
			$g_product = false;
		}
		
		wp_register_style( 'mlk_pc/css/woocommerce', MKL_PC_ASSETS_URL . 'css/woocommerce.css' , false, MKL_PC_VERSION );
		wp_enqueue_style( 'mlk_pc/css/woocommerce' );
		
		// Register vendor scripts
		wp_register_script( 'pixijs', MKL_PC_ASSETS_URL . 'js/vendor/pixi.min.js', [], '6.0.1', true );
		wp_register_script( 'mkl_pc/html2canvas', MKL_PC_ASSETS_URL . 'js/vendor/html2canvas.min.js', [], '1.4.1', true );
		wp_register_script( 'mkl_pc/touchswipe', MKL_PC_ASSETS_URL . 'js/vendor/jquery.touchSwipe.min.js', [], '1.6.18', true );

		$file_suffix = '';
		if ( ! defined( 'SCRIPT_DEBUG' ) || ! SCRIPT_DEBUG ) {
			$file_suffix = '.min';
		}

		wp_enqueue_script( 'mkl_pc/general', MKL_PC_ASSETS_URL . 'js/general' . $file_suffix . '.js', [ 'jquery' ], filemtime( MKL_PC_ASSETS_PATH . 'js/general' . $file_suffix . '.js' ) );
		wp_localize_script( 'mkl_pc/general', 'mkl_pc_general', [
			'ajaxurl' => admin_url( 'admin-ajax.php' ),
		] );
		
		if ( ! $this->load_configurator_on_page() ) return;

		wp_enqueue_style( 'mlk_pc/css/common', MKL_PC_ASSETS_URL . 'css/configurator-common.css' , false, filemtime( MKL_PC_ASSETS_PATH . 'css/configurator-common.css' ) );

		// wp_enqueue_script( 'wp-api' );
		$wp_scripts = wp_scripts();
		if ( ! $wp_scripts->query( 'wp-hooks' ) ) {
			//WP.hooks, if it's included in WP core.
			wp_register_script( 'wp-hooks', MKL_PC_ASSETS_URL . 'js/vendor/wp.event-manager.min.js', array( 'jquery' ), '1.1', true );
		}

		// Exit if the plugin is not configurable
		$prod = $post ? wc_get_product( $post->ID ) : false;
		if ( $prod ) {
			$date_modified = $prod->get_date_modified();
		} else {
			$date_modified = false;
		}

		$scripts = array(
			array('backbone/models/choice', 'models/choice.js'),
			array('backbone/models/layer', 'models/layer.js'),
			//COLLECTIONS
			array('backbone/collections/layers', 'collections/layers.js'),
			array('backbone/collections/angles', 'collections/angles.js'),
			array('backbone/collections/choices', 'collections/choices.js'),

		);
		foreach( $scripts as $script ) {
			list( $key, $file ) = $script;
			if ( ! defined( 'SCRIPT_DEBUG' ) || !SCRIPT_DEBUG ) {
				$file = str_replace( '.js', '.min.js', $file );
			}
			wp_enqueue_script( 'mkl_pc/js/admin/' . $key, MKL_PC_ASSETS_URL . 'admin/js/'. $file , array( 'jquery', 'backbone', 'accounting', 'wp-hooks' ), MKL_PC_VERSION, true );
		}
		
		// To include potential other scripts BEFORE the main configurator one
		do_action( 'mkl_pc_scripts_product_page_before' );

		wp_register_script( 'mkl_pc/js/vendor/popper', MKL_PC_ASSETS_URL . 'js/vendor/popper.min.js', [], '2', true );
		wp_register_script( 'mkl_pc/js/vendor/tippy', MKL_PC_ASSETS_URL . 'js/vendor/tippy-bundle.umd.min.js', [ 'mkl_pc/js/vendor/popper' ], '6.3.7', true );
		wp_register_script( 'mkl_pc/js/vendor/as', MKL_PC_ASSETS_URL . 'js/vendor/adaptive-scale.min.js', [], '1.0.0', true );
		wp_register_script( 'mkl_pc/js/vendor/download', MKL_PC_ASSETS_URL . 'js/vendor/download.min.js', [], '4.21', true );

		$deps = array('jquery', 'backbone', 'wp-util', 'wp-hooks', 'mkl_pc/js/views/configurator' );
		// wp_enqueue_script( 'mkl_pc/js/vendor/TouchSwipe', MKL_PC_ASSETS_URL.'js/vendor/jquery.touchSwipe.min.js', array('jquery' ), '1.6.18', true );
		$deps[] = 'mkl_pc/js/vendor/tippy';
		// if ( mkl_pc( 'settings')->get( 'show_choice_description' ) && ! mkl_pc( 'settings')->get( 'choice_description_no_tooltip', false ) ) {
		// }

		if ( ( bool ) mkl_pc( 'settings')->get( 'swipe_to_change_view', false ) ) {
			$deps[] = 'mkl_pc/touchswipe';
		}

		// if ( mkl_pc( 'settings')->get( 'show_choice_description' ) && ! mkl_pc( 'settings')->get( 'choice_description_no_tooltip', false ) ) {
		// 	$deps[] = 'mkl_pc/html2canvas';
		// }

		// Porto compatibility
		if ( defined( 'PORTO_VERSION' ) ) {
			$deps[] = 'porto-woocommerce-theme';
		}

		$deps = apply_filters( 'mkl_pc/js/product_configurator/dependencies', $deps );
		$configurator_deps = apply_filters( 'mkl_pc/js/configurator/dependencies', array('jquery', 'backbone', 'wp-util', 'wp-hooks' ) );

		wp_enqueue_script( 'mkl_pc/js/views/configurator', MKL_PC_ASSETS_URL.'js/views/configurator' . $file_suffix . '.js', $configurator_deps, filemtime( MKL_PC_ASSETS_PATH . 'js/views/configurator' . $file_suffix . '.js' ) , true );
		wp_enqueue_script( 'mkl_pc/js/product_configurator', MKL_PC_ASSETS_URL.'js/product_configurator' . $file_suffix . '.js', $deps, filemtime( MKL_PC_ASSETS_PATH . 'js/product_configurator' . $file_suffix . '.js' ) , true );

		$bg_image = get_option( 'mkl_pc_theme_viewer_bg', false );
		$money_format = get_woocommerce_price_format();

		if ( function_exists( 'alg_wc_currency_switcher_plugin' ) && get_option( 'alg_wc_currency_switcher_price_formats_currency_position_' . get_woocommerce_currency() ) ) {
			$money_format = alg_wc_currency_switcher_plugin()->core->get_woocommerce_price_format( get_option( 'alg_wc_currency_switcher_price_formats_currency_position_' . get_woocommerce_currency() ) );
		}

		$args = array(
			'ajaxurl' => admin_url( 'admin-ajax.php' ),
			'lang' => array(
				'money_precision' => wc_get_price_decimals(),
				'money_symbol' => get_woocommerce_currency_symbol( get_woocommerce_currency() ),
				'money_decimal' => esc_attr( wc_get_price_decimal_separator() ),
				'money_thousand' => esc_attr( wc_get_price_thousand_separator() ),
				'money_format' => esc_attr( str_replace( array( '%1$s', '%2$s', '&nbsp;' ), array( '%s', '%v', ' ' ), $money_format ) ),
				'required_error_message' => __( '%s is required', 'product-configurator-for-woocommerce' ),
			),
			'config' => apply_filters( 'mkl_pc_js_config', array(
				'inline' => false,
				'where' => 'out',
				'bg_image' => $bg_image ? $bg_image : apply_filters( 'mkl_pc_bg_image', MKL_PC_ASSETS_URL.'images/default-bg.jpg'),
				'close_configurator_on_add_to_cart' => ( bool ) mkl_pc( 'settings')->get( 'close_configurator_on_add_to_cart' ),
				'close_choices_when_selecting_choice' => ( bool ) mkl_pc( 'settings')->get( 'close_choices_when_selecting_choice' ),
				'close_choices_when_selecting_choice_desktop' => ( bool ) mkl_pc( 'settings')->get( 'close_choices_when_selecting_choice_desktop' ),
				'choice_description_no_tooltip' => mkl_pc( 'settings')->get( 'choice_description_no_tooltip', false ),
				'image_loading_mode' => mkl_pc( 'settings')->get( 'image_loading_mode', 'lazy' ),
				'show_choice_description' => (bool) mkl_pc( 'settings')->get( 'show_choice_description' ),
				'show_layer_description' => (bool) mkl_pc( 'settings')->get( 'show_layer_description' ),
				'show_active_choice_in_layer' => (bool) mkl_pc( 'settings')->get( 'show_active_choice_in_layer' ),
				'show_active_choice_image_in_layer' => ( bool ) mkl_pc( 'settings')->get( 'show_active_choice_image_in_layer' ),
				'sku_mode' => apply_filters( 'mkl_pc/sku_mode', mkl_pc( 'settings')->get( 'sku_mode', 'individual' ) ),
				'show_form' => apply_filters( 'mkl_pc_show_form', ! $g_product, $post ? $post->ID : false ),
				'no_toggle' => false,
				'open_first_layer' => ( bool ) mkl_pc( 'settings')->get( 'open_first_layer', false ),
				'auto_scroll' => ( bool ) mkl_pc( 'settings')->get( 'auto_scroll', false ),
				'swipe_to_change_view' => ( bool ) mkl_pc( 'settings')->get( 'swipe_to_change_view', false ),
				'choice_groups_toggle' => ( bool ) mkl_pc( 'settings')->get( 'choice_groups_toggle', false ),
				'auto_close_siblings_in_groups' => ( bool ) mkl_pc( 'settings')->get( 'auto_close_siblings_in_groups', false ),
				'use_steps' => ( bool ) mkl_pc( 'settings')->get( 'use_steps', false ) && mkl_pc( 'themes' )->current_theme_supports( 'steps' ),
				'steps_use_layer_name' => ( bool ) mkl_pc( 'settings')->get( 'steps_use_layer_name', false ),
				'steps_progress_enable_click_all' => ( bool ) mkl_pc( 'settings')->get( 'steps_progress_enable_click_all', false ),
				'angles' => [
					'show_image' => mkl_pc( 'settings')->get( 'show_angle_image' ),
					'show_name' => mkl_pc( 'settings')->get( 'show_angle_name' ),
					'save_current' => mkl_pc( 'settings')->get( 'use_current_angle_in_cart_image' ),
				]
			) ),
		);

		if ( 'wsb' == mkl_pc( 'settings' )->get_theme() && mkl_pc( 'settings' )->get( 'wsb_no_toggle' ) ) {
			$args['config']['no_toggle'] = true;
		}

		if ( $saved_configuration_content = $this->get_saved_configuration_content() ) {
			$args['config']['load_config_content'] = $saved_configuration_content;

			if ( isset( $_REQUEST['edit_config_from_cart'] ) ) {
				$args['config']['cart_item_key'] = esc_attr( $_REQUEST['load_config_from_cart'] );
			}
		} 

		if ( isset( $_REQUEST['open_configurator'] ) ) {
			$args['config']['open_configurator'] = true;
		}

		wp_localize_script( 'mkl_pc/js/product_configurator', 'PC_config', apply_filters( 'mkl_pc_frontend_js_config', $args ) );

		// $version = $product
		if ( $prod ) {
			wp_enqueue_script( 'mkl_pc/js/fe_data_'.$post->ID, Plugin::instance()->cache->get_config_file($post->ID), array(), ( $date_modified ? $date_modified->getTimestamp() : MKL_PC_VERSION ), true );
			// Add JSON for Weglot compatibility
			// if ( current_user_can( 'edit_posts' ) && defined( 'WEGLOT_DIRURL' ) ) {
			// 	wp_enqueue_script( 'mkl_pc/js/fe_data_weglot_'.$post->ID, admin_url( 'admin-ajax.php?action=pc_get_data&data=init&view=json&fe=1&id=' . $post->ID ), array(), ( $date_modified ? $date_modified->getTimestamp() : MKL_PC_VERSION ), true );
			// }

		}

		$theme_id = mkl_pc( 'settings' )->get_theme();
		if ( $theme_id && mkl_pc( 'themes' )->get( $theme_id ) ) {
			$theme_info = mkl_pc( 'themes' )->get_theme_info( $theme_id );
			$stylesheet = $theme_info['base_url'] . 'style.css';
			$version = filemtime( trailingslashit( mkl_pc( 'themes' )->get( $theme_id ) ) . 'style.css' );
			wp_register_style( 'mlk_pc/css', apply_filters( 'mkl_pc/css/product_configurator.css', $stylesheet ), array(), $version );
			wp_enqueue_style( 'mlk_pc/css' );
		}

		// to include potential other scripts AFTER the main configurator one
		do_action( 'mkl_pc_scripts_product_page_after' );
	}

	/**
	 * Prevent Understore conflict. 
	 * Based on what The Events Calendar does
	 * 
	 * @param string $tag
	 * @param string $handle
	 * @return string
	 */
	public function prevent_underscore_conflict( $tag, $handle ) {
		if ( is_admin() ) {
			return $tag;
		}

		if ( 'underscore' === $handle ) {
			$dir = MKL_PC_ASSETS_URL . 'js';
			$tag = "<script src='{$dir}/underscore-before.min.js'></script>\n"
			       . $tag
			       . "<script src='{$dir}/underscore-after.min.js'></script>\n";
		}

		return $tag;
	}

	/**
	 * Get the configuration to preload in the configurator
	 *
	 * @return array
	 */
	private function get_saved_configuration_content() {
		$configuration_to_load = [];
		if ( isset( $_REQUEST['load_config_from_cart'] ) ) {

			$wc_cart = WC()->cart;
			$cart_item = $wc_cart->get_cart_item($_REQUEST['load_config_from_cart']);

			// Check for removed items
			if ( empty( $cart_item ) ) {
				$removed_items = $wc_cart->get_removed_cart_contents();
				if ( isset( $removed_items[$_REQUEST['load_config_from_cart']] ) ) {
					$cart_item = $removed_items[$_REQUEST['load_config_from_cart']];
				}
			}

			if ( $cart_item && isset( $cart_item['configurator_data_raw'] ) ) {
				$configuration_to_load = $cart_item['configurator_data_raw'];
			}


		}

		if ( isset( $_REQUEST['load_config_from_order'] ) ) {
			$current_user_can_view_config = current_user_can( 'manage_woocommerce' );
			if ( ! $current_user_can_view_config ) {
				$order_id = wc_get_order_id_by_order_item_id( $_REQUEST['load_config_from_order'] );
				$order = wc_get_order( $order_id );
				if ( is_a( $order, 'WC_Order' ) ) {
					if ( $order->get_customer_id() === get_current_user_id() ) {
						$current_user_can_view_config = true;
					}
				}
			}
			
			/**
			 * Filters whether or not the user can view the configuration from the order item
			 * Default to true if the current user can "manage_woocommerce", or the current user is the order's customer.
			 */
			if ( apply_filters( 'mkl_pc/current_user_can_view_order_config', $current_user_can_view_config ) ) {
				$config = wc_get_order_item_meta( (int) $_REQUEST['load_config_from_order'], '_configurator_data_raw', true );
				if ( $config ) $configuration_to_load = $config;
			}
		}

		if ( isset( $_REQUEST['load-preset'] ) ) {
			$p = get_post( (int) $_REQUEST['load-preset'] );
			if ( $p && 'mkl_pc_configuration' === $p->post_type && 'preset' === $p->post_status ) {
				$configuration_to_load = json_decode( $p->post_content );
			}
		}

		/**
		 * Filters the configuration to add to cart
		 *
		 * @param array $configuration_to_load
		 * @return array The configuration data, or empty array
		 */
		return apply_filters( 'mkl_pc_get_saved_configuration_content', $configuration_to_load );
	}

	/**
	 * Set the image sizes
	 * This could be done when selecting the image in the media modal, but then could not be changed later.
	 * 
	 * @param array $data
	 * @return array
	 */
	public function set_thumbnail_url( $data ) {
		if ( ! isset( $data['content'] ) || ! is_array( $data['content'] ) ) return $data;
		/**
		 * Filters whether or not to override the images using the ID and the image size specified in the settings.
		 *
		 * @return boolean
		 */
		if ( apply_filters( 'mkl_pc_do_not_override_images', false ) ) return $data;
		$img_size =  mkl_pc( 'settings' )->get( 'preview_image_size', 'full' );
		$thumbnail_size = mkl_pc( 'settings' )->get( 'thumbnail_size', 'medium' );
		foreach( $data['content'] as $lin => $layer ) {
			foreach( $layer['choices'] as $cin => $choice ) {
				foreach( $choice['images'] as $imin => $image ) {
					if ( $image['image']['id'] ) {
						if ( $new_image_url = wp_get_attachment_image_url( $image['image']['id'], $img_size ) ) {
							$data['content'][$lin]['choices'][$cin]['images'][$imin]['image']['url'] = $new_image_url;
						}
					}
					if ( $image['thumbnail']['id'] ) {
						if ( $new_thumbnail_url = wp_get_attachment_image_url( $image['thumbnail']['id'], $thumbnail_size ) ) {
							$data['content'][$lin]['choices'][$cin]['images'][$imin]['thumbnail']['url'] = $new_thumbnail_url;
						}
					}
				}
			}
		}
		return $data;
	}

	public function add_sku_to_meta_cart( $meta, $layer, $product ) {
		if ( 'on' != mkl_pc( 'settings')->get( 'show_sku_in_cart' ) ) return $meta;
		return $this->add_sku_to_meta( $meta, $layer, $product );
	}

	public function add_sku_to_meta( $meta, $layer, $product ) {
		/**
		 * Filter mkl_pc/sku_mode
		 * Filters the SKU display mode, set in the configurator settings
		 * @param string $mode - The SKU mode
		 * @param WC_Product|bool - The product, if applicable in the context
		 */
		$sku_mode = apply_filters( 'mkl_pc/sku_mode', mkl_pc( 'settings')->get( 'sku_mode', 'individual' ), $product );
		$slu_label = apply_filters( 'mkl_pc/sku_label', '<span class="sku-label">' . mkl_pc( 'settings')->get_label( 'sku_label', __( 'SKU:', 'product-configurator-for-woocommerce' ) ) . '</span> ', $product );
		if ( 'individual' == $sku_mode && $layer->get_choice( 'sku' ) ) {
			$meta[ 'value' ] .= ' <span class="sku">' . $slu_label . $layer->get_choice( 'sku' ) . '</span>';
		}
		return $meta;
	}

	/**
	 * Exclude the configurator scripts and dependencies from defer/async
	 */
	public function siteground_optimize_compat( $items ) {
		if ( ! is_callable( '\SiteGround_Optimizer\Helper\Helper::get_script_handle_regex' ) ) return $items;

		global $wp_scripts;
		$wp_scripts->all_deps( $wp_scripts->queue );
		$extras = \SiteGround_Optimizer\Helper\Helper::get_script_handle_regex( 'mkl', $wp_scripts->to_do );
		if ( ! empty( $extras ) && 1 < count( $extras ) ) {
			return array_merge(
				$items,
				$extras,
				[ 
					'underscore',
					'backbone',
					'wp-util',
					'wp-hooks',
				],
				\SiteGround_Optimizer\Helper\Helper::get_script_handle_regex( 'jquery', $wp_scripts->to_do )
			);
		}

		return $items;
	}

	/**
	 * Maybe filter the SKU mode, if the product has the relevant meta
	 *
	 * @param string          $mode
	 * @param WC_Product|bool $product
	 * @return string
	 */
	public function maybe_filter_sku_mode( $mode, $product = false ) {
		if ( $product && is_a( $product, 'WC_Product' ) && $product->get_meta( 'sku_mode', true ) ) {
			return $product->get_meta( 'sku_mode', true );
		}
		return $mode;
	}
}
