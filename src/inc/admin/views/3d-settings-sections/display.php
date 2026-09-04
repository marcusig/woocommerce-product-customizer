<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
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
	<h4><?php esc_html_e( 'Hidden objects', 'product-configurator-for-woocommerce' ); ?></h4>
	<p class="description"><?php esc_html_e( 'Objects with these names are automatically hidden in the viewer. Default names (e.g. product_bounding_box, material_placeholders) are always hidden; add more below, one per line.', 'product-configurator-for-woocommerce' ); ?></p>
	<p class="field-row">
		<label for="pc-3d-hidden-object-names"><?php esc_html_e( 'Custom hidden object names', 'product-configurator-for-woocommerce' ); ?></label>
		<textarea id="pc-3d-hidden-object-names" class="pc-3d-hidden-object-names" data-key="hidden_object_names" rows="3" placeholder="<?php esc_attr_e( 'One object name per line', 'product-configurator-for-woocommerce' ); ?>"><# if ( data.hidden_object_names != null && data.hidden_object_names !== undefined ) { #>{{ data.hidden_object_names }}<# } #></textarea>
	</p>
</div>
