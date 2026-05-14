<p class="description"><?php _e( 'Control overall brightness, alpha output and quality effects. Higher quality can be more demanding on performance.', 'product-configurator-for-woocommerce' ); ?></p>
<p class="field-row">
	<label><?php _e( 'Exposure', 'product-configurator-for-woocommerce' ); ?></label>
	<input type="range" class="pc-3d-exposure" data-key="renderer.exposure" min="0.1" max="3" step="0.1" value="{{ data.renderer && data.renderer.exposure != null ? data.renderer.exposure : 1 }}" />
	<span class="pc-3d-value-display pc-3d-exposure-value">1</span>
</p>
<p class="field-row">
	<label><input type="checkbox" class="pc-3d-alpha" data-key="renderer.alpha" <# if ( data.renderer && data.renderer.alpha ) { #>checked<# } #> /> <?php _e( 'Alpha output', 'product-configurator-for-woocommerce' ); ?></label>
</p>
