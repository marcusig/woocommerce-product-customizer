/**
 * Admin 3D object selector modal views and the actions that open them.
 * Depends on PC.threeD.store, PC.threeD.getObjects3DModelSources, PC.threeD.resolveModelUrl.
 *
 * Two views share one way of listing objects:
 * - ObjectSelector3DView picks one object;
 * - ObjectSelector3DMultiView picks several.
 *
 * Either lists one model (a URL resolved from the setting's context) or every
 * model of the product, grouped by model, with composite ids "sourceId:name".
 * Options that change the list:
 * - anchors: list empties only — those with "anchor" in their name first —
 *   with a toggle to show every object;
 * - withModels: start each model's group with a "Whole model" entry;
 * - idPrefix: qualify the ids of a single-model list with its model.
 */
const $ = window.jQuery;
const Backbone = window.Backbone;
const wp = window.wp;

const ANCHOR_NAME = /anchor/i;
const EMPTY_TYPE = 'Object3D';
const WHOLE_MODEL_PREFIX = 'model:';

function lang( key, fallback ) {
	return window.PC_lang && window.PC_lang[ key ] ? window.PC_lang[ key ] : fallback;
}

/**
 * Load every model of the product and return its objects, grouped by model.
 *
 * @param {function(string|null, Array<{ sourceId: string, label: string, nodes: Object[] }>)} callback
 *   error message (or null) and the groups, in 3D Objects order
 */
function load_model_groups( callback ) {
	const threeD = window.PC && window.PC.threeD;
	if ( ! threeD || ! threeD.store || typeof threeD.store.get !== 'function' || typeof threeD.getObjects3DModelSources !== 'function' ) {
		callback( '3D store not ready. Please try again.', [] );
		return;
	}
	threeD.getObjects3DModelSources( ( err, sources ) => {
		if ( err || ! sources || ! sources.length ) {
			callback( 'No 3D objects. Add models in 3D Objects.', [] );
			return;
		}
		const groups = new Array( sources.length );
		let pending = sources.length;
		let first_error = null;
		sources.forEach( ( src, idx ) => {
			threeD.store.get( src.url, ( load_err, data ) => {
				if ( ! load_err && data && data.objectTree && data.objectTree.length ) {
					const source_id = src.sourceId != null ? String( src.sourceId ) : '';
					groups[ idx ] = {
						sourceId: source_id,
						label: src.sourceLabel || source_id,
						nodes: data.objectTree.map( ( node ) => {
							const name = node.name || node.id || '';
							return {
								id: source_id ? source_id + ':' + name : name,
								name,
								type: node.type || '',
								depth: node.depth != null ? node.depth : 0,
							};
						} ),
					};
				} else if ( ! first_error && load_err && load_err.message ) {
					first_error = load_err.message;
				}
				pending--;
				if ( pending > 0 ) return;
				const out = groups.filter( Boolean );
				callback( out.length ? null : ( first_error || 'No objects to list.' ), out );
			} );
		} );
	} );
}

/**
 * Nodes to list for one group, in display order.
 *
 * @param {Object[]} nodes
 * @param {{ anchors?: boolean, showAll?: boolean }} mode
 * @returns {Object[]}
 */
function order_nodes( nodes, mode ) {
	if ( ! mode.anchors || mode.showAll ) return nodes;
	const empties = nodes.filter( ( n ) => n.type === EMPTY_TYPE );
	const named = empties.filter( ( n ) => ANCHOR_NAME.test( n.name ) );
	const others = empties.filter( ( n ) => ! ANCHOR_NAME.test( n.name ) );
	// Sorted, not a tree any more: indentation would mislead.
	return named.concat( others ).map( ( n ) => Object.assign( {}, n, { depth: 0 } ) );
}

/**
 * Flat render list: a subheader per group (when there are several), an
 * optional "Whole model" entry, then the group's nodes, filtered.
 */
function build_rows( groups, mode, filter ) {
	const rows = [];
	const needle = ( filter || '' ).toLowerCase();
	const matches = ( row ) => ! needle
		|| ( row.name && row.name.toLowerCase().indexOf( needle ) !== -1 )
		|| ( row.id && String( row.id ).toLowerCase().indexOf( needle ) !== -1 );
	groups.forEach( ( group ) => {
		const group_rows = [];
		if ( mode.withModels && group.sourceId ) {
			const whole = {
				id: WHOLE_MODEL_PREFIX + group.sourceId,
				name: lang( 'threed_whole_model_of', 'Whole model: %s' ).replace( '%s', group.label ),
				type: '',
				depth: 0,
				whole_model: group.sourceId,
			};
			if ( matches( whole ) || ( needle && group.label.toLowerCase().indexOf( needle ) !== -1 ) ) group_rows.push( whole );
		}
		order_nodes( group.nodes, mode ).forEach( ( node ) => {
			if ( matches( node ) ) group_rows.push( node );
		} );
		if ( ! group_rows.length ) return;
		if ( groups.length > 1 || mode.withModels ) rows.push( { subheader: group.label } );
		rows.push( ...group_rows );
	} );
	return rows;
}

function escape_attr( value ) {
	return String( value == null ? '' : value ).replace( /&/g, '&amp;' ).replace( /"/g, '&quot;' );
}

/** Shared behaviour of the single and multi selector views. */
const selector_base = {
	initialize( options ) {
		this.options = options || {};
		this.originals = { target: this.options.target, context: this.options.context };
		this.modelUrl = this.options.modelUrl || null;
		this.attachmentId = this.options.attachmentId != null ? this.options.attachmentId : null;
		this.setting = this.options.setting || null;
		this.applySelection = typeof this.options.applySelection === 'function' ? this.options.applySelection : null;
		this.groups = [];
		this.mode = {
			anchors: this.options.anchors === true,
			withModels: this.options.withModels === true,
			showAll: false,
		};
		this.loadAllSceneModels = this.options.allModels === true || this.mode.anchors || this.mode.withModels || this.defaultAllModels();
	},
	defaultAllModels() {
		return false;
	},
	render() {
		this.$el.html( this.template( {} ) );
		this.$tree = this.$( '.mkl-pc-3d-object-selector--tree' );
		this.$filterInput = this.$( '.mkl-pc-3d-object-selector--filter-input' );
		this.$selectBtn = this.$( '.button.select' );
		if ( this.options.title ) this.$( 'h3' ).first().text( this.options.title );
		if ( this.mode.anchors ) {
			const $toggle = $( '<p class="mkl-pc-3d-object-selector--show-all"><label><input type="checkbox" class="mkl-pc-3d-object-selector--show-all-input"> </label></p>' );
			$toggle.find( 'label' ).append( document.createTextNode( lang( 'threed_show_all_objects', 'Show all objects, not only empties' ) ) );
			this.$( '.mkl-pc-3d-object-selector--filter' ).after( $toggle );
		}
		this.resolveAndLoad();
		return this;
	},
	resolveAndLoad() {
		if ( this.loadAllSceneModels ) {
			load_model_groups( ( err, groups ) => {
				if ( err && ! groups.length ) {
					this.showError( err );
					return;
				}
				this.groups = groups;
				this.renderRows();
			} );
			return;
		}
		const load_url = ( url, missing ) => {
			if ( url ) this.loadModel( url );
			else this.showError( missing );
		};
		if ( this.modelUrl ) {
			this.loadModel( this.modelUrl );
			return;
		}
		if ( this.attachmentId ) {
			const attachment = wp.media.attachment( this.attachmentId );
			attachment.fetch().done( () => {
				const att = attachment.toJSON();
				load_url( att.gltf_url || att.url, 'Could not get model URL from attachment.' );
			} ).fail( () => this.showError( 'Failed to load attachment.' ) );
			return;
		}
		if ( typeof this.options.resolveUrl === 'function' ) {
			this.options.resolveUrl( ( url ) => load_url( url, this.options.noModelMessage || 'No 3D file for this source. Use a 3D object or uploaded model.' ) );
			return;
		}
		if ( this.originals.context && this.originals.context.model && this.options.resolveOptions && typeof window.PC.threeD.resolveModelUrl === 'function' ) {
			window.PC.threeD.resolveModelUrl( this.originals.context.model, this.options.resolveOptions, ( url ) => load_url( url, 'No 3D file for this source. Use a 3D object or uploaded model.' ) );
			return;
		}
		this.showError( 'No 3D file to browse. Pass modelUrl or use a 3D object/uploaded model.' );
	},
	loadModel( url ) {
		if ( ! window.PC.threeD || ! window.PC.threeD.store || typeof window.PC.threeD.store.get !== 'function' ) {
			this.showError( '3D store not ready. Please try again.' );
			return;
		}
		const prefix = this.options.idPrefix != null && String( this.options.idPrefix ) !== '' ? String( this.options.idPrefix ) : '';
		window.PC.threeD.store.get( url, ( err, data ) => {
			if ( err || ! data ) {
				this.showError( ( err && err.message ) ? err.message : 'Failed to load the 3D model.' );
				return;
			}
			this.groups = [ {
				sourceId: prefix,
				label: '',
				nodes: ( data.objectTree || [] ).map( ( node ) => {
					const name = node.name || node.id || '';
					return { id: prefix ? prefix + ':' + name : ( node.id || name ), name, type: node.type || '', depth: node.depth || 0 };
				} ),
			} ];
			this.renderRows();
		} );
	},
	showError( message ) {
		const $container = this.$tree.closest( '.mkl-pc-3d-object-selector--tree-container' );
		$container.empty();
		$container.append( $( '<p class="description"></p>' ).text( message || 'No objects to list.' ) );
	},
	on_filter_input() {
		this.renderRows();
	},
	on_show_all_change( event ) {
		this.mode.showAll = $( event.currentTarget ).is( ':checked' );
		this.renderRows();
	},
	close() {
		this.remove();
	},
};

const ObjectSelector3DView = Backbone.View.extend( Object.assign( {}, selector_base, {
	tagName: 'div',
	className: 'mkl-pc-3d-object-selector--container',
	template: wp.template( 'mkl-pc-3d-object-selector' ),
	events: {
		'click .button.select': 'select',
		'click .button.cancel': 'close',
		'input .mkl-pc-3d-object-selector--filter-input': 'on_filter_input',
		'change .mkl-pc-3d-object-selector--show-all-input': 'on_show_all_change',
		'click .mkl-pc-3d-object-selector--tree [data-object-id]': 'on_tree_item_click',
	},
	initialize( options ) {
		selector_base.initialize.call( this, options );
		this.selected = null;
	},
	// A light's target has no model of its own to browse.
	defaultAllModels() {
		return this.setting === 'light_target_object_id';
	},
	renderRows() {
		const rows = build_rows( this.groups, this.mode, this.$filterInput ? this.$filterInput.val() : '' );
		this.rowsById = {};
		this.$tree.empty();
		rows.forEach( ( row ) => {
			if ( row.subheader ) {
				this.$tree.append( $( '<li class="mkl-pc-3d-object-selector--subheader">' ).text( row.subheader ) );
				return;
			}
			this.rowsById[ row.id ] = row;
			const display = row.whole_model ? row.name : ( row.name || row.id ) + ( row.type ? ' [' + row.type + ']' : '' );
			const $li = $( '<li class="mkl-pc-3d-object-selector--item" data-object-id="' + escape_attr( row.id ) + '" style="padding-left:' + ( ( row.depth || 0 ) * 16 ) + 'px;">' ).text( display );
			if ( row.whole_model ) $li.addClass( 'mkl-pc-3d-object-selector--item-model' );
			if ( this.selected && this.selected.id === row.id ) $li.addClass( 'selected' );
			this.$tree.append( $li );
		} );
		if ( ! rows.length ) this.$tree.append( $( '<li class="description">' ).text( 'No objects to list.' ) );
	},
	on_tree_item_click( e ) {
		const $item = $( e.currentTarget );
		const row = this.rowsById && this.rowsById[ $item.attr( 'data-object-id' ) ];
		if ( ! row ) return;
		this.selected = row;
		this.$( '.mkl-pc-3d-object-selector--item' ).removeClass( 'selected' );
		$item.addClass( 'selected' );
		this.$selectBtn.prop( 'disabled', false );
	},
	select() {
		const row = this.selected;
		if ( row ) {
			const payload = row.whole_model
				? { id: '', model_id: row.whole_model, whole_model: true, name: row.name, setting: this.setting }
				: { id: row.id, model_id: this.sourceIdOf( row.id ), whole_model: false, name: row.name, setting: this.setting };
			if ( this.applySelection ) this.applySelection( payload );
			else if ( this.originals.context && this.originals.context.$el ) this.originals.context.$el.trigger( 'object_selected', payload );
		}
		this.close();
	},
	sourceIdOf( id ) {
		const s = String( id || '' );
		const sep = s.indexOf( ':' );
		return sep === -1 ? '' : s.slice( 0, sep );
	},
} ) );

const ObjectSelector3DMultiView = Backbone.View.extend( Object.assign( {}, selector_base, {
	tagName: 'div',
	className: 'mkl-pc-3d-object-selector--container',
	template: wp.template( 'mkl-pc-3d-object-selector-multi' ),
	events: {
		'click .button.select': 'select',
		'click .button.cancel': 'close',
		'input .mkl-pc-3d-object-selector--filter-input': 'on_filter_input',
		'change .mkl-pc-3d-object-selector--show-all-input': 'on_show_all_change',
		'change .mkl-pc-3d-object-selector--checkbox': 'on_check',
	},
	initialize( options ) {
		selector_base.initialize.call( this, options );
		this.setting = this.options.setting || 'camera_focus_object_ids';
		// Kept across filtering and the show-all toggle, which re-render the list.
		this.checked = new Set( ( Array.isArray( this.options.initialSelectedIds ) ? this.options.initialSelectedIds : [] ).map( String ) );
	},
	defaultAllModels() {
		return this.setting === 'camera_focus_object_ids' && this.originals.context && this.originals.context.collectionName === 'angles';
	},
	renderRows() {
		const rows = build_rows( this.groups, this.mode, this.$filterInput ? this.$filterInput.val() : '' );
		this.$tree.empty();
		rows.forEach( ( row ) => {
			if ( row.subheader ) {
				this.$tree.append( $( '<li class="mkl-pc-3d-object-selector--subheader">' ).text( row.subheader ) );
				return;
			}
			const checked = this.checked.has( String( row.id ) ) ? ' checked' : '';
			const $li = $( '<li class="mkl-pc-3d-object-selector--item mkl-pc-3d-object-selector--item-multi" style="padding-left:' + ( ( row.depth || 0 ) * 16 ) + 'px;">' );
			$li.append( $( '<input type="checkbox" class="mkl-pc-3d-object-selector--checkbox" data-object-id="' + escape_attr( row.id ) + '"' + checked + '>' ) );
			$li.append( $( '<label></label>' ).text( ( row.name || row.id ) + ( row.type ? ' [' + row.type + ']' : '' ) ) );
			this.$tree.append( $li );
		} );
		if ( ! rows.length ) this.$tree.append( $( '<li class="description">' ).text( 'No objects to list.' ) );
	},
	on_check( e ) {
		const $box = $( e.currentTarget );
		const id = String( $box.attr( 'data-object-id' ) );
		if ( $box.is( ':checked' ) ) this.checked.add( id );
		else this.checked.delete( id );
	},
	select() {
		const payload = { ids: Array.from( this.checked ), setting: this.setting };
		if ( this.applySelection ) this.applySelection( payload );
		else if ( this.originals.context && this.originals.context.$el ) this.originals.context.$el.trigger( 'objects_selected', payload );
		this.close();
	},
} ) );

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

function admin_layer( layer_id ) {
	const admin = window.PC.app && window.PC.app.admin;
	return layer_id != null && admin && admin.layers ? admin.layers.get( layer_id ) : null;
}

function select_3d_object( $el, context ) {
	const opts = { target: $el, context };
	if ( $el && $el.data( 'model-url' ) ) opts.modelUrl = $el.data( 'model-url' );
	if ( $el && $el.data( 'attachment-id' ) != null ) opts.attachmentId = $el.data( 'attachment-id' );
	opts.setting = $el?.data( 'setting' ) || 'target_object_id';
	const isSceneObjectSelector = opts.setting === 'camera_target_object_id' || opts.setting === 'light_target_object_id';
	opts.resolveOptions = isSceneObjectSelector
		? { sourceKey: 'camera_target_model', uploadKey: null }
		: { sourceKey: 'object_selection_3d', uploadKey: 'model_upload_3d' };
	const model = context && context.model && typeof context.model.get === 'function' ? context.model : null;
	if ( ! isSceneObjectSelector && model && opts.setting === 'target_object_id' ) {
		// A choice lists the objects of its own model, or the layer's when it
		// inherits it — the same fallback the viewer uses. Ids are saved with
		// their model ("2:Suzanne"), so two models sharing a name stay apart.
		const choice_layer_id = model.get( 'layerId' );
		const layer = choice_layer_id != null ? admin_layer( choice_layer_id ) : null;
		const own = model.get( 'object_3d_id' );
		const inherited = layer ? layer.get( 'object_3d_id' ) : null;
		const source = own != null && own !== '' ? own : inherited;
		if ( source != null && source !== '' ) opts.idPrefix = String( source );
		if ( choice_layer_id != null && typeof window.PC.threeD.resolveChoiceModelUrl === 'function' ) {
			opts.resolveUrl = ( callback ) => window.PC.threeD.resolveChoiceModelUrl( model, layer, callback );
			opts.noModelMessage = lang( 'threed_no_model_for_choice', 'No 3D model is set on this choice or its layer.' );
		}
	}
	opts.applySelection = function( selection ) {
		const id = selection?.id;
		if ( ! id ) return;
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

/**
 * Pick one object from any model of the product.
 *
 * @param {function({ id: string, model_id: string, whole_model: boolean, name: string })} apply
 * @param {{ withModels?: boolean }} [options] - withModels: offer "Whole model" entries
 */
function open_object_picker( apply, options = {} ) {
	const view = new ObjectSelector3DView( {
		allModels: true,
		withModels: options.withModels === true,
		title: options.title,
		applySelection: apply,
	} );
	view.$el.appendTo( 'body' );
	view.render();
}

/**
 * Pick anchors: empties of any model, "anchor" ones first.
 *
 * @param {string[]} initial - Composite ids already selected
 * @param {function(string[])} apply - receives the selected ids (one at most when not multiple)
 * @param {{ multiple?: boolean }} [options]
 */
function open_anchor_picker( initial, apply, options = {} ) {
	const multiple = options.multiple !== false;
	const title = multiple ? lang( 'threed_select_anchors', 'Select anchors' ) : lang( 'threed_select_anchor', 'Select an anchor' );
	const view = multiple
		? new ObjectSelector3DMultiView( {
			anchors: true,
			title,
			setting: 'anchor_ids',
			initialSelectedIds: Array.isArray( initial ) ? initial : [],
			applySelection: ( payload ) => apply( payload && Array.isArray( payload.ids ) ? payload.ids : [] ),
		} )
		: new ObjectSelector3DView( {
			anchors: true,
			title,
			applySelection: ( payload ) => apply( payload && payload.id ? [ payload.id ] : [] ),
		} );
	view.$el.appendTo( 'body' );
	view.render();
}

/**
 * Content for an anchor list: readable names, or "No anchor selected".
 *
 * @param {string[]|string} ids
 * @returns {jQuery}
 */
function anchor_list_content( ids ) {
	const list = Array.isArray( ids ) ? ids : ( ids ? [ ids ] : [] );
	if ( ! list.length ) return $( '<em></em>' ).text( lang( 'threed_no_anchor', 'No anchor selected' ) );
	const describe = window.PC.threeD && typeof window.PC.threeD.describeObjectId === 'function' ? window.PC.threeD.describeObjectId : String;
	return $( '<span></span>' ).text( list.map( describe ).join( ', ' ) );
}

function refresh_anchor_field( context, setting ) {
	if ( ! context || ! context.$el ) return;
	const value = context.model.get( setting );
	const has = Array.isArray( value ) ? value.length > 0 : !! value;
	context.$el.find( '.mkl-pc--anchor-list[data-setting="' + setting + '"]' ).empty().append( anchor_list_content( value ) );
	context.$el.find( '[data-anchor-when-set="' + setting + '"]' ).prop( 'hidden', ! has );
}

/** Model position "On an anchor": pick the one anchor. */
function select_3d_anchor( $el, context ) {
	if ( ! context || ! context.model ) return;
	const setting = ( $el && $el.data( 'setting' ) ) || 'placement_anchor_id';
	const current = context.model.get( setting );
	open_anchor_picker( current ? [ current ] : [], ( ids ) => {
		context.model.set( setting, ids[ 0 ] || '' );
		refresh_anchor_field( context, setting );
	}, { multiple: false } );
}

function clear_3d_anchor( $el, context ) {
	if ( ! context || ! context.model ) return;
	const setting = ( $el && $el.data( 'setting' ) ) || 'placement_anchor_id';
	context.model.set( setting, '' );
	refresh_anchor_field( context, setting );
}

window.PC = window.PC || {};
window.PC.threeD = window.PC.threeD || {};
window.PC.threeD.openObjectPicker = open_object_picker;
window.PC.threeD.openAnchorPicker = open_anchor_picker;
window.PC.threeD.anchorListContent = anchor_list_content;
window.PC.threeD.refreshAnchorField = refresh_anchor_field;
window.PC.views = window.PC.views || {};
window.PC.views.object_selector_3d = ObjectSelector3DView;
window.PC.views.object_selector_3d_multi = ObjectSelector3DMultiView;
window.PC.actions = window.PC.actions || {};
window.PC.actions.select_3d_object = select_3d_object;
window.PC.actions.select_3d_objects = select_3d_objects;
window.PC.actions.select_3d_anchor = select_3d_anchor;
window.PC.actions.clear_3d_anchor = clear_3d_anchor;
