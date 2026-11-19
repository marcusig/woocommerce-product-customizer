/**
 * Linked global layers: each field of a link can be overridden for that link only.
 * See docs/global-layer-overrides-spec.md.
 *
 * A link's model holds its effective values (what the form, the list and the previews show) and
 * `overrides`:
 *   fields - the overridden fields;
 *   values - the link's values, kept when an override is switched off so switching it on again
 *            restores them;
 *   global - the global values of the overridden fields (sent by the server, never stored), to
 *            switch an override off and to save the global layer without the link's values;
 *   editing_original - set while "Edit original" is on (never stored).
 *
 * "Edit original" edits the global layer, separately from the link's overrides: entering it, the
 * overridden fields take their global values in the model (the link's are in `values`), so the
 * form, the mask view and every other view edit the global layer as they are; leaving it puts the
 * link's values back. While it is on, the server takes the link's values from `values`, should the
 * product be saved.
 *
 * The server takes a listed field's value from the layer itself, so editing an overridden field
 * is an ordinary model change: only `fields` has to be right.
 */
var PC = PC || {};
PC.admin = PC.admin || {};

( function( $, _ ) {

	var lang = function( key, fallback ) {
		return ( typeof PC_lang !== 'undefined' && PC_lang && PC_lang[ key ] ) ? PC_lang[ key ] : fallback;
	};

	var copy = function( value ) {
		if ( value && 'object' === typeof value ) return JSON.parse( JSON.stringify( value ) );
		return value;
	};

	/**
	 * The override logic, for a layer or for a choice of a linked layer
	 * (views/choice-overrides.js, docs/global-layer-choice-overrides-spec.md).
	 *
	 * @param {Object} config
	 *   excluded         - fields never overridden;
	 *   link_attributes  - attributes of the link itself, which a new global definition never replaces;
	 *   groups_key       - PC_lang key of the translation groups;
	 *   is_link          - whether a model is a link (function( model ) );
	 *   unset_when_empty - drop `overrides` instead of setting it to null when there are none;
	 *   read / write     - a field's value as stored in `values` / `global`, and as the model takes it
	 *                      back (function( field, value ); the choices' `images` is a collection).
	 */
	PC.admin.create_overrides = function( config ) {

	var read = config.read || function( model, field ) {
		return copy( model.get( field ) );
	};
	var write = config.write || function( field, value ) {
		return copy( value );
	};

	var Overrides = {

		/**
		 * What makes the object what it is, or is already the link's own: never overridden.
		 */
		excluded: config.excluded,

		/**
		 * Attributes of the link itself, which a new global definition never replaces.
		 */
		link_attributes: config.link_attributes,

		is_link: config.is_link,

		get: function( model ) {
			var overrides = ( model && model.get( 'overrides' ) ) || {};
			return {
				fields: _.isArray( overrides.fields ) ? overrides.fields.slice() : [],
				values: _.extend( {}, overrides.values ),
				global: _.extend( {}, overrides.global ),
				editing_original: !! overrides.editing_original,
			};
		},

		/**
		 * Whether "Edit original" is on for this link.
		 */
		is_editing_original: function( model ) {
			return Overrides.is_link( model ) && Overrides.get( model ).editing_original;
		},

		is_overridden: function( model, field ) {
			return Overrides.is_link( model ) && -1 !== Overrides.get( model ).fields.indexOf( field );
		},

		can_override: function( field ) {
			return !! field && -1 === Overrides.excluded.indexOf( field );
		},

		/**
		 * The fields switched with one switch: a field and its translations.
		 *
		 * @param {String} field
		 * @return {String[]}
		 */
		group: function( field ) {
			var groups = lang( config.groups_key, {} );
			return [ field ].concat( _.isArray( groups[ field ] ) ? groups[ field ] : [] );
		},

		/**
		 * The field a translation follows, or null.
		 */
		follows: function( field ) {
			var groups = lang( config.groups_key, {} );
			for ( var base in groups ) {
				if ( _.isArray( groups[ base ] ) && -1 !== groups[ base ].indexOf( field ) ) return base;
			}
			return null;
		},

		store: function( model, overrides, attributes, options ) {
			attributes = attributes || {};
			if ( ! overrides.editing_original ) delete overrides.editing_original;
			var any = overrides.fields.length || ! _.isEmpty( overrides.values ) || overrides.editing_original;
			if ( any ) {
				attributes.overrides = overrides;
			} else if ( ! config.unset_when_empty ) {
				attributes.overrides = null;
			}
			model.set( attributes, options );
			if ( ! any && config.unset_when_empty ) model.unset( 'overrides', options );
		},

		/**
		 * "Edit original" turned on: the overridden fields show, and edit, their global values.
		 * The link's values wait in `values`.
		 */
		enter_original: function( model ) {
			if ( ! Overrides.is_link( model ) || Overrides.is_editing_original( model ) ) return;
			var overrides = Overrides.get( model );
			var attributes = {};
			var unset = [];
			_.each( overrides.fields, function( field ) {
				overrides.values[ field ] = read( model, field );
				if ( undefined === overrides.values[ field ] ) overrides.values[ field ] = null;
				if ( _.has( overrides.global, field ) ) {
					attributes[ field ] = write( field, overrides.global[ field ] );
				} else {
					unset.push( field );
				}
			} );
			overrides.editing_original = true;
			// Not a change of the product, nor of the global layer.
			Overrides.store( model, overrides, attributes, { pc_from_global: true } );
			_.each( unset, function( field ) {
				model.unset( field, { pc_from_global: true } );
			} );
		},

		/**
		 * "Edit original" turned off: the link's values are back.
		 *
		 * @param {Backbone.Model} model
		 * @param {Boolean}        saved The global layer was saved: what the form shows is its new
		 *                               value of the overridden fields.
		 */
		leave_original: function( model, saved ) {
			if ( ! Overrides.is_editing_original( model ) ) return;
			var overrides = Overrides.get( model );
			var attributes = {};
			_.each( overrides.fields, function( field ) {
				if ( saved ) {
					var current = read( model, field );
					if ( undefined === current ) {
						delete overrides.global[ field ];
					} else {
						overrides.global[ field ] = current;
					}
				}
				attributes[ field ] = write( field, overrides.values[ field ] );
			} );
			overrides.editing_original = false;
			Overrides.store( model, overrides, attributes, { pc_from_global: true } );
		},

		/**
		 * Override a field (and its translations) for this link. The first time it starts from the
		 * global value, later from the value kept when it was switched off.
		 */
		switch_on: function( model, field ) {
			var overrides = Overrides.get( model );
			var attributes = {};
			_.each( Overrides.group( field ), function( group_field ) {
				if ( -1 !== overrides.fields.indexOf( group_field ) ) return;
				var current = read( model, group_field );
				// Inherited until now, so this is the global value.
				if ( undefined !== current ) overrides.global[ group_field ] = copy( current );
				var value = _.has( overrides.values, group_field ) ? overrides.values[ group_field ] : current;
				// A listed field needs a value to be stored: null where the global layer has none.
				if ( undefined === value ) value = null;
				overrides.values[ group_field ] = value;
				overrides.fields.push( group_field );
				attributes[ group_field ] = write( group_field, value );
			} );
			Overrides.store( model, overrides, attributes );
		},

		/**
		 * Back to the global value; the link's value is kept for later.
		 */
		switch_off: function( model, field ) {
			var overrides = Overrides.get( model );
			var attributes = {};
			var unset = [];
			_.each( Overrides.group( field ), function( group_field ) {
				var index = overrides.fields.indexOf( group_field );
				if ( -1 === index ) return;
				overrides.fields.splice( index, 1 );
				overrides.values[ group_field ] = read( model, group_field );
				if ( undefined === overrides.values[ group_field ] ) overrides.values[ group_field ] = null;
				if ( _.has( overrides.global, group_field ) ) {
					attributes[ group_field ] = write( group_field, overrides.global[ group_field ] );
				} else {
					unset.push( group_field );
				}
				delete overrides.global[ group_field ];
			} );
			Overrides.store( model, overrides, attributes );
			_.each( unset, function( group_field ) {
				model.unset( group_field );
			} );
		},

		/**
		 * The layer as the global layer has it: what saving the global layer from a link sends.
		 * Without this, editing the shared settings from the "Collar" link would rename the global
		 * layer "Collar".
		 *
		 * @param {Backbone.Model} model
		 * @return {Object}
		 */
		global_attributes: function( model ) {
			var data = PC.toJSON( model );
			var overrides = Overrides.get( model );
			delete data.overrides;
			if ( overrides.editing_original ) return data;
			_.each( overrides.fields, function( field ) {
				if ( _.has( overrides.global, field ) ) {
					data[ field ] = copy( overrides.global[ field ] );
				} else {
					delete data[ field ];
				}
			} );
			return data;
		},

		/**
		 * A new definition of the global layer reached a link: the inherited fields take it, the
		 * overridden ones stay the link's.
		 *
		 * @param {Backbone.Model} model
		 * @param {Object}         layer   The global layer's definition.
		 * @param {Object}         options Backbone set options.
		 */
		apply_global: function( model, layer, options ) {
			if ( ! model || ! layer || 'object' !== typeof layer ) return;
			var attributes = _.omit( copy( layer ), Overrides.link_attributes );
			var overrides = Overrides.get( model );
			_.each( overrides.fields, function( field ) {
				if ( _.has( attributes, field ) ) {
					overrides.global[ field ] = attributes[ field ];
				} else {
					delete overrides.global[ field ];
				}
				attributes[ field ] = write( field, read( model, field ) );
			} );
			if ( overrides.fields.length || ! _.isEmpty( overrides.values ) ) attributes.overrides = overrides;
			model.set( attributes, options );
		},

		/**
		 * Whether a change of a link's model is the link's own (an override), which the product
		 * saves, rather than the global layer's.
		 *
		 * @param {Backbone.Model} model
		 * @param {Object}         changed changedAttributes()
		 * @return {{own: Boolean, global: Boolean}}
		 */
		classify_changes: function( model, changed ) {
			var overrides = Overrides.get( model );
			var fields = overrides.editing_original ? [] : overrides.fields;
			var keys = _.without( _.keys( changed || {} ), 'active' );
			var own = _.filter( keys, function( key ) {
				return 'overrides' === key || -1 !== fields.indexOf( key );
			} );
			return { own: own.length > 0, global: keys.length > own.length };
		},

		/*
		 * The layer form.
		 * ------------------------------------------------------------------------------------------ */

		/**
		 * The field a form element belongs to, if it can take a switch.
		 *
		 * @param {jQuery} $element A `.setting` wrapper or a `[data-override-field]` block.
		 * @return {String|null}
		 */
		field_of: function( $element ) {
			if ( $element.is( '[data-override-field]' ) ) return $element.attr( 'data-override-field' );
			var match = ( $element.attr( 'class' ) || '' ).match( /(?:^|\s)setting-id-(\S+)/ );
			return match ? match[ 1 ] : null;
		},

		/**
		 * Whether a wrapper gets a switch: it opts in, or it holds the field's own input and does
		 * not opt out. Display-only fields (help, separators, html) get none.
		 */
		takes_switch: function( $element, field ) {
			if ( ! Overrides.can_override( field ) || Overrides.follows( field ) ) return false;
			if ( $element.is( '[data-override-field]' ) || $element.hasClass( 'can-override' ) ) return true;
			if ( $element.hasClass( 'no-override' ) ) return false;
			return $element.find( '[data-setting="' + field + '"]' ).length > 0;
		},

		/**
		 * The switch: an icon button in the field's top-right corner. Locked (inherited) shows a
		 * lock, overridden an undo arrow next to a "This link only" badge. The label is on the
		 * button for screen readers and as its tooltip.
		 */
		switch_html: function( field, overridden ) {
			var $switch = $( '<div class="mkl-pc-override-switch"></div>' );
			var label = overridden
				? lang( 'override_off', 'Use the global layer\'s value' )
				: lang( 'override_on', 'Override for this link' );
			if ( overridden ) {
				$switch.append( $( '<span class="mkl-pc-override-badge"></span>' ).text( lang( 'override_badge', 'This link only' ) ) );
			}
			var $button = $( '<button type="button" class="mkl-pc-override-toggle"></button>' )
				.attr( {
					'data-field': field,
					'data-on': overridden ? '0' : '1',
					'aria-label': label,
					title: label,
				} )
				.append( $( '<span class="dashicons" aria-hidden="true"></span>' ).addClass( overridden ? 'dashicons-undo' : 'dashicons-lock' ) );
			return $switch.append( $button );
		},

		/**
		 * Lock or unlock one field of the form.
		 */
		lock_field: function( $element, locked ) {
			$element.toggleClass( 'is-locked', !! locked );
			$element.find( 'input, textarea, select, button' ).not( '.mkl-pc-override-toggle' ).prop( 'disabled', !! locked );
		},

		/**
		 * The override switches of a link's form, and which fields are locked.
		 *
		 * - The link's own view (form locked): every field gets a switch; overridden fields are
		 *   unlocked.
		 * - "Edit original" (form unlocked): the form edits the global object, every field
		 *   editable with its global value (enter_original()), and knows nothing of the link's
		 *   overrides: no switches, no marks.
		 *
		 * @param {Backbone.View} form
		 * @param {Boolean}       locked Whether the form is locked (not editing the global object).
		 */
		decorate_fields: function( form, locked ) {
			form.$( '.mkl-pc-override-switch' ).remove();
			form.$( '.has-override-switch' ).removeClass( 'has-override-switch' );
			form.$( '.is-overridden' ).removeClass( 'is-overridden' );
			form.$el.removeClass( 'has-overrides' );
			if ( ! Overrides.is_link( form.model ) || ! locked ) return false;

			var model = form.model;
			form.$( '.setting, [data-override-field]' ).each( function() {
				var $element = $( this );
				var field = Overrides.field_of( $element );
				if ( ! field ) return;
				var base = Overrides.follows( field );
				var overridden = Overrides.is_overridden( model, base || field );
				$element.toggleClass( 'is-overridden', overridden );
				if ( overridden ) {
					Overrides.lock_field( $element, false );
				}
				if ( Overrides.takes_switch( $element, field ) ) {
					// In the corner: placed over the field's wrapper, nothing moves.
					$element.addClass( 'has-override-switch' ).append( Overrides.switch_html( field, overridden ) );
				}
			} );
			form.$el.toggleClass( 'has-overrides', Overrides.get( model ).fields.length > 0 );

			form.$el.off( 'click.pc_overrides' ).on( 'click.pc_overrides', '.mkl-pc-override-toggle', function( event ) {
				event.preventDefault();
				event.stopPropagation();
				var field = $( this ).attr( 'data-field' );
				if ( '1' === $( this ).attr( 'data-on' ) ) {
					Overrides.switch_on( form.model, field );
					form.current_focus = field;
				} else {
					Overrides.switch_off( form.model, field );
				}
				form.render();
			} );
			return true;
		},
	};

	return Overrides;
	};

	/*
	 * Layers.
	 * ------------------------------------------------------------------------------------------ */
	var Layer_Overrides = PC.admin.layer_overrides = PC.admin.create_overrides( {
		/**
		 * What makes the layer what it is, or is already the link's own: never overridden.
		 * Mirrors Linker::override_excluded_fields().
		 */
		excluded: [ '_id', 'id', 'layerId', 'type', 'not_a_choice', 'is_global', 'global_id', 'order', 'image_order', 'image_order_by_angle', 'overrides' ],
		link_attributes: [ '_id', 'id', 'layerId', 'is_global', 'global_id', 'order', 'image_order', 'image_order_by_angle', 'overrides', 'active', 'parent' ],
		groups_key: 'layer_override_groups',
		/**
		 * A layer of this product linked to a global layer (not the global layer's own screen).
		 */
		is_link: function( model ) {
			if ( ! model || ! model.get( 'is_global' ) || ! model.get( 'global_id' ) ) return false;
			return ! ( PC.app && PC.app.isGlobalLayerStandalone && PC.app.isGlobalLayerStandalone() );
		},
	} );

	_.extend( Layer_Overrides, {

		/**
		 * After the global layer was saved, bring every link to it up to date: settings, and the
		 * choices of the links other than the one they were edited from.
		 *
		 * @param {Number} global_id
		 * @param {Object|null} layer   Global layer definition saved, or null.
		 * @param {Array|null}  choices Choices saved, or null.
		 */
		refresh_links: function( global_id, layer, choices ) {
			var layers = PC.app && PC.app.get_collection && PC.app.get_collection( 'layers' );
			if ( ! layers || ! global_id ) return;
			var source_layer_id = ( _.isArray( choices ) && choices.length && choices[ 0 ] ) ? parseInt( choices[ 0 ].layerId, 10 ) : null;
			layers.each( function( model ) {
				if ( parseInt( model.get( 'global_id' ), 10 ) !== parseInt( global_id, 10 ) || ! model.get( 'is_global' ) ) return;
				if ( layer ) Layer_Overrides.apply_global( model, layer, { pc_from_global: true } );
				if ( _.isArray( choices ) && parseInt( model.id, 10 ) !== source_layer_id ) {
					var content = PC.app.get_layer_content( model.id );
					if ( content && content.reset ) {
						var data = PC.app.get_global_layers().process_content_layer_id( copy( choices ), model.id );
						// The link's own choice overrides go back on top (docs/global-layer-choice-overrides-spec.md).
						if ( PC.admin && PC.admin.choice_overrides ) data = PC.admin.choice_overrides.rebase( content.models, data );
						content.reset( data );
					}
				}
			} );
		},

		/**
		 * The links to a global layer in this product.
		 */
		count_links: function( global_id ) {
			var layers = PC.app && PC.app.get_collection && PC.app.get_collection( 'layers' );
			if ( ! layers ) return 0;
			return layers.filter( function( model ) {
				return model.get( 'is_global' ) && parseInt( model.get( 'global_id' ), 10 ) === parseInt( global_id, 10 );
			} ).length;
		},

		/**
		 * The override switches of a link's form, and which fields are locked.
		 * Called from layer_form.update_global_lock_state(), after the form locked every field.
		 *
		 * @param {PC.views.layer_form} form
		 * @param {Boolean}             locked Whether the form is locked (not editing the global layer).
		 */
		decorate_form: function( form, locked ) {
			if ( ! Layer_Overrides.decorate_fields( form, locked ) ) return;
			var model = form.model;

			// The same global layer used more than once: the list shows the same name until one is
			// renamed for its link.
			var links = Layer_Overrides.count_links( model.get( 'global_id' ) );
			if ( links > 1 && ! Layer_Overrides.is_overridden( model, 'name' ) ) {
				form.$( '.setting-id-name' ).append( $( '<p class="mkl-pc-override-hint"></p>' ).text( lang( 'override_name_hint', 'This global layer is used %d times in this product: override the name to tell them apart.' ).replace( '%d', links ) ) );
			}

			// Two links share the global layer's HTML id until one is overridden.
			if ( ! Layer_Overrides.is_overridden( model, 'html_id' ) && model.get( 'html_id' ) && Layer_Overrides.count_links( model.get( 'global_id' ) ) > 1 ) {
				form.$( '.setting-id-html_id' ).append( $( '<p class="mkl-pc-override-hint"></p>' ).text( lang( 'override_html_id_hint', 'This global layer is used more than once in this product: override the ID on each link, or the page will have the same ID twice.' ) ) );
			}
		},

		/**
		 * Whether a field of the form can be edited now.
		 */
		is_field_locked: function( form, field ) {
			if ( ! form.$el.hasClass( 'is-global-locked' ) ) return false;
			return ! Layer_Overrides.is_overridden( form.model, field );
		},
	} );

} )( jQuery, PC._us || window._ );
