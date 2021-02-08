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
		add_filter( 'mkl_product_configurator_get_front_end_data', array( $this, 'set_thumbnail_url' ) );
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

		if ( ! isset( $atts[ 'product_id' ] ) ) return __( 'A product id must be set in order for this shortcode to work.', 'product-configurator-for-woocommerce' );
		$product_id = intval( $atts[ 'product_id' ] );
		$product = wc_get_product( $product_id );
		$shortcode_class = isset( $atts[ 'classes' ] ) ? Utils::sanitize_html_classes( $atts[ 'classes' ] ) : '';

		if ( ! $product || ! mkl_pc_is_configurable( $product_id ) ) return __( 'The provided ID is not a valid product.', 'product-configurator-for-woocommerce' );

		$date_modified = $product->get_date_modified();
		
		wp_enqueue_script( 'mkl_pc/js/fe_data_'.$product_id, Plugin::instance()->cache->get_config_file($product_id), array(), ( $date_modified ? $date_modified->getTimestamp() : MKL_PC_VERSION ), true );

		if ( ! trim( $content ) ) $content = __( 'Configure', 'product-configurator-for-woocommerce' );

		$options = get_option( 'mkl_pc__settings' );
		$button_class = isset( $options['mkl_pc__button_classes'] ) ? Utils::sanitize_html_classes( $options['mkl_pc__button_classes'] ) : 'primary button btn btn-primary';

		return '<button class="'.$button_class.' is-shortcode configure-product-simple configure-product '.$shortcode_class.'" data-product_id="'.$product_id.'">'.$content.'</button>';
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
			global $product;
			if ( ! $product ) return __( 'A product id must be set in order for this shortcode to work.', 'product-configurator-for-woocommerce' );
			$product_id = $product->get_id();
		} else {
			$product_id = intval( $atts[ 'product_id' ] );
			$product = wc_get_product( $product_id );
		}
		$shortcode_class = isset( $atts[ 'classes' ] ) ? Utils::sanitize_html_classes( $atts[ 'classes' ] ) : '';

		if ( ! $product || ! mkl_pc_is_configurable( $product_id ) ) return __( 'The provided ID is not a valid product.', 'product-configurator-for-woocommerce' );

		$date_modified = $product->get_date_modified();
		
		wp_enqueue_script( 'mkl_pc/js/fe_data_'.$product_id, Plugin::instance()->cache->get_config_file($product_id), array(), ( $date_modified ? $date_modified->getTimestamp() : MKL_PC_VERSION ), true );

		if ( ! trim( $content ) ) $content = __( 'Configure', 'product-configurator-for-woocommerce' );

		return '<div class="mkl-configurator-inline is-shortcode configure-product '.$shortcode_class.'" data-product_id="'.$product_id.'"></div>';
	}

	/**
	 * Whether the configurator should be loaded on the page
	 *
	 * @return boolean
	 */
	public function load_configurator_on_page() {
		global $post;
		if ( $post && $post->ID ) {
			$product = wc_get_product( $post->ID );
		} else {
			$product = false;
		}
		return apply_filters( 'load_configurator_on_page', ( $product && mkl_pc_is_configurable( $post->ID ) ) || is_a( $post, 'WP_Post' ) && ( has_shortcode( $post->post_content, 'mkl_configurator_button' ) || has_shortcode( $post->post_content, 'mkl_configurator' ) ) );
	}

	public function load_scripts() {
		global $post, $wp_version; 

		
		wp_register_style( 'mlk_pc/css/woocommerce', MKL_PC_ASSETS_URL . 'css/woocommerce.css' , false, MKL_PC_VERSION );
		wp_enqueue_style( 'mlk_pc/css/woocommerce' );
		
		if ( ! $this->load_configurator_on_page() ) return;

		wp_enqueue_script( 'wp-api' );
		$wp_scripts = wp_scripts();
		if ( ! $wp_scripts->query( 'wp-hooks' ) ) {
			//WP.hooks, if it's included in WP core.
			wp_register_script( 'wp-hooks', MKL_PC_ASSETS_URL . 'js/vendor/wp.event-manager.min.js', array( 'jquery' ), '1.1', true );
		}

		// Exit if the plugin is not configurable
		$product = wc_get_product( $post->ID );
		if ( $product ) {
			$date_modified = $product->get_date_modified();
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
		foreach($scripts as $script) {
			list( $key, $file ) = $script;
			if (!defined('SCRIPT_DEBUG') || !SCRIPT_DEBUG) {
				$file = str_replace('.js', '.min.js', $file);
			}
			wp_enqueue_script( 'mkl_pc/js/admin/' . $key, MKL_PC_ASSETS_URL . 'admin/js/'. $file , array( 'jquery', 'backbone', 'accounting', 'wp-hooks' ), MKL_PC_VERSION, true );
		}
		
		// To include potential other scripts BEFORE the main configurator one
		do_action( 'mkl_pc_scripts_product_page_before' );

		wp_register_script( 'mkl_pc/js/vendor/popper', 'https://unpkg.com/@popperjs/core@2/dist/umd/popper.min.js', [], '2', true );
		wp_register_script( 'mkl_pc/js/vendor/tippy', 'https://unpkg.com/tippy.js@6/dist/tippy-bundle.umd.js', [ 'mkl_pc/js/vendor/popper' ], '6', true );

		$deps = array('jquery', 'backbone', 'wp-util', 'wp-hooks', 'mkl_pc/js/views/configurator' );
		// wp_enqueue_script( 'mkl_pc/js/vendor/TouchSwipe', MKL_PC_ASSETS_URL.'js/vendor/jquery.touchSwipe.min.js', array('jquery' ), '1.6.18', true );
		if ( mkl_pc( 'settings')->get( 'show_choice_description' ) && ! mkl_pc( 'settings')->get( 'choice_description_no_tooltip', false ) ) {
			$deps[] = 'mkl_pc/js/vendor/tippy';
		}
		$deps = apply_filters( 'mkl_pc/js/product_configurator/dependencies', $deps );
		$configurator_deps = apply_filters( 'mkl_pc/js/configurator/dependencies', array('jquery', 'backbone', 'wp-util', 'wp-hooks' ) );

		wp_enqueue_script( 'mkl_pc/js/views/configurator', MKL_PC_ASSETS_URL.'js/views/configurator.js', $configurator_deps, filemtime( MKL_PC_ASSETS_PATH . 'js/views/configurator.js' ) , true );
		wp_enqueue_script( 'mkl_pc/js/product_configurator', MKL_PC_ASSETS_URL.'js/product_configurator.js', $deps, filemtime( MKL_PC_ASSETS_PATH . 'js/product_configurator.js' ) , true );

		$bg_image = get_option( 'mkl_pc_theme_viewer_bg', false );
		$args = array(
			'ajaxurl' => admin_url( 'admin-ajax.php' ),
			'lang' => array(
				'money_precision' => wc_get_price_decimals(),
				'money_symbol' => get_woocommerce_currency_symbol( get_woocommerce_currency() ),
				'money_decimal' => esc_attr( wc_get_price_decimal_separator() ),
				'money_thousand' => esc_attr( wc_get_price_thousand_separator() ),
				'money_format' => esc_attr( str_replace( array( '%1$s', '%2$s' ), array( '%s', '%v' ), get_woocommerce_price_format() ) ),
			),
			'config' => apply_filters( 'mkl_pc_js_config', array(
				'inline' => false,
				'where' => 'out',
				'bg_image' => $bg_image ? $bg_image : apply_filters( 'mkl_pc_bg_image', MKL_PC_ASSETS_URL.'images/default-bg.jpg'),
				'close_configurator_on_add_to_cart' => ( bool ) mkl_pc( 'settings')->get( 'close_configurator_on_add_to_cart' ),
				'close_choices_when_selecting_choice' => ( bool ) mkl_pc( 'settings')->get( 'close_choices_when_selecting_choice' ),
				'choice_description_no_tooltip' => mkl_pc( 'settings')->get( 'choice_description_no_tooltip', false ),
			) ),
		);

		if ( $saved_configuration_content = $this->get_saved_configuration_content() ) {
			$args['config']['load_config_content'] = $saved_configuration_content;
		}

		wp_localize_script( 'mkl_pc/js/product_configurator', 'PC_config', apply_filters( 'mkl_pc_frontend_js_config', $args ) );

		// $version = $product
		if ( $product ) {
			wp_enqueue_script( 'mkl_pc/js/fe_data_'.$post->ID, Plugin::instance()->cache->get_config_file($post->ID), array(), ( $date_modified ? $date_modified->getTimestamp() : MKL_PC_VERSION ), true );
		}

		$stylesheet = MKL_PC_ASSETS_URL . 'css/product_configurator.css';
		$version = filemtime( MKL_PC_ASSETS_PATH . 'css/product_configurator.css' );
		$theme_id = apply_filters( 'mkl/pc/theme_id', mkl_pc( 'settings' )->get( 'mkl_pc__theme' ) );
		if ( $theme_id && mkl_pc( 'themes' )->get( $theme_id ) ) {
			$theme_info = mkl_pc( 'themes' )->get_theme_info( $theme_id );
			$stylesheet = $theme_info['base_url'] . 'style.css';
			$version = filemtime( trailingslashit( mkl_pc( 'themes' )->get( $theme_id ) ) . 'style.css' );
		}
		wp_register_style( 'mlk_pc/css', apply_filters( 'mkl_pc/css/product_configurator.css', $stylesheet ), array(), $version );

		wp_enqueue_style( 'mlk_pc/css' );

		// to include potential other scripts AFTER the main configurator one
		do_action( 'mkl_pc_scripts_product_page_after' );
	}

	/**
	 * Undocumented function
	 *
	 * @return void
	 */
	private function get_saved_configuration_content() {
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
				return $cart_item['configurator_data_raw'];
			}
		}
		return false;
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
		$img_size = 'full';
		$thumbnail_size = 'medium';
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
}
