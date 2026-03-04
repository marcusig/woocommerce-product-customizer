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
				else this.showError( 'No 3D file for this source. Use a 3D object or uploaded model.' );
			} );
			return;
		}
		this.showError( 'No 3D file to browse. Pass modelUrl or use a 3D object/uploaded model.' );
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

const ObjectSelector3DMultiView = Backbone.View.extend( {
	tagName: 'div',
	className: 'mkl-pc-3d-object-selector--container',
	template: wp.template( 'mkl-pc-3d-object-selector-multi' ),
	events: {
		'click .button.select': 'select',
		'click .button.cancel': 'close',
		'input .mkl-pc-3d-object-selector--filter-input': 'on_filter_input',
	},
	initialize( options ) {
		this.options = options || {};
		this.originals = { target: this.options.target, context: this.options.context };
		this.modelUrl = this.options.modelUrl || null;
		this.attachmentId = this.options.attachmentId != null ? this.options.attachmentId : null;
		this.treeNodes = [];
		this.initialSelectedIds = Array.isArray( this.options.initialSelectedIds ) ? this.options.initialSelectedIds : [];
		this.setting = this.options.setting || 'camera_focus_object_ids';
		this.applySelection = typeof this.options.applySelection === 'function' ? this.options.applySelection : null;
		this.loadAllSceneModels = this.setting === 'camera_focus_object_ids' && this.originals.context && this.originals.context.collectionName === 'angles';
	},
	render() {
		this.$el.html( this.template( {} ) );
		this.$tree = this.$( '.mkl-pc-3d-object-selector--tree' );
		this.$filterInput = this.$( '.mkl-pc-3d-object-selector--filter-input' );
		this.resolveAndLoad();
		return this;
	},
	resolveAndLoad() {
		if ( this.loadAllSceneModels && window.PC.threeD && typeof window.PC.threeD.getObjects3DModelSources === 'function' ) {
			this.loadAllSceneModelsAndRender( window.PC.threeD.getObjects3DModelSources );
			return;
		}
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
				else this.showError( 'No 3D file for this source. Use a 3D object or uploaded model.' );
			} );
			return;
		}
		this.showError( 'No 3D file to browse. Pass modelUrl or use a 3D object/uploaded model.' );
	},
	loadAllSceneModelsAndRender( getSources ) {
		const view = this;
		if ( ! window.PC.threeD.store || typeof window.PC.threeD.store.get !== 'function' ) {
			view.showError( '3D store not ready. Please try again.' );
			return;
		}
		const getter = typeof getSources === 'function' ? getSources : null;
		if ( ! getter ) {
			view.showError( 'No 3D objects. Add models in 3D Objects.' );
			return;
		}
		getter( ( err, sources ) => {
			if ( err || ! sources || ! sources.length ) {
				view.showError( 'No 3D objects. Add models in 3D Objects.' );
				return;
			}
			const results = new Array( sources.length );
			let pending = sources.length;
			sources.forEach( ( src, idx ) => {
				window.PC.threeD.store.get( src.url, ( loadErr, data ) => {
					if ( ! loadErr && data && data.objectTree && data.objectTree.length ) {
						results[ idx ] = { sourceLabel: src.sourceLabel, objectTree: data.objectTree };
					} else {
						results[ idx ] = null;
					}
					pending--;
					if ( pending <= 0 ) {
						const combined = [];
						results.forEach( ( r, idx ) => {
							if ( ! r ) return;
							const src = sources[ idx ];
							const sourceId = src && src.sourceId ? String( src.sourceId ) : null;
							combined.push( { subheader: r.sourceLabel } );
							r.objectTree.forEach( ( node ) => {
								const objectName = node.name || node.id || '';
								const id = sourceId ? sourceId + ':' + objectName : objectName;
								combined.push( {
									id,
									name: objectName,
									type: node.type || '',
									depth: node.depth != null ? node.depth : 0,
									subheader: null,
								} );
							} );
						} );
						view.treeNodes = combined;
						view.renderTree( combined );
					}
				} );
			} );
		} );
	},
	showError( message ) {
		this.$tree.closest( '.mkl-pc-3d-object-selector--tree-container' ).html( '<p class="description">' + ( message || 'No objects to list.' ) + '</p>' );
	},
	loadModel( url ) {
		const view = this;
		if ( ! window.PC.threeD || ! window.PC.threeD.store || typeof window.PC.threeD.store.get !== 'function' ) {
			view.showError( '3D store not ready. Please try again.' );
			return;
		}
		window.PC.threeD.store.get( url, ( err, data ) => {
			if ( err || ! data ) {
				view.showError( 'Failed to load the 3D model.' );
				return;
			}
			// Full object tree from the model (same as single-select; hierarchy with depth)
			view.treeNodes = data.objectTree || [];
			view.renderTree( view.treeNodes );
		} );
	},
	renderTree( nodes ) {
		const filter = ( this.$filterInput && this.$filterInput.val() ) ? this.$filterInput.val().toLowerCase() : '';
		let filtered;
		if ( ! filter ) {
			filtered = nodes;
		} else {
			filtered = [];
			let lastSubheader = null;
			const matches = ( n ) => ( n.name && n.name.toLowerCase().indexOf( filter ) !== -1 ) || ( n.id && String( n.id ).toLowerCase().indexOf( filter ) !== -1 );
			nodes.forEach( ( node ) => {
				if ( node.subheader ) {
					lastSubheader = node;
					return;
				}
				if ( matches( node ) ) {
					if ( lastSubheader ) {
						filtered.push( lastSubheader );
						lastSubheader = null;
					}
					filtered.push( node );
				}
			} );
		}
		const selectedSet = new Set( this.initialSelectedIds.map( ( id ) => String( id ) ) );
		this.$tree.empty();
		filtered.forEach( ( node ) => {
			if ( node.subheader ) {
				const $li = $( '<li class="mkl-pc-3d-object-selector--subheader">' ).text( node.subheader );
				this.$tree.append( $li );
				return;
			}
			const id = node.id || '';
			const name = node.name || node.id || '';
			const indent = ( node.depth || 0 ) * 16;
			const display = ( name || id ) + ' [' + ( node.type || '' ) + ']';
			const checked = selectedSet.has( String( id ) ) ? ' checked' : '';
			const $li = $( '<li class="mkl-pc-3d-object-selector--item mkl-pc-3d-object-selector--item-multi" style="padding-left:' + indent + 'px;">' );
			$li.append( $( '<input type="checkbox" class="mkl-pc-3d-object-selector--checkbox" data-object-id="' + ( id || '' ).replace( /"/g, '&quot;' ) + '"' + checked + '>' ) );
			$li.append( $( '<label></label>' ).text( display ) );
			this.$tree.append( $li );
		} );
	},
	on_filter_input() {
		this.renderTree( this.treeNodes );
	},
	select() {
		const ids = [];
		this.$( '.mkl-pc-3d-object-selector--checkbox:checked' ).each( function() {
			const id = $( this ).data( 'object-id' );
			if ( id != null && id !== '' ) ids.push( id );
		} );
		const payload = { ids, setting: this.setting };
		if ( this.applySelection ) this.applySelection( payload );
		else if ( this.originals.context && this.originals.context.$el ) this.originals.context.$el.trigger( 'objects_selected', payload );
		this.close();
	},
	close() {
		this.remove();
	},
} );

/**
 * Set a value at a path (array of keys) in an object; mutates and returns the object.
 * @param {Object} obj
 * @param {string[]} path
 * @param {*} value
 * @returns {Object}
 */
function setValueByPath( obj, path, value ) {
	if ( ! path || path.length === 0 ) return obj;
	let current = obj;
	for ( let i = 0; i < path.length - 1; i++ ) {
		const key = path[i];
		if ( ! ( key in current ) || typeof current[key] !== 'object' || current[key] === null ) {
			current[key] = {};
		}
		current = current[key];
	}
	current[ path[ path.length - 1 ] ] = value;
	return obj;
}

function select_3d_object( $el, context ) {
	const opts = { target: $el, context };
	if ( $el && $el.data( 'model-url' ) ) opts.modelUrl = $el.data( 'model-url' );
	if ( $el && $el.data( 'attachment-id' ) != null ) opts.attachmentId = $el.data( 'attachment-id' );
	opts.setting = $el?.data( 'setting' ) || 'object_id_3d';
	const isSceneObjectSelector = opts.setting === 'camera_target_object_id' || opts.setting === 'light_target_object_id';
	opts.resolveOptions = isSceneObjectSelector
		? { sourceKey: 'camera_target_model', uploadKey: null }
		: { sourceKey: 'object_selection_3d', uploadKey: 'model_upload_3d' };
	opts.applySelection = function( selection ) {
		const id = selection?.id;
		if ( id == null ) return;
		if ( context && context.model && typeof context.model.set === 'function' ) {
			const setting = opts.setting;
			if ( setting.indexOf( '.' ) !== -1 ) {
				const parts = setting.split( '.' );
				const rootKey = parts[0];
				const path = parts.slice( 1 );
				const current = context.model.get( rootKey );
				const updated = setValueByPath( current ? $.extend( true, {}, current ) : {}, path, id );
				context.model.set( rootKey, updated );
			} else {
				context.model.set( setting, id );
			}
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

function select_3d_objects( $el, context ) {
	const opts = { target: $el, context, multiple: true, setting: 'camera_focus_object_ids' };
	opts.initialSelectedIds = ( context && context.model && context.model.get( 'camera_focus_object_ids' ) ) || [];
	// For camera focus we load all scene models (from layers), not a single model
	if ( $el && $el.data( 'model-url' ) ) opts.modelUrl = $el.data( 'model-url' );
	if ( $el && $el.data( 'attachment-id' ) != null ) opts.attachmentId = $el.data( 'attachment-id' );
	opts.resolveOptions = { sourceKey: 'camera_target_model', uploadKey: null };
	opts.applySelection = function( payload ) {
		const ids = payload && Array.isArray( payload.ids ) ? payload.ids : [];
		if ( context && context.model && typeof context.model.set === 'function' ) {
			context.model.set( 'camera_focus_object_ids', ids );
			if ( context.collectionName && window.PC.app && window.PC.app.is_modified ) {
				window.PC.app.is_modified[ context.collectionName ] = true;
			}
		}
		if ( context && context.$el && context.$el.length ) context.$el.trigger( 'objects_selected', { ids, setting: opts.setting } );
	};
	const view = new ObjectSelector3DMultiView( opts );
	view.$el.appendTo( 'body' );
	view.render();
}

window.PC = window.PC || {};
window.PC.views = window.PC.views || {};
window.PC.views.object_selector_3d = ObjectSelector3DView;
window.PC.views.object_selector_3d_multi = ObjectSelector3DMultiView;
window.PC.actions = window.PC.actions || {};
window.PC.actions.select_3d_object = select_3d_object;
window.PC.actions.select_3d_objects = select_3d_objects;
