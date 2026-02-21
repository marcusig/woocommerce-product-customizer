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
			this.listenTo( this.options, 'add', this.save_options );
			this.listenTo( this.options, 'change destroy', this.save_options );
		},
		get_default_option: function() {
			// Generate the defaults object
			const defaults = Object.keys( this.fields ).reduce( ( acc, slug ) => {
				const field = this.fields[slug];
				acc[slug] = typeof field.default !== 'undefined' ? field.default : '';
				return acc;
			  }, {});
			
			defaults.order = PC.app.get_new_order( this.options )
			return wp.hooks.applyFilters( 'PC.field.repeater.get_default_option', defaults );
		},
		render: function() {
			this.$el.append( this.template() );
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
			this.model.set( e.target.name, e.target.value );
		},
		on_select_change: function( e ) {
			this.model.set( e.target.name, e.target.value );
			if ( e.target.name === 'action_type' ) {
				this.toggle_action_visibility();
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