<?php 
global $is_IE;
$class = 'media-modal wp-core-ui pc-modal';
if ( $is_IE && strpos($_SERVER['HTTP_USER_AGENT'], 'MSIE 7') !== false )
	$class .= ' ie7';

function mkl_pc_get_admin_actions() {
	return '<div class="actions-container">
		<button type="button" class="button-link delete delete-item" data-delete="prompt">' . __('Delete', 'product-configurator-for-woocommerce' ) . '</button>' .
		'<button type="button" class="button-link duplicate duplicate-item">' . __('Duplicate', 'product-configurator-for-woocommerce' ) . '</button>' .
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
			<p><?php printf( _x( '%s is available as %san add-on%s', 'First placeholder is the add-on name, second and third are the link tags to the add-on', 'product-configurator-for-woocommerce' ), __( 'Conditional logic', 'product-configurator-for-woocommerce' ), '<a href="https://wc-product-configurator.com/product/conditional-logic/" target="_blank" class="mkl-pc-link--external">', '</a>' ); ?></p>
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
			<h2><?php _e('Details', 'product-configurator-for-woocommerce' ) ?></h2>
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

<script type="text/html" id="tmpl-mkl-pc-importer--file">
Importing 2
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

<script type="text/html" id="tmpl-mkl-pc-exporter">
Exportin
</script>

<?php do_action('mkl_pc_admin_templates_after') ?>