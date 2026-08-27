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
