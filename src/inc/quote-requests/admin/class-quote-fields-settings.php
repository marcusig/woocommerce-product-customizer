<?php
namespace MKL\PC;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * The request form's fields, in the configurator settings
 *
 * A sortable list of every field: label, shown or not, required or not. Name and email are always
 * shown and required, but can be renamed and moved. Saved in the Quote_Fields::OPTION option, which
 * only holds what the admin changed: an untouched label keeps following the translation.
 *
 * Add-ons add rows by adding fields through `mkl_pc/quote_request/fields` (or to the option).
 */
class Quote_Fields_Settings {

	/**
	 * @var Quote_Fields
	 */
	private $fields;

	public function __construct( Quote_Fields $fields ) {
		$this->fields = $fields;
		add_action( 'admin_enqueue_scripts', [ $this, 'enqueue' ] );
	}

	/**
	 * Register the option with the configurator settings form
	 *
	 * @return void
	 */
	public function register() {
		register_setting( 'mlk_pc_settings', Quote_Fields::OPTION, [
			'type'              => 'array',
			'sanitize_callback' => [ $this, 'sanitize' ],
			'default'           => [],
		] );
	}

	/**
	 * @return void
	 */
	public function enqueue() {
		if ( ! function_exists( 'mkl_pc_is_settings_page' ) || ! mkl_pc_is_settings_page() ) return;
		wp_enqueue_script( 'jquery-ui-sortable' );
		wp_add_inline_script( 'jquery-ui-sortable', "jQuery( function( $ ) {
			var \$list = $( '.mkl-pc-quote-fields-list tbody' );
			if ( ! \$list.length ) return;
			var renumber = function() {
				\$list.find( 'tr' ).each( function( index ) {
					$( this ).find( '.mkl-pc-quote-field-order' ).val( ( index + 1 ) * 10 );
				} );
			};
			\$list.sortable( { handle: '.mkl-pc-quote-field-handle', axis: 'y', update: renumber } );
			\$list.on( 'click', '.mkl-pc-quote-field-move', function() {
				var \$row = $( this ).closest( 'tr' );
				if ( 'up' === $( this ).data( 'direction' ) ) { \$row.prev().before( \$row ); } else { \$row.next().after( \$row ); }
				renumber();
				$( this ).trigger( 'focus' );
			} );
		} );" );
	}

	/**
	 * The list
	 *
	 * @return void
	 */
	public function render() {
		$defaults = $this->fields->get_default_fields();
		$stored = get_option( Quote_Fields::OPTION, [] );
		$name = Quote_Fields::OPTION;
		?>
		<table class="widefat striped mkl-pc-quote-fields-list" style="max-width: 760px;">
			<thead>
				<tr>
					<th style="width: 64px;"><span class="screen-reader-text"><?php esc_html_e( 'Order', 'product-configurator-for-woocommerce' ); ?></span></th>
					<th><?php esc_html_e( 'Label', 'product-configurator-for-woocommerce' ); ?></th>
					<th><?php esc_html_e( 'Type', 'product-configurator-for-woocommerce' ); ?></th>
					<th><?php esc_html_e( 'Shown', 'product-configurator-for-woocommerce' ); ?></th>
					<th><?php esc_html_e( 'Required', 'product-configurator-for-woocommerce' ); ?></th>
				</tr>
			</thead>
			<tbody>
				<?php foreach ( $this->fields->get_all_fields() as $field_id => $field ) :
					$is_core = isset( $defaults[ $field_id ] );
					// Core labels are only stored once changed, so they keep following translations.
					$label_value = $is_core ? ( isset( $stored[ $field_id ]['label'] ) ? $stored[ $field_id ]['label'] : '' ) : $field['label'];
					$row = $name . '[' . $field_id . ']';
					?>
					<tr>
						<td>
							<span class="dashicons dashicons-menu mkl-pc-quote-field-handle" style="cursor: move;" aria-hidden="true"></span>
							<button type="button" class="button-link mkl-pc-quote-field-move" data-direction="up"><span class="screen-reader-text"><?php
								/* translators: %s: field label */
								echo esc_html( sprintf( __( 'Move %s up', 'product-configurator-for-woocommerce' ), wp_strip_all_tags( $field['label'] ) ) );
							?></span><span class="dashicons dashicons-arrow-up-alt2" aria-hidden="true"></span></button>
							<button type="button" class="button-link mkl-pc-quote-field-move" data-direction="down"><span class="screen-reader-text"><?php
								/* translators: %s: field label */
								echo esc_html( sprintf( __( 'Move %s down', 'product-configurator-for-woocommerce' ), wp_strip_all_tags( $field['label'] ) ) );
							?></span><span class="dashicons dashicons-arrow-down-alt2" aria-hidden="true"></span></button>
							<input type="hidden" class="mkl-pc-quote-field-order" name="<?php echo esc_attr( $row ); ?>[order]" value="<?php echo esc_attr( $field['order'] ); ?>">
						</td>
						<td>
							<label class="screen-reader-text" for="mkl-pc-quote-field-label-<?php echo esc_attr( $field_id ); ?>"><?php esc_html_e( 'Label', 'product-configurator-for-woocommerce' ); ?></label>
							<input type="text" class="regular-text" id="mkl-pc-quote-field-label-<?php echo esc_attr( $field_id ); ?>" name="<?php echo esc_attr( $row ); ?>[label]" value="<?php echo esc_attr( $label_value ); ?>" placeholder="<?php echo esc_attr( $is_core ? $defaults[ $field_id ]['label'] : '' ); ?>">
						</td>
						<td><?php echo esc_html( $field['type'] ); ?></td>
						<td>
							<?php if ( $field['locked'] ) : ?>
								<input type="checkbox" checked disabled aria-label="<?php esc_attr_e( 'Always shown', 'product-configurator-for-woocommerce' ); ?>">
							<?php else : ?>
								<input type="hidden" name="<?php echo esc_attr( $row ); ?>[enabled]" value="0">
								<input type="checkbox" name="<?php echo esc_attr( $row ); ?>[enabled]" value="1" <?php checked( $field['enabled'] ); ?> aria-label="<?php esc_attr_e( 'Shown', 'product-configurator-for-woocommerce' ); ?>">
							<?php endif; ?>
						</td>
						<td>
							<?php if ( $field['locked'] ) : ?>
								<input type="checkbox" checked disabled aria-label="<?php esc_attr_e( 'Always required', 'product-configurator-for-woocommerce' ); ?>">
							<?php else : ?>
								<input type="hidden" name="<?php echo esc_attr( $row ); ?>[required]" value="0">
								<input type="checkbox" name="<?php echo esc_attr( $row ); ?>[required]" value="1" <?php checked( $field['required'] ); ?> aria-label="<?php esc_attr_e( 'Required', 'product-configurator-for-woocommerce' ); ?>">
							<?php endif; ?>
						</td>
					</tr>
				<?php endforeach; ?>
			</tbody>
		</table>
		<p class="field-description"><?php esc_html_e( 'Drag the rows, or use the arrows, to change the order of the fields. Name and email are always asked for. An empty label uses the default one.', 'product-configurator-for-woocommerce' ); ?></p>
		<?php
	}

	/**
	 * Merge the posted rows into what is stored
	 *
	 * Rows that were not posted are kept: an add-on that is turned off while the settings are saved
	 * finds its fields as it left them.
	 *
	 * @param mixed $input
	 * @return array
	 */
	public function sanitize( $input ) {
		$stored = get_option( Quote_Fields::OPTION, [] );
		$stored = is_array( $stored ) ? $stored : [];
		if ( ! is_array( $input ) ) return $stored;

		$defaults = $this->fields->get_default_fields();
		foreach ( $input as $field_id => $row ) {
			$field_id = sanitize_key( $field_id );
			if ( ! $field_id || ! is_array( $row ) ) continue;
			$settings = isset( $stored[ $field_id ] ) && is_array( $stored[ $field_id ] ) ? $stored[ $field_id ] : [];

			if ( isset( $row['order'] ) ) $settings['order'] = (int) $row['order'];

			$label = isset( $row['label'] ) ? sanitize_text_field( $row['label'] ) : '';
			if ( '' !== $label ) {
				$settings['label'] = $label;
			} elseif ( isset( $defaults[ $field_id ] ) ) {
				unset( $settings['label'] );
			}

			if ( ! in_array( $field_id, Quote_Fields::LOCKED, true ) ) {
				if ( isset( $row['enabled'] ) ) $settings['enabled'] = (bool) $row['enabled'];
				if ( isset( $row['required'] ) ) $settings['required'] = (bool) $row['required'];
			}
			$stored[ $field_id ] = $settings;
		}
		return $stored;
	}
}
