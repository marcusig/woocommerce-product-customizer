<?php
namespace MKL\PC;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Sends the configurator's emails.
 *
 * Callers name an email and hand it the object it is about - `send( 'quote_request_admin', $request )` -
 * and never deal with WooCommerce directly. For now every email is a WC_Email: it is listed under
 * WooCommerce > Settings > Emails, with the shop's template and styles. When the configurator can run
 * without WooCommerce, this class gets a second backend and its callers do not change.
 *
 * Emails extend \MKL\PC\Email. Their files are only loaded once WooCommerce loads its own emails,
 * because WC_Email does not exist before that.
 */
class Mailer {

	/**
	 * Registered emails, keyed by id.
	 *
	 * @var array<string, array{class: string, file: string}>
	 */
	private $emails = [];

	public function __construct() {
		add_filter( 'woocommerce_email_classes', [ $this, 'add_woocommerce_email_classes' ] );
	}

	/**
	 * Register an email
	 *
	 * @param string $id         Email id, also the WC_Email id (its settings are stored in woocommerce_{$id}_settings).
	 * @param string $class_name Fully qualified class name, extending \MKL\PC\Email.
	 * @param string $file       File declaring the class. Loaded only when the emails are.
	 * @return void
	 */
	public function register( $id, $class_name, $file ) {
		$this->emails[ $id ] = [
			'class' => $class_name,
			'file'  => $file,
		];
	}

	/**
	 * Whether an email was registered
	 *
	 * @param string $id
	 * @return boolean
	 */
	public function is_registered( $id ) {
		return isset( $this->emails[ $id ] );
	}

	/**
	 * Get an email instance
	 *
	 * @param string $id
	 * @return Email|null
	 */
	public function get_email( $id ) {
		if ( ! $this->is_registered( $id ) || ! function_exists( 'WC' ) ) return null;
		$emails = WC()->mailer()->get_emails();
		$key = $this->get_class_key( $id );
		return isset( $emails[ $key ] ) ? $emails[ $key ] : null;
	}

	/**
	 * Send a registered email
	 *
	 * @param string $id     Email id.
	 * @param mixed  $object What the email is about (a Quote_Request, a Configuration...).
	 * @param array  $args   Passed on to the email's trigger().
	 * @return boolean Whether the email was sent. False when it is disabled or has no recipient too.
	 */
	public function send( $id, $object, $args = [] ) {
		$email = $this->get_email( $id );
		if ( ! $email ) return false;
		return (bool) $email->trigger( $object, $args );
	}

	/**
	 * Send a one-off email in the shop's email template
	 *
	 * @param string|array $to
	 * @param string       $subject
	 * @param string       $message HTML content.
	 * @param array        $args {
	 *     @type string $heading     Heading shown in the template. Defaults to the subject.
	 *     @type array  $headers     Extra headers.
	 *     @type array  $attachments Absolute file paths.
	 * }
	 * @return boolean
	 */
	public function send_raw( $to, $subject, $message, $args = [] ) {
		$args = wp_parse_args( $args, [
			'heading'     => $subject,
			'headers'     => [],
			'attachments' => [],
		] );
		if ( ! function_exists( 'WC' ) ) {
			return wp_mail( $to, $subject, $message, array_merge( [ 'Content-Type: text/html; charset=UTF-8' ], (array) $args['headers'] ), $args['attachments'] );
		}
		$mailer = WC()->mailer();
		return (bool) $mailer->send( $to, $subject, $mailer->wrap_message( $args['heading'], $message ), $args['headers'], $args['attachments'] );
	}

	/**
	 * Render an email template
	 *
	 * Themes override them in yourtheme/product-configurator/<template>, a path that does not
	 * depend on WooCommerce, so it can stay the same once there is another backend.
	 *
	 * @param string $template Path relative to inc/templates.
	 * @param array  $args
	 * @return string
	 */
	public function get_template_html( $template, $args = [] ) {
		return wc_get_template_html( $template, $args, 'product-configurator/', trailingslashit( MKL_PC_INCLUDE_PATH ) . 'templates/' );
	}

	/**
	 * Add the registered emails to WooCommerce's
	 *
	 * @param array $emails
	 * @return array
	 */
	public function add_woocommerce_email_classes( $emails ) {
		if ( empty( $this->emails ) ) return $emails;
		require_once MKL_PC_INCLUDE_PATH . 'mailer/class-email.php';
		foreach ( $this->emails as $id => $email ) {
			require_once $email['file'];
			if ( class_exists( $email['class'] ) ) {
				$emails[ $this->get_class_key( $id ) ] = new $email['class']();
			}
		}
		return $emails;
	}

	/**
	 * Key of an email in WooCommerce's list
	 *
	 * @param string $id
	 * @return string
	 */
	private function get_class_key( $id ) {
		return 'MKL_PC_Email_' . $id;
	}
}
