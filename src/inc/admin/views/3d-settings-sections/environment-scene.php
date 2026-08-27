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
	<h4><?php esc_html_e( 'Shadow', 'product-configurator-for-woocommerce' ); ?></h4>
	<p class="field-row">
		<label for="pc-3d-shadow-mode"><?php esc_html_e( 'Shadow type', 'product-configurator-for-woocommerce' ); ?></label>
		<#
			// Same fallback as resolveShadowMode() in 3d-scene-utils.js, for products
			// saved while the two checkboxes were still separate settings.
			var mkl_pc_ground = data.ground || {};
			var mkl_pc_mode = mkl_pc_ground.shadow_mode;
			if ( mkl_pc_mode !== 'none' && mkl_pc_mode !== 'fake' && mkl_pc_mode !== 'realtime' ) {
				mkl_pc_mode = data.enable_shadows
					? 'realtime'
					: ( mkl_pc_ground.enabled === false ? 'none' : 'fake' );
			}
		#>
		<select id="pc-3d-shadow-mode" class="pc-3d-shadow-mode" data-key="ground.shadow_mode">
			<?php
			$mkl_pc_shadow_modes = array(
				'none'     => __( 'No shadow', 'product-configurator-for-woocommerce' ),
				'fake'     => __( 'Fake shadow', 'product-configurator-for-woocommerce' ),
				'realtime' => __( 'Real-time shadows', 'product-configurator-for-woocommerce' ),
			);
			foreach ( $mkl_pc_shadow_modes as $mkl_pc_mode => $mkl_pc_label ) :
				?>
				<option value="<?php echo esc_attr( $mkl_pc_mode ); ?>" <# if ( mkl_pc_mode === '<?php echo esc_js( $mkl_pc_mode ); ?>' ) { #>selected<# } #>><?php echo esc_html( $mkl_pc_label ); ?></option>
			<?php endforeach; ?>
		</select>
	</p>
	<p class="description"><?php esc_html_e( 'Fake shadow is a soft blob rendered under the product — cheap, and enough for most products. Real-time shadows are cast by the lights in the scene, and cost more to draw.', 'product-configurator-for-woocommerce' ); ?></p>

	<div class="pc-3d-shadow-settings" data-shadow-modes="fake realtime">
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

	<div class="pc-3d-shadow-settings" data-shadow-modes="fake">
		<p class="field-row">
			<label for="pc-3d-shadow-general"><?php esc_html_e( 'Soft shadow', 'product-configurator-for-woocommerce' ); ?></label>
			<input type="range" id="pc-3d-shadow-general" class="pc-3d-shadow-general" data-key="ground.shadow_general" min="0" max="1" step="0.05" value="{{ data.ground && data.ground.shadow_general != null ? data.ground.shadow_general : 1 }}" />
			<span class="pc-3d-value-display pc-3d-shadow-general-value">1</span>
		</p>
		<p class="description"><?php esc_html_e( 'The broad shadow cast by the product as a whole. This carries most of the weight.', 'product-configurator-for-woocommerce' ); ?></p>
		<p class="field-row">
			<label for="pc-3d-shadow-contact"><?php esc_html_e( 'Contact shadow', 'product-configurator-for-woocommerce' ); ?></label>
			<input type="range" id="pc-3d-shadow-contact" class="pc-3d-shadow-contact" data-key="ground.shadow_contact" min="0" max="1" step="0.05" value="{{ data.ground && data.ground.shadow_contact != null ? data.ground.shadow_contact : 1 }}" />
			<span class="pc-3d-value-display pc-3d-shadow-contact-value">1</span>
		</p>
		<p class="description"><?php esc_html_e( 'The tight darkening where the product meets the ground. Set to 0 for a product that should read as floating.', 'product-configurator-for-woocommerce' ); ?></p>
		<p class="field-row">
			<label for="pc-3d-shadow-offset"><?php esc_html_e( 'Vertical offset', 'product-configurator-for-woocommerce' ); ?></label>
			<input type="number" id="pc-3d-shadow-offset" class="pc-3d-shadow-offset" data-key="ground.shadow_offset" step="0.01" value="{{ data.ground && data.ground.shadow_offset != null ? data.ground.shadow_offset : 0 }}" />
		</p>
		<p class="description"><?php esc_html_e( 'The shadow sits at the lowest point of the product. Use a negative value to drop it to the floor below a product that hovers.', 'product-configurator-for-woocommerce' ); ?></p>
	</div>

	<div class="pc-3d-shadow-settings" data-shadow-modes="realtime">
		<p class="field-row">
			<label for="pc-3d-shadow-light">
				<input type="checkbox" id="pc-3d-shadow-light" class="pc-3d-shadow-light" data-key="ground.shadow_light" <# if ( !data.ground || data.ground.shadow_light !== false ) { #>checked<# } #> />
				<?php esc_html_e( 'Use a dedicated shadow light', 'product-configurator-for-woocommerce' ); ?>
			</label>
		</p>
		<p class="description"><?php esc_html_e( 'A light that casts the shadow without lighting the product, so the shadow can fall where you want it whatever is lighting the scene. Turn it off to cast from the product\'s own lights instead.', 'product-configurator-for-woocommerce' ); ?></p>
		<div class="pc-3d-shadow-light-settings">
			<p class="field-row">
				<label for="pc-3d-shadow-elevation"><?php esc_html_e( 'Shadow elevation', 'product-configurator-for-woocommerce' ); ?></label>
				<input type="range" id="pc-3d-shadow-elevation" class="pc-3d-shadow-elevation" data-key="ground.shadow_elevation" min="5" max="90" step="1" value="{{ data.ground && data.ground.shadow_elevation != null ? data.ground.shadow_elevation : 55 }}" />
				<span class="pc-3d-value-display pc-3d-shadow-elevation-value">55</span>
			</p>
			<p class="description"><?php esc_html_e( 'Degrees above the horizon. Low angles throw the shadow out to one side; overhead tucks it under the product.', 'product-configurator-for-woocommerce' ); ?></p>
			<p class="field-row">
				<label for="pc-3d-shadow-azimuth"><?php esc_html_e( 'Shadow direction', 'product-configurator-for-woocommerce' ); ?></label>
				<input type="range" id="pc-3d-shadow-azimuth" class="pc-3d-shadow-azimuth" data-key="ground.shadow_azimuth" min="-180" max="180" step="1" value="{{ data.ground && data.ground.shadow_azimuth != null ? data.ground.shadow_azimuth : 135 }}" />
				<span class="pc-3d-value-display pc-3d-shadow-azimuth-value">135</span>
			</p>
			<p class="description"><?php esc_html_e( 'Degrees around the product, deciding which way the shadow falls.', 'product-configurator-for-woocommerce' ); ?></p>
		</div>
		<p class="pc-3d-shadow-light-warning notice notice-warning inline" style="display:none;">
			<?php esc_html_e( 'Nothing is casting a shadow. The dedicated shadow light is off, and none of this product\'s lights are set to cast shadows — add a light and enable "Cast shadows" on it, or switch the dedicated light back on.', 'product-configurator-for-woocommerce' ); ?>
		</p>
		<p class="field-row">
			<label for="pc-3d-shadow-catcher">
				<input type="checkbox" id="pc-3d-shadow-catcher" class="pc-3d-shadow-catcher" data-key="ground.shadow_catcher" <# if ( data.ground && data.ground.shadow_catcher === true ) { #>checked<# } #> />
				<?php esc_html_e( 'Add a ground plane', 'product-configurator-for-woocommerce' ); ?>
			</label>
		</p>
		<p class="description"><?php esc_html_e( 'An invisible surface under the product for the shadow to fall on. It sizes itself to whatever the shadow needs, including the long shadow a low angle throws. Turn it off for a product modelled with its own base, which already has somewhere to catch the shadow.', 'product-configurator-for-woocommerce' ); ?></p>
	</div>
</div>
<div class="pc-3d-setting-group">
	<h4><?php esc_html_e( 'Hidden objects', 'product-configurator-for-woocommerce' ); ?></h4>
	<p class="description"><?php esc_html_e( 'Objects with these names are automatically hidden in the viewer. Default names (e.g. product_bounding_box, material_placeholders) are always hidden; add more below, one per line.', 'product-configurator-for-woocommerce' ); ?></p>
	<p class="field-row">
		<label for="pc-3d-hidden-object-names"><?php esc_html_e( 'Custom hidden object names', 'product-configurator-for-woocommerce' ); ?></label>
		<textarea id="pc-3d-hidden-object-names" class="pc-3d-hidden-object-names" data-key="hidden_object_names" rows="3" placeholder="<?php esc_attr_e( 'One object name per line', 'product-configurator-for-woocommerce' ); ?>"><# if ( data.hidden_object_names != null && data.hidden_object_names !== undefined ) { #>{{ data.hidden_object_names }}<# } #></textarea>
	</p>
</div>
