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

	var O = PC.admin.layer_overrides = {

		/**
		 * What makes the layer what it is, or is already the link's own: never overridden.
		 * Mirrors Linker::override_excluded_fields().
		 */
		excluded: [ '_id', 'id', 'layerId', 'type', 'not_a_choice', 'is_global', 'global_id', 'order', 'image_order', 'overrides' ],

		/**
		 * Attributes of the link itself, which a new global definition never replaces.
		 */
		link_attributes: [ '_id', 'id', 'layerId', 'is_global', 'global_id', 'order', 'image_order', 'overrides', 'active', 'parent' ],

		/**
		 * A layer of this product linked to a global layer (not the global layer's own screen).
		 */
		is_link: function( model ) {
			if ( ! model || ! model.get( 'is_global' ) || ! model.get( 'global_id' ) ) return false;
			return ! ( PC.app && PC.app.isGlobalLayerStandalone && PC.app.isGlobalLayerStandalone() );
		},

		get: function( model ) {
			var o = ( model && model.get( 'overrides' ) ) || {};
			return {
				fields: _.isArray( o.fields ) ? o.fields.slice() : [],
				values: _.extend( {}, o.values ),
				global: _.extend( {}, o.global ),
				editing_original: !! o.editing_original,
			};
		},

		/**
		 * Whether "Edit original" is on for this link.
		 */
		is_editing_original: function( model ) {
			return O.is_link( model ) && O.get( model ).editing_original;
		},

		is_overridden: function( model, field ) {
			return O.is_link( model ) && -1 !== O.get( model ).fields.indexOf( field );
		},

		can_override: function( field ) {
			return !! field && -1 === O.excluded.indexOf( field );
		},

		/**
		 * The fields switched with one switch: a field and its translations.
		 *
		 * @param {String} field
		 * @return {String[]}
		 */
		group: function( field ) {
			var groups = lang( 'layer_override_groups', {} );
			return [ field ].concat( _.isArray( groups[ field ] ) ? groups[ field ] : [] );
		},

		/**
		 * The field a translation follows, or null.
		 */
		follows: function( field ) {
			var groups = lang( 'layer_override_groups', {} );
			for ( var base in groups ) {
				if ( _.isArray( groups[ base ] ) && -1 !== groups[ base ].indexOf( field ) ) return base;
			}
			return null;
		},

		store: function( model, o, attrs, options ) {
			attrs = attrs || {};
			if ( ! o.editing_original ) delete o.editing_original;
			attrs.overrides = ( o.fields.length || ! _.isEmpty( o.values ) || o.editing_original ) ? o : null;
			model.set( attrs, options );
		},

		/**
		 * "Edit original" turned on: the overridden fields show, and edit, their global values.
		 * The link's values wait in `values`.
		 */
		enter_original: function( model ) {
			if ( ! O.is_link( model ) || O.is_editing_original( model ) ) return;
			var o = O.get( model );
			var attrs = {};
			var unset = [];
			_.each( o.fields, function( f ) {
				o.values[ f ] = copy( model.get( f ) );
				if ( undefined === o.values[ f ] ) o.values[ f ] = null;
				if ( _.has( o.global, f ) ) {
					attrs[ f ] = copy( o.global[ f ] );
				} else {
					unset.push( f );
				}
			} );
			o.editing_original = true;
			// Not a change of the product, nor of the global layer.
			O.store( model, o, attrs, { pc_from_global: true } );
			_.each( unset, function( f ) {
				model.unset( f, { pc_from_global: true } );
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
			if ( ! O.is_editing_original( model ) ) return;
			var o = O.get( model );
			var attrs = {};
			_.each( o.fields, function( f ) {
				if ( saved ) {
					var current = model.get( f );
					if ( undefined === current ) {
						delete o.global[ f ];
					} else {
						o.global[ f ] = copy( current );
					}
				}
				attrs[ f ] = copy( o.values[ f ] );
			} );
			o.editing_original = false;
			O.store( model, o, attrs, { pc_from_global: true } );
		},

		/**
		 * Override a field (and its translations) for this link. The first time it starts from the
		 * global value, later from the value kept when it was switched off.
		 */
		switch_on: function( model, field ) {
			var o = O.get( model );
			var attrs = {};
			_.each( O.group( field ), function( f ) {
				if ( -1 !== o.fields.indexOf( f ) ) return;
				var current = model.get( f );
				// Inherited until now, so this is the global value.
				if ( undefined !== current ) o.global[ f ] = copy( current );
				var value = _.has( o.values, f ) ? o.values[ f ] : copy( current );
				// A listed field needs a value to be stored: null where the global layer has none.
				if ( undefined === value ) value = null;
				o.values[ f ] = value;
				o.fields.push( f );
				attrs[ f ] = copy( value );
			} );
			O.store( model, o, attrs );
		},

		/**
		 * Back to the global value; the link's value is kept for later.
		 */
		switch_off: function( model, field ) {
			var o = O.get( model );
			var attrs = {};
			var unset = [];
			_.each( O.group( field ), function( f ) {
				var index = o.fields.indexOf( f );
				if ( -1 === index ) return;
				o.fields.splice( index, 1 );
				o.values[ f ] = copy( model.get( f ) );
				if ( undefined === o.values[ f ] ) o.values[ f ] = null;
				if ( _.has( o.global, f ) ) {
					attrs[ f ] = copy( o.global[ f ] );
				} else {
					unset.push( f );
				}
				delete o.global[ f ];
			} );
			O.store( model, o, attrs );
			_.each( unset, function( f ) {
				model.unset( f );
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
			var o = O.get( model );
			delete data.overrides;
			if ( o.editing_original ) return data;
			_.each( o.fields, function( f ) {
				if ( _.has( o.global, f ) ) {
					data[ f ] = copy( o.global[ f ] );
				} else {
					delete data[ f ];
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
			var attrs = _.omit( copy( layer ), O.link_attributes );
			var o = O.get( model );
			_.each( o.fields, function( f ) {
				if ( _.has( attrs, f ) ) {
					o.global[ f ] = attrs[ f ];
				} else {
					delete o.global[ f ];
				}
				attrs[ f ] = copy( model.get( f ) );
			} );
			if ( o.fields.length || ! _.isEmpty( o.values ) ) attrs.overrides = o;
			model.set( attrs, options );
		},

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
				if ( layer ) O.apply_global( model, layer, { pc_from_global: true } );
				if ( _.isArray( choices ) && parseInt( model.id, 10 ) !== source_layer_id ) {
					var content = PC.app.get_layer_content( model.id );
					if ( content && content.reset ) {
						content.reset( PC.app.get_global_layers().process_content_layer_id( copy( choices ), model.id ) );
					}
				}
			} );
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
			var o = O.get( model );
			var fields = o.editing_original ? [] : o.fields;
			var keys = _.without( _.keys( changed || {} ), 'active' );
			var own = _.filter( keys, function( key ) {
				return 'overrides' === key || -1 !== fields.indexOf( key );
			} );
			return { own: own.length > 0, global: keys.length > own.length };
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

		/*
		 * The layer form.
		 * ------------------------------------------------------------------------------------------ */

		/**
		 * The field a form element belongs to, if it can take a switch.
		 *
		 * @param {jQuery} $el A `.setting` wrapper or a `[data-override-field]` block.
		 * @return {String|null}
		 */
		field_of: function( $el ) {
			if ( $el.is( '[data-override-field]' ) ) return $el.attr( 'data-override-field' );
			var match = ( $el.attr( 'class' ) || '' ).match( /(?:^|\s)setting-id-(\S+)/ );
			return match ? match[ 1 ] : null;
		},

		/**
		 * Whether a wrapper gets a switch: it opts in, or it holds the field's own input and does
		 * not opt out. Display-only fields (help, separators, html) get none.
		 */
		takes_switch: function( $el, field ) {
			if ( ! O.can_override( field ) || O.follows( field ) ) return false;
			if ( $el.is( '[data-override-field]' ) || $el.hasClass( 'can-override' ) ) return true;
			if ( $el.hasClass( 'no-override' ) ) return false;
			return $el.find( '[data-setting="' + field + '"]' ).length > 0;
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
		lock_field: function( $el, locked ) {
			$el.toggleClass( 'is-locked', !! locked );
			$el.find( 'input, textarea, select' ).prop( 'disabled', !! locked );
		},

		/**
		 * The override switches of a link's form, and which fields are locked.
		 * Called from layer_form.update_global_lock_state(), after the form locked every field.
		 *
		 * - The link's own view (form locked): every field gets a switch; overridden fields are
		 *   unlocked.
		 * - "Edit original" (form unlocked): the form edits the global layer, every field
		 *   editable with its global value (enter_original()), and knows nothing of the link's
		 *   overrides: no switches, no marks.
		 *
		 * @param {PC.views.layer_form} form
		 * @param {Boolean}             locked Whether the form is locked (not editing the global layer).
		 */
		decorate_form: function( form, locked ) {
			form.$( '.mkl-pc-override-switch' ).remove();
			form.$( '.has-override-switch' ).removeClass( 'has-override-switch' );
			form.$( '.is-overridden' ).removeClass( 'is-overridden' );
			form.$el.removeClass( 'has-overrides' );
			if ( ! O.is_link( form.model ) || ! locked ) return;

			var model = form.model;
			form.$( '.setting, [data-override-field]' ).each( function() {
				var $el = $( this );
				var field = O.field_of( $el );
				if ( ! field ) return;
				var base = O.follows( field );
				var overridden = O.is_overridden( model, base || field );
				$el.toggleClass( 'is-overridden', overridden );
				if ( overridden ) {
					O.lock_field( $el, false );
				}
				if ( O.takes_switch( $el, field ) ) {
					// In the corner: placed over the field's wrapper, nothing moves.
					$el.addClass( 'has-override-switch' ).append( O.switch_html( field, overridden ) );
				}
			} );
			form.$el.toggleClass( 'has-overrides', O.get( model ).fields.length > 0 );

			// The same global layer used more than once: the list shows the same name until one is
			// renamed for its link.
			var links = O.count_links( model.get( 'global_id' ) );
			if ( links > 1 && ! O.is_overridden( model, 'name' ) ) {
				form.$( '.setting-id-name' ).append( $( '<p class="mkl-pc-override-hint"></p>' ).text( lang( 'override_name_hint', 'This global layer is used %d times in this product: override the name to tell them apart.' ).replace( '%d', links ) ) );
			}

			// Two links share the global layer's HTML id until one is overridden.
			if ( ! O.is_overridden( model, 'html_id' ) && model.get( 'html_id' ) && O.count_links( model.get( 'global_id' ) ) > 1 ) {
				form.$( '.setting-id-html_id' ).append( $( '<p class="mkl-pc-override-hint"></p>' ).text( lang( 'override_html_id_hint', 'This global layer is used more than once in this product: override the ID on each link, or the page will have the same ID twice.' ) ) );
			}

			form.$el.off( 'click.pc_overrides' ).on( 'click.pc_overrides', '.mkl-pc-override-toggle', function( e ) {
				e.preventDefault();
				e.stopPropagation();
				var field = $( this ).attr( 'data-field' );
				if ( '1' === $( this ).attr( 'data-on' ) ) {
					O.switch_on( form.model, field );
					form.current_focus = field;
				} else {
					O.switch_off( form.model, field );
				}
				form.render();
			} );
		},

		/**
		 * Whether a field of the form can be edited now.
		 */
		is_field_locked: function( form, field ) {
			if ( ! form.$el.hasClass( 'is-global-locked' ) ) return false;
			return ! O.is_overridden( form.model, field );
		},
	};

} )( jQuery, PC._us || window._ );
