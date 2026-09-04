<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<div class="pc-3d-setting-group">
	<h4><?php esc_html_e( 'Saved views', 'product-configurator-for-woocommerce' ); ?></h4>
	<p class="description"><?php esc_html_e( 'Store the current preview camera as an angle so the frontend can switch to this view.', 'product-configurator-for-woocommerce' ); ?></p>
	<p class="field-row">
		<label><?php esc_html_e( 'Angle', 'product-configurator-for-woocommerce' ); ?></label>
		<select class="pc-3d-angle-select"></select>
		<button type="button" class="button pc-3d-set-view-to-angle"><?php esc_html_e( 'Set current view to selected angle', 'product-configurator-for-woocommerce' ); ?></button>
	</p>
	<p class="field-row">
		<button type="button" class="button pc-3d-import-gltf-cameras"><?php esc_html_e( 'Import cameras from GLTF', 'product-configurator-for-woocommerce' ); ?></button>
		<span class="description"><?php esc_html_e( 'Add new angles from cameras defined in the main 3D file.', 'product-configurator-for-woocommerce' ); ?></span>
	</p>
</div>
<div class="pc-3d-setting-group">
	<h4><?php esc_html_e( 'Rotation limits', 'product-configurator-for-woocommerce' ); ?></h4>
	<p class="description"><?php esc_html_e( 'Restrict how far the shopper can orbit the camera around the product.', 'product-configurator-for-woocommerce' ); ?></p>
	<p class="field-row">
		<label for="pc-3d-orbit-min-polar"><?php esc_html_e( 'Min vertical angle', 'product-configurator-for-woocommerce' ); ?></label>
		<input type="range" id="pc-3d-orbit-min-polar" class="pc-3d-orbit-min-polar" data-key="environment.orbit_min_polar_angle" min="0" max="180" step="1" value="{{ data.environment && data.environment.orbit_min_polar_angle != null ? data.environment.orbit_min_polar_angle : 0 }}" />
		<span class="pc-3d-value-display pc-3d-orbit-min-polar-value">0</span>
	</p>
	<p class="field-row">
		<label for="pc-3d-orbit-max-polar"><?php esc_html_e( 'Max vertical angle', 'product-configurator-for-woocommerce' ); ?></label>
		<input type="range" id="pc-3d-orbit-max-polar" class="pc-3d-orbit-max-polar" data-key="environment.orbit_max_polar_angle" min="0" max="180" step="1" value="{{ data.environment && data.environment.orbit_max_polar_angle != null ? data.environment.orbit_max_polar_angle : 90 }}" />
		<span class="pc-3d-value-display pc-3d-orbit-max-polar-value">90</span>
	</p>
	<p class="description"><?php esc_html_e( '0° looks straight down, 180° looks straight up. Keep both close to 90° to lock the camera to a level view.', 'product-configurator-for-woocommerce' ); ?></p>
	<p class="field-row">
		<label for="pc-3d-orbit-min-azimuth"><?php esc_html_e( 'Min horizontal angle', 'product-configurator-for-woocommerce' ); ?></label>
		<input type="range" id="pc-3d-orbit-min-azimuth" class="pc-3d-orbit-min-azimuth" data-key="environment.orbit_min_azimuth_angle" min="-180" max="180" step="1" value="{{ data.environment && data.environment.orbit_min_azimuth_angle != null ? data.environment.orbit_min_azimuth_angle : -180 }}" />
		<span class="pc-3d-value-display pc-3d-orbit-min-azimuth-value">-180</span>
	</p>
	<p class="field-row">
		<label for="pc-3d-orbit-max-azimuth"><?php esc_html_e( 'Max horizontal angle', 'product-configurator-for-woocommerce' ); ?></label>
		<input type="range" id="pc-3d-orbit-max-azimuth" class="pc-3d-orbit-max-azimuth" data-key="environment.orbit_max_azimuth_angle" min="-180" max="180" step="1" value="{{ data.environment && data.environment.orbit_max_azimuth_angle != null ? data.environment.orbit_max_azimuth_angle : 180 }}" />
		<span class="pc-3d-value-display pc-3d-orbit-max-azimuth-value">180</span>
	</p>
	<p class="description"><?php esc_html_e( 'Degrees around the product. Leave at -180 / 180 for a full turn.', 'product-configurator-for-woocommerce' ); ?></p>
</div>
<div class="pc-3d-setting-group">
	<h4><?php esc_html_e( 'Zoom limits', 'product-configurator-for-woocommerce' ); ?></h4>
	<p class="field-row">
		<label for="pc-3d-orbit-zoom-limits-enabled">
			<input type="checkbox" id="pc-3d-orbit-zoom-limits-enabled" class="pc-3d-orbit-zoom-limits-enabled" data-key="environment.orbit_zoom_limits_enabled" <# if ( !data.environment || data.environment.orbit_zoom_limits_enabled !== false ) { #>checked<# } #> />
			<?php esc_html_e( 'Restrict how far the shopper can zoom in and out', 'product-configurator-for-woocommerce' ); ?>
		</label>
	</p>
	<p class="field-row">
		<label><?php esc_html_e( 'Closest zoom', 'product-configurator-for-woocommerce' ); ?></label>
		<button type="button" class="button pc-3d-set-min-zoom"><?php esc_html_e( 'Set from current view', 'product-configurator-for-woocommerce' ); ?></button>
		<span class="pc-3d-value-display pc-3d-orbit-min-distance-value"><# if ( data.environment && data.environment.orbit_min_distance != null ) { #>{{ Number( data.environment.orbit_min_distance ).toFixed( 2 ) }}<# } else { #>—<# } #></span>
	</p>
	<p class="field-row">
		<label><?php esc_html_e( 'Farthest zoom', 'product-configurator-for-woocommerce' ); ?></label>
		<button type="button" class="button pc-3d-set-max-zoom"><?php esc_html_e( 'Set from current view', 'product-configurator-for-woocommerce' ); ?></button>
		<span class="pc-3d-value-display pc-3d-orbit-max-distance-value"><# if ( data.environment && data.environment.orbit_max_distance != null ) { #>{{ Number( data.environment.orbit_max_distance ).toFixed( 2 ) }}<# } else { #>—<# } #></span>
	</p>
	<p class="description"><?php esc_html_e( 'Move the preview to the closest or farthest view you want to allow, then click the matching button.', 'product-configurator-for-woocommerce' ); ?></p>
</div>
