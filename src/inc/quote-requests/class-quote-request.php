<?php
namespace MKL\PC;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * One quote request: what was configured, and who asked
 *
 * Built and validated by Quote_Service before anything is stored or sent. It holds no
 * WooCommerce object, so the same request works whichever store keeps it.
 */
class Quote_Request {

	/**
	 * Id given by the store that keeps it (post or order id). 0 when it is only emailed.
	 *
	 * @var int
	 */
	public $id = 0;

	/**
	 * Short reference shown to the customer and the merchant, set whatever the store.
	 *
	 * @var string
	 */
	public $reference = '';

	/**
	 * The store that handled it (email, cpt, woo_order...).
	 *
	 * @var string
	 */
	public $store = '';

	/**
	 * Post that owns the configurator data. The product for now; a configurator post once
	 * configurators can exist without a product.
	 *
	 * @var int
	 */
	public $configurator_id = 0;

	/**
	 * @var int
	 */
	public $product_id = 0;

	/**
	 * @var int
	 */
	public $variation_id = 0;

	/**
	 * @var int
	 */
	public $quantity = 1;

	/**
	 * @var Configuration
	 */
	public $configuration = null;

	/**
	 * Raw configurator payload, as posted (JSON).
	 *
	 * @var string
	 */
	public $configuration_raw = '';

	/**
	 * Clean form values, keyed by field id.
	 *
	 * @var array
	 */
	public $fields = [];

	/**
	 * The fields' definitions at the time of the request, keyed by id.
	 *
	 * @var array
	 */
	public $field_definitions = [];

	/**
	 * Price snapshot: base, extra and total for one unit, plus line_total. Null without a price source.
	 *
	 * @var array|null
	 */
	public $price = null;

	/**
	 * Absolute path of the configuration image, or ''.
	 *
	 * @var string
	 */
	public $image_path = '';

	/**
	 * Public URL of the configuration image, or ''.
	 *
	 * @var string
	 */
	public $image_url = '';

	/**
	 * Language the request was made in.
	 *
	 * @var string
	 */
	public $lang = '';

	/**
	 * @var int
	 */
	public $user_id = 0;

	/**
	 * @var int
	 */
	public $created = 0;

	/**
	 * Summary frozen when the request was stored, or null to build it from the configuration.
	 *
	 * @var array[]|null
	 */
	public $summary = null;

	/**
	 * Free-form data for add-ons (e.g. a PDF path).
	 *
	 * @var array
	 */
	public $meta = [];

	/**
	 * A form value
	 *
	 * @param string $field_id
	 * @param mixed  $default
	 * @return mixed
	 */
	public function get_field( $field_id, $default = '' ) {
		return isset( $this->fields[ $field_id ] ) ? $this->fields[ $field_id ] : $default;
	}

	/**
	 * @return string
	 */
	public function get_name() {
		return (string) $this->get_field( 'name' );
	}

	/**
	 * @return string
	 */
	public function get_email() {
		return (string) $this->get_field( 'email' );
	}

	/**
	 * The product, when WooCommerce is there
	 *
	 * @return \WC_Product|null
	 */
	public function get_product() {
		if ( ! function_exists( 'wc_get_product' ) ) return null;
		$product = wc_get_product( $this->variation_id ? $this->variation_id : $this->product_id );
		return $product ? $product : null;
	}

	/**
	 * Name of what was configured
	 *
	 * @return string
	 */
	public function get_product_name() {
		$product = $this->get_product();
		if ( $product ) return $product->get_name();
		return get_the_title( $this->configurator_id );
	}

	/**
	 * The chosen options, ready to display
	 *
	 * @return array[] Rows of label / value (HTML) / layer.
	 */
	public function get_summary() {
		if ( is_array( $this->summary ) ) return $this->summary;
		return $this->configuration ? $this->configuration->get_summary( 'quote' ) : [];
	}

	/**
	 * Where the merchant sees this request, or '' when it was only emailed
	 *
	 * @return string
	 */
	public function get_admin_url() {
		$stores = mkl_pc( 'quotes' )->get_stores();
		return isset( $stores[ $this->store ] ) ? $stores[ $this->store ]->get_admin_url( $this ) : '';
	}

	/**
	 * Form values with their labels, in the form's order, for display
	 *
	 * @return array[] Rows of id / label / value (plain text).
	 */
	public function get_field_rows() {
		$rows = [];
		foreach ( $this->field_definitions as $field_id => $field ) {
			if ( ! array_key_exists( $field_id, $this->fields ) ) continue;
			$value = $this->fields[ $field_id ];
			if ( 'checkbox' === $field['type'] ) {
				$value = $value ? __( 'Yes', 'product-configurator-for-woocommerce' ) : __( 'No', 'product-configurator-for-woocommerce' );
			} elseif ( ! empty( $field['options'] ) && isset( $field['options'][ $value ] ) ) {
				$value = $field['options'][ $value ];
			}
			if ( '' === $value || null === $value ) continue;
			$rows[] = [
				'id'    => $field_id,
				'label' => $field['label'],
				'value' => (string) $value,
			];
		}
		return $rows;
	}

	/**
	 * Public representation, as returned by the REST API
	 *
	 * @return array
	 */
	public function to_array() {
		return [
			'id'           => $this->id,
			'reference'    => $this->reference,
			'store'        => $this->store,
			'product_id'   => $this->product_id,
			'variation_id' => $this->variation_id,
			'quantity'     => $this->quantity,
			'image_url'    => $this->image_url,
		];
	}
}
