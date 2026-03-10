<p class="description"><?php _e( 'Enable postprocessing effects. On the front-end, each effect is only loaded when enabled here.', 'product-configurator-for-woocommerce' ); ?></p>
<p class="field-row">
	<label><input type="checkbox" class="pc-3d-postprocess" data-key="postprocessing.ssr" <# if ( data.postprocessing && data.postprocessing.ssr ) { #>checked<# } #> /> <?php _e( 'Screen space reflections', 'product-configurator-for-woocommerce' ); ?></label>
</p>
<p class="field-row">
	<label><input type="checkbox" class="pc-3d-postprocess" data-key="postprocessing.ssao" <# if ( data.postprocessing && data.postprocessing.ssao ) { #>checked<# } #> /> <?php _e( 'Ambient occlusion', 'product-configurator-for-woocommerce' ); ?></label>
</p>
<p class="field-row">
	<label><input type="checkbox" class="pc-3d-postprocess" data-key="postprocessing.bloom" <# if ( data.postprocessing && data.postprocessing.bloom ) { #>checked<# } #> /> <?php _e( 'Bloom', 'product-configurator-for-woocommerce' ); ?></label>
</p>
<p class="field-row">
	<label><?php _e( 'Bloom strength', 'product-configurator-for-woocommerce' ); ?></label>
	<input type="range" class="pc-3d-bloom-strength" data-key="postprocessing.bloom_strength" min="0" max="1" step="0.01" value="{{ data.postprocessing && data.postprocessing.bloom_strength != null ? data.postprocessing.bloom_strength : 0.05 }}" />
	<span class="pc-3d-value-display pc-3d-bloom-strength-value">0.05</span>
</p>
<p class="field-row">
	<label><?php _e( 'Bloom radius', 'product-configurator-for-woocommerce' ); ?></label>
	<input type="range" class="pc-3d-bloom-radius" data-key="postprocessing.bloom_radius" min="0" max="1" step="0.01" value="{{ data.postprocessing && data.postprocessing.bloom_radius != null ? data.postprocessing.bloom_radius : 0.04 }}" />
	<span class="pc-3d-value-display pc-3d-bloom-radius-value">0.04</span>
</p>
<p class="field-row">
	<label><?php _e( 'Bloom threshold', 'product-configurator-for-woocommerce' ); ?></label>
	<input type="range" class="pc-3d-bloom-threshold" data-key="postprocessing.bloom_threshold" min="0" max="1" step="0.01" value="{{ data.postprocessing && data.postprocessing.bloom_threshold != null ? data.postprocessing.bloom_threshold : 0.85 }}" />
	<span class="pc-3d-value-display pc-3d-bloom-threshold-value">0.85</span>
</p>
<p class="field-row">
	<label><input type="checkbox" class="pc-3d-postprocess" data-key="postprocessing.smaa" <# if ( data.postprocessing && data.postprocessing.smaa ) { #>checked<# } #> /> <?php _e( 'Anti-aliasing (SMAA)', 'product-configurator-for-woocommerce' ); ?></label>
</p>
