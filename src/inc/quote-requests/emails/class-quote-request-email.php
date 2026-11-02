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
		 * @var string[] Files made for the email being sent (the PDF), deleted once it is.
		 */
		protected $temp_files = [];

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
			foreach ( $this->temp_files as $path ) {
				mkl_pc( 'quotes' )->pdf->delete_file( $path );
			}
			$this->temp_files = [];

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
		 * Replies to the shop's emails go to the customer
		 *
		 * @return string
		 */
		public function get_headers() {
			$headers = parent::get_headers();
			if ( ! $this->customer_email && $this->object instanceof Quote_Request && is_email( $this->object->get_email() ) ) {
				$name = str_replace( [ "\r", "\n", '"', '<', '>' ], '', $this->object->get_name() );
				$headers = preg_replace( '/^Reply-to:.*\r\n/mi', '', $headers );
				$headers .= 'Reply-to: ' . ( $name ? '"' . $name . '" ' : '' ) . '<' . $this->object->get_email() . ">\r\n";
			}
			return $headers;
		}

		/**
		 * Attach the configuration image when the settings ask for it, and the PDF when its mode does
		 *
		 * @return array
		 */
		public function get_attachments() {
			$attachments = parent::get_attachments();
			if ( ! $this->object instanceof Quote_Request ) return $attachments;
			if ( 'attach' === mkl_pc( 'quotes' )->get_image_mode() && $this->object->image_path && is_file( $this->object->image_path ) ) {
				$attachments[] = $this->object->image_path;
			}
			$pdf = mkl_pc( 'quotes' )->pdf;
			if ( $pdf->is_attached_to( $this->id, $this->object ) && ( $path = $pdf->write_file( $this->object, $this->get_pdf_args() ) ) ) {
				$this->temp_files[] = $path;
				$attachments[] = $path;
			}
			return $attachments;
		}

		/**
		 * What the attached PDF shows: the message sent with the quote, if any
		 *
		 * @return array See Quote_PDF::render().
		 */
		protected function get_pdf_args() {
			return [ 'context' => 'email' ];
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
			$args['is_quote'] = false;
			$args['quote_message'] = '';
			return $args;
		}
	}

endif;
