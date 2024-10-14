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

if ( ! class_exists('MKL\PC\Customizer') ) {

	class Customizer {
		const PREFIX = 'mkl_pc_theme_';
		public function __construct() {
			add_action( 'customize_register', array( $this, 'customize_register' ), 10 );
			add_action( 'customize_preview_init', array( $this, 'customizer_init' ), 10 );
			add_action( 'mkl_pc_scripts_product_page_after', array( $this, 'output_css' ), 40 );
		}

		/**
		 * Customizer init - enqueue the customizer specific JS
		 *
		 * @return void
		 */
		public function customizer_init() {
			wp_enqueue_script( 'mkl_pc/customizer', MKL_PC_ASSETS_URL . 'admin/js/customizer.js', [ 'jquery', 'customize-base' ], filemtime( MKL_PC_ASSETS_PATH . 'admin/js/customizer.js' ) );
			wp_localize_script( 'mkl_pc/customizer', 'mkl_pc_theme_colors', array_keys( $this->get_colors() ) );
		}

		/**
		 * Get the color settings
		 *
		 * @return array
		 */
		private function get_colors() {
			// The colors
			return apply_filters( 'mkl_pc_theme_color_settings', array(
				'primary' => [
					'default' => '',
    				'label' => __( 'Accent color', 'product-configurator-for-woocommerce' )
				],
				// 'primary_hover' => [
				// 	'default' => '',
    			// 	'label' => __( 'Accent color hover', 'product-configurator-for-woocommerce' )
				// ],
				'layers_button_text_color' => [
					'default' => '',
    				'label' => __( 'Layers text color', 'product-configurator-for-woocommerce' )
				],
				'choices_button_text_color' => [
					'default' => '',
    				'label' => __( 'Choices text color', 'product-configurator-for-woocommerce' )
				],
				'active_layer_button_bg_color' => [
					'default' => '',
    				'label' => __( 'Active layer background color', 'product-configurator-for-woocommerce' )
				],
				'active_layer_button_text_color' => [
					'default' => '',
    				'label' => __( 'Active layer text color', 'product-configurator-for-woocommerce' )
				],
				'active_choice_button_bg_color' => [
					'default' => '',
    				'label' => __( 'Active choice background color', 'product-configurator-for-woocommerce' )
				],
				'active_choice_button_text_color' => [
					'default' => '',
    				'label' => __( 'Active choice text color', 'product-configurator-for-woocommerce' )
				],
			) );

		}

		/**
		 * Add the settings to the customizer
		 *
		 * @param [type] $wp_customize
		 * @return void
		 */
		public function customize_register( $wp_customize ) {

			do_action( 'mkl_pc_customizer_settings_before', $wp_customize, $this );

			$color_settings = $this->get_colors();

			// add the section to contain the settings
			$wp_customize->add_section( 'mlk_pc' , array(
				'title'    => __( 'Product Configurator', 'product-configurator-for-woocommerce' ),
				'priority' => 199, // Right before WooCommerce
				// 'description' => __( 'Customize the colors of the ', 'product-configurator-for-woocommerce' ),
			) );

			// add the settings and controls for each color
			foreach( $color_settings as $slug => $setting ) {
			
				$slug = self::PREFIX . $slug;
				// Color setting
				$wp_customize->add_setting(
					$slug,
					array(
						'default' => $setting['default'],
						'type' => 'option', 
						'capability' =>  'edit_theme_options',
						'sanitize_callback' => 'sanitize_hex_color',
						'transport' => 'postMessage',
					)
				);

				// Color CONTROLS
				$wp_customize->add_control(
					new \WP_Customize_Color_Control(
						$wp_customize,
						$slug,
						array('label' => $setting['label'], 
							'section' => 'mlk_pc',
							'settings' => $slug
						)
					)
				);				
			}

			/**
			 * Background image
			 */

			$wp_customize->add_setting(
				self::PREFIX . 'use_viewer_bg',
				array(
					'default'    => true,
					'type'       => 'option',
					'capability' => 'edit_theme_options',
					'transport' => 'postMessage',
				)
			);

			$wp_customize->add_control(
				self::PREFIX . 'use_viewer_bg',
				array(
					'label'    => __( 'Use a background image for the viewer', 'product-configurator-for-woocommerce' ),
					'section'  => 'mlk_pc',
					'settings' => self::PREFIX . 'use_viewer_bg',
					'type'     => 'checkbox',
				)
			);


			$wp_customize->add_setting(
				self::PREFIX . 'viewer_bg',
				array(
					'default' => MKL_PC_ASSETS_URL.'images/default-bg.jpg',
					'type' => 'option', 
					'capability' =>  'edit_theme_options',
					'transport' => 'postMessage',
					// 'sanitize_callback' => 'esc_url',
				)
			);

			$wp_customize->add_control(
				new \WP_Customize_Image_Control(
					$wp_customize,
					self::PREFIX . 'viewer_bg',
					array('label' => __( 'Custom background image', 'product-configurator-for-woocommerce' ),
						'section' => 'mlk_pc',
						'settings' => self::PREFIX . 'viewer_bg'
					)
				)
			);

			do_action( 'mkl_pc_customizer_settings', $wp_customize, $this );

		}

		/**
		 * Output CSS variables
		 */
		public function output_css() {
			$colors = $this->get_colors();
			$rules = [];
			$css = '';
			foreach( $colors as $slug => $color ) {
				$color_name = str_replace( self::PREFIX, '', $slug );
				if ( $c = get_option( $slug = self::PREFIX . $slug, $color['default'] ) ) {
					$rules[] = '--mkl_pc_color-' . $color_name . ': ' .  $c . ';';
					if ( 'primary' == $color_name ) {
						$rules[] = '--mkl_pc_color-' . $color_name . '_rgb: ' . implode(', ', $this->hex2rgb( $c ) ) . ';';
					}
				}
			}

			if ( ! empty ( apply_filters( 'mkl_pc_them_color_variables', $rules ) ) ) {
				$css .= '
				.mkl_pc, body > .layer_choices.display-mode-full-screen {' .
					implode( "\n", $rules )
				. '}
				';
			}

			wp_add_inline_style( 'mlk_pc/css', $css );
		}

		private function hex2rgb( $color ) {
			$color = trim( $color, '#' );
		
			if ( strlen( $color ) === 3 ) {
				$r = hexdec( substr( $color, 0, 1 ) . substr( $color, 0, 1 ) );
				$g = hexdec( substr( $color, 1, 1 ) . substr( $color, 1, 1 ) );
				$b = hexdec( substr( $color, 2, 1 ) . substr( $color, 2, 1 ) );
			} elseif ( strlen( $color ) === 6 ) {
				$r = hexdec( substr( $color, 0, 2 ) );
				$g = hexdec( substr( $color, 2, 2 ) );
				$b = hexdec( substr( $color, 4, 2 ) );
			} else {
				return array();
			}
		
			return array(
				'red'   => $r,
				'green' => $g,
				'blue'  => $b,
			);
		}
	}

}
