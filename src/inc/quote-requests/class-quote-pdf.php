<?php
namespace MKL\PC;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * The PDF of a quote request, when an add-on provides one (Quote_PDF_Provider)
 *
 * Made when needed, never stored: attached to the emails the provider's mode names (through a
 * temporary file, deleted once sent), and downloaded by the customer and the merchant.
 *
 * Downloads go through admin-post.php, which no page cache keeps, signed in or not. The customer
 * downloads with the request's key or as its account, the merchant with edit_post.
 */
class Quote_PDF {

	const ACTION = 'mkl_pc_quote_pdf';

	/**
	 * Emails that carry the PDF, by mode.
	 */
	const EMAILS = [
		'quote' => [ 'mkl_pc_quote_request_quote' ],
		'all'   => [ 'mkl_pc_quote_request_quote', 'mkl_pc_quote_request_admin', 'mkl_pc_quote_request_customer' ],
	];

	/**
	 * @var Quote_PDF_Provider|false|null False when there is none, null before asking.
	 */
	private $provider = null;

	public function __construct() {
		add_action( 'admin_post_' . self::ACTION, [ $this, 'download' ] );
		add_action( 'admin_post_nopriv_' . self::ACTION, [ $this, 'download' ] );
	}

	/**
	 * @return Quote_PDF_Provider|null
	 */
	public function get_provider() {
		if ( null === $this->provider ) {
			/**
			 * What makes the PDF of quote requests
			 *
			 * @param Quote_PDF_Provider|null $provider
			 */
			$provider = apply_filters( 'mkl_pc/quote_request/pdf_provider', null );
			$this->provider = $provider instanceof Quote_PDF_Provider ? $provider : false;
		}
		return $this->provider ? $this->provider : null;
	}

	/**
	 * @return string none, quote or all.
	 */
	public function get_mode() {
		$provider = $this->get_provider();
		$mode = $provider ? (string) $provider->get_mode() : 'none';
		return isset( self::EMAILS[ $mode ] ) ? $mode : 'none';
	}

	/**
	 * Whether a request has what a PDF shows
	 *
	 * @param Quote_Request $request
	 * @return boolean
	 */
	private function has_content( Quote_Request $request ) {
		return 'none' !== $this->get_mode() && '' !== $request->configuration_raw && '' !== $request->reference;
	}

	/**
	 * Whether an email about this request carries the PDF
	 *
	 * @param string        $email_id
	 * @param Quote_Request $request
	 * @return boolean
	 */
	public function is_attached_to( $email_id, Quote_Request $request ) {
		$mode = $this->get_mode();
		return $this->has_content( $request ) && in_array( $email_id, self::EMAILS[ $mode ], true );
	}

	/**
	 * Whether the customer downloads it: in "all" mode from the start, in "quote" mode once it is sent
	 *
	 * @param Quote_Request $request
	 * @return boolean
	 */
	public function customer_can_download( Quote_Request $request ) {
		if ( ! $this->has_content( $request ) ) return false;
		return 'all' === $this->get_mode() || (int) get_post_meta( $request->id, '_mkl_pc_quote_sent', true );
	}

	/**
	 * Whether the merchant downloads it, from the request's screen
	 *
	 * @param Quote_Request $request
	 * @return boolean
	 */
	public function merchant_can_download( Quote_Request $request ) {
		return $this->has_content( $request );
	}

	/**
	 * @param Quote_Request $request
	 * @param string        $key The request's key, for a customer without the account.
	 * @return string
	 */
	public function get_download_url( Quote_Request $request, $key = '' ) {
		$args = [ 'action' => self::ACTION, 'reference' => rawurlencode( $request->reference ) ];
		if ( '' !== (string) $key ) $args['key'] = $key;
		return add_query_arg( $args, admin_url( 'admin-post.php' ) );
	}

	/**
	 * @param Quote_Request $request
	 * @return string
	 */
	public function get_filename( Quote_Request $request ) {
		/**
		 * The file name of a quote request's PDF
		 *
		 * @param string        $filename
		 * @param Quote_Request $request
		 */
		return sanitize_file_name( apply_filters( 'mkl_pc/quote_request/pdf_filename', $request->reference . '.pdf', $request ) );
	}

	/**
	 * The merchant's message the PDF shows
	 *
	 * The customer sees the one sent with the quote. The merchant sees the one they are writing, until
	 * it is sent.
	 *
	 * @param Quote_Request $request
	 * @param boolean       $merchant
	 * @return string
	 */
	public function get_message( Quote_Request $request, $merchant = false ) {
		if ( $merchant && '' !== ( $draft = (string) get_post_meta( $request->id, '_mkl_pc_quote_message', true ) ) ) return $draft;
		return (int) get_post_meta( $request->id, '_mkl_pc_quote_sent', true ) ? (string) get_post_meta( $request->id, '_mkl_pc_quote_sent_message', true ) : '';
	}

	/**
	 * @param Quote_Request $request
	 * @param array         $args    context (email, download), message, quote. By default, as the customer
	 *                               sees it: the message and the quote once sent.
	 * @return string|\WP_Error
	 */
	public function render( Quote_Request $request, $args = [] ) {
		$provider = $this->get_provider();
		if ( ! $provider ) {
			return new \WP_Error( 'mkl_pc_quote_no_pdf', __( 'No PDF can be made for quote requests.', 'product-configurator-for-woocommerce' ) );
		}
		$args = wp_parse_args( $args, [ 'context' => 'download' ] );
		if ( ! isset( $args['message'] ) ) $args['message'] = $this->get_message( $request );
		if ( ! isset( $args['quote'] ) ) $args['quote'] = (bool) get_post_meta( $request->id, '_mkl_pc_quote_sent', true );
		$pdf = $provider->render( $request, $args );
		if ( ! is_wp_error( $pdf ) && ( ! is_string( $pdf ) || '' === $pdf ) ) {
			return new \WP_Error( 'mkl_pc_quote_pdf_failed', __( 'The PDF could not be made.', 'product-configurator-for-woocommerce' ) );
		}
		return $pdf;
	}

	/**
	 * The PDF in a file of its own, for an email attachment
	 *
	 * In a folder of its own, so the attachment keeps the file's name. Delete it with delete_file().
	 *
	 * @param Quote_Request $request
	 * @param array         $args    See render().
	 * @return string The path, or '' when it could not be made.
	 */
	public function write_file( Quote_Request $request, $args = [] ) {
		$pdf = $this->render( $request, wp_parse_args( $args, [ 'context' => 'email' ] ) );
		if ( is_wp_error( $pdf ) ) return '';
		$dir = trailingslashit( get_temp_dir() ) . 'mkl-pc-quote-' . wp_generate_password( 12, false );
		if ( ! wp_mkdir_p( $dir ) ) return '';
		$path = $dir . '/' . $this->get_filename( $request );
		if ( false === file_put_contents( $path, $pdf ) ) { // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents -- A temporary file.
			@rmdir( $dir ); // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged
			return '';
		}
		return $path;
	}

	/**
	 * Delete a file made by write_file(), and its folder
	 *
	 * @param string $path
	 * @return void
	 */
	public function delete_file( $path ) {
		$dir = dirname( (string) $path );
		// Only what write_file() made.
		if ( 0 !== strpos( basename( $dir ), 'mkl-pc-quote-' ) || 0 !== strpos( $dir, trailingslashit( get_temp_dir() ) ) ) return;
		if ( is_file( $path ) ) wp_delete_file( $path );
		@rmdir( $dir ); // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged
	}

	/**
	 * admin-post handler: send the PDF to whoever may see it
	 *
	 * @return void
	 */
	public function download() {
		// phpcs:disable WordPress.Security.NonceVerification.Recommended -- The key, the account or edit_post is the authorization.
		$reference = isset( $_GET['reference'] ) ? sanitize_text_field( wp_unslash( $_GET['reference'] ) ) : '';
		$key = isset( $_GET['key'] ) ? sanitize_text_field( wp_unslash( $_GET['key'] ) ) : '';
		// phpcs:enable
		$result = $this->get_download( rawurldecode( $reference ), $key );
		if ( is_wp_error( $result ) ) {
			$data = $result->get_error_data();
			wp_die( esc_html( $result->get_error_message() ), '', [ 'response' => isset( $data['status'] ) ? (int) $data['status'] : 404 ] );
		}
		nocache_headers();
		header( 'X-Robots-Tag: noindex, nofollow' );
		header( 'Content-Type: application/pdf' );
		header( 'Content-Disposition: attachment; filename="' . $result['filename'] . '"' );
		header( 'Content-Length: ' . strlen( $result['content'] ) );
		echo $result['content']; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- A PDF.
		exit;
	}

	/**
	 * The PDF a visitor asks for, when they may have it
	 *
	 * @param string $reference
	 * @param string $key
	 * @return array|\WP_Error filename, content.
	 */
	public function get_download( $reference, $key = '' ) {
		$not_found = new \WP_Error( 'mkl_pc_quote_pdf_not_found', __( 'This quote is not available.', 'product-configurator-for-woocommerce' ), [ 'status' => 404 ] );
		$request = mkl_pc( 'quotes' )->cpt_store->get_by_reference( $reference );
		if ( ! $request ) return $not_found;

		$merchant = current_user_can( 'edit_post', $request->id );
		$customer = mkl_pc( 'quotes' )->customer_actions->can_answer( $request, $key );
		if ( $merchant ? ! $this->merchant_can_download( $request ) : ( ! $customer || ! $this->customer_can_download( $request ) ) ) {
			return $not_found;
		}
		if ( ! $merchant ) {
			$security = mkl_pc( 'frontend_security' );
			if ( $security && is_wp_error( $limited = $security->enforce_rate_limit( self::ACTION ) ) ) return $limited;
		}

		$args = [ 'context' => 'download', 'message' => $this->get_message( $request, $merchant ) ];
		// The merchant sees the quote they are preparing.
		if ( $merchant ) $args['quote'] = true;
		$pdf = $this->render( $request, $args );
		if ( is_wp_error( $pdf ) ) {
			return new \WP_Error( $pdf->get_error_code(), $pdf->get_error_message(), [ 'status' => 500 ] );
		}
		return [
			'filename' => $this->get_filename( $request ),
			'content'  => $pdf,
		];
	}
}
