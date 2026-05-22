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
	class Customer_Email extends Base_Email {

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
	}

endif;

return new Customer_Email();
