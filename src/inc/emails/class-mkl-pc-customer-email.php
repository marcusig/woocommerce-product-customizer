<?php

namespace MKL\PC;

/**
 * Class MK_PC_SYD_Share_Customer_Email file.
 *
 * @package WooCommerce\Emails
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly.
}

if ( ! class_exists( '\MKL\PC\Customer_Email', false ) ) :

	/**
	 * Customer configuration email.
	 *
	 * Customer configuration emails are sent when the user uses the share by email feature.
	 *
	 * @class       MK_PC_SYD_Share_Customer_Email
	 * @version     1.2
	 * @extends     WC_Email
	 */
	class Customer_Email extends \WC_Email {

		/**
		 * Configuration link.
		 *
		 * @var string
		 */
		public $link;

		/**
		 * Constructor.
		 */
		public function __construct() {
			$this->id             = 'mkl_quote_request';
			$this->customer_email = true;
			$this->title          = __( 'Configurator quote request email', 'product-configurator-for-woocommerce' );
			$this->description    = __( 'Email sent to the user when they request a quote.', 'product-configurator-for-woocommerce' );
			$this->template_html  = 'pc-configurator-emails/email.php';
			$this->template_plain  = 'pc-configurator-emails/email-plain.php';
			$this->placeholders   = array(
				'{configuration}' => '',
				'{configuration-sku}' => '',
			);

			// Add fields to placeholders list
			// $fields = array_keys( mkl_pc()->get_extension( 'save-your-design' )->share->get_form_fields() );
			// foreach( $fields as $field ) {
			// 	$this->placeholders["{{$field}}"] = '';
			// }


			// Triggers.
			add_action( 'mkl_pc_send_quote_request', array( $this, 'trigger' ), 10, 3 );
			// Call parent constructor.
			parent::__construct();
		}

		/**
		 * Get email subject.
		 *
		 * @return string
		 */
		public function get_default_subject() {
			return __( 'Your request', 'product-configurator-for-woocommerce' );
		}

		/**
		 * Get email heading.
		 *
		 * @return string
		 */
		public function get_default_heading() {
			return __( 'Your quote request', 'product-configurator-for-woocommerce' );
		}

		/**
		 * Trigger.
		 *
		 * @param array $args Email arguments.
		 */
		public function trigger( $configuration, $form_data ) {
			$this->setup_locale();

			if ( ! empty( $form_data ) ) {
				// $fields = []
				foreach( $form_data as $field_id => $field_value ) {
					// Replace default IDs with more readable slugs
					if ( 'quote-e' === $field_id ) $field_id = 'email';
					if ( 'quote-n' === $field_id ) $field_id = 'name';

					$this->placeholders['{'.$field_id.'}'] = $field_value;
				}
			}

			$item_data = $configuration->get_item_data( 'email-' . $this->id );

			foreach( $item_data as $item_data_attribute ) {
				if ( 'mkl-configuration' == $item_data_attribute['className'] ) {
					$placeholder_key = 'configuration';
				} else {
					$placeholder_key = $item_data_attribute['className'];
				}
				$this->placeholders['{'. $placeholder_key .'}'] = $item_data_attribute['value'];
			}

			
			$this->object = $configuration;
			
			$this->placeholders['{configuration_table}'] = $this->get_table();
			// $this->link =      $url;
			// $this->placeholders['{link}'] = $url;

			if ( $this->customer_email ) $this->recipient = $form_data['quote-e'];

			if ( $this->is_enabled() && $this->get_recipient() ) {
				$this->send( $this->get_recipient(), $this->get_subject(), $this->get_content(), $this->get_headers(), $this->get_attachments() );
			}

			$this->restore_locale();
		}

		/**
		 * Get content html.
		 *
		 * @return string
		 */
		public function get_content_html() {
			return wc_get_template_html(
				$this->template_html,
				array(
					'configuration'      => $this->object,
					'email_heading'      => $this->get_heading(),
					'additional_content' => $this->get_additional_content(),
					'main_content'       => $this->get_main_content(),
					'link'               => $this->link,
					'sent_to_admin'      => false,
					'plain_text'         => false,
					'email'              => $this,
				),
				'',
				trailingslashit( MKL_PC_INCLUDE_PATH ) . 'templates/'
			);
		}

		/**
		 * Get content plain.
		 *
		 * @return string
		 */
		public function get_content_plain() {
			return wc_get_template_html(
				$this->template_plain,
				array(
					'configuration'      => $this->object,
					'email_heading'      => $this->get_heading(),
					'additional_content' => $this->get_additional_content(),
					'main_content'       => $this->get_main_content(),
					'link'               => $this->link,
					'sent_to_admin'      => false,
					'plain_text'         => true,
					'email'              => $this,
				),
				'',
				trailingslashit( MKL_PC_INCLUDE_PATH ) . 'templates/'
			);
		}

		/**
		 * Initialise Settings Form Fields - these are generic email options most will use.
		 */
		public function init_form_fields() {
			/* translators: %s: list of placeholders */
			$placeholder_text  = sprintf( __( 'Available placeholders: %s', 'woocommerce' ), '<code>' . esc_html( implode( '</code>, <code>', array_keys( $this->placeholders ) ) ) . '</code>' );
			$this->form_fields = array(
				'enabled'            => array(
					'title'   => __( 'Enable/Disable', 'woocommerce' ),
					'type'    => 'checkbox',
					'label'   => __( 'Enable this email notification', 'woocommerce' ),
					'default' => 'yes',
				),
				'subject'            => array(
					'title'       => __( 'Subject', 'woocommerce' ),
					'type'        => 'text',
					'desc_tip'    => true,
					'description' => $placeholder_text,
					'placeholder' => $this->get_default_subject(),
					'default'     => '',
				),
				'heading'            => array(
					'title'       => __( 'Email heading', 'woocommerce' ),
					'type'        => 'text',
					'desc_tip'    => true,
					'description' => $placeholder_text,
					'placeholder' => $this->get_default_heading(),
					'default'     => '',
				),
				'main_content' => array(
					'title'       => __( 'Email content', 'product-configurator-for-woocommerce' ),
					'description' => __( 'The main email content.', 'product-configurator-for-woocommerce' ) . ' ' . $placeholder_text,
					'css'         => 'width:400px; height: 75px;',
					'placeholder' => __( 'N/A', 'woocommerce' ),
					'type'        => 'textarea',
					'default'     => $this->get_default_content(),
					'desc_tip'    => true,
				),
				'additional_content' => array(
					'title'       => __( 'Additional content', 'woocommerce' ),
					'description' => __( 'Text to appear below the main email content.', 'woocommerce' ) . ' ' . $placeholder_text,
					'css'         => 'width:400px; height: 75px;',
					'placeholder' => __( 'N/A', 'woocommerce' ),
					'type'        => 'textarea',
					'default'     => $this->get_default_additional_content(),
					'desc_tip'    => true,
				),
				'email_type'         => array(
					'title'       => __( 'Email type', 'woocommerce' ),
					'type'        => 'select',
					'description' => __( 'Choose which format of email to send.', 'woocommerce' ),
					'default'     => 'html',
					'class'       => 'email_type wc-enhanced-select',
					'options'     => $this->get_email_type_options(),
					'desc_tip'    => true,
				),
			);
		}

		/**
		 * Default content to show below main email content.
		 *
		 * @return string
		 */
		public function get_default_additional_content() {
			return __( 'Thanks for reading.', 'product-configurator-for-woocommerce' );
		}

		/**
		 * Default content to show below main email content.
		 *
		 * @return string
		 */
		public function get_default_content() {
			$content = '<p>' . __( 'Thank you for your request!', 'product-configurator-for-woocommerce' ) . '</p>';
			$content .= '<h4>' . __( 'Here\'s a summary of your configuration:', 'product-configurator-for-woocommerce' ) . '</h4>';
			$content .= '{configuration}';
			$content .= '{configuration_table}';
			$content .= '<h4>' . __( 'Contact information you provided:', 'product-configurator-for-woocommerce' ) . '</h4>';
			$content .= '<ul>';
			$content .= '<li>' . __( 'Name:', 'product-configurator-for-woocommerce' ) . ' {name}</li>';
			$content .= '<li>' . __( 'Email:', 'product-configurator-for-woocommerce' ) . ' {email}</li>';
			$content .= '</ul>';
			return $content;
		}

		/**
		 * Return content from the additional_content field.
		 *
		 * Displayed above the footer.
		 *
		 * @return string
		 */
		public function get_main_content() {
			/**
			 * Provides an opportunity to inspect and modify additional content for the email.
			 *
			 *
			 * @param string      $additional_content Additional content to be added to the email.
			 * @param object|bool $object             The object (ie, product or order) this email relates to, if any.
			 * @param WC_Email    $email              WC_Email instance managing the email.
			 */
			return apply_filters( 'woocommerce_email_main_content' . $this->id, $this->format_string( $this->get_option_or_transient( 'main_content' ) ), $this->object, $this );
		}

		/**
		 * Get an option or transient for email preview.
		 *
		 * @param string $key Option key.
		 * @param mixed  $empty_value Value to use when option is empty.
		 */
		protected function get_option_or_transient( string $key, $empty_value = null ) {
			$option = $this->get_option( $key, $empty_value );

			/**
			 * This filter is documented in templates/emails/email-styles.php
			 *
			 * @param bool $is_email_preview Whether the email is being previewed.
			 */
			$is_email_preview = apply_filters( 'woocommerce_is_email_preview', false );
			if ( $is_email_preview ) {
				$email_id  = $this->id;
				$transient = get_transient( "woocommerce_{$email_id}_{$key}" );
				if ( false !== $transient ) {
					$option = $transient ? $transient : $empty_value;
				}
			}

			return $option;
		}

		public function get_table() {
			if ( ! $this->object ) return '';
			return wc_get_template_html(
				'configuration-table.php',
				array(
					'configuration'  => $this->object,
					'layers'         => $this->object->get_layers(),
					'columns'        => $this->get_columns(),
					'sent_to_admin'  => false,
					'plain_text'     => false,
					'email'          => $this,
				),
				'',
				trailingslashit( MKL_PC_INCLUDE_PATH ) . 'templates/'
			);
		}

		public function get_columns() {
			return apply_filters( 'mkl_pc/quote_request/table/columns', [
				'layer_name' => __( 'Item' ),
				'choice_name' => __( 'Selection' ),
				'choice_extra_price' => __( 'Item price' ),
			] );
		}

	}

endif;

return new Customer_Email();
