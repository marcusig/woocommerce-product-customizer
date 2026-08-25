<div class="pc-3d-setting-group">
	<h4><?php esc_html_e( 'Loading poster', 'product-configurator-for-woocommerce' ); ?></h4>
	<p class="description"><?php esc_html_e( 'Optional image shown while the 3D viewer loads. It fades out once the model is ready.', 'product-configurator-for-woocommerce' ); ?></p>
	<p class="field-row">
		<label><?php esc_html_e( 'Poster image', 'product-configurator-for-woocommerce' ); ?></label>
		<div class="mkl-pc-setting--container mkl-pc-setting--file pc-3d-poster-file" data-allowed-types="image" data-setting="poster">
			<# if ( data.poster && data.poster.url ) { #>
				<div class="mkl-pc-setting--file-preview"><img src="{{ data.poster.url }}" alt="" style="max-width:120px;max-height:80px;display:block;"></div>
				<button type="button" class="button pc-3d-poster-remove"><?php esc_html_e( 'Remove', 'product-configurator-for-woocommerce' ); ?></button>
			<# } #>
			<button type="button" class="button pc-3d-poster-select">
				<# if ( data.poster && data.poster.attachment_id ) { #>
					<?php esc_html_e( 'Replace image', 'product-configurator-for-woocommerce' ); ?>
				<# } else { #>
					<?php esc_html_e( 'Select image', 'product-configurator-for-woocommerce' ); ?>
				<# } #>
			</button>
		</div>
	</p>
</div>
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
<div class="pc-3d-setting-group">
	<h4><?php esc_html_e( 'Orbit controls', 'product-configurator-for-woocommerce' ); ?></h4>
	<p class="description"><?php esc_html_e( 'Control how far the camera can move around the model on the frontend.', 'product-configurator-for-woocommerce' ); ?></p>
	<p class="field-row">
		<label for="pc-3d-orbit-min-polar"><?php esc_html_e( 'Min polar angle (degrees)', 'product-configurator-for-woocommerce' ); ?></label>
		<input type="number" id="pc-3d-orbit-min-polar" class="pc-3d-orbit-min-polar" data-key="environment.orbit_min_polar_angle" min="0" max="180" step="1" value="{{ data.environment && data.environment.orbit_min_polar_angle != null ? data.environment.orbit_min_polar_angle : 0 }}" />
		<span class="description"><?php esc_html_e( '0 = from above, 90 = horizon.', 'product-configurator-for-woocommerce' ); ?></span>
	</p>
	<p class="field-row">
		<label for="pc-3d-orbit-max-polar"><?php esc_html_e( 'Max polar angle (degrees)', 'product-configurator-for-woocommerce' ); ?></label>
		<input type="number" id="pc-3d-orbit-max-polar" class="pc-3d-orbit-max-polar" data-key="environment.orbit_max_polar_angle" min="0" max="180" step="1" value="{{ data.environment && data.environment.orbit_max_polar_angle != null ? data.environment.orbit_max_polar_angle : 90 }}" />
		<span class="description"><?php esc_html_e( '90 = horizon (no view from below), 180 = allow from below.', 'product-configurator-for-woocommerce' ); ?></span>
	</p>
	<p class="field-row">
		<label for="pc-3d-orbit-min-azimuth"><?php esc_html_e( 'Min azimuth angle (degrees)', 'product-configurator-for-woocommerce' ); ?></label>
		<input type="number" id="pc-3d-orbit-min-azimuth" class="pc-3d-orbit-min-azimuth" data-key="environment.orbit_min_azimuth_angle" min="-180" max="180" step="1" value="{{ data.environment && data.environment.orbit_min_azimuth_angle != null ? data.environment.orbit_min_azimuth_angle : -180 }}" />
		<span class="description"><?php esc_html_e( 'Horizontal orbit limit (left). -180 to 180 = no limit.', 'product-configurator-for-woocommerce' ); ?></span>
	</p>
	<p class="field-row">
		<label for="pc-3d-orbit-max-azimuth"><?php esc_html_e( 'Max azimuth angle (degrees)', 'product-configurator-for-woocommerce' ); ?></label>
		<input type="number" id="pc-3d-orbit-max-azimuth" class="pc-3d-orbit-max-azimuth" data-key="environment.orbit_max_azimuth_angle" min="-180" max="180" step="1" value="{{ data.environment && data.environment.orbit_max_azimuth_angle != null ? data.environment.orbit_max_azimuth_angle : 180 }}" />
		<span class="description"><?php esc_html_e( 'Horizontal orbit limit (right). -180 to 180 = no limit.', 'product-configurator-for-woocommerce' ); ?></span>
	</p>
	<p class="description"><?php esc_html_e( 'Limit how close or far the camera can zoom (distance to target).', 'product-configurator-for-woocommerce' ); ?></p>
	<p class="field-row">
		<label for="pc-3d-orbit-zoom-limits-enabled">
			<input type="checkbox" id="pc-3d-orbit-zoom-limits-enabled" class="pc-3d-orbit-zoom-limits-enabled" data-key="environment.orbit_zoom_limits_enabled" <# if ( data.environment && data.environment.orbit_zoom_limits_enabled !== false ) { #>checked<# } #> />
			<?php esc_html_e( 'Apply zoom limits in preview', 'product-configurator-for-woocommerce' ); ?>
		</label>
		<span class="description"><?php esc_html_e( 'When off, limits are not applied here so you can move freely to set new limits with the buttons below. Frontend always uses saved limits.', 'product-configurator-for-woocommerce' ); ?></span>
	</p>
	<p class="field-row">
		<button type="button" class="button pc-3d-set-min-zoom"><?php esc_html_e( 'Set current view as minimum zoom', 'product-configurator-for-woocommerce' ); ?></button>
		<span class="description"><?php esc_html_e( 'User cannot zoom in closer than the current distance.', 'product-configurator-for-woocommerce' ); ?></span>
	</p>
	<p class="field-row">
		<button type="button" class="button pc-3d-set-max-zoom"><?php esc_html_e( 'Set current view as maximum zoom', 'product-configurator-for-woocommerce' ); ?></button>
		<span class="description"><?php esc_html_e( 'User cannot zoom out further than the current distance.', 'product-configurator-for-woocommerce' ); ?></span>
	</p>
</div>
<div class="pc-3d-setting-group">
	<h4><?php esc_html_e( 'Background', 'product-configurator-for-woocommerce' ); ?></h4>
	<p class="field-row">
		<label for="pc-3d-bg-mode"><?php esc_html_e( 'Background mode', 'product-configurator-for-woocommerce' ); ?></label>
		<select id="pc-3d-bg-mode" class="pc-3d-bg-mode" data-key="background.mode">
			<option value="transparent" <# if ( ! data.background || data.background.mode !== 'solid' ) { #>selected<# } #>><?php esc_html_e( 'Transparent', 'product-configurator-for-woocommerce' ); ?></option>
			<option value="solid" <# if ( data.background && data.background.mode === 'solid' ) { #>selected<# } #>><?php esc_html_e( 'Solid color', 'product-configurator-for-woocommerce' ); ?></option>
		</select>
	</p>
	<p class="field-row pc-3d-bg-color-row" style="display:none;">
		<label for="pc-3d-bg-color"><?php esc_html_e( 'Background color', 'product-configurator-for-woocommerce' ); ?></label>
		<input type="color" id="pc-3d-bg-color" class="pc-3d-bg-color" data-key="background.color" value="{{ data.background && data.background.color ? data.background.color : '#ffffff' }}" />
	</p>
</div>
<?php if ( mkl_pc( 'themes' )->current_theme_supports( 'extend_under_toolbar' ) ) : ?>
<div class="pc-3d-setting-group">
	<h4><?php esc_html_e( 'Layout', 'product-configurator-for-woocommerce' ); ?></h4>
	<p class="description"><?php esc_html_e( 'Stretch the 3D canvas under the toolbar so environment backgrounds fill the configurator. The product stays framed beside the menu; themes choose which side is offset.', 'product-configurator-for-woocommerce' ); ?></p>
	<p class="field-row">
		<label for="pc-3d-extend-under-toolbar">
			<input type="checkbox" id="pc-3d-extend-under-toolbar" class="pc-3d-extend-under-toolbar" data-key="extend_under_toolbar" <# if ( data.extend_under_toolbar ) { #>checked<# } #> />
			<?php esc_html_e( 'Extend viewer under toolbar', 'product-configurator-for-woocommerce' ); ?>
		</label>
	</p>
</div>
<?php endif; ?>
<div class="pc-3d-setting-group">
	<h4><?php esc_html_e( 'Ground / Fake shadow', 'product-configurator-for-woocommerce' ); ?></h4>
	<div class="pc-3d-field-group">
		<p class="field-row">
			<label for="pc-3d-ground-enabled">
				<input type="checkbox" id="pc-3d-ground-enabled" class="pc-3d-ground-enabled pc-3d-field-group__control" data-key="ground.enabled" <# if ( data.ground && data.ground.enabled !== false ) { #>checked<# } #> />
				<?php esc_html_e( 'Enable fake shadow', 'product-configurator-for-woocommerce' ); ?>
			</label>
		</p>
		<p class="description pc-3d-field-group__hint"><?php esc_html_e( 'A soft shadow blob under the product. Cheap, and works without real-time shadows.', 'product-configurator-for-woocommerce' ); ?></p>
		<div class="pc-3d-field-group__body">
			<p class="field-row">
				<label for="pc-3d-ground-size"><?php esc_html_e( 'Ground size', 'product-configurator-for-woocommerce' ); ?></label>
				<input type="number" id="pc-3d-ground-size" class="pc-3d-ground-size" data-key="ground.size" min="1" max="100" step="1" value="{{ data.ground && data.ground.size != null ? data.ground.size : 10 }}" />
			</p>
			<p class="field-row">
				<label for="pc-3d-shadow-opacity"><?php esc_html_e( 'Shadow opacity', 'product-configurator-for-woocommerce' ); ?></label>
				<input type="range" id="pc-3d-shadow-opacity" class="pc-3d-shadow-opacity" data-key="ground.shadow_opacity" min="0" max="1" step="0.05" value="{{ data.ground && data.ground.shadow_opacity != null ? data.ground.shadow_opacity : 0.5 }}" />
				<span class="pc-3d-value-display pc-3d-shadow-opacity-value">0.5</span>
			</p>
			<p class="field-row">
				<label for="pc-3d-shadow-blur"><?php esc_html_e( 'Shadow blur / softness', 'product-configurator-for-woocommerce' ); ?></label>
				<input type="range" id="pc-3d-shadow-blur" class="pc-3d-shadow-blur" data-key="ground.shadow_blur" min="0" max="10" step="0.5" value="{{ data.ground && data.ground.shadow_blur != null ? data.ground.shadow_blur : 0 }}" />
				<span class="pc-3d-value-display pc-3d-shadow-blur-value">0</span>
			</p>
		</div>
	</div>
	<p class="field-row">
		<label for="pc-3d-enable-shadows">
			<input type="checkbox" id="pc-3d-enable-shadows" class="pc-3d-enable-shadows" data-key="enable_shadows" <# if ( data.enable_shadows ) { #>checked<# } #> />
			<?php esc_html_e( 'Enable real-time shadows', 'product-configurator-for-woocommerce' ); ?>
		</label>
	</p>
</div>
<div class="pc-3d-setting-group">
	<h4><?php esc_html_e( 'Hidden objects', 'product-configurator-for-woocommerce' ); ?></h4>
	<p class="description"><?php esc_html_e( 'Objects with these names are automatically hidden in the viewer. Default names (e.g. product_bounding_box, material_placeholders) are always hidden; add more below, one per line.', 'product-configurator-for-woocommerce' ); ?></p>
	<p class="field-row">
		<label for="pc-3d-hidden-object-names"><?php esc_html_e( 'Custom hidden object names', 'product-configurator-for-woocommerce' ); ?></label>
		<textarea id="pc-3d-hidden-object-names" class="pc-3d-hidden-object-names" data-key="hidden_object_names" rows="3" placeholder="<?php esc_attr_e( 'One object name per line', 'product-configurator-for-woocommerce' ); ?>"><# if ( data.hidden_object_names != null && data.hidden_object_names !== undefined ) { #>{{ data.hidden_object_names }}<# } #></textarea>
	</p>
</div>
