<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<p class="description"><?php esc_html_e( 'Control overall brightness, alpha output and quality effects. Higher quality can be more demanding on performance.', 'product-configurator-for-woocommerce' ); ?></p>
<p class="field-row">
	<label for="pc-3d-tone-mapping"><?php esc_html_e( 'Tone mapping', 'product-configurator-for-woocommerce' ); ?></label>
	<select id="pc-3d-tone-mapping" class="pc-3d-tone-mapping pc-3d-option-help-source" data-key="renderer.tone_mapping">
		<option value="aces" data-help="<?php esc_attr_e( 'Rolls bright areas off smoothly instead of clipping them, the way a camera does. Lets you raise exposure to open up dark areas without blowing out highlights.', 'product-configurator-for-woocommerce' ); ?>" <# if ( ! data.renderer || ! data.renderer.tone_mapping || data.renderer.tone_mapping === 'aces' ) { #>selected<# } #>><?php esc_html_e( 'Filmic (ACES) — recommended', 'product-configurator-for-woocommerce' ); ?></option>
		<option value="linear" data-help="<?php esc_attr_e( 'Brightness is multiplied and then clipped. Bright areas turn flat white with no detail.', 'product-configurator-for-woocommerce' ); ?>" <# if ( data.renderer && data.renderer.tone_mapping === 'linear' ) { #>selected<# } #>><?php esc_html_e( 'Linear', 'product-configurator-for-woocommerce' ); ?></option>
		<option value="none" data-help="<?php esc_attr_e( 'No tone mapping. Values pass through untouched.', 'product-configurator-for-woocommerce' ); ?>" <# if ( data.renderer && data.renderer.tone_mapping === 'none' ) { #>selected<# } #>><?php esc_html_e( 'None', 'product-configurator-for-woocommerce' ); ?></option>
	</select>
</p>
<p class="description pc-3d-option-help"></p>
<p class="field-row">
	<label><?php esc_html_e( 'Exposure', 'product-configurator-for-woocommerce' ); ?></label>
	<input type="range" class="pc-3d-exposure" data-key="renderer.exposure" min="0.1" max="3" step="0.1" value="{{ data.renderer && data.renderer.exposure != null ? data.renderer.exposure : 1 }}" />
	<span class="pc-3d-value-display pc-3d-exposure-value">1</span>
</p>
<p class="field-row">
	<label><input type="checkbox" class="pc-3d-alpha" data-key="renderer.alpha" <# if ( data.renderer && data.renderer.alpha ) { #>checked<# } #> /> <?php esc_html_e( 'Alpha output', 'product-configurator-for-woocommerce' ); ?></label>
</p>
