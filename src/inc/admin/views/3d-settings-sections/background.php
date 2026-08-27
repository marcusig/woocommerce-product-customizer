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
