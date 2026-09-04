<?php
namespace MKL\PC;

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly
}

/**
 * Registers the top-level Product Configurator admin menu and keeps related screens highlighted.
 */
class Admin_Menu {

	public function __construct() {
		add_action( 'admin_menu', array( $this, 'register' ), 9 );
		add_action( 'admin_menu', array( $this, 'remove_duplicate_submenu' ), 1001 );
		add_action( 'admin_init', array( $this, 'redirect_legacy_settings_url' ) );
		add_filter( 'custom_menu_order', array( $this, 'custom_menu_order' ) );
		add_filter( 'menu_order', array( $this, 'menu_order' ), 20 );
		add_filter( 'parent_file', array( $this, 'parent_file' ) );
		add_filter( 'submenu_file', array( $this, 'submenu_file' ) );
		add_filter( 'admin_body_class', array( $this, 'admin_body_class' ) );
	}

	/**
	 * Register the parent menu item.
	 *
	 * @return void
	 */
	public function register() {
		$menu_slug = mkl_pc_get_admin_menu_slug();

		add_menu_page(
			__( 'Product Configurator', 'product-configurator-for-woocommerce' ),
			__( 'Product Configurator', 'product-configurator-for-woocommerce' ),
			mkl_pc_get_admin_menu_capability(),
			$menu_slug,
			array( $this, 'render_parent_page' ),
			'dashicons-admin-customizer',
			58.7
		);

		// Keep screen IDs stable regardless of translated menu titles.
		global $admin_page_hooks;
		$admin_page_hooks[ $menu_slug ] = 'mkl-pc'; // phpcs:ignore WordPress.WP.GlobalVariablesOverride.Prohibited

		/**
		 * Fires after the Product Configurator parent admin menu is registered.
		 *
		 * Add-ons can add submenu pages here. Custom post types should set
		 * `show_in_menu` to `mkl_pc_get_admin_menu_slug()`.
		 *
		 * @param string $menu_slug Parent menu slug.
		 */
		do_action( 'mkl_pc_admin_menu', $menu_slug );
	}

	/**
	 * Remove the automatic submenu that duplicates the parent item.
	 *
	 * @return void
	 */
	public function remove_duplicate_submenu() {
		remove_submenu_page( mkl_pc_get_admin_menu_slug(), mkl_pc_get_admin_menu_slug() );
	}

	/**
	 * Send users who click the parent item to the first submenu they can access.
	 *
	 * @return void
	 */
	public function render_parent_page() {
		$url = $this->get_first_accessible_submenu_url();
		if ( $url ) {
			wp_safe_redirect( $url );
			exit;
		}

		wp_die( esc_html__( 'You do not have permission to access this page.', 'product-configurator-for-woocommerce' ) );
	}

	/**
	 * Redirect bookmarks of Settings > Product Configurator to the new settings URL.
	 *
	 * @return void
	 */
	public function redirect_legacy_settings_url() {
		global $pagenow;
		if ( 'options-general.php' !== $pagenow ) {
			return;
		}

		$page = isset( $_GET['page'] ) ? sanitize_key( wp_unslash( $_GET['page'] ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Read-only routing of a legacy settings URL.
		if ( 'mkl_pc_settings' !== $page ) {
			return;
		}

		$query_args = array();
		if ( isset( $_GET['tab'] ) ) { // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Tab is copied onto the redirected settings URL.
			$query_args['tab'] = sanitize_key( wp_unslash( $_GET['tab'] ) );
		}

		wp_safe_redirect( mkl_pc_get_settings_page_url( $query_args ) );
		exit;
	}

	/**
	 * Enable custom menu ordering so the parent item can sit after WooCommerce.
	 *
	 * @param bool $enabled Whether custom menu ordering is already enabled.
	 * @return bool
	 */
	public function custom_menu_order( $enabled ) {
		return $enabled || current_user_can( mkl_pc_get_admin_menu_capability() );
	}

	/**
	 * Place the parent menu after WooCommerce's own top-level items.
	 *
	 * @param array $menu_order Menu slugs in display order.
	 * @return array
	 */
	public function menu_order( $menu_order ) {
		if ( ! is_array( $menu_order ) ) {
			return $menu_order;
		}

		$slug       = mkl_pc_get_admin_menu_slug();
		$menu_order = array_values(
			array_filter(
				$menu_order,
				function ( $item ) use ( $slug ) {
					return $item !== $slug;
				}
			)
		);

		$last_woocommerce_index = null;
		$in_woocommerce_block   = false;

		foreach ( $menu_order as $index => $item ) {
			if ( $this->is_woocommerce_menu_item( $item ) ) {
				$in_woocommerce_block   = true;
				$last_woocommerce_index = $index;
				continue;
			}
			if ( $in_woocommerce_block ) {
				break;
			}
		}

		if ( null === $last_woocommerce_index ) {
			$menu_order[] = $slug;
			return $menu_order;
		}

		array_splice( $menu_order, $last_woocommerce_index + 1, 0, array( $slug ) );
		return $menu_order;
	}

	/**
	 * Keep the parent menu open on attached CPT screens.
	 *
	 * @param string $parent_file Current parent file.
	 * @return string
	 */
	public function parent_file( $parent_file ) {
		if ( $this->current_screen_uses_configurator_menu() ) {
			return mkl_pc_get_admin_menu_slug();
		}
		return $parent_file;
	}

	/**
	 * Highlight the matching CPT submenu on edit/add screens.
	 *
	 * @param string $submenu_file Current submenu file.
	 * @return string
	 */
	public function submenu_file( $submenu_file ) {
		$screen = function_exists( 'get_current_screen' ) ? get_current_screen() : null;
		if ( ! $screen || empty( $screen->post_type ) ) {
			return $submenu_file;
		}
		if ( ! $this->post_type_uses_configurator_menu( $screen->post_type ) ) {
			return $submenu_file;
		}
		return 'edit.php?post_type=' . $screen->post_type;
	}

	/**
	 * Add a stable body class on the settings screen.
	 *
	 * @param string $classes Space-separated body classes.
	 * @return string
	 */
	public function admin_body_class( $classes ) {
		if ( mkl_pc_is_settings_page() ) {
			$classes .= ' mkl-pc-settings';
		}
		return $classes;
	}

	/**
	 * Whether a top-level menu slug belongs to WooCommerce's own admin cluster.
	 *
	 * @param string $item Menu slug.
	 * @return bool
	 */
	private function is_woocommerce_menu_item( $item ) {
		$known = array(
			'separator-woocommerce',
			'woocommerce',
			'edit.php?post_type=product',
			'woocommerce-marketing',
			'woocommerce-analytics',
			'wc-admin',
			'wc-reports',
		);
		if ( in_array( $item, $known, true ) ) {
			return true;
		}
		if ( 0 === strpos( $item, 'wc-admin' ) ) {
			return true;
		}
		if ( 0 === strpos( $item, 'admin.php?page=wc-settings' ) ) {
			return true;
		}
		return false;
	}

	/**
	 * @return bool
	 */
	private function current_screen_uses_configurator_menu() {
		$screen = function_exists( 'get_current_screen' ) ? get_current_screen() : null;
		if ( ! $screen || empty( $screen->post_type ) ) {
			return false;
		}
		return $this->post_type_uses_configurator_menu( $screen->post_type );
	}

	/**
	 * @param string $post_type Post type slug.
	 * @return bool
	 */
	private function post_type_uses_configurator_menu( $post_type ) {
		$post_type_object = get_post_type_object( $post_type );
		if ( ! $post_type_object || empty( $post_type_object->show_in_menu ) ) {
			return false;
		}
		return mkl_pc_get_admin_menu_slug() === $post_type_object->show_in_menu;
	}

	/**
	 * @return string
	 */
	private function get_first_accessible_submenu_url() {
		global $submenu;
		$parent = mkl_pc_get_admin_menu_slug();
		if ( empty( $submenu[ $parent ] ) || ! is_array( $submenu[ $parent ] ) ) {
			return '';
		}

		foreach ( $submenu[ $parent ] as $item ) {
			if ( empty( $item[2] ) || $parent === $item[2] ) {
				continue;
			}
			$capability = isset( $item[1] ) ? $item[1] : '';
			if ( $capability && ! current_user_can( $capability ) ) {
				continue;
			}
			return $this->get_menu_item_url( $item[2] );
		}

		return '';
	}

	/**
	 * @param string $menu_slug Submenu slug or relative admin URL.
	 * @return string
	 */
	private function get_menu_item_url( $menu_slug ) {
		if ( false !== strpos( $menu_slug, '.php' ) ) {
			return admin_url( $menu_slug );
		}
		return add_query_arg( 'page', $menu_slug, admin_url( 'admin.php' ) );
	}
}
