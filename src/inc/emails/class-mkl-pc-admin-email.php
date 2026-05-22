<?php

namespace MKL\PC;

/**
 * Class MK_PC_SYD_Share_Admin_Email file.
 *
 * @package WooCommerce\Emails
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly.
}

if ( ! class_exists( '\MKL\PC\Admin_Email', false ) ) :

	/**
	 * Customer configuration email.
	 *
	 * Customer configuration emails are sent when the user uses the share by email feature.
	 *
	 * @class       MK_PC_SYD_Share_Admin_Email
	 * @version     1.2
	 * @extends     WC_Email
	 */
	class Admin_Email extends Base_Email {

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

			$this->id             = 'mkl_quote_request_admin';
			$this->customer_email = false;
			$this->title          = __( 'Admin Configurator quote request email', 'product-configurator-for-woocommerce' );
			$this->description    = __( 'Email sent to the admin when a user requests a quote.', 'product-configurator-for-woocommerce' );
			$this->recipient = $this->get_option( 'recipient', get_option( 'admin_email' ) );

			// Call parent constructor.
			parent::__construct();
		}

		/**
		 * Get email subject.
		 *
		 * @return string
		 */
		public function get_default_subject() {
			return __( 'New quote request', 'product-configurator-for-woocommerce' );
		}

		/**
		 * Get email heading.
		 *
		 * @return string
		 */
		public function get_default_heading() {
			return __( 'A customer requested a quote', 'product-configurator-for-woocommerce' );
		}

		/**
		 * Default content to show below main email content.
		 *
		 * @return string
		 */
		public function get_default_content() {
			$content = '<p>' . __( 'New quote request', 'product-configurator-for-woocommerce' ) . '</p>';
			$content .= '<h4>' . __( 'Customer info:', 'product-configurator-for-woocommerce' ) . '</h4>';
			$content .= '<ul>';
			$content .= '<li>' . __( 'Name:', 'product-configurator-for-woocommerce' ) . ' {name}</li>';
			$content .= '<li>' . __( 'Email:', 'product-configurator-for-woocommerce' ) . ' {email}</li>';
			$content .= '</ul>';
			$content .= '<h4>' . __( 'Here\'s the summary of the requested configuration:', 'product-configurator-for-woocommerce' ) . '</h4>';
			$content .= '{configuration-table}';
			return $content;
		}
	}

endif;

return new Admin_Email();
