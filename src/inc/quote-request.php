<?php 
namespace MKL\PC;
use \WP_Error as WP_Error;
/**
 * Product functions
 *
 *
 * @author   Marc Lacroix
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly
}

class Quote_Request {
	public function __construct() {
		$this->_hooks();
	}

	/**
	 * Add jhe relevant hooks
	 *
	 * @return void
	 */
	private function _hooks(){
        if ( mkl_pc( 'settings' )->get( 'quote_add_to_cart_permitted' ) ) {
            add_action( 'mkl_pc_frontend_configurator_after_add_to_cart', [ $this, 'output_add_to_quote_button' ], 15 );
        } else {
            add_action( 'mkl_pc_frontend_configurator_footer_form',array( $this, 'output_add_to_quote_button' ), 20 ); 
        }

		// add_action( 'wp_enqueue_scripts', array( $this, 'enqueue_scripts') );
        add_filter( 'mkl_pc/display_add_to_cart_button', [ $this, 'display_add_to_cart' ] );
        add_action( 'mkl_pc_frontend_templates_after', [ $this, 'add_js_templates' ] );
        add_action( 'tmpl-mkl-pc-quote-request-form', [ $this, 'add_fields' ] );
        add_action( 'mkl_pc_add_to_cart_before', [ $this, 'do_request' ] );

        add_filter( 'woocommerce_email_classes', [ $this, 'add_email_class' ] ); 

		// add_filter( 'mkl_pc/js/product_configurator/dependencies', array( $this, 'add_script_dependencies' ) );
	}

	/**
	 * Enqueue the scripts and styles
	 */
	public function enqueue_scripts() {
	}

    /**
     * Add email classes to WC's list
     *
     * 
     */
    public function add_email_class( $emails ) {
		if ( ! $this->is_enabled() ) return $emails;
		$emails['MK_PC_Quote_Request_Customer_Email'] = include MKL_PC_INCLUDE_PATH . 'emails/class-mkl-pc-customer-email.php';
		$emails['MK_PC_Quote_Request_Admin_Email'] = include MKL_PC_INCLUDE_PATH . 'emails/class-mkl-pc-admin-email.php';
		return $emails;
    }
    
    /**
     * Remove Add to cart form if necessary
     */
    public function display_add_to_cart( $display_cart ) {
        if ( $this->is_enabled() && !mkl_pc( 'settings' )->get( 'quote_add_to_cart_permitted') ) return false;
        return $display_cart;
    }

	public function add_script_dependencies( $deps ) {
		// if ( $this->is_enabled() && 'pixi' === mkl_pc( 'settings' )->get( 'pdf_render_method', 'pixi' ) ) { 
		// 	$deps[] = 'pixijs';
		// } elseif ( $this->is_enabled() && 'html2canvas' === mkl_pc( 'settings' )->get( 'pdf_render_method' ) ) {
		// 	$deps[] = 'mkl_pc/html2canvas';
		// }
		return $deps;
	}

	public function is_enabled() {
		static $is_enabled;
		if ( empty( $is_enabled ) ) {
			$is_enabled = (bool) mkl_pc( 'settings' )->get( 'quote_request_enabled' );
		}
		return $is_enabled;
	}

	// public function content_data( $args, $product_id ) {
	// 	if( ! is_user_logged_in() || ! request_is_frontend_ajax() )
	// 		return $args;
	// 	$product = wc_get_product( $product_id );
	// 	if( 'variation' != $product->get_type()  ) {
	// 		return $args; 
	// 	}
	// 	$configs_array = $this->get_configurations( $product );
	// 	$args['user_saved_configurations'] = $configs_array;
	// 	return $args;
	// }

	/**
	 * Add the SYD button markup to the configurator
	 *
	 * @return void
	 */
	public function output_add_to_quote_button() {
		if ( ! $this->is_enabled() ) return;

		$button_class = Utils::get_button_classes();

		$label = mkl_pc( 'settings' )->get_label( 'quote_request_button_label', __( 'Send request', 'product-configurator-for-woocommerce') );
		?>
		<button type="button" class="mkl-request-quote <?php echo esc_attr( $button_class ); ?>"><span><?php echo $label; ?></span></button>
		<?php
	}

	/**
	 * Save to PDF
	 *
	 * @return void
	 */
	public function do_request() {

		// Only allow POST
		if ( 'POST' !== $_SERVER['REQUEST_METHOD'] ) {
			wp_send_json( [ 'error' => true, 'messages' => 'Invalid request method.'], 405 );
		}

		if ( ! isset( $_REQUEST['pc_configurator_data'], $_REQUEST['product_id'] ) ) {
			wp_send_json( [ 'error' => true, 'messages' =>  'Missing data.' ], 400 );
		}

		if ( ! $this->is_enabled() ) {
			wp_send_json( [ 'error' => true, 'messages' => 'Quote request not enabled.' ],  403 );
		}

        if ( mkl_pc( 'settings' )->get( 'quote_requires_login' ) && !is_user_logged_in() ) {
            wp_send_json( [ 'error' => true, 'messages' => 'Action not permitted - login required' ],  401 );
        }

		$product = wc_get_product( intval( $_REQUEST['product_id'] ) );

		if ( is_a( $product, 'WC_Product_Variation' ) ) {
			$variation_id = intval( $_REQUEST['product_id'] );
			$product_id = $product->get_parent_id();
		} elseif ( is_a( $product, 'WC_Product' ) ) {
			$variation_id = intval( $_REQUEST['product_id'] );
			$product_id = intval( $_REQUEST['product_id'] );
		} else {
			wp_send_json( [ 'error' => true, 'messages' => 'Product not found.' ], 404 );
		}

		add_filter( 'mkl_pc/form_builder/value_arrow', function() {
			return ': ';
		} );

		// Check registered fields
		$fields = $this->get_form_fields();
		if ( is_wp_error( $fields ) ) wp_send_json( [ 'error' => true, 'messages' => $fields->get_message() ] );

		$errors = new WP_Error();
		$form_data = [];
		foreach( $fields as $field_id => $field ) {
			if ( is_callable( $field['sanitize'] ) ) {
				$form_data[$field_id] = call_user_func( $field['sanitize'], $_REQUEST[$field_id] );
				if ( isset( $field['required'] ) && $field['required'] ) {
					if ( empty( $form_data[$field_id] ) ) {
						$errors->add( 'mkl-quote-required', sprintf( __( 'The field "%s" is required', 'product-configurator-for-woocommerce' ), $field[ 'label' ] ) );
						continue;
					}
				}
				if ( isset( $field['validate'] ) ) {
					$valid = is_callable( $field['validate'] ) && call_user_func( $field['validate'], $form_data[$field_id] );
					if ( ! $valid ) {
						$errors->add( 'mkl-quote-required', sprintf( __( 'The field "%s" is not valid', 'product-configurator-for-woocommerce' ), $field[ 'label' ] ) );
						continue;
					}
				}
			}
		}

		if ( $errors->has_errors() ) {
			wp_send_json( [ 'error' => true, 'messages' => $errors->get_error_messages() ] );
		}

		$item_data = [];
		$layers = [];

        $configuration = $_POST['pc_configurator_data'];

        $configuration_object = new Configuration( 
			NULL, 
			[ 
				'product_id' => $product_id, 
				'variation_id' => $variation_id,
				'content' => $configuration // Data sanitized in \MKL\PC\Configuration init
			] 
		);

        if ( empty( $configuration_object->content ) ) {
            wp_send_json( [ 'error' => true, 'messages' => 'Configuration data not valid' ],  400 );
        }

		$image = '';

		if ( isset( $_FILES['config_image'] ) && $_FILES['config_image']['type'] === 'image/png' ) {
			$form_data['image_url'] = 'data:image/png;base64,' . base64_encode( file_get_contents( $_FILES['config_image']['tmp_name'] ) );
		}

		// Load WC_Emails instance, required for the Email classes to be loaded as well
		$emails = \WC_Emails::instance();

        do_action( 'mkl_pc_send_quote_request', $configuration_object, $form_data );

        $redirect = '';

        if ( $redirect = mkl_pc( 'settings' )->get( 'quote_request_redirect_after' ) ) {
            if ( is_numeric( $redirect ) ) {
                $redirect = get_permalink( $redirect );
            } else { 
                $redirect = sanitize_url( $redirect );
            }
        }
        if ( $redirect ) {
            $message = __( 'Successfully sent request, redirecting...', 'product-configurator-for-woocommerce' );
        } else {
            $message = __( 'Successfully sent request.', 'product-configurator-for-woocommerce' );
        }
        wp_send_json( [ 'messages' => $message, 'redirect' => $redirect ] );

	}

	private function save_temp_file( $file_data ) {

	}

    public function add_js_templates() {
        if ( ! $this->is_enabled() ) return; ?>
		<script type="text/html" id="tmpl-mkl-pc-quote-request-form">
            <div class="mkl-pc--quote-request-modal--content">
                <?php do_action( 'tmpl-mkl-pc-quote-request-form' ); ?>
            </div>
		</script>
		<?php
    }

    public function add_fields() {
        $button_class = Utils::get_button_classes();
        $label = mkl_pc( 'settings' )->get_label( 'quote_request_button_label', __( 'Send request', 'product-configurator-for-woocommerce') );
		$fields = $this->get_form_fields();
		?>
		<h4><?php _e( 'Send your request', 'product-configurator-for-woocommerce' ); ?></h4>
		<?php
		if ( ! is_wp_error( $fields ) ) :
			foreach( $fields as $field_id => $field ) : ?>
				<div class="mkl-pc--quote-field <?php echo esc_attr( sanitize_html_class( $field_id ) ); ?>">
					<?php echo $this->output_field( $field, $field_id ); ?>
				</div>
			<?php endforeach; ?>
			<div class="quote-actions">
				<button type="button" class="mkl-request-quote <?php echo esc_attr($button_class); ?>"><?php echo $label ?></button>
				<button type="button" class="cancel <?php echo esc_attr($button_class); ?>"><?php _e( 'Cancel', 'product-configurator-for-woocommerce'); ?></button>
			</div>
		<?php else: 
			echo '<span class="config-error">' . $fields->get_error_message() . '</span>';
		endif;
        ?>
    <? }

	/**
	 * Get the field markup
	 *
	 * @param array  $field    - The field data
	 * @param string $field_id - The field ID/slug
	 * @return string
	 */
	public function output_field( $field, $field_id ) {
		ob_start();
		?>
		<label for="<?php echo esc_attr( $field_id ); ?>"><?php echo $field['label']; ?></label>
		<?php if ( in_array( $field[ 'type' ], [ 'text', 'number', 'email' ] ) ) : ?>
		<input 
			type="<?php echo esc_attr( $field[ 'type' ] ); ?>" 
			name="<?php echo esc_attr( $field_id ); ?>" 
			id="<?php echo esc_attr( $field_id ); ?>" 
			value="" 
			placeholder="<?php echo esc_attr( $field['placeholder'] ?? '' ); ?>"
			<?php echo $field['required'] ? ' required' : ''; ?>
		>
		<?php endif;
		/**
		 * Filter mkl_pc_syd_share_field_output
		 * Filters the field output
		 * @param string $field_output The filtered value, html markup of the field and its label
		 * @param array  $field        The Field data
		 * @param string $field_id     The field ID
		 * @return string
		 */
		return apply_filters( 'mkl_pc_syd_share_field_output', ob_get_clean(), $field, $field_id );
	}

	/**
	 * Get the form fields
	 *
	 * @return array|WP_Error
	 */
	public function get_form_fields() {
		$fields = apply_filters( 'mkl_pc/quote_request/fields', [
			'quote-n' => [
				'label' => __( 'Your name:', 'product-configurator-for-woocommerce' ),
				'type' => 'text',
				'order' => 10,
				'sanitize' => 'sanitize_text_field',
				'escape' => 'esc_html',
				'validate' => [ $this, 'is_not_empty' ],
				'required' => true
			],
			'quote-e' => [ 
				'label' => __( 'Your email:', 'product-configurator-for-woocommerce' ),
				'type' => 'text',
				'order' => 20,
				'sanitize' => 'sanitize_email',
				'escape' => 'esc_html',
				'validate' => 'is_email',
				'required' => true
			],
			'quote-h' => [ 
				'label' => __( 'Your other email:', 'product-configurator-for-woocommerce' ),
				'type' => 'email',
				'order' => 200,
				'sanitize' => 'sanitize_email',
				'escape' => 'is_email',
				'validate' => [ $this, 'check_honeypot' ],
				'required' => false
			],
		] );

		if ( ! isset( $fields['quote-e'] ) ) {
			return new \WP_Error( 'quote-fields-required', 'Configuration error: The field <code>quote-e</code> is required' );
		}

		// Sort fields by their order
		uasort( $fields, array( '\MKL\PC\Utils', 'filter_order' ) );
		return $fields;
	}

	public function is_not_empty( $item ) {
		return ! empty( $item );
	}

	/**
	 * Honeypot must be empty
	 */
	public function check_honeypot( $item ) {
		return empty( $item );
	}
}
// var worker = html2pdf().from(PC.fe.modal.$main_window[0]).save();