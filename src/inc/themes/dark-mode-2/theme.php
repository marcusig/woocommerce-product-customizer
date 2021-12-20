<?php
if ( ! defined( 'ABSPATH' ) ) die();

function mkl_pc_dark_theme_scripts() {
	wp_enqueue_script( 'mkl_dark_theme2', plugin_dir_url( __FILE__ ) . 'darkmode2.js', [ 'flexslider' ], MKL_PC_VERSION, true );
	wp_localize_script( 'mkl_dark_theme2', 'pc_stepper_config', [
		'color_mode' => get_option( MKL\PC\Customizer::PREFIX . 'color_mode', 'dark' ),
		'list_mode' => get_option( MKL\PC\Customizer::PREFIX . 'list_mode', 'vertical' ),
		'layout' => get_option( MKL\PC\Customizer::PREFIX . 'layout', 'left' ),
	] );
}
add_action( 'mkl_pc_scripts_product_page_before', 'mkl_pc_dark_theme_scripts', 20 );

/**
 * Remove the default bg image
 */
add_filter( 'mkl_pc_bg_image', function( $bg ) {
	return '';
}, 30 );

/**
 * Add JS dependencies
 */
add_filter( 'mkl_pc/js/product_configurator/dependencies', function( $deps ) {
	$deps[] = 'mkl_dark_theme2';
	return $deps;
}, 30 );

/**
 * Add theme feature supports (color mode)
 *
 * @param array $features
 * @return array
 */
add_filter( 'mkl_pc/theme_supports', function( $features ) {
	$features['color_mode'] = true;
	return $features;
} );

/**
 * Filter the customizer's colors
 *
 * @param array $colors
 * @return array
 */
function mkl_pc_dark_theme_filter_colors( $colors ) {
	$cm = get_option( MKL\PC\Customizer::PREFIX . 'color_mode', 'dark' );
	if ( 'dark' == $cm ) {

		$colors['dark'] = [
			'default' => '#2e2e32',
			'label' => __( 'Dark gray (Layers background)', 'product-configurator-for-woocommerce' )
		];
		$colors['darkest'] = [
			'default' => '#202125',
			'label' => __( 'Darker gray (Preview background, borders)', 'product-configurator-for-woocommerce' )
		];
		$colors['ll1'] = [
			'default' => '#f2f3f5',
			'label' => __( 'Light gray 1', 'product-configurator-for-woocommerce' )
		];
		$colors['ll2'] = [
			'default' => '#b0b5c0',
			'label' => __( 'Light gray 2', 'product-configurator-for-woocommerce' )
		];
		$colors['ll3'] = [
			'default' => '#6b6f7a',
			'label' => __( 'Medium gray 3', 'product-configurator-for-woocommerce' )
		];
		$colors['ll4'] = [
			'default' => '#565b64',
			'label' => __( 'Medium gray 4', 'product-configurator-for-woocommerce' )
		];
		$colors['nav-button-bg'] = [
			'default' => '#f2f3f5',
			'label' => __( 'Nav button background', 'product-configurator-for-woocommerce' )
		];
		$colors['nav-button-color'] = [
			'default' => '#333333',
			'label' => __( 'Nav button color', 'product-configurator-for-woocommerce' )
		];
	} else {
		$colors['dark'] = [
			'default' => '#e6e6e6',
			'label' => __( 'Layers background', 'product-configurator-for-woocommerce' )
		];
		$colors['darkest'] = [
			'default' => '#f7f7f7',
			'label' => __( 'Preview background, borders', 'product-configurator-for-woocommerce' )
		];
		$colors['ll1'] = [
			'default' => '#505354',
			'label' => __( 'Medium gray 1', 'product-configurator-for-woocommerce' )
		];
		$colors['ll2'] = [
			'default' => '#4f5050',
			'label' => __( 'Medium gray 2', 'product-configurator-for-woocommerce' )
		];
		$colors['ll3'] = [
			'default' => '#b3b3b3',
			'label' => __( 'Light gray 3', 'product-configurator-for-woocommerce' )
		];
		$colors['ll4'] = [
			'default' => '#d4d4d4',
			'label' => __( 'Light gray 2', 'product-configurator-for-woocommerce' )
		];
		$colors['nav-button-bg'] = [
			'default' => '#565b64',
			'label' => __( 'Nav button background', 'product-configurator-for-woocommerce' )
		];
		$colors['nav-button-color'] = [
			'default' => '#ffffff',
			'label' => __( 'Nav button color', 'product-configurator-for-woocommerce' )
		];
	}

	// Remove the primary color
	if ( isset( $colors['primary'] ) ) unset( $colors['primary'] );

	return $colors;
}
add_filter( 'mkl_pc_theme_color_settings', 'mkl_pc_dark_theme_filter_colors' );


function mkl_pc_dark_theme_customize_settings( $wp_customize ) {
	$prefix = MKL\PC\Customizer::PREFIX;
	if ( ! class_exists( 'MKL\PC\Custom_Radio_Image_Control' ) ) require_once MKL_PC_INCLUDE_PATH . 'admin/customizer-radio-control.php';

	// Add the first Dark/light mode setting
	$wp_customize->add_setting(
		$prefix . 'color_mode',
		array(
			'default' => 'dark',
			'type' => 'option', 
			'capability' =>  'edit_theme_options',
			// 'sanitize_callback' => 'esc_url',
		)
	);

	$wp_customize->add_control(
		new \WP_Customize_Control(
			$wp_customize,
			$prefix . 'color_mode',
			array('label'  => __( 'Color mode', 'product-configurator-for-woocommerce' ),
				'section'  => 'mlk_pc',
				'settings' => $prefix . 'color_mode',
				'type'     => 'radio',
				'choices'  => array(
					'dark'   => __( 'Dark', 'product-configurator-for-woocommerce' ),
					'light'  => __( 'Light', 'product-configurator-for-woocommerce' ),
				)
			)
		)
	);	

	// Add the list / big button setting
	$wp_customize->add_setting(
		$prefix . 'list_mode',
		array(
			'default' => 'vertical',
			'type' => 'option', 
			'capability' =>  'edit_theme_options',
			// 'sanitize_callback' => 'esc_url',
		)
	);

	$wp_customize->add_control(
		new MKL\PC\Custom_Radio_Image_Control(
			$wp_customize,
			$prefix . 'list_mode',
			array('label'  => __( 'Choices list mode', 'product-configurator-for-woocommerce' ),
				'section'  => 'mlk_pc',
				'settings' => $prefix . 'list_mode',
				'choices'  => array(
					'vertical'     => MKL_PC_ASSETS_URL . 'admin/images/setting-vertical-list.png',
					'horizontal'  => MKL_PC_ASSETS_URL . 'admin/images/setting-horizontal-list.png',
				)
			)
		)
	);

		// Add the layout setting
		$wp_customize->add_setting(
			$prefix . 'layout',
			array(
				'default' => 'left',
				'type' => 'option', 
				'capability' =>  'edit_theme_options',
				// 'sanitize_callback' => 'esc_url',
			)
		);
	
		$wp_customize->add_control(
			new MKL\PC\Custom_Radio_Image_Control(
				$wp_customize,
				$prefix . 'layout',
				array('label'  => __( 'Configurator layout', 'product-configurator-for-woocommerce' ),
					'section'  => 'mlk_pc',
					'settings' => $prefix . 'layout',
					'choices'  => array(
						'left'     => MKL_PC_ASSETS_URL . 'admin/images/setting-left-sidebar.png',
						'right'  => MKL_PC_ASSETS_URL . 'admin/images/setting-right-sidebar.png',
					)
				)
			)
		);	
}
add_action( 'customize_register', 'mkl_pc_dark_theme_customize_settings', 11 );

add_action( 'mkl_pc_frontend_templates_after', function() { 
	$options = get_option( 'mkl_pc__settings' );
	$button_class = isset( $options['mkl_pc__button_classes'] ) && ! empty( $options['mkl_pc__button_classes'] ) ? MKL\PC\Utils::sanitize_html_classes( $options['mkl_pc__button_classes'] ) : 'primary button btn btn-primary';

	?>
	<script type="text/html" id="tmpl-mkl-pc-dm2-nav">
		<# if ( data.current ) { #>
			<button class="mkl-pc-prev"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><rect x="0" fill="none" width="20" height="20"/><g><path d="M14 5l-5 5 5 5-1 2-7-7 7-7z"/></g></svg></button>
		<# } #>
		<# if ( data.is_summary ) { #>
			<# if ( parseInt( PC.fe.currentProductData.product_info.is_in_stock ) ) { #>
				<button type="button" class="<?php echo $button_class ?> mkl-pc-add-to-cart--trigger mkl-pc-next">
					<?php echo mkl_pc( 'frontend' )->product->get_cart_icon() ?>
					<span><?php echo apply_filters( 'mkl_pc/add_to_cart_button/label', __( 'Add to cart', 'woocommerce' ) ); ?></span>
				</button>
			<# } else { #>
				<div class="out-of-stock">
					<?php
						if ( has_action( 'mkl_pc/configurator_form/out_of_stock' ) ) {
							do_action( 'mkl_pc/configurator_form/out_of_stock' ); 
						} else {
							_e( 'Out of stock', 'product-configurator-for-woocommerce' );
						}
					?>
				</div>
			<# } #>
		<# } else { #>
			<button class="mkl-pc-next">
				{{data.current}} - {{data.next_item_name}} 
				<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><rect x="0" fill="none" width="20" height="20"/><g><path d="M6 15l5-5-5-5 1-2 7 7-7 7z"/></g></svg>
			</button>
		<# } #>
	</script>

	<script type="text/html" id="tmpl-mkl-pc-dm2-summary">
		<h3><?php _e( 'Summary', 'product-configurator-for-woocommerce' ); ?></h3>
		<# _.each( data.choices, function( choice ) { #>
			<# if ( choice.is_choice ) { #><p><span class="layer-name">{{choice.layer_name}}</span> <span class="choice-name">{{choice.name}}</span></p><# } #>
		<# } ); #>
	</script>

	<script type="text/html" id="tmpl-mkl-pc-dm2-summary-layer">
		<h4>{{data.name}}</h4>
		<# if ( ! data.choices.length ) { #>
			<p><?php _e( 'Nothing selected', 'product-configurator-for-woocommerce' ); ?></p>
		<# 
			} else { 
				_.each( data.choices, function( a ) {
					console.log('choice > ', a);
		#>
			<p>{{a.get( 'name' )}}</p>
		<# 
				} );
			} 
		#>
	</script>


<?php });