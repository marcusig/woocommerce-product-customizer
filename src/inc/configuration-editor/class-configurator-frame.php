<?php
namespace MKL\PC;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * A configurable product served as a bare page holding only the configurator, to load in a frame
 *
 * The product keeps its own URL and its own main query, so everything the configurator reads from the
 * page (scripts, data, presets, ?load_config_from_order...) behaves as on the product page. Only the
 * template changes.
 *
 * Nothing turns it on by itself: the admin configuration editor does, and add-ons can on
 * `mkl_pc/frame/is_frame_request` (the Embed mode add-on, for ?embed_configurator=true).
 */
class Configurator_Frame {

	/**
	 * @var boolean|null
	 */
	private $is_frame = null;

	public function __construct() {
		add_action( 'template_redirect', [ $this, 'setup' ], 1 );
		add_filter( 'template_include', [ $this, 'get_template' ], 99 );
		// Registered up front: the admin bar decides whether to show itself at template_redirect priority 0.
		add_filter( 'show_admin_bar', [ $this, 'hide_admin_bar' ], 100 );
	}

	/**
	 * Whether the current request is for the bare configurator. Answers false before the main query has run.
	 *
	 * @return boolean
	 */
	public function is_frame_request() {
		if ( ! did_action( 'wp' ) || ! is_singular( 'product' ) ) return false;
		if ( null !== $this->is_frame ) return $this->is_frame;
		$product_id = get_queried_object_id();
		if ( ! mkl_pc_is_configurable( $product_id ) ) return $this->is_frame = false;

		/**
		 * Whether to serve the product as the bare configurator
		 *
		 * @param boolean $is_frame
		 * @param int     $product_id
		 */
		return $this->is_frame = (bool) apply_filters( 'mkl_pc/frame/is_frame_request', false, $product_id );
	}

	public function setup() {
		if ( ! $this->is_frame_request() ) return;

		// What the bare template cannot leave out: these print from wp_footer whatever the template does.
		// WooCommerce's store notice (it falls back to wp_footer when wp_body_open never fires) and
		// TranslatePress' floating language switcher, through the filters TranslatePress provides for it.
		add_filter( 'woocommerce_demo_store', '__return_empty_string' );
		add_filter( 'trp_floater_ls_html_v2', '__return_empty_string' );
		add_filter( 'trp_floating_ls_html', '__return_empty_string' );
		add_filter( 'wp_robots', 'wp_robots_no_robots' );
		add_action( 'wp_enqueue_scripts', [ $this, 'enqueue_assets' ], 100 );

		/**
		 * Fires when the bare configurator is about to be served
		 *
		 * @param int $product_id
		 */
		do_action( 'mkl_pc/frame/setup', get_queried_object_id() );
	}

	public function get_template( $template ) {
		return $this->is_frame_request() ? __DIR__ . '/views/frame.php' : $template;
	}

	public function hide_admin_bar( $show ) {
		return $this->is_frame_request() ? false : $show;
	}

	public function enqueue_assets() {
		wp_register_style( 'mkl_pc/css/frame', false, [], MKL_PC_VERSION );
		wp_enqueue_style( 'mkl_pc/css/frame' );
		wp_add_inline_style( 'mkl_pc/css/frame', $this->get_css() );

		if ( wp_script_is( 'mkl_pc/js/product_configurator', 'enqueued' ) ) {
			wp_add_inline_script( 'mkl_pc/js/product_configurator', $this->get_inline_script() );
		}
	}

	/**
	 * @return string
	 */
	private function get_css() {
		return '
/* The configurator is the page: no margin, no page scroll. */
html,
body.mkl-pc-frame {
	margin: 0;
	padding: 0;
	height: 100%;
	overflow: hidden;
}
/* While it loads, the "Loading the configurator..." text is centered on the whole frame. */
body.mkl-pc-frame .mkl-configurator-inline:empty {
	height: 100vh;
	height: 100dvh;
}
/* The layout has a close button, and there is nothing behind it to go back to. */
body.mkl-pc-frame .mkl_pc .close-mkl-pc {
	display: none !important;
}';
	}

	/**
	 * Lay the configurator out to fill the frame
	 *
	 * The configurator is mounted inline, so it never opens as a dialog: no focus trap, Escape and the
	 * close button do nothing, and adding to the cart leaves it open. But inline is also laid out for the
	 * flow of a page (natural height, a minimum of 500px), and how well that fills a frame depends on the
	 * theme: some stop short or sit 30px too high. The layout that fills the viewport in every theme is the
	 * dialog one, which applies whenever the body is not marked as inline. Nothing in JS reads that class,
	 * it only styles, so it is dropped as soon as it is added. A MutationObserver runs before the next
	 * paint, so there is no flash of the inline layout. The configurator's scripts are often printed in
	 * <head>, where there is no body yet, hence the wait for DOMContentLoaded.
	 *
	 * @return string
	 */
	private function get_inline_script() {
		return '( function () {
	function drop_inline_class() {
		// The guard matters: removing a class that is not there still counts as a change, and would loop.
		if ( document.body.classList.contains( "configurator_is_inline" ) ) {
			document.body.classList.remove( "configurator_is_inline" );
		}
	}
	function watch_body() {
		drop_inline_class();
		new MutationObserver( drop_inline_class ).observe( document.body, { attributes: true, attributeFilter: [ "class" ] } );
	}
	if ( document.body ) {
		watch_body();
	} else {
		document.addEventListener( "DOMContentLoaded", watch_body );
	}
} )();';
	}
}
