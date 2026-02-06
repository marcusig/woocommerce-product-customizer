<?php 
global $is_IE;
$class = 'media-modal wp-core-ui pc-modal';
if ( $is_IE && strpos($_SERVER['HTTP_USER_AGENT'], 'MSIE 7') !== false )
	$class .= ' ie7';

function mkl_pc_get_admin_actions() {
	return '<div class="actions-container">
		<button type="button" class="button-link delete delete-item" data-delete="prompt">' . __('Delete', 'product-configurator-for-woocommerce' ) . '</button>' .
		'<button type="button" class="button-link duplicate duplicate-item">' . __('Duplicate', 'product-configurator-for-woocommerce' ) . '</button>' .
		'<button type="button" class="button-link copy copy-item">' . __('Copy', 'product-configurator-for-woocommerce' ) . '</button>' .
		'<div class="prompt-delete hidden mkl-pc-setting--warning">' .
			'<p>' . __( 'Do you realy want to delete this item?', 'product-configurator-for-woocommerce' ) . '</p>' .
			'<p>' .
				'<button type="button" class="button button-primary delete confirm-delete" data-delete="confirm">' . __('Delete', 'product-configurator-for-woocommerce' ) . '</button>' .
				'<button type="button" class="button cancel-delete" data-delete="cancel">' . __('Cancel', 'product-configurator-for-woocommerce' ) . '</button>' .
			'</p>' .
		'</div>' .
	'</div>';
}
?>
<?php 
/*

GENERAL TEMPLATES

*/
 ?>
<?php do_action('mkl_pc_admin_templates_before') ?>
<script type="text/html" id="tmpl-mkl-modal">
	<div class="<?php echo $class; ?>">
		<button type="button" class="media-modal-close"><span class="media-modal-icon"><span class="screen-reader-text"><?php _e( 'Close media panel' ); ?></span></span></button>
		<div class="media-modal-content">
			<div class="media-frame wp-core-ui">
				
			</div>
		</div>
		<div class="loading-screen">
			<span class="spinner"></span>
		</div>
		<div class="notice-container"></div>
	</div>
	<div class="media-modal-backdrop pc-modal-backdrop"></div>
</script>

<script type="text/html" id="tmpl-mkl-pc-menu">	
	<h2 class="media-frame-menu-heading"><?php _e( 'Actions' ); ?></h2>
	<div class="media-frame-menu">
		<div role="tablist" aria-orientation="vertical" class="media-menu">
			<div class="loading-placeholder"></div>
			<div class="loading-placeholder"></div>
			<div class="loading-placeholder"></div>
			<div class="separator"></div>
			<div class="loading-placeholder"></div>
		</div>
	</div>
</script>

<script type="text/html" id="tmpl-mkl-pc-frame-title">
	<div class="media-frame-title">
		<h1>{{data.title}}</h1>
		<button type="button" class="button button-link media-frame-menu-toggle" aria-expanded="false">
			<?php _e( 'Menu' ); ?> <span class="dashicons dashicons-arrow-down" aria-hidden="true" aria-expanded="true"></span>
		</button>
		<span class="description">{{data.description}}</span>
	</div>
</script>

<script type="text/html" id="tmpl-mkl-pc-toolbar">
	<div class="media-frame-toolbar">
		<div class="media-toolbar">
			<div class="media-toolbar-primary">
				<span class="spinner"></span><span class="saved-message"><?php _e('Saved') ?></span>
			</div>
		</div>
	</div>
</script>

<script type="text/html" id="tmpl-mkl-pc-frame-title-buttons-notused">
	<div class="button-group media-button-group">
		<button type="button" class="button media-button button-large pc-main-cancel"><?php _e( 'Cancel' ); ?></button>
		<button type="button" class="button media-button button-primary button-large pc-main-save-all"><?php _e( 'Save', 'product-configurator-for-woocommerce' ); ?></button>
	</div>
</script>
<?php 
/*

STRUCTURE / VIEWS TEMPLATES (They will share the same views, using different models.)

*/
 ?>

<script type="text/html" id="tmpl-mkl-pc-structure">
	<div class="media-frame-content structure">
		<div class="structure-content has-toolbar <# if ( data.collectionName && 'layers' == data.collectionName ) { #> has-bottom-toolbar<# } #>">
			<div class="structure-toolbar">
				<h4><input type="text" placeholder="{{data.input_placeholder}}"></h4>
				<button type="button" class="button-primary add-layer"><span><?php _e( 'Add' ); ?></span></button>
			</div>
			<div class="mkl-list layers ui-sortable sortable-list">
			</div>
			<div class="floating-add">
				<button class="mkl-floating-add-item">
					<i class="dashicons dashicons-plus-alt2"></i>
					<span class="screen-reader-text"><?php _e( 'Add item here' ); ?></span>
				</button>
			</div>
			<# if ( data.collectionName && 'layers' == data.collectionName ) { #>
				<div class="order-toolbar">
					<div class="button-group media-button-group">
						<button data-order_type="order" type="button" class="button button-primary order-layers"><span><?php _e( 'Reorder the menu' ); ?></span></button>
						<button data-order_type="image_order" type="button" class="button order-layers"><span><?php _e( 'Reorder the images' ); ?></span></button>
					</div>
				</div>
			<# } #>
		</div>
		<div class="pc-sidebar visible">
		</div>
	</div>
</script>
<script type="text/html" id="tmpl-mkl-pc-home">
	<div class="media-frame-content home">
		<div class="tab_content">
		<?php do_action( 'mkl_pc_admin_home_tab' ); ?>
		</div>
	</div>
</script>

<?php if ( ! class_exists( 'MKL_PC_Conditional_Logic_Admin' ) ) : ?>
<script type="text/html" id="tmpl-mkl-pc-conditional-placeholder">
	<div class="media-frame-content conditional">
		<div class="tab_content">
			<p><?php printf( _x( '%s is available as %san add-on%s.', 'First placeholder is the add-on name, second and third are the link tags to the add-on', 'product-configurator-for-woocommerce' ), __( 'Conditional logic', 'product-configurator-for-woocommerce' ), '<a href="https://wc-product-configurator.com/product/conditional-logic/" target="_blank" class="mkl-pc-link--external">', '</a>' ); ?></p>
			<p><?php _e( 'Create complex configurations with the ability, among others, to show, hide or select items depending on various actions.', 'product-configurator-for-woocommerce' ) ?></p>
			<p><a href="#" class="hide-notice"><?php _e( "Please don't show this again.", 'product-configurator-for-woocommerce' ) ?></a></p>
		</div>
	</div>
</script>
<?php endif; ?>

<script type="text/html" id="tmpl-mkl-pc-structure-layer">
	<div class="tips sort ui-sortable-handle"><svg width="24" height="24" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8 7h2V5H8v2zm0 6h2v-2H8v2zm0 6h2v-2H8v2zm6-14v2h2V5h-2zm0 8h2v-2h-2v2zm0 6h2v-2h-2v2z"></path></svg></div>
	<button type="button">
		<h3></h3>
	</button>
	<# if ( 'group' == data.type && 'order' == data.orderAttr ) { #>
		<div class="layers group-list ui-sortable sortable-list" data-item-id="{{data._id}}"></div>
	<# } #>		
</script>

<script type="text/html" id="tmpl-mkl-pc-content-layer-list-item--label">
	<# if ( data.admin_label && data.admin_label != '' ) { #>
		{{data.admin_label}}
	<# } else { #>
		{{data.name}}
	<# } #>
	<# if ( data.image.url != '' ) { #>
		<img src="{{data.image.url}}" class="layer-img" />
	<# } #>
</script>

<script type="text/html" id="tmpl-mkl-pc-structure-angle-form">
	<div class="form-details">
		<header>
			<h2>
				<?php _e('Details', 'product-configurator-for-woocommerce' ); ?>
			</h2>
			<?php echo mkl_pc_get_admin_actions(); ?>
		</header>

		<?php do_action('mkl_pc_angle_fields') ?>
		<?php do_action('mkl_pc_angle_settings') ?>
	</div>

	<div class="mkl-pc-image-settings">
		<h2><?php _e('Angles\'s picture', 'product-configurator-for-woocommerce' ) ?></h2>
		<div class="thumbnail thumbnail-image">
			<# if ( data.image.url != '' ) { #>
				<img src="{{data.image.url}}" height="40" class="layer-img" />
			<# } #>
		</div>
		<a class="edit-attachment" href="#"><?php _e('Add / Change picture', 'product-configurator-for-woocommerce' ) ?></a>
		<# if ( data.image.url != '' ) { #>
			| <a class="remove-attachment" href="#"><?php _e('Remove picture', 'product-configurator-for-woocommerce' ) ?></a>
		<# } #>
	</div>
</script>

<script type="text/html" id="tmpl-mkl-pc-structure-layer-form">
	<div class="form-details">
		<header>
			<h2><?php _e('Details', 'product-configurator-for-woocommerce' ) ?> - [ID: {{data._id}}]</h2>
			<?php echo mkl_pc_get_admin_actions(); ?>
		</header>

		<?php do_action('mkl_pc_layer_fields') ?>

		<?php do_action('mkl_pc_layer_settings') ?>
	</div>

	<# if ( 'summary' != data.type ) { #>
		<div class="mkl-pc-image-settings">
			<h2><?php _e('Layer\'s icon', 'product-configurator-for-woocommerce' ) ?></h2>
			<div class="thumbnail thumbnail-image">
				<# if ( data.image.url != '' ) { #>
					<img src="{{data.image.url}}" height="40" class="layer-img" />
				<# } #>
			</div>
			<a class="edit-attachment" href="#"><?php _e('Add / Change picture', 'product-configurator-for-woocommerce' ) ?></a>
			<# if ( data.image.url != '' ) { #>
				| <a class="remove-attachment" href="#"><?php _e('Remove picture', 'product-configurator-for-woocommerce' ) ?></a>
			<# } #>
		</div>
	<# } #>
	
</script>
<?php 
/*

3D Model TEMPLATES 

*/
?>
<script type="text/html" id="tmpl-mkl-pc-3d-models">
	<div class="media-frame-content model-3d pc-3d-settings">
		<div class="pc-3d-settings-layout">
			<div class="pc-3d-settings-column-settings">
				<nav class="pc-3d-tabs nav-tab-wrapper" role="tablist">
					<button type="button" class="nav-tab pc-3d-tab active" data-tab="main" role="tab" aria-selected="true"><?php _e( 'Main 3D file', 'product-configurator-for-woocommerce' ); ?></button>
					<button type="button" class="nav-tab pc-3d-tab" data-tab="viewer" role="tab" aria-selected="false"><?php _e( 'Viewer Settings', 'product-configurator-for-woocommerce' ); ?></button>
				</nav>
				<div id="pc-3d-tab-main" class="pc-3d-tab-panel active" role="tabpanel">
					<h4><?php _e( 'Manage the product\'s main 3D file', 'product-configurator-for-woocommerce' ); ?></h4>
					<p><?php _e( 'Use this section if you use a main 3D file.', 'product-configurator-for-woocommerce' ); ?></p>
					<p><a href="#"><?php _e( 'Read the standard specification for automatic configurator mapping', 'product-configurator-for-woocommerce' ); ?></a></p>
					<p><a href="#"><?php _e( 'Download the free Blender Add-on', 'product-configurator-for-woocommerce' ); ?></a></p>
					<# if ( data.filename ) { #>
						<p><strong><?php _e( 'File', 'product-configurator-for-woocommerce' ); ?>:</strong> {{data.filename}}</p>
					<# } #>
					<# if ( data.url ) { #>
						<p class="description">{{data.url}}</p>
					<# } #>
					<p>
						<button class="button primary select-gltf" type="button"><?php _e( 'Select glb/gltf file', 'product-configurator-for-woocommerce' ); ?></button>
						<# if ( data.url ) { #>
							<button class="button primary remove-gltf" type="button"><?php _e( 'Remove file', 'product-configurator-for-woocommerce' ); ?></button>
						<# } #>
					</p>
					<# if ( data.url ) { #>
						<div class="pc-3d-setting-group">
							<h5><?php _e( 'Scene structure', 'product-configurator-for-woocommerce' ); ?></h5>
							<div class="pc-3d-tree"></div>
						</div>
					<# } #>
				</div>
				<div id="pc-3d-tab-viewer" class="pc-3d-tab-panel" role="tabpanel" hidden>
					<div class="pc-3d-settings-sections">
			<section class="pc-3d-settings-section">
				<h4><?php _e( 'Environment & Scene', 'product-configurator-for-woocommerce' ); ?></h4>
				<div class="pc-3d-setting-group">
					<h5><?php _e( 'Environment', 'product-configurator-for-woocommerce' ); ?></h5>
					<p class="field-row">
						<label><?php _e( 'Environment mode', 'product-configurator-for-woocommerce' ); ?></label>
						<select class="pc-3d-env-mode" data-key="environment.mode">
							<option value="preset" <# if ( data.environment && data.environment.mode === 'preset' ) { #>selected<# } #>><?php _e( 'Preset', 'product-configurator-for-woocommerce' ); ?></option>
							<option value="custom" <# if ( data.environment && data.environment.mode === 'custom' ) { #>selected<# } #>><?php _e( 'Custom HDR upload', 'product-configurator-for-woocommerce' ); ?></option>
						</select>
					</p>
					<p class="field-row pc-3d-env-preset-row">
						<label><?php _e( 'Preset', 'product-configurator-for-woocommerce' ); ?></label>
						<select class="pc-3d-env-preset" data-key="environment.preset">
							<option value="outdoor" <# if ( data.environment && data.environment.preset === 'outdoor' ) { #>selected<# } #>><?php _e( 'Outdoor', 'product-configurator-for-woocommerce' ); ?></option>
							<option value="studio" <# if ( data.environment && data.environment.preset === 'studio' ) { #>selected<# } #>><?php _e( 'Studio', 'product-configurator-for-woocommerce' ); ?></option>
						</select>
					</p>
					<p class="field-row pc-3d-env-custom-row" style="display:none;">
						<label><?php _e( 'Custom HDR', 'product-configurator-for-woocommerce' ); ?></label>
						<input type="hidden" class="pc-3d-env-custom-hdr-url" data-key="environment.custom_hdr_url" value="{{ data.environment && data.environment.custom_hdr_url ? data.environment.custom_hdr_url : '' }}" />
						<button type="button" class="button pc-3d-select-hdr"><?php _e( 'Upload HDR', 'product-configurator-for-woocommerce' ); ?></button>
					</p>
					<p class="field-row pc-3d-env-custom-row" style="display:none;">
						<label><?php _e( 'Environment intensity', 'product-configurator-for-woocommerce' ); ?></label>
						<input type="range" class="pc-3d-env-intensity" data-key="environment.intensity" min="0" max="3" step="0.1" value="{{ data.environment && data.environment.intensity != null ? data.environment.intensity : 1 }}" />
						<span class="pc-3d-value-display pc-3d-env-intensity-value">1</span>
					</p>
					<p class="field-row pc-3d-env-custom-row" style="display:none;">
						<label><?php _e( 'Environment rotation', 'product-configurator-for-woocommerce' ); ?></label>
						<input type="range" class="pc-3d-env-rotation" data-key="environment.rotation" min="0" max="360" step="1" value="{{ data.environment && data.environment.rotation != null ? data.environment.rotation : 0 }}" />
						<span class="pc-3d-value-display pc-3d-env-rotation-value">0</span>
					</p>
				</div>
				<div class="pc-3d-setting-group">
					<h5><?php _e( 'Orbit controls', 'product-configurator-for-woocommerce' ); ?></h5>
					<p class="description"><?php _e( 'Limit camera orbit so the viewer cannot go below the horizon by default.', 'product-configurator-for-woocommerce' ); ?></p>
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
				</div>
				<div class="pc-3d-setting-group">
					<h5><?php _e( 'Background', 'product-configurator-for-woocommerce' ); ?></h5>
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
					<h5><?php _e( 'Ground / Shadow', 'product-configurator-for-woocommerce' ); ?></h5>
					<p class="field-row">
						<label><input type="checkbox" class="pc-3d-ground-enabled" data-key="ground.enabled" <# if ( data.ground && data.ground.enabled !== false ) { #>checked<# } #> /> <?php _e( 'Enable ground plane', 'product-configurator-for-woocommerce' ); ?></label>
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
				</div>
			</section>
			<section class="pc-3d-settings-section">
				<h4><?php _e( 'Renderer / Output', 'product-configurator-for-woocommerce' ); ?></h4>
				<p class="field-row">
					<label><?php _e( 'Tone mapping', 'product-configurator-for-woocommerce' ); ?></label>
					<select class="pc-3d-tone-mapping" data-key="renderer.tone_mapping">
						<option value="none" <# if ( data.renderer && data.renderer.tone_mapping === 'none' ) { #>selected<# } #>><?php _e( 'None', 'product-configurator-for-woocommerce' ); ?></option>
						<option value="linear" <# if ( data.renderer && data.renderer.tone_mapping === 'linear' ) { #>selected<# } #>><?php _e( 'Linear', 'product-configurator-for-woocommerce' ); ?></option>
						<option value="aces" <# if ( data.renderer && data.renderer.tone_mapping === 'aces' ) { #>selected<# } #>><?php _e( 'ACES', 'product-configurator-for-woocommerce' ); ?></option>
					</select>
				</p>
				<p class="field-row">
					<label><?php _e( 'Exposure', 'product-configurator-for-woocommerce' ); ?></label>
					<input type="range" class="pc-3d-exposure" data-key="renderer.exposure" min="0.1" max="3" step="0.1" value="{{ data.renderer && data.renderer.exposure != null ? data.renderer.exposure : 1 }}" />
					<span class="pc-3d-value-display pc-3d-exposure-value">1</span>
				</p>
				<p class="field-row">
					<label><?php _e( 'Output color space', 'product-configurator-for-woocommerce' ); ?></label>
					<select class="pc-3d-color-space" data-key="renderer.output_color_space">
						<option value="srgb" <# if ( !data.renderer || data.renderer.output_color_space === 'srgb' ) { #>selected<# } #>>sRGB</option>
						<option value="linear" <# if ( data.renderer && data.renderer.output_color_space === 'linear' ) { #>selected<# } #>>Linear</option>
					</select>
				</p>
				<p class="field-row">
					<label><input type="checkbox" class="pc-3d-alpha" data-key="renderer.alpha" <# if ( data.renderer && data.renderer.alpha ) { #>checked<# } #> /> <?php _e( 'Alpha output', 'product-configurator-for-woocommerce' ); ?></label>
				</p>
			</section>
			<section class="pc-3d-settings-section">
				<h4><?php _e( 'Lighting (Global)', 'product-configurator-for-woocommerce' ); ?></h4>
				<p class="field-row">
					<label><input type="checkbox" class="pc-3d-default-light-enabled" data-key="lighting.default_light_enabled" <# if ( data.lighting && data.lighting.default_light_enabled !== false ) { #>checked<# } #> /> <?php _e( 'Enable default directional light', 'product-configurator-for-woocommerce' ); ?></label>
				</p>
				<p class="field-row">
					<label><?php _e( 'Global light intensity multiplier', 'product-configurator-for-woocommerce' ); ?></label>
					<input type="range" class="pc-3d-global-intensity" data-key="lighting.global_intensity" min="0" max="3" step="0.05" value="{{ data.lighting && data.lighting.global_intensity != null ? data.lighting.global_intensity : 1 }}" />
					<span class="pc-3d-value-display pc-3d-global-intensity-value">1</span>
				</p>
				<div class="pc-3d-setting-group">
					<h5><?php _e( 'Lights', 'product-configurator-for-woocommerce' ); ?></h5>
					<p class="description"><?php _e( 'Lights from the 3D model appear below. Load a model to see them.', 'product-configurator-for-woocommerce' ); ?></p>
					<div class="pc-3d-lights-list"></div>
				</div>
			</section>
					<p class="pc-3d-reset-settings-row" style="margin-top: 1.5em;">
						<button type="button" class="button pc-3d-reset-settings"><?php _e( 'Reset settings', 'product-configurator-for-woocommerce' ); ?></button>
					</p>
					</div>
				</div>
			</div>
			<div class="pc-3d-settings-column-preview">
				<div class="pc-3d-preview">
					<div class="pc-3d-preview--canvas-container"></div>
				</div>
			</div>
		</div>
	</div>
</script>
<script type="text/html" id="tmpl-mkl-pc-3d-light-item">
	<div class="pc-3d-light-item">
		<label>
			<input type="checkbox" class="pc-3d-light-enabled" data-key="enabled" <# if ( data.enabled !== false ) { #>checked<# } #> />
			{{ data.label }}
		</label>
		<select class="pc-3d-light-type" data-key="type">
			<option value="PointLight" <# if ( data.type === 'PointLight' ) { #>selected<# } #>><?php _e( 'Point', 'product-configurator-for-woocommerce' ); ?></option>
			<option value="DirectionalLight" <# if ( data.type === 'DirectionalLight' ) { #>selected<# } #>><?php _e( 'Directional', 'product-configurator-for-woocommerce' ); ?></option>
			<option value="SpotLight" <# if ( data.type === 'SpotLight' ) { #>selected<# } #>><?php _e( 'Spot', 'product-configurator-for-woocommerce' ); ?></option>
		</select>
		<input type="color" class="pc-3d-light-color" data-key="color" value="{{ data.color || '#ffffff' }}" />
		<input type="number" class="pc-3d-light-intensity" data-key="intensity" min="0" step="0.1" value="{{ data.intensity != null ? data.intensity : 1 }}" />
	</div>
</script>
<script type="importmap">
{
	"imports": {
		"three": "https://cdn.jsdelivr.net/npm/three@0.182.0/build/three.module.js",
		"three/addons/": "https://cdn.jsdelivr.net/npm/three@0.182.0/examples/jsm/"
	}
}
</script>
<?php 

/*

CONTENT TEMPLATES 

*/
 ?>

<script type="text/html" id="tmpl-mkl-pc-content">
	<div class="media-frame-content content">
		<div class="content-col content-layers-list"></div>
		<div class="content-col content-choices-list"></div>
		<div class="content-col content-choice pc-sidebar choice-details "></div>
	</div>
</script>

<script type="text/html" id="tmpl-mkl-pc-content-layer">
	<a href="#" class="layer mkl-list-item">
		<span class="name">
			<# if ( data.admin_label && data.admin_label != '' ) { #>
				{{data.admin_label}}
			<# } else { #>
				{{data.name}}
			<# } #>
		</span>
		<# if ( data.image.url != '' ) { #>
			<span class="icon"><img src="{{data.image.url}}" class="layer-img" /></span>
		<# } #>
		<span class="number-of-choices">{{data.choices_number}}</span>
	</a>
</script>

<script type="text/html" id="tmpl-mkl-pc-content-layer-back-link">
	<span class="name<# if ( data.image.url != '' ) { #> picture<# } #>"><# if ( data.admin_label && data.admin_label != '' ) { #>
				{{data.admin_label}}
			<# } else { #>
				{{data.name}}
			<# } #></span>
	<# if ( data.image.url != '' ) { #>
		<span class="icon"><img src="{{data.image.url}}" class="layer-img" /></span>
	<# } #>
</script>


<script type="text/html" id="tmpl-mkl-pc-choices">
	<button class="active-layer"></button>
	<div class="structure-toolbar">
		<h4><input type="text" placeholder="{{PC.lang.choice_new_placeholder}}"></h4>
		<button type="button" class="button-primary add-layer"><span><?php _e('Add'); ?></span></button>
	</div>
	<div class="mkl-list choices ui-sortable sortable-list">
	</div>
	<# if ( data.has_clipboard_data ) { #> 
	<div class="paste">
		<button type="button" class="button-primary paste-items"><span><?php _e( 'Paste' ); ?></span></button>
	</div>
	<# } #> 
</script>

<script type="text/html" id="tmpl-mkl-pc-content-choice-list-item">
<div class="tips sort ui-sortable-handle"><svg width="24" height="24" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8 7h2V5H8v2zm0 6h2v-2H8v2zm0 6h2v-2H8v2zm6-14v2h2V5h-2zm0 8h2v-2h-2v2zm0 6h2v-2h-2v2z"></path></svg></div>
	<button type="button">
		<h3><# if ( data.display_label ) { #>{{data.name}}<# } #></h3>
	</button>
	<# if ( data.is_group ) { #>
		<div class="choices group-list ui-sortable sortable-list" data-item-id="{{data._id}}"></div>
	<# } #>
</script>

<script type="text/html" id="tmpl-mkl-pc-content-choice-list-item--label">
	<# if ( data.admin_label && data.admin_label != '' ) { #>
		{{data.admin_label}}
	<# } else { #>
		{{data.name}}
	<# } #>
</script>

<script type="text/html" id="tmpl-mkl-pc-content-choice-form">
	<div class="form-details">
		<header>
			<h2><?php _e('Choice informations', 'product-configurator-for-woocommerce' ) ?> [ID: {{data._id}}]</h2>
			<?php echo mkl_pc_get_admin_actions(); ?>
		</header>

		<div class="options">
			<?php do_action('mkl_pc_choice_fields') ?>
			<div class="clear"></div>
		</div>

		<# if ( wp.hooks.applyFilters( 'PC.admin.show_choice_images', true, data ) ) { #>
			<div class="options mkl-pc-image-settings">
				<# if ( data.is_group ) { #>
					<h3><?php _e( 'Group thumbnail', 'product-configurator-for-woocommerce' ) ?></h3>
				<# } else if ( 'text-overlay' == data.layer_type ) { #>
					<h3><?php _e( 'Text positions', 'product-configurator-for-woocommerce' ) ?></h3>
				<# } else { #>
					<h3><?php _e( 'Pictures', 'product-configurator-for-woocommerce' ) ?></h3>
				<# } #>
				<div class="views">
					
				</div>
			</div>
		<# } #>
	</div>
</script>

<script type="text/html" id="tmpl-mkl-pc-multiple-edit-form">
	<div class="form-details">
		<h3><?php _e('Multiple selection', 'product-configurator-for-woocommerce' ) ?></h3>
		<div class="form-info">
			<div class="details">
				<div class="multiple-edit--action">
					<button type="button" class="button-link delete delete-layer" data-delete="prompt"><?php _e('Delete the selected items', 'product-configurator-for-woocommerce' ) ?></button>
					<div class="prompt-delete hidden notice">
						<p><?php _e( 'Do you realy want to delete the selected items?', 'product-configurator-for-woocommerce' ); ?></p>
						<p>
							<button type="button" class="button button-primary delete confirm-delete-layer" data-delete="confirm"><?php _e('Delete', 'product-configurator-for-woocommerce' ) ?></button>
							<button type="button" class="button cancel-delete-layer" data-delete="cancel"><?php _e('Cancel', 'product-configurator-for-woocommerce' ) ?></button>
						</p>
					</div>
				</div>
				<div class="multiple-edit--action">
					<h3><?php _e( 'Reorder the selected items', 'product-configurator-for-woocommerce' ) ?></h3>
					<div class="order">
						<button class="button up" type="button"><i class="dashicons dashicons-arrow-up-alt2"></i></button>
						<button class="button down" type="button"><i class="dashicons dashicons-arrow-down-alt2"></i></button>
					</div>
				</div>
				<div class="multiple-edit--action">
					<h3><?php _e( 'Copy the selected items', 'product-configurator-for-woocommerce' ) ?></h3>
					<div class="copy">
						<button type="button" class="button button-primary"><?php _e( 'Copy items', 'product-configurator-for-woocommerce' ) ?></button>
					</div>
				</div>
				<# if ( data.render_group ) { #>
					<div class="multiple-edit--action">
						<h3><?php _e( 'Create a group with the selected items', 'product-configurator-for-woocommerce' ) ?></h3>
						<div class="group">
							<input type="text" placeholder="<?php esc_attr_e( 'Group name', 'product-configurator-for-woocommerce' ); ?>" >
							<button type="button" class="button button-primary"><?php _e( 'Group items', 'product-configurator-for-woocommerce' ) ?></button>
						</div>
					</div>
				<# } #>
			</div>
		</div>
	</div>
</script>

<script type="text/html" id="tmpl-mkl-pc-content-choice-pictures">
	<div class="pictures">
		<# if ( ! data.is_group ) { #>
		<h4>{{data.angle_name}}</h4>
		<div class="picture main-picture" data-edit="image">
			<span><?php _e( 'Main Image', 'product-configurator-for-woocommerce' ); ?></span>
			<# if(data.image.url != '' ) { #>
			<img class="edit-attachment" src="{{data.image.url}}" alt="">
			<# } else { #>
			<img class="edit-attachment" src="<?= MKL_PC_ASSETS_URL.'admin/images/empty.jpg' ?>" alt="">
			<# } #>

			<a class="edit-attachment" href="#">
				<span class="screen-reader-text"><?php _e( 'Add / Edit image', 'product-configurator-for-woocommerce' ); ?></span>
				<# if ( data.image.url != '' ) { #>
					<span class="dashicons dashicons-edit"></span>
				<# } else { #>
					<span class="dashicons dashicons-plus"></span>
				<# } #>
			</a>

			<# if ( data.image.url != '' ) { #>
				<a class="remove-attachment" href="#"><span class="dashicons dashicons-no"></span><span class="screen-reader-text"><?php _e('Remove picture', 'product-configurator-for-woocommerce' ) ?></span></a>
			<# } #>
		</div>
		<# } #>
		<# if ( data?.angle?.has_thumbnails ) { #>
			<div class="picture thumbnail-picture" data-edit="thumbnail">
				<# if ( ! data.is_group ) { #><span><?php _e( 'Thumbnail', 'product-configurator-for-woocommerce' ); ?></span><# } #>
				<# if ( data.thumbnail.url != '' ) { #>
				<img class="edit-attachment" src="{{data.thumbnail.url}}" alt="">
				<# } else { #>
				<img class="edit-attachment" src="<?= MKL_PC_ASSETS_URL.'admin/images/empty.jpg' ?>" alt="">
				<# } #>

				<a class="edit-attachment" href="#">
					<span class="screen-reader-text"><?php _e( 'Add / Edit image', 'product-configurator-for-woocommerce' ); ?></span>
					<# if ( data.thumbnail.url != '' ) { #>
						<span class="dashicons dashicons-edit"></span>
					<# } else { #>
						<span class="dashicons dashicons-plus"></span>
					<# } #>
				</a>
				<# if ( data.thumbnail.url != '' ) { #>
					<a class="remove-attachment" href="#"><span class="dashicons dashicons-no"></span><span class="screen-reader-text"><?php _e('Remove picture', 'product-configurator-for-woocommerce' ) ?></span></a>
				<# } #>
			</div>
		<# } #>
		<div class="clear"></div>
	</div>
</script>

<script type="text/html" id="tmpl-mkl-pc-content-no-data">
	<div class="media-frame-content content">
		<div class="no-data">
			<p>
				<?php _e('You need to have Layers and Angles set before entering any content.') ?>
			</p>
		</div>	
	</div>
</script>

<script type="text/html" id="tmpl-mkl-pc-product-selector">
	<div class="mkl-pc-product-selector">
		<h3><?php _e( 'Select a product:', 'product-configurator-for-woocommerce' ); ?></h3>
		<select style="width: 100%;" class="wc-product-search" name="linked_woocommerce_products[]" data-placeholder="<?php _e( 'Search for a product&hellip;', 'woocommerce' ); ?>" data-action="woocommerce_json_search_products_and_variations" data-limit="200">
		</select>
		<button class="button button-primary select" disabled><?php _e( 'Choose', 'product-configurator-for-woocommerce' ); ?></button>
		<button class="button cancel"><?php _e( 'Cancel', 'product-configurator-for-woocommerce' ); ?></button>
	</div>
</script>

<script type="text/html" id="tmpl-mkl-pc-3d-object-selector">
	<div class="mkl-pc-3d-object-selector">
		<h3><?php esc_html_e( 'Select 3D object', 'product-configurator-for-woocommerce' ); ?></h3>
		<p class="mkl-pc-3d-object-selector--filter">
			<input type="text" class="mkl-pc-3d-object-selector--filter-input" placeholder="<?php esc_attr_e( 'Filter objects…', 'product-configurator-for-woocommerce' ); ?>" />
		</p>
		<div class="mkl-pc-3d-object-selector--tree-container">
			<ul class="mkl-pc-3d-object-selector--tree"></ul>
		</div>
		<div class="mkl-pc-3d-object-selector--actions">
			<button type="button" class="button button-primary select" disabled><?php esc_html_e( 'Choose', 'product-configurator-for-woocommerce' ); ?></button>
			<button type="button" class="button cancel"><?php esc_html_e( 'Cancel', 'product-configurator-for-woocommerce' ); ?></button>
		</div>
	</div>
</script>

<?php 
/*

IMPORT / EXPORT

*/
 ?>
<script type="text/html" id="tmpl-mkl-pc-import-export">
	<div class="media-frame-content import-export">
		<div class="import-export-content">
			<div class="import">
				<h3><?php _e( 'Import', 'product-configurator-for-woocommerce' ); ?></h3>
				<p><button class="button" data-action="import-from-file"><?php _e( 'Import configuration', 'product-configurator-for-woocommerce' ); ?></button></p>
				<!-- <p><?php _e( 'Or' ); ?></p>
				<p><button class="button" data-action="import-from-product"><?php _e( 'Import an other product', 'product-configurator-for-woocommerce' ); ?></button></p> -->
			</div>
			<div class="export">
				<h3><?php _e( 'Export', 'product-configurator-for-woocommerce' ); ?></h3>
				<p><button class="button" data-action="export-data"><?php _e( 'Export configuration data', 'product-configurator-for-woocommerce' ); ?></button></p>
			</div>
		</div>
		<div class="importer-action-content">
		</div>
	</div>
</script>

<script type="text/html" id="tmpl-mkl-pc-importer">
	<div class="importer-header">
		<button class="button button-group button-primary return" type="button" data-action="return"><span class="dashicons dashicons-arrow-left-alt"></span></button>
		<ol>
			<# PC._us.each( data.menu_items, function( item, index ) { #>
				<li>{{item.label}}</li>
			<# }); #>
		</ol>
	</div>
	<div class="importer-container"></div>
</script>

<script type="text/html" id="tmpl-mkl-pc-importer--product">
	<h3><?php _e( 'Choose a product', 'product-configurator-for-woocommerce' ); ?></h3>
	<select style="width: 50%;" class="wc-product-search" name="linked_woocommerce_products[]" data-placeholder="<?php _e( 'Search for a product&hellip;', 'woocommerce' ); ?>" data-action="woocommerce_json_search_products_and_variations">
	</select>
	<button class="button next" disabled>Next</button>
</script>

<script type="text/html" id="tmpl-mkl-pc-importer--file-upload">
	<h3><?php _e( 'Select a file', 'product-configurator-for-woocommerce' ); ?></h3>
	<p><?php _e( 'Select the JSON file you exported previously.', 'product-configurator-for-woocommerce' ); ?></p>
	<input type="file" id="jsonfileinput" />
</script>

<script type="text/html" id="tmpl-mkl-pc-importer--configuration-preview">
	<div class="preview-action">
		<h3><?php _e( 'Preview', 'product-configurator-for-woocommerce' ); ?></h3>
		<p><?php _e( 'Review the data and press Import data to import it to this product.', 'product-configurator-for-woocommerce' ); ?></p>
		<p><strong><?php _e( 'Note that any existing configuration will be overriden.', 'product-configurator-for-woocommerce' ); ?></strong></p>
		<button class="import-selected button button-primary" type="button"><?php _e( 'Import data', 'product-configurator-for-woocommerce' ); ?></button>
	</div>
	<div class="preview-content">
		<# if ( data.layers ) { #>
			<div class="preview-content--collection">
				<h4><?php _e( 'Layers and content:', 'product-configurator-for-woocommerce' ); ?></h4>
				<ul class="ul-disc">
					<# PC._us.each( data.layers, function( layer ) { #>
						<li>{{layer.name}}
							<#
								var content = data.content && PC._us.findWhere( data.content, { layerId: layer._id } );
								if ( content && content.choices && content.choices.length ) {
							#>
								<ul class="ul-square">
									<# PC._us.each( content.choices, function( choice ) { #>
										<li>{{choice.name}}</li>
									<# }); #>
								</ul>
							<# } #>
						</li>
					<# }); #>
				</ul>
			</div>
		<# } #>

		<# if ( data.angles ) { #>
			<div class="preview-content--collection">
				<h4><?php _e( 'Angles:', 'product-configurator-for-woocommerce' ); ?></h4>
				<ul class="ul-disc">
					<# PC._us.each( data.angles, function( angle ) { #>
						<li>{{angle.name}}</li>
					<# }); #>
				</ul>
			</div>
		<# } #>

		<# if ( data.conditions ) { #>
			<div class="preview-content--collection">
				<h4><?php _e( 'Conditions', 'product-configurator-for-woocommerce' ); ?></h4>
				<ul class="ul-disc">
					<# PC._us.each( data.conditions, function( condition ) { #>
						<li>{{condition.name}}</li>
					<# }); #>
				</ul>
			</div>
		<# } #>
	</div>

</script>


<script type="text/html" id="tmpl-mkl-pc-importer--configuration-imported">
	<h3><?php _e( 'The import process is complete.', 'product-configurator-for-woocommerce' ); ?></h3>
	<p><?php _e( 'Please check the different elements (Layers, views, content...), and save if you are happy with it.', 'product-configurator-for-woocommerce' ); ?></p>
	<p><?php _e( 'Alternatively you can save here.', 'product-configurator-for-woocommerce' ); ?></p>
	<button type="button" class="button primary save"><?php _e( 'Save', 'product-configurator-for-woocommerce' ); ?></button>
	<h4><?php _e( 'Importing from a different site?', 'product-configurator-for-woocommerce' ); ?></h4>
	<p><?php _e( 'When importing from a different site, the images need to be added to the library separately.', 'product-configurator-for-woocommerce' ); ?></p>
	<p><?php _e( 'If you already imported the matching images to the library, you can use the following tool to try to match the images.', 'product-configurator-for-woocommerce' ); ?></p>
	<button type="button" class="button primary save-and-fix-images"><?php _e( 'Save and fix images', 'product-configurator-for-woocommerce' ); ?></button>
</script>

<script type="text/html" id="tmpl-mkl-pc-importer--layers">
	<# if ( ! data ) { #>
		<h3>No product selected</h3>
	<# } else { #>
		<# if ( data.product_name ) { #><h3>{{data.product_name}}</h3><# } #>
		<div class="form">
			<h4>New layers</h4>
			<label><input type="radio" required name="which-layers" value="everything"> Import all layers</label>
			<label><input type="radio" required name="which-layers" value="selected"> Import selected layers</label>
			
			<h4>Existing layers</h4>
			<label><input type="radio" required name="existing-layers" value="append"> Add to existing layers</label>
			<label><input type="radio" required name="existing-layers" value="append-no-duplicate"> Add to existing with no duplicates</label>
			<label><input type="radio" required name="existing-layers" value="replace"> Replace existing layers</label>

			<h4>Layers thumbnails</h4>
			<label><input type="checkbox" name="layer-thumbnails" value="1"> Import thumbnails</label>

			<button class="button next">Next</button>
		</div>
		<div class="selector-container">
		</div>
	<# } #>
</script>

<script type="text/html" id="tmpl-mkl-pc-importer--angles">
	<# if ( ! data ) { #>
		<h3>No product selected</h3>
	<# } else { #>
		<# if ( data.product_name ) { #><h3>{{data.product_name}}</h3><# } #>
		<div class="form">
			<h4>New angles</h4>
			<label><input type="radio" required name="which-angles" value="everything"> Import all angles</label>
			<label><input type="radio" required name="which-angles" value="selected"> Import selected angles</label>
			
			<h4>Existing angles</h4>
			<label><input type="radio" required name="existing-angles" value="append"> Add to existing angles</label>
			<label><input type="radio" required name="existing-angles" value="append-no-duplicate"> Add to existing with no duplicates</label>
			<label><input type="radio" required name="existing-angles" value="replace"> Replace existing angles</label>

			<h4>Angles thumbnails</h4>
			<label><input type="checkbox" name="angle-thumbnails" value="1"> Import thumbnails</label>

			<button class="button next">Next</button>
		</div>
		<div class="selector-container">
		</div>
	<# } #>
</script>

<script type="text/html" id="tmpl-mkl-pc-importer--selector">
	<ul class="available">
	</ul>
	<ul class="selected">
	</ul>
</script>

<script type="text/html" id="tmpl-mkl-pc-importer--selector-item">
	<a href="#">
		<# if ( data.selected ) { #>
			<span class="dashicons dashicons-minus"></span>
		<# } else { #>
			<span class="dashicons dashicons-plus"></span>
		<# } #>
		{{data.name}} <# if ( data.image.urls ) { #><img src="{{data.image.url}}" alt=""><# } #>
	</a>
</script>

<script type="text/html" id="tmpl-mkl-pc-setting--repeater">
	<div class="options-list"></div>
	<?php do_action( 'tmpl-mkl-pc-setting--repeater' ); ?>
	<button class="button add-option" type="button"><i class="dashicons dashicons-plus"></i> <?php _e( 'Add option', 'product-configurator-for-woocommerce' ); ?></button>
</script>

<script type="text/html" id="tmpl-mkl-pc-setting--repeater-option">
	<div class="order">
		<button class="button up" type="button"><i class="dashicons dashicons-arrow-up-alt2"></i></button>
		<button class="button down" type="button"><i class="dashicons dashicons-arrow-down-alt2"></i></button>
	</div>
	<?php 
		$languages = mkl_pc( 'languages' )->get_languages();
		$language_data = [];
		if ( ! empty( $languages ) ) {
			$default = mkl_pc( 'languages' )->get_default_language();
			foreach( $languages as $l ) {
				if ( $default == $l ) continue;
				$flag_url = mkl_pc( 'languages' )->get_flag( $l );
				$language_sufix = str_replace( '-', '_', $l );
				$language_data[$language_sufix] = [
					'flag'  => esc_url( $flag_url ),
				];
			}
		}
	?>
	<# const language_data = <?php echo json_encode( $language_data ); ?>; #>
	<# _.each( data.fields, ( field, key ) => { #>
		<# const isSelect = field.type === 'select' && field.choices && field.choices.length; #>
		<# const isColor = field.type === 'color'; #>
		<# const isAttachment = field.type === 'attachment'; #>
		<# const isVariantSelect = field.type === 'variant_select'; #>
		<# const showWhen = field.show_when || null; #>
		<div class="field-repeater-field <# if ( showWhen ) { #>pc-action-value<# } #>" <# if ( showWhen ) { #>data-show-when="{{showWhen}}"<# } #>>
		<label>
			{{field.label}}
			<# if ( isSelect ) { #>
				<select name="{{key}}">
					<# _.each( field.choices, ( opt ) => { #>
						<option value="{{opt.value}}" <# if ( data[key] === opt.value ) { #> selected<# } #>>{{opt.label}}</option>
					<# } ); #>
				</select>
			<# } else if ( isColor ) { #>
				<input name="{{key}}" type="color" value="{{data[key] || '#ffffff'}}">
			<# } else if ( isAttachment ) { #>
				<# const urlKey = key.replace( /_id$/, '_url' ); const filenameKey = key.replace( /_id$/, '_filename' ); const hasUrl = urlKey !== key && data[urlKey]; #>
				<input name="{{key}}" type="hidden" value="{{data[key] || ''}}">
				<# if ( hasUrl ) { #>
					<a href="{{data[urlKey]}}" target="_blank" rel="noopener noreferrer" class="pc-attachment-link">{{data[filenameKey] || data[urlKey]}}</a>
				<# } #>
				<button type="button" class="button pc-select-attachment" data-target="{{key}}"><?php echo esc_html( __( 'Select', 'product-configurator-for-woocommerce' ) ); ?></button>
			<# } else if ( isVariantSelect ) { #>
				<span class="pc-variant-select-placeholder" data-variant-field="{{key}}" data-variant-value="{{data[key] || ''}}"><?php esc_html_e( 'Loading variants…', 'product-configurator-for-woocommerce' ); ?></span>
			<# } else { #>
				<input name="{{key}}" type="{{field.type || 'text'}}" value="{{data[key]}}" placeholder="{{field.placeholder || ''}}">
			<# } #>
		</label>
		</div>
		<# if ( field.translatable ) { #>
				<# 
				_.each( language_data, ( language, language_key ) => { 
					const slug = key + '_' + language_key;
				#>
				<label>
					<# if ( language.flag ) { #> <img src="{{language.flag}}" alt="{{field.label}} {{language_key}}"><# } #>{{field.label}}
					<input name="{{slug}}" type="text" value="{{data[slug] || ''}}">
				</label>
			<# } ); #>
		<# } #>
	<# } ); #>

	<?php do_action( 'tmpl-mkl-pc-setting--repeater-option' ); ?>
	<button class="button remove-option" type="button"><i class="dashicons dashicons-remove"></i><span><?php _e( 'Remove option', 'product-configurator-for-woocommerce' ); ?></span></button>
</script>

<?php do_action('mkl_pc_admin_templates_after') ?>