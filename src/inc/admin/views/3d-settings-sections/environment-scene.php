<div class="pc-3d-setting-group">
	<h4><?php _e( 'Environment', 'product-configurator-for-woocommerce' ); ?></h4>
	<p class="description"><?php _e( 'The environment map controls reflections and lighting. Choose a built-in preset or an environment from the 3D Objects list (type: Environment).', 'product-configurator-for-woocommerce' ); ?></p>
	<p class="field-row">
		<label><?php _e( 'Environment source', 'product-configurator-for-woocommerce' ); ?></label>
		<select class="pc-3d-env-source">
			<!-- Options populated by JS: presets (Outdoor, Studio) then environment objects from objects3d -->
		</select>
	</p>
	<p class="field-row">
		<label><?php _e( 'Environment intensity', 'product-configurator-for-woocommerce' ); ?></label>
		<input type="range" class="pc-3d-env-intensity" data-key="environment.intensity" min="0" max="10" step="0.1" value="{{ data.environment && data.environment.intensity != null ? data.environment.intensity : 1 }}" />
		<span class="pc-3d-value-display pc-3d-env-intensity-value">1</span>
	</p>
	<p class="field-row">
		<label><?php _e( 'Environment rotation', 'product-configurator-for-woocommerce' ); ?></label>
		<input type="range" class="pc-3d-env-rotation" data-key="environment.rotation" min="0" max="360" step="1" value="{{ data.environment && data.environment.rotation != null ? data.environment.rotation : 0 }}" />
		<span class="pc-3d-value-display pc-3d-env-rotation-value">0</span>
	</p>
</div>
<div class="pc-3d-setting-group">
	<h4><?php _e( 'Orbit controls', 'product-configurator-for-woocommerce' ); ?></h4>
	<p class="description"><?php _e( 'Control how far the camera can move around the model on the frontend.', 'product-configurator-for-woocommerce' ); ?></p>
	<p class="field-row">
		<label><?php _e( 'Min polar angle (degrees)', 'product-configurator-for-woocommerce' ); ?></label>
		<input type="number" class="pc-3d-orbit-min-polar" data-key="environment.orbit_min_polar_angle" min="0" max="180" step="1" value="{{ data.environment && data.environment.orbit_min_polar_angle != null ? data.environment.orbit_min_polar_angle : 0 }}" />
		<span class="description"><?php _e( '0 = from above, 90 = horizon.', 'product-configurator-for-woocommerce' ); ?></span>
	</p>
	<p class="field-row">
		<label><?php _e( 'Max polar angle (degrees)', 'product-configurator-for-woocommerce' ); ?></label>
		<input type="number" class="pc-3d-orbit-max-polar" data-key="environment.orbit_max_polar_angle" min="0" max="180" step="1" value="{{ data.environment && data.environment.orbit_max_polar_angle != null ? data.environment.orbit_max_polar_angle : 90 }}" />
		<span class="description"><?php _e( '90 = horizon (no view from below), 180 = allow from below.', 'product-configurator-for-woocommerce' ); ?></span>
	</p>
	<p class="field-row">
		<label><?php _e( 'Min azimuth angle (degrees)', 'product-configurator-for-woocommerce' ); ?></label>
		<input type="number" class="pc-3d-orbit-min-azimuth" data-key="environment.orbit_min_azimuth_angle" min="-180" max="180" step="1" value="{{ data.environment && data.environment.orbit_min_azimuth_angle != null ? data.environment.orbit_min_azimuth_angle : -180 }}" />
		<span class="description"><?php _e( 'Horizontal orbit limit (left). -180 to 180 = no limit.', 'product-configurator-for-woocommerce' ); ?></span>
	</p>
	<p class="field-row">
		<label><?php _e( 'Max azimuth angle (degrees)', 'product-configurator-for-woocommerce' ); ?></label>
		<input type="number" class="pc-3d-orbit-max-azimuth" data-key="environment.orbit_max_azimuth_angle" min="-180" max="180" step="1" value="{{ data.environment && data.environment.orbit_max_azimuth_angle != null ? data.environment.orbit_max_azimuth_angle : 180 }}" />
		<span class="description"><?php _e( 'Horizontal orbit limit (right). -180 to 180 = no limit.', 'product-configurator-for-woocommerce' ); ?></span>
	</p>
	<p class="description"><?php _e( 'Limit how close or far the camera can zoom (distance to target).', 'product-configurator-for-woocommerce' ); ?></p>
	<p class="field-row">
		<label>
			<input type="checkbox" class="pc-3d-orbit-zoom-limits-enabled" data-key="environment.orbit_zoom_limits_enabled" <# if ( data.environment && data.environment.orbit_zoom_limits_enabled !== false ) { #>checked<# } #> />
			<?php _e( 'Apply zoom limits in preview', 'product-configurator-for-woocommerce' ); ?>
		</label>
		<span class="description"><?php _e( 'When off, limits are not applied here so you can move freely to set new limits with the buttons below. Frontend always uses saved limits.', 'product-configurator-for-woocommerce' ); ?></span>
	</p>
	<p class="field-row">
		<button type="button" class="button pc-3d-set-min-zoom"><?php _e( 'Set current view as minimum zoom', 'product-configurator-for-woocommerce' ); ?></button>
		<span class="description"><?php _e( 'User cannot zoom in closer than the current distance.', 'product-configurator-for-woocommerce' ); ?></span>
	</p>
	<p class="field-row">
		<button type="button" class="button pc-3d-set-max-zoom"><?php _e( 'Set current view as maximum zoom', 'product-configurator-for-woocommerce' ); ?></button>
		<span class="description"><?php _e( 'User cannot zoom out further than the current distance.', 'product-configurator-for-woocommerce' ); ?></span>
	</p>
</div>
<div class="pc-3d-setting-group">
	<h4><?php _e( 'Background', 'product-configurator-for-woocommerce' ); ?></h4>
	<p class="field-row">
		<label><?php _e( 'Background mode', 'product-configurator-for-woocommerce' ); ?></label>
		<select class="pc-3d-bg-mode" data-key="background.mode">
			<option value="transparent" <# if ( data.background && data.background.mode === 'transparent' ) { #>selected<# } #>><?php _e( 'Transparent', 'product-configurator-for-woocommerce' ); ?></option>
			<option value="environment" <# if ( data.background && data.background.mode === 'environment' ) { #>selected<# } #>><?php _e( 'Environment', 'product-configurator-for-woocommerce' ); ?></option>
			<option value="solid" <# if ( data.background && data.background.mode === 'solid' ) { #>selected<# } #>><?php _e( 'Solid color', 'product-configurator-for-woocommerce' ); ?></option>
		</select>
	</p>
	<p class="field-row pc-3d-bg-color-row" style="display:none;">
		<label><?php _e( 'Background color', 'product-configurator-for-woocommerce' ); ?></label>
		<input type="color" class="pc-3d-bg-color" data-key="background.color" value="{{ data.background && data.background.color ? data.background.color : '#ffffff' }}" />
	</p>
</div>
<div class="pc-3d-setting-group">
	<h4><?php _e( 'Ground / Fake shadow', 'product-configurator-for-woocommerce' ); ?></h4>
	<p class="field-row">
		<label><input type="checkbox" class="pc-3d-ground-enabled" data-key="ground.enabled" <# if ( data.ground && data.ground.enabled !== false ) { #>checked<# } #> /> <?php _e( 'Enable fake shadow', 'product-configurator-for-woocommerce' ); ?></label>
	</p>
	<p class="field-row">
		<label><?php _e( 'Ground size', 'product-configurator-for-woocommerce' ); ?></label>
		<input type="number" class="pc-3d-ground-size" data-key="ground.size" min="1" max="100" step="1" value="{{ data.ground && data.ground.size != null ? data.ground.size : 10 }}" />
	</p>
	<p class="field-row">
		<label><?php _e( 'Shadow opacity', 'product-configurator-for-woocommerce' ); ?></label>
		<input type="range" class="pc-3d-shadow-opacity" data-key="ground.shadow_opacity" min="0" max="1" step="0.05" value="{{ data.ground && data.ground.shadow_opacity != null ? data.ground.shadow_opacity : 0.5 }}" />
		<span class="pc-3d-value-display pc-3d-shadow-opacity-value">0.5</span>
	</p>
	<p class="field-row">
		<label><?php _e( 'Shadow blur / softness', 'product-configurator-for-woocommerce' ); ?></label>
		<input type="range" class="pc-3d-shadow-blur" data-key="ground.shadow_blur" min="0" max="10" step="0.5" value="{{ data.ground && data.ground.shadow_blur != null ? data.ground.shadow_blur : 0 }}" />
		<span class="pc-3d-value-display pc-3d-shadow-blur-value">0</span>
	</p>
	<p class="field-row">
		<label><input type="checkbox" class="pc-3d-enable-shadows" data-key="enable_shadows" <# if ( data.enable_shadows ) { #>checked<# } #> /> <?php _e( 'Enable real-time shadows', 'product-configurator-for-woocommerce' ); ?></label>
	</p>
</div>
<div class="pc-3d-setting-group">
	<h4><?php _e( 'Hidden objects', 'product-configurator-for-woocommerce' ); ?></h4>
	<p class="description"><?php _e( 'Objects with these names are automatically hidden in the viewer. Default names (e.g. product_bounding_box, material_placeholders) are always hidden; add more below, one per line.', 'product-configurator-for-woocommerce' ); ?></p>
	<p class="field-row">
		<label><?php _e( 'Custom hidden object names', 'product-configurator-for-woocommerce' ); ?></label>
		<textarea class="pc-3d-hidden-object-names" data-key="hidden_object_names" rows="3" placeholder="<?php esc_attr_e( 'One object name per line', 'product-configurator-for-woocommerce' ); ?>"><# if ( data.hidden_object_names != null && data.hidden_object_names !== undefined ) { #>{{ data.hidden_object_names }}<# } #></textarea>
	</p>
</div>
