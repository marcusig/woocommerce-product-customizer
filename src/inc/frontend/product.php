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

if ( ! class_exists('MKL\PC\Frontend_Product') ) {

	class Frontend_Product {
		
		public function __construct() {
			$this->options = get_option( 'mkl_pc__settings' );
			$this->_hooks();
			$this->button_class = isset( $this->options['mkl_pc__button_classes'] ) && ! empty( $this->options['mkl_pc__button_classes'] ) ? Utils::sanitize_html_classes( $this->options['mkl_pc__button_classes'] ) : 'primary button btn btn-primary';
		}

		private function _hooks() {
			add_action( 'wp' , array( &$this, 'wp_init' ) ); 
			add_filter( 'woocommerce_product_add_to_cart_text', array( &$this, 'add_to_cart_text' ), 30, 2 ); 
			add_filter( 'woocommerce_product_add_to_cart_url',array( &$this, 'add_to_cart_link' ), 30, 2 ); 
			add_filter( 'woocommerce_product_supports', array( &$this, 'simple_product_supports' ), 10, 3 ); 
			add_filter( 'yith_wacp_form_selectors_filter', array( $this, 'yith_wacp_compat' ) );
						
			// add button after form, as form will be moved.
			$location = 'woocommerce_after_add_to_cart_form';
			$priority = 20;
			if ( isset( $this->options['configure_button_location'] ) ) {
				$pr = explode( ':', $this->options['configure_button_location'] );
				if ( isset( $pr[0] ) ) $location = $pr[0];
				if ( isset( $pr[1] ) ) $priority = intVal( $pr[1] );
			}

			add_action( $location, array( &$this, 'add_configure_button' ), $priority );

			// add hidden input to store configurator data into form
			add_action( 'woocommerce_after_add_to_cart_button', array( &$this, 'add_configure_hidden_field' ) ); 
			add_action( 'mkl_pc_frontend_configurator_footer_form',array( $this, 'configurator_price' ), 15 );
			add_action( 'mkl_pc_frontend_configurator_footer_form',array( $this, 'configurator_form' ), 20 ); 
			add_action( 'mkl_pc_templates_empty_viewer', array( &$this, 'variable_empty_configurator_content'), 20 );
			add_action( 'wp_footer', array( &$this, 'print_product_configuration' ) );
		}

		public function add_to_cart_text( $text, $product ) {
			if ( mkl_pc_is_configurable( $product->get_id() ) && $product->get_type() == 'simple' ) {
				$text = __( 'Select options', 'woocommerce' );
			} 
			return $text;

		}
		// Changes Removes add to cart link for simple + configurable products 
		// From add to cart link to premalink
		public function add_to_cart_link( $link, $product ) { 
			//( is_shop() || is_product_category() ) && 
			if ( mkl_pc_is_configurable( $product->get_id() ) && $product->get_type() == 'simple' ) {
				$link = $product->get_permalink();
			}
			return $link;
		}

		public function simple_product_supports( $value, $feature, $product ) {
			if ( mkl_pc_is_configurable( $product->get_id() ) && $product->get_type() == 'simple' ) {
				if ( $feature == 'ajax_add_to_cart' ) $value = false;
			}
			return $value;
		}

		public function add_configure_button() { 
			global $product;
			if ( mkl_pc_is_configurable( get_the_id() ) ) {
				$options = get_option( 'mkl_pc__settings' );
				if ( isset( $options['mkl_pc__button_label'] ) && $options['mkl_pc__button_label'] ) {
					$label = $options['mkl_pc__button_label']; 
				} else {
					$label = __( 'Configure', 'product-configurator-for-woocommerce' );
				}
				if ( ! $product->is_purchasable() || ( 'variable' === $product->get_type() && empty( $product->get_available_variations() ) ) ) {
					echo '<!-- Product configurator - The current product is not purchasable or has no available variations -->';
					return;
				}
				echo apply_filters( 'mkl_pc_configure_button', '<button class="configure-product configure-product-'. $product->get_type().' '. $this->button_class .'" data-price="'.esc_attr( $this->get_product_price( get_the_id() ) ).'" data-product_id="'.get_the_id().'" type="button">'. $label .'</button>' );
			}
		}

		public function get_product_price( $product_id ) {
			$product = wc_get_product( $product_id ); 
			$base_currency = get_option( 'woocommerce_currency' );
			$price = wc_get_price_to_display( $product );

			global $WOOCS;
			if ( $WOOCS && ! isset( $_REQUEST['woocs_block_price_hook'] ) ) {
				$_REQUEST['woocs_block_price_hook'] = 1;
				$price = wc_get_price_to_display( $product );
				unset( $_REQUEST['woocs_block_price_hook'] );
			}

			// Price Based on Country
			if ( function_exists( 'wcpbc_the_zone' ) ) {
				$zone = wcpbc_the_zone();
				if ( is_callable( [ $zone, 'get_exchange_rate' ] ) ) {
					$rate = $zone->get_exchange_rate();
					$price = $price / $rate;
				}
			}
			
			// Aelia
			$price = apply_filters( 'wc_aelia_cs_get_product_price', $price, $product_id, $base_currency );

			// Woo Multi Currency
			if ( function_exists( 'wmc_revert_price' ) ) {
				$price = wmc_revert_price( $price );
			}
			return $price;
		}

		public function add_configure_hidden_field() {
			if ( mkl_pc_is_configurable( get_the_id() ) ) {
				echo '<input type="hidden" name="pc_configurator_data">';
				echo '<input type="hidden" name="pc_cart_item_key">';
			}
		}

		/**
		 * Display the price
		 *
		 * @return void
		 */
		public function configurator_price() {
			global $product;
			if ( ! isset( $this->options['show_price_in_configurator'] ) || 'on' != $this->options['show_price_in_configurator'] ) return;
		?>
			<span class="pc-total-price <?php echo esc_attr( apply_filters( 'woocommerce_product_price_class', 'price' ) ); ?>"><# if ( data.formated_price ) { #>{{{data.formated_price}}}<# } else { #><?php echo $product ? $product->get_price_html() : ''; ?><# } #></span>
		<?php 
		}

		/**
		 * Display the form
		 */
		public function configurator_form() {
			global $product, $mkl_product;
			if ( ! $product && $mkl_product ) {
				$product = $mkl_product;
			}
			$add_to_cart = $this->get_add_to_cart_label();

			echo '<div class="pc_configurator_form">';

			echo '<# if ( data.is_in_stock ) { #>';
				echo '<# if ( ! data.show_form ) { #>';
				if ( $product && ! $product->is_sold_individually() ) {
					woocommerce_quantity_input( array(
						'min_value'   => apply_filters( 'woocommerce_quantity_input_min', 1, $product ),
						'max_value'   => apply_filters( 'woocommerce_quantity_input_max', $product->backorders_allowed() ? '' : $product->get_stock_quantity(), $product ),
						'input_value' => ( isset( $_POST['quantity'] ) ? wc_stock_amount( intval( $_POST['quantity'] ) ) : 1 )
					), $product );
				}
				echo '<# } #>';
				?>
					<# if ( data.show_form ) { #>
						<form class="cart" method="post" enctype='multipart/form-data'>
							<input type="hidden" name="pc_configurator_data">
							<input type="hidden" name="pc_cart_item_key">
							<input type="hidden" name="add-to-cart" value="{{data.product_id}}">
							<# if ( data.show_qty ) { #>
								<?php woocommerce_quantity_input( [], $product ); ?>
							<# } #>
						</form>
					<# } #>

					<button type="button" class="<?php echo $this->button_class ?> configurator-add-to-cart">
						<?php echo $this->get_cart_icon(); ?>
						<span><?php echo $add_to_cart; ?></span>
					</button>
					<button type="button" class="<?php echo $this->button_class ?> edit-cart-item configurator-add-to-cart">
						<span><?php _e( 'Edit item in cart', 'product-configurator-for-woocommerce' ); ?></span>
					</button>
					<?php do_action( 'mkl_pc_frontend_configurator_after_add_to_cart' ); ?>
				<?php
			echo '<# } else { #>';
				echo '<div class="out-of-stock"></div>';
			echo '<# } #>';
			echo '</div>';
		}

		public function get_add_to_cart_label() {
			global $post;
			$label = apply_filters( 'mkl_pc/add_to_cart_button/default_label', __( 'Add to cart', 'woocommerce' ) );
			if ( $post  ) {
				// Quotes for WooCommerce
				if ( function_exists( 'product_quote_enabled' ) ) {
					global $quotes_wc;
					if ( $quotes_wc && is_callable( [ $quotes_wc, 'qwc_change_button_text' ] ) ) {
						$label = $quotes_wc->qwc_change_button_text( $label );
					}
				}
			}
			return apply_filters( 'mkl_pc/add_to_cart_button/label', $label );
		}

		public function get_cart_icon() {
			return apply_filters( 'mkl_pc/get_cart_icon', '<svg xmlns="http://www.w3.org/2000/svg" width="37.118" height="33" viewBox="0 0 37.118 33"><path id="Path_2" data-name="Path 2" d="M34.031-9.475a1.506,1.506,0,0,1-.548.9,1.5,1.5,0,0,1-.935.322H13.664l.387,2.062H31.389a1.406,1.406,0,0,1,1.16.58,1.56,1.56,0,0,1,.322,1.289l-.387,1.611A3.491,3.491,0,0,1,34-1.386a3.5,3.5,0,0,1,.548,1.9,3.474,3.474,0,0,1-1.063,2.546,3.579,3.579,0,0,1-5.092,0A3.511,3.511,0,0,1,27.328.483a3.357,3.357,0,0,1,1.1-2.546H14.889a3.357,3.357,0,0,1,1.1,2.546,3.511,3.511,0,0,1-1.063,2.578,3.579,3.579,0,0,1-5.092,0A3.474,3.474,0,0,1,8.766.516a3.551,3.551,0,0,1,.483-1.8A3.8,3.8,0,0,1,10.57-2.643L6.059-24.75H1.547a1.492,1.492,0,0,1-1.1-.451A1.492,1.492,0,0,1,0-26.3v-1.031a1.492,1.492,0,0,1,.451-1.1,1.492,1.492,0,0,1,1.1-.451H8.186a1.411,1.411,0,0,1,.935.354,1.637,1.637,0,0,1,.548.87l.58,2.9h25.33a1.469,1.469,0,0,1,1.225.58,1.4,1.4,0,0,1,.258,1.289Z" transform="translate(0 28.875)" fill="#707070"/></svg>' );
		}

		public function print_product_configuration(){
			if ( ! mkl_pc()->frontend->load_configurator_on_page() ) return;
			include_once 'views/html-product-configurator-templates.php';
		}

		public function variable_empty_configurator_content() {
			_e( 'Please select a variation to configure', 'product-configurator-for-woocommerce' );
		}

		public function body_class( $classes ) {
			// global $post;
			if ( is_product() ) {
				if ( mkl_pc_is_configurable() ) {
					if ( mkl_pc( 'settings')->get( 'enable_default_add_to_cart', false ) || get_post_meta( get_the_ID(), 'enable_default_add_to_cart', true ) ) {
						$classes[] = 'enable-add-to-cart';
					}
					$classes[] = 'is_configurable';
				}
			}
			return $classes;
		}

		public function wp_init() {
			add_filter('body_class', array($this, 'body_class') ) ;			
		}

		/**
		 * Compatibility with Yith Added to cart popup (Premium)
		 *
		 * @param string $selectors - The Form selectors
		 * @return string
		 */
		public function yith_wacp_compat( $selectors ) {
			if ( function_exists( 'is_product' ) && is_product() ) return $selectors;
			$selectors .= ',.mkl_pc form.cart';
			return $selectors;
		}

	}
}