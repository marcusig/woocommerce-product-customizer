<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly.
}

global $is_IE;
$class = 'mkl-pc-admin-ui wp-core-ui pc-modal';
$user_agent = isset( $_SERVER['HTTP_USER_AGENT'] ) ? wp_unslash( $_SERVER['HTTP_USER_AGENT'] ) : '';
if ( $is_IE && strpos( $user_agent, 'MSIE 7' ) !== false )
	$class .= ' ie7';

function mkl_pc_get_admin_actions() {
	return '' .
		'<button type="button" class="button-link delete delete-item" data-delete="prompt">' . esc_html__('Delete', 'product-configurator-for-woocommerce' ) . '</button>' .
		'<button type="button" class="button-link duplicate duplicate-item">' . esc_html__('Duplicate', 'product-configurator-for-woocommerce' ) . '</button>' .
		'<button type="button" class="button-link copy copy-item">' . esc_html__('Copy', 'product-configurator-for-woocommerce' ) . '</button>' .
		'<div class="prompt-delete hidden mkl-pc-setting--warning">' .
			'<p>' . esc_html__( 'Do you realy want to delete this item?', 'product-configurator-for-woocommerce' ) . '</p>' .
			'<p>' .
				'<button type="button" class="button button-primary delete confirm-delete" data-delete="confirm">' . esc_html__('Delete', 'product-configurator-for-woocommerce' ) . '</button>' .
				'<button type="button" class="button cancel-delete" data-delete="cancel">' . esc_html__('Cancel', 'product-configurator-for-woocommerce' ) . '</button>' .
			'</p>' .
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
	<div class="<?php echo esc_attr( $class ); ?>">
		<button type="button" class="mkl-pc-admin-ui__close">
			<span class="mkl-pc-admin-ui__close-icon" aria-hidden="true"></span>
			<span class="screen-reader-text"><?php esc_html_e( 'Close configurator', 'product-configurator-for-woocommerce' ); ?></span>
		</button>
		<div class="mkl-pc-admin-ui__body">
			<div class="mkl-pc-admin-ui__main wp-core-ui">
			</div>
		</div>
		<div class="loading-screen">
			<div class="mkl-pc-editor-load mkl-pc-editor-load--busy">
				<span class="mkl-pc-spinner" aria-hidden="true"></span>
				<p class="screen-reader-text mkl-pc-editor-load__sr-busy"><?php esc_html_e( 'Loading configurator…', 'product-configurator-for-woocommerce' ); ?></p>
			</div>
			<div class="mkl-pc-editor-load mkl-pc-editor-load--error" hidden>
				<p class="mkl-pc-editor-load__message" role="alert"></p>
				<button type="button" class="button button-primary mkl-pc-editor-load__retry"><?php esc_html_e( 'Retry', 'product-configurator-for-woocommerce' ); ?></button>
			</div>
		</div>
		<div class="notice-container"></div>
	</div>
	<div class="mkl-pc-admin-ui__backdrop pc-modal-backdrop"></div>
</script>

<script type="text/html" id="tmpl-mkl-pc-admin-dialog">
	<div class="mkl-pc-admin-dialog wp-core-ui <# if ( data.extraClass ) { #>{{ data.extraClass }}<# } #>" role="dialog" aria-modal="true"<# if ( data.title ) { #> aria-labelledby="{{ data.titleId }}"<# } #>>
		<div class="mkl-pc-admin-dialog__backdrop" data-mkl-pc-dialog-dismiss tabindex="-1"></div>
		<div class="mkl-pc-admin-dialog__panel">
			<div class="mkl-pc-admin-dialog__header">
				<# if ( data.title ) { #>
					<h2 id="{{ data.titleId }}" class="mkl-pc-admin-dialog__title">{{ data.title }}</h2>
				<# } #>
				<button type="button" class="mkl-pc-admin-dialog__close" data-mkl-pc-dialog-dismiss aria-label="<?php echo esc_attr__( 'Close dialog', 'product-configurator-for-woocommerce' ); ?>">
					<span class="mkl-pc-admin-dialog__close-icon" aria-hidden="true"></span>
				</button>
			</div>
			<div class="mkl-pc-admin-dialog__body"></div>
		</div>
	</div>
</script>

<script type="text/html" id="tmpl-mkl-pc-menu">	
	<div class="mkl-pc-admin-ui__sidebar">
		<div class="mkl-pc-admin-ui__sidebar-top">
			<div class="mkl-pc-admin-ui__product-name--container">
				<button type="button" class="mkl-pc-admin-ui__product-icon-back-button" aria-label="<?php esc_html_e( 'Back to product', 'product-configurator-for-woocommerce' ); ?>">
					<svg xmlns="http://www.w3.org/2000/svg" viewBox="-2 -2 24 24" width="48" height="48" class="edit-site-site-icon__icon" aria-hidden="true" focusable="false"><path d="M20 10c0-5.51-4.49-10-10-10C4.48 0 0 4.49 0 10c0 5.52 4.48 10 10 10 5.51 0 10-4.48 10-10zM7.78 15.37L4.37 6.22c.55-.02 1.17-.08 1.17-.08.5-.06.44-1.13-.06-1.11 0 0-1.45.11-2.37.11-.18 0-.37 0-.58-.01C4.12 2.69 6.87 1.11 10 1.11c2.33 0 4.45.87 6.05 2.34-.68-.11-1.65.39-1.65 1.58 0 .74.45 1.36.9 2.1.35.61.55 1.36.55 2.46 0 1.49-1.4 5-1.4 5l-3.03-8.37c.54-.02.82-.17.82-.17.5-.05.44-1.25-.06-1.22 0 0-1.44.12-2.38.12-.87 0-2.33-.12-2.33-.12-.5-.03-.56 1.2-.06 1.22l.92.08 1.26 3.41zM17.41 10c.24-.64.74-1.87.43-4.25.7 1.29 1.05 2.71 1.05 4.25 0 3.29-1.73 6.24-4.4 7.78.97-2.59 1.94-5.2 2.92-7.78zM6.1 18.09C3.12 16.65 1.11 13.53 1.11 10c0-1.3.23-2.48.72-3.59C3.25 10.3 4.67 14.2 6.1 18.09zm4.03-6.63l2.58 6.98c-.86.29-1.76.45-2.71.45-.79 0-1.57-.11-2.29-.33.81-2.38 1.62-4.74 2.42-7.1z"></path></svg>
					<span class="dashicons dashicons-admin-site-alt3 global-configurator-icon" aria-hidden="true"></span>
				</button>
				<div class="mkl-pc-admin-ui__product-heading">
					<a class="mkl-pc-admin-ui__product-name" href="#" target="_blank" rel="noopener noreferrer"></a>
					<div class="mkl-pc-global-configurator--banner">
						<a class="mkl-pc-global-configurator--banner-link" href="#" title="<?php echo esc_attr__( 'Any changes you make will affect every product using it.', 'product-configurator-for-woocommerce' ); ?>"><?php esc_html_e( 'Global configurator', 'product-configurator-for-woocommerce' ); ?></a>
						<span class="mkl-pc-global-configurator--banner-plain" hidden><?php esc_html_e( 'Global configurator', 'product-configurator-for-woocommerce' ); ?></span>
					</div>
				</div>
			</div>
			<button type="button" class="mkl-pc-admin-ui__back-to-product">
				<span class="mkl-pc-admin-ui__back-chevron" aria-hidden="true"></span>
				<span class="mkl-pc-admin-ui__back-text"></span>
			</button>
			<div class="mkl-pc-admin-ui__global-focus" hidden>
				<button type="button" class="mkl-pc-global-focus__back button button-link">
					<span class="mkl-pc-admin-ui__back-chevron" aria-hidden="true"></span>
					<span class="mkl-pc-global-focus__back-text"></span>
				</button>
				<div class="mkl-pc-global-focus__title"></div>
				<p class="mkl-pc-global-focus__help description"></p>
			</div>
		</div>
		<p class="screen-reader-text mkl-pc-admin-ui__sidebar-heading"><?php esc_html_e( 'Configurator', 'product-configurator-for-woocommerce' ); ?></p>
		<div class="mkl-pc-admin-ui__sidebar-mid">
			<div class="mkl-pc-admin-ui__nav-wrap mkl-pc-admin-ui__nav-wrap--primary">
				<nav role="tablist" aria-orientation="vertical" class="mkl-pc-admin-ui__nav">
					<div class="loading-placeholder"></div>
					<div class="loading-placeholder"></div>
					<div class="loading-placeholder"></div>
					<div class="separator"></div>
					<div class="loading-placeholder"></div>
				</nav>
			</div>
			<div class="mkl-pc-admin-ui__sidebar-layers" hidden aria-hidden="true">
				<h2 class="mkl-pc-admin-ui__sidebar-layers-heading"><?php esc_html_e( 'Content', 'product-configurator-for-woocommerce' ); ?></h2>
				<div class="mkl-pc-admin-ui__sidebar-layers-filter">
					<input type="search" class="mkl-pc-list-filter-input mkl-pc-list-filter-input--sidebar-layers" placeholder="<?php echo esc_attr( __( 'Filter layers…', 'product-configurator-for-woocommerce' ) ); ?>" autocomplete="off" aria-label="<?php echo esc_attr( __( 'Filter layers', 'product-configurator-for-woocommerce' ) ); ?>" />
				</div>
				<div class="mkl-pc-admin-ui__sidebar-layers-list"></div>
			</div>
		</div>
		<div class="mkl-pc-admin-ui__sidebar-footer">
			<button type="button" class="mkl-pc-admin-ui__sidebar-primary-save button button-primary button-large pc-main-save pc-main-save-all" aria-disabled="true" aria-busy="false">
				<span class="mkl-pc-sidebar-save__content">
					<span class="mkl-pc-sidebar-save__icon dashicons dashicons-saved" aria-hidden="true"></span>
					<span class="mkl-pc-sidebar-save__spinner mkl-pc-spinner mkl-pc-spinner--sm" aria-hidden="true"></span>
					<span class="mkl-pc-sidebar-save__label"><?php esc_html_e( 'Saved', 'product-configurator-for-woocommerce' ); ?></span>
				</span>
			</button>
		</div>
	</div>
</script>

<script type="text/html" id="tmpl-mkl-pc-frame-title">
	<div class="mkl-pc-admin-ui__header">
		<h1>{{data.title}}</h1>
		<button type="button" class="button button-link mkl-pc-admin-ui__menu-toggle" aria-expanded="false">
			<?php esc_html_e( 'Menu' ); ?> <span class="dashicons dashicons-arrow-down" aria-hidden="true" aria-expanded="true"></span>
		</button>
		<span class="description">{{data.description}}</span>
	</div>
</script>

<script type="text/html" id="tmpl-mkl-pc-toolbar">
	<div class="mkl-pc-admin-ui__footer">
		<div class="mkl-pc-admin-ui__toolbar">
			<div class="mkl-pc-admin-ui__toolbar-primary">
				<span class="spinner"></span><span class="saved-message"><?php esc_html_e( 'Saved', 'product-configurator-for-woocommerce' ); ?></span>
			</div>
		</div>
	</div>
</script>

<script type="text/html" id="tmpl-mkl-pc-frame-title-buttons-notused">
	<div class="button-group mkl-pc-admin-ui__button-group">
		<button type="button" class="button button-primary button-large pc-main-save-all"><?php esc_html_e( 'Save', 'product-configurator-for-woocommerce' ); ?></button>
	</div>
</script>
<?php 
/*

STRUCTURE / VIEWS TEMPLATES (They will share the same views, using different models.)

*/
 ?>

<script type="text/html" id="tmpl-mkl-pc-structure">
	<div class="mkl-pc-admin-ui__content structure">
		<div class="structure-content has-toolbar">
			<div class="structure-toolbar">
				<div class="structure-toolbar__primary">
					<h1>{{data.title}}</h1>
					<div class="structure-toolbar__add">
						<h4><input type="text" placeholder="{{data.input_placeholder}}"></h4>
						<button type="button" class="button-primary add-layer"><span><?php esc_html_e( 'Add', 'product-configurator-for-woocommerce' ); ?></span></button>
						<# if ( data.collectionName && 'layers' == data.collectionName ) { #>
						<div class="mkl-pc-toolbar-dropdown">
							<button type="button" class="button mkl-pc-toolbar-more" aria-expanded="false" aria-haspopup="true" aria-label="<?php echo esc_attr__( 'More actions', 'product-configurator-for-woocommerce' ); ?>" title="<?php echo esc_attr__( 'More actions', 'product-configurator-for-woocommerce' ); ?>">
								<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M13 19h-2v-2h2v2zm0-6h-2v-2h2v2zm0-6h-2V5h2v2z" /></svg>
							</button>
							<div class="mkl-pc-toolbar-dropdown__menu" role="menu" hidden>
								<button type="button" role="menuitem" class="mkl-pc-toolbar-dropdown__item import-layer">
									<?php echo esc_html_x( 'Import global layer', 'Layers tab: more menu', 'product-configurator-for-woocommerce' ); ?>
								</button>
								<?php
								/**
								 * Add extra items at the top of the layers “more” menu (after Import).
								 */
								do_action( 'mkl_pc_layers_toolbar_dropdown_top' );
								?>
								<div class="mkl-pc-toolbar-dropdown__sep" role="separator" aria-hidden="true"></div>
								<div class="mkl-pc-toolbar-dropdown__label" id="mkl-pc-toolbar-order-layers-label">
									<?php echo esc_html_x( 'Order layers:', 'Layers tab: more menu section', 'product-configurator-for-woocommerce' ); ?>
								</div>
								<div class="mkl-pc-toolbar-dropdown__group" role="group" aria-labelledby="mkl-pc-toolbar-order-layers-label">
									<button type="button" role="menuitemradio" data-order_type="order" class="mkl-pc-toolbar-dropdown__item mkl-pc-toolbar-dropdown__item--choice order-layers mkl-pc-toolbar-dropdown__item--active" aria-checked="true">
										<?php echo esc_html_x( 'Order the menu', 'Layer list ordering mode', 'product-configurator-for-woocommerce' ); ?>
									</button>
									<button type="button" role="menuitemradio" data-order_type="image_order" class="mkl-pc-toolbar-dropdown__item mkl-pc-toolbar-dropdown__item--choice order-layers" aria-checked="false">
										<?php echo esc_html_x( 'Order the images', 'Layer list ordering mode', 'product-configurator-for-woocommerce' ); ?>
									</button>
								</div>
								<?php
								/**
								 * Add extra items at the bottom of the layers “more” menu.
								 */
								do_action( 'mkl_pc_layers_toolbar_dropdown' );
								?>
							</div>
						</div>
						<# } #>
					</div>
				</div>
				<div class="structure-toolbar__filter">
					<input type="search" class="mkl-pc-list-filter-input" placeholder="{{data.filter_placeholder}}" autocomplete="off" />
				</div>
			</div>
			<div class="mkl-list layers ui-sortable sortable-list">
			</div>
			<div class="floating-add">
				<button class="mkl-floating-add-item">
					<i class="dashicons dashicons-plus-alt2"></i>
					<span class="screen-reader-text"><?php esc_html_e( 'Add item here', 'product-configurator-for-woocommerce' ); ?></span>
				</button>
			</div>
		</div>
		<div class="pc-sidebar visible"></div>
	</div>
</script>
<script type="text/html" id="tmpl-mkl-pc-home">
	<div class="mkl-pc-admin-ui__content home">
		<div class="tab_content">
		<?php do_action( 'mkl_pc_admin_home_tab' ); ?>
		</div>
	</div>
</script>

<?php if ( ! class_exists( 'MKL_PC_Conditional_Logic_Admin' ) ) : ?>
<script type="text/html" id="tmpl-mkl-pc-conditional-placeholder">
	<div class="mkl-pc-admin-ui__content conditional">
		<div class="tab_content">
			<p>
				<?php
				$msg = sprintf(
					/* translators: 1: add-on name, 2: opening link tag, 3: closing link tag */
					esc_html_x( '%1$s is available as %2$san add-on%3$s.', 'First placeholder is the add-on name, second and third are the link tags to the add-on', 'product-configurator-for-woocommerce' ),
					esc_html__( 'Conditional logic', 'product-configurator-for-woocommerce' ),
					'<a href="' . esc_url( 'https://wc-product-configurator.com/product/conditional-logic/' ) . '" target="_blank" class="mkl-pc-link--external">',
					'</a>'
				);
				echo wp_kses_post( $msg );
				?>
			</p>
			<p><?php esc_html_e( 'Create complex configurations with the ability, among others, to show, hide or select items depending on various actions.', 'product-configurator-for-woocommerce' ) ?></p>
			<p><a href="#" class="hide-notice"><?php esc_html_e( "Please don't show this again.", 'product-configurator-for-woocommerce' ) ?></a></p>
		</div>
	</div>
</script>
<?php endif; ?>

<script type="text/html" id="tmpl-mkl-pc-structure-layer">
	<div class="mkl-pc-admin-list-row__inner">
		<div class="tips sort ui-sortable-handle"><svg width="24" height="24" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8 7h2V5H8v2zm0 6h2v-2H8v2zm0 6h2v-2H8v2zm6-14v2h2V5h-2zm0 8h2v-2h-2v2zm0 6h2v-2h-2v2z"></path></svg></div>
		<button type="button" class="mkl-pc-admin-list-row__hit">
			<span class="screen-reader-text"><?php echo esc_html__( 'Select layer', 'product-configurator-for-woocommerce' ); ?>: <# print( data.admin_label && data.admin_label != '' ? data.admin_label : data.name ); #></span>
		</button>
		<div class="mkl-pc-admin-list-row__body"></div>
	</div>
	<# if ( 'group' == data.type && 'order' == data.orderAttr ) { #>
		<div class="layers group-list ui-sortable sortable-list" data-item-id="{{data._id}}"></div>
	<# } #>		
</script>

<script type="text/html" id="tmpl-mkl-pc-content-layer-list-item--label">
	<div class="layer-item--image">
		<# if ( data.image.url != '' ) { #>
			<img src="{{data.image.url}}" class="layer-img" />
		<# } #>
	</div>
	<div class="layer-label-container">
		<div class="layer-label--name">
			<# if ( data.admin_label && data.admin_label != '' ) { #>
				{{data.admin_label}}
			<# } else { #>
				{{data.name}}
			<# } #>
		</div>
		<# if ( 'group' != data.type && 'angle' != data.object_type ) { #>
		<div class="layer-label--extras">
			<# if ( data.not_a_choice ) { #>
				<div class="layer-label--extras-item layer-label--extras-item--type">
					<span class="layer-label--type-icon dashicons dashicons-dismiss" aria-hidden="true"></span> <span class="layer-label--type-label"><?php esc_html_e( 'Not a choice', 'product-configurator-for-woocommerce' ); ?></span>
				</div>
			<# } else { #>
				<div class="layer-label--extras-item layer-label--extras-item--type">
					<span class="layer-label--type-icon dashicons <# print( PC.layer_type_dashicon_class( data.type ) ); #>" aria-hidden="true"></span> <span class="layer-label--type-label">{{PC.get_layer_type_label( data.type )}}</span>
				</div>
			<# } #>
			<# if ( data.is_global ) { #>
				<div class="layer-label--extras-item layer-label--extras-item--global">
					<span class="mkl-pc--global" title="<?php esc_attr_e( 'Global Layer', 'product-configurator-for-woocommerce' ); ?>">
						<span class="mkl-pc--global-icon dashicons dashicons-networking" aria-hidden="true"></span>
						<span class="mkl-pc--global-text"><?php esc_html_e( 'Global', 'product-configurator-for-woocommerce' ); ?></span>
					</span>
				</div>
			<# } #>
		</div>
		<# } #>
	</div>
</script>

<script type="text/html" id="tmpl-mkl-pc-structure-angle-form">
	<div class="form-details">
		<header>
			<h2>
				<?php esc_html_e('Details', 'product-configurator-for-woocommerce' ); ?>
			</h2>
			<div class="actions-container">
				<?php echo mkl_pc_get_admin_actions(); ?>
			</div>
		</header>

		<?php do_action('mkl_pc_angle_fields') ?>
		<?php do_action('mkl_pc_angle_settings') ?>
	</div>

	<div class="mkl-pc-image-settings">
		<h2><?php esc_html_e('Angles\'s picture', 'product-configurator-for-woocommerce' ) ?></h2>
		<div class="thumbnail thumbnail-image">
			<# if ( data.image.url != '' ) { #>
				<img src="{{data.image.url}}" height="40" class="layer-img" />
			<# } #>
		</div>
		<a class="edit-attachment" href="#"><?php esc_html_e('Add / Change picture', 'product-configurator-for-woocommerce' ) ?></a>
		<# if ( data.image.url != '' ) { #>
			| <a class="remove-attachment" href="#"><?php esc_html_e('Remove picture', 'product-configurator-for-woocommerce' ) ?></a>
		<# } #>
	</div>
</script>

<script type="text/html" id="tmpl-mkl-pc-structure-layer-form">
	<div class="form-details">
		<# if ( data.is_global ) { #>
			<div class="mkl-pc-global-layer-heading">
				<h4><span class="dashicons dashicons-networking" aria-hidden="true"></span> <?php esc_html_e( 'Global layer', 'product-configurator-for-woocommerce' ); ?></h4>
				<div class="mkl-pc-global-layer--actions">
					<# if ( data.is_editing_global_layer ) { #>
						<button type="button" class="button button-small cancel-global"><?php esc_html_e( 'Cancel', 'product-configurator-for-woocommerce' ); ?></button>
					<# } else { #>
						<button type="button" class="button button-small unlink-global"><?php esc_html_e( 'Unlink from Global', 'product-configurator-for-woocommerce' ); ?></button>
						<button type="button" class="button button-small button-primary edit-global"><?php esc_html_e( 'Edit global layer', 'product-configurator-for-woocommerce' ); ?></button>
					<# } #>
				</div>
			</div>
		<# } #>
		<header>
			<h2><?php esc_html_e('Details', 'product-configurator-for-woocommerce' ) ?> - [ID: {{data._id}}]</h2>
			<div class="actions-container">
				<?php echo mkl_pc_get_admin_actions(); ?>
				<# if ( !data.is_global ) { #>
					<button type="button" class="button-link make-global"><?php esc_html_e( 'Make Global', 'product-configurator-for-woocommerce' ); ?></button>
				<# } #>
			</div>
		</header>

		<?php do_action('mkl_pc_layer_fields') ?>

		<?php do_action('mkl_pc_layer_settings') ?>
	</div>

	<# if ( 'summary' != data.type ) { #>
		<div class="mkl-pc-image-settings">
			<h2><?php esc_html_e('Layer\'s icon', 'product-configurator-for-woocommerce' ) ?></h2>
			<div class="thumbnail thumbnail-image">
				<# if ( data.image.url != '' ) { #>
					<img src="{{data.image.url}}" height="40" class="layer-img" />
				<# } #>
			</div>
			<a class="edit-attachment" href="#"><?php esc_html_e('Add / Change picture', 'product-configurator-for-woocommerce' ) ?></a>
			<# if ( data.image.url != '' ) { #>
				| <a class="remove-attachment" href="#"><?php esc_html_e('Remove picture', 'product-configurator-for-woocommerce' ) ?></a>
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
	<div class="mkl-pc-admin-ui__content content">
		<div class="content-col content-choices-list">
			<p class="mkl-pc-content-placeholder"><?php esc_html_e( 'No layer selected', 'product-configurator-for-woocommerce' ); ?></p>
		</div>
		<div class="content-col content-choice pc-sidebar choice-details">
			<p class="mkl-pc-content-placeholder"><?php esc_html_e( 'Choice details', 'product-configurator-for-woocommerce' ); ?></p>
		</div>
	</div>
</script>

<script type="text/html" id="tmpl-mkl-pc-content-layer">
	<button type="button" class="layer mkl-list-item">
		<span class="name">
			<# if ( data.admin_label && data.admin_label != '' ) { #>
				{{data.admin_label}}
			<# } else { #>
				{{data.name}}
			<# } #>
		</span>
		<# if ( data.is_global ) { #>
			<span class="mkl-pc-badge mkl-pc-badge--global" title="<?php esc_attr_e( 'Global Layer', 'product-configurator-for-woocommerce' ); ?>"><span class="dashicons dashicons-networking" aria-hidden="true"></span> <?php esc_html_e( 'Global', 'product-configurator-for-woocommerce' ); ?></span>
		<# } #>
		<span class="number-of-choices">{{data.choices_number}}</span>
	</button>
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
	<div class="structure-toolbar structure-toolbar--choices">
		<div class="global-actions-container">
			<h3><span class="dashicons dashicons-lock" aria-hidden="true"></span><span class="dashicons dashicons-unlock" aria-hidden="true"></span> <?php esc_html_e( 'Global layer', 'product-configurator-for-woocommerce' ); ?></h3>
			<button type="button" class="button button-small cancel-edit-choices"><?php esc_html_e( 'Cancel', 'product-configurator-for-woocommerce' ); ?></button>
			<button type="button" class="button button-small edit-choices"><?php esc_html_e( 'Edit choices', 'product-configurator-for-woocommerce' ); ?></button>
		</div>
		<# if ( !data.is_global || data.is_editing_choices ) { #>
		<div class="structure-toolbar__primary">
			<h1><?php esc_html_e( 'Choices', 'product-configurator-for-woocommerce' ); ?></h1>
			<div class="structure-toolbar__add">
				<h4><input type="text" placeholder="{{PC.lang.choice_new_placeholder}}" <# if ( data.is_global && ! data.is_editing_choices ) { #>disabled<# } #>></h4>
				<button type="button" class="button-primary add-layer" <# if ( data.is_global && ! data.is_editing_choices ) { #>disabled<# } #>><span><?php esc_html_e( 'Add', 'product-configurator-for-woocommerce' ); ?></span></button>
			</div>
		</div>
		<# } #>
		<div class="structure-toolbar__filter">
			<input type="search" class="mkl-pc-list-filter-input" placeholder="{{PC.lang.list_filter_placeholder}}" autocomplete="off" />
		</div>
	</div>
	<div class="mkl-list choices ui-sortable sortable-list"></div>
	<# if ( data.has_clipboard_data ) { #> 
	<div class="paste">
		<button type="button" class="button-primary paste-items"><span><?php esc_html_e( 'Paste', 'product-configurator-for-woocommerce' ); ?></span></button>
	</div>
	<# } #> 
</script>

<script type="text/html" id="tmpl-mkl-pc-content-choice-list-item">
	<div class="mkl-pc-admin-list-row__inner">
		<div class="tips sort ui-sortable-handle"><svg width="24" height="24" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8 7h2V5H8v2zm0 6h2v-2H8v2zm0 6h2v-2H8v2zm6-14v2h2V5h-2zm0 8h2v-2h-2v2zm0 6h2v-2h-2v2z"></path></svg></div>
		<button type="button" class="mkl-pc-admin-list-row__hit">
			<span class="screen-reader-text"><?php echo esc_html__( 'Select choice', 'product-configurator-for-woocommerce' ); ?>: <# print( data.admin_label && data.admin_label != '' ? data.admin_label : data.name ); #></span>
		</button>
		<div class="mkl-pc-admin-list-row__body">
			<# if ( data.display_label ) { #>
				<h3>{{data.name}}</h3>
			<# } #>
		</div>
	</div>
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
			<h2><?php esc_html_e('Choice informations', 'product-configurator-for-woocommerce' ) ?> [ID: {{data._id}}]</h2>
			<div class="actions-container">
				<?php echo mkl_pc_get_admin_actions(); ?>
			</div>
		</header>

		<div class="options">
			<?php do_action('mkl_pc_choice_fields') ?>
			<div class="clear"></div>
		</div>

		<# if ( wp.hooks.applyFilters( 'PC.admin.show_choice_images', true, data ) ) { #>
			<div class="options mkl-pc-image-settings">
				<# if ( data.is_group ) { #>
					<h3><?php esc_html_e( 'Group thumbnail', 'product-configurator-for-woocommerce' ) ?></h3>
				<# } else if ( 'text-overlay' == data.layer_type ) { #>
					<h3><?php esc_html_e( 'Text positions', 'product-configurator-for-woocommerce' ) ?></h3>
				<# } else { #>
					<h3><?php esc_html_e( 'Pictures', 'product-configurator-for-woocommerce' ) ?></h3>
				<# } #>
				<div class="views">
					
				</div>
			</div>
		<# } #>
	</div>
</script>

<script type="text/html" id="tmpl-mkl-pc-multiple-edit-form">
	<div class="form-details">
		<h3><?php esc_html_e('Multiple selection', 'product-configurator-for-woocommerce' ) ?></h3>
		<div class="form-info">
			<div class="details">
				<div class="multiple-edit--action">
					<button type="button" class="button-link delete delete-layer" data-delete="prompt"><?php esc_html_e('Delete the selected items', 'product-configurator-for-woocommerce' ) ?></button>
					<div class="prompt-delete hidden notice">
						<p><?php esc_html_e( 'Do you realy want to delete the selected items?', 'product-configurator-for-woocommerce' ); ?></p>
						<p>
							<button type="button" class="button button-primary delete confirm-delete-layer" data-delete="confirm"><?php esc_html_e('Delete', 'product-configurator-for-woocommerce' ) ?></button>
							<button type="button" class="button cancel-delete-layer" data-delete="cancel"><?php esc_html_e('Cancel', 'product-configurator-for-woocommerce' ) ?></button>
						</p>
					</div>
				</div>
				<div class="multiple-edit--action">
					<h3><?php esc_html_e( 'Reorder the selected items', 'product-configurator-for-woocommerce' ) ?></h3>
					<div class="order">
						<button class="button up" type="button"><i class="dashicons dashicons-arrow-up-alt2"></i></button>
						<button class="button down" type="button"><i class="dashicons dashicons-arrow-down-alt2"></i></button>
					</div>
				</div>
				<div class="multiple-edit--action">
					<h3><?php esc_html_e( 'Copy the selected items', 'product-configurator-for-woocommerce' ) ?></h3>
					<div class="copy">
						<button type="button" class="button button-primary"><?php esc_html_e( 'Copy items', 'product-configurator-for-woocommerce' ) ?></button>
					</div>
				</div>
				<# if ( data.render_group ) { #>
					<div class="multiple-edit--action">
						<h3><?php esc_html_e( 'Create a group with the selected items', 'product-configurator-for-woocommerce' ) ?></h3>
						<div class="group">
							<input type="text" placeholder="<?php esc_attr_e( 'Group name', 'product-configurator-for-woocommerce' ); ?>" >
							<button type="button" class="button button-primary"><?php esc_html_e( 'Group items', 'product-configurator-for-woocommerce' ) ?></button>
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
			<span><?php esc_html_e( 'Main Image', 'product-configurator-for-woocommerce' ); ?></span>
			<# if(data.image.url != '' ) { #>
			<img class="edit-attachment" src="{{data.image.url}}" alt="">
			<# } else { #>
			<img class="edit-attachment" src="<?php echo esc_url( MKL_PC_ASSETS_URL.'admin/images/empty.jpg' ); ?>" alt="">
			<# } #>

			<a class="edit-attachment" href="#">
				<span class="screen-reader-text"><?php esc_html_e( 'Add / Edit image', 'product-configurator-for-woocommerce' ); ?></span>
				<# if ( data.image.url != '' ) { #>
					<span class="dashicons dashicons-edit"></span>
				<# } else { #>
					<span class="dashicons dashicons-plus"></span>
				<# } #>
			</a>

			<# if ( data.image.url != '' ) { #>
				<a class="remove-attachment" href="#"><span class="dashicons dashicons-no"></span><span class="screen-reader-text"><?php esc_html_e('Remove picture', 'product-configurator-for-woocommerce' ) ?></span></a>
			<# } #>
		</div>
		<# } #>
		<# if ( data && data.angle && data.angle.has_thumbnails ) { #>
			<div class="picture thumbnail-picture" data-edit="thumbnail">
				<# if ( ! data.is_group ) { #><span><?php esc_html_e( 'Thumbnail', 'product-configurator-for-woocommerce' ); ?></span><# } #>
				<# if ( data.thumbnail.url != '' ) { #>
				<img class="edit-attachment" src="{{data.thumbnail.url}}" alt="">
				<# } else { #>
				<img class="edit-attachment" src="<?php echo esc_url( MKL_PC_ASSETS_URL.'admin/images/empty.jpg' ); ?>" alt="">
				<# } #>

				<a class="edit-attachment" href="#">
					<span class="screen-reader-text"><?php esc_html_e( 'Add / Edit image', 'product-configurator-for-woocommerce' ); ?></span>
					<# if ( data.thumbnail.url != '' ) { #>
						<span class="dashicons dashicons-edit"></span>
					<# } else { #>
						<span class="dashicons dashicons-plus"></span>
					<# } #>
				</a>
				<# if ( data.thumbnail.url != '' ) { #>
					<a class="remove-attachment" href="#"><span class="dashicons dashicons-no"></span><span class="screen-reader-text"><?php esc_html_e('Remove picture', 'product-configurator-for-woocommerce' ) ?></span></a>
				<# } #>
			</div>
		<# } #>
		<div class="clear"></div>
	</div>
</script>

<script type="text/html" id="tmpl-mkl-pc-content-no-data">
	<div class="mkl-pc-admin-ui__content content">
		<div class="no-data">
			<p>
				<?php esc_html_e( 'You need to have Layers and Angles set before entering any content.', 'product-configurator-for-woocommerce' ); ?>
			</p>
		</div>	
	</div>
</script>

<script type="text/html" id="tmpl-mkl-pc-product-selector">
	<div class="mkl-pc-product-selector">
		<h3><?php esc_html_e( 'Select a product:', 'product-configurator-for-woocommerce' ); ?></h3>
		<select style="width: 100%;" class="wc-product-search" name="linked_woocommerce_products[]" data-placeholder="<?php esc_attr_e( 'Search for a product&hellip;', 'woocommerce' ); ?>" data-action="woocommerce_json_search_products_and_variations" data-limit="200">
		</select>
		<button class="button button-primary select" disabled><?php esc_html_e( 'Choose', 'product-configurator-for-woocommerce' ); ?></button>
		<button class="button cancel"><?php esc_html_e( 'Cancel', 'product-configurator-for-woocommerce' ); ?></button>
	</div>
</script>

<?php 
/*

IMPORT / EXPORT

*/
 ?>
<script type="text/html" id="tmpl-mkl-pc-import-export">
	<div class="mkl-pc-admin-ui__content import-export">
		<div class="import-export-content">
			<div class="import">
				<h3><?php esc_html_e( 'Import', 'product-configurator-for-woocommerce' ); ?></h3>
				<p><button class="button" data-action="import-from-file"><?php esc_html_e( 'Import configuration', 'product-configurator-for-woocommerce' ); ?></button></p>
				<!-- <p><?php esc_html_e( 'Or', 'product-configurator-for-woocommerce' ); ?></p>
				<p><button class="button" data-action="import-from-product"><?php esc_html_e( 'Import an other product', 'product-configurator-for-woocommerce' ); ?></button></p> -->
			</div>
			<div class="export">
				<h3><?php esc_html_e( 'Export', 'product-configurator-for-woocommerce' ); ?></h3>
				<p><button class="button" data-action="export-data"><?php esc_html_e( 'Export configuration data', 'product-configurator-for-woocommerce' ); ?></button></p>
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
	<h3><?php esc_html_e( 'Choose a product', 'product-configurator-for-woocommerce' ); ?></h3>
	<select style="width: 50%;" class="wc-product-search" name="linked_woocommerce_products[]" data-placeholder="<?php esc_attr_e( 'Search for a product&hellip;', 'woocommerce' ); ?>" data-action="woocommerce_json_search_products_and_variations">
	</select>
	<button class="button next" disabled><?php echo esc_html_x( 'Next', 'Next button label, in the admin import screen', 'product-configurator-for-woocommerce' ); ?></button>
</script>

<script type="text/html" id="tmpl-mkl-pc-importer--file-upload">
	<h3><?php esc_html_e( 'Select a file', 'product-configurator-for-woocommerce' ); ?></h3>
	<p><?php esc_html_e( 'Select the JSON file you exported previously.', 'product-configurator-for-woocommerce' ); ?></p>
	<input type="file" id="jsonfileinput" />
</script>

<script type="text/html" id="tmpl-mkl-pc-importer--configuration-preview">
	<div class="preview-action">
		<h3><?php esc_html_e( 'Preview', 'product-configurator-for-woocommerce' ); ?></h3>
		<p><?php esc_html_e( 'Review the data and press Import data to import it to this product.', 'product-configurator-for-woocommerce' ); ?></p>
		<p><strong><?php esc_html_e( 'Note that any existing configuration will be overriden.', 'product-configurator-for-woocommerce' ); ?></strong></p>
		<button class="import-selected button button-primary" type="button"><?php esc_html_e( 'Import data', 'product-configurator-for-woocommerce' ); ?></button>
	</div>
	<div class="preview-content">
		<# if ( data.layers ) { #>
			<div class="preview-content--collection">
				<h4><?php esc_html_e( 'Layers and content:', 'product-configurator-for-woocommerce' ); ?></h4>
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
				<h4><?php esc_html_e( 'Angles:', 'product-configurator-for-woocommerce' ); ?></h4>
				<ul class="ul-disc">
					<# PC._us.each( data.angles, function( angle ) { #>
						<li>{{angle.name}}</li>
					<# }); #>
				</ul>
			</div>
		<# } #>

		<# if ( data.conditions ) { #>
			<div class="preview-content--collection">
				<h4><?php esc_html_e( 'Conditions', 'product-configurator-for-woocommerce' ); ?></h4>
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
	<h3><?php esc_html_e( 'Configuration imported', 'product-configurator-for-woocommerce' ); ?></h3>
	<p><?php esc_html_e( 'The data is loaded in the editor but not saved to this product yet. Review layers, angles, content, and conditions, then save when everything looks correct.', 'product-configurator-for-woocommerce' ); ?></p>
	<p><?php esc_html_e( 'You can save from the sidebar or with the button below—the result is the same.', 'product-configurator-for-woocommerce' ); ?></p>
	<button type="button" class="button primary save"><?php esc_html_e( 'Save', 'product-configurator-for-woocommerce' ); ?></button>
	<h4><?php esc_html_e( 'Importing from a different site?', 'product-configurator-for-woocommerce' ); ?></h4>
    <p><?php esc_html_e( 'When importing from a different site, the images need to be added to the library separately.', 'product-configurator-for-woocommerce' ); ?></p>
    <p><?php esc_html_e( 'If you already imported the matching images to the library, you can use the following tool to try to match the images.', 'product-configurator-for-woocommerce' ); ?></p>

	<button type="button" class="button primary save-and-fix-images"><?php esc_html_e( 'Save and fix images', 'product-configurator-for-woocommerce' ); ?></button>
</script>

<script type="text/html" id="tmpl-mkl-pc-importer--layers">
	<# if ( ! data ) { #>
		<h3><?php esc_html_e( 'No product selected', 'product-configurator-for-woocommerce' ); ?></h3>
	<# } else { #>
		<# if ( data.product_name ) { #><h3>{{data.product_name}}</h3><# } #>
		<div class="form">
			<h4><?php esc_html_e( 'New layers', 'product-configurator-for-woocommerce' ); ?></h4>
			<label><input type="radio" required name="which-layers" value="everything"> Import all layers</label>
			<label><input type="radio" required name="which-layers" value="selected"> Import selected layers</label>
			
			<h4><?php esc_html_e( 'Existing layers', 'product-configurator-for-woocommerce' ); ?></h4>
			<label><input type="radio" required name="existing-layers" value="append"><?php esc_html_e( 'Add to existing layers', 'product-configurator-for-woocommerce' ); ?></label>
			<label><input type="radio" required name="existing-layers" value="append-no-duplicate"><?php esc_html_e( 'Add to existing with no duplicates', 'product-configurator-for-woocommerce' ); ?></label>
			<label><input type="radio" required name="existing-layers" value="replace"><?php esc_html_e( 'Replace existing layers', 'product-configurator-for-woocommerce' ); ?></label>

			<h4><?php esc_html_e( 'Layers thumbnails', 'product-configurator-for-woocommerce' ); ?></h4>
			<label><input type="checkbox" name="layer-thumbnails" value="1"><?php esc_html_e( 'Import thumbnails', 'product-configurator-for-woocommerce' ); ?></label>

			<button class="button next"><?php echo esc_html_x( 'Next', 'Next button label, in the admin import screen', 'product-configurator-for-woocommerce' ); ?></button>
		</div>
		<div class="selector-container">
		</div>
	<# } #>
</script>

<script type="text/html" id="tmpl-mkl-pc-importer--angles">
	<# if ( ! data ) { #>
		<h3><?php esc_html_e( 'No product selected', 'product-configurator-for-woocommerce' ); ?></h3>
	<# } else { #>
		<# if ( data.product_name ) { #><h3>{{data.product_name}}</h3><# } #>
		<div class="form">
			<h4><?php esc_html_e( 'New angles', 'product-configurator-for-woocommerce' ); ?></h4>
			<label><input type="radio" required name="which-angles" value="everything"><?php esc_html_e( 'Import all angles', 'product-configurator-for-woocommerce' ); ?></label>
			<label><input type="radio" required name="which-angles" value="selected"><?php esc_html_e( 'Import selected angles', 'product-configurator-for-woocommerce' ); ?></label>
			
			<h4><?php esc_html_e( 'Existing angles', 'product-configurator-for-woocommerce' ); ?></h4>
			<label><input type="radio" required name="existing-angles" value="append"><?php esc_html_e( 'Add to existing angles', 'product-configurator-for-woocommerce' ); ?></label>
			<label><input type="radio" required name="existing-angles" value="append-no-duplicate"><?php esc_html_e( 'Add to existing with no duplicates', 'product-configurator-for-woocommerce' ); ?></label>
			<label><input type="radio" required name="existing-angles" value="replace"><?php esc_html_e( 'Replace existing angles', 'product-configurator-for-woocommerce' ); ?></label>

			<h4><?php esc_html_e( 'Angles thumbnails', 'product-configurator-for-woocommerce' ); ?></h4>
			<label><input type="checkbox" name="angle-thumbnails" value="1"><?php esc_html_e( 'Import thumbnails', 'product-configurator-for-woocommerce' ); ?></label>

			<button class="button next"><?php echo esc_html_x( 'Next', 'Next button label, in the admin import screen', 'product-configurator-for-woocommerce' ); ?></button>
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
		{{data.name}} <# if ( data.image && data.image.url ) { #><img src="{{data.image.url}}" alt=""><# } #>
	</a>
</script>

<script type="text/html" id="tmpl-mkl-pc-setting--repeater">
	<div class="options-list"></div>
	<?php do_action( 'tmpl-mkl-pc-setting--repeater' ); ?>
	<button class="button add-option" type="button"><i class="dashicons dashicons-plus"></i> <?php esc_html_e( 'Add option', 'product-configurator-for-woocommerce' ); ?></button>
</script>

<script type="text/html" id="tmpl-mkl-pc-import-global-layer">
	<div class="mkl-pc-import-global-layer">
		<div class="mkl-pc-import-global-layer__toolbar">
			<input type="text" class="global-layers-filter" placeholder="<?php esc_attr_e( 'Filter by name…', 'product-configurator-for-woocommerce' ); ?>" autocomplete="off" />
		</div>
		<div class="global-layers-list">
			<div class="mkl-pc-spinner" aria-hidden="true"></div>
		</div>
		<div class="mkl-pc-admin-dialog__footer-actions">
			<button type="button" class="button button-primary import-selected" disabled><?php esc_html_e( 'Import Selected', 'product-configurator-for-woocommerce' ); ?></button>
			<button type="button" class="button mkl-pc-admin-dialog__cancel cancel"><?php esc_html_e( 'Cancel', 'product-configurator-for-woocommerce' ); ?></button>
		</div>
	</div>
</script>

<script type="text/html" id="tmpl-mkl-pc-global-layer-item">
	<div class="global-layer-item" data-global-id="{{data.global_id}}">
		<label>
			<input type="radio" name="global_layer_selection" value="{{data.global_id}}">
			<div class="layer-info">
				<h4>{{data.name}}<# if ( data.admin_label && data.admin_label != data.name ) { #> <span class="admin-label">({{data.admin_label}})</span><# } #></h4>
				<# if ( data.image && data.image.url ) { #>
					<img src="{{data.image.url}}" class="layer-thumbnail" alt="">
				<# } #>
				<# if ( data.type ) { #>
					<span class="layer-type"><?php esc_html_e( 'Type:', 'product-configurator-for-woocommerce' ); ?> {{data.type}}</span>
				<# } #>
			</div>
		</label>
	</div>
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
		<label>
			{{field.label}}
			<input name="{{key}}" type="{{field.type || 'text'}}" value="{{data[key]}}" placeholder="{{field.placeholder || ''}}">
		</label>
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
	<button class="button remove-option" type="button"><i class="dashicons dashicons-remove"></i><span><?php esc_html_e( 'Remove option', 'product-configurator-for-woocommerce' ); ?></span></button>
</script>

<?php do_action('mkl_pc_admin_templates_after') ?>