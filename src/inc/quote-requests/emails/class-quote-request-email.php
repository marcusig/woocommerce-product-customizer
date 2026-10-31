<?php
namespace MKL\PC;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( ! class_exists( 'MKL\PC\Quote_Request_Email', false ) ) :

	/**
	 * Shared by the quote request emails sent to the merchant and to the customer
	 */
	abstract class Quote_Request_Email extends Email {

		/**
		 * @var Quote_Request|null
		 */
		public $object = null;

		/**
		 * Constructor.
		 */
		public function __construct() {
			$this->template_html  = 'emails/quote-request.php';
			$this->template_plain = 'emails/plain/quote-request.php';
			$this->placeholders   = [
				'{reference}' => '',
				'{product}'   => '',
				'{quantity}'  => '',
			];
			foreach ( array_keys( mkl_pc( 'quotes' )->fields->get_all_fields() ) as $field_id ) {
				$this->placeholders[ '{' . $field_id . '}' ] = '';
			}
			parent::__construct();
		}

		/**
		 * Send the email about a quote request
		 *
		 * @param Quote_Request $request
		 * @param array         $args
		 * @return boolean
		 */
		public function trigger( $request, $args = [] ) {
			if ( ! $request instanceof Quote_Request ) return false;

			$this->setup_locale();
			$this->object = $request;
			$this->placeholders = array_merge( $this->placeholders, $this->get_request_placeholders( $request ) );
			if ( $this->customer_email ) {
				$this->recipient = $request->get_email();
			}
			$sent = $this->deliver();
			$this->restore_locale();

			return $sent;
		}

		/**
		 * Placeholder values for a request, as plain text
		 *
		 * @param Quote_Request $request
		 * @return array
		 */
		protected function get_request_placeholders( Quote_Request $request ) {
			$placeholders = [
				'{reference}' => $request->reference,
				'{product}'   => $request->get_product_name(),
				'{quantity}'  => (string) $request->quantity,
			];
			foreach ( $request->get_field_rows() as $row ) {
				$placeholders[ '{' . $row['id'] . '}' ] = $row['value'];
			}
			return $placeholders;
		}

		/**
		 * Main content, with the customer's values escaped
		 *
		 * The subject and heading are plain text and escaped where they are printed. The main content
		 * is HTML, so what the customer typed must not become markup in it.
		 *
		 * @return string
		 */
		public function get_main_content() {
			$placeholders = $this->placeholders;
			if ( $this->object instanceof Quote_Request ) {
				foreach ( $this->get_request_placeholders( $this->object ) as $key => $value ) {
					$this->placeholders[ $key ] = esc_html( $value );
				}
			}
			$content = parent::get_main_content();
			$this->placeholders = $placeholders;
			return $content;
		}

		/**
		 * Attach the configuration image when the settings ask for it
		 *
		 * @return array
		 */
		public function get_attachments() {
			$attachments = parent::get_attachments();
			if ( $this->object instanceof Quote_Request && 'attach' === mkl_pc( 'quotes' )->get_image_mode() && $this->object->image_path && is_file( $this->object->image_path ) ) {
				$attachments[] = $this->object->image_path;
			}
			// Nothing keeps the request: the files go to the merchant with the email, and are deleted after.
			if ( $this->object instanceof Quote_Request && ! $this->customer_email && ! mkl_pc( 'quotes' )->get_store()->is_persistent() ) {
				foreach ( $this->object->files as $file ) {
					if ( is_file( $file['path'] ) ) $attachments[] = $file['path'];
				}
			}
			return $attachments;
		}

		/**
		 * Variables passed to the templates
		 *
		 * @param boolean $plain_text
		 * @return array
		 */
		protected function get_template_args( $plain_text ) {
			$args = parent::get_template_args( $plain_text );
			$args['quote_request'] = $this->object instanceof Quote_Request ? $this->object : null;
			$args['show_prices'] = mkl_pc( 'quotes' )->show_prices();
			$args['show_image'] = 'none' !== mkl_pc( 'quotes' )->get_image_mode();
			return $args;
		}
	}

endif;
