<?php
namespace MKL\PC;
/**
 *	
 *	
 * @author   Marc Lacroix
 $ 
 */


if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly
}

class Frontend_Product {
	
	public function __construct() {
		$this->_hooks();
		$this->options = get_option( 'mkl_pc__settings' );
		$this->button_class = isset( $this->options['mkl_pc__button_classes'] ) ? Utils::sanitize_html_classes( $this->options['mkl_pc__button_classes'] ) : 'btn btn-primary';
	}

	private function _hooks() {
		add_action( 'wp' , array( &$this, 'wp_init' ) ); 
		add_filter( 'woocommerce_product_add_to_cart_text', array( &$this, 'add_to_cart_text' ), 30, 2 ); 
		add_filter( 'woocommerce_product_add_to_cart_url',array( &$this, 'add_to_cart_link' ), 30, 2 ); 
		add_filter( 'woocommerce_product_supports', array( &$this, 'simple_product_supports' ), 10, 3 ); 
		
		// add button after form, as form will be moved.
		add_action( 'woocommerce_after_add_to_cart_form', array( &$this, 'add_customize_button' ) ); 		
		// add hidden input to store customizer data into form
		add_action( 'woocommerce_after_add_to_cart_button', array( &$this, 'add_customize_hidden_field' ) ); 
		add_action( 'mkl_pc_frontend_customizer_footer_form',array( $this, 'customizer_form' ), 20 ); 
		add_action( 'mkl_pc_templates_empty_viewer', array( &$this, 'variable_empty_customizer_content'), 20 );
		add_action( 'wp_footer', array(&$this, 'print_product_configuration' ) );
	}

	public function add_to_cart_text( $text, $product ) {
		if( mkl_pc_is_customizable( $product->get_id() ) && $product->get_type() == 'simple' ) {
			$text = __( 'Select options', 'woocommerce' );
		} 
		return $text;

	}
	// Changes Removes add to cart link for simple + customizable products 
	// From add to cart link to premalink
	public function add_to_cart_link( $link, $product ) { 
		//( is_shop() || is_product_category() ) && 
		if( mkl_pc_is_customizable( $product->get_id() ) && $product->get_type() == 'simple' ) {
			$link = $product->get_permalink();
		}
		return $link;
	}
	public function simple_product_supports( $value, $feature, $product ) {
		if( mkl_pc_is_customizable( $product->get_id() ) && $product->get_type() == 'simple' ) {
			if ( $feature == 'ajax_add_to_cart' ) $value = false;
		}
		return $value;

	}

	public function add_customize_button() { 
		global $product;
		if ( mkl_pc_is_customizable( get_the_id() ) ) {
			echo apply_filters( 'mkl_pc_customize_button', '<button class="customize-product customize-product-'. $product->get_type().' '. $this->button_class .'" type="button">'.__( 'Customize', MKL_PC_DOMAIN ) .'</button>' );
		}
	}

	public function add_customize_hidden_field() {
		if( mkl_pc_is_customizable( get_the_id() ) ) {
			echo '<input type="hidden" name="pc_customizer_data">'; 
		}			
	}

	public function customizer_form() {
		global $product;
 		if ( ! $product->is_sold_individually() ) {
 			woocommerce_quantity_input( array(
 				'min_value'   => apply_filters( 'woocommerce_quantity_input_min', 1, $product ),
 				'max_value'   => apply_filters( 'woocommerce_quantity_input_max', $product->backorders_allowed() ? '' : $product->get_stock_quantity(), $product ),
 				'input_value' => ( isset( $_POST['quantity'] ) ? wc_stock_amount( $_POST['quantity'] ) : 1 )
 			) );
 		}
	 	?>
			<button type="button" class="<?php echo $this->button_class ?> customizer-add-to-cart"><?php _e( 'Add to cart', 'woocommerce' ) ?></button>
	 	<?php
	}

	public function print_product_configuration(){
		global $post, $product; 
		if( !mkl_pc_is_customizable( get_the_id() ) )
			return;

		include( 'views/html-product-customizer-templates.php' );
	}

	public function variable_empty_customizer_content() {
		_e( 'Please select a variation to customize', MKL_PC_DOMAIN );
	}

	public function body_class( $classes ) {
		// global $post;
		if( is_product() ) {
			
			if( mkl_pc_is_customizable() ) {
				$classes[] = 'is_customizable';
			}
		}
		return $classes;
	}

	public function wp_init() {
		add_filter('body_class', array($this, 'body_class') ) ;			
	}


}
