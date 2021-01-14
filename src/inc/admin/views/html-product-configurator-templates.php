<?php 
global $is_IE;
$class = 'media-modal wp-core-ui pc-modal';
if ( $is_IE && strpos($_SERVER['HTTP_USER_AGENT'], 'MSIE 7') !== false )
	$class .= ' ie7';
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
		<button type="button" class="button media-button button-primary button-large pc-main-save-all"><?php _e( 'Save all', 'product-configurator-for-woocommerce' ); ?></button>
		<button type="button" class="button media-button button-primary button-large pc-main-save">{{data.bt_save_text}}</button>
	</div>
</script>
<?php 
/*

STRUCTURE / VIEWS TEMPLATES (They will share the same views, using different models.)

*/
 ?>

<script type="text/html" id="tmpl-mkl-pc-structure">
	<div class="media-frame-content structure">
		<div class="structure-content has-toolbar">
			<div class="structure-toolbar">
				<h4><input type="text" placeholder="{{data.input_placeholder}}"></h4>
				<button type="button" class="button-primary add-layer"><span><?php _e('Add'); ?></span></button>
			</div>
			<div class="mkl-list layers ui-sortable">
			</div>
		</div>
		<div class="media-sidebar visible">
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
<script type="text/html" id="tmpl-mkl-pc-structure-layer">
	<div class="tips sort ui-sortable-handle"></div>
	<button type="button">
		<h3>
			<# if ( data.admin_label && data.admin_label != '' ) { #>
				{{data.admin_label}}
			<# } else { #>
				{{data.name}}
			<# } #>
			<# if ( data.image.url != '' ) { #>
				<img src="{{data.image.url}}" class="layer-img" />
			<# } #>
		</h3>
	</button>		
</script>

<script type="text/html" id="tmpl-mkl-pc-structure-angle-form">
	<div class="form-details">
		<h2>
			<?php _e('Details', 'product-configurator-for-woocommerce' ); ?>
		</h2>

		<div class="form-info">
			<div class="details">
				<button type="button" class="button-link delete delete-layer" data-delete="prompt"><?php _e('Delete', 'product-configurator-for-woocommerce' ) ?></button>
				<div class="prompt-delete hidden notice">
					<p><?php _e( 'Do you realy want to delete this angle?', 'product-configurator-for-woocommerce' ); ?></p>
					<p>
						<button type="button" class="button button-primary delete confirm-delete-layer" data-delete="confirm"><?php _e('Delete', 'product-configurator-for-woocommerce' ) ?></button>
						<button type="button" class="button cancel-delete-layer" data-delete="cancel"><?php _e('Cancel', 'product-configurator-for-woocommerce' ) ?></button>
					</p>
				</div>
			</div>
		</div>
		<label class="setting">
			<span class="name"><?php _e('Angle Name', 'product-configurator-for-woocommerce' ) ?></span>
			<input type="text" data-setting="name" value="{{data.name}}">
		</label>
		<label class="setting">
			<span class="name"><?php _e('Description', 'product-configurator-for-woocommerce' ) ?></span>
			<textarea data-setting="description">{{data.description}}</textarea>
		</label>
		<?php do_action('mkl_pc_angle_settings') ?>
	</div>
	<div class="attachment-display-settings">
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
		<h2>
			<?php _e('Details', 'product-configurator-for-woocommerce' ) ?>
		</h2>

		<div class="form-info">
			<div class="details">
				<button type="button" class="button-link delete delete-layer" data-delete="prompt"><?php _e('Delete', 'product-configurator-for-woocommerce' ) ?></button>
				<div class="prompt-delete hidden notice">
					<p><?php _e( 'Do you realy want to delete this layer?', 'product-configurator-for-woocommerce' ); ?></p>
					<p>
						<button type="button" class="button button-primary delete confirm-delete-layer" data-delete="confirm"><?php _e('Delete', 'product-configurator-for-woocommerce' ) ?></button>
						<button type="button" class="button cancel-delete-layer" data-delete="cancel"><?php _e('Cancel', 'product-configurator-for-woocommerce' ) ?></button>
					</p>
				</div>
			</div>
		</div>

		<?php do_action('mkl_pc_layer_fields') ?>

		<?php do_action('mkl_pc_layer_settings') ?>
	</div>
	<div class="attachment-display-settings">
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
		<div class="content-col content-choice media-sidebar choice-details "></div>
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
		<h4><input type="text" placeholder="{{data.input_placeholder}}"></h4>
		<button type="button" class="button-primary add-layer"><span><?php _e('Add'); ?></span></button>
	</div>
	<div class="mkl-list choices ui-sortable">
	</div>
</script>

<script type="text/html" id="tmpl-mkl-pc-content-choice-list-item">
	<div class="tips sort ui-sortable-handle"></div>
	<button type="button">
		<h3>
			{{data.name}}
		</h3>
	</button>
</script>

<script type="text/html" id="tmpl-mkl-pc-content-choice-form">
	<div class="form-details">
		<h3><?php _e('Choice informations', 'product-configurator-for-woocommerce' ) ?></h3>
		<div class="form-info">
			<div class="details">
				<button type="button" class="button-link delete delete-layer" data-delete="prompt"><?php _e('Delete', 'product-configurator-for-woocommerce' ) ?></button>
				<div class="prompt-delete hidden notice">
					<p><?php _e( 'Do you realy want to delete this choice?', 'product-configurator-for-woocommerce' ); ?></p>
					<p>
						<button type="button" class="button button-primary delete confirm-delete-layer" data-delete="confirm"><?php _e('Delete', 'product-configurator-for-woocommerce' ) ?></button>
						<button type="button" class="button cancel-delete-layer" data-delete="cancel"><?php _e('Cancel', 'product-configurator-for-woocommerce' ) ?></button>
					</p>
				</div>
			</div>
		</div>

		<div class="options">
			<h3>Informations</h3>
			<?php do_action('mkl_pc_choice_fields') ?>
			<div class="clear"></div>
		</div>

		<div class="options">
			<h3><?php _e( 'Pictures', 'product-configurator-for-woocommerce' ) ?></h3>
			<div class="views">
				
			</div>
		</div>
	</div>
</script>
<script type="text/html" id="tmpl-mkl-pc-content-choice-pictures">
	<div class="pictures">
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
		<div class="picture thumbnail-picture" data-edit="thumbnail">
			<span><?php _e( 'Thumbnail', 'product-configurator-for-woocommerce' ); ?></span>
			<# if(data.thumbnail.url != '' ) { #>
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
		<select style="width: 100%;" class="wc-product-search" name="linked_woocommerce_products[]" data-placeholder="<?php _e( 'Search for a product&hellip;', 'woocommerce' ); ?>" data-action="woocommerce_json_search_products_and_variations">
		</select>
		<button class="button button-primary select" disabled><?php _e( 'Choose', 'product-configurator-for-woocommerce' ); ?></button>
		<button class="button cancel"><?php _e( 'Cancel', 'product-configurator-for-woocommerce' ); ?></button>
	</div>
</script>
<?php do_action('mkl_pc_admin_templates_after') ?>