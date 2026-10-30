<?php
namespace MKL\PC;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * The quote request form, as a declarative schema
 *
 * One list of fields drives everything: the server-side validation, the form in the configurator,
 * and the schema returned to headless clients. Each field is:
 *
 *     id, type, label, description, placeholder, required, enabled, locked, order,
 *     options (select / radio: value => label), autocomplete, maxlength, source
 *
 * Name and email are locked: whatever the settings or filters say, they stay enabled and required,
 * since the request cannot be answered without them.
 *
 * Sources of fields, merged in this order:
 * 1. the defaults below;
 * 2. the admin's choices, stored in the `mkl_pc_quote_request_fields` option (label, enabled,
 *    required, order per field id - and whole fields added by add-ons such as the Form builder);
 * 3. the `mkl_pc/quote_request/fields` filter.
 */
class Quote_Fields {

	const OPTION = 'mkl_pc_quote_request_fields';

	const LOCKED = [ 'name', 'email' ];

	/**
	 * Default fields
	 *
	 * @return array
	 */
	public function get_default_fields() {
		$privacy_url = function_exists( 'get_privacy_policy_url' ) ? get_privacy_policy_url() : '';
		return [
			'name' => [
				'type'         => 'text',
				'label'        => __( 'Name', 'product-configurator-for-woocommerce' ),
				'autocomplete' => 'name',
				'required'     => true,
				'order'        => 10,
			],
			'email' => [
				'type'         => 'email',
				'label'        => __( 'Email', 'product-configurator-for-woocommerce' ),
				'autocomplete' => 'email',
				'required'     => true,
				'order'        => 20,
			],
			'phone' => [
				'type'         => 'tel',
				'label'        => __( 'Phone', 'product-configurator-for-woocommerce' ),
				'autocomplete' => 'tel',
				'order'        => 30,
			],
			'company' => [
				'type'         => 'text',
				'label'        => __( 'Company', 'product-configurator-for-woocommerce' ),
				'autocomplete' => 'organization',
				'enabled'      => false,
				'order'        => 40,
			],
			'message' => [
				'type'      => 'textarea',
				'label'     => __( 'Message', 'product-configurator-for-woocommerce' ),
				'maxlength' => 5000,
				'order'     => 50,
			],
			'consent' => [
				'type'        => 'checkbox',
				'label'       => __( 'I agree to my details being stored to answer this request.', 'product-configurator-for-woocommerce' ),
				'description' => $privacy_url ? sprintf( '<a href="%s" target="_blank">%s</a>', esc_url( $privacy_url ), esc_html__( 'Privacy policy', 'product-configurator-for-woocommerce' ) ) : '',
				'required'    => true,
				'enabled'     => false,
				'order'       => 60,
			],
		];
	}

	/**
	 * All fields, enabled or not, normalised and sorted
	 *
	 * @param array $context Passed to the filter: product_id, configurator_id.
	 * @return array Keyed by field id.
	 */
	public function get_all_fields( $context = [] ) {
		$fields = $this->get_default_fields();

		$stored = get_option( self::OPTION, [] );
		if ( is_array( $stored ) ) {
			foreach ( $stored as $field_id => $settings ) {
				if ( ! is_array( $settings ) ) continue;
				$field_id = sanitize_key( $field_id );
				$fields[ $field_id ] = isset( $fields[ $field_id ] ) ? array_merge( $fields[ $field_id ], $settings ) : $settings;
			}
		}

		/**
		 * Filter the quote request fields.
		 *
		 * @param array $fields  Keyed by field id. See Quote_Fields for the keys of a field.
		 * @param array $context product_id, configurator_id (when known).
		 */
		$fields = apply_filters( 'mkl_pc/quote_request/fields', $fields, $context );

		$defaults = $this->get_default_fields();
		$normalised = [];
		foreach ( (array) $fields as $field_id => $field ) {
			$field_id = sanitize_key( $field_id );
			if ( ! $field_id || ! is_array( $field ) ) continue;
			$normalised[ $field_id ] = $this->normalise( $field_id, $field );
		}

		foreach ( self::LOCKED as $field_id ) {
			if ( ! isset( $normalised[ $field_id ] ) ) {
				$normalised[ $field_id ] = $this->normalise( $field_id, $defaults[ $field_id ] );
			}
			$normalised[ $field_id ]['type']     = $defaults[ $field_id ]['type'];
			$normalised[ $field_id ]['enabled']  = true;
			$normalised[ $field_id ]['required'] = true;
			$normalised[ $field_id ]['locked']   = true;
		}

		uasort( $normalised, [ '\MKL\PC\Utils', 'filter_order' ] );
		return $normalised;
	}

	/**
	 * The fields shown on the form
	 *
	 * @param array $context
	 * @return array Keyed by field id.
	 */
	public function get_fields( $context = [] ) {
		return array_filter( $this->get_all_fields( $context ), function( $field ) {
			return $field['enabled'];
		} );
	}

	/**
	 * The fields as given to the browser / headless clients
	 *
	 * @param array $context
	 * @return array List of fields.
	 */
	public function get_public_schema( $context = [] ) {
		$schema = [];
		foreach ( $this->get_fields( $context ) as $field_id => $field ) {
			$public = [
				'id'           => $field_id,
				'type'         => $field['type'],
				'label'        => $field['label'],
				'description'  => $field['description'],
				'placeholder'  => $field['placeholder'],
				'required'     => $field['required'],
				'autocomplete' => $field['autocomplete'],
				'maxlength'    => $field['maxlength'],
				'source'       => $field['source'],
			];
			if ( ! empty( $field['options'] ) ) {
				$public['options'] = [];
				foreach ( $field['options'] as $value => $label ) {
					$public['options'][] = [ 'value' => (string) $value, 'label' => $label ];
				}
			}
			$schema[] = $public;
		}
		return $schema;
	}

	/**
	 * Sanitize and validate submitted values
	 *
	 * @param array $values  Raw values keyed by field id.
	 * @param array $context
	 * @return array|\WP_Error Clean values keyed by field id, or an error whose data holds `field_errors` (field id => message).
	 */
	public function validate( $values, $context = [] ) {
		$values = is_array( $values ) ? $values : [];
		$clean = [];
		$field_errors = [];

		foreach ( $this->get_fields( $context ) as $field_id => $field ) {
			$raw = isset( $values[ $field_id ] ) ? $values[ $field_id ] : null;
			$value = $this->sanitize_value( $field, $raw );

			if ( $this->is_empty( $field, $value ) ) {
				if ( $field['required'] ) {
					/* translators: %s: field label */
					$field_errors[ $field_id ] = sprintf( __( '%s is required.', 'product-configurator-for-woocommerce' ), wp_strip_all_tags( $field['label'] ) );
				}
				$clean[ $field_id ] = 'checkbox' === $field['type'] ? false : '';
				continue;
			}

			$valid = $this->validate_value( $field, $value );
			if ( is_wp_error( $valid ) ) {
				$field_errors[ $field_id ] = $valid->get_error_message();
				continue;
			}
			$clean[ $field_id ] = $value;
		}

		if ( ! empty( $field_errors ) ) {
			return new \WP_Error(
				'mkl_pc_quote_invalid_fields',
				__( 'Some fields need your attention.', 'product-configurator-for-woocommerce' ),
				[ 'status' => 400, 'field_errors' => $field_errors ]
			);
		}

		return $clean;
	}

	/**
	 * Fill in a field's missing keys
	 *
	 * @param string $field_id
	 * @param array  $field
	 * @return array
	 */
	private function normalise( $field_id, $field ) {
		$field = wp_parse_args( $field, [
			'type'         => 'text',
			'label'        => $field_id,
			'description'  => '',
			'placeholder'  => '',
			'required'     => false,
			'enabled'      => true,
			'order'        => 100,
			'options'      => [],
			'autocomplete' => '',
			'maxlength'    => 0,
			'source'       => 'core',
		] );
		$field['id']       = $field_id;
		$field['required'] = (bool) $field['required'];
		$field['enabled']  = (bool) $field['enabled'];
		$field['locked']   = in_array( $field_id, self::LOCKED, true );
		$field['order']    = (int) $field['order'];
		$field['options']  = is_array( $field['options'] ) ? $field['options'] : [];
		$field['maxlength'] = (int) $field['maxlength'];
		if ( ! $field['maxlength'] && in_array( $field['type'], [ 'text', 'email', 'tel' ], true ) ) {
			$field['maxlength'] = 200;
		}
		return $field;
	}

	/**
	 * @param array $field
	 * @param mixed $raw
	 * @return mixed
	 */
	private function sanitize_value( $field, $raw ) {
		if ( 'checkbox' === $field['type'] ) {
			return in_array( $raw, [ true, 1, '1', 'on', 'yes', 'true' ], true );
		}
		if ( is_array( $raw ) || is_object( $raw ) ) {
			return '';
		}
		$raw = (string) $raw;
		switch ( $field['type'] ) {
			case 'email':
				$value = sanitize_email( $raw );
				break;
			case 'textarea':
				$value = sanitize_textarea_field( $raw );
				break;
			default:
				$value = sanitize_text_field( $raw );
		}
		/**
		 * Filter a sanitized quote request value. Add-ons sanitize their own field types here.
		 *
		 * @param mixed $value
		 * @param mixed $raw
		 * @param array $field
		 */
		return apply_filters( 'mkl_pc/quote_request/sanitize_field', $value, $raw, $field );
	}

	/**
	 * @param array $field
	 * @param mixed $value
	 * @return boolean
	 */
	private function is_empty( $field, $value ) {
		if ( 'checkbox' === $field['type'] ) return ! $value;
		return '' === $value || null === $value;
	}

	/**
	 * @param array $field
	 * @param mixed $value Sanitized, not empty.
	 * @return true|\WP_Error
	 */
	private function validate_value( $field, $value ) {
		$label = wp_strip_all_tags( $field['label'] );
		/* translators: %s: field label */
		$invalid = new \WP_Error( 'invalid', sprintf( __( '%s is not valid.', 'product-configurator-for-woocommerce' ), $label ) );

		if ( $field['maxlength'] && is_string( $value ) && mb_strlen( $value ) > $field['maxlength'] ) {
			/* translators: 1: field label, 2: number of characters */
			return new \WP_Error( 'too_long', sprintf( __( '%1$s must be %2$d characters or fewer.', 'product-configurator-for-woocommerce' ), $label, $field['maxlength'] ) );
		}

		switch ( $field['type'] ) {
			case 'email':
				$result = is_email( $value ) ? true : $invalid;
				break;
			case 'tel':
				$result = preg_match( '/^[0-9+().\s\/-]{3,40}$/', $value ) ? true : $invalid;
				break;
			case 'number':
				$result = is_numeric( $value ) ? true : $invalid;
				break;
			case 'date':
				$date = \DateTime::createFromFormat( 'Y-m-d', $value );
				$result = ( $date && $date->format( 'Y-m-d' ) === $value ) ? true : $invalid;
				break;
			case 'select':
			case 'radio':
				$result = array_key_exists( $value, $field['options'] ) ? true : $invalid;
				break;
			default:
				$result = true;
		}

		/**
		 * Filter the validation of a quote request value. Add-ons validate their own field types here.
		 *
		 * @param true|\WP_Error $result
		 * @param mixed          $value
		 * @param array          $field
		 */
		return apply_filters( 'mkl_pc/quote_request/validate_field', $result, $value, $field );
	}
}
