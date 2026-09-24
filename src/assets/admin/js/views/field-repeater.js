var PC = PC || {};
PC.views = PC.views || {};

(function( $, _ ){

	function initRepeaters( edit_view ) {
		var $targets = edit_view.$( '.field-repeater' );
		
		if ( ! $targets.length ) return;

		$targets.each( ( index, item ) => {
			const setting = $( item ).data( 'setting' );
			const fields = $( item ).data( 'fields' );
			const Repeater = new PC.views.field_repeater( { el: $( item ), setting, fields, model: edit_view.model, context: edit_view } );
			Repeater.$el.appendTo( $( item ) );
		} );
	}

	// Render fields in layer
	wp.hooks.addAction( 'PC.admin.layer_form.render', 'MKL/PC/Field_Repeater', initRepeaters );
	// Render fields in choice
	wp.hooks.addAction( 'PC.admin.choiceDetails.render', 'MKL/PC/Field_Repeater', initRepeaters );

	PC.views.field_repeater = Backbone.View.extend( {
		template: wp.template('mkl-pc-setting--repeater'),
		events: {
			'click .add-option': 'add_option',
		},
		options_els: [],
		initialize: function( options ) {
			this.setting = options.setting;
			this.fields = options.fields;
			this.context = options.context || null;
			var opts = this.model.get( this.setting );
			if ( 'object' != typeof opts ) opts = [];
			this.options = new Backbone.Collection( opts, { comparator: 'order' } );
			this.render();
			this.listenTo( this.options, 'add', this.add_one );
			this.listenTo( this.options, 'add', this.persist_options_after_add );
			this.listenTo( this.options, 'change destroy', this.save_options );
		},
		get_default_option: function() {
			// Generate the defaults object
			const defaults = Object.keys( this.fields ).reduce( ( acc, slug ) => {
				const field = this.fields[slug];
				// Stable ids for rows other settings point at (layout variants).
				if ( field.generate === 'uid' ) {
					acc[slug] = 'v' + Date.now().toString( 36 ) + Math.random().toString( 36 ).slice( 2, 7 );
					return acc;
				}
				acc[slug] = typeof field.default !== 'undefined' ? field.default : '';
				return acc;
			  }, {});
			
			defaults.order = PC.app.get_new_order( this.options )
			return wp.hooks.applyFilters( 'PC.field.repeater.get_default_option', defaults );
		},
		render: function() {
			this.$el.append( this.template() );
			// A repeater can name its rows ("Add variant") instead of "Add option".
			var add_label = this.$el.data( 'add-label' );
			if ( add_label ) {
				this.$el.children( '.add-option' ).empty().append( '<i class="dashicons dashicons-plus"></i> ' ).append( document.createTextNode( add_label ) );
			}
			this.options.each( this.add_one.bind( this ) );
		},
		add_option: function() {
			this.options.add( this.get_default_option() );
		},
		add_one: function( model ) {
			var option = new PC.views.field_repeater_option( { fields: this.fields, model: model, setting: this.setting, context: this.context } );
			this.options_els.push( option );
			option.$el.appendTo( this.$( '.options-list' ) );
		},
		/**
		 * Newly added rows often match every field schema default (e.g. empty string when PHP has no default).
		 * Pruning those on the same `add` event removed them before the layer model could persist (e.g. text-overlay font_size_options).
		 */
		persist_options_after_add: function() {
			this.model.set( this.setting, PC.toJSON( this.options.sort() ) );
		},
		save_options: function() {
			var view = this;
			var toRemove = [];
			this.options.each( function( model ) {
				if ( view.is_option_empty( model ) ) toRemove.push( model );
			} );
			toRemove.forEach( function( model ) { view.options.remove( model ); } );
			this.model.set( this.setting, PC.toJSON( this.options.sort() ) );
		},
		/**
		 * Consider a row empty if it has no meaningful value in any of the repeater's fields.
		 * Uses this.fields so it works for any repeater (label/value, action_type, etc.).
		 */
		is_option_empty: function( model ) {
			var keys = Object.keys( this.fields || {} ).filter( function( k ) { return k !== 'order'; } );
			if ( ! keys.length ) return false;
			var hasAny = keys.some( function( key ) {
				var v = model.get( key );
				return v !== undefined && v !== null && v !== '';
			} );
			return ! hasAny;
		},
	} );

	PC.views.field_repeater_option = Backbone.View.extend( {
		tagName: 'div',
		className: 'field-repeater--option',
		template: wp.template('mkl-pc-setting--repeater-option'),
		events: {
			'click .remove-option': 'remove_option',
			'change input': 'update_value',
			'change select': 'on_select_change',
			'click .pc-select-attachment': 'select_attachment',
			'click .pc-select-3d-object': 'select_3d_object',
			'click .pc-clear-3d-object': 'clear_3d_object',
			'click .pc-select-3d-anchors': 'select_3d_anchors',
			'click .order button': 'reorder_item',
		},
		initialize: function( options ) {
			this.fields = options.fields;
			this.setting = options.setting || null;
			this.context = options.context || null;
			this.listenTo( this.model.collection, 'manual-reorder', this.set_order );
			this.render();
		},
		render: function() {
			this.$el.append( this.template( { ...this.model.attributes, fields: this.fields } ) );
			this.toggle_action_visibility();
			this.describe_anchor_lists();
			this.describe_object_choices();
			this.load_layout_selects();
			if ( this.setting === 'actions_3d' && this.context ) {
				if ( this.fields.material_variant_value ) {
					this.load_variant_field();
				}
				if ( this.fields.material_name && this.fields.material_name.type === 'material_select' ) {
					this.load_material_select_field();
				}
			}
		},
		load_variant_field: function() {
			var view = this;
			var $ph = this.$( '.pc-variant-select-placeholder' );
			if ( ! $ph.length ) return;
			var key = $ph.data( 'variant-field' );
			var currentVal = $ph.data( 'variant-value' ) || '';
			var choiceModel = this.context.model;
			var layerId = choiceModel && choiceModel.get( 'layerId' );
			var layerModel = ( layerId && PC.app.admin.layers ) ? PC.app.admin.layers.get( layerId ) : null;
			if ( ! PC.threeD || ! PC.threeD.resolveChoiceModelUrl || ! PC.threeD.getMaterialVariantsFromUrl ) {
				if ( PC.threeD && typeof PC.threeD.ensureReady === 'function' && ! view._variantDepsRequested ) {
					view._variantDepsRequested = true;
					PC.threeD.ensureReady().then( function() {
						view.load_variant_field();
					} ).catch( function() {
						$ph.replaceWith( '<span class="pc-variant-select-warning">' + ( typeof PC_lang !== 'undefined' && PC_lang.no_variants_available ? PC_lang.no_variants_available : 'No variants available.' ) + '</span>' );
					} );
					return;
				}
				$ph.replaceWith( '<span class="pc-variant-select-warning">' + ( typeof PC_lang !== 'undefined' && PC_lang.no_variants_available ? PC_lang.no_variants_available : 'No variants available.' ) + '</span>' );
				return;
			}
			PC.threeD.resolveChoiceModelUrl( choiceModel, layerModel, function( url ) {
				if ( ! url ) {
					$ph.replaceWith( '<span class="pc-variant-select-warning">' + ( typeof PC_lang !== 'undefined' && PC_lang.no_model_for_variants ? PC_lang.no_model_for_variants : 'No 3D model set. Set object selection and model first.' ) + '</span>' );
					return;
				}
				PC.threeD.getMaterialVariantsFromUrl( url, function( err, variants ) {
					if ( err || ! variants || ! variants.length ) {
						$ph.replaceWith( '<span class="pc-variant-select-warning">' + ( typeof PC_lang !== 'undefined' && PC_lang.no_variants_in_model ? PC_lang.no_variants_in_model : 'No material variants in this model.' ) + '</span>' );
						return;
					}
					var $sel = $( '<select name="' + key + '">' );
					$sel.append( $( '<option value="">' ).text( typeof PC_lang !== 'undefined' && PC_lang.select_variant ? PC_lang.select_variant : '— Select variant —' ) );
					variants.forEach( function( name ) {
						var $opt = $( '<option>' ).attr( 'value', name ).text( name );
						if ( name === currentVal ) $opt.prop( 'selected', true );
						$sel.append( $opt );
					} );
					$ph.replaceWith( $sel );
					$sel.on( 'change', function() {
						view.model.set( key, $sel.val() );
					} );
				} );
			} );
		},
		load_material_select_field: function() {
			var view = this;
			this.$( '.pc-material-select-placeholder' ).each( function() {
				var $ph = $( this );
				var key = $ph.data( 'material-field' );
				var currentVal = $ph.data( 'material-value' ) || '';
				var choiceModel = view.context && view.context.model;
				var layerId = choiceModel && choiceModel.get( 'layerId' );
				var layerModel = ( layerId && PC.app.admin.layers ) ? PC.app.admin.layers.get( layerId ) : null;
				if ( ! PC.threeD || ! PC.threeD.resolveChoiceModelUrl || ! PC.threeD.getMaterialNamesFromUrl ) {
					if ( PC.threeD && typeof PC.threeD.ensureReady === 'function' && ! view._materialDepsRequested ) {
						view._materialDepsRequested = true;
						PC.threeD.ensureReady().then( function() {
							view.load_material_select_field();
						} ).catch( function() {
							$ph.replaceWith( '<span class="pc-material-select-warning">' + ( typeof PC_lang !== 'undefined' && PC_lang.no_materials_available ? PC_lang.no_materials_available : 'Materials not available.' ) + '</span>' );
						} );
						return;
					}
					$ph.replaceWith( '<span class="pc-material-select-warning">' + ( typeof PC_lang !== 'undefined' && PC_lang.no_materials_available ? PC_lang.no_materials_available : 'Materials not available.' ) + '</span>' );
					return;
				}
				PC.threeD.resolveChoiceModelUrl( choiceModel, layerModel, function( url ) {
					if ( ! url ) {
						$ph.replaceWith( '<span class="pc-material-select-warning">' + ( typeof PC_lang !== 'undefined' && PC_lang.no_model_for_materials ? PC_lang.no_model_for_materials : 'No 3D model set. Set object selection and model first.' ) + '</span>' );
						return;
					}
					PC.threeD.getMaterialNamesFromUrl( url, function( err, names ) {
						if ( err || ! names || ! names.length ) {
							$ph.replaceWith( '<span class="pc-material-select-warning">' + ( typeof PC_lang !== 'undefined' && PC_lang.no_materials_in_model ? PC_lang.no_materials_in_model : 'No materials in this model.' ) + '</span>' );
							return;
						}
						var $sel = $( '<select name="' + key + '">' );
						$sel.append( $( '<option value="">' ).text( typeof PC_lang !== 'undefined' && PC_lang.select_material ? PC_lang.select_material : '— Select material —' ) );
						names.forEach( function( name ) {
							var $opt = $( '<option>' ).attr( 'value', name ).text( name );
							if ( name === currentVal ) $opt.prop( 'selected', true );
							$sel.append( $opt );
						} );
						$ph.replaceWith( $sel );
						$sel.on( 'change', function() {
							view.model.set( key, $sel.val() );
						} );
					} );
				} );
			} );
		},
		remove_option: function() {
			this.model.destroy();
			this.remove();
		},
		update_value: function( e ) {
			if ( e.target && e.target.type === 'checkbox' ) {
				this.model.set( e.target.name, $( e.target ).is( ':checked' ) );
				return;
			}
			this.model.set( e.target.name, e.target.value );
		},
		on_select_change: function( e ) {
			this.model.set( e.target.name, e.target.value );
			if ( e.target.name === 'action_type' ) {
				this.toggle_action_visibility();
				this.describe_object_choices();
				this.load_layout_selects();
			}
			if ( $( e.target ).is( '.pc-layout-select' ) ) {
				// Variants belong to one layout: a new layout starts unselected.
				var $variant = this.$( 'select.pc-layout-variant-select' );
				if ( $variant.length ) this.model.set( $variant.attr( 'name' ), '' );
				this.load_layout_variant_select();
			}
		},
		toggle_action_visibility: function() {
			var actionType = this.model.get( 'action_type' );
			this.$( '.pc-action-value' ).each( function() {
				var showWhen = $( this ).data( 'show-when' );
				var visible = !! showWhen && (
					showWhen.indexOf( '|' ) !== -1
						? showWhen.split( '|' ).indexOf( actionType ) !== -1
						: showWhen === actionType
				);
				$( this ).toggle( visible );
			} );
		},
		select_attachment: function( e ) {
			var key = $( e.currentTarget ).data( 'target' );
			if ( ! key ) return;
			var frame = wp.media( {
				title: ( typeof PC_lang !== 'undefined' && PC_lang.media_title ) ? PC_lang.media_title : 'Select',
				button: { text: ( typeof PC_lang !== 'undefined' && PC_lang.media_select_button ) ? PC_lang.media_select_button : 'Use this file' },
				multiple: false,
				library: { type: 'image' },
			} );
			frame.on( 'select', function() {
				var attachment = frame.state().get( 'selection' ).first().toJSON();
				var url = attachment.url || '';
				var filename = attachment.filename || attachment.title || ( url ? url.replace( /^.*\//, '' ) : '' );
				this.model.set( key, attachment.id );
				// Store URL and filename for attachment-type fields (e.g. material_texture_id -> material_texture_url, material_texture_filename)
				if ( key.lastIndexOf( '_id' ) === key.length - 3 ) {
					var base = key.slice( 0, -3 );
					this.model.set( base + '_url', url );
					this.model.set( base + '_filename', filename );
				}
				this.$el.html( this.template( { ...this.model.attributes, fields: this.fields } ) );
				this.toggle_action_visibility();
				if ( this.setting === 'actions_3d' && this.context ) {
					if ( this.fields.material_variant_value ) {
						this.load_variant_field();
					}
					if ( this.fields.material_name && this.fields.material_name.type === 'material_select' ) {
						this.load_material_select_field();
					}
				}
			}.bind( this ) );
			frame.open();
		},
		/**
		 * Run fn once the admin 3D modules (pickers, model store) are loaded;
		 * they load on first use.
		 */
		with_3d: function( fn ) {
			if ( PC.threeD && typeof PC.threeD.openAnchorPicker === 'function' ) {
				fn();
			} else if ( PC.threeD && typeof PC.threeD.ensureReady === 'function' ) {
				PC.threeD.ensureReady().then( fn );
			}
		},
		/** Readable anchor names: "instance_01 (Frame)" instead of "1:instance_01". */
		describe_ids: function( ids ) {
			var describe = PC.threeD && typeof PC.threeD.describeObjectId === 'function' ? PC.threeD.describeObjectId : String;
			return ids.map( describe ).join( ', ' );
		},
		describe_anchor_lists: function() {
			var view = this;
			this.$( '.pc-anchor-list[data-anchor-field]' ).each( function() {
				var value = view.model.get( $( this ).data( 'anchor-field' ) );
				var ids = Array.isArray( value ) ? value : ( value ? [ value ] : [] );
				if ( ids.length ) $( this ).text( view.describe_ids( ids ) );
			} );
		},
		/**
		 * Object fields (Move to anchor's "Object to move"): the picked object,
		 * the picked whole model, or — when empty — what the choice's own
		 * object resolves to.
		 */
		describe_object_choices: function() {
			var view = this;
			this.$( '.pc-object-choice[data-object-field]' ).each( function() {
				var $el = $( this );
				var object_id = view.model.get( $el.data( 'object-field' ) );
				var model_key = $el.data( 'model-key' );
				var model_id = model_key ? view.model.get( model_key ) : '';
				var threeD = PC.threeD || {};
				var text;
				if ( object_id ) {
					text = threeD.describeObjectId ? threeD.describeObjectId( object_id ) : object_id;
				} else if ( model_id !== '' && model_id != null ) {
					var label = threeD.object3dLabel ? threeD.object3dLabel( model_id ) : '#' + model_id;
					text = ( ( window.PC_lang && PC_lang.threed_whole_model_of ) || 'Whole model: %s' ).replace( '%s', label );
				} else {
					var resolved = view.context && threeD.describeChoiceTarget ? threeD.describeChoiceTarget( view.context.model ) : '';
					text = resolved
						? ( ( window.PC_lang && PC_lang.threed_this_choice_object ) || "This choice's object: %s" ).replace( '%s', resolved )
						: ( $el.data( 'placeholder' ) || '' );
				}
				$el.text( text );
				view.$( '.pc-clear-3d-object[data-target="' + $el.data( 'object-field' ) + '"]' ).prop( 'hidden', ! object_id && ( model_id === '' || model_id == null ) );
			} );
		},
		select_3d_object: function( e ) {
			var $btn = $( e.currentTarget );
			var key = $btn.data( 'target' );
			if ( ! key ) return;
			var model_key = $btn.data( 'model-key' );
			var view = this;
			this.with_3d( function() {
				PC.threeD.openObjectPicker( function( selection ) {
					if ( ! selection ) return;
					if ( selection.whole_model ) {
						if ( ! model_key ) return;
						view.model.set( key, '' );
						view.model.set( model_key, String( selection.model_id ) );
					} else {
						if ( ! selection.id ) return;
						view.model.set( key, String( selection.id ) );
						if ( model_key ) view.model.set( model_key, String( selection.model_id || '' ) );
					}
					view.describe_object_choices();
				}, { withModels: !! $btn.data( 'with-models' ) } );
			} );
		},
		clear_3d_object: function( e ) {
			var $btn = $( e.currentTarget );
			var key = $btn.data( 'target' );
			if ( ! key ) return;
			this.model.set( key, '' );
			if ( $btn.data( 'model-key' ) ) this.model.set( $btn.data( 'model-key' ), '' );
			this.describe_object_choices();
		},
		select_3d_anchors: function( e ) {
			var $btn = $( e.currentTarget );
			var key = $btn.data( 'target' );
			if ( ! key ) return;
			var multiple = !! $btn.data( 'multiple' );
			var view = this;
			this.with_3d( function() {
				var current = view.model.get( key );
				var initial = Array.isArray( current ) ? current : ( current ? [ current ] : [] );
				PC.threeD.openAnchorPicker( initial, function( ids ) {
					view.model.set( key, multiple ? ids : ( ids[ 0 ] || '' ) );
					view.$( '.pc-anchor-list[data-anchor-field="' + key + '"]' ).empty().append(
						ids.length ? $( '<span></span>' ).text( view.describe_ids( ids ) ) : $( '<em></em>' ).text( ( window.PC_lang && PC_lang.threed_no_anchor ) || 'No anchor selected' )
					);
				}, { multiple: multiple } );
			} );
		},
		/** Layouts of the product, from the 3D Objects collection. */
		get_layouts: function() {
			var objects3d = PC.app && typeof PC.app.get_collection === 'function' ? PC.app.get_collection( 'objects3d' ) : null;
			return objects3d ? objects3d.filter( function( o ) { return o.get( 'object_type' ) === 'layout'; } ) : [];
		},
		/** Fill Switch layout variant's selects: the layouts, then the chosen layout's variants. */
		load_layout_selects: function() {
			var $layout = this.$( 'select.pc-layout-select' );
			if ( ! $layout.length ) return;
			var lang = window.PC_lang || {};
			var layouts = this.get_layouts();
			var current = String( this.model.get( $layout.attr( 'name' ) ) || '' );
			$layout.empty().append( $( '<option value="">' ).text( layouts.length ? ( lang.threed_select_layout || '— Select a layout —' ) : ( lang.threed_no_layouts || 'No layouts yet. Add one in 3D Objects.' ) ) );
			layouts.forEach( function( layout ) {
				var id = String( layout.get( '_id' ) != null ? layout.get( '_id' ) : layout.id );
				$layout.append( $( '<option>' ).attr( 'value', id ).text( layout.get( 'name' ) || ( '#' + id ) ) );
			} );
			$layout.val( current );
			this.load_layout_variant_select();
		},
		load_layout_variant_select: function() {
			var $variant = this.$( 'select.pc-layout-variant-select' );
			if ( ! $variant.length ) return;
			var layout_key = this.$( 'select.pc-layout-select' ).attr( 'name' ) || 'layout_id';
			var layout_id = String( this.model.get( layout_key ) || '' );
			var layout = _.find( this.get_layouts(), function( l ) { return String( l.get( '_id' ) != null ? l.get( '_id' ) : l.id ) === layout_id; } );
			var variants = layout && Array.isArray( layout.get( 'layout_variants' ) ) ? layout.get( 'layout_variants' ) : [];
			var current = String( this.model.get( $variant.attr( 'name' ) ) || '' );
			$variant.empty().append( $( '<option value="">' ).text( ( window.PC_lang && PC_lang.threed_select_variant ) || '— Select a variant —' ) );
			variants.forEach( function( v, index ) {
				if ( ! v || ! v.variant_id ) return;
				$variant.append( $( '<option>' ).attr( 'value', v.variant_id ).text( v.name || ( '#' + ( index + 1 ) ) ) );
			} );
			$variant.val( _.some( variants, function( v ) { return v && v.variant_id === current; } ) ? current : '' );
		},
		reorder_item: function( e ) {
			var moved = false;
			if ( $( e.currentTarget ).is( '.up' ) ) {
				var prev = this.$el.prev();
				if ( prev.length ) {
					this.$el.insertBefore( prev );
					moved = true;
				}
			} else if ( $( e.currentTarget ).is( '.down' ) ) {
				var next = this.$el.next();
				if ( next.length ) {
					this.$el.insertAfter( next );
					moved = true;
				}
			} 
			if ( moved ) this.model.collection.trigger( 'manual-reorder' );
		},
		set_order: function() {
			this.model.set( 'order', this.$el.index() );
		}
	} );

})(jQuery, PC._us || window._);