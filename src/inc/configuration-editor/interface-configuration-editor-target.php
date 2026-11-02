<?php
namespace MKL\PC;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Something the configuration editor can write a configuration to: an order line, a quote request...
 *
 * A target string starts with the type, then what the type needs: `order:12:item:34`, `quote:56`. Every
 * type accepts `{base}:product:{product_id}`, which configures a product from scratch: the editor builds
 * it when the admin picks a product for the base the screen gave (`order:12`, `quote:56`).
 */
interface Configuration_Editor_Target {

	/**
	 * The prefix of the targets handled
	 *
	 * @return string
	 */
	public function get_type();

	/**
	 * Whether the current user may configure targets of this type at all (searching products, for one)
	 *
	 * @return boolean
	 */
	public function current_user_can();

	/**
	 * What a target points at, if the current user may configure it
	 *
	 * @param string $target
	 * @return array|\WP_Error {
	 *     @type \WC_Product $product       What is configured. The editor checks that it is configurable.
	 *     @type array       $configuration The saved configuration to open with, or [] for a new one.
	 *     @type float       $quantity
	 *     @type string      $save_label    Text of the frame's Save button.
	 * }
	 */
	public function resolve( $target );

	/**
	 * Write a configuration to a resolved target
	 *
	 * @param array        $resolved What resolve() returned.
	 * @param string|array $payload  The configurator's payload.
	 * @param array        $args     quantity, image (3D capture, data URL).
	 * @return array|\WP_Error Data returned to the frame and the screen.
	 */
	public function save( $resolved, $payload, $args );
}
