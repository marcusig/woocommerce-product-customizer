<?php
/**
 * Templates of the quote request in the configurator, used by assets/js/quote-request.js
 *
 * The button has the add-to-quote class the configurator themes style for the quote plugins. The form,
 * the sending and the result screens are shown in the add to cart modal, so they take the theme's
 * modal styles.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$settings     = mkl_pc( 'settings' );
$button_class = mkl_pc( 'frontend' ) && mkl_pc( 'frontend' )->product ? mkl_pc( 'frontend' )->product->button_class : 'button';
$button_label = $settings->get_label( 'quote_request_button_label', __( 'Request a quote', 'product-configurator-for-woocommerce' ) );
$form_title   = $settings->get_label( 'quote_request_form_title', __( 'Request a quote', 'product-configurator-for-woocommerce' ) );
$submit_label = $settings->get_label( 'quote_request_submit_label', __( 'Send my request', 'product-configurator-for-woocommerce' ) );
?>
<script type="text/html" id="tmpl-mkl-pc-quote-request-button" data-wg-notranslate>
	<button type="button" class="<?php echo esc_attr( $button_class ); ?> add-to-quote mkl-pc-request-quote">
		<span><?php echo esc_html( $button_label ); ?></span>
	</button>
</script>

<script type="text/html" id="tmpl-mkl-pc-quote-request-form" data-wg-notranslate>
	<form class="mkl-pc-quote-form has-box" novalidate>
		<div class="header" id="mkl-pc-quote-form-title"><?php echo esc_html( $form_title ); ?></div>
		<# if ( data.message ) { #>
			<div class="mkl-pc-quote-form__notice error messages" role="alert">{{ data.message }}</div>
		<# } #>
		<div class="mkl-pc-quote-form__fields">
			<# _.each( data.fields, function( field ) {
				var input_id = 'mkl-pc-quote-field-' + field.id;
				var error = data.errors[ field.id ];
				var value = undefined === data.values[ field.id ] ? '' : data.values[ field.id ];
				var described = [];
				if ( field.description ) described.push( input_id + '-description' );
				if ( error ) described.push( input_id + '-error' );
			#>
				<div class="mkl-pc-quote-field mkl-pc-quote-field--{{ field.type }}<# if ( error ) { #> has-error<# } #>" data-field="{{ field.id }}">
					<# if ( 'checkbox' === field.type ) { #>
						<label for="{{ input_id }}">
							<input type="checkbox" id="{{ input_id }}" name="{{ field.id }}" value="1" <# if ( value ) { #>checked<# } #> <# if ( field.required ) { #>aria-required="true"<# } #> <# if ( error ) { #>aria-invalid="true"<# } #> <# if ( described.length ) { #>aria-describedby="{{ described.join( ' ' ) }}"<# } #>>
							{{ field.label }}<# if ( field.required ) { #> <span class="required" aria-hidden="true">*</span><# } #>
						</label>
					<# } else if ( 'radio' === field.type ) { #>
						<fieldset <# if ( described.length ) { #>aria-describedby="{{ described.join( ' ' ) }}"<# } #>>
							<legend>{{ field.label }}<# if ( field.required ) { #> <span class="required" aria-hidden="true">*</span><# } #></legend>
							<# _.each( field.options, function( option, index ) { #>
								<label><input type="radio" name="{{ field.id }}" value="{{ option.value }}" <# if ( String( value ) === option.value ) { #>checked<# } #>> {{ option.label }}</label>
							<# } ); #>
						</fieldset>
					<# } else { #>
						<label for="{{ input_id }}">{{ field.label }}<# if ( field.required ) { #> <span class="required" aria-hidden="true">*</span><# } #></label>
						<# if ( 'textarea' === field.type ) { #>
							<textarea id="{{ input_id }}" name="{{ field.id }}" rows="4" placeholder="{{ field.placeholder }}" <# if ( field.maxlength ) { #>maxlength="{{ field.maxlength }}"<# } #> <# if ( field.required ) { #>aria-required="true"<# } #> <# if ( error ) { #>aria-invalid="true"<# } #> <# if ( described.length ) { #>aria-describedby="{{ described.join( ' ' ) }}"<# } #>>{{ value }}</textarea>
						<# } else if ( 'select' === field.type ) { #>
							<select id="{{ input_id }}" name="{{ field.id }}" <# if ( field.required ) { #>aria-required="true"<# } #> <# if ( error ) { #>aria-invalid="true"<# } #> <# if ( described.length ) { #>aria-describedby="{{ described.join( ' ' ) }}"<# } #>>
								<option value=""><# if ( field.placeholder ) { #>{{ field.placeholder }}<# } #></option>
								<# _.each( field.options, function( option ) { #>
									<option value="{{ option.value }}" <# if ( String( value ) === option.value ) { #>selected<# } #>>{{ option.label }}</option>
								<# } ); #>
							</select>
						<# } else { #>
							<input type="{{ _.contains( [ 'email', 'tel', 'number', 'date' ], field.type ) ? field.type : 'text' }}" id="{{ input_id }}" name="{{ field.id }}" value="{{ value }}" placeholder="{{ field.placeholder }}" <# if ( field.autocomplete ) { #>autocomplete="{{ field.autocomplete }}"<# } #> <# if ( field.maxlength ) { #>maxlength="{{ field.maxlength }}"<# } #> <# if ( field.required ) { #>aria-required="true"<# } #> <# if ( error ) { #>aria-invalid="true"<# } #> <# if ( described.length ) { #>aria-describedby="{{ described.join( ' ' ) }}"<# } #>>
						<# } #>
					<# } #>
					<# if ( field.description ) { #>
						<div class="mkl-pc-quote-field__description" id="{{ input_id }}-description">{{{ field.description }}}</div>
					<# } #>
					<# if ( error ) { #>
						<div class="mkl-pc-quote-field__error" id="{{ input_id }}-error">{{ error }}</div>
					<# } #>
				</div>
			<# } ); #>
			<div class="mkl-pc-quote-field--website" aria-hidden="true">
				<label for="mkl-pc-quote-website"><?php esc_html_e( 'Leave this field empty', 'product-configurator-for-woocommerce' ); ?></label>
				<input type="text" id="mkl-pc-quote-website" name="website" value="" tabindex="-1" autocomplete="off">
			</div>
		</div>
		<?php do_action( 'tmpl-mkl-pc-quote-request-form' ); ?>
		<div class="adding-to-cart--adding-cta">
			<button type="button" class="button continue-shopping mkl-pc-quote-cancel"><?php esc_html_e( 'Cancel', 'product-configurator-for-woocommerce' ); ?></button>
			<button type="submit" class="button mkl-pc-quote-submit"><?php echo esc_html( $submit_label ); ?></button>
		</div>
	</form>
</script>

<script type="text/html" id="tmpl-mkl-pc-quote-request-sending" data-wg-notranslate>
	<div class="adding-to-cart--adding mkl-pc-quote-sending" role="status">
		<div class="header"><?php echo esc_html( $settings->get_label( 'quote_request_sending', __( 'Sending your request', 'product-configurator-for-woocommerce' ) ) ); ?></div>
		<div class="spinner"></div>
	</div>
</script>

<script type="text/html" id="tmpl-mkl-pc-quote-request-sent" data-wg-notranslate>
	<div class="adding-to-cart--added mkl-pc-quote-sent has-box" role="status">
		<div class="header">
			<svg viewBox="0 0 300 300" aria-hidden="true"><circle cx="150" cy="150" r="116.61"/><polyline points="73.61 150 129.81 206.19 223.76 112.24"/></svg>
			<div class="title"><?php echo esc_html( $settings->get_label( 'quote_request_sent_title', __( 'Request sent', 'product-configurator-for-woocommerce' ) ) ); ?></div>
		</div>
		<div class="messages">
			<p>{{ data.message }}</p>
			<# if ( data.reference ) { #>
				<p class="mkl-pc-quote-reference"><?php esc_html_e( 'Reference:', 'product-configurator-for-woocommerce' ); ?> <strong>{{ data.reference }}</strong></p>
			<# } #>
		</div>
		<div class="adding-to-cart--adding-cta">
			<button type="button" class="button continue-shopping"><?php echo esc_html( $settings->get_label( 'keep_configuring', __( 'Keep configuring', 'product-configurator-for-woocommerce' ) ) ); ?></button>
		</div>
		<?php do_action( 'tmpl-mkl-pc-quote-request-sent' ); ?>
	</div>
</script>

<script type="text/html" id="tmpl-mkl-pc-quote-request-error" data-wg-notranslate>
	<div class="adding-to-cart--not-added mkl-pc-quote-error has-box" role="alert">
		<div class="error messages">{{ data.message }}</div>
		<div class="adding-to-cart--adding-cta">
			<button type="button" class="button continue-shopping"><?php esc_html_e( 'Close', 'product-configurator-for-woocommerce' ); ?></button>
			<# if ( data.can_retry ) { #>
				<button type="button" class="button mkl-pc-quote-back"><?php esc_html_e( 'Back to the form', 'product-configurator-for-woocommerce' ); ?></button>
			<# } #>
		</div>
	</div>
</script>
