<?php
namespace MKL\PC;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * What makes the PDF of a quote request: an add-on (Save your design), so core needs no PDF library
 *
 * Registered with the `mkl_pc/quote_request/pdf_provider` filter.
 */
interface Quote_PDF_Provider {

	/**
	 * Where the PDF goes, as the merchant set it up
	 *
	 * @return string none; quote (the quote sent from the request's screen, and the customer's
	 *                download once it is sent); all (also the request emails, to the shop and the
	 *                customer, and the download from the start).
	 */
	public function get_mode();

	/**
	 * The PDF of a request
	 *
	 * @param Quote_Request $request
	 * @param array         $args    context (email, download), message (the merchant's message to show),
	 *                               quote (true when it is the quote: sent, being sent, or the merchant's).
	 * @return string|\WP_Error The PDF's content.
	 */
	public function render( Quote_Request $request, array $args = [] );
}
