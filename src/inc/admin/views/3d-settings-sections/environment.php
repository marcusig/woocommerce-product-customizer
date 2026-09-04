<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<div class="pc-3d-setting-group">
	<h4><?php esc_html_e( 'Environment', 'product-configurator-for-woocommerce' ); ?></h4>
	<p class="description"><?php esc_html_e( 'The environment map controls reflections and image-based lighting. Choose None for unlit or baked-lighting models, a built-in preset, or an environment from the 3D Objects list (type: Environment).', 'product-configurator-for-woocommerce' ); ?></p>
	<p class="field-row">
		<label for="pc-3d-env-source"><?php esc_html_e( 'Environment source', 'product-configurator-for-woocommerce' ); ?></label>
		<select id="pc-3d-env-source" class="pc-3d-env-source">
			<!-- Options populated by JS: None, presets (Outdoor, Studio), then environment objects from objects3d -->
		</select>
	</p>
	<p class="field-row pc-3d-env-map-controls"<# if ( data.environment && data.environment.mode === 'none' ) { #> style="display:none"<# } #>>
		<label for="pc-3d-env-intensity"><?php esc_html_e( 'Environment intensity', 'product-configurator-for-woocommerce' ); ?></label>
		<input type="range" id="pc-3d-env-intensity" class="pc-3d-env-intensity" data-key="environment.intensity" min="0" max="10" step="0.1" value="{{ data.environment && data.environment.intensity != null ? data.environment.intensity : 1 }}" />
		<span class="pc-3d-value-display pc-3d-env-intensity-value">1</span>
	</p>
	<p class="field-row pc-3d-env-map-controls"<# if ( data.environment && data.environment.mode === 'none' ) { #> style="display:none"<# } #>>
		<label for="pc-3d-env-rotation"><?php esc_html_e( 'Environment rotation', 'product-configurator-for-woocommerce' ); ?></label>
		<input type="range" id="pc-3d-env-rotation" class="pc-3d-env-rotation" data-key="environment.rotation" min="0" max="360" step="1" value="{{ data.environment && data.environment.rotation != null ? data.environment.rotation : 0 }}" />
		<span class="pc-3d-value-display pc-3d-env-rotation-value">0</span>
	</p>
	<p class="field-row pc-3d-env-map-controls"<# if ( data.environment && data.environment.mode === 'none' ) { #> style="display:none"<# } #>>
		<label for="pc-3d-env-blur"><?php esc_html_e( 'Environment blur', 'product-configurator-for-woocommerce' ); ?></label>
		<input type="range" id="pc-3d-env-blur" class="pc-3d-env-blur" data-key="environment.blur" min="0" max="1" step="0.01" value="{{ data.environment && data.environment.blur != null ? data.environment.blur : 0 }}" />
		<span class="pc-3d-value-display pc-3d-env-blur-value">0</span>
	</p>
	<p class="description"><?php esc_html_e( 'Softens the lighting and the reflections together. Useful when a detailed environment casts distracting shapes across glossy surfaces. Rotation has less and less effect as this goes up, since it is the sharp reflections that show it.', 'product-configurator-for-woocommerce' ); ?></p>
</div>
