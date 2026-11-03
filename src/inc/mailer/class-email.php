<?php
namespace MKL\PC;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/*
 * The parent is an alias so the configurator's emails keep their API when WooCommerce becomes
 * optional: pointing it at a class with the same methods replaces WC_Email under every email.
 * This file is loaded by Mailer once WooCommerce has loaded WC_Email.
 */
if ( ! class_exists( 'MKL\PC\Email_Parent', false ) ) {
	class_alias( '\WC_Email', 'MKL\PC\Email_Parent' );
}

if ( ! class_exists( 'MKL\PC\Email', false ) ) :

	/**
	 * Base class for the configurator's emails
	 *
	 * Adds an editable main content to the usual subject / heading / additional content, and renders
	 * templates through the Mailer, so they are overridden from yourtheme/product-configurator/.
	 */
	abstract class Email extends Email_Parent {

		/**
		 * Constructor.
		 */
		public function __construct() {
			parent::__construct();
			if ( ! $this->customer_email ) {
				$this->recipient = $this->get_option( 'recipient', get_option( 'admin_email' ) );
			}
		}

		/**
		 * Send the email about an object
		 *
		 * @param mixed $object
		 * @param array $args
		 * @return boolean Whether it was sent.
		 */
		abstract public function trigger( $object, $args = [] );

		/**
		 * Default main content, with placeholders.
		 *
		 * @return string
		 */
		abstract public function get_default_main_content();

		/**
		 * Send the email as currently set up, if enabled and addressed
		 *
		 * @return boolean
		 */
		protected function deliver() {
			if ( ! $this->is_enabled() || ! $this->get_recipient() ) return false;
			return (bool) $this->send( $this->get_recipient(), $this->get_subject(), $this->get_content(), $this->get_headers(), $this->get_attachments() );
		}

		/**
		 * Main content, with its placeholders replaced.
		 *
		 * @return string
		 */
		public function get_main_content() {
			/**
			 * Filter the main content of a configurator email.
			 *
			 * @param string $main_content
			 * @param mixed  $object
			 * @param Email  $email
			 */
			return apply_filters( 'mkl_pc/email/main_content', $this->format_string( $this->get_option_or_transient( 'main_content', $this->get_default_main_content() ) ), $this->object, $this );
		}

		/**
		 * Get content html.
		 *
		 * @return string
		 */
		public function get_content_html() {
			return mkl_pc( 'mailer' )->get_template_html( $this->template_html, $this->get_template_args( false ) );
		}

		/**
		 * Get content plain.
		 *
		 * @return string
		 */
		public function get_content_plain() {
			return mkl_pc( 'mailer' )->get_template_html( $this->template_plain, $this->get_template_args( true ) );
		}

		/**
		 * Variables passed to the templates
		 *
		 * @param boolean $plain_text
		 * @return array
		 */
		protected function get_template_args( $plain_text ) {
			return [
				'object'             => $this->object,
				'email_heading'      => $this->get_heading(),
				'main_content'       => $this->get_main_content(),
				'additional_content' => $this->get_additional_content(),
				'sent_to_admin'      => ! $this->is_customer_email(),
				'plain_text'         => $plain_text,
				'email'              => $this,
			];
		}

		/**
		 * Attachments, with the configurator's own filter
		 *
		 * Add-ons attach through `mkl_pc/email/attachments` rather than `woocommerce_email_attachments`,
		 * so their attachments survive a mailer that is not WooCommerce's.
		 *
		 * @return array
		 */
		public function get_attachments() {
			/**
			 * Filter the files attached to a configurator email.
			 *
			 * @param string[] $attachments Absolute paths.
			 * @param string   $email_id
			 * @param mixed    $object
			 * @param Email    $email
			 */
			return apply_filters( 'mkl_pc/email/attachments', parent::get_attachments(), $this->id, $this->object, $this );
		}

		/**
		 * Settings fields: WooCommerce's, plus the recipient for admin emails and the main content.
		 */
		public function init_form_fields() {
			parent::init_form_fields();

			/* translators: %s: list of placeholders */
			$placeholder_text = sprintf( __( 'Available placeholders: %s', 'product-configurator-for-woocommerce' ), '<code>' . esc_html( implode( '</code>, <code>', array_keys( $this->placeholders ) ) ) . '</code>' );

			$fields = [];
			foreach ( $this->form_fields as $key => $field ) {
				if ( 'subject' === $key && ! $this->customer_email ) {
					$fields['recipient'] = [
						'title'       => __( 'Recipient(s)', 'product-configurator-for-woocommerce' ),
						'type'        => 'text',
						/* translators: %s: admin email */
						'description' => sprintf( __( 'Enter recipients (comma separated) for this email. Defaults to %s.', 'product-configurator-for-woocommerce' ), '<code>' . esc_attr( get_option( 'admin_email' ) ) . '</code>' ),
						'placeholder' => '',
						'default'     => '',
						'desc_tip'    => true,
					];
				}
				if ( 'additional_content' === $key ) {
					$fields['main_content'] = [
						'title'       => __( 'Email content', 'product-configurator-for-woocommerce' ),
						'description' => __( 'Shown above the details of the request.', 'product-configurator-for-woocommerce' ) . ' ' . $placeholder_text,
						'css'         => 'width:400px; height: 100px;',
						'type'        => 'textarea',
						'default'     => $this->get_default_main_content(),
						'desc_tip'    => true,
					];
				}
				$fields[ $key ] = $field;
			}
			$this->form_fields = $fields;
		}

		/**
		 * Read an option, or its unsaved value while WooCommerce previews the email
		 *
		 * @param string $key
		 * @param mixed  $empty_value
		 * @return mixed
		 */
		protected function get_option_or_transient( $key, $empty_value = null ) {
			$option = $this->get_option( $key, $empty_value );
			/** This filter is documented in woocommerce/templates/emails/email-styles.php */
			if ( apply_filters( 'woocommerce_is_email_preview', false ) ) {
				$transient = get_transient( "woocommerce_{$this->id}_{$key}" );
				if ( false !== $transient ) {
					$option = $transient ? $transient : $empty_value;
				}
			}
			return $option;
		}
	}

endif;
