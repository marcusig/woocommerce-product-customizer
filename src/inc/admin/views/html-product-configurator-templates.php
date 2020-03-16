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
		<button type="button" class="button media-button button-primary button-large pc-main-save-all"><?php _e( 'Save all', MKL_PC_DOMAIN ); ?></button>
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
			{{data.name}}
			<# if ( data.image.url != '' ) { #>
				<img src="{{data.image.url}}" class="layer-img" />
			<# } #>
		</h3>
	</button>		
</script>

<script type="text/html" id="tmpl-mkl-pc-structure-angle-form">
	<div class="form-details">
		<h2>
			<?php _e('Details', MKL_PC_DOMAIN ) ?>
		</h2>

		<div class="form-info">
			<div class="details">
				<button type="button" class="button-link delete delete-layer" data-delete="prompt"><?php _e('Delete', MKL_PC_DOMAIN ) ?></button>
				<div class="prompt-delete hidden notice">
					<p><?php _e( 'Do you realy want to delete this angle?', MKL_PC_DOMAIN ); ?></p>
					<p>
						<button type="button" class="button button-primary delete confirm-delete-layer" data-delete="confirm"><?php _e('Delete', MKL_PC_DOMAIN ) ?></button>
						<button type="button" class="button cancel-delete-layer" data-delete="cancel"><?php _e('Cancel', MKL_PC_DOMAIN ) ?></button>
					</p>
				</div>
			</div>
		</div>
		<label class="setting">
			<span class="name"><?php _e('Angle Name', MKL_PC_DOMAIN ) ?></span>
			<input type="text" data-setting="name" value="{{data.name}}">
		</label>
		<label class="setting">
			<span class="name"><?php _e('Description', MKL_PC_DOMAIN ) ?></span>
			<textarea data-setting="description">{{data.description}}</textarea>
		</label>
		<?php do_action('mkl_pc_layer_settings') ?>
	</div>
	<div class="attachment-display-settings">
		<h2><?php _e('Angles\'s picture', MKL_PC_DOMAIN ) ?></h2>
		<div class="thumbnail thumbnail-image">
			<# if ( data.image.url != '' ) { #>
				<img src="{{data.image.url}}" height="40" class="layer-img" />
			<# } #>
		</div>
		<a class="edit-attachment" href="#"><?php _e('Add / Change picture', MKL_PC_DOMAIN ) ?></a>
	</div>
</script>

<script type="text/html" id="tmpl-mkl-pc-structure-layer-form">
	<div class="form-details">
		<h2>
			<?php _e('Details', MKL_PC_DOMAIN ) ?>
		</h2>

		<div class="form-info">
			<div class="details">
				<button type="button" class="button-link delete delete-layer" data-delete="prompt"><?php _e('Delete', MKL_PC_DOMAIN ) ?></button>
				<div class="prompt-delete hidden notice">
					<p><?php _e( 'Do you realy want to delete this layer?', MKL_PC_DOMAIN ); ?></p>
					<p>
						<button type="button" class="button button-primary delete confirm-delete-layer" data-delete="confirm"><?php _e('Delete', MKL_PC_DOMAIN ) ?></button>
						<button type="button" class="button cancel-delete-layer" data-delete="cancel"><?php _e('Cancel', MKL_PC_DOMAIN ) ?></button>
					</p>
				</div>
			</div>
		</div>
		<label class="setting">
			<span class="name"><?php _e('Layer Name', MKL_PC_DOMAIN ) ?></span>
			<input type="text" data-setting="name" value="{{data.name}}">
		</label>
		<label class="setting">
			<span class="name"><?php _e('Description', MKL_PC_DOMAIN ) ?></span>
			<textarea data-setting="description">{{data.description}}</textarea>
		</label>
		<label class="setting">
			<span class="name"><?php _e('This layer does not have choices', MKL_PC_DOMAIN ) ?></span>
			<input type="checkbox" data-setting="not_a_choice" <# if(data.not_a_choice == true || data.not_a_choice == 'true') { #> checked="checked" <# } #>>
			<p class="help"><?php _e('For exemple if the layer is a shadow or a static element', MKL_PC_DOMAIN ) ?></p>
		</label>
		<?php do_action('mkl_pc_layer_settings') ?>
	</div>
	<div class="attachment-display-settings">
		<h2><?php _e('Layer\'s icon', MKL_PC_DOMAIN ) ?></h2>
		<div class="thumbnail thumbnail-image">
			<# if ( data.image.url != '' ) { #>
				<img src="{{data.image.url}}" height="40" class="layer-img" />
			<# } #>
		</div>
		<a class="edit-attachment" href="#"><?php _e('Add / Change picture', MKL_PC_DOMAIN ) ?></a>
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
		<span class="name">{{data.name}}</span>
		<# if ( data.image.url != '' ) { #>
			<span class="icon"><img src="{{data.image.url}}" class="layer-img" /></span>
		<# } #>
		<span class="number-of-choices">{{data.choices_number}}</span>
	</a>
</script>

<script type="text/html" id="tmpl-mkl-pc-content-layer-back-link">
	<span class="name<# if ( data.image.url != '' ) { #> picture<# } #>">{{data.name}}</span>
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
		<h3><?php _e('Choice informations', MKL_PC_DOMAIN ) ?></h3>
		<div class="form-info">
			<div class="details">
				<button type="button" class="button-link delete delete-layer" data-delete="prompt"><?php _e('Delete', MKL_PC_DOMAIN ) ?></button>
				<div class="prompt-delete hidden notice">
					<p><?php _e( 'Do you realy want to delete this choice?', MKL_PC_DOMAIN ); ?></p>
					<p>
						<button type="button" class="button button-primary delete confirm-delete-layer" data-delete="confirm"><?php _e('Delete', MKL_PC_DOMAIN ) ?></button>
						<button type="button" class="button cancel-delete-layer" data-delete="cancel"><?php _e('Cancel', MKL_PC_DOMAIN ) ?></button>
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
			<h3><?php _e( 'Pictures', MKL_PC_DOMAIN ) ?></h3>
			<div class="views">
				
			</div>
		</div>
	</div>
</script>
<script type="text/html" id="tmpl-mkl-pc-content-choice-pictures">
	<div class="pictures">
		<h4>{{data.angle_name}}</h4>
		<div class="picture main-picture">
			<a class="edit-attachment" data-edit="image" href="#"><span>Main Image</span> 
			<# if(data.image.url != '' ) { #>
			<img src="{{data.image.url}}" alt="">
			<# } else { #>
			<img src="<?= MKL_PC_ASSETS_URL.'admin/images/empty.jpg' ?>" alt="">
			<# } #>
			</a>
		</div>
		<div class="picture thumbnail-picture">
			<a class="edit-attachment" data-edit="thumbnail" href="#"><span>Thumbnail</span> 
			<# if(data.thumbnail.url != '' ) { #>
			<img src="{{data.thumbnail.url}}" alt="">
			<# } else { #>
			<img src="<?= MKL_PC_ASSETS_URL.'admin/images/empty.jpg' ?>" alt="">
			<# } #>

			</a>			
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
<?php do_action('mkl_pc_admin_templates_after') ?>