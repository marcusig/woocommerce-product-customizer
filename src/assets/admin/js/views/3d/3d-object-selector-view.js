/**
 * Admin 3D object selector modal view and PC.actions.select_3d_object.
 * Depends on PC.threeD.store, PC.threeD.getGltfLoader, PC.threeD.resolveChoiceModelUrl.
 */
const $ = window.jQuery;
const Backbone = window.Backbone;
const wp = window.wp;

const ObjectSelector3DView = Backbone.View.extend( {
	tagName: 'div',
	className: 'mkl-pc-3d-object-selector--container',
	template: wp.template( 'mkl-pc-3d-object-selector' ),
	events: {
		'click .button.select': 'select',
		'click .button.cancel': 'close',
		'input .mkl-pc-3d-object-selector--filter-input': 'on_filter_input',
		'click .mkl-pc-3d-object-selector--tree [data-object-id]': 'on_tree_item_click',
	},
	initialize( options ) {
		this.options = options || {};
		this.originals = { target: this.options.target, context: this.options.context };
		this.modelUrl = this.options.modelUrl || null;
		this.attachmentId = this.options.attachmentId != null ? this.options.attachmentId : null;
		this.treeNodes = [];
		this.selectedId = null;
		this.selectedName = null;
		this.setting = this.options.setting || null;
		this.applySelection = typeof this.options.applySelection === 'function' ? this.options.applySelection : null;
		this._loader = window.PC.threeD.getGltfLoader();
	},
	render() {
		this.$el.html( this.template( {} ) );
		this.$tree = this.$( '.mkl-pc-3d-object-selector--tree' );
		this.$filterInput = this.$( '.mkl-pc-3d-object-selector--filter-input' );
		this.$selectBtn = this.$( '.button.select' );
		this.resolveAndLoad();
		return this;
	},
	resolveAndLoad() {
		let url = this.modelUrl;
		if ( url ) {
			this.loadModel( url );
			return;
		}
		if ( this.attachmentId ) {
			const attachment = wp.media.attachment( this.attachmentId );
			attachment.fetch().done( () => {
				const att = attachment.toJSON();
				url = att.gltf_url || att.url;
				if ( url ) this.loadModel( url );
				else this.showError( 'Could not get model URL from attachment.' );
			} ).fail( () => this.showError( 'Failed to load attachment.' ) );
			return;
		}
		if ( this.originals.context && this.originals.context.model && this.options.resolveOptions && typeof window.PC.threeD.resolveModelUrl === 'function' ) {
			window.PC.threeD.resolveModelUrl( this.originals.context.model, this.options.resolveOptions, ( resolvedUrl ) => {
				if ( resolvedUrl ) this.loadModel( resolvedUrl );
				else this.showError( 'No 3D file for this source. Set the main model in the 3D tab or use an uploaded model.' );
			} );
			return;
		}
		this.showError( 'No 3D file to browse. Pass modelUrl or set main/uploaded model.' );
	},
	showError( message ) {
		this.$tree.closest( '.mkl-pc-3d-object-selector--tree-container' ).html( '<p class="description">' + ( message || 'No objects to list.' ) + '</p>' );
	},
	loadModel( url ) {
		const view = this;
		window.PC.threeD.store.get( url, ( err, data ) => {
			if ( err || ! data ) {
				view.showError( 'Failed to load the 3D model.' );
				return;
			}
			view.treeNodes = data.objectTree || [];
			view.renderTree( view.treeNodes );
		} );
	},
	renderTree( nodes ) {
		const filter = ( this.$filterInput && this.$filterInput.val() ) ? this.$filterInput.val().toLowerCase() : '';
		const filtered = filter ? nodes.filter( ( n ) => ( n.name && n.name.toLowerCase().indexOf( filter ) !== -1 ) || ( n.id && String( n.id ).toLowerCase().indexOf( filter ) !== -1 ) ) : nodes;
		this.$tree.empty();
		filtered.forEach( ( node ) => {
			const indent = ( node.depth || 0 ) * 16;
			const display = ( node.name || node.id || '' ) + ' [' + ( node.type || '' ) + ']';
			const $li = $( '<li class="mkl-pc-3d-object-selector--item" data-object-id="' + ( node.id || '' ).replace( /"/g, '&quot;' ) + '" data-object-name="' + ( node.name || '' ).replace( /"/g, '&quot;' ) + '" style="padding-left:' + indent + 'px;">' ).text( display );
			this.$tree.append( $li );
		} );
	},
	on_filter_input() {
		this.renderTree( this.treeNodes );
	},
	on_tree_item_click( e ) {
		const $item = $( e.currentTarget );
		this.selectedId = $item.data( 'object-id' );
		this.selectedName = $item.data( 'object-name' ) || this.selectedId;
		this.$( '.mkl-pc-3d-object-selector--item' ).removeClass( 'selected' );
		$item.addClass( 'selected' );
		this.$selectBtn.prop( 'disabled', false );
	},
	select() {
		if ( this.selectedId != null ) {
			const payload = { id: this.selectedId, name: this.selectedName, setting: this.setting };
			if ( this.applySelection ) this.applySelection( payload );
			else if ( this.originals.context && this.originals.context.$el ) this.originals.context.$el.trigger( 'object_selected', payload );
		}
		this.close();
	},
	close() {
		this.remove();
	},
} );

function select_3d_object( $el, context ) {
	const opts = { target: $el, context };
	if ( $el && $el.data( 'model-url' ) ) opts.modelUrl = $el.data( 'model-url' );
	if ( ! opts.modelUrl && context && context.collectionName === 'angles' && window.PC.app && window.PC.app.admin && window.PC.app.admin.settings_3d && window.PC.app.admin.settings_3d.url ) {
		opts.modelUrl = window.PC.app.admin.settings_3d.url;
	}
	if ( $el && $el.data( 'attachment-id' ) != null ) opts.attachmentId = $el.data( 'attachment-id' );
	opts.setting = $el?.data( 'setting' ) || 'object_id_3d';
	opts.resolveOptions = opts.setting === 'camera_target_object_id'
		? { sourceKey: 'camera_target_model', uploadKey: null }
		: { sourceKey: 'object_selection_3d', uploadKey: 'model_upload_3d' };
	opts.applySelection = function( selection ) {
		const id = selection?.id;
		if ( id == null ) return;
		if ( context && context.model && typeof context.model.set === 'function' ) {
			context.model.set( opts.setting, id );
			if ( context.collectionName && window.PC.app && window.PC.app.is_modified ) {
				window.PC.app.is_modified[ context.collectionName ] = true;
			} else if ( window.PC.app && window.PC.app.is_modified ) {
				window.PC.app.is_modified.layers = true;
			}
		}
		const $root = context?.$el && context.$el.length ? context.$el : $( document );
		const $input = $root.find( '[data-setting="' + opts.setting + '"]' ).first();
		if ( $input && $input.length ) $input.val( id );
	};
	const view = new ObjectSelector3DView( opts );
	view.$el.appendTo( 'body' );
	view.render();
}

window.PC = window.PC || {};
window.PC.views = window.PC.views || {};
window.PC.views.object_selector_3d = ObjectSelector3DView;
window.PC.actions = window.PC.actions || {};
window.PC.actions.select_3d_object = select_3d_object;
